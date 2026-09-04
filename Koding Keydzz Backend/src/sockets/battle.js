import { randomUUID } from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { computeLevel } from '../utils/xp.js';
import { createNotification } from '../services/notificationService.js';
import { checkAndUnlockAchievements } from '../services/achievementService.js';
import { BATTLE_AWARD } from '../utils/economy.js';

/**
 * Real-time coding battles.
 *
 * SCALING NOTE: matchmaking state lives in this process's memory, so it does
 * NOT survive a restart and does NOT work across more than one backend
 * instance. Before scaling horizontally, add the Socket.IO Redis adapter
 * (@socket.io/redis-adapter) and move `waiting`/`rooms` into Redis. Until then
 * run a single API instance, or battles will silently fail to match.
 */

// In-memory matchmaking state.
const waiting = []; // [{ userId, socketId, org }]
const rooms = new Map(); // roomId -> { players, question, startedAt, ended, timer }

const WIN_XP = BATTLE_AWARD.xp;
const WIN_COINS = BATTLE_AWARD.coins;

/**
 * A battle is abandoned if nobody finishes within this window. Without it,
 * rooms for abandoned battles stayed in the Map forever — an unbounded memory
 * leak in a long-running process.
 */
const BATTLE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Question pool. The prompt is shown to the player and the expected output is
 * compared server-side, so the answer never leaves the server.
 *
 * These are deliberately more numerous and less guessable than the original
 * three (whose answers were "5", "hello" and "100" — trivially brute-forced,
 * and the prompt stated the answer in plain English).
 */
const QUESTIONS = [
  { prompt: 'Print the sum of 47 and 68.', language: 'python', expectedOutput: '115' },
  { prompt: 'Print the number of characters in the word "elephant".', language: 'python', expectedOutput: '8' },
  { prompt: 'Print 7 multiplied by 13.', language: 'python', expectedOutput: '91' },
  { prompt: 'Print the remainder when 100 is divided by 7.', language: 'python', expectedOutput: '2' },
  { prompt: 'Print the word "banana" reversed.', language: 'python', expectedOutput: 'ananab' },
  { prompt: 'Print the largest number in this list: [12, 45, 7, 23].', language: 'python', expectedOutput: '45' },
  { prompt: 'Print the sum of all numbers from 1 to 10.', language: 'python', expectedOutput: '55' },
  { prompt: 'Print "koding keydzz" in uppercase.', language: 'python', expectedOutput: 'KODING KEYDZZ' },
  { prompt: 'Print how many times the letter "s" appears in "mississippi".', language: 'python', expectedOutput: '4' },
  { prompt: 'Print 2 raised to the power of 10.', language: 'python', expectedOutput: '1024' },
  { prompt: 'Print the integer result of 47 divided by 5 (whole number only).', language: 'python', expectedOutput: '9' },
  { prompt: 'Print the third character of the word "computer" (counting from 1).', language: 'python', expectedOutput: 'm' },
];

function pickQuestion() {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

function publicQuestion(q) {
  // Never leak the expected answer to clients.
  return { prompt: q.prompt, language: q.language };
}

/**
 * Award XP/coins to the winning user.
 *
 * Routed through the same fields as every other award so the economy stays
 * consistent: `totalCoinsEarned` is a lifetime counter that drives
 * coin-based achievements, and skipping it here made those achievements
 * silently disagree with the player's wallet.
 */
async function awardWinner(userId) {
  if (!userId) return;
  try {
    const user = await userRepository.findById(userId);
    if (!user) return;
    const previousLevel = user.level;
    user.xp += WIN_XP;
    user.coins += WIN_COINS;
    user.totalCoinsEarned += WIN_COINS;
    user.level = computeLevel(user.xp);
    await user.save();

    await createNotification(user._id, {
      type: 'battle',
      title: 'Battle Won!',
      body: `You won a battle and earned ${WIN_XP} XP and ${WIN_COINS} coins.`,
      meta: {
        xp: WIN_XP,
        coins: WIN_COINS,
        level: user.level,
        leveledUp: user.level > previousLevel,
      },
    });

    if (user.level > previousLevel) {
      await createNotification(user._id, {
        type: 'levelup',
        title: 'Level Up!',
        body: `Congratulations! You reached level ${user.level}.`,
        meta: { level: user.level },
      });
    }

    await checkAndUnlockAchievements(user);
  } catch (err) {
    // A reward failure must never propagate: this runs from socket handlers,
    // where an unhandled rejection used to terminate the whole process.
    console.error('[battle] awardWinner failed:', err?.message || err);
  }
}

async function endBattle(io, roomId, { winnerUserId = null, reason = 'completed' } = {}) {
  const room = rooms.get(roomId);
  if (!room || room.ended) return;
  room.ended = true;
  if (room.timer) clearTimeout(room.timer);

  if (winnerUserId) {
    await awardWinner(winnerUserId);
  }

  io.to(roomId).emit('battle_end', {
    roomId,
    reason,
    winnerUserId,
    scores: room.players.map((p) => ({ userId: p.userId, score: p.score })),
    rewards: winnerUserId ? { xp: WIN_XP, coins: WIN_COINS } : null,
  });

  // Clean up sockets from the room.
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) {
      s.leave(roomId);
      s.battleRoomId = null;
    }
  }
  rooms.delete(roomId);
}

