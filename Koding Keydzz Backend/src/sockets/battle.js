import { randomUUID } from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { computeLevel } from '../utils/xp.js';
import { createNotification } from '../services/notificationService.js';

// In-memory matchmaking state.
const waiting = []; // [{ userId, socketId }]
const rooms = new Map(); // roomId -> { players:[{userId,socketId,score,finished}], question, startedAt, ended }

const WIN_XP = 100;
const WIN_COINS = 25;

// A tiny pool of coding prompts. Each has an expected normalized output.
const QUESTIONS = [
  {
    prompt: 'Print the sum of 2 and 3.',
    language: 'python',
    expectedOutput: '5',
  },
  {
    prompt: 'Print "hello" in lowercase.',
    language: 'python',
    expectedOutput: 'hello',
  },
  {
    prompt: 'Print the result of 10 multiplied by 10.',
    language: 'python',
    expectedOutput: '100',
  },
];

function pickQuestion() {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

function publicQuestion(q) {
  // Never leak the expected answer to clients.
  return { prompt: q.prompt, language: q.language };
}

/** Award XP/coins to the winning user and notify them. */
async function awardWinner(userId) {
  if (!userId) return;
  const user = await userRepository.findById(userId);
  if (!user) return;
  const previousLevel = user.level;
  user.xp += WIN_XP;
  user.coins += WIN_COINS;
  user.level = computeLevel(user.xp);
  await user.save();
  await createNotification(user._id, {
    type: 'battle',
    title: 'Battle Won!',
    body: `You won a battle and earned ${WIN_XP} XP and ${WIN_COINS} coins.`,
    meta: { xp: WIN_XP, coins: WIN_COINS, level: user.level, leveledUp: user.level > previousLevel },
  });
}

async function endBattle(io, roomId, { winnerUserId = null, reason = 'completed' } = {}) {
  const room = rooms.get(roomId);
  if (!room || room.ended) return;
  room.ended = true;

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
    if (s) s.leave(roomId);
  }
  rooms.delete(roomId);
}

function removeFromQueue(socketId) {
  const idx = waiting.findIndex((w) => w.socketId === socketId);
  if (idx !== -1) waiting.splice(idx, 1);
}

/** Try to pair two waiting players into a battle room. */
function tryMatch(io) {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();

    const sa = io.sockets.sockets.get(a.socketId);
    const sb = io.sockets.sockets.get(b.socketId);
    // Skip stale entries (disconnected before match).
    if (!sa) {
      if (b) waiting.unshift(b);
      continue;
    }
    if (!sb) {
      if (a) waiting.unshift(a);
      continue;
    }

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
    };
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
    // Avoid duplicate queue entries.
    removeFromQueue(socket.id);
    waiting.push({ userId: socket.userId, socketId: socket.id });
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
    endBattle(io, roomId, {
      winnerUserId: opponent ? opponent.userId : null,
      reason: 'forfeit',
    });
  });
}

export default { registerBattleHandlers };
