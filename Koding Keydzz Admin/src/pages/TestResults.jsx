import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Users,
  Trophy,
  CircleSlash,
  Clock,
  Eye,
  Search,
} from 'lucide-react';
import { useGetTestResultsQuery, exportClassReportCsv } from '../features/admin/adminApi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import StatCard from '../components/ui/StatCard';
import DataTable from '../components/ui/DataTable';
import QueryState from '../components/ui/QueryState';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import { COURSES, DEFAULT_COURSE_SLUG, courseBySlug } from '../config/courses';

/**
 * FINAL-TEST RESULTS — read only, on purpose.
 *
 * Staff track and support; they do not mark, and they cannot change a score.
 * There is no edit control on this page and no endpoint behind one, because a
 * mark a teacher can adjust is not a mark the certificate can stand on.
 *
 * Two things are deliberately absent:
 *
 *   • THE PAPER. A live paper carries the questions pupils are currently being
 *     examined on, drawn from a bank other classes are still sitting. Staff get
 *     marks per section, never the questions or the answers.
 *
 *   • ANY WAY TO GRANT A PASS. Passing is what unlocks the next course, and it
 *     is earned on the paper or not at all.
 *
 * What staff DO get is the thing they actually need: who is stuck. Pupils who
 * have not started are listed alongside those who have — a table of only the
 * pupils who happened to attempt hides exactly the children who need chasing.
 *
 * Scoping is the server's, twice over: to the school, and — for a teacher —
 * to their own classes. This page sends no scope of its own.
 */

const STATUS = {
  passed: { label: 'Passed', className: 'bg-success/15 text-success' },
  failed: { label: 'Not yet passed', className: 'bg-error/15 text-error' },
  in_progress: { label: 'Working on it', className: 'bg-turmeric/15 text-turmeric' },
  not_started: {
    label: 'Not started',
    className: 'bg-malt/60 text-text-secondary',
  },
};

function StatusPill({ status }) {
  const meta = STATUS[status] || STATUS.not_started;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

/**
 * The mark, against the mark needed.
 *
 * Shown as "138 / 200" with the pass mark implied by the colour rather than a
 * bare percentage: a teacher deciding who to help needs to know how far off a
 * pupil was, and 69% does not answer that as directly as the two numbers do.
 */
function ScoreCell({ row, passMark, total }) {
  if (!row.attemptsUsed) {
    return <span className="text-text-secondary/70">—</span>;
  }
  const close = !row.passed && row.bestScore >= passMark * 0.85;
  return (
    <span className="tabular-nums font-semibold">
      <span
        className={
          row.passed ? 'text-success' : close ? 'text-turmeric' : 'text-text-primary'
        }
      >
        {row.bestScore}
      </span>
      <span className="text-text-secondary/70"> / {total}</span>
    </span>
  );
}

/** How many tries a pupil has spent, out of the allowance. */
function AttemptsCell({ row, maxAttempts }) {
  if (!row.attemptsUsed) return <span className="text-text-secondary/70">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums font-semibold text-text-primary">
        {row.attemptsUsed}
      </span>
      <span className="text-text-secondary/70"> of {maxAttempts}</span>
      {/* Every try spent and still not passed is the state that needs a
          teacher, so it is called out rather than left to arithmetic. */}
      {row.attemptsUsed >= maxAttempts && !row.passed && (
        <span className="ml-2 rounded-full bg-error/15 px-2 py-0.5 text-xs font-semibold text-error">
          out of tries
        </span>
      )}
    </span>
  );
}

