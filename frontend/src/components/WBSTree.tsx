import React, { useRef, useEffect, useState, useCallback, forwardRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ChevronRight, ChevronDown, Plus, Trash2, Calendar, Pencil, X, Check, GripVertical, AlertTriangle } from 'lucide-react';
import { Project, Task, Subtask } from '../types/wbs';
import { InitialData } from '../types';
import { wbsOps } from '../api/wbsOperations';

const commonCellClasses = "px-2 py-1 text-sm wbs-cell-border truncate";
const dateCellClasses = "px-2 py-1 text-sm wbs-cell-border relative";
const commonHeaderClasses = "px-2 py-2 text-xs font-semibold text-gray-600 wbs-cell-border bg-gray-50 uppercase tracking-wide";
const commonRowClasses = "transition-colors h-[37px]";

const getStatus = (id: number, initialData: InitialData | null) => 
  initialData?.statuses.find(s => s.id === id);

const getWarning = (item: any) => {
  const warnings = [];
  if (item.planned_start_date && item.planned_end_date && item.planned_start_date > item.planned_end_date) {
    warnings.push("計画期間の開始日が終了日より後になっています。");
  }
  if (item.actual_start_date && item.actual_end_date && item.actual_start_date > item.actual_end_date) {
    warnings.push("実績期間の開始日が終了日より後になっています。");
  }
  return warnings.length > 0 ? warnings.join("\n") : null;
};

const formatDateForInput = (d: string) => {
  if (!d) return '';
  return d.replace(/-/g, '/');
};

const parseDateFromInput = (s: string) => {
  if (!s) return null;
  let cleaned = s.replace(/[\/\-\.]/g, '');
  if (cleaned.length === 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  return null;
};

const formatDisplayDate = (dateStr: string, type: string) => {
  if (!dateStr || type !== 'date') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr;
};

// --- Memoized UI Components ---

const EditableInput = memo(({ value, onChange, type = "text", className = "" }: any) => {
  const [val, setVal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCommittingRef = useRef(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setVal(type === 'date' ? formatDateForInput(value) : (value || ''));
      isCommittingRef.current = false;
    }
  }, [value, isEditing, type]);

  const handleCommit = useCallback((newVal: string) => {
    if (!isEditing || isCommittingRef.current) return;

    let valueToSave = newVal;
    if (type === 'date') {
      if (newVal === '') {
        valueToSave = '';
      } else {
        const parsed = parseDateFromInput(newVal);
        if (parsed) {
          valueToSave = parsed;
        } else {
          setVal(formatDateForInput(value));
          setIsEditing(false);
          return;
        }
      }
    }

    const hasChanged = valueToSave !== (value || '');
    if (hasChanged) {
      isCommittingRef.current = true;
      onChange(valueToSave);
    }
    setIsEditing(false);
  }, [isEditing, value, onChange, type]);

  if (type === 'date' && !isEditing) {
    return (
      <div
        className={`w-full h-full flex items-center cursor-pointer hover:bg-black/5 transition-colors ${className}`}
        onClick={() => {
          setIsEditing(true);
          isCommittingRef.current = false;
        }}
        title={value ? formatDateForInput(value) : "未入力"}
      >
        {value ? formatDisplayDate(value, type) : <span className="text-gray-300 text-[10px]">--/--</span>}
      </div>
    );
  }

  return (
    <div
      className={type === 'date' ? "relative w-full h-full" : "w-full h-full"}
      style={type === 'date' && isEditing ? { zIndex: 1000, overflow: 'visible' } : {}}
    >
      {type === 'date' && isEditing ? (
        <div
          className="absolute left-0 top-0 z-[1000] flex items-center bg-white shadow-2xl border-2 border-blue-500 rounded ring-4 ring-blue-500/10"
          style={{ width: '135px', height: '37px', marginLeft: '-2px', marginTop: '-2px' }}
        >
          <button
            type="button"
            className="flex items-center justify-center w-9 h-full border-r border-blue-100 text-blue-600 hover:bg-blue-50 transition-colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              try { (datePickerRef.current as any)?.showPicker(); } catch (err) { datePickerRef.current?.click(); }
            }}
            title="カレンダーから選択"
          >
            <Calendar size={19} />
          </button>
          <input
            type="text"
            placeholder="YYYY/MM/DD"
            className="flex-1 bg-transparent h-full border-none outline-none px-2 text-sm font-bold text-gray-800"
            value={val}
            autoFocus
            onChange={(e) => setVal(e.target.value)}
            onBlur={(e) => handleCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
              else if (e.key === 'Escape') {
                setVal(formatDateForInput(value));
                setIsEditing(false);
              }
            }}
          />
        </div>
      ) : (
        <input
          type={type === 'date' ? "text" : type}
          className={`bg-transparent h-full border-none outline-blue-400 px-1 focus:bg-white/50 w-full ${className}`}
          value={val}
          autoFocus={isEditing}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => handleCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
            else if (e.key === 'Escape' && type === 'date') {
              setVal(formatDateForInput(value));
              setIsEditing(false);
            }
          }}
        />
      )}

      {type === 'date' && (
        <input
          type="date"
          ref={datePickerRef}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          style={{ left: 0, bottom: 0 }}
          value={value || ''}
          onChange={(e) => {
            const picked = e.target.value;
            if (picked) {
              setVal(formatDateForInput(picked));
              onChange(picked);
              setIsEditing(false);
            }
          }}
        />
      )}
    </div>
  );
});

