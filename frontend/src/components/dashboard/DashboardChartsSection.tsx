import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardData } from '../../types/dashboard';
import { ChartContainer } from './DashboardContainers';
import { DASHBOARD_COLORS, DashboardChartTheme } from './constants';

interface DashboardChartsSectionProps {
  data: DashboardData;
  theme: DashboardChartTheme;
}

function getTooltipStyle(theme: DashboardChartTheme) {
  return {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: '8px',
      fontSize: '14px',
      color: theme.tooltipText,
    },
    itemStyle: { color: theme.tooltipText },
  };
}

export function DashboardChartsSection({ data, theme }: DashboardChartsSectionProps) {
  const tooltipStyle = getTooltipStyle(theme);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <ChartContainer title="プロジェクト別 進捗率">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.project_progress} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={theme.axisColor} fontSize={12} />
              <YAxis dataKey="project_name" type="category" stroke={theme.axisColor} fontSize={12} width={120} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="progress_percent" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      <ChartContainer title="担当者別の遅延件数">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.assignee_delays}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
              <XAxis dataKey="member_name" stroke={theme.axisColor} fontSize={12} />
              <YAxis stroke={theme.axisColor} fontSize={12} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="delay_count" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      <ChartContainer title="ステータス別サブタスク件数">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.status_counts}
                dataKey="count"
                nameKey="status_name"
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
              >
                {data.status_counts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color_code || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  );
}

export function DashboardAnalyticsChartsSection({ data, theme }: DashboardChartsSectionProps) {
  const tooltipStyle = getTooltipStyle(theme);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <ChartContainer title="プロジェクト別 予定工数 vs 実績工数 (TOP5)">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.project_effort} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
              <XAxis dataKey="project_name" stroke={theme.axisColor} fontSize={12} />
              <YAxis stroke={theme.axisColor} fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar name="予定工数" dataKey="planned_effort" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar name="実績工数" dataKey="actual_effort" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      <ChartContainer title="完了済みタスクの見積精度推移">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.estimate_accuracy_trend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
              <XAxis dataKey="period" stroke={theme.axisColor} fontSize={12} />
              <YAxis stroke={theme.axisColor} fontSize={12} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Line
                name="平均乖離率"
                type="monotone"
                dataKey="avg_deviation_rate"
                stroke="#f43f5e"
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>
    </div>
  );
}
