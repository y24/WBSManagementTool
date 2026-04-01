import React from 'react';
import { createPortal } from 'react-dom';
import { InitialData } from '../types';
import { ResourceSubtask } from '../pages/mainboard/useResourceData';

interface GanttTooltipProps {
  item: any;
  itemType: 'project' | 'task' | 'subtask';
  mouseX: number;
  mouseY: number;
  initialData: InitialData | null;
  isVisible: boolean;
}

const GanttTooltip: React.FC<GanttTooltipProps> = ({
  item,
  itemType,
  mouseX,
  mouseY,
  initialData,
  isVisible
}) => {
  if (!isVisible || !item) return null;

  const getStatusName = (statusId: number | null | undefined) => {
    return initialData?.statuses.find(s => s.id === statusId)?.status_name || '-';
  };

  const getSubtaskTypeName = (typeId: number | null | undefined) => {
    return initialData?.subtask_types.find(t => t.id === typeId)?.type_name || '-';
  };

  const formatDate = (dateStr: string | null | undefined) => {
    return dateStr ? dateStr.split('T')[0] : '-';
  };

  // 表示項目の抽出
  const projectName = item.project_name || '-';
  const itemTypeLabel = itemType === 'subtask' 
    ? getSubtaskTypeName(item.subtask_type_id) 
    : (itemType === 'task' ? 'タスク' : 'プロジェクト');
  
  const detail = (itemType === 'subtask' ? item.subtask_detail : item.detail) || '-';
  const statusObj = initialData?.statuses.find(s => s.id === item.status_id);
  const statusName = statusObj?.status_name || '-';
  let statusColor = statusObj?.color_code || '#cbd5e1';
  if (!statusColor.startsWith('#')) statusColor = '#' + statusColor;

  const progress = item.progress_percent != null ? `${item.progress_percent}%` : null;
  
  // 工数の抽出 (Subtask は planned_effort_days, Project/Task は planned_effort_total)
  const pEffortValue = item.planned_effort_days ?? item.planned_effort_total;
  const aEffortValue = item.actual_effort_days ?? item.actual_effort_total;
  const pEffort = pEffortValue != null ? `${pEffortValue}日` : '-';
  const aEffort = aEffortValue != null ? `${aEffortValue}日` : '-';

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 text-[13px] min-w-[260px] text-slate-700 dark:text-slate-200 transition-opacity duration-200"
      style={{
        left: `${mouseX + 15}px`,
        top: `${mouseY + 15}px`,
      }}
    >
      <div className="space-y-2">
        <div>
          <div className="font-bold text-[14px] text-indigo-600 dark:text-indigo-400 truncate">
            {projectName}
          </div>
          {item.task_name && (
            <div className="font-medium truncate opacity-90 text-[13px]">
              {item.task_name}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-1.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-slate-900 dark:text-white text-[13px]">{itemTypeLabel}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold opacity-80 flex items-center gap-1">
              <span style={{ color: statusColor }}>●</span>
              {statusName}
              {progress && <span className="ml-1 opacity-60">({progress})</span>}
            </span>
          </div>
          
          {(itemType === 'subtask' ? item.subtask_detail : item.detail) && (
            <div className="text-slate-500 dark:text-slate-400 text-[12px] leading-relaxed break-words line-clamp-4">
              {itemType === 'subtask' ? item.subtask_detail : item.detail}
            </div>
          )}
          
          {item.assignee_id && (
            <div className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span>担当者:</span>
              <span className="text-slate-600 dark:text-slate-300">
                {initialData?.members.find(m => m.id === item.assignee_id)?.member_name || '-'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 mt-2 py-2 px-2.5 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-[11px]">予定工数</span>
            <span className="font-medium">{pEffort}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-[11px]">実績工数</span>
            <span className="font-medium">{aEffort}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GanttTooltip;
