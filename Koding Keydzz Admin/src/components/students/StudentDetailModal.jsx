import { motion } from 'framer-motion';
import {
  Zap,
  Coins,
  Trophy,
  Star,
  Gamepad2,
  BookOpen,
  Sparkles,
  CircleCheck,
  Wallet,
  Award,
  Lock,
  Calendar,
  Building2,
  GraduationCap,
} from 'lucide-react';
import Modal from '../ui/Modal';
import QueryState from '../ui/QueryState';
import AnimatedIcon from '../ui/AnimatedIcon';
import { useGetStudentDetailQuery } from '../../features/admin/adminApi';
import { useGetSuperStudentDetailQuery } from '../../features/superadmin/superadminApi';

function StatusBadge({ status }) {
  const map = {
    active: 'bg-success/15 text-success border-success/30',
    idle: 'bg-turmeric/15 text-turmeric border-turmeric/30',
    suspended: 'bg-error/15 text-error border-error/30',
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || map.idle}`}>
      {status || 'active'}
    </span>
  );
}

function orgLabel(org) {
  if (!org) return '—';
  if (typeof org === 'string') return org;
  return org.name || '—';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MiniStat({ icon: Icon, label, value, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="min-w-0 rounded-xl border border-k-border bg-malt/40 p-3"
    >
      <div className="flex items-center gap-2 text-turmeric">
        <Icon size={15} className="shrink-0" />
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-heading text-xl font-extrabold tabular-nums text-text-primary">{value}</p>
    </motion.div>
  );
}

function StudentDetailBody({ detail, fallbackName }) {
  const student = detail?.student || {};
  const stats = detail?.stats || {};
  const gameProgress = Array.isArray(detail?.gameProgress) ? detail.gameProgress : [];
  const achievements = Array.isArray(detail?.achievements) ? detail.achievements : [];

  const name = student.name || fallbackName || '—';
  const level = student.level ?? 1;
  const xp = student.xp ?? 0;
  const nextLevelXp = student.nextLevelXp ?? 0;
  const xpPercent = nextLevelXp > 0 ? Math.min(100, Math.round((xp / nextLevelXp) * 100)) : 0;

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-turmeric/20 font-heading text-2xl font-extrabold text-turmeric">
            {name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-heading text-xl font-bold text-text-primary">{name}</h3>
              <StatusBadge status={student.status} />
            </div>
            <p className="truncate font-mono text-xs text-text-secondary/70">{student.username || '—'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary/70">
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={13} className="shrink-0" /> {student.grade || '—'}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <Building2 size={13} className="shrink-0" />
                <span className="truncate">{orgLabel(student.org)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={13} className="shrink-0" /> Joined {formatDate(student.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* XP progress to next level */}
      <div className="rounded-xl border border-k-border bg-malt/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
            <Trophy size={15} className="text-turmeric" /> Level {level}
          </span>
          <span className="text-xs text-text-secondary/70">
            {xp.toLocaleString()}{nextLevelXp > 0 ? ` / ${nextLevelXp.toLocaleString()} XP` : ' XP'}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
          <motion.div
            className="h-full rounded-full bg-turmeric shadow-glow"
            initial={{ width: 0 }}
            animate={{ width: `${xpPercent}%` }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        {nextLevelXp > 0 && (
          <p className="mt-1.5 text-[11px] text-text-secondary/70">{xpPercent}% to Level {level + 1}</p>
        )}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={Zap} label="XP" value={xp.toLocaleString()} index={0} />
        <MiniStat icon={Coins} label="Coins" value={(student.coins ?? 0).toLocaleString()} index={1} />
        <MiniStat icon={Wallet} label="Coins Earned" value={(student.totalCoinsEarned ?? 0).toLocaleString()} index={2} />
        <MiniStat icon={CircleCheck} label="Quizzes Passed" value={stats.quizzesPassed ?? 0} index={3} />
        <MiniStat icon={Gamepad2} label="Game Levels" value={stats.gameLevelsCompleted ?? 0} index={4} />
        <MiniStat icon={Star} label="Perfect Levels" value={stats.perfectLevels ?? 0} index={5} />
        <MiniStat icon={BookOpen} label="Lessons Done" value={stats.lessonsCompleted ?? 0} index={6} />
        <MiniStat icon={Trophy} label="Achievements" value={`${unlocked.length}/${achievements.length}`} index={7} />
      </div>

      {/* Per-game progress */}
      <div>
        <p className="k-label mb-2 flex items-center gap-1.5">
          <Gamepad2 size={14} className="text-turmeric" /> Game Progress
        </p>
        {gameProgress.length === 0 ? (
          <p className="rounded-xl border border-k-border bg-malt/30 px-4 py-3 text-sm text-text-secondary/70">
            No game progress recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {gameProgress.map((g, i) => (
              <motion.div
                key={g.gameKey || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-k-border bg-malt/40 px-4 py-2.5"
              >
                <span className="min-w-0 truncate font-medium capitalize text-text-primary">
                  {String(g.gameKey || '—').replace(/[-_]/g, ' ')}
                </span>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="text-text-secondary">
                    <span className="font-semibold text-text-primary">{g.levelsCompleted ?? 0}</span> levels
                  </span>
                  <span className="inline-flex items-center gap-1 text-turmeric">
                    <Star size={13} /> {g.totalStars ?? 0}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div>
        <p className="k-label mb-2 flex items-center gap-1.5">
          <Award size={14} className="text-turmeric" /> Achievements ({unlocked.length}/{achievements.length})
        </p>
        {achievements.length === 0 ? (
          <p className="rounded-xl border border-k-border bg-malt/30 px-4 py-3 text-sm text-text-secondary/70">
            No achievements available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...unlocked, ...locked].map((a, i) => {
              const percent = a.unlocked
                ? 100
                : typeof a.percent === 'number'
                ? Math.max(0, Math.min(100, Math.round(a.percent)))
                : a.target
                ? Math.round(((a.progress ?? 0) / a.target) * 100)
                : 0;
              return (
                <motion.div
                  key={a.key || i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`min-w-0 rounded-xl border p-3 ${
                    a.unlocked
                      ? 'border-turmeric/40 bg-turmeric/10'
                      : 'border-k-border bg-malt/30'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
                      a.unlocked ? 'bg-turmeric/20 text-turmeric' : 'bg-surface text-text-secondary/70'
                    }`}>
                      {a.icon && typeof a.icon === 'string' && a.icon.length <= 3
                        ? a.icon
                        : a.unlocked
                        ? <Award size={16} />
                        : <Lock size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{a.title || a.key}</p>
                      {!a.unlocked && a.target ? (
                        <p className="text-[11px] text-text-secondary/70">
                          {a.progress ?? 0}/{a.target}
                        </p>
                      ) : (
                        <p className={`text-[11px] ${a.unlocked ? 'text-turmeric' : 'text-text-secondary/70'}`}>
                          {a.unlocked ? 'Unlocked' : 'Locked'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${a.unlocked ? 'bg-turmeric' : 'bg-turmeric/50'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full per-student progress view. Role decides which endpoint feeds it:
 *   role="admin"      -> GET /admin/students/:id
 *   role="superadmin" -> GET /superadmin/students/:id
 * Both hooks are declared (rules of hooks) but only the active one runs; the
 * other is skipped.
 */
export default function StudentDetailModal({ open, onClose, studentId, role = 'admin', fallbackName }) {
  const isSuper = role === 'superadmin';
  const adminQ = useGetStudentDetailQuery(studentId, { skip: !open || !studentId || isSuper });
  const superQ = useGetSuperStudentDetailQuery(studentId, { skip: !open || !studentId || !isSuper });
  const q = isSuper ? superQ : adminQ;

  const detail = q.data;
  const student = detail?.student;

  return (
    <Modal open={open} onClose={onClose} title="Student Progress" size="xl">
      <QueryState
        isLoading={q.isLoading || q.isFetching}
        isError={q.isError}
        error={q.error}
        refetch={q.refetch}
        isEmpty={!q.isLoading && !q.isFetching && !student}
        loadingLabel="Loading student progress…"
        emptyTitle="No details available"
        emptyMessage="We couldn't load this student's progress right now."
        emptyIcon={Trophy}
      >
        <StudentDetailBody detail={detail} fallbackName={fallbackName} />
      </QueryState>
    </Modal>
  );
}
