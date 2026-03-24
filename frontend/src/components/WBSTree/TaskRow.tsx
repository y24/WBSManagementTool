import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle, Pencil, ExternalLink, MessageSquare } from 'lucide-react';
import { Task } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, getDisabledStatusIds, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses } from './constants';

interface TaskRowProps {
  task: Task;
  nameWidth: number;
  checked: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  expanded: boolean;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onAddSubtask: () => void;
  onEditDetail: () => void;
  initialData: InitialData | null;
  provided: any;
  hidePlanningColumns?: boolean;
}

const TaskRow = memo(({ 
  task, 
  nameWidth, 
  checked, 
  onToggleCheck, 
  onToggleExpand, 
  expanded, 
  onUpdateField, 
  onAddSubtask, 
  onEditDetail,
  initialData,
  provided,
  hidePlanningColumns = false
}: TaskRowProps) => {
  const warning = getWarning(task);

  const getHighlight = (field: string, value: any) => 
    shouldHighlightField('task', field, value, task, initialData);

  return (
    <div className={`flex group wbs-row-task ${commonRowClasses}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 font-medium pl-6 text-gray-700 wbs-cell-task transition-colors ${commonCellClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
          <GripVertical size={14} />
        </div>
        <button onClick={onToggleExpand} className="p-0.5 hover:bg-gray-200 rounded">
          {expanded === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <EditableInput value={task.task_name} onChange={(v: string) => onUpdateField('task', task.id, 'task_name', v)} className="font-medium" />
        </div>
        {warning && (
          <span title={warning} className="cursor-help inline-flex shrink-0">
            <AlertTriangle size={14} className="text-amber-500" />
          </span>
        )}
        {task.memo && (
          <span title={task.memo} className="cursor-help inline-flex items-center text-blue-400 hover:text-blue-600 shrink-0 mx-0.5" onClick={onEditDetail}>
            <MessageSquare size={14} />
          </span>
        )}
        {task.ticket_id && initialData?.ticket_url_template && (
          <a
            href={initialData.ticket_url_template.replace('{TICKET_ID}', String(task.ticket_id))}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0 p-0.5"
            title={`チケットを開く (#${task.ticket_id})`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
          </a>
        )}
        <button
          onClick={onEditDetail}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="詳細・メモを編集"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onAddSubtask}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="サブタスクを追加"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <StatusSelect 
          type="task"
          id={task.id}
          statusId={task.status_id}
          initialData={initialData} 
          onUpdateField={onUpdateField} 
          disabledStatusIds={getDisabledStatusIds('task', task, initialData)}
        />
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <PortalSelect
          value={task.assignee_id}
          options={[
            { id: null, name: '未設定' },
            ...(initialData?.members.map(m => ({ id: m.id, name: m.member_name })) || [])
          ]}
          onChange={(v: number | null) => onUpdateField('task', task.id, 'assignee_id', v)}
          className="w-full text-sm"
          placeholder="未設定"
          dropdownTitle="担当者を変更"
          highlight={getHighlight('assignee_id', task.assignee_id)}
        />
      </div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 ${commonCellClasses}`}></div>
          <div className={`w-20 ${dateCellClasses}`}>
            <EditableInput 
              type="date" 
              value={task.planned_start_date} 
              max={task.planned_end_date}
              onChange={(v: string) => onUpdateField('task', task.id, 'planned_start_date', v)} 
              isAuto={task.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_planned_date', v)}
            />
          </div>
          <div className={`w-20 ${dateCellClasses}`}>
            <EditableInput 
              type="date" 
              value={task.planned_end_date} 
              min={task.planned_start_date}
              onChange={(v: string) => onUpdateField('task', task.id, 'planned_end_date', v)} 
              isAuto={task.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_planned_date', v)}
            />
          </div>
          <div className={`w-16 ${dateCellClasses}`}>
            <EditableInput 
              type="number" 
              value={task.planned_effort_total} 
              precision={1} 
              readOnly={true} 
              isAuto={true} 
            />
          </div>
        </>
      )}
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={task.actual_start_date} 
          max={task.actual_end_date}
          onChange={(v: string) => onUpdateField('task', task.id, 'actual_start_date', v)} 
          isAuto={task.is_auto_actual_date}
          onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_actual_date', v)}
          highlight={getHighlight('actual_start_date', task.actual_start_date)}
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}></div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={task.actual_end_date} 
          min={task.actual_start_date}
          onChange={(v: string) => onUpdateField('task', task.id, 'actual_end_date', v)} 
          isAuto={task.is_auto_actual_date}
          onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_actual_date', v)}
          highlight={getHighlight('actual_end_date', task.actual_end_date)}
        />
      </div>
      <div className={`w-16 ${dateCellClasses}`}>
        <EditableInput 
          type="number" 
          value={task.actual_effort_total} 
          precision={1} 
          readOnly={true} 
          isAuto={true} 
        />
      </div>
      <div className={`w-16 ${commonCellClasses}`}></div>
    </div>
  );
});


export default TaskRow;
