import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Lock, Unlock, Users, CheckCircle2, Circle } from 'lucide-react';
import {
  useGetRealmRosterQuery,
  useGrantRealmMutation,
  useRevokeRealmMutation,
} from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import QueryState from '../components/ui/QueryState';
import StatCard from '../components/ui/StatCard';
import { formatApiError } from '../utils/apiError';

/**
 * The realm this screen manages access to.
 *
 * Python, because it is the one with a gate in front of it: Cognitive Games is
 * realm 1 and open to everyone, and the realms beyond Python are opened by
 * passing a final test, which is a mark and not a decision. So the only realm
 * a teacher has a judgement to make about is this one.
 */
const REALM_SLUG = 'python';

/**
 * OPENING A REALM BY HAND.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * Every other lock on the platform is derived — finish the previous thing and
 * the next opens — because a stored flag drifts from the completions it is
 * meant to summarise. This is the deliberate exception, and the reason is
 * teaching rather than technical: a class is taught to a timetable. A teacher
 * starting Python with the whole group on Monday cannot wait for the slowest
 * child to finish four games, and one who knows a pupil is ready should not
 * have to make them play a game they will find trivial.
 *
 * WHY A GRANT CANNOT DO HARM
 * --------------------------
 * It only ever ADDS access. The derived rule still opens a realm a pupil has
 * earned, so withdrawing a grant cannot close a realm they actually finished —
 * the worst a mistaken click can do is let somebody start early, and the worst
 * a mistaken withdrawal can do is nothing at all. That asymmetry is what makes
 * this safe to put in front of a whole staff room, and the table says which
 * pupils are in which case so nobody has to guess.
 */
export default function Realms() {
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const query = useGetRealmRosterQuery(REALM_SLUG);
  const [grantRealm] = useGrantRealmMutation();
  const [revokeRealm] = useRevokeRealmMutation();

  const data = query.data || {};
  const rows = useMemo(() => data.items || [], [data.items]);

  const act = async (row, open) => {
    setBusyId(row.id);
    setError('');
    try {
      const call = open ? grantRealm : revokeRealm;
      await call({ slug: REALM_SLUG, studentId: row.id }).unwrap();
    } catch (err) {
      setError(formatApiError(err, 'Could not change that pupil’s access.'));
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Student',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{row.name}</p>
            <p className="truncate text-xs text-text-secondary">
              {row.username || row.email || '—'}
            </p>
          </div>
        ),
      },
      {
        key: 'games',
        label: 'Cognitive games',
        render: (row) => (
          /**
           * Every game named, with a tick or an empty circle. A bare "2 of 4"
           * tells a teacher how far a child is but not WHICH game they have
           * left — and the answer to that is the thing they would act on.
           */
          <div className="flex flex-wrap gap-1.5">
            {row.games.map((game) => (
              <span
                key={game.gameKey}
                title={`${game.gameKey}: ${game.levelsDone} level${game.levelsDone === 1 ? '' : 's'}`}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  game.levelsDone > 0
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-k-border text-text-secondary'
                }`}
              >
                {game.levelsDone > 0 ? <CheckCircle2 size={11} /> : <Circle size={10} />}
                {game.gameKey.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Python',
        render: (row) => {
          if (row.earned) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                <Unlock size={12} /> Earned
              </span>
            );
          }
          if (row.granted) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-turmeric/50 bg-turmeric/10 px-2.5 py-1 text-xs font-bold text-turmeric">
                <KeyRound size={12} /> Opened by staff
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-k-border px-2.5 py-1 text-xs font-semibold text-text-secondary">
              <Lock size={12} /> Locked
            </span>
          );
        },
      },
      {
        key: 'action',
        label: '',
        render: (row) => {
          if (row.earned) {
            /**
             * Nothing to do, and no button pretending otherwise. A pupil who
             * has earned the realm cannot have it taken away, so offering a
             * withdraw control here would be a button that does nothing.
             */
            return <span className="text-xs text-text-secondary">No action needed</span>;
          }
          return (
            <Button
              variant={row.granted ? 'secondary' : 'primary'}
              disabled={busyId === row.id}
              onClick={() => act(row, !row.granted)}
            >
              {busyId === row.id
                ? 'Saving…'
                : row.granted
                  ? 'Withdraw'
                  : 'Open Python'}
            </Button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Realm access"
        subtitle="Python opens on its own once a pupil has started all four cognitive games. Open it early for anyone who is ready."
      />

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        isEmpty={(data.items || []).length === 0}
        emptyTitle="No students yet"
        emptyMessage="Add students on the Students page and they will appear here."
        emptyIcon={Users}
        loadingLabel="Loading the roster…"
      >
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* `icon` is a COMPONENT here, not an element — StatCard renders
                `<Icon />` itself. Passing an element makes React throw, which
                took the whole page down behind the lazy-route error boundary. */}
            <StatCard label="Students" value={data.total ?? 0} icon={Users} index={0} />
            <StatCard
              label="Ready on their own"
              value={data.readyCount ?? 0}
              icon={Unlock}
              index={1}
            />
            <StatCard
              label="Opened by staff"
              value={data.grantedCount ?? 0}
              icon={KeyRound}
              index={2}
            />
          </div>

          {error ? (
            /* `role="alert"` so a failed grant is announced, not just drawn —
               a teacher who does not notice would believe a child has access. */
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* DataTable owns search, sorting and paging — a second search
                box here would be a second filter to keep in step with it. */}
            <DataTable
              columns={columns}
              data={rows}
              searchKeys={['name', 'username', 'email']}
              searchLabel="Search students"
              emptyMessage="No student matches that search."
            />
          </motion.div>
        </>
      </QueryState>
    </div>
  );
}
