import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle, Pencil, ExternalLink, Link, MessageSquare } from 'lucide-react';
import { Task } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, getDisabledStatusIds, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses, planningCellClasses } from './constants';

interface TaskRowProps {
  task: Task;
  nameWidth: number;
  assigneeWidth: number;
  checked: boolean;
  onToggleCheck: (task: Task, isShift?: boolean) => void;
  onToggleExpand: (id: number) => void;
  expanded: boolean;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onAddSubtask: (id: number) => void;
  onEditDetail: (type: 'task', data: Task) => void;
  initialData: InitialData | null;
  provided: any;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
  focusedField?: string | null;
  onFocusChange?: (rowId: string, field: string) => void;
  onEditingChange?: (editing: boolean) => void;
  isEditing?: boolean;
  onTabNavigation?: (direction: 'next' | 'prev') => void;
}

const TaskRow = memo(({ 
  task, 
  nameWidth, 
  assigneeWidth,
  checked, 
  onToggleCheck, 
  onToggleExpand, 
  expanded, 
  onUpdateField, 
  onAddSubtask, 
  onEditDetail,
  initialData,
  provided,
  hidePlanningColumns = false,
  isPlanningMode = false,
  focusedField,
  onFocusChange,
  onEditingChange,
  isEditing: isGlobalEditingByParent,
  onTabNavigation
}: TaskRowProps) => {
  const warning = getWarning(task, initialData);

  const getHighlight = (field: string, value: any) => 
    shouldHighlightField('task', field, value, task, initialData);

  return (
    <div className={`flex group wbs-row-task ${commonRowClasses} ${checked ? 'checked' : ''}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 font-medium pl-6 text-gray-700 dark:text-slate-200 wbs-cell-task transition-colors ${commonCellClasses} ${checked ? 'checked' : 'bg-white dark:bg-slate-900'}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => onToggleCheck(task, e.shiftKey)}
          onChange={() => {}}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400">
          <GripVertical size={14} />
        </div>
        <button onClick={() => onToggleExpand(task.id)} className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors">
          {expanded === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {warning && (
          <span title={warning} className="cursor-help inline-flex shrink-0">
            <AlertTriangle size={14} className="text-amber-500" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <EditableInput 
            value={task.task_name} 
            onChange={(v: string) => onUpdateField('task', task.id, 'task_name', v)} 
            className="font-medium" 
            isFocused={focusedField === 'name'}
            onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'name')}
            onEditingChange={onEditingChange}
            onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
            isEditing={isGlobalEditingByParent}
          />
        </div>

        {task.link_url && (
          <a
            href={task.link_url.startsWith('http') ? task.link_url : `https://${task.link_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-600 transition-colors shrink-0 p-0.5"
            title="リンク先を開く"
            onClick={(e) => e.stopPropagation()}
          >
            <Link size={14} />
          </a>
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
        {task.memo && (
          <span title={task.memo} className="cursor-help inline-flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 shrink-0 mx-0.5" onClick={() => onEditDetail('task', task)}>
            <MessageSquare size={14} />
          </span>
        )}
        <button
          onClick={() => onEditDetail('task', task)}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="詳細・メモを編集"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onAddSubtask(task.id)}
          className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-black/5 dark:hover:bg-white/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
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
          isFocused={focusedField === 'status'}
          onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'status')}
          onEditingChange={onEditingChange}
          onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
          isEditing={isGlobalEditingByParent}
        />
      </div>
      <div className={`w-24 ${dateCellClasses} overflow-hidden`}>
        {task.progress_percent != null && (
          <div 
            className="absolute top-0 left-0 h-full bg-blue-500/20 dark:bg-blue-500/30 transition-all duration-300 pointer-events-none"
            style={{ width: `${task.progress_percent}%` }}
          />
        )}
        <div className="relative z-10 w-full h-full flex items-center">
          <EditableInput 
            type="number" 
            value={task.progress_percent} 
            suffix="%" 
            readOnly={true} 
            isAuto={true} 
            onChange={() => {}}
            isFocused={focusedField === 'progress'}
            onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'progress')}
            onEditingChange={onEditingChange}
            onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
            isEditing={isGlobalEditingByParent}
          />
        </div>
      </div>
      <div 
        className={`flex items-center ${commonCellClasses}`}
        style={{ width: assigneeWidth, minWidth: assigneeWidth }}
      >
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
          isFocused={focusedField === 'assignee'}
          onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'assignee')}
          onEditingChange={onEditingChange}
          onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
          isEditing={isGlobalEditingByParent}
        />
      </div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`}></div>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`}></div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`}>
            <EditableInput 
              type="date" 
              value={task.planned_start_date} 
              max={task.planned_end_date}
              onChange={(v: string) => onUpdateField('task', task.id, 'planned_start_date', v)} 
              isAuto={task.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_planned_date', v)}
              isFocused={focusedField === 'planned_start'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'planned_start')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`}>
            <EditableInput 
              type="date" 
              value={task.planned_end_date} 
              min={task.planned_start_date}
              onChange={(v: string) => onUpdateField('task', task.id, 'planned_end_date', v)} 
              isAuto={task.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_planned_date', v)}
              isFocused={focusedField === 'planned_end'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'planned_end')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          <div className={`w-16 ${dateCellClasses} ${planningCellClasses}`}>
            <EditableInput 
              type="number" 
              value={task.planned_effort_total} 
              precision={1} 
              readOnly={true} 
              isAuto={true} 
              onChange={() => {}}
              isFocused={focusedField === 'planned_effort'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'planned_effort')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
            />
          </div>
        </>
      )}
      {!isPlanningMode && (
        <>
          <div className={`w-20 ${dateCellClasses}`}>
            <EditableInput 
              type="date" 
              value={task.actual_start_date} 
              max={task.actual_end_date}
              onChange={(v: string) => onUpdateField('task', task.id, 'actual_start_date', v)} 
              isAuto={task.is_auto_actual_date}
              onToggleAuto={(v: boolean) => onUpdateField('task', task.id, 'is_auto_actual_date', v)}
              highlight={getHighlight('actual_start_date', task.actual_start_date)}
              isFocused={focusedField === 'actual_start'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'actual_start')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
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
              isFocused={focusedField === 'actual_end'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'actual_end')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          <div className={`w-16 ${dateCellClasses}`}>
            <EditableInput 
              type="number" 
              value={task.actual_effort_total} 
              precision={1} 
              readOnly={true} 
              isAuto={true} 
              onChange={() => {}}
              isFocused={focusedField === 'actual_effort'}
              onFocusChange={() => onFocusChange?.(`t-${task.id}`, 'actual_effort')}
              onEditingChange={onEditingChange}
              onTab={(s) => onTabNavigation?.(s ? 'prev' : 'next')}
              isEditing={isGlobalEditingByParent}
            />
          </div>
        </>
      )}
    </div>
  );
});


export default TaskRow;