export default function TestResults() {
  const [slug, setSlug] = useState(DEFAULT_COURSE_SLUG);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await exportClassReportCsv();
    } catch {
      // A download is a plain fetch, so it never passes through the RTK Query
      // middleware that raises a toast for everything else. Without this the
      // button would fail in complete silence.
      setExportError('Could not export the results. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const query = useGetTestResultsQuery({ slug, search, limit: 100 });

  const data = query.data || {};
  const rows = useMemo(() => data.items || [], [data.items]);
  const summary = data.summary || {};
  // From the server, not this file: the marker's own constants travel with the
  // results so a changed pass mark cannot leave this page reporting the old one.
  const { passMark = 150, total = 200, maxAttempts = 3 } = data.marking || {};

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
              {row.grade ? ` · ${row.grade}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={row.status} />
            {/* A mark a human still owes must not read as a settled fail. */}
            {row.awaitingReview && (
              <span className="whitespace-nowrap rounded-full bg-turmeric/15 px-2 py-0.5 text-xs font-semibold text-turmeric">
                needs marking
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'bestScore',
        label: 'Best mark',
        render: (row) => <ScoreCell row={row} passMark={passMark} total={total} />,
      },
      {
        key: 'attemptsUsed',
        label: 'Tries',
        render: (row) => <AttemptsCell row={row} maxAttempts={maxAttempts} />,
      },
      {
        key: 'lastAttemptAt',
        label: 'Last sat',
        render: (row) =>
          row.lastAttemptAt ? (
            <span className="whitespace-nowrap text-text-secondary">
              {new Date(row.lastAttemptAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-text-secondary/70">—</span>
          ),
      },
    ],
    [passMark, total, maxAttempts]
  );

  const active = courseBySlug(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Final test results"
        subtitle="Who has passed, who is close, and who has not started. Marks are set by the test and cannot be edited here."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-k-border bg-malt/50 px-3 py-1.5 text-xs font-semibold text-text-secondary">
          <Eye size={13} /> View only
        </span>
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Export results (CSV)'}
        </Button>
      </PageHeader>

      {exportError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {exportError}
        </p>
      ) : null}

      {/* ---- course tabs ---- */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Choose a course"
      >
        {COURSES.map((c) => {
          const on = c.slug === slug;
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSlug(c.slug)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                on
                  ? 'border-transparent text-malt'
                  : 'border-k-border bg-card text-text-secondary [@media(hover:hover)]:hover:text-text-primary'
              }`}
              style={on ? { background: c.tint } : undefined}
            >
              {c.short}
            </button>
          );
        })}
      </div>

      {/* ---- headline figures, over the SCOPED set ---- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={summary.pupils ?? 0}
          icon={Users}
          index={0}
          hint="in your classes"
        />
        <StatCard
          label="Passed"
          value={summary.passed ?? 0}
          icon={Trophy}
          index={1}
          hint={`${passMark} of ${total} needed`}
        />
        <StatCard
          label="Not started"
          value={summary.notStarted ?? 0}
          icon={CircleSlash}
          index={2}
          hint="have not sat it yet"
        />
        <StatCard
          label="Awaiting marking"
          value={summary.awaitingReview ?? 0}
          icon={Clock}
          index={3}
          hint="need a teacher to look"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="k-card p-5"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="inline-flex items-center gap-2 font-heading text-lg font-bold text-text-primary">
            <AnimatedIcon
              icon={ClipboardCheck}
              size={20}
              animation="none"
              className="text-turmeric"
            />
            {active.title}
          </h2>

          <label className="relative">
            <span className="sr-only">Search students</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students"
              className="w-full rounded-xl border border-k-border bg-malt/40 py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-turmeric sm:w-64"
            />
          </label>
        </div>

        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          refetch={query.refetch}
          loadingLabel="Loading results…"
          isEmpty={rows.length === 0}
          emptyIcon={ClipboardCheck}
          emptyTitle={
            search ? 'No students match that search' : 'No students to report on yet'
          }
          emptyMessage={
            search
              ? 'Try a different name.'
              : 'Once students are enrolled, their final-test progress appears here.'
          }
        >
          {/* Search is server-side (and scope-aware), so the table must not
              filter again on top of it. */}
          <DataTable columns={columns} data={rows} pageSize={15} searchKeys={[]} />
        </QueryState>
      </motion.div>
    </div>
  );
}
