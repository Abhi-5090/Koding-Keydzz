import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Crown, Medal } from 'lucide-react';
import { useGetLeaderboardQuery } from '../features/admin/adminApi';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';

function asList(data) {
  if (Array.isArray(data)) return data;
  // Backend now returns { scope, entries, me }; keep older shapes working too.
  return data?.entries || data?.leaderboard || [];
}

const TYPES = [
  { value: 'global', label: 'Global' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PODIUM = [
  { place: 1, icon: Crown, ring: 'ring-turmeric', bg: 'from-turmeric/30', order: 'sm:order-2', height: 'sm:h-44', label: 'text-turmeric' },
  { place: 2, icon: Medal, ring: 'ring-[#9DB8C4]/50', bg: 'from-surface/60', order: 'sm:order-1', height: 'sm:h-36', label: 'text-[#9DB8C4]' },
  { place: 3, icon: Medal, ring: 'ring-[#C98A5A]/50', bg: 'from-[#C98A5A]/20', order: 'sm:order-3', height: 'sm:h-32', label: 'text-[#C98A5A]' },
];

function Podium({ top3 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PODIUM.map((p, i) => {
        const student = top3[p.place - 1];
        if (!student) return <div key={p.place} className={p.order} />;
        const Icon = p.icon;
        return (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${p.order} flex flex-col justify-end`}
          >
            <div className={`k-card flex flex-col items-center gap-2 bg-gradient-to-b ${p.bg} to-card p-5 ${p.height}`}>
              <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-malt font-heading text-xl font-extrabold text-text-primary ring-2 ${p.ring}`}>
                {(student.name || '?').charAt(0)}
              </div>
              <AnimatedIcon
                icon={Icon}
                size={20}
                animation={p.place === 1 ? 'pulse' : 'pop'}
                glow={p.place === 1}
                className={p.label}
              />
              <p className="text-center font-heading font-bold text-text-primary">{student.name || '—'}</p>
              <div className="flex items-center gap-1 text-sm text-turmeric">
                <Zap size={14} /> {(student.xp ?? 0).toLocaleString()} XP
              </div>
              <span className="rounded-full border border-k-border bg-malt/50 px-2.5 py-0.5 text-xs text-text-secondary">
                Level {student.level ?? 1}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Leaderboards() {
  const [type, setType] = useState('global');
  const { data, isError, isLoading, error, refetch } = useGetLeaderboardQuery(type);

  const rows = asList(data);
  const top3 = rows.slice(0, 3);

  const columns = [
    {
      key: 'rank',
      header: 'Rank',
      render: (r) => (
        <span className={`font-heading font-bold ${(r.rank ?? 99) <= 3 ? 'text-turmeric' : 'text-text-secondary'}`}>
          #{r.rank ?? '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Student',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-turmeric/15 text-sm font-bold text-turmeric">
            {(r.name || '?').charAt(0)}
          </div>
          <span className="font-medium text-text-primary">{r.name || '—'}</span>
        </div>
      ),
    },
    { key: 'level', header: 'Level', render: (r) => <span className="text-text-secondary">Lv {r.level ?? 1}</span> },
    {
      key: 'xp',
      header: 'XP',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-turmeric">
          <Zap size={13} /> {(r.xp ?? 0).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Leaderboards" subtitle="Top performing students">
        <div className="flex rounded-xl border border-k-border bg-malt/40 p-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out active:scale-[0.97] ${
                type === t.value ? 'bg-turmeric text-malt' : 'text-text-secondary hover:text-turmeric'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="k-card flex items-center gap-2 px-5 py-3 text-sm text-text-secondary">
        <AnimatedIcon icon={Trophy} size={16} animation="pulse" className="text-turmeric" />
        Showing the <span className="font-semibold text-text-primary">{type}</span> leaderboard
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={rows.length === 0}
        loadingLabel="Loading leaderboard…"
        emptyTitle="No rankings yet"
        emptyMessage="Students will appear here as they earn XP."
        emptyIcon={Trophy}
      >
        {top3.length > 0 && <Podium top3={top3} />}
        <div className="mt-6">
          <DataTable columns={columns} data={rows} searchKeys={['name']} pageSize={10} />
        </div>
      </QueryState>
    </div>
  );
}
