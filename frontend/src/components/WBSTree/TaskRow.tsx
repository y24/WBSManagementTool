import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle } from 'lucide-react';
import { Task } from '../../types/wbs';
import EditableInput from './EditableInput';
import { getWarning } from './utils';
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
  provided: any;
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
  provided 
}: TaskRowProps) => {
  const warning = getWarning(task);
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
          <span title={warning} className="cursor-help inline-flex">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          </span>
        )}
        <button
          onClick={onAddSubtask}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="サブタスクを追加"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className={`w-28 ${commonCellClasses}`}></div>
      <div className={`w-28 ${commonCellClasses}`}></div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={task.planned_start_date} onChange={(v: string) => onUpdateField('task', task.id, 'planned_start_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={task.planned_end_date} onChange={(v: string) => onUpdateField('task', task.id, 'planned_end_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={task.actual_start_date} onChange={(v: string) => onUpdateField('task', task.id, 'actual_start_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={task.actual_end_date} onChange={(v: string) => onUpdateField('task', task.id, 'actual_end_date', v)} />
      </div>
      <div className={`w-16 ${commonCellClasses}`}></div>
    </div>
  );
});

export default TaskRow;
