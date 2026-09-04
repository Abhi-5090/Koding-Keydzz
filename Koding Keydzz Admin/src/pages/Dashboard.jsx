import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  GraduationCap,
  School,
  AlertTriangle,
  TrendingUp,
  Trophy,
  ArrowRight,
  CalendarDays,
  Info,
  PenLine,
  Award,
  Flame,
} from 'lucide-react';
import { useGetOrgAnalyticsQuery } from '../features/admin/adminApi';
import { selectAuth } from '../features/auth/authSlice';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';
import {
  ChartPanel,
  ChartEmpty,
  StatTile,
  TrendChart,
  BarBreakdown,
  DonutSplit,
  MeterRow,
  StatusChip,
} from '../components/charts/Primitives';
import { shortDate } from '../components/charts/chartTheme';
import useChartTheme from '../components/charts/useChartTheme';
import { useRevealOnScroll } from '../motion/hooks';

/**
 * The school dashboard — served to BOTH administrators and faculty.
 *
 * The API scopes itself from the caller's token: an administrator sees the
 * whole school, a teacher sees exactly the pupils in the classes they teach.
 * So this page has no role branching beyond the wording and which panels are
 * relevant.
 *
 * WRITTEN FOR NON-TECHNICAL READERS. This product is operated by teachers and
 * school office staff, not analysts, so:
 *   • every metric has a plain-language explanation behind the (i);
 *   • no jargon in a label without the definition one tap away;
 *   • the most actionable panel — who needs help — is placed first, above the
 *     charts, because that is the reason a teacher opens this page;
 *   • an empty state explains what to do next, never just "no data".
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

/** Range switcher. One row above the charts, per the interaction spec. */
function RangePicker({ value, onChange }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-k-border bg-card p-1"
      role="group"
      aria-label="Reporting period"
    >
      <CalendarDays size={14} className="ml-1.5 text-text-secondary/70" aria-hidden="true" />
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          onClick={() => onChange(r.days)}
          aria-pressed={value === r.days}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric ${
            value === r.days
              ? 'bg-turmeric text-malt'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** The list a teacher actually came for. */
function AttentionPanel({ students, scope }) {
  if (!students?.length) {
    return (
      <div className="k-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-success/15 p-2.5 text-success">
            <UserCheck size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-text-primary">
              Everyone is on track
            </h3>
            <p className="mt-1 text-sm text-text-secondary/70">
              No {scope === 'classrooms' ? 'pupil in your classes' : 'student'} is currently
              flagged as falling behind. Check back after the next lesson.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="k-card overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-k-border p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-error/15 p-2.5 text-error">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-text-primary">
              Needs your attention
            </h3>
            <p className="mt-0.5 text-sm text-text-secondary/70">
              {students.length} {students.length === 1 ? 'student is' : 'students are'} falling
              behind. Start here.
            </p>
          </div>
        </div>
        <Link
          to="/students"
          className="shrink-0 text-xs font-semibold text-turmeric hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
        >
          All students
        </Link>
      </header>

      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Students needing attention, most urgent first</caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-k-border text-left text-xs uppercase tracking-wide text-text-secondary/70">
              <th scope="col" className="px-5 py-2 font-semibold">Student</th>
              <th scope="col" className="px-3 py-2 font-semibold">Why</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Avg score</th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-k-border/50 last:border-0">
                <td className="px-5 py-3">
                  <Link
                    to={`/students?q=${encodeURIComponent(s.username || s.name)}`}
                    className="font-semibold text-text-primary hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                  >
                    {s.name}
                  </Link>
                  <div className="text-xs text-text-secondary/70">
                    {s.rollNumber ? `Roll ${s.rollNumber}` : s.username}
                    {s.grade ? ` · Grade ${s.grade}` : ''}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.attention.slice(0, 2).map((r) => (
                      <StatusChip key={r} tone="serious">
                        {r}
                      </StatusChip>
                    ))}
                    {s.attention.length > 2 && (
                      <span className="text-xs text-text-secondary/70">
                        +{s.attention.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                  {s.quizzesAttempted ? `${s.avgScore}%` : '—'}
                </td>
                <td className="px-5 py-3 text-right text-xs tabular-nums text-text-secondary/70">
                  {s.daysSinceActive == null
                    ? 'Never'
                    : s.daysSinceActive === 0
                      ? 'Today'
                      : `${s.daysSinceActive}d ago`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * WHAT NEEDS DOING TODAY.
 *
 * Separated from the rest of the dashboard on purpose. Everything below this
 * describes how the term is going; these three describe whether somebody has to
 * act, and they read differently:
 *
 *   • A MARKING BACKLOG is unfairness with a number on it. An answer the
 *     machine could not judge is recorded as a withheld mark, not a zero, so
 *     every item here is a pupil currently scored below the work they did.
 *     That is why it is the first thing, why it turns red rather than amber,
 *     and why it links straight to the queue.
 *   • CERTIFICATES are the outcome the whole ladder exists to produce.
 *   • STREAKS are the only leading indicator here. Everything else on this page
 *     tells you what already happened.
 */
function OperationalPanel({ op }) {
  if (!op) return null;

  const backlog = op.markingBacklog || 0;
  const waitingSince = op.oldestWaiting ? new Date(op.oldestWaiting) : null;
  const daysWaiting = waitingSince
    ? Math.floor((Date.now() - waitingSince.getTime()) / 86_400_000)
    : 0;

  return (
    <section
      aria-labelledby="operational-heading"
      className="rounded-2xl border border-k-border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="operational-heading"
          className="font-heading text-lg font-bold text-text-primary"
        >
          Needs attention now
        </h2>
        <p className="text-sm text-text-secondary/70">
          Not a trend — things to act on
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Marking backlog. Its own treatment, because it is the only one of
            the three that means someone is currently being treated unfairly. */}
        <div
          className={`rounded-xl border p-4 ${
            backlog > 0 ? 'border-error/50 bg-error/5' : 'border-k-border bg-surface/40'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Waiting to be marked
            </p>
            <span className={backlog > 0 ? 'text-error' : 'text-success'}>
              <PenLine size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-text-primary">
            {backlog}
          </p>
          {backlog > 0 ? (
            <>
              <p className="mt-1 text-sm text-text-secondary">
                {op.markingAttempts} paper{op.markingAttempts === 1 ? '' : 's'} affected
                {daysWaiting >= 1
                  ? `, oldest ${daysWaiting} day${daysWaiting === 1 ? '' : 's'} ago`
                  : ''}
                . Each is a mark held back, not a zero.
              </p>
              <Link
                to="/marking"
                className="mt-2 inline-block text-sm font-bold text-turmeric underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric/40"
              >
                Open the marking queue →
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              Nothing withheld. Every answer that needed a human has one.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-k-border bg-surface/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Certificates earned
            </p>
            <span className="text-turmeric">
              <Award size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-text-primary">
            {op.certificatesIssued || 0}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Courses passed and certified. Pupils can print theirs.
          </p>
        </div>

        <div className="rounded-xl border border-k-border bg-surface/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              On a daily streak
            </p>
            <span className="text-turmeric">
              <Flame size={16} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-text-primary">
            {op.streaks?.onStreak || 0}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Two days or more running
            {op.streaks?.longest
              ? `. Best so far is ${op.streaks.longest} day${op.streaks.longest === 1 ? '' : 's'}.`
              : '.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { CATEGORICAL, STATUS } = useChartTheme();
  /**
   * Chart panels rise into place as they scroll into view.
   *
   * Scroll-triggered rather than all-on-mount: this dashboard is several
   * screens tall, so animating everything at load would spend the whole
   * sequence off-screen where nobody sees it, and would animate content the
   * user may never scroll to. `once` (the default in useRevealOnScroll) means
   * a panel settles permanently after its first appearance — a panel that
   * re-animates every time it crosses the fold is a distraction on the way
   * back up.
   */
  const chartsRef = useRevealOnScroll({ selector: '.k-card', y: 20, stagger: 0.06 });
  const [days, setDays] = useState(30);
  const { user } = useSelector(selectAuth);
  const query = useGetOrgAnalyticsQuery({ days });
  const d = query.data;

  const isFaculty = user?.role === 'faculty';
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        subtitle={
          isFaculty
            ? 'Progress for the classes you teach'
            : `Progress across ${d?.organization?.name || 'your school'}`
        }
      >
        <RangePicker value={days} onChange={setDays} />
      </PageHeader>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        loadingLabel="Loading your dashboard…"
      >
        {d?.empty ? (
          /* A teacher with no classes assigned. Tell them exactly what to do
             rather than showing a wall of zeros. */
          <div className="k-card flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-turmeric/15 p-3 text-turmeric">
              <School size={26} aria-hidden="true" />
            </div>
            <h2 className="font-heading text-lg font-bold text-text-primary">
              No classes assigned yet
            </h2>
            <p className="max-w-md text-sm text-text-secondary/70">{d.emptyReason}</p>
          </div>
        ) : (
          <div ref={chartsRef} className="space-y-6">
            {/* ---- Headline numbers ---- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                index={0}
                label={isFaculty ? 'My students' : 'Students'}
                value={d?.kpis?.students?.value ?? 0}
                delta={d?.kpis?.students?.delta}
                direction={d?.kpis?.students?.direction}
                hint={`vs previous ${days} days`}
                icon={Users}
              />
              <StatTile
                index={1}
                label="Active this week"
                value={d?.kpis?.activeStudents?.value ?? 0}
                delta={d?.kpis?.activeStudents?.delta}
                direction={d?.kpis?.activeStudents?.direction}
                hint={`${d?.engagement?.engagementRate ?? 0}% of students`}
                icon={UserCheck}
              />
              <StatTile
                index={2}
                label="Average quiz score"
                value={`${d?.engagement?.classAverageScore ?? 0}%`}
                delta={null}
                direction="flat"
                hint="best attempt per quiz"
                icon={TrendingUp}
              />
              <StatTile
                index={3}
                label="Need attention"
                value={d?.kpis?.needingAttention?.value ?? 0}
                delta={null}
                direction="flat"
                tone="inverse"
                hint="falling behind"
                icon={AlertTriangle}
              />
            </div>

            {/* ---- What needs doing today, above everything descriptive ---- */}
            <OperationalPanel op={d?.operational} />

            {/* ---- The actionable panel, deliberately above the charts ---- */}
            <AttentionPanel students={d?.needingAttention} scope={d?.scope} />

            {/* ---- Activity over time ---- */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartPanel
                index={0}
                title="Learning activity"
                subtitle={`Quiz attempts and game levels, last ${days} days`}
                help="Each point counts how many quizzes were submitted and how many game levels were finished that day. A flat line means nobody used the app — often a holiday, or a class that has stopped logging in."
              >
                <TrendChart
                  data={(d?.series?.quizActivity || []).map((row, i) => ({
                    date: row.date,
                    quizzes: row.value,
                    games: d?.series?.gameActivity?.[i]?.value ?? 0,
                  }))}
                  series={[
                    { key: 'quizzes', label: 'Quiz attempts' },
                    { key: 'games', label: 'Game levels' },
                  ]}
                  formatX={shortDate}
                  emptyMessage="No activity in this period"
                  emptyHint="Once students start playing, their daily activity appears here."
                />
              </ChartPanel>

              <ChartPanel
                index={1}
                title="When students last used the app"
                subtitle="How recently each student was active"
                help="Students grouped by how long ago they last used Koding Keydzz. A large 'Over a month' group is the clearest early warning that a class has quietly stopped."
              >
                <BarBreakdown
                  data={d?.distributions?.recency || []}
                  suffix=""
                  colorFor={(row) => {
                    const map = {
                      Today: STATUS.good,
                      '1–6 days': STATUS.good,
                      '1–4 weeks': STATUS.warning,
                      'Over a month': STATUS.critical,
                    };
                    return map[row.label] || CATEGORICAL[0];
                  }}
                  emptyMessage="No students yet"
                />
              </ChartPanel>
            </div>

            {/* ---- Curriculum + difficulty ---- */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartPanel
                index={2}
                title="Progress through each world"
                subtitle="Share of lessons completed"
                help="For each world, the percentage of all available lessons that your students have completed between them. Low numbers on later worlds are normal early in a term."
                height="auto"
              >
                {d?.worldMastery?.length ? (
                  <div className="flex flex-col gap-4 py-1">
                    {d.worldMastery.map((w) => (
                      <MeterRow
                        key={w.id}
                        label={w.label}
                        value={w.value}
                        sub={`${w.completions} of ${w.lessons * (d.kpis.students.value || 0)} lesson completions`}
                      />
                    ))}
                  </div>
                ) : (
                  <ChartEmpty message="No lessons completed yet" />
                )}
              </ChartPanel>

              <ChartPanel
                index={3}
                title="Hardest quizzes"
                subtitle="Lowest pass rate first"
                help="The quizzes your students struggle with most. A quiz that most of the class fails usually means the concept needs re-teaching — it is rarely thirty separate problems."
              >
                <BarBreakdown
                  data={(d?.quizDifficulty || []).slice(0, 7).map((q) => ({
                    label: q.title.length > 26 ? `${q.title.slice(0, 24)}…` : q.title,
                    value: q.passRate,
                  }))}
                  horizontal
                  suffix="%"
                  colorFor={(row) =>
                    row.value >= 70
                      ? STATUS.good
                      : row.value >= 40
                        ? STATUS.warning
                        : STATUS.critical
                  }
                  emptyMessage="No quizzes attempted yet"
                  emptyHint="Pass rates appear once students start submitting quizzes."
                />
              </ChartPanel>
            </div>

            {/* ---- Levels + top students ---- */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartPanel
                index={4}
                title="Experience levels"
                subtitle="How far students have progressed"
                help="Students earn XP from lessons, quizzes and games, and level up as it accumulates. A wide spread is healthy; everyone stuck at level 1 means the class has not really started."
                className="xl:col-span-2"
              >
                <BarBreakdown
                  data={d?.distributions?.level || []}
                  emptyMessage="No progress yet"
                />
              </ChartPanel>

              <ChartPanel
                index={5}
                title="Top students"
                subtitle="By experience points"
                help="Ranked by total XP. Useful for recognition — but a leaderboard is not a measure of ability, only of time spent."
                height="auto"
              >
                {d?.topStudents?.length ? (
                  <ol className="flex flex-col gap-2 py-1">
                    {d.topStudents.slice(0, 8).map((s, i) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <span
                          className="w-5 shrink-0 text-center text-xs font-bold tabular-nums"
                          style={{
                            color:
                              i === 0
                                ? '#FF602F'
                                : i === 1
                                  ? '#9DB8C4'
                                  : i === 2
                                    ? '#C98A5A'
                                    : 'rgba(157,184,196,0.5)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                          {s.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                          {s.xp.toLocaleString()} XP
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ChartEmpty message="No students yet" />
                )}
              </ChartPanel>
            </div>

            {/* ---- Coverage summary ---- */}
            <section className="k-card p-5">
              <div className="mb-4 flex items-center gap-1.5">
                <h3 className="font-heading text-base font-bold text-text-primary">
                  Coverage at a glance
                </h3>
                <span
                  title="Coverage is the share of the available material your students have worked through."
                  className="text-text-secondary/70"
                >
                  <Info size={14} aria-hidden="true" />
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <MeterRow
                  label="Lessons completed"
                  value={d?.engagement?.avgLessonCoverage ?? 0}
                  sub="average per student"
                />
                <MeterRow
                  label="Quizzes attempted"
                  value={d?.engagement?.avgQuizCoverage ?? 0}
                  sub="average per student"
                />
                <MeterRow
                  label="Students active this week"
                  value={d?.engagement?.engagementRate ?? 0}
                  sub={`${d?.engagement?.activeStudents ?? 0} of ${d?.kpis?.students?.value ?? 0}`}
                />
              </div>
              <p className="mt-4 border-t border-k-border pt-3 text-xs text-text-secondary/70">
                Average XP {(d?.engagement?.avgXp ?? 0).toLocaleString()} · median{' '}
                {(d?.engagement?.medianXp ?? 0).toLocaleString()}. The median is the
                middle student — when it is much lower than the average, a few very
                active students are lifting the mean.
              </p>
            </section>

            {!isFaculty && (
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/classrooms"
                  className="inline-flex items-center gap-2 rounded-xl border border-k-border bg-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-turmeric/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                >
                  <School size={16} aria-hidden="true" />
                  Manage classes
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link
                  to="/staff"
                  className="inline-flex items-center gap-2 rounded-xl border border-k-border bg-card px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-turmeric/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                >
                  <GraduationCap size={16} aria-hidden="true" />
                  Manage teachers
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}
