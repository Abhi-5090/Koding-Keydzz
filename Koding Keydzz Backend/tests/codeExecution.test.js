import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  runCode,
  remoteMode,
  availableRunners,
} from '../src/services/codeExecutionService.js';

/**
 * THE CODE RUNNER.
 *
 * Two independent concerns, both of which had real defects:
 *
 *   1. WHERE CODE RUNS. The remote runner is Piston, a third-party service at
 *      emkc.org. It used to be reachable by default — CODE_RUNNER defaulted to
 *      'auto', so any caller with no local interpreter silently posted user
 *      code off the machine. `ENABLE_SERVER_CODE_EXEC=false` did not prevent
 *      it, because that flag guards the playground ROUTE while final-test
 *      marking calls the runner directly. A child's examined work could be
 *      sent out, and an outside service could decide a mark that gates their
 *      next course.
 *
 *   2. COMPILED LANGUAGES. C needs a build before it can run, and a build
 *      failure has to be told apart from a missing toolchain: the first is
 *      feedback for the pupil, the second is an operator's problem. Conflating
 *      them either blames a child for a broken deployment or hides one.
 *
 * These tests execute real code where a real toolchain is present, and skip
 * (rather than silently pass) where one is not.
 */

const HELLO_C = '#include <stdio.h>\nint main(void) { printf("hi\\n"); return 0; }';

describe('where code is allowed to run', () => {
  const original = process.env.CODE_RUNNER;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CODE_RUNNER;
    else process.env.CODE_RUNNER = original;
  });

  it('defaults to local — doing nothing must not phone a third party', () => {
    delete process.env.CODE_RUNNER;
    expect(remoteMode()).toBe('local');
  });

  it('NEVER calls out when the caller has not allowed it', async () => {
    /**
     * The guard that protects exam answers.
     *
     * Even with the operator's permission ('auto'), a call site that does not
     * pass `allowRemote` must not reach the network. Final-test marking relies
     * on exactly this.
     */
    process.env.CODE_RUNNER = 'auto';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // A language with no local interpreter available is the case that used to
    // fall through to Piston. Force it by asking for a nonexistent binary via
    // a language whose toolchain is absent — python may exist here, so assert
    // on the spy rather than the result.
    await runCode({ language: 'python', code: 'print(1)' });

    expect(fetchSpy, 'the runner made a network call without permission').not.toHaveBeenCalled();
  });

  it('does not call out even when the caller allows it, if the operator said local', async () => {
    // The other key. An operator who pinned 'local' has said "nothing leaves
    // this machine", and no call site may override that.
    process.env.CODE_RUNNER = 'local';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await runCode({
      language: 'python',
      code: 'print(1)',
      allowRemote: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a clear notice rather than pretending, when it cannot run at all', async () => {
    // 'piston' with no permission from the call site: there is no local path
    // requested and no remote allowed, so the honest answer is "not executed".
    process.env.CODE_RUNNER = 'piston';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await runCode({ language: 'python', code: 'print(1)' });

    expect(fetchSpy).not.toHaveBeenCalled();
    // `mocked` is what tells the marker nothing actually ran, so a pupil is
    // flagged for review instead of scored against an empty result.
    expect(res.mocked).toBe(true);
    expect(res.output).toMatch(/not executed/i);
  });

  it('rejects an unsupported language rather than guessing', async () => {
    await expect(runCode({ language: 'ruby', code: 'puts 1' })).rejects.toThrow(
      /Unsupported language/i
    );
  });

  it('rejects empty code', async () => {
    await expect(runCode({ language: 'python', code: '   ' })).rejects.toThrow(/required/i);
  });

  it('does not offer html as a runnable language', () => {
    // HTML is rendered in a preview pane, never executed. An entry in the
    // runner would promise something that cannot exist.
    expect(Object.keys(availableRunners())).not.toContain('html');
  });
});

