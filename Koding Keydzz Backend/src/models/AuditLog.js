import mongoose from 'mongoose';

/**
 * Append-only record of privileged actions.
 *
 * WHY: nothing recorded who changed curriculum, reset a password, suspended an
 * account or sent an announcement. With a shared, global content set that meant
 * a question like "which school's admin deleted our quiz?" was simply
 * unanswerable — and after an accidental deletion there was no way to attribute
 * or explain it to the affected school.
 *
 * Never updated or deleted by application code. `expires` prunes rows after a
 * retention window so the collection cannot grow without bound.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who did it.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    // Which tenant they were acting in (null for superadmin/platform actions).
    org: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },

    // What they did, e.g. 'student.delete', 'world.update', 'org.suspend'.
    action: { type: String, required: true, index: true },

    // What it was done to.
    targetType: { type: String, default: '' },
    targetId: { type: String, default: '' },
    targetLabel: { type: String, default: '' },

    // Small, non-sensitive context (counts, status transitions, field names).
    // NEVER put passwords, tokens or full student records here.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Newest-first queries per tenant, and per target ("what happened to this?").
auditLogSchema.index({ org: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Retain for two years, then expire automatically.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
