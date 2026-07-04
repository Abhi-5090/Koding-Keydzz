import {
  Building2,
  CheckCircle2,
  Ban,
  UserCog,
  GraduationCap,
  Activity,
  CalendarClock,
  BookOpen,
  HelpCircle,
  Swords,
  Award,
  Shirt,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useGetSuperAnalyticsQuery } from '../../features/superadmin/superadminApi';
import StatCard from '../../components/ui/StatCard';
import ChartCard from '../../components/ui/ChartCard';
import PageHeader from '../../components/ui/PageHeader';
import QueryState from '../../components/ui/QueryState';

const tooltipStyle = {
  contentStyle: {
    background: "#04212E",
    border: '1px solid #FF602F29',
    borderRadius: 12,
    color: '#fff',
  },
  labelStyle: { color: "#9DB8C4" },
  itemStyle: { color: '#fff' },
};

const CONTENT_ITEMS = [
  { key: 'worlds', label: 'Worlds', icon: Layers },
  { key: 'lessons', label: 'Lessons', icon: BookOpen },
  { key: 'quizzes', label: 'Quizzes', icon: HelpCircle },
  { key: 'challenges', label: 'Challenges', icon: Swords },
  { key: 'achievements', label: 'Achievements', icon: Award },
  { key: 'avatarItems', label: 'Avatar Items', icon: Shirt },
];

export default function SuperAdminDashboard() {
  const { data, isError, isLoading, error, refetch } = useGetSuperAnalyticsQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        subtitle="Real-time insight across every organization on Koding Keydzz"
      />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!data}
        loadingLabel="Loading platform analytics…"
        emptyTitle="No analytics yet"
        emptyMessage="Analytics will appear once organizations and students are active."
      >
        {data && <Analytics a={data} />}
      </QueryState>
    </div>
  );
}

function Analytics({ a }) {
  const totals = a.totals || {};
  const activeUsers = a.activeUsers || {};
  const contentCounts = a.contentCounts || {};
  const studentGrowth = a.growth?.students || [];
  const orgGrowth = a.growth?.orgs || [];
  const studentsPerOrg = a.studentsPerOrg || [];
  const xpDistribution = a.xpDistribution || [];
  const levelDistribution = a.levelDistribution || [];
  const topOrgsByStudents = a.topOrgsByStudents || [];
  const topOrgsByXp = a.topOrgsByXp || [];

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard index={0} label="Total Orgs" value={(totals.orgs ?? 0).toLocaleString()} icon={Building2} />
        <StatCard index={1} label="Active Orgs" value={(totals.activeOrgs ?? 0).toLocaleString()} icon={CheckCircle2} />
        <StatCard index={2} label="Suspended Orgs" value={(totals.suspendedOrgs ?? 0).toLocaleString()} icon={Ban} />
        <StatCard index={3} label="Total Admins" value={(totals.admins ?? 0).toLocaleString()} icon={UserCog} />
        <StatCard index={4} label="Total Students" value={(totals.students ?? 0).toLocaleString()} icon={GraduationCap} />
        <StatCard index={5} label="Suspended Students" value={(totals.suspendedStudents ?? 0).toLocaleString()} icon={Ban} />
        <StatCard index={6} label="Active (7d)" value={(activeUsers.last7 ?? 0).toLocaleString()} icon={Activity} hint="students active last 7 days" />
        <StatCard index={7} label="Active (30d)" value={(activeUsers.last30 ?? 0).toLocaleString()} icon={CalendarClock} hint="students active last 30 days" />
      </div>

      {/* Content counts row */}
      {Object.keys(contentCounts).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CONTENT_ITEMS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="k-card flex items-center gap-3 p-4">
              <div className="rounded-xl bg-turmeric/15 p-2 text-turmeric">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-heading text-xl font-extrabold text-text-primary">
                  {(contentCounts[key] ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-text-secondary/70">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Growth charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {studentGrowth.length > 0 && (
          <ChartCard title="Student Growth" subtitle="New students over the last 6 months" index={0}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studentGrowth}>
                <defs>
                  <linearGradient id="stuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF602F" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#FF602F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="period" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#FF602F" strokeWidth={2} fill="url(#stuGrad)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {orgGrowth.length > 0 && (
          <ChartCard title="Organization Growth" subtitle="New organizations over the last 6 months" index={1}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={orgGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="period" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#FF6A3D" strokeWidth={3} dot={{ fill: "#FF602F", r: 4 }} activeDot={{ r: 6 }} animationDuration={1000} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {studentsPerOrg.length > 0 && (
          <ChartCard title="Students per Organization" subtitle="Distribution of learners across orgs" index={2}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentsPerOrg}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="org" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#FF602F14' }} />
                <Bar dataKey="students" fill="#FF602F" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {xpDistribution.length > 0 && (
          <ChartCard title="XP Distribution" subtitle="Students grouped by total XP earned" index={3}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={xpDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="bucket" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#FF602F14' }} />
                <Bar dataKey="count" fill="#2DD4BF" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {levelDistribution.length > 0 && (
          <ChartCard title="Level Distribution" subtitle="How many students sit at each level" index={4}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="level" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#FF602F14' }} />
                <Bar dataKey="count" fill="#5BC0BE" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {topOrgsByXp.length > 0 && (
          <ChartCard title="Top Orgs by XP" subtitle="Organizations whose students earned the most XP" index={5}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOrgsByXp} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" horizontal={false} />
                <XAxis type="number" stroke="#9DB8C4" fontSize={12} />
                <YAxis type="category" dataKey="org" stroke="#9DB8C4" fontSize={12} width={110} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#FF602F14' }} />
                <Bar dataKey="xp" fill="#FF6A3D" radius={[0, 6, 6, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Top orgs by students table */}
      {topOrgsByStudents.length > 0 && (
        <div className="k-card overflow-hidden">
          <div className="border-b border-k-border p-4">
            <h3 className="font-heading text-base font-bold text-text-primary">Top Organizations by Students</h3>
            <p className="text-xs text-text-secondary/70">Largest learning communities on the platform</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-k-border bg-malt/40 text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Students</th>
                </tr>
              </thead>
              <tbody>
                {topOrgsByStudents.map((o, i) => (
                  <tr key={o.code || o.org || i} className="border-b border-k-border/50 hover:bg-surface/40">
                    <td className="px-4 py-3 font-heading font-bold text-turmeric">#{i + 1}</td>
                    <td className="px-4 py-3 text-text-primary">{o.org}</td>
                    <td className="px-4 py-3 text-text-secondary/70">{o.code || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-turmeric">
                      {(o.students ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