describe('C — a compiled language', () => {
  const hasCompiler = Boolean(availableRunners().c);

  it('lists a C toolchain in the health report', () => {
    // Not asserting one is INSTALLED — asserting the runner knows to look.
    expect(availableRunners()).toHaveProperty('c');
  });

  it.skipIf(!hasCompiler)('compiles and runs a program', async () => {
    const res = await runCode({ language: 'c', code: HELLO_C });
    expect(res.stdout.trim()).toBe('hi');
    expect(res.exitCode).toBe(0);
    expect(res.compileFailed).toBeFalsy();
  });

  it.skipIf(!hasCompiler)('feeds stdin to the built program', async () => {
    const res = await runCode({
      language: 'c',
      code:
        '#include <stdio.h>\nint main(void){ int n; if(scanf("%d",&n)!=1) return 1; printf("%d\\n", n*2); return 0; }',
      stdin: '21',
    });
    expect(res.stdout.trim()).toBe('42');
  });

  it.skipIf(!hasCompiler)('returns the compiler’s own message for code that will not build', async () => {
    /**
     * The most useful thing a beginner can be handed. A generic "compilation
     * failed" teaches nothing; `error: expected ';'` teaches the lesson.
     */
    const res = await runCode({ language: 'c', code: 'int main(void){ return x }' });

    expect(res.compileFailed).toBe(true);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(/error/i);
    expect(res.stdout).toBe('');
  });

  it.skipIf(!hasCompiler)('does not fall back to a remote runner on a compile error', async () => {
    /**
     * The subtle one, and the reason `compileLocal` distinguishes its two
     * outcomes.
     *
     * "This does not compile" is a RESULT. Treated as "no toolchain here" it
     * would fall through to the remote runner — so a pupil's broken code would
     * be posted to a third party, and they would wait for a network round trip
     * to be told about a missing semicolon.
     */
    process.env.CODE_RUNNER = 'auto';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const res = await runCode({
        language: 'c',
        code: 'int main(void){ oops }',
        allowRemote: true,
      });
      expect(res.compileFailed).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      delete process.env.CODE_RUNNER;
      vi.restoreAllMocks();
    }
  });

  it.skipIf(!hasCompiler)('kills a program that never finishes', async () => {
    // A beginner's infinite loop must not hold a server thread open. This is
    // also the case that would exhaust a marking run across 24 questions.
    const res = await runCode({ language: 'c', code: 'int main(void){ for(;;); }' });

    expect(res.timedOut).toBe(true);
    expect(res.exitCode).toBe(124);
    expect(res.output).toMatch(/timed out/i);
  }, 20_000);

  it.skipIf(!hasCompiler)('caps runaway output instead of buffering it forever', async () => {
    /**
     * `while(1) printf(...)` produces output as fast as the machine allows.
     * Uncapped, that is an out-of-memory on the server rather than a failed
     * answer for the pupil.
     */
    const res = await runCode({
      language: 'c',
      code: '#include <stdio.h>\nint main(void){ for(;;) printf("spam spam spam\\n"); }',
    });

    expect(res.stdout.length).toBeLessThan(200_000);
    expect(res.timedOut).toBe(true);
  }, 20_000);

  it.skipIf(!hasCompiler)('reports a non-zero exit without calling it a compile failure', async () => {
    // A program that builds and then fails at runtime is a different lesson
    // from one that does not build, and the marker treats them differently.
    const res = await runCode({
      language: 'c',
      code: '#include <stdio.h>\nint main(void){ printf("started\\n"); return 3; }',
    });

    expect(res.compileFailed).toBeFalsy();
    expect(res.exitCode).toBe(3);
    expect(res.stdout.trim()).toBe('started');
  });

  it.skipIf(!hasCompiler)('pins the C dialect, so an answer is not host-dependent', async () => {
    /**
     * Compiled with -std=c11 rather than the host compiler's default. Without
     * pinning, a pupil's answer could be accepted on the server and rejected
     * on their teacher's machine — or the reverse — for reasons neither of
     * them can see.
     *
     * `__STDC_VERSION__` is 201112L for C11.
     */
    const res = await runCode({
      language: 'c',
      code: '#include <stdio.h>\nint main(void){ printf("%ld\\n", __STDC_VERSION__); return 0; }',
    });

    expect(res.stdout.trim()).toBe('201112');
  });

  it.skipIf(!hasCompiler)('links the maths library, so a normal beginner program builds', async () => {
    // `sqrt` needs -lm on Linux. Without it the course's first maths exercise
    // fails to link, which reads to a child as "my correct code is wrong".
    const res = await runCode({
      language: 'c',
      code: '#include <stdio.h>\n#include <math.h>\nint main(void){ printf("%.0f\\n", sqrt(81.0)); return 0; }',
    });

    expect(res.stdout.trim()).toBe('9');
  });
});
