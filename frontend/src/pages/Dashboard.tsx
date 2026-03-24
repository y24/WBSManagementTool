import { useEffect, useState } from 'react';
import { wbsOps } from '../api/wbsOperations';
import { DashboardData } from '../types/dashboard';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Briefcase, Clock, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await wbsOps.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  const chartGridColor = isDark ? '#334155' : '#e2e8f0';
  const chartAxisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const tooltipText = isDark ? '#e2e8f0' : '#1e293b';

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-full text-slate-700 dark:text-slate-200 overflow-y-auto transition-colors duration-300">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Dashboard
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">WBS Analytics</span>
        </h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="進行中プロジェクト数" 
          value={data.kpis.ongoing_projects_count} 
          icon={<Briefcase className="text-indigo-600 dark:text-indigo-400" size={24} />}
          gradient="from-indigo-500/5 to-white dark:from-indigo-900/40 dark:to-slate-900"
        />
        <KPICard 
          title="期限超過サブタスク数" 
          value={data.kpis.overdue_subtasks_count} 
          icon={<AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />}
          gradient="from-rose-500/5 to-white dark:from-rose-900/40 dark:to-slate-900"
          highlight={data.kpis.overdue_subtasks_count > 0}
        />
        <KPICard 
          title="レビュー開始遅延件数" 
          value={data.kpis.review_delay_count} 
          icon={<Clock className="text-amber-600 dark:text-amber-400" size={24} />}
          gradient="from-amber-500/5 to-white dark:from-amber-900/40 dark:to-slate-900"
          highlight={data.kpis.review_delay_count > 0}
        />
        <KPICard 
          title="今週終了予定件数" 
          value={data.kpis.this_week_end_count} 
          icon={<Calendar className="text-emerald-600 dark:text-emerald-400" size={24} />}
          gradient="from-emerald-500/5 to-white dark:from-emerald-900/40 dark:to-slate-900"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <ChartContainer title="プロジェクト別 進捗率">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.project_progress} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke={chartAxisColor} fontSize={10} />
                <YAxis dataKey="project_name" type="category" stroke={chartAxisColor} fontSize={10} width={100} />
                <Tooltip 
                    contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', fontSize: '12px', color: tooltipText }}
                    itemStyle={{ color: tooltipText }}
                />
                <Bar dataKey="progress_percent" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        <ChartContainer title="担当者別の遅延件数">
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.assignee_delays}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="member_name" stroke={chartAxisColor} fontSize={10} />
                <YAxis stroke={chartAxisColor} fontSize={10} />
                <Tooltip 
                    contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', fontSize: '12px', color: tooltipText }}
                    itemStyle={{ color: tooltipText }}
                />
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
                    <Cell key={`cell-${index}`} fill={entry.color_code || COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', fontSize: '12px', color: tooltipText }}
                  itemStyle={{ color: tooltipText }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-8">
        <div className="space-y-8">
          <ListContainer title="レビュー遅延サブタスク TOP5" subtitle="レビュー開始しているが、予定日数を超過">
            <div className="space-y-3 mt-4">
              {data.review_delays_top5.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium italic bg-white dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  現在、レビュー遅延サブタスクはありません。
                </div>
              ) : (
                data.review_delays_top5.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-amber-500/30 transition-all group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 opacity-50"></div>
                    <div className="space-y-1 ml-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[120px] truncate">{s.task_name}</span>
                        <ChevronRight size={10} className="text-slate-300 dark:text-slate-700" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.subtask_detail}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Briefcase size={10}/> {s.assignee_name || '-'}</span>
                        <span className="flex items-center gap-1"><Clock size={10}/> 開始: {s.review_start_date}</span>
                        <span className="text-slate-400 dark:text-slate-500">枠: {s.review_days}日</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-sm font-black text-amber-600 dark:text-amber-500">+{s.delay_days.toFixed(1)}d</div>
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">{s.progress_percent}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ListContainer>

          <ListContainer title="今週終了予定・低進捗サブタスク" subtitle="終了予定が今週だが進捗50%未満">
            <div className="space-y-3 mt-4">
              {data.low_progress_soon_to_finish.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium italic bg-white dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  現在、対象となるサブタスクはありません。
                </div>
              ) : (
                data.low_progress_soon_to_finish.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-rose-500/30 transition-all group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 opacity-50"></div>
                    <div className="space-y-1 ml-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[120px] truncate">{s.task_name}</span>
                        <ChevronRight size={10} className="text-slate-300 dark:text-slate-700" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.subtask_detail}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        <span className="text-rose-600 dark:text-rose-400 font-medium italic">Due: {s.planned_end_date}</span>
                        <span>Assignee: {s.assignee_name || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" style={{ width: `${s.progress_percent}%` }}></div>
                      </div>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 w-8 text-right tracking-tighter">{s.progress_percent}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ListContainer>
        </div>

        <ListContainer title="担当者別 負荷・レベル状況">
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="pb-4 px-2">Member</th>
                  <th className="pb-4 px-2 text-center">Total</th>
                  <th className="pb-4 px-2 text-center">ThisWk</th>
                  <th className="pb-4 px-2 text-center text-rose-500/80">Delays</th>
                  <th className="pb-4 px-2 text-center text-indigo-400/80">Ongoing</th>
                  <th className="pb-4 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.assignee_summary.map((m) => (
                  <tr key={m.member_name} className="hover:bg-indigo-500/5 transition-colors group">
                    <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                {m.member_name.substring(0, 1)}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{m.member_name}</span>
                        </div>
                    </td>
                    <td className="py-4 px-2 text-center text-slate-500 dark:text-slate-400 font-medium">{m.total_count}</td>
                    <td className="py-4 px-2 text-center font-bold text-slate-700 dark:text-slate-200">{m.this_week_end_count}</td>
                    <td className={`py-4 px-2 text-center font-black ${m.overdue_count > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-300 dark:text-slate-700'}`}>{m.overdue_count}</td>
                    <td className="py-4 px-2 text-center font-black text-indigo-600 dark:text-indigo-400">{m.concurrent_count}</td>
                    <td className="py-4 px-2 text-right">
                       <div className="flex items-center justify-end gap-1">
                          {m.overdue_count > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-500 text-[9px] font-black border border-rose-500/20 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.1)]">OVERLOAD</span>
                          ) : m.concurrent_count > 3 ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[9px] font-black border border-amber-500/20">CAUTION</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[9px] font-black border border-emerald-500/20">STABLE</span>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListContainer>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, gradient, highlight = false }: any) {
  return (
    <div className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br shadow-sm dark:shadow-none ${gradient} border ${highlight ? 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20' : 'border-slate-200 dark:border-slate-800'} backdrop-blur-xl group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1`}>
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-xl ${highlight ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-700/50'} shadow-sm`}>
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <p className="text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
          {value}<span className="text-sm font-bold text-slate-400 dark:text-slate-500 ml-2 tracking-normal uppercase">{title.includes('数') || title.includes('件') ? 'items' : ''}</span>
        </p>
      </div>
    </div>
  );
}

function ChartContainer({ title, children }: any) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm dark:shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-8 uppercase tracking-[0.3em] flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ListContainer({ title, subtitle, children }: any) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm dark:shadow-2xl h-full relative group">
      <div className="mb-6 flex justify-between items-end">
        <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
            {subtitle && <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.1em] mt-1.5 opacity-80">{subtitle}</p>}
        </div>
        <div className="w-8 h-1 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
      </div>
      {children}
    </div>
  );
}

