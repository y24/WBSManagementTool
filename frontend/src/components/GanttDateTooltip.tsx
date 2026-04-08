import React from 'react';
import { createPortal } from 'react-dom';
import { InitialData } from '../types';
import { Subtask } from '../types/wbs';

interface GanttDateTooltipProps {
  date: string;
  subtasks: (Subtask & { project_name: string; task_name: string })[];
  mouseX: number;
  mouseY: number;
  initialData: InitialData | null;
  isVisible: boolean;
}

const GanttDateTooltip: React.FC<GanttDateTooltipProps> = ({
  date,
  subtasks,
  mouseX,
  mouseY,
  initialData,
  isVisible
}) => {
  if (!isVisible || subtasks.length === 0) return null;

  const getStatusColor = (statusId: number | null | undefined) => {
    const status = initialData?.statuses.find(s => s.id === statusId);
    let color = status?.color_code || '#cbd5e1';
    if (!color.startsWith('#')) color = '#' + color;
    return color;
  };

  const getSubtaskTypeName = (typeId: number | null | undefined) => {
    return initialData?.subtask_types.find(t => t.id === typeId)?.type_name || '未設定';
  };

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-2xl rounded-xl overflow-hidden min-w-[300px] text-slate-700 dark:text-slate-200 transition-all duration-200 animate-in fade-in zoom-in duration-150"
      style={{
        left: `${mouseX + 15}px`,
        top: `${mouseY + 15}px`,
      }}
    >
      <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
        <span className="font-bold text-[13px] text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {date} のタスク
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          {subtasks.length} 件
        </span>
      </div>
      
      <div className="p-3 space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar">
        {subtasks.map((subtask, idx) => {
          const statusColor = getStatusColor(subtask.status_id);
          const typeName = getSubtaskTypeName(subtask.subtask_type_id);
          const assigneeName = initialData?.members.find(m => m.id === subtask.assignee_id)?.member_name;

          return (
            <div key={`${subtask.id}-${idx}`} className="group relative pl-3 transition-all">
              {/* ステータスインジケーター線 */}
              <div 
                className="absolute left-0 top-1 bottom-1 w-1 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" 
                style={{ backgroundColor: statusColor }}
              />
              
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                      {subtask.project_name} 
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate -mt-0.5">
                      {subtask.task_name}
                    </span>
                  </div>
                  {assigneeName && (
                    <div className="flex items-center gap-1 shrink-0 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {assigneeName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span 
                    className="shrink-0 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight border shadow-sm transition-colors"
                    style={{ 
                      backgroundColor: `${statusColor}15`, 
                      color: statusColor,
                      borderColor: `${statusColor}40`
                    }}
                  >
                    {typeName}
                  </span>
                  <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate" title={subtask.subtask_detail || undefined}>
                    {subtask.subtask_detail || '詳細なし'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

export default GanttDateTooltip;
