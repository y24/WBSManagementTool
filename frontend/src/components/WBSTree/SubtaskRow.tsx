import React, { memo } from 'react';
import { GripVertical, AlertTriangle, Pencil, ExternalLink, Link, MessageSquare } from 'lucide-react';
import { Subtask } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses, planningCellClasses } from './constants';
import RichTooltip from '../RichTooltip';

interface SubtaskRowProps {
  subtask: Subtask;
  nameWidth: number;
  assigneeWidth: number;
  checked: boolean;
  onToggleCheck: (id: number, isShift?: boolean) => void;
  initialData: InitialData | null;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onEditDetail: (type: 'subtask', data: Subtask) => void;
  provided: any;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
  focusedField?: string | null;
  onFocusChange?: (rowId: string, field: string) => void;
  onEditingChange?: (editing: boolean) => void;
  isEditing?: boolean;
  onTabNavigation?: (direction: 'next' | 'prev', autoEdit: boolean) => void;
  projectName?: string;
  taskName?: string;
}

const SubtaskRow = memo(({
  subtask,
  nameWidth,
  assigneeWidth,
  checked,
  onToggleCheck,
  initialData,
  onUpdateField,
  onEditDetail,
  provided,
  hidePlanningColumns = false,
  isPlanningMode = false,
  focusedField,
  onFocusChange,
  onEditingChange,
  isEditing: isGlobalEditingByParent,
  onTabNavigation,
  projectName,
  taskName
}: SubtaskRowProps) => {
  const warning = getWarning(subtask, initialData, true);
  const statusName = initialData?.statuses.find(s => s.id === subtask.status_id)?.status_name;
  const isOngoing = statusName === 'In Progress' || statusName === 'In Review';

  const [localProgress, setLocalProgress] = React.useState<number | null>(subtask.progress_percent ?? null);

  React.useEffect(() => {
    setLocalProgress(subtask.progress_percent ?? null);
  }, [subtask.progress_percent]);

  const getHighlight = (field: string, value: any) =>
    shouldHighlightField('subtask', field, value, subtask, initialData);

  return (
    <div className={`flex group wbs-row-subtask ${commonRowClasses} ${checked ? 'checked' : ''}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 pl-12 text-gray-600 dark:text-slate-400 wbs-cell-subtask transition-colors ${commonCellClasses} ${checked ? 'checked' : 'bg-white dark:bg-slate-900'}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => onToggleCheck(subtask.id, e.shiftKey)}
          onChange={() => { }}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {warning && (
            <span title={warning} className="cursor-help inline-flex shrink-0">
              <AlertTriangle size={14} className="text-amber-500" />
            </span>
          )}
          <PortalSelect
            value={subtask.subtask_type_id}
            options={initialData?.subtask_types.map(t => ({ id: t.id, name: t.type_name })) || []}
            onChange={v => onUpdateField('subtask', subtask.id, 'subtask_type_id', v)}
            className="font-semibold text-gray-700 dark:text-slate-300 -ml-1"
            placeholder="未設定"
            dropdownTitle="種別を変更"
            highlight={getHighlight('subtask_type_id', subtask.subtask_type_id)}
            isFocused={focusedField === 'name'}
            onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'name')}
            onEditingChange={onEditingChange}
            onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
            isEditing={isGlobalEditingByParent}
            nameWidth={nameWidth}
          />
          <span className="text-gray-400 dark:text-slate-500 text-xs truncate" title={subtask.subtask_detail || undefined}>
            {subtask.subtask_detail}
          </span>

          {subtask.link_url && (
            <a
              href={subtask.link_url.startsWith('http') ? subtask.link_url : `https://${subtask.link_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-600 transition-colors shrink-0 p-0.5"
              title="リンク先を開く"
              onClick={(e) => e.stopPropagation()}
            >
              <Link size={14} />
            </a>
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
          {subtask.memo && (
            <RichTooltip
              content={
                <div className="space-y-2">
                  <div>
                    <div className="font-bold text-[14px] text-indigo-600 dark:text-indigo-400 truncate">
                      {projectName || '-'}
                    </div>
                    {taskName && (
                      <div className="font-medium truncate opacity-90 text-[13px] text-slate-700 dark:text-slate-300">
                        {taskName}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-1.5">
                    {subtask.subtask_detail && (
                      <div className="text-slate-500 dark:text-slate-400 text-[12px] leading-relaxed mb-2 font-medium">
                        {subtask.subtask_detail}
                      </div>
                    )}
                    
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded p-2 text-slate-600 dark:text-slate-300 text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto custom-scrollbar">
                      {subtask.memo}
                    </div>
                  </div>
                </div>
              }
            >
              <span className="cursor-help inline-flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 shrink-0 mx-0.5" onClick={() => onEditDetail('subtask', subtask)}>
                <MessageSquare size={14} />
              </span>
            </RichTooltip>
          )}
        </div>
        <button
          onClick={() => onEditDetail('subtask', subtask)}
          className="text-gray-300 hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          title="詳細を編集"
        >
          <Pencil size={14} />
        </button>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
        <StatusSelect
          type="subtask"
          id={subtask.id}
          statusId={subtask.status_id}
          initialData={initialData}
          onUpdateField={onUpdateField}
          isFocused={focusedField === 'status'}
          onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'status')}
          onEditingChange={onEditingChange}
          onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
          isEditing={isGlobalEditingByParent}
          nameWidth={nameWidth}
        />
      </div>
      <div className={`w-24 ${dateCellClasses} overflow-hidden`} style={{ scrollMarginLeft: nameWidth }}>
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
            isFocused={focusedField === 'progress'}
            onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'progress')}
            onEditingChange={onEditingChange}
            onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
            isEditing={isGlobalEditingByParent}
            nameWidth={nameWidth}
            clearValue={0}
          />
        </div>
      </div>
      <div
        className={`flex items-center ${commonCellClasses}`}
        style={{ width: assigneeWidth, minWidth: assigneeWidth, scrollMarginLeft: nameWidth }}
      >
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
          isFocused={focusedField === 'assignee'}
          onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'assignee')}
          onEditingChange={onEditingChange}
          onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
          isEditing={isGlobalEditingByParent}
          nameWidth={nameWidth}
        />
      </div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="number"
              value={subtask.workload_percent}
              onChange={(v: number | null) => onUpdateField('subtask', subtask.id, 'workload_percent', v)}
              min={0}
              suffix="%"
              highlight={getHighlight('workload_percent', subtask.workload_percent)}
              isFocused={focusedField === 'workload_percent'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'workload_percent')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
              clearValue={100}
            />
          </div>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="number"
              value={subtask.work_days}
              onChange={(v: number | null) => onUpdateField('subtask', subtask.id, 'work_days', v)}
              min={0}
              step={0.5}
              precision={1}
              suffix="日"
              highlight={getHighlight('work_days', subtask.work_days)}
              isFocused={focusedField === 'work_days'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'work_days')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="number"
              value={subtask.review_days}
              onChange={(v: number | null) => onUpdateField('subtask', subtask.id, 'review_days', v)}
              min={0}
              step={0.5}
              precision={1}
              suffix="日"
              highlight={getHighlight('review_days', subtask.review_days)}
              isFocused={focusedField === 'review_days'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'review_days')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="date"
              value={subtask.planned_start_date}
              max={subtask.planned_end_date}
              onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_start_date', v)}
              highlight={getHighlight('planned_start_date', subtask.planned_start_date)}
              isFocused={focusedField === 'planned_start'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'planned_start')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="date"
              value={subtask.planned_end_date}
              min={subtask.planned_start_date}
              onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_end_date', v)}
              highlight={getHighlight('planned_end_date', subtask.planned_end_date)}
              isFocused={focusedField === 'planned_end'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'planned_end')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-16 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
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
              isFocused={focusedField === 'planned_effort'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'planned_effort')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
        </>
      )}
      {!isPlanningMode && (
        <>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="date"
              value={subtask.actual_start_date}
              max={subtask.actual_end_date}
              onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_start_date', v)}
              highlight={getHighlight('actual_start_date', subtask.actual_start_date)}
              isFocused={focusedField === 'actual_start'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'actual_start')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="date"
              value={subtask.review_start_date}
              min={subtask.actual_start_date}
              max={subtask.actual_end_date}
              onChange={(v: string) => onUpdateField('subtask', subtask.id, 'review_start_date', v)}
              highlight={getHighlight('review_start_date', subtask.review_start_date)}
              readOnly={subtask.review_days !== null && subtask.review_days !== undefined && Number(subtask.review_days) === 0}
              isFocused={focusedField === 'review_start'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'review_start')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput
              type="date"
              value={subtask.actual_end_date}
              min={subtask.actual_start_date}
              onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_end_date', v)}
              highlight={getHighlight('actual_end_date', subtask.actual_end_date)}
              className={isOngoing ? "bg-yellow-100/90 dark:bg-yellow-900/40" : ""}
              isFocused={focusedField === 'actual_end'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'actual_end')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
          <div className={`w-16 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
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
              isFocused={focusedField === 'actual_effort'}
              onFocusChange={() => onFocusChange?.(`s-${subtask.id}`, 'actual_effort')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
              nameWidth={nameWidth}
            />
          </div>
        </>
      )}
    </div>
  );
});


export default SubtaskRow;
