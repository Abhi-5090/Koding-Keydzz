import mongoose from 'mongoose';

/**
 * A player's best recorded result for a single (game, level). One document per
 * (user, gameKey, levelId); the best result is kept in place (fewer moves,
 * tie-broken by lower time). `moves`/`timeMs` are null until a run reports them.
 */
const gameScoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Tenant scope, copied from the user at record time (null for superadmin).
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    gameKey: { type: String, required: true },
    levelId: { type: String, required: true },
    moves: { type: Number, default: null, min: 0 },
    timeMs: { type: Number, default: null, min: 0 },
    stars: { type: Number, default: 0, min: 0, max: 3 },
  },
  { timestamps: true }
);

// One best record per player per level.
gameScoreSchema.index({ user: 1, gameKey: 1, levelId: 1 }, { unique: true });
// Per-level leaderboard: moves asc, timeMs asc within a (game, level).
gameScoreSchema.index({ gameKey: 1, levelId: 1, moves: 1, timeMs: 1 });
// Per-game per-user lookups (best-keeping upserts, org filters).
gameScoreSchema.index({ gameKey: 1, user: 1 });

export const GameScore = mongoose.model('GameScore', gameScoreSchema);
export default GameScore;
