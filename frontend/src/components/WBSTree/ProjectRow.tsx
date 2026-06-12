import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle, Pencil, ExternalLink, Link, MessageSquare } from 'lucide-react';
import { Project } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, getDisabledStatusIds, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses, planningCellClasses } from './constants';
import RichTooltip from '../RichTooltip';

interface ProjectRowProps {
  project: Project;
  nameWidth: number;
  assigneeWidth: number;
  checked: boolean;
  onToggleCheck: (project: Project, isShift?: boolean) => void;
  onToggleExpand: (id: number, recursive?: boolean) => void;
  expanded: boolean;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any, options?: { forceConfirm?: boolean }) => void;
  onAddTask: (id: number, isShift: boolean) => void;
  onEditDetail: (type: 'project', data: Project) => void;
  initialData: InitialData | null;
  provided: any;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
  focusedField?: string | null;
  onFocusChange?: (rowId: string, field: string) => void;
  onEditingChange?: (editing: boolean) => void;
  isEditing?: boolean;
  onTabNavigation?: (direction: 'next' | 'prev', autoEdit: boolean) => void;
  projectName?: string;
  showManHours?: boolean;
  hasDuplicateTicketId?: boolean;
}

const ProjectRow = memo(({ 
  project, 
  nameWidth, 
  assigneeWidth,
  checked, 
  onToggleCheck, 
  onToggleExpand, 
  expanded, 
  onUpdateField, 
  onAddTask, 
  onEditDetail,
  initialData,
  provided,
  hidePlanningColumns = false,
  isPlanningMode = false,
  focusedField,
  onFocusChange,
  onEditingChange,
  isEditing: isGlobalEditingByParent,
  onTabNavigation,
  projectName,
  showManHours = true,
  hasDuplicateTicketId = false
}: ProjectRowProps) => {
  const warning = getWarning(project, initialData);
  const usesTestingLink = project.testing_id != null && project.sync_testing_to_azure_devops !== false;
  const linkTargetId = usesTestingLink ? project.testing_id : project.ticket_id;
  const linkUrl = linkTargetId && initialData?.ticket_url_template
    ? initialData.ticket_url_template.replace('{TICKET_ID}', String(linkTargetId))
    : null;
  const testingLinkClassName = 'text-violet-500 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/25 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-100 dark:border-violet-800/60 transition-colors shrink-0 p-0.5 rounded';
  const ticketLinkClassName = usesTestingLink
    ? testingLinkClassName
    : hasDuplicateTicketId
    ? 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/25 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 transition-colors shrink-0 p-0.5 rounded'
    : project.sync_to_azure_devops === false
    ? 'text-gray-400 hover:text-gray-500 dark:text-slate-500 dark:hover:text-slate-400 transition-colors shrink-0 p-0.5'
    : 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/45 border border-blue-100 dark:border-blue-800/60 transition-colors shrink-0 p-0.5 rounded';
  const linkTitle = usesTestingLink
    ? `Testing IDを開く (#${project.testing_id})`
    : hasDuplicateTicketId
    ? `同じチケットIDの連携対象があります (#${project.ticket_id})`
    : project.sync_to_azure_devops === false
    ? `チケットを開く (#${project.ticket_id}) - 情報を同期しない`
    : `チケットを開く (#${project.ticket_id})`;

  const getHighlight = (field: string, value: any) => 
    shouldHighlightField('project', field, value, project, initialData);

  return (
    <div className={`flex group wbs-row-project ${commonRowClasses} ${checked ? 'checked' : ''}`}>
      <div
        className={`sticky left-0 flex items-center gap-1 font-semibold text-gray-800 dark:text-slate-100 wbs-cell-project transition-colors ${commonCellClasses} bg-white dark:bg-slate-900 ${checked ? 'checked' : ''}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => onToggleCheck(project, e.shiftKey)}
          onChange={() => {}}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
          <GripVertical size={14} />
        </div>
        <button 
          onClick={(e) => onToggleExpand(project.id, e.shiftKey)} 
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
          title="開閉 (Shift+クリックで配下も開閉)"
        >
          {expanded === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        {warning && (
          <span title={warning} className="cursor-help inline-flex shrink-0">
            <AlertTriangle size={14} className="text-amber-500" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <EditableInput 
            value={project.project_name} 
            onChange={(v: string) => onUpdateField('project', project.id, 'project_name', v)} 
            className="font-semibold" 
            isFocused={focusedField === 'name'}
            onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'name')}
            onEditingChange={onEditingChange}
            onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
            isEditing={isGlobalEditingByParent}
            nameWidth={nameWidth}
          />
        </div>

        {project.link_url && (
          <a
            href={project.link_url.startsWith('http') ? project.link_url : `https://${project.link_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-600 transition-colors shrink-0 p-0.5"
            title="リンク先を開く"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
          </a>
        )}
        {project.memo && (
          <RichTooltip
            content={
              <div className="space-y-2">
                <div>
                  <div className="font-bold text-[14px] text-indigo-600 dark:text-indigo-400 truncate">
                    {project.project_name}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-1.5">
                  {project.detail && (
                    <div className="text-slate-500 dark:text-slate-400 text-[12px] leading-relaxed mb-2 font-medium">
                      {project.detail}
                    </div>
                  )}
                  
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded p-2 text-slate-600 dark:text-slate-300 text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto custom-scrollbar">
                    {project.memo}
                  </div>
                </div>
              </div>
            }
          >
            <span className="cursor-help inline-flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 shrink-0 mx-0.5" onClick={() => onEditDetail('project', project)}>
              <MessageSquare size={14} />
            </span>
          </RichTooltip>
        )}
        <button
          onClick={() => onEditDetail('project', project)}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="詳細・メモを編集"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => onAddTask(project.id, e.shiftKey)}
          className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all shrink-0"
          title="タスクを追加 (Shift+クリックで一括作成)"
        >
          <Plus size={14} />
        </button>
      </div>
      <div
        className={`flex-shrink-0 flex items-center justify-center ${commonCellClasses}`}
        style={{ width: 30, minWidth: 30, scrollMarginLeft: nameWidth }}
      >
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={ticketLinkClassName}
            title={linkTitle}
            onClick={(e) => e.stopPropagation()}
          >
            {!usesTestingLink && hasDuplicateTicketId ? <AlertTriangle size={14} /> : <Link size={14} />}
          </a>
        )}
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
        <StatusSelect
          type="project"
          id={project.id}
          statusId={project.status_id}
          initialData={initialData} 
          onUpdateField={onUpdateField} 
          disabledStatusIds={getDisabledStatusIds('project', project, initialData)}
          isFocused={focusedField === 'status'}
          onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'status')}
          onEditingChange={onEditingChange}
          onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
          isEditing={isGlobalEditingByParent}
          nameWidth={nameWidth}
        />
      </div>
      <div className={`w-24 ${dateCellClasses} overflow-hidden`} style={{ scrollMarginLeft: nameWidth }}>
        {project.progress_percent != null && (
          <div 
            className="absolute top-0 left-0 h-full bg-blue-500/20 dark:bg-blue-500/30 transition-all duration-300 pointer-events-none"
            style={{ width: `${project.progress_percent}%` }}
          />
        )}
        <div className="relative z-10 w-full h-full flex items-center">
          <EditableInput 
            type="number" 
            value={project.progress_percent} 
            suffix="%" 
            readOnly={true} 
            isAuto={true} 
            onChange={() => {}}
            isFocused={focusedField === 'progress'}
            onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'progress')}
            onEditingChange={onEditingChange}
            onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
            isEditing={isGlobalEditingByParent}
            nameWidth={nameWidth}
          />
        </div>
      </div>
      <div 
        className={`flex items-center ${commonCellClasses}`}
        style={{ width: assigneeWidth, minWidth: assigneeWidth, scrollMarginLeft: nameWidth }}
      >
        <PortalSelect
          value={project.assignee_id}
          options={[
            { id: null, name: '未設定' },
            ...(initialData?.members.map(m => ({ id: m.id, name: m.member_name, hiddenFromMenu: !m.show_in_choices })) || [])
          ]}
          onChange={(v: number | null) => onUpdateField('project', project.id, 'assignee_id', v)}
          className="w-full text-sm"
          placeholder="未設定"
          dropdownTitle="担当者を変更"
          highlight={getHighlight('assignee_id', project.assignee_id)}
          isFocused={focusedField === 'assignee'}
          onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'assignee')}
          onEditingChange={onEditingChange}
          onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
          isEditing={isGlobalEditingByParent}
          nameWidth={nameWidth}
        />
      </div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}></div>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}></div>
          <div className={`w-20 ${commonCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}></div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput 
              type="date" 
              value={project.planned_start_date} 
              max={project.planned_end_date}
              onChange={(v: string) => onUpdateField('project', project.id, 'planned_start_date', v)} 
              isAuto={project.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_planned_date', v)}
              isFocused={focusedField === 'planned_start'}
              onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'planned_start')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          <div className={`w-20 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput 
              type="date" 
              value={project.planned_end_date} 
              min={project.planned_start_date}
              onChange={(v: string) => onUpdateField('project', project.id, 'planned_end_date', v)} 
              isAuto={project.is_auto_planned_date}
              onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_planned_date', v)}
              isFocused={focusedField === 'planned_end'}
              onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'planned_end')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          {showManHours && (
            <div className={`w-16 ${dateCellClasses} ${planningCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
              <EditableInput 
                type="number" 
                value={project.planned_effort_total} 
                precision={1} 
                readOnly={true} 
                isAuto={true} 
                onChange={() => {}}
                isFocused={focusedField === 'planned_effort'}
                onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'planned_effort')}
                onEditingChange={onEditingChange}
                onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
                isEditing={isGlobalEditingByParent}
              />
            </div>
          )}
        </>
      )}
      {!isPlanningMode && (
        <>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput 
              type="date" 
              value={project.actual_start_date} 
              max={project.actual_end_date}
              onChange={(v: string) => onUpdateField('project', project.id, 'actual_start_date', v)} 
              isAuto={project.is_auto_actual_date}
              onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_actual_date', v)}
              highlight={getHighlight('actual_start_date', project.actual_start_date)}
              isFocused={focusedField === 'actual_start'}
              onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'actual_start')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}></div>
          <div className={`w-20 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
            <EditableInput 
              type="date" 
              value={project.actual_end_date} 
              min={project.actual_start_date}
              onChange={(v: string) => onUpdateField('project', project.id, 'actual_end_date', v)} 
              isAuto={project.is_auto_actual_date}
              onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_actual_date', v)}
              highlight={getHighlight('actual_end_date', project.actual_end_date)}
              isFocused={focusedField === 'actual_end'}
              onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'actual_end')}
              onEditingChange={onEditingChange}
              onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
              isEditing={isGlobalEditingByParent}
            />
          </div>
          {showManHours && (
            <div className={`w-16 ${dateCellClasses}`} style={{ scrollMarginLeft: nameWidth }}>
              <EditableInput 
                type="number" 
                value={project.actual_effort_total} 
                precision={1} 
                readOnly={true} 
                isAuto={true} 
                onChange={() => {}}
                isFocused={focusedField === 'actual_effort'}
                onFocusChange={() => onFocusChange?.(`p-${project.id}`, 'actual_effort')}
                onEditingChange={onEditingChange}
                onTab={(s, editing) => onTabNavigation?.(s ? 'prev' : 'next', editing)}
                isEditing={isGlobalEditingByParent}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});


export default React.memo(ProjectRow);
