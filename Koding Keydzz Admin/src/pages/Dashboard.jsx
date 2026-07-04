import { Users, UserCheck, Target, Zap } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useGetStatsQuery } from '../features/admin/adminApi';
import StatCard from '../components/ui/StatCard';
import ChartCard from '../components/ui/ChartCard';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';

// Categorical palette woven from the two brand anchors: hot oranges + cool teals
// + cool neutral. Lead with primary #FF602F.
const PIE_COLORS = ['#FF602F', '#FF6A3D', '#2DD4BF', '#5BC0BE', '#9DB8C4'];

const tooltipStyle = {
  contentStyle: {
    background: '#04212E',
    border: '1px solid #FF602F29',
    borderRadius: 12,
    color: '#fff',
  },
  labelStyle: { color: '#9DB8C4' },
  itemStyle: { color: '#fff' },
};

export default function Dashboard() {
  const { data, isError, isLoading, error, refetch } = useGetStatsQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview & learning analytics"
      />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={!data}
        loadingLabel="Loading analytics…"
        emptyTitle="No analytics yet"
        emptyMessage="Stats will appear here once students start learning."
      >
        {data && <DashboardContent stats={data} />}
      </QueryState>
    </div>
  );
}

function DashboardContent({ stats }) {
  const xpDistribution = stats.xpDistribution || [];
  const growth = stats.growth || [];
  const completionTrend = stats.completionTrend || [];
  const worldDistribution = stats.worldDistribution || [];
  const retention = stats.retention || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Total Students"
          value={(stats.totalStudents ?? 0).toLocaleString()}
          icon={Users}
        />
        <StatCard
          index={1}
          label="Active Students"
          value={(stats.activeStudents ?? 0).toLocaleString()}
          icon={UserCheck}
          hint="last 7 days"
        />
        <StatCard
          index={2}
          label="Completion Rate"
          value={`${stats.completionRate ?? 0}%`}
          icon={Target}
          hint="avg across courses"
        />
        <StatCard
          index={3}
          label="Avg XP"
          value={(stats.avgXp ?? 0).toLocaleString()}
          icon={Zap}
          hint="per student"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {xpDistribution.length > 0 && (
          <ChartCard
            title="XP Distribution"
            subtitle="Students grouped by total XP earned"
            index={0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={xpDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="range" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#FF602F14' }} />
                <Bar
                  dataKey="students"
                  fill="#FF602F"
                  radius={[6, 6, 0, 0]}
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {growth.length > 0 && (
          <ChartCard
            title="Student Growth"
            subtitle="New enrollments over time"
            index={1}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="month" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="students"
                  stroke="#FF6A3D"
                  strokeWidth={3}
                  dot={{ fill: "#FF602F", r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {completionTrend.length > 0 && (
          <ChartCard
            title="Completion Trend"
            subtitle="Weekly average completion rate"
            index={2}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={completionTrend}>
                <defs>
                  <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF602F" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#FF602F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="week" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#FF602F"
                  strokeWidth={2}
                  fill="url(#compGrad)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {worldDistribution.length > 0 && (
          <ChartCard
            title="World Distribution"
            subtitle="Where students are currently learning"
            index={3}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={worldDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  paddingAngle={3}
                  animationDuration={900}
                  label={({ value }) => `${value}`}
                >
                  {worldDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#04212E" />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#9DB8C4" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {retention.length > 0 && (
          <ChartCard
            title="Active & Returning"
            subtitle="Daily active vs returning students (last 7 days)"
            index={4}
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retention}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FF602F29" vertical={false} />
                <XAxis dataKey="day" stroke="#9DB8C4" fontSize={12} />
                <YAxis stroke="#9DB8C4" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#9DB8C4" }} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="active"
                  name="Active"
                  stroke="#FF602F"
                  strokeWidth={3}
                  dot={{ fill: "#FF602F", r: 3 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
                <Line
                  type="monotone"
                  dataKey="returning"
                  name="Returning"
                  stroke="#2DD4BF"
                  strokeWidth={3}
                  dot={{ fill: '#2DD4BF', r: 3 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
