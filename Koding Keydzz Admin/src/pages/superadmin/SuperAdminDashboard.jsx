import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  CalendarDays,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { useGetPlatformAnalyticsQuery } from '../../features/superadmin/superadminApi';
import PageHeader from '../../components/ui/PageHeader';
import QueryState from '../../components/ui/QueryState';
import {
  ChartPanel,
  ChartEmpty,
  StatTile,
  TrendChart,
  BarBreakdown,
  DonutSplit,
  MeterRow,
  StatusChip,
} from '../../components/charts/Primitives';
import { shortDate, shortMonth } from '../../components/charts/chartTheme';
import useChartTheme from '../../components/charts/useChartTheme';

/**
 * The platform owner's dashboard.
 *
 * Answers, in order of how often it is asked:
 *   1. How big is the platform, and is it growing?
 *   2. Are the schools actually USING it? (the renewal question)
 *   3. Which schools are at risk of churning? (the actionable one)
 *   4. What is happening day to day?
 *
 * The at-risk table sits high on the page for the same reason the teacher
 * dashboard leads with struggling pupils: it is the reason to open the page.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

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

/** Engagement band for a school, shown as a labelled chip (never colour alone). */
function engagementTone(rate) {
  if (rate >= 50) return { tone: 'good', label: 'Healthy' };
  if (rate >= 25) return { tone: 'warning', label: 'Slipping' };
  return { tone: 'critical', label: 'At risk' };
}

