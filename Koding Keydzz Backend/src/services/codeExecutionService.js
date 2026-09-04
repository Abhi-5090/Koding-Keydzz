import { spawn, spawnSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError } from '../utils/ApiError.js';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

// Limits for local execution (educational workloads: print, loops, etc.).
const TIMEOUT_MS = 8000; // hard wall-clock cap per run
const MAX_OUTPUT = 100_000; // cap captured stdout/stderr at ~100 KB
/**
 * Compiling gets its own, shorter budget.
 *
 * A compile that has not finished in five seconds is not going to: it is a
 * pathological include chain or a template blow-up, not a slow-but-valid
 * program. Sharing the run budget would let a compile eat the whole allowance
 * and leave a correct program looking like a timeout.
 */
const COMPILE_TIMEOUT_MS = 5000;

/**
 * Our language names mapped onto local toolchains (first available wins) and
 * onto Piston runtimes for the remote runner.
 *
 * Two shapes live here:
 *
 *   • INTERPRETED (`python`) — the binary is handed the source file.
 *   • COMPILED (`c`) — `compile` builds an executable first, and only then is
 *     the built program run. `compileArgs` is a function so the temp filenames
 *     stay in one place instead of being rebuilt at each call site.
 *
 * JavaScript was removed: the platform is a Python-first course ladder, and a
 * language that belongs to no course would appear in the runner while having
 * no lessons, quizzes or games behind it.
 *
 * `html` is deliberately absent and always will be — it is rendered in a
 * preview pane, not executed, so an entry here would promise a runner that
 * cannot exist.
 */
const LANGUAGE_MAP = {
  python: {
    cmds: ['python3', 'python'],
    filename: 'main.py',
    piston: 'python',
  },
  c: {
    // `cc` last: it is usually a symlink to one of the first two, so naming
    // them first makes the resolved compiler predictable in logs.
    cmds: ['gcc', 'clang', 'cc'],
    filename: 'main.c',
    piston: 'c',
    /**
     * Compiled, not interpreted.
     *
     * `-std=c11` so the course can teach one dialect rather than whatever the
     * host compiler defaults to — a pupil's answer must not be correct on the
     * server and wrong on their teacher's machine.
     *
     * `-O0` keeps compile time down and, more importantly, keeps behaviour
     * predictable: an optimiser is entitled to delete the undefined behaviour
     * beginners write, so -O2 can make a broken program appear to work.
     *
     * Warnings are NOT errors. A warning is something to teach; failing the
     * build on one would mark a working answer wrong.
     */
    compile: {
      out: 'program',
      args: ({ source, out }) => [
        '-std=c11',
        '-O0',
        '-pipe',
        '-lm',
        '-o',
        out,
        source,
      ],
    },
  },
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

/**
 * Interpreter resolution is LAZY.
 *
 * This used to run two `spawnSync(..., '--version')` calls at module load —
 * each with a 4-second timeout — on every boot, even though server-side code
 * execution is disabled by default and the probe result was never used. That
 * is pure startup latency (and a container health-check risk on a slow host).
 * Now the probe happens on the first actual run and is memoized.
 */
const RESOLVED_BIN = {};

function resolveBin(language) {
  if (!(language in RESOLVED_BIN)) {
    RESOLVED_BIN[language] = firstAvailable(LANGUAGE_MAP[language]?.cmds || []);
  }
  return RESOLVED_BIN[language];
}

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
/**
 * Build a compiled language's source into an executable.
 *
 * Returns `{ ok: true }` when the build succeeded, or `{ ok: false, result }`
 * carrying a normalised result whose stderr is the compiler's own diagnostics.
 * That distinction matters: "your code does not compile" is feedback a pupil
 * can act on, while "there is no compiler installed" is an operator problem,
 * and conflating them either hides a broken deployment or blames the child for
 * it.
 */
async function compileLocal({ lang, bin, dir }) {
  const out = lang.compile.out;
  const args = lang.compile.args({ source: lang.filename, out });

  return await new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: dir,
      timeout: COMPILE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString();
    });

    child.on('error', (e) =>
      resolve({
        ok: false,
        result: {
          stdout: '',
          stderr: e.message,
          output: e.message,
          exitCode: 1,
          compileFailed: true,
          mocked: false,
        },
      }),
    );

    child.on('close', (exitCode, signal) => {
      if (exitCode === 0) {
        resolve({ ok: true });
        return;
      }
      const timedOut = signal === 'SIGKILL' || child.killed;
      const message = timedOut
        ? `[Compiling timed out after ${COMPILE_TIMEOUT_MS / 1000}s]`
        : stderr || stdout || 'Compilation failed.';
      resolve({
        ok: false,
        result: {
          stdout: '',
          stderr: message,
          output: message.trim(),
          // 1 rather than the compiler's own code: the marker only needs to
          // know this did not produce a runnable program.
          exitCode: 1,
          compileFailed: true,
          timedOut,
          mocked: false,
        },
      });
    });
  });
}

