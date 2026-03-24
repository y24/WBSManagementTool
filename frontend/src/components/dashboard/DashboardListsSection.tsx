import { forwardRef } from 'react';
import { Briefcase, ChevronDown, ChevronRight, ChevronUp, Clock } from 'lucide-react';
import { DashboardData } from '../../types/dashboard';
import { ListContainer } from './DashboardContainers';

interface DashboardListsSectionProps {
  data: DashboardData;
}

export function DashboardListsSection({ data }: DashboardListsSectionProps) {
  return (
    <>
      <ListContainer title="レビュー遅延サブタスク" subtitle="レビュー開始の遅延、またはレビュー期間の超過">
        <div className="space-y-3 mt-4">
          {data.review_delays.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-base font-medium italic bg-white dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              現在、レビュー遅延サブタスクはありません。
            </div>
          ) : (
            data.review_delays.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-amber-500/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 opacity-50"></div>
                <div className="space-y-1 ml-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[150px] truncate">
                      {subtask.task_name}
                    </span>
                    <ChevronRight size={12} className="text-slate-300 dark:text-slate-700" />
                    <span className="text-base font-bold text-slate-700 dark:text-slate-200">{subtask.subtask_detail}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} /> {subtask.assignee_name || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {subtask.review_start_date ? (
                        `開始: ${subtask.review_start_date}`
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold italic">未開始 (開始期限超過)</span>
                      )}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">枠: {subtask.review_days}日</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-base font-black text-amber-600 dark:text-amber-500">+{subtask.delay_days.toFixed(1)}d</div>
                  <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded">
                    {subtask.progress_percent}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ListContainer>

      <ListContainer title="今週終了予定・低進捗サブタスク" subtitle="終了予定が今週だが進捗50%未満">
        <div className="space-y-3 mt-4">
          {data.low_progress_soon_to_finish.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-base font-medium italic bg-white dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              現在、対象となるサブタスクはありません。
            </div>
          ) : (
            data.low_progress_soon_to_finish.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none hover:border-rose-500/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 opacity-50"></div>
                <div className="space-y-1 ml-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[150px] truncate">
                      {subtask.task_name}
                    </span>
                    <ChevronRight size={12} className="text-slate-300 dark:text-slate-700" />
                    <span className="text-base font-bold text-slate-700 dark:text-slate-200">{subtask.subtask_detail}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span className="text-rose-600 dark:text-rose-400 font-medium italic">Due: {subtask.planned_end_date}</span>
                    <span>Assignee: {subtask.assignee_name || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                      style={{ width: `${subtask.progress_percent}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-black text-rose-600 dark:text-rose-400 w-10 text-right tracking-tighter">
                    {subtask.progress_percent}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ListContainer>
    </>
  );
}

interface AssigneeSummarySectionProps {
  assigneeSummary: DashboardData['assignee_summary'];
  showAllAssignees: boolean;
  onToggle: () => void;
}

export const AssigneeSummarySection = forwardRef<HTMLDivElement, AssigneeSummarySectionProps>(
  ({ assigneeSummary, showAllAssignees, onToggle }, ref) => {
    const rows = showAllAssignees ? assigneeSummary : assigneeSummary.slice(0, 5);

    return (
      <div ref={ref}>
        <ListContainer title="担当者別 負荷・レベル状況">
          <div className="overflow-x-auto mt-4 px-1">
            <table className="w-full text-base text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="pb-4 px-1">Member</th>
                  <th className="pb-4 px-1 text-center">Total</th>
                  <th className="pb-4 px-1 text-center">ThisWk</th>
                  <th className="pb-4 px-1 text-center text-rose-500/80">Delay</th>
                  <th className="pb-4 px-1 text-center text-indigo-400/80">Run</th>
                  <th className="pb-4 px-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {rows.map((member) => (
                  <tr key={member.member_name} className="hover:bg-indigo-500/5 transition-colors group">
                    <td className="py-4 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                          {member.member_name.substring(0, 1)}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate max-w-[80px]">
                          {member.member_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-1 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">{member.total_count}</td>
                    <td className="py-4 px-1 text-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                      {member.this_week_end_count}
                    </td>
                    <td
                      className={`py-4 px-1 text-center font-black text-sm ${
                        member.overdue_count > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    >
                      {member.overdue_count}
                    </td>
                    <td className="py-4 px-1 text-center font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {member.concurrent_count}
                    </td>
                    <td className="py-4 px-1 text-right">
                      <div className="flex items-center justify-end">
                        {member.overdue_count > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-500 text-[9px] font-black border border-rose-500/20">
                            OVLD
                          </span>
                        ) : member.concurrent_count > 3 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[9px] font-black border border-amber-500/20">
                            CAUT
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[9px] font-black border border-emerald-500/20">
                            STBL
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assigneeSummary.length > 5 && (
            <button
              onClick={onToggle}
              className="mt-6 w-full py-3 flex items-center justify-center gap-2 text-sm font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 rounded-xl border border-indigo-500/10 transition-all group"
            >
              {showAllAssignees ? (
                <>
                  一部を表示 <ChevronUp size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                </>
              ) : (
                <>
                  すべて表示 <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                </>
              )}
            </button>
          )}
        </ListContainer>
      </div>
    );
  },
);

AssigneeSummarySection.displayName = 'AssigneeSummarySection';

interface DashboardInsightsSectionProps {
  data: DashboardData;
}

export function DashboardInsightsSection({ data }: DashboardInsightsSectionProps) {
  return (
    <>
      <ListContainer title="タスク別 工数乖離率" subtitle="乖離の大きいタスク上位10件">
        <div className="space-y-3 mt-4">
          {data.task_deviations.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic">データがありません。</div>
          ) : (
            data.task_deviations.map((task, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-500/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">{task.project_name}</span>
                    <ChevronRight size={12} className="text-slate-300" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{task.task_name}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex gap-3">
                    <span>予定: {task.planned_effort}d</span>
                    <span>実績: {task.actual_effort}d</span>
                  </div>
                </div>
                <div
                  className={`text-right font-black text-lg ${
                    task.deviation_rate > 20
                      ? 'text-rose-600'
                      : task.deviation_rate < -20
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}
                >
                  {task.deviation_rate > 0 ? '+' : ''}
                  {task.deviation_rate.toFixed(1)}%
                </div>
              </div>
            ))
          )}
        </div>
      </ListContainer>

      <ListContainer title="担当者別 見積誤差傾向" subtitle="平均的な工数乖離率（実績 vs 予定）">
        <div className="space-y-3 mt-4">
          {data.assignee_estimate_errors.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic">データがありません。</div>
          ) : (
            data.assignee_estimate_errors.map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-black">
                    {member.member_name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{member.member_name}</div>
                    <div className="text-xs text-slate-500">{member.task_count} tasks analyzed</div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-black ${Math.abs(member.avg_deviation_rate) > 15 ? 'text-rose-600' : 'text-emerald-600'}`}
                  >
                    {member.avg_deviation_rate > 0 ? '+' : ''}
                    {member.avg_deviation_rate.toFixed(1)}%
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Dev</div>
                </div>
              </div>
            ))
          )}
        </div>
      </ListContainer>
    </>
  );
}
