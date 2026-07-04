import mongoose from 'mongoose';

// Optional persisted leaderboard snapshot. The live leaderboard is computed
// from the User collection (see leaderboardService), but this model can be
// used to cache periodic snapshots if desired.
const leaderboardEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['global', 'school', 'weekly'], default: 'global' },
    scope: { type: String, default: 'global' },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    rank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

leaderboardEntrySchema.index({ type: 1, rank: 1 });

export const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);
export default LeaderboardEntry;