async function runLocal({ language, code, stdin }) {
  const lang = LANGUAGE_MAP[language];
  const bin = resolveBin(language);
  if (!lang || !bin) return null;

  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), 'kk-run-'));
    const file = join(dir, lang.filename);
    await writeFile(file, code, 'utf8');

    /* ---- compiled languages build first ---- */
    let runBin = bin;
    let runArgs = [lang.filename];

    if (lang.compile) {
      const built = await compileLocal({ lang, bin, dir });
      // A compile error is a RESULT, not a failure of the runner: the pupil
      // wrote code that does not build, and the compiler's message is the most
      // useful thing we can hand back. Returning null here would instead be
      // read as "no toolchain" and fall through to the remote runner.
      if (!built.ok) return built.result;
      // `./program` — a bare name would be looked up on PATH.
      runBin = join(dir, lang.compile.out);
      runArgs = [];
    }

    return await new Promise((resolve) => {
      const child = spawn(runBin, runArgs, {
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
        }),
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
export async function runCode({
  language,
  code,
  stdin = '',
  allowRemote = false,
}) {
  if (!LANGUAGE_MAP[language]) {
    throw ApiError.badRequest(
      `Unsupported language: ${language}. ` +
        `Supported: ${Object.keys(LANGUAGE_MAP).join(', ')}.`,
    );
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw ApiError.badRequest('Code is required');
  }

  /**
   * TWO KEYS ARE NEEDED TO SEND CODE OFF THIS MACHINE.
   *
   * The remote runner is Piston, a THIRD-PARTY service at emkc.org. Sending a
   * child's code there is a decision, not a fallback, so it now takes both:
   *
   *   1. the operator's permission — CODE_RUNNER must be 'auto' or 'piston';
   *   2. the CALL SITE's permission — `allowRemote: true`.
   *
   * Defaulting `allowRemote` to false is the important half. The previous
   * behaviour was a single key that defaulted to open: CODE_RUNNER was 'auto'
   * unless set, so any caller with no local interpreter silently posted user
   * code to a third party. `ENABLE_SERVER_CODE_EXEC=false` did not stop it —
   * that flag guards the playground ROUTE, while final-test marking calls this
   * function directly. Exam answers could therefore be sent out for marking,
   * which is the case this guard exists to make impossible.
   */
  const mode = remoteMode();
  const remoteAllowed = allowRemote && mode !== 'local';

  if (mode === 'piston') {
    if (!remoteAllowed) return offlineNotice(language);
    return (
      (await runPiston({ language, code, stdin })) || offlineNotice(language)
    );
  }

  // 'local' or 'auto': always try this machine first.
  const local = await runLocal({ language, code, stdin });
  if (local) return local;

  if (!remoteAllowed) return offlineNotice(language);

  return (
    (await runPiston({ language, code, stdin })) || offlineNotice(language)
  );
}

/**
 * The operator's remote-execution setting.
 *
 * Defaults to 'local' — never leave the machine unless somebody said so. The
 * old default was 'auto', which made "phone a third party" the behaviour you
 * got by doing nothing.
 */
export function remoteMode() {
  return process.env.CODE_RUNNER || 'local';
}

/** Exposed for diagnostics/health (which runners are available). */
export function availableRunners() {
  // Derived from LANGUAGE_MAP so a new language cannot be added to the runner
  // and then silently missing from the health report.
  return Object.fromEntries(
    Object.keys(LANGUAGE_MAP).map((lang) => [lang, resolveBin(lang)]),
  );
}

export default { runCode, availableRunners };
