import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  api,
  BASE,
  auth,
  login,
  makeOrg,
  makeUser,
  resetDb,
  connectTestDb,
  disconnectTestDb,
  seedMinimalContent,
  correctAnswersFor,
} from './harness.js';
import { GAME_DIFFICULTY_AWARDS, PERFECT_BONUS } from '../../src/utils/economy.js';
import { difficultyFor } from '../../src/config/gameCatalog.js';

/**
 * REWARD INTEGRITY.
 *
 * `POST /games/complete` used to trust the client for gameKey, levelId AND
 * difficulty with no allowlist, so a student could invent a game and mint
 * 1,575 XP and 525 coins in about two seconds — enough to top the leaderboard
 * and clear the shop. Difficulty also set the payout tier, so the browser was
 * choosing its own reward.
 */
describe('reward integrity', () => {
  let studentToken;
  let content;

  const me = async () => {
    const res = await api().get(`${BASE}/auth/me`).set(auth(studentToken));
    return res.body.data.user;
  };

  const complete = (body) =>
    api().post(`${BASE}/games/complete`).set(auth(studentToken)).send(body);

  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    await resetDb();
    content = await seedMinimalContent();
    const { org } = await makeOrg('Reward School');
    await makeUser({
      role: 'student',
      name: 'Test Player',
      username: 'player',
      org: org._id,
    });
    studentToken = (await login('player')).accessToken;
  });

  describe('the catalogue is the authority', () => {
    it('rejects a game that does not exist', async () => {
      const res = await complete({
        gameKey: 'totally-fake-game',
        levelId: '1',
        difficulty: 'hard',
        stars: 3,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown game/i);

      const user = await me();
      expect(user.xp).toBe(0);
      expect(user.coins).toBe(0);
    });

    it('rejects a level that does not exist for a real game', async () => {
      const res = await complete({
        gameKey: 'maze-coding',
        levelId: '9999',
        difficulty: 'hard',
        stars: 3,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown level/i);
    });

    it('cannot be farmed by claiming many fabricated levels', async () => {
      for (let i = 1; i <= 20; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await complete({
          gameKey: 'invented-game',
          levelId: String(i),
          difficulty: 'hard',
          stars: 3,
        });
        expect(res.status).toBe(400);
      }
      const user = await me();
      expect(user.xp).toBe(0);
      expect(user.level).toBe(1);
    });

    it('pays the difficulty from the CATALOGUE, ignoring the client\'s claim', async () => {
      // maze-coding level 1 is an easy level.
      const realDifficulty = difficultyFor('maze-coding', '1');
      expect(realDifficulty).toBe('easy');

      const res = await complete({
        gameKey: 'maze-coding',
        levelId: '1',
        difficulty: 'hard', // the lie
        stars: 3,
        // Reported so this case still exercises the perfect bonus; the star
        // claim itself is ignored (covered separately below).
        performance: { optimalPath: true, cleanCode: true },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.difficulty).toBe('easy');

      const expected = {
        xp: GAME_DIFFICULTY_AWARDS.easy.xp + PERFECT_BONUS.xp,
        coins: GAME_DIFFICULTY_AWARDS.easy.coins + PERFECT_BONUS.coins,
      };
      expect(res.body.data.awarded).toEqual(expected);

      // Crucially NOT the hard-tier payout the client asked for.
      expect(res.body.data.awarded.xp).toBeLessThan(
        GAME_DIFFICULTY_AWARDS.hard.xp + PERFECT_BONUS.xp
      );
    });

    it('will not pay the perfect bonus for a CLAIMED 3 stars', async () => {
      // The other half of the same problem. Difficulty set the base payout;
      // `stars` set the bonus. A body that simply says "3 stars" must not
      // reach it — the run has to report counters the server can grade.
      const res = await complete({
        gameKey: 'sudoku',
        levelId: '1',
        stars: 3, // the lie
        timeMs: 90_000,
        performance: { hintsUsed: 2, mistakes: 7 }, // a scrappy run
      });

      expect(res.status).toBe(200);
      expect(res.body.data.bestStars).toBe(1);
      expect(res.body.data.awarded).toEqual(GAME_DIFFICULTY_AWARDS.easy);
      expect(res.body.data.awarded.xp).toBe(GAME_DIFFICULTY_AWARDS.easy.xp);
    });

    it('rejects a run claiming more hints than the level grants', async () => {
      const res = await complete({
        gameKey: 'sudoku',
        levelId: '2',
        timeMs: 90_000,
        performance: { hintsUsed: 50, mistakes: 0 },
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/hints/i);
    });

    it('still completes a level for a client that reports nothing', async () => {
      // Shipping the grader must not strand a player on an older bundle: the
      // level completes and pays its base award, just without the bonus.
      const res = await complete({
        gameKey: 'zip',
        levelId: '1',
        stars: 3,
        timeMs: 45_000,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.bestStars).toBe(2);
      expect(res.body.data.awarded).toEqual(GAME_DIFFICULTY_AWARDS.easy);
    });
  });

  describe('leaderboard metrics must be plausible', () => {
    it('rejects a sub-second completion time', async () => {
      const res = await complete({
        gameKey: 'maze-coding',
        levelId: '1',
        stars: 3,
        moves: 1,
        timeMs: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/implausible completion time/i);
    });

    it('rejects a zero move count', async () => {
      const res = await complete({
        gameKey: 'maze-coding',
        levelId: '2',
        stars: 3,
        moves: 0,
        timeMs: 30_000,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/implausible move count/i);
    });

    it('accepts a realistic run', async () => {
      const res = await complete({
        gameKey: 'maze-coding',
        levelId: '3',
        stars: 3,
        moves: 14,
        timeMs: 42_000,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.best).toMatchObject({ moves: 14, timeMs: 42_000 });
    });

    it('rejects out-of-range stars at the schema', async () => {
      for (const stars of [99, -5]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await complete({ gameKey: 'maze-coding', levelId: '4', stars });
        expect(res.status).toBe(400);
      }
    });
  });

  describe('replays do not pay twice', () => {
    it('awards a level only on first completion', async () => {
      const first = await complete({ gameKey: 'maze-coding', levelId: '5', stars: 3 });
      expect(first.body.data.awarded.xp).toBeGreaterThan(0);

      for (let i = 0; i < 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const again = await complete({ gameKey: 'maze-coding', levelId: '5', stars: 3 });
        expect(again.body.data.awarded).toEqual({ xp: 0, coins: 0 });
        expect(again.body.data.alreadyCompleted).toBe(true);
      }

      const user = await me();
      expect(user.gameLevelsCompleted).toBe(1);
    });
  });

  describe('leaderboards do not leak identifiers', () => {
    it('reduces names and omits raw user ids', async () => {
      await complete({ gameKey: 'maze-coding', levelId: '1', stars: 3, moves: 10, timeMs: 20_000 });

      const res = await api()
        .get(`${BASE}/games/maze-coding/levels/1/leaderboard`)
        .set(auth(studentToken));

      expect(res.status).toBe(200);
      const [entry] = res.body.data.entries;
      // "Test Player" -> "Test P."
      expect(entry.name).toBe('Test P.');
      expect(entry.userId).toBeUndefined();
      expect(entry.isMe).toBe(true);
    });

    it('defaults the XP board to the caller\'s own school', async () => {
      const res = await api().get(`${BASE}/leaderboards`).set(auth(studentToken));
      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe('school');
      for (const e of res.body.data.entries) {
        expect(e.userId).toBeUndefined();
      }
    });
  });

  describe('quiz credit survives a retry', () => {
    it('pays on the first PASS, not the first attempt, and never twice', async () => {
      const quizId = content.quiz._id;
      const submit = (answers) =>
        api()
          .post(`${BASE}/quizzes/${quizId}/submit`)
          .set(auth(studentToken))
          .send({ answers });

      // Attempt 1: fail. Earns nothing, but is recorded.
      const a1 = await submit({});
      expect(a1.body.data.passed).toBe(false);
      expect(a1.body.data.xpEarned).toBe(0);
      expect(a1.body.data.attemptNumber).toBe(1);
      // Feedback withheld early so the answer key can't be brute-forced.
      expect(a1.body.data.feedbackRevealed).toBe(false);

      // Attempt 2: pass. This is the one that pays.
      const a2 = await submit(correctAnswersFor(content.quiz));
      expect(a2.body.data.passed).toBe(true);
      expect(a2.body.data.xpEarned).toBeGreaterThan(0);
      expect(a2.body.data.attemptNumber).toBe(2);

      // Attempt 3: pass again. Pays nothing.
      const a3 = await submit(correctAnswersFor(content.quiz));
      expect(a3.body.data.passed).toBe(true);
      expect(a3.body.data.xpEarned).toBe(0);
      expect(a3.body.data.alreadyAwarded).toBe(true);

      const user = await me();
      expect(user.quizzesPassed).toBe(1);

      // The full history is retained for the teacher — previously only the
      // first (failing) attempt was ever stored.
      const hist = await api()
        .get(`${BASE}/quizzes/${quizId}/attempts`)
        .set(auth(studentToken));
      expect(hist.body.data.attempts).toHaveLength(3);
      expect(hist.body.data.attempts.map((a) => a.passed)).toEqual([false, true, true]);
      expect(hist.body.data.attempts.filter((a) => a.awarded)).toHaveLength(1);
    });

    it('never exposes correct answers to a student', async () => {
      const res = await api()
        .get(`${BASE}/quizzes/${content.quiz._id}`)
        .set(auth(studentToken));
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/correctAnswer/);
      expect(body).not.toMatch(/"answer"/);
      expect(body).not.toMatch(/explanation/);
    });
  });

  describe('shop economy', () => {
    it('enforces the level gate and the coin balance', async () => {
      const cheap = await api()
        .post(`${BASE}/shop/purchase`)
        .set(auth(studentToken))
        .send({ itemKey: content.item.key });
      // 50 coins required, student has 0.
      expect(cheap.status).toBe(400);

      const missing = await api()
        .post(`${BASE}/shop/purchase`)
        .set(auth(studentToken))
        .send({ itemKey: '__does_not_exist__' });
      expect(missing.status).toBe(404);
    });
  });
});