const ProjectRowContent = memo(({ project, nameWidth, checked, onToggleCheck, onToggleExpand, expanded, onUpdateField, onAddTask, provided }: any) => {
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

const TaskRowContent = memo(({ task, nameWidth, checked, onToggleCheck, onToggleExpand, expanded, onUpdateField, onAddSubtask, provided }: any) => {
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

const SubtaskRowContent = memo(({ subtask, nameWidth, checked, onToggleCheck, initialData, onUpdateField, onEditDetail, provided }: any) => {
  const statusInfo = getStatus(subtask.status_id, initialData);
  const warning = getWarning(subtask);
  return (
    <div className={`flex group wbs-row-subtask ${commonRowClasses}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 pl-12 text-gray-600 wbs-cell-subtask transition-colors ${commonCellClasses}`}
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
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <select
            className="bg-transparent font-semibold text-gray-700 outline-none cursor-pointer hover:bg-gray-100/50 rounded px-1 -ml-1 transition-colors shrink-0"
            value={subtask.subtask_type_id}
            onChange={e => onUpdateField('subtask', subtask.id, 'subtask_type_id', Number(e.target.value))}
          >
            {initialData?.subtask_types.map((t: any) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
          </select>
          <span className="text-gray-400 text-xs truncate" title={subtask.subtask_detail || undefined}>
            {subtask.subtask_detail}
          </span>
          {warning && (
            <span title={warning} className="cursor-help inline-flex">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            </span>
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
        <select
          className="bg-transparent w-full outline-none text-xs font-semibold"
          style={{ color: statusInfo?.color_code }}
          value={subtask.status_id}
          onChange={e => onUpdateField('subtask', subtask.id, 'status_id', Number(e.target.value))}
        >
          {initialData?.statuses.map((s: any) => <option key={s.id} value={s.id}>{s.status_name}</option>)}
        </select>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <select
          className="bg-transparent w-full outline-none text-sm"
          value={subtask.assignee_id || ''}
          onChange={e => onUpdateField('subtask', subtask.id, 'assignee_id', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">未設定</option>
          {initialData?.members.map((m: any) => <option key={m.id} value={m.id}>{m.member_name}</option>)}
        </select>
      </div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_start_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_start_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_end_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_start_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_start_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_end_date', v) } /></div>
      <div className={`w-16 ${commonCellClasses}`}>
        <EditableInput type="number" value={subtask.progress_percent} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'progress_percent', v ? Number(v) : null)} />
      </div>
    </div>
  );
});

// --- Main Tree Component ---

interface WBSTreeProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const WBSTree = forwardRef<HTMLDivElement, WBSTreeProps>(({
  projects,
  initialData,
  onUpdate,
  expandedProjects,
  setExpandedProjects,
  expandedTasks,
  setExpandedTasks,
  onScroll
}, ref) => {
  const [saving, setSaving] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [detailValue, setDetailValue] = useState('');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [menuRendered, setMenuRendered] = useState(false);

  useEffect(() => {
    if (Object.values(checkedIds).some(Boolean)) {
      setMenuRendered(true);
    } else {
      const timer = setTimeout(() => setMenuRendered(false), 400);
      return () => clearTimeout(timer);
    }
  }, [checkedIds]);

  const toggleCheckProject = useCallback((project: Project) => {
    const isChecked = !checkedIds[`p-${project.id}`];
    const newChecked = { ...checkedIds };
    newChecked[`p-${project.id}`] = isChecked;
    project.tasks.forEach(task => {
      newChecked[`t-${task.id}`] = isChecked;
      task.subtasks.forEach(subtask => {
        newChecked[`s-${subtask.id}`] = isChecked;
      });
    });
    setCheckedIds(newChecked);
  }, [checkedIds]);

  const toggleCheckTask = useCallback((task: Task) => {
    const isChecked = !checkedIds[`t-${task.id}`];
    const newChecked = { ...checkedIds };
    newChecked[`t-${task.id}`] = isChecked;
    task.subtasks.forEach(subtask => {
      newChecked[`s-${subtask.id}`] = isChecked;
    });
    setCheckedIds(newChecked);
  }, [checkedIds]);

  const toggleCheckSubtask = useCallback((subtaskId: number) => {
    setCheckedIds(prev => ({
      ...prev,
      [`s-${subtaskId}`]: !prev[`s-${subtaskId}`]
    }));
  }, []);

  const totalSelectedCount = Object.values(checkedIds).filter(Boolean).length;

  const handleDeleteSelected = async () => {
    if (!window.confirm(`${totalSelectedCount}件の項目を削除してもよろしいですか？`)) return;

    setSaving(true);
    try {
      const projectsToDelete = projects.filter(p => checkedIds[`p-${p.id}`]);
      const projectIdsToDelete = projectsToDelete.map(p => p.id);
      const tasksToDelete: number[] = [];
      projects.forEach(p => {
        if (projectIdsToDelete.includes(p.id)) return;
        p.tasks.forEach(t => {
          if (checkedIds[`t-${t.id}`]) tasksToDelete.push(t.id);
        });
      });
      const subtasksToDelete: number[] = [];
      projects.forEach(p => {
        if (projectIdsToDelete.includes(p.id)) return;
        p.tasks.forEach(t => {
          if (tasksToDelete.includes(t.id)) return;
          t.subtasks.forEach(s => {
            if (checkedIds[`s-${s.id}`]) subtasksToDelete.push(s.id);
          });
        });
      });
      const promises = [
        ...projectIdsToDelete.map(id => wbsOps.deleteProject(id)),
        ...tasksToDelete.map(id => wbsOps.deleteTask(id)),
        ...subtasksToDelete.map(id => wbsOps.deleteSubtask(id))
      ];
      await Promise.all(promises);
      setCheckedIds({});
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const [nameWidth, setNameWidth] = useState(320);
  const [isResizingName, setIsResizingName] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingName(true);
    resizeStartX.current = e.pageX;
    resizeStartWidth.current = nameWidth;
  };

  useEffect(() => {
    if (!isResizingName) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.pageX - resizeStartX.current;
      setNameWidth(Math.max(150, resizeStartWidth.current + delta));
    };
    const handleMouseUp = () => {
      setIsResizingName(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingName]);

  const toggleProject = useCallback((id: number) => setExpandedProjects(p => ({ ...p, [id]: !p[id] })), [setExpandedProjects]);
  const toggleTask = useCallback((id: number) => setExpandedTasks(t => ({ ...t, [id]: !t[id] })), [setExpandedTasks]);

  const handleAddProject = useCallback(async () => {
    await wbsOps.createProject('新しいプロジェクト');
    onUpdate();
  }, [onUpdate]);

  useEffect(() => {
    const handler = () => handleAddProject();
    window.addEventListener('add-project', handler);
    return () => window.removeEventListener('add-project', handler);
  }, [handleAddProject]);

  const handleUpdate = useCallback(async (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => {
    try {
      setSaving(true);
      if (type === 'project') await wbsOps.updateProject(id, { [field]: value });
      else if (type === 'task') await wbsOps.updateTask(id, { [field]: value });
      else await wbsOps.updateSubtask(id, { [field]: value });
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  const handleAddTask = useCallback(async (projectId: number) => {
    await wbsOps.createTask(projectId, '新しいタスク');
    setExpandedProjects(p => ({ ...p, [projectId]: true }));
    onUpdate();
  }, [onUpdate, setExpandedProjects]);

  const handleAddSubtask = useCallback(async (taskId: number) => {
    if (!initialData) return;
    const typeId = initialData.subtask_types[0]?.id || 1;
    const statusId = initialData.statuses[0]?.id || 1;
    await wbsOps.createSubtask(taskId, typeId, statusId);
    setExpandedTasks(t => ({ ...t, [taskId]: true }));
    onUpdate();
  }, [onUpdate, initialData, setExpandedTasks]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    try {
      setSaving(true);
      if (type === 'PROJECT') {
        const newProjects = Array.from(projects);
        const [removed] = newProjects.splice(source.index, 1);
        newProjects.splice(destination.index, 0, removed);
        await wbsOps.reorderProjects(newProjects.map(p => p.id));
      } else if (type === 'TASK') {
        const projectId = parseInt(source.droppableId.split('-')[1]);
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        const newTasks = Array.from(project.tasks);
        const [removed] = newTasks.splice(source.index, 1);
        newTasks.splice(destination.index, 0, removed);
        await wbsOps.reorderTasks(newTasks.map(t => t.id));
      } else if (type === 'SUBTASK') {
        const taskId = parseInt(source.droppableId.split('-')[1]);
        let targetTask: Task | undefined;
        for (const p of projects) {
          targetTask = p.tasks.find(t => t.id === taskId);
          if (targetTask) break;
        }
        if (!targetTask) return;
        const newSubtasks = Array.from(targetTask.subtasks);
        const [removed] = newSubtasks.splice(source.index, 1);
        newSubtasks.splice(destination.index, 0, removed);
        await wbsOps.reorderSubtasks(newSubtasks.map(s => s.id));
      }
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('並び替えの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={ref}
      className="flex-1 w-full overflow-auto bg-white border-r relative no-scrollbar"
      onScroll={onScroll}
    >
      <div className="min-w-max">
        {saving && (
          <div className="absolute top-1 right-2 z-50">
            <span className="text-[10px] text-blue-500 font-medium">Saving...</span>
          </div>
        )}

        <div className="sticky top-0 z-30 flex border-b border-[var(--wbs-row-border-color)] bg-gray-50 shadow-sm whitespace-nowrap h-[33px]">
          <div
            className={`sticky left-0 z-40 flex items-center bg-gray-50 ${commonHeaderClasses}`}
            style={{ width: nameWidth, minWidth: nameWidth }}
          >
            名称
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
              onMouseDown={startResizing}
            />
          </div>
          <div className={`w-28 flex items-center ${commonHeaderClasses}`}>ステータス</div>
          <div className={`w-28 flex items-center ${commonHeaderClasses}`}>担当者</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>計画開始</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>計画終了</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>実績開始</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>実績終了</div>
          <div className={`w-16 flex items-center ${commonHeaderClasses}`}>進捗</div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="projects-root" type="PROJECT">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="min-w-max">
                {projects.map((project, pIndex) => (
                  <Draggable key={`p-${project.id}`} draggableId={`p-${project.id}`} index={pIndex}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps}>
                        <ProjectRowContent 
                          project={project}
                          nameWidth={nameWidth}
                          checked={!!checkedIds[`p-${project.id}`]}
                          onToggleCheck={() => toggleCheckProject(project)}
                          onToggleExpand={() => toggleProject(project.id)}
                          expanded={expandedProjects[project.id] !== false}
                          onUpdateField={handleUpdate}
                          onAddTask={() => handleAddTask(project.id)}
                          provided={provided}
                        />

                        {expandedProjects[project.id] !== false && (
                          <Droppable droppableId={`project-${project.id}`} type="TASK">
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                {project.tasks.map((task, tIndex) => (
                                  <Draggable key={`t-${task.id}`} draggableId={`t-${task.id}`} index={tIndex}>
                                    {(provided) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps}>
                                        <TaskRowContent 
                                          task={task}
                                          nameWidth={nameWidth}
                                          checked={!!checkedIds[`t-${task.id}`]}
                                          onToggleCheck={() => toggleCheckTask(task)}
                                          onToggleExpand={() => toggleTask(task.id)}
                                          expanded={expandedTasks[task.id] !== false}
                                          onUpdateField={handleUpdate}
                                          onAddSubtask={() => handleAddSubtask(task.id)}
                                          provided={provided}
                                        />

                                        {expandedTasks[task.id] !== false && (
                                          <Droppable droppableId={`task-${task.id}`} type="SUBTASK">
                                            {(provided) => (
                                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                                {task.subtasks.map((subtask, sIndex) => {
                                                  return (
                                                    <Draggable key={`s-${subtask.id}`} draggableId={`s-${subtask.id}`} index={sIndex}>
                                                      {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps}>
                                                          <SubtaskRowContent 
                                                            subtask={subtask}
                                                            nameWidth={nameWidth}
                                                            checked={!!checkedIds[`s-${subtask.id}`]}
                                                            onToggleCheck={() => toggleCheckSubtask(subtask.id)}
                                                            initialData={initialData}
                                                            onUpdateField={handleUpdate}
                                                            onEditDetail={() => { setEditingSubtask(subtask); setDetailValue(subtask.subtask_detail || ''); }}
                                                            provided={provided}
                                                          />
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  );
                                                })}
                                                {provided.placeholder}
                                              </div>
                                            )}
                                          </Droppable>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {projects.length === 0 && (
          <div className="p-8 text-center text-gray-500 w-full col-span-full">
            上部のボタンからプロジェクトを追加してください。
          </div>
        )}
      </div>

      {editingSubtask && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Pencil size={18} className="text-blue-500" />
                サブタスクの詳細
              </h3>
              <button
                onClick={() => setEditingSubtask(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                サブタスクの詳細 (1行)
              </div>
              <input
                type="text"
                className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 font-medium"
                value={detailValue}
                autoFocus
                onChange={(e) => setDetailValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingSubtask) {
                      handleUpdate('subtask', editingSubtask.id, 'subtask_detail', detailValue);
                      setEditingSubtask(null);
                    }
                  }
                }}
                placeholder="詳細を入力してください..."
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t items-center">
              <div className="flex-1 text-xs text-gray-400 italic">保存すると即座に反映されます</div>
              <button
                onClick={() => setEditingSubtask(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white hover:border-gray-200 border border-transparent rounded-lg transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (editingSubtask) {
                    await handleUpdate('subtask', editingSubtask.id, 'subtask_detail', detailValue);
                    setEditingSubtask(null);
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Check size={16} />
                保存する
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {menuRendered && createPortal(
        <div className={`fixed bottom-8 left-1/2 z-[100] floating-menu-container ${totalSelectedCount === 0 ? 'floating-menu-hide' : ''}`}>
          <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {totalSelectedCount}
              </span>
              <span className="text-sm font-semibold text-gray-700">選択中</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-4">
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-sm transition-all hover:scale-105 active:scale-95"
              >
                <Trash2 size={18} />
                一括削除
              </button>
              <button
                onClick={() => setCheckedIds({})}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors px-2"
              >
                選択解除
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default WBSTree;
