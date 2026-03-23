import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle, Pencil, ExternalLink, MessageSquare } from 'lucide-react';
import { Project } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning, getDisabledStatusIds, shouldHighlightField } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses } from './constants';

interface ProjectRowProps {
  project: Project;
  nameWidth: number;
  checked: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  expanded: boolean;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onAddTask: () => void;
  onEditDetail: () => void;
  initialData: InitialData | null;
  provided: any;
}

const ProjectRow = memo(({ 
  project, 
  nameWidth, 
  checked, 
  onToggleCheck, 
  onToggleExpand, 
  expanded, 
  onUpdateField, 
  onAddTask, 
  onEditDetail,
  initialData,
  provided 
}: ProjectRowProps) => {
  const warning = getWarning(project);

  const getHighlight = (field: string, value: any) => 
    shouldHighlightField('project', field, value, project.status_id, initialData);

  return (
    <div className={`flex group wbs-row-project ${commonRowClasses}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 font-semibold text-gray-800 wbs-cell-project transition-colors ${commonCellClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
          <GripVertical size={14} />
        </div>
        <button onClick={onToggleExpand} className="p-0.5 hover:bg-gray-200 rounded">
          {expanded === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <EditableInput value={project.project_name} onChange={(v: string) => onUpdateField('project', project.id, 'project_name', v)} className="font-semibold" />
        </div>
        {warning && (
          <span title={warning} className="cursor-help inline-flex shrink-0">
            <AlertTriangle size={14} className="text-amber-500" />
          </span>
        )}
        {project.memo && (
          <span title={project.memo} className="cursor-help inline-flex items-center text-blue-400 hover:text-blue-600 shrink-0 mx-0.5" onClick={onEditDetail}>
            <MessageSquare size={14} />
          </span>
        )}
        {project.ticket_id && initialData?.ticket_url_template && (
          <a
            href={initialData.ticket_url_template.replace('{TICKET_ID}', String(project.ticket_id))}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0 p-0.5"
            title={`チケットを開く (#${project.ticket_id})`}
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
          onClick={onAddTask}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="タスクを追加"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <StatusSelect 
          type="project"
          id={project.id}
          statusId={project.status_id}
          initialData={initialData} 
          onUpdateField={onUpdateField} 
          disabledStatusIds={getDisabledStatusIds('project', project, initialData)}
        />
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <PortalSelect
          value={project.assignee_id}
          options={[
            { id: null, name: '未設定' },
            ...(initialData?.members.map(m => ({ id: m.id, name: m.member_name })) || [])
          ]}
          onChange={(v: number | null) => onUpdateField('project', project.id, 'assignee_id', v)}
          className="w-full text-sm"
          placeholder="未設定"
          dropdownTitle="担当者を変更"
          highlight={getHighlight('assignee_id', project.assignee_id)}
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={project.planned_start_date} 
          max={project.planned_end_date}
          onChange={(v: string) => onUpdateField('project', project.id, 'planned_start_date', v)} 
          isAuto={project.is_auto_planned_date}
          onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_planned_date', v)}
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={project.planned_end_date} 
          min={project.planned_start_date}
          onChange={(v: string) => onUpdateField('project', project.id, 'planned_end_date', v)} 
          isAuto={project.is_auto_planned_date}
          onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_planned_date', v)}
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={project.actual_start_date} 
          max={project.actual_end_date}
          onChange={(v: string) => onUpdateField('project', project.id, 'actual_start_date', v)} 
          isAuto={project.is_auto_actual_date}
          onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_actual_date', v)}
          highlight={getHighlight('actual_start_date', project.actual_start_date)}
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput 
          type="date" 
          value={project.actual_end_date} 
          min={project.actual_start_date}
          onChange={(v: string) => onUpdateField('project', project.id, 'actual_end_date', v)} 
          isAuto={project.is_auto_actual_date}
          onToggleAuto={(v: boolean) => onUpdateField('project', project.id, 'is_auto_actual_date', v)}
          highlight={getHighlight('actual_end_date', project.actual_end_date)}
        />
      </div>
      <div className={`w-20 ${commonCellClasses}`}></div>
      <div className={`w-16 ${commonCellClasses}`}></div>
    </div>
  );
});


export default ProjectRow;
