import { spawn, spawnSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError } from '../utils/ApiError.js';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

// Limits for local execution (educational workloads: print, loops, etc.).
const TIMEOUT_MS = 8000; // hard wall-clock cap per run
const MAX_OUTPUT = 100_000; // cap captured stdout/stderr at ~100 KB

// Map our language names onto local interpreters (first available wins) and
// onto Piston runtimes for the remote fallback.
const LANGUAGE_MAP = {
  python: { cmds: ['python3', 'python'], filename: 'main.py', piston: 'python' },
  javascript: { cmds: ['node'], filename: 'main.js', piston: 'node' },
};

/** Detect the first interpreter on PATH for a language (resolved once at boot). */
function firstAvailable(cmds) {
  for (const c of cmds) {
    try {
      const r = spawnSync(c, ['--version'], { timeout: 4000 });
      if (!r.error) return c;
    } catch {
      /* try next */
    }
  }
  return null;
}

const RESOLVED_BIN = {
  python: firstAvailable(LANGUAGE_MAP.python.cmds),
  javascript: firstAvailable(LANGUAGE_MAP.javascript.cmds),
};

/**
 * Run user code LOCALLY via child_process in a throwaway temp dir.
 *
 * Safeguards: hard timeout (SIGKILL), captured-output cap, no shell (args are
 * passed as an array so there's no shell-injection surface), and the temp dir
 * is always removed. This is intended for a trusted/local educational setup.
 * For an untrusted multi-tenant production deployment, run this behind a real
 * sandbox (self-hosted Piston, Docker with seccomp/limits, or a jailed runner).
 *
 * Returns a normalized result, or `null` if no local interpreter is available
 * (so the caller can fall back to the remote runner).
 */
async function runLocal({ language, code, stdin }) {
  const lang = LANGUAGE_MAP[language];
  const bin = RESOLVED_BIN[language];
  if (!lang || !bin) return null;

  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), 'kk-run-'));
    const file = join(dir, lang.filename);
    await writeFile(file, code, 'utf8');

    return await new Promise((resolve) => {
      const child = spawn(bin, [lang.filename], {
        cwd: dir,
        timeout: TIMEOUT_MS,
        killSignal: 'SIGKILL',
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let stdout = '';
      let stderr = '';
      const append = (buf, which) => {
        const s = buf.toString();
        if (which === 'out' && stdout.length < MAX_OUTPUT) stdout += s;
        else if (which === 'err' && stderr.length < MAX_OUTPUT) stderr += s;
      };
      child.stdout.on('data', (d) => append(d, 'out'));
      child.stderr.on('data', (d) => append(d, 'err'));

      // Feed stdin (ignore EPIPE if the program never reads input).
      child.stdin.on('error', () => {});
      if (stdin) child.stdin.write(stdin);
      child.stdin.end();

      child.on('error', (e) =>
        resolve({
          stdout,
          stderr: stderr || e.message,
          output: stderr || e.message,
          exitCode: 1,
          mocked: false,
        })
      );

      child.on('close', (exitCode, signal) => {
        const timedOut = signal === 'SIGKILL' || child.killed;
        if (timedOut) {
          const note = `\n[Execution timed out after ${TIMEOUT_MS / 1000}s]`;
          resolve({
            stdout,
            stderr: stderr + note,
            output: (stdout + stderr + note).trim(),
            exitCode: 124,
            timedOut: true,
            mocked: false,
          });
          return;
        }
        const truncated =
          stdout.length >= MAX_OUTPUT || stderr.length >= MAX_OUTPUT
            ? '\n[output truncated]'
            : '';
        resolve({
          stdout,
          stderr,
          output: (stdout + stderr + truncated).trim(),
          exitCode: typeof exitCode === 'number' ? exitCode : 0,
          mocked: false,
        });
      });
    });
  } catch {
    return null;
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Best-effort remote execution via the public Piston API. Returns null on failure. */
async function runPiston({ language, code, stdin }) {
  const lang = LANGUAGE_MAP[language];
  if (!lang) return null;
  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang.piston,
        version: '*',
        files: [{ name: lang.filename, content: code }],
        stdin: stdin || '',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const run = data.run || {};
    const stdout = run.stdout || '';
    const stderr = run.stderr || '';
    return {
      stdout,
      stderr,
      output: run.output || `${stdout}${stderr}`,
      exitCode: typeof run.code === 'number' ? run.code : 0,
      mocked: false,
    };
  } catch {
    return null;
  }
}

/** Friendly message when neither a local interpreter nor the remote runner is available. */
function offlineNotice(language) {
  return {
    stdout: '',
    stderr: '',
    output: `[code runner unavailable] No local '${language}' interpreter was found and the remote sandbox is unreachable. Your code was not executed.`,
    exitCode: 0,
    mocked: true,
  };
}

/**
 * Execute user code. Strategy (configurable via CODE_RUNNER env):
 *   - 'local'  : local interpreters only
 *   - 'piston' : remote Piston only
 *   - 'auto'   : local first, then Piston, then a friendly offline notice (default)
 */
export async function runCode({ language, code, stdin = '' }) {
  if (!LANGUAGE_MAP[language]) {
    throw ApiError.badRequest(
      `Unsupported language: ${language}. Use 'python' or 'javascript'.`
    );
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw ApiError.badRequest('Code is required');
  }

  const mode = process.env.CODE_RUNNER || 'auto';

  if (mode === 'piston') {
    return (await runPiston({ language, code, stdin })) || offlineNotice(language);
  }

  // local or auto: try local first.
  const local = await runLocal({ language, code, stdin });
  if (local) return local;

  if (mode === 'local') return offlineNotice(language);

  // auto fallback to remote, then notice.
  return (await runPiston({ language, code, stdin })) || offlineNotice(language);
}

/** Exposed for diagnostics/health (which runners are available). */
export function availableRunners() {
  return {
    python: RESOLVED_BIN.python,
    javascript: RESOLVED_BIN.javascript,
  };
}

export default { runCode, availableRunners };
