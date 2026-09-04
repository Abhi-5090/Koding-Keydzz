import { AuditLog } from '../models/AuditLog.js';

/**
 * Record a privileged action.
 *
 * NON-THROWING by design: an audit write must never fail the operation it is
 * describing (and these are frequently called after the action has already
 * committed). Failures are logged loudly instead.
 */
export async function recordAudit(
  req,
  { action, targetType = '', targetId = '', targetLabel = '', meta = {} } = {}
) {
  try {
    if (!action) return null;
    return await AuditLog.create({
      actor: req?.user?._id ?? null,
      actorEmail: req?.user?.email || req?.user?.username || '',
      actorRole: req?.user?.role || '',
      org: req?.user?.org ?? null,
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      targetLabel,
      meta,
      ip: req?.ip || '',
    });
  } catch (err) {
    console.error(
      '[audit] write failed',
      JSON.stringify({ action, message: err?.message || String(err) })
    );
    return null;
  }
}

/**
 * Read the audit trail. `org` scopes it to one tenant (an org admin may only
 * see their own school's history); pass null as superadmin for everything.
 */
export async function listAudit({ org = null, action = null, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (org) filter.org = org;
  if (action) filter.action = action;

  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((a) => ({
      id: String(a._id),
      action: a.action,
      actor: a.actorEmail || String(a.actor || ''),
      actorRole: a.actorRole,
      target: a.targetLabel || `${a.targetType}:${a.targetId}`,
      meta: a.meta,
      at: a.createdAt,
    })),
    total,
    page: Math.max(1, page),
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

export default { recordAudit, listAudit };
