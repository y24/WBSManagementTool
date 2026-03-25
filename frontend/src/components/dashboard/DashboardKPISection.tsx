import { AlertCircle, AlertTriangle, Briefcase, Calendar, Clock } from 'lucide-react';
import { DashboardKPIs } from '../../types/dashboard';
import { KPICard } from './DashboardContainers';

interface DashboardKPISectionProps {
  kpis: DashboardKPIs;
}

export function DashboardKPISection({ kpis }: DashboardKPISectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <KPICard
        title="進行中プロジェクト数"
        value={kpis.ongoing_projects_count}
        icon={<Briefcase className="text-indigo-600 dark:text-indigo-400" size={24} />}
        gradient="from-indigo-500/5 to-white dark:from-indigo-900/40 dark:to-slate-900"
      />
      <KPICard
        title="着手遅延サブタスク数"
        value={kpis.start_delay_count}
        icon={<AlertCircle className="text-orange-600 dark:text-orange-400" size={24} />}
        gradient="from-orange-500/5 to-white dark:from-orange-900/40 dark:to-slate-900"
        highlight={kpis.start_delay_count > 0}
      />
      <KPICard
        title="期限超過サブタスク数"
        value={kpis.overdue_subtasks_count}
        icon={<AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />}
        gradient="from-rose-500/5 to-white dark:from-rose-900/40 dark:to-slate-900"
        highlight={kpis.overdue_subtasks_count > 0}
      />
      <KPICard
        title="レビュー開始遅延件数"
        value={kpis.review_delay_count}
        icon={<Clock className="text-amber-600 dark:text-amber-400" size={24} />}
        gradient="from-amber-500/5 to-white dark:from-amber-900/40 dark:to-slate-900"
        highlight={kpis.review_delay_count > 0}
      />
      <KPICard
        title="今週終了予定件数"
        value={kpis.this_week_end_count}
        icon={<Calendar className="text-emerald-600 dark:text-emerald-400" size={24} />}
        gradient="from-emerald-500/5 to-white dark:from-emerald-900/40 dark:to-slate-900"
      />
    </div>
  );
}