export default function SuperAdminDashboard() {
  const { CATEGORICAL, STATUS } = useChartTheme();
  const [days, setDays] = useState(30);
  const query = useGetPlatformAnalyticsQuery({ days });
  const d = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        subtitle="Every school, every user, and how much they are actually using Koding Keydzz"
      >
        <RangePicker value={days} onChange={setDays} />
      </PageHeader>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={query.refetch}
        loadingLabel="Loading platform analytics…"
      >
        <div className="space-y-6">
          {/* ---- Scale ---- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Schools"
              value={d?.kpis?.organizations?.value ?? 0}
              delta={d?.kpis?.newOrganizations?.delta}
              direction={d?.kpis?.newOrganizations?.direction}
              hint={`${d?.kpis?.newOrganizations?.value ?? 0} added this period`}
              icon={Building2}
            />
            <StatTile
              index={1}
              label="Students"
              value={d?.kpis?.students?.value ?? 0}
              delta={d?.kpis?.newStudents?.delta}
              direction={d?.kpis?.newStudents?.direction}
              hint={`${d?.kpis?.newStudents?.value ?? 0} added this period`}
              icon={Users}
            />
            <StatTile
              index={2}
              label="Teachers"
              value={d?.kpis?.faculty?.value ?? 0}
              delta={null}
              direction="flat"
              hint={`${d?.kpis?.admins?.value ?? 0} administrators`}
              icon={GraduationCap}
            />
            <StatTile
              index={3}
              label="Active this week"
              value={d?.kpis?.weeklyActive?.value ?? 0}
              delta={d?.kpis?.weeklyActive?.delta}
              direction={d?.kpis?.weeklyActive?.direction}
              hint={`${d?.engagement?.activeShare ?? 0}% of all students`}
              icon={Activity}
            />
          </div>

          {/* ---- At-risk schools: the actionable list ---- */}
          {d?.tenants?.atRisk?.length > 0 && (
            <section className="k-card overflow-hidden">
              <header className="flex items-start justify-between gap-3 border-b border-k-border p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-error/15 p-2.5 text-error">
                    <AlertTriangle size={22} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-bold text-text-primary">
                      Schools at risk
                    </h3>
                    <p className="mt-0.5 text-sm text-text-secondary/70">
                      Fewer than a quarter of their students used the app this week. These
                      are the accounts worth a call.
                    </p>
                  </div>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Schools with low weekly engagement</caption>
                  <thead>
                    <tr className="border-b border-k-border text-left text-xs uppercase tracking-wide text-text-secondary/70">
                      <th scope="col" className="px-5 py-2 font-semibold">School</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Students</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Active</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Engagement</th>
                      <th scope="col" className="px-5 py-2 font-semibold">Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tenants.atRisk.map((o) => {
                      const band = engagementTone(o.engagementRate);
                      return (
                        <tr key={o.id} className="border-b border-k-border/50 last:border-0">
                          <td className="px-5 py-3">
                            <Link
                              to={`/superadmin/orgs/${o.id}`}
                              className="font-semibold text-text-primary hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                            >
                              {o.name}
                            </Link>
                            <div className="text-xs text-text-secondary/70">{o.code}</div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                            {o.students}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                            {o.activeStudents}
                          </td>
                          <td className="px-3 py-3">
                            <StatusChip tone={band.tone}>
                              {o.engagementRate}% · {band.label}
                            </StatusChip>
                          </td>
                          <td className="px-5 py-3 text-xs capitalize text-text-secondary">
                            {o.plan}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ---- Growth ---- */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartPanel
              index={0}
              title="Growth"
              subtitle="New schools and students per month"
              help="How many schools and students were added each month over the past year. Two lines on one axis because both are counts of new sign-ups — comparing their shape is the point."
            >
              <TrendChart
                data={(d?.series?.studentGrowth || []).map((row, i) => ({
                  month: row.month,
                  students: row.value,
                  schools: d?.series?.orgGrowth?.[i]?.value ?? 0,
                }))}
                xKey="month"
                series={[
                  { key: 'students', label: 'New students' },
                  { key: 'schools', label: 'New schools' },
                ]}
                formatX={shortMonth}
                emptyMessage="No sign-ups recorded yet"
              />
            </ChartPanel>

            <ChartPanel
              index={1}
              title="Daily activity"
              subtitle={`Quiz attempts and game levels, last ${days} days`}
              help="Total learning events per day across every school. Weekday peaks with weekend dips is the normal shape for a school product — a flat weekday means something is wrong."
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
              />
            </ChartPanel>
          </div>

          {/* ---- Engagement quality ---- */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartPanel
              index={2}
              title="How often students return"
              subtitle="Daily, weekly and monthly active students"
              help="DAU / WAU / MAU are the count of distinct students who used the app in the last day, week and month. 'Stickiness' is daily divided by monthly — above 20% is healthy for a learning product, because pupils typically use it on lesson days rather than daily."
              height="auto"
            >
              <div className="flex flex-col gap-4 py-1">
                <MeterRow
                  label="Stickiness (daily ÷ monthly)"
                  value={d?.engagement?.dauOverMau ?? 0}
                  sub={`${d?.engagement?.dau ?? 0} of ${d?.engagement?.mau ?? 0} monthly students used it today`}
                />
                <MeterRow
                  label="Weekly reach (weekly ÷ monthly)"
                  value={d?.engagement?.wauOverMau ?? 0}
                  sub={`${d?.engagement?.wau ?? 0} active in the last 7 days`}
                />
                <MeterRow
                  label="Share of all students active weekly"
                  value={d?.engagement?.activeShare ?? 0}
                  sub={`of ${(d?.kpis?.students?.value ?? 0).toLocaleString()} enrolled`}
                />
              </div>
            </ChartPanel>

            <ChartPanel
              index={3}
              title="Schools by plan"
              subtitle="Contract mix"
              help="How many schools are on each plan. Trial accounts that never convert are the clearest signal that onboarding needs attention."
            >
              <DonutSplit
                data={d?.tenants?.byPlan || []}
                centerValue={d?.tenants?.total ?? 0}
                centerLabel="Schools"
                emptyMessage="No schools yet"
              />
            </ChartPanel>

            <ChartPanel
              index={4}
              title="Experience levels"
              subtitle="All students, platform-wide"
              help="Students grouped by the level they have reached. A large level-1 group relative to the total suggests many accounts were created but never really used."
            >
              <BarBreakdown
                data={(d?.distributions?.level || []).slice(0, 10)}
                emptyMessage="No progress yet"
              />
            </ChartPanel>
          </div>

          {/* ---- All schools ---- */}
          <section className="k-card overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-k-border p-5">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-bold text-text-primary">
                  All schools
                </h3>
                <p className="mt-0.5 text-sm text-text-secondary/70">
                  Sorted by student count. Engagement is the share of that school&apos;s
                  students who used the app this week.
                </p>
              </div>
              <Link
                to="/superadmin/orgs"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-turmeric hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
              >
                Manage schools <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </header>

            {d?.tenants?.table?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">Every school with its usage figures</caption>
                  <thead>
                    <tr className="border-b border-k-border text-left text-xs uppercase tracking-wide text-text-secondary/70">
                      <th scope="col" className="px-5 py-2 font-semibold">School</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Students</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Teachers</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Engagement</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Avg XP</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Seats</th>
                      <th scope="col" className="px-5 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tenants.table.map((o) => {
                      const band = engagementTone(o.engagementRate);
                      return (
                        <tr key={o.id} className="border-b border-k-border/50 last:border-0">
                          <td className="px-5 py-3">
                            <Link
                              to={`/superadmin/orgs/${o.id}`}
                              className="font-semibold text-text-primary hover:text-turmeric focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
                            >
                              {o.name}
                            </Link>
                            <div className="text-xs capitalize text-text-secondary/70">
                              {o.code} · {o.plan}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                            {o.students}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-primary">
                            {o.faculty}
                          </td>
                          <td className="px-3 py-3">
                            <StatusChip tone={band.tone}>{o.engagementRate}%</StatusChip>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                            {o.avgXp.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right text-xs tabular-nums text-text-secondary">
                            {o.seatLimit ? `${o.seatUtilization}% of ${o.seatLimit}` : 'Unlimited'}
                          </td>
                          <td className="px-5 py-3">
                            <StatusChip tone={o.status === 'active' ? 'good' : 'critical'}>
                              {o.status === 'active' ? 'Active' : 'Suspended'}
                            </StatusChip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8">
                <ChartEmpty
                  message="No schools yet"
                  hint="Add your first school from the Schools page to start seeing analytics here."
                />
              </div>
            )}
          </section>

          {/* ---- Learning + content footer ---- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              index={0}
              label="Quiz pass rate"
              value={`${d?.learning?.quizPassRate ?? 0}%`}
              delta={null}
              direction="flat"
              hint={`${(d?.learning?.totalQuizAttempts ?? 0).toLocaleString()} attempts`}
              icon={TrendingUp}
            />
            <StatTile
              index={1}
              label="Average XP"
              value={(d?.learning?.avgXp ?? 0).toLocaleString()}
              delta={null}
              direction="flat"
              hint={`median ${(d?.learning?.medianXp ?? 0).toLocaleString()}`}
              icon={Activity}
            />
            <StatTile
              index={2}
              label="Curriculum"
              value={d?.content?.lessons ?? 0}
              delta={null}
              direction="flat"
              hint={`${d?.content?.worlds ?? 0} worlds · ${d?.content?.quizzes ?? 0} quizzes`}
              icon={BookOpen}
            />
            <StatTile
              index={3}
              label="Suspended schools"
              value={d?.tenants?.suspended ?? 0}
              delta={null}
              direction="flat"
              tone="inverse"
              hint={`${d?.tenants?.active ?? 0} active`}
              icon={ShieldCheck}
            />
          </div>
        </div>
      </QueryState>
    </div>
  );
}