function removeFromQueue(socketId) {
  const idx = waiting.findIndex((w) => w.socketId === socketId);
  if (idx !== -1) waiting.splice(idx, 1);
}

/**
 * Pair two waiting players.
 *
 * Players are matched only against a DIFFERENT user in the SAME organization:
 *
 *  • Different user — one student could previously open two tabs, be matched
 *    against themselves (identical userId on both sides), then close one tab
 *    so the "opponent" won by forfeit. That was an unbounded XP/coin loop.
 *  • Same organization — a battle reveals the opponent to a child, so it
 *    should stay inside their own school.
 */
function tryMatch(io) {
  for (let i = 0; i < waiting.length; i += 1) {
    const a = waiting[i];
    const sa = io.sockets.sockets.get(a.socketId);
    if (!sa) {
      waiting.splice(i, 1);
      i -= 1;
      continue;
    }

    // Find the first eligible opponent further down the queue.
    const j = waiting.findIndex(
      (b, idx) =>
        idx > i &&
        String(b.userId) !== String(a.userId) &&
        String(b.org || '') === String(a.org || '') &&
        io.sockets.sockets.get(b.socketId)
    );
    if (j === -1) continue;

    const b = waiting[j];
    const sb = io.sockets.sockets.get(b.socketId);

    // Remove both from the queue (higher index first so `i` stays valid).
    waiting.splice(j, 1);
    waiting.splice(i, 1);
    i -= 1;

    const roomId = `battle:${randomUUID()}`;
    const question = pickQuestion();
    const room = {
      players: [
        { userId: a.userId, socketId: a.socketId, score: 0, finished: false },
        { userId: b.userId, socketId: b.socketId, score: 0, finished: false },
      ],
      question,
      startedAt: Date.now(),
      ended: false,
      timer: null,
    };

    // Reap abandoned battles so `rooms` cannot grow without bound.
    room.timer = setTimeout(() => {
      endBattle(io, roomId, { winnerUserId: null, reason: 'timeout' }).catch(() => {});
    }, BATTLE_TIMEOUT_MS);
    if (room.timer.unref) room.timer.unref();

    rooms.set(roomId, room);

    sa.join(roomId);
    sb.join(roomId);
    sa.battleRoomId = roomId;
    sb.battleRoomId = roomId;

    io.to(roomId).emit('battle_start', {
      roomId,
      players: room.players.map((p) => ({ userId: p.userId })),
      question: publicQuestion(question),
    });
  }
}

export function registerBattleHandlers(io, socket) {
  socket.on('join_queue', () => {
    if (!socket.userId) {
      socket.emit('battle_error', { message: 'Authentication required to battle' });
      return;
    }
    // One queue entry per socket, and never two sockets for the same user —
    // otherwise a single player could still fill both sides of the queue.
    removeFromQueue(socket.id);
    const alreadyQueued = waiting.some(
      (w) => String(w.userId) === String(socket.userId)
    );
    if (alreadyQueued) {
      socket.emit('battle_error', {
        message: 'You are already waiting for a battle in another tab.',
      });
      return;
    }
    if (socket.battleRoomId && rooms.has(socket.battleRoomId)) {
      socket.emit('battle_error', { message: 'You are already in a battle.' });
      return;
    }

    waiting.push({
      userId: socket.userId,
      socketId: socket.id,
      org: socket.userOrg || null,
    });
    socket.emit('queued', { position: waiting.length });
    tryMatch(io);
  });

  socket.on('leave_queue', () => {
    removeFromQueue(socket.id);
    socket.emit('left_queue', {});
  });

  socket.on('submit_answer', async (payload = {}) => {
    const roomId = socket.battleRoomId || payload.roomId;
    const room = rooms.get(roomId);
    if (!room || room.ended) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || player.finished) return;

    const answer = String(payload.output ?? payload.answer ?? '').trim().toLowerCase();
    const expected = String(room.question.expectedOutput).trim().toLowerCase();
    const correct = answer === expected;

    player.finished = true;
    player.score = correct ? 100 : 0;

    socket.emit('answer_result', { correct, score: player.score });

    if (correct) {
      // First correct answer wins immediately.
      await endBattle(io, roomId, { winnerUserId: player.userId, reason: 'first_correct' });
      return;
    }

    // If both players are done and neither/both correct, pick higher score.
    if (room.players.every((p) => p.finished)) {
      const [p1, p2] = room.players;
      let winnerUserId = null;
      if (p1.score !== p2.score) {
        winnerUserId = p1.score > p2.score ? p1.userId : p2.userId;
      }
      await endBattle(io, roomId, {
        winnerUserId,
        reason: winnerUserId ? 'higher_score' : 'draw',
      });
    }
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    // Forfeit any active battle: the remaining player wins.
    const roomId = socket.battleRoomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.ended) return;
    const opponent = room.players.find((p) => p.socketId !== socket.id);
    // endBattle is async and this handler is sync — attach a catch so a reward
    // failure can never become an unhandled rejection.
    endBattle(io, roomId, {
      winnerUserId: opponent ? opponent.userId : null,
      reason: 'forfeit',
    }).catch((err) => console.error('[battle] endBattle failed:', err?.message || err));
  });
}

/** Test/diagnostic helper: current queue + room sizes. */
export function battleState() {
  return { queued: waiting.length, rooms: rooms.size };
}

export default { registerBattleHandlers, battleState };
