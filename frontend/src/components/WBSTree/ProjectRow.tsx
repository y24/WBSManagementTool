import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Plus, GripVertical, AlertTriangle } from 'lucide-react';
import { Project } from '../../types/wbs';
import EditableInput from './EditableInput';
import { getWarning } from './utils';
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
  provided 
}: ProjectRowProps) => {
  const warning = getWarning(project);
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
          <span title={warning} className="cursor-help inline-flex">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          </span>
        )}
        <button
          onClick={onAddTask}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="タスクを追加"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className={`w-28 ${commonCellClasses}`}></div>
      <div className={`w-28 ${commonCellClasses}`}></div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={project.planned_start_date} onChange={(v: string) => onUpdateField('project', project.id, 'planned_start_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={project.planned_end_date} onChange={(v: string) => onUpdateField('project', project.id, 'planned_end_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={project.actual_start_date} onChange={(v: string) => onUpdateField('project', project.id, 'actual_start_date', v)} />
      </div>
      <div className={`w-20 ${dateCellClasses}`}>
        <EditableInput type="date" value={project.actual_end_date} onChange={(v: string) => onUpdateField('project', project.id, 'actual_end_date', v)} />
      </div>
      <div className={`w-16 ${commonCellClasses}`}></div>
    </div>
  );
});

export default ProjectRow;
