import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  Eye,
  Ban,
  CheckCircle2,
  KeyRound,
  Trash2,
} from 'lucide-react';
import AnimatedIcon from '../ui/AnimatedIcon';

export function OrgStatusBadge({ status }) {
  const map = {
    active: 'bg-success/15 text-success border-success/30',
    suspended: 'bg-error/15 text-error border-error/30',
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
        map[status] || map.active
      }`}
    >
      {status}
    </span>
  );
}

/**
 * A single organization rendered as a tappable card with a turmeric org icon,
 * name/code, admin email, a student-count stat, status badge and quick actions.
 *
 * Clicking the card body calls `onOpen`. Actions are optional — the admin's
 * single-org card passes only `onOpen`.
 */
export default function OrgCard({
  org,
  index = 0,
  onOpen,
  onSuspendToggle,
  onResetAdmin,
  onDelete,
}) {
  const isActive = org.status !== 'suspended';
  const studentCount = org.studentCount ?? org.studentsCount ?? org.students ?? 0;

  const action = (handler) => (e) => {
    e.stopPropagation();
    handler?.(org);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4 }}
      onClick={() => onOpen?.(org)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(org);
        }
      }}
      aria-label={`Open ${org.name}`}
      className="k-card group relative cursor-pointer overflow-hidden p-5 transition-[box-shadow,border-color] duration-200 ease-out hover:border-turmeric/60 hover:shadow-glow"
    >
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-turmeric/5 transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-125" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-turmeric/20 text-turmeric shadow-glow">
            <AnimatedIcon icon={Building2} size={22} animation="pop" className="text-turmeric" />
          </div>
          <div>
            <p className="font-heading text-base font-bold leading-tight text-text-primary">
              {org.name}
            </p>
            <p className="font-mono text-xs text-text-secondary/60">{org.code}</p>
          </div>
        </div>
        <OrgStatusBadge status={org.status} />
      </div>

      <div className="relative mt-4 space-y-3">
        <p className="truncate text-sm text-text-secondary">
          <span className="text-text-secondary/60">Admin: </span>
          {org.admin?.email || '—'}
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-k-border bg-malt/40 px-3 py-2">
          <AnimatedIcon icon={Users} size={18} animation="pulse" className="text-turmeric" />
          <span className="font-heading text-xl font-extrabold text-text-primary">
            {Number(studentCount).toLocaleString()}
          </span>
          <span className="text-xs text-text-secondary/70">students</span>
        </div>
      </div>

      {(onOpen || onResetAdmin || onSuspendToggle || onDelete) && (
        <div className="relative mt-4 flex items-center justify-end gap-1.5 border-t border-k-border/60 pt-3">
          {onOpen && (
            <button
              onClick={action(onOpen)}
              title="Open"
              aria-label={`Open ${org.name}`}
              className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
            >
              <Eye size={16} />
            </button>
          )}
          {onResetAdmin && (
            <button
              onClick={action(onResetAdmin)}
              title="Reset admin credentials"
              aria-label={`Reset admin credentials for ${org.name}`}
              className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-turmeric active:scale-95"
            >
              <KeyRound size={16} />
            </button>
          )}
          {onSuspendToggle && (
            <button
              onClick={action(onSuspendToggle)}
              title={isActive ? 'Suspend' : 'Activate'}
              aria-label={`${isActive ? 'Suspend' : 'Activate'} ${org.name}`}
              className={`rounded-lg p-1.5 transition-colors duration-150 ease-out active:scale-95 hover:bg-surface ${
                isActive ? 'text-error' : 'text-success'
              }`}
            >
              {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
            </button>
          )}
          {onDelete && (
            <button
              onClick={action(onDelete)}
              title="Delete"
              aria-label={`Delete ${org.name}`}
              className="rounded-lg p-1.5 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface hover:text-error active:scale-95"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
