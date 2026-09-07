import { describe, it, expect } from 'vitest';
import {
  COURSES,
  LANGUAGES,
  FINAL_TEST_PASS_MARK,
  FINAL_TEST_TOTAL,
  FINAL_TEST_MAX_ATTEMPTS,
  courseBySlug,
  isKnownLanguage,
  firstCourse,
  prerequisiteOf,
  nextAfter,
} from '../src/config/courses.js';
import { courseGameLevels } from '../src/services/courseService.js';
import { GAME_CATALOG } from '../src/config/gameCatalog.js';

/**
 * THE LADDER CONFIG.
 *
 * `order` is not decoration — the unlock chain walks it directly, so a gap or
 * a duplicate either strands every course after it or opens several at once.
 * These are the cheap structural checks that catch that before it reaches a
 * pupil.
 */

describe('the ladder is well formed', () => {
  it('is Cognitive Games → Python → C → HTML → AI', () => {
    /**
     * The games realm leads. It holds no worlds and no final test — its
     * content is four mini-games and it is passed by playing them — so it is
     * the one rung that is not a language, and it comes first because
     * reasoning comes before syntax.
     */
    expect(COURSES.map((c) => c.slug)).toEqual([
      'cognitive-games',
      'python',
      'c',
      'html',
      'ai',
    ]);
  });

  it('has contiguous 1-based order with no gaps or duplicates', () => {
    // A gap strands every course after it: the chain asks for order N-1 and
    // finds nothing, so the course never unlocks for anyone.
    const orders = COURSES.map((c) => c.order);
    // 1-based and contiguous. Adding the games realm at 1 is exactly why the
    // language courses shifted rather than it being inserted at 0.
    expect(orders).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('has a unique slug per course', () => {
    const slugs = COURSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('declares one language per course, and they match LANGUAGES', () => {
    // The compiler, the validators and the lesson snippets all read LANGUAGES.
    // A course whose language is missing from it could never be run.
    expect(COURSES.map((c) => c.language)).toEqual(LANGUAGES);
    for (const c of COURSES) expect(isKnownLanguage(c.language), c.slug).toBe(true);
  });

  it('does not know JavaScript any more', () => {
    // Removed with the move to a ladder: it belonged to no course, so it sat
    // in the playground picker with no lessons, quizzes or games behind it.
    expect(isKnownLanguage('javascript')).toBe(false);
    expect(LANGUAGES).not.toContain('javascript');
  });

  it('gives every course a tint and an icon, so the UI never has to invent one', () => {
    for (const c of COURSES) {
      expect(c.tint, c.slug).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.icon, c.slug).toBeTruthy();
      expect(c.title, c.slug).toBeTruthy();
    }
  });

  it('marks each course as code- or build-graded', () => {
    // Decides how the final test is built: coding questions against test
    // cases, or tasks against a stored expected outcome.
    expect(courseBySlug('python').kind).toBe('code');
    expect(courseBySlug('c').kind).toBe('code');
    expect(courseBySlug('html').kind).toBe('build');
    expect(courseBySlug('ai').kind).toBe('build');
  });
});

describe('the unlock chain', () => {
  it('opens the first course to everyone', () => {
    expect(prerequisiteOf('cognitive-games')).toBeNull();
    expect(firstCourse().slug).toBe('cognitive-games');
  });

  it('gates each later course on the one before it', () => {
    expect(prerequisiteOf('python').slug).toBe('cognitive-games');
    expect(prerequisiteOf('c').slug).toBe('python');
    expect(prerequisiteOf('html').slug).toBe('c');
    expect(prerequisiteOf('ai').slug).toBe('html');
  });

  it('walks forwards too, and ends', () => {
    expect(nextAfter('cognitive-games').slug).toBe('python');
    expect(nextAfter('python').slug).toBe('c');
    expect(nextAfter('html').slug).toBe('ai');
    expect(nextAfter('ai'), 'AI is the last course').toBeNull();
  });

  it('every course except the first is reachable from the first', () => {
    // Proves the chain is a single path rather than two disconnected runs.
    const seen = ['cognitive-games'];
    let cursor = 'cognitive-games';
    while (nextAfter(cursor)) {
      cursor = nextAfter(cursor).slug;
      seen.push(cursor);
    }
    expect(seen).toEqual(COURSES.map((c) => c.slug));
  });

  it('is case-insensitive on lookup, and safe on nonsense', () => {
    expect(courseBySlug('PYTHON').slug).toBe('python');
    expect(courseBySlug('rust')).toBeUndefined();
    expect(prerequisiteOf('rust')).toBeNull();
    expect(nextAfter(undefined)).toBeNull();
  });
});

describe('the final test contract', () => {
  it('is 150 of 200 — three quarters', () => {
    expect(FINAL_TEST_TOTAL).toBe(200);
    expect(FINAL_TEST_PASS_MARK).toBe(150);
    expect(FINAL_TEST_PASS_MARK / FINAL_TEST_TOTAL).toBe(0.75);
  });

  it('allows three attempts', () => {
    expect(FINAL_TEST_MAX_ATTEMPTS).toBe(3);
  });

  it('has a pass mark below the total, or nobody could ever pass', () => {
    expect(FINAL_TEST_PASS_MARK).toBeLessThan(FINAL_TEST_TOTAL);
    expect(FINAL_TEST_PASS_MARK).toBeGreaterThan(0);
  });
});

describe('games are scoped to a course', () => {
  /**
   * This is the check that makes the ladder mean something for games. Before
   * the catalogue carried a `course`, every course would have demanded all 231
   * levels — so a C pupil would have had to finish Python's maze levels to
   * sit the C final test.
   */
  const UNIVERSAL = ['sudoku', 'tic-tac-toe', 'towers-of-hanoi', 'zip', 'patches', 'n-queens'];
  const PYTHON_ONLY = [
    'maze-coding',
    'robot-navigation',
    'bug-fix',
    'battle-arena',
    'treasure-hunt',
    'logic-puzzle',
    'space-adventure',
  ];

  it('gives Python its own games plus the universal ones', () => {
    const { games } = courseGameLevels('python');
    for (const key of [...UNIVERSAL, ...PYTHON_ONLY]) {
      expect(Object.keys(games), key).toContain(key);
    }
  });

  it('gives C only the universal games — none of Python\'s', () => {
    // The whole point: no game is tagged `c` yet, so a C pupil gets the six
    // syntax-free logic games and nothing else. Python's coding levels must
    // not be a prerequisite for the C final test.
    const { games } = courseGameLevels('c');
    expect(Object.keys(games).sort()).toEqual([...UNIVERSAL].sort());
    for (const key of PYTHON_ONLY) {
      expect(Object.keys(games), `${key} leaked into C`).not.toContain(key);
    }
  });

  it('counts the universal GATING levels and the Python-specific ones', () => {
    /**
     * These are the levels that count towards a course's final-test gate,
     * which since the puzzle games became tiered is tier 0 only — see
     * config/gameTiers.js. The later tiers unlock as courses are passed and
     * pay full rewards, but they are not compulsory, or passing Python would
     * add ~240 required puzzles before the C test could be sat.
     *
     * 152 = sudoku 50 + patches 50 + zip 12 + tic-tac-toe 20 + hanoi 10 +
     * n-queens 10, all at tier 0.
     */
    /**
     * Asserted as a COMPOSITION rather than one magic total.
     *
     * A bare `toBe(153)` says nothing about which game moved when it breaks,
     * and it broke twice while the tiers were being built — once when sudoku
     * and patches grew their base tier, once when Hanoi's honest level space
     * turned out to be 48 rather than 10. Per-game counts make the next change
     * self-explanatory.
     */
    // What each language-neutral game actually CONTRIBUTES to a gate, which
    // is capped at GATE_CAP_PER_NEUTRAL_GAME (Hanoi has fewer at tier 0, so it
    // contributes all 11 it has).
    const { games } = courseGameLevels('c');
    const perGame = Object.fromEntries(
      Object.entries(games).map(([key, ids]) => [key, ids.length])
    );
    expect(perGame).toEqual({
      sudoku: 20,
      patches: 20,
      zip: 20,
      'n-queens': 20,
      'tic-tac-toe': 20,
      'towers-of-hanoi': 11,
    });

    const universal = courseGameLevels('c').total;
    const python = courseGameLevels('python').total;
    expect(universal).toBe(
      Object.values(perGame).reduce((a, b) => a + b, 0)
    );
    // The Python-only games are untiered, so this difference is unchanged.
    expect(python - universal).toBe(145);
  });

  it('leaves the later tiers OUT of the gate, and caps the base tier', () => {
    /**
     * The guarantee the numbers above depend on, and it has two halves.
     *
     * If tiered levels crept into the strand, every course completion would
     * silently raise the next course's wall. And if the base tier were counted
     * uncapped, simply AUTHORING more puzzles would raise it — which is what
     * happened when these games grew: Python's gate went 231 -> 376 before the
     * cap was introduced.
     */
    const gating = courseGameLevels('c').total;
    let everything = 0;
    for (const [, game] of Object.entries(GAME_CATALOG)) {
      if (game.course) continue;
      everything += Object.keys(game.levels || {}).length;
    }
    // 893 levels exist across the games; a fraction of them gate.
    expect(everything).toBeGreaterThan(gating * 4);

    // No single neutral game may dominate the gate.
    const { games } = courseGameLevels('c');
    for (const [key, ids] of Object.entries(games)) {
      expect(ids.length, `${key} contributes too much`).toBeLessThanOrEqual(20);
    }
  });

  it('the universal games really carry no course in the catalogue', () => {
    // "No course" is what makes a game universal, so an accidental tag would
    // silently remove it from three of the four courses.
    for (const key of UNIVERSAL) {
      expect(GAME_CATALOG[key]?.course, key).toBeUndefined();
    }
    for (const key of PYTHON_ONLY) {
      expect(GAME_CATALOG[key]?.course, key).toBe('python');
    }
  });

  it('every catalogue game is either universal or tagged to a real course', () => {
    const slugs = COURSES.map((c) => c.slug);
    for (const [key, game] of Object.entries(GAME_CATALOG)) {
      if (game.course === undefined) continue;
      expect(slugs, `${key} is tagged to a course that does not exist`).toContain(game.course);
    }
  });

  it('an unknown course slug gets the universal games rather than throwing', () => {
    // Degrades to "the syntax-free games" instead of failing a page load.
    const { total } = courseGameLevels('rust');
    expect(total).toBe(courseGameLevels('c').total);
  });
});
