import React, { memo } from 'react';
import { GripVertical, AlertTriangle, Pencil, ExternalLink, MessageSquare } from 'lucide-react';
import { Subtask } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses } from './constants';

interface SubtaskRowProps {
  subtask: Subtask;
  nameWidth: number;
  checked: boolean;
  onToggleCheck: () => void;
  initialData: InitialData | null;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onEditDetail: () => void;
  provided: any;
  hidePlanningColumns?: boolean;
}

const SubtaskRow = memo(({
  subtask,
  nameWidth,
  checked,
  onToggleCheck,
  initialData,
  onUpdateField,
  onEditDetail,
  provided,
  hidePlanningColumns = false
}: SubtaskRowProps) => {
  const warning = getWarning(subtask, initialData);
  const statusName = initialData?.statuses.find(s => s.id === subtask.status_id)?.status_name;
  const isOngoing = statusName === 'In Progress' || statusName === 'In Review';

  const [localProgress, setLocalProgress] = React.useState<number | null>(subtask.progress_percent ?? null);

  React.useEffect(() => {
    setLocalProgress(subtask.progress_percent ?? null);
  }, [subtask.progress_percent]);

  const getHighlight = (field: string, value: any) =>
    shouldHighlightField('subtask', field, value, subtask, initialData);

  return (
    <div className={`flex group wbs-row-subtask ${commonRowClasses}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 pl-12 text-gray-600 dark:text-slate-400 wbs-cell-subtask transition-colors ${commonCellClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <PortalSelect
            value={subtask.subtask_type_id}
            options={initialData?.subtask_types.map(t => ({ id: t.id, name: t.type_name })) || []}
            onChange={v => onUpdateField('subtask', subtask.id, 'subtask_type_id', v)}
            className="font-semibold text-gray-700 dark:text-slate-300 -ml-1"
            placeholder="未設定"
            dropdownTitle="種別を変更"
            highlight={getHighlight('subtask_type_id', subtask.subtask_type_id)}
          />
          <span className="text-gray-400 dark:text-slate-500 text-xs truncate" title={subtask.subtask_detail || undefined}>
            {subtask.subtask_detail}
          </span>
          {warning && (
            <span title={warning} className="cursor-help inline-flex shrink-0">
              <AlertTriangle size={14} className="text-amber-500" />
            </span>
          )}
          {subtask.memo && (
            <span title={subtask.memo} className="cursor-help inline-flex items-center text-blue-400 hover:text-blue-600 shrink-0 mx-0.5" onClick={onEditDetail}>
              <MessageSquare size={14} />
            </span>
          )}
          {subtask.ticket_id && initialData?.ticket_url_template && (
            <a
              href={initialData.ticket_url_template.replace('{TICKET_ID}', String(subtask.ticket_id))}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0 p-0.5"
              title={`チケットを開く (#${subtask.ticket_id})`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <button
          onClick={onEditDetail}
          className="text-gray-300 hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          title="詳細を編集"
        >
          <Pencil size={14} />
        </button>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <StatusSelect
          type="subtask"
          id={subtask.id}
          statusId={subtask.status_id}
          initialData={initialData}
          onUpdateField={onUpdateField}
        />
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <PortalSelect
          value={subtask.assignee_id}
          options={[
            { id: null, name: '未設定' },
            ...(initialData?.members.map(m => ({ id: m.id, name: m.member_name })) || [])
          ]}
          onChange={v => onUpdateField('subtask', subtask.id, 'assignee_id', v)}
          className="w-full text-sm"
          placeholder="未設定"
          dropdownTitle="担当者を変更"
          highlight={getHighlight('assignee_id', subtask.assignee_id)}
        />
      </div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 ${commonCellClasses}`}>
            <EditableInput
              type="number"
              value={subtask.review_days}
              onChange={(v: number | null) => onUpdateField('subtask', subtask.id, 'review_days', v)}
              min={0}
              step={0.5}
              precision={1}
              suffix="日"
              highlight={getHighlight('review_days', subtask.review_days)}
            />
          </div>
          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_start_date} max={subtask.planned_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_start_date', v)} highlight={getHighlight('planned_start_date', subtask.planned_start_date)} /></div>
          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_end_date} min={subtask.planned_start_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_end_date', v)} highlight={getHighlight('planned_end_date', subtask.planned_end_date)} /></div>
          <div className={`w-16 ${dateCellClasses}`}>
            <EditableInput
              type="number"
              value={subtask.planned_effort_days}
              onChange={(v: any) => onUpdateField('subtask', subtask.id, 'planned_effort_days', v)}
              min={0}
              step={0.1}
              precision={1}
              isAuto={subtask.is_auto_effort}
              onToggleAuto={(v: boolean) => onUpdateField('subtask', subtask.id, 'is_auto_effort', v)}
              highlight={getHighlight('planned_effort_days', subtask.planned_effort_days)}
            />
          </div>
        </>
      )}
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_start_date} max={subtask.actual_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_start_date', v)} highlight={getHighlight('actual_start_date', subtask.actual_start_date)} /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.review_start_date} min={subtask.actual_start_date} max={subtask.actual_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'review_start_date', v)} highlight={getHighlight('review_start_date', subtask.review_start_date)} /></div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput
          type="date"
          value={subtask.actual_end_date}
          min={subtask.actual_start_date}
          onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_end_date', v)}
          highlight={getHighlight('actual_end_date', subtask.actual_end_date)}
          className={isOngoing ? "bg-yellow-100/90 dark:bg-yellow-900/40" : ""}
        />
      </div>
      <div className={`w-16 ${dateCellClasses}`}>
        <EditableInput
          type="number"
          value={subtask.actual_effort_days}
          onChange={(v: any) => onUpdateField('subtask', subtask.id, 'actual_effort_days', v)}
          min={0}
          step={0.1}
          precision={1}
          isAuto={subtask.is_auto_effort}
          onToggleAuto={(v: boolean) => onUpdateField('subtask', subtask.id, 'is_auto_effort', v)}
          highlight={getHighlight('actual_effort_days', subtask.actual_effort_days)}
        />
      </div>
      <div className={`w-24 ${dateCellClasses} overflow-hidden`}>
        {(localProgress != null) && (
          <div 
            className="absolute top-0 left-0 h-full bg-green-500/20 dark:bg-green-500/30 transition-all duration-300 pointer-events-none"
            style={{ width: `${localProgress}%` }}
          />
        )}
        <div className="relative z-10 w-full h-full flex items-center">
          <EditableInput
            type="number"
            value={subtask.progress_percent}
            onChange={(v: any) => onUpdateField('subtask', subtask.id, 'progress_percent', v)}
            onInputChange={(v: number | null) => setLocalProgress(v)}
            min={0}
            max={100}
            suffix="%"
            autoPercent={true}
          />
        </div>
      </div>
    </div>
  );
});


export default SubtaskRow;
