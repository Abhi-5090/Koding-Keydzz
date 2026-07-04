import mongoose from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { GameScore } from '../models/GameScore.js';

function toObjectId(value) {
  if (value == null) return value;
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

class GameScoreRepository extends BaseRepository {
  constructor() {
    super(GameScore);
  }

  /** The player's stored best for a single (game, level), or null. */
  findByUserGameLevel(user, gameKey, levelId) {
    return this.model.findOne({
      user,
      gameKey,
      levelId: String(levelId),
    });
  }

  /**
   * All student scores for a game, joined with the owning user's name/avatar.
   * `scope.org` (optional) restricts to a single organization; otherwise all
   * students across every org are returned. Returns lean rows:
   * `{ user, levelId, moves, timeMs, stars, name, avatar }`.
   */
  scoresForGameWithUser(gameKey, { org = null } = {}) {
    const match = { gameKey };
    if (org) match.org = toObjectId(org);
    return this._joinUsers(match);
  }

  /** As above, restricted to a single level within the game. */
  scoresForLevelWithUser(gameKey, levelId, { org = null } = {}) {
    const match = { gameKey, levelId: String(levelId) };
    if (org) match.org = toObjectId(org);
    return this._joinUsers(match);
  }

  _joinUsers(match) {
    return this.model.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'u',
        },
      },
      { $unwind: '$u' },
      { $match: { 'u.role': 'student', 'u.status': 'active' } },
      {
        $project: {
          _id: 0,
          user: '$user',
          levelId: 1,
          moves: 1,
          timeMs: 1,
          stars: 1,
          name: '$u.name',
          avatar: '$u.avatar',
        },
      },
    ]);
  }

  /**
   * 1-based rank of a (moves, timeMs) result on a level: the number of stored
   * scores strictly better (fewer moves, or equal moves + lower time) plus one.
   * Global across all recorded scores for the level. Returns null when the
   * player has no moves recorded.
   */
  async levelRankForResult(gameKey, levelId, moves, timeMs) {
    if (moves == null) return null;
    const betterOnMoves = { moves: { $lt: moves } };
    const betterOnTime =
      timeMs == null
        ? // No time of our own -> anyone with equal moves AND a recorded time beats us.
          { moves, timeMs: { $ne: null } }
        : { moves, timeMs: { $lt: timeMs } };

    const betterCount = await this.model.countDocuments({
      gameKey,
      levelId: String(levelId),
      moves: { $ne: null },
      $or: [betterOnMoves, betterOnTime],
    });
    return betterCount + 1;
  }
}

export const gameScoreRepository = new GameScoreRepository();
export default gameScoreRepository;
