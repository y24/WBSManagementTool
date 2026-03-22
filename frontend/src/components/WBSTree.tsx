import { ChevronRight, ChevronDown, Plus, Trash2, Copy, FileText, AlertTriangle, Calendar, Pencil, X, Check, GripVertical } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Project, Task, Subtask } from '../types/wbs';
import { InitialData } from '../types';
import { wbsOps } from '../api/wbsOperations';

interface WBSTreeProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  syncScrollTop?: number;
}

export default function WBSTree({
  projects,
  initialData,
  onUpdate,
  expandedProjects,
  setExpandedProjects,
  expandedTasks,
  setExpandedTasks,
  onScroll,
  syncScrollTop
}: WBSTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const toggleCheckProject = (project: Project) => {
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
  };

  const toggleCheckTask = (task: Task) => {
    const isChecked = !checkedIds[`t-${task.id}`];
    const newChecked = { ...checkedIds };
    newChecked[`t-${task.id}`] = isChecked;
    task.subtasks.forEach(subtask => {
      newChecked[`s-${subtask.id}`] = isChecked;
    });
    setCheckedIds(newChecked);
  };

  const toggleCheckSubtask = (subtaskId: number) => {
    setCheckedIds(prev => ({
      ...prev,
      [`s-${subtaskId}`]: !prev[`s-${subtaskId}`]
    }));
  };

  const totalSelectedCount = Object.values(checkedIds).filter(Boolean).length;

  const handleDeleteSelected = async () => {
    if (!window.confirm(`${totalSelectedCount}件の項目を削除してもよろしいですか？`)) return;
    
    setSaving(true);
    try {
      // 削除対象の特定
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

      // 並列実行
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

  useEffect(() => {
    if (containerRef.current && syncScrollTop !== undefined) {
      containerRef.current.scrollTop = syncScrollTop;
    }
  }, [syncScrollTop]);

  const toggleProject = (id: number) => setExpandedProjects(p => ({ ...p, [id]: !p[id] }));
  const toggleTask = (id: number) => setExpandedTasks(t => ({ ...t, [id]: !t[id] }));

  const handleAddProject = useCallback(async () => {
    await wbsOps.createProject('新しいプロジェクト');
    onUpdate();
  }, [onUpdate]);

  useEffect(() => {
    const handler = () => handleAddProject();
    window.addEventListener('add-project', handler);
    return () => window.removeEventListener('add-project', handler);
  }, [handleAddProject]);

  // --- CRUD Operations ---
  const handleUpdate = async (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => {
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
  };

  const handleAddTask = async (projectId: number) => {
    await wbsOps.createTask(projectId, '新しいタスク');
    setExpandedProjects(p => ({ ...p, [projectId]: true }));
    onUpdate();
  };

  const handleAddSubtask = async (taskId: number) => {
    if (!initialData) return;
    const typeId = initialData.subtask_types[0]?.id || 1;
    const statusId = initialData.statuses[0]?.id || 1;
    await wbsOps.createSubtask(taskId, typeId, statusId);
    setExpandedTasks(t => ({ ...t, [taskId]: true }));
    onUpdate();
  };

  const handleDelete = async (type: 'project' | 'task' | 'subtask', id: number) => {
    if (!window.confirm('削除してもよろしいですか？')) return;
    if (type === 'project') await wbsOps.deleteProject(id);
    else if (type === 'task') await wbsOps.deleteTask(id);
    else await wbsOps.deleteSubtask(id);
    onUpdate();
  };

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

  const getStatus = (id: number) => initialData?.statuses.find(s => s.id === id);

  const EditableInput = ({ value, onChange, type = "text", className = "" }: any) => {
    const [val, setVal] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);
    const isCommittingRef = useRef(false);

    useEffect(() => {
      setVal(value || '');
      if (!isEditing) {
        isCommittingRef.current = false;
      }
    }, [value, isEditing]);

    const handleCommit = useCallback((newVal: string) => {
      if (!isEditing || isCommittingRef.current) return;

      const hasChanged = newVal !== (value || '');
      if (hasChanged) {
        isCommittingRef.current = true;
        onChange(newVal);
      }
      setIsEditing(false);
    }, [isEditing, value, onChange]);

    const formatDisplayDate = (dateStr: string) => {
      if (!dateStr || type !== 'date') return dateStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`; // MM/DD
      }
      return dateStr;
    };

    if (type === 'date' && !isEditing) {
      return (
        <div
          className={`w-full h-full flex items-center cursor-pointer hover:bg-black/5 transition-colors ${className}`}
          onClick={() => {
            setIsEditing(true);
            isCommittingRef.current = false;
          }}
          title={val}
        >
          {val ? formatDisplayDate(val) : <span className="text-gray-300 text-[10px]">--/--</span>}
        </div>
      );
    }

    return (
      <div className={type === 'date' ? "relative w-full h-full" : "w-full h-full"}>
        <input
          type={type}
          className={`
            bg-transparent h-full border-none outline-blue-400 px-1 focus:bg-white/50
            ${type === 'date'
              ? 'absolute left-0 top-0 z-50 !w-[120px] !min-w-[120px] shadow-xl border-2 border-blue-500 rounded-md !bg-white'
              : 'w-full'
            }
            ${className}
          `}
          value={val}
          autoFocus={isEditing}
          onChange={(e) => {
            const newValue = e.target.value;
            setVal(newValue);
            if (type === 'date' && newValue !== (value || '')) {
              handleCommit(newValue);
            }
          }}
          onBlur={(e) => {
            handleCommit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommit((e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>
    );
  };

  const commonCellClasses = "px-2 py-1 text-sm wbs-cell-border truncate";
  const dateCellClasses = "px-2 py-1 text-sm wbs-cell-border relative";
  const commonHeaderClasses = "px-2 py-2 text-xs font-semibold text-gray-600 wbs-cell-border bg-gray-50 uppercase tracking-wide";
  const commonRowClasses = "transition-colors h-[37px]";

  return (
    <div 
      ref={containerRef} 
      className="flex-1 w-full overflow-auto bg-white border-r relative"
      onScroll={onScroll}
    >
      <div className="min-w-max pb-32">
        {saving && (
          <div className="absolute top-0 right-4 z-50">
            <span className="text-xs text-blue-500 font-medium">Saving...</span>
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
              <div {...provided.droppableProps} ref={provided.innerRef} className="min-w-max pb-16">
                {projects.map((project, pIndex) => (
                  <Draggable key={`p-${project.id}`} draggableId={`p-${project.id}`} index={pIndex}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps}>
                        <div className={`flex group wbs-row-project ${commonRowClasses}`}>
                          <div 
                            className={`sticky left-0 z-20 flex items-center gap-1 font-semibold text-gray-800 wbs-cell-project transition-colors ${commonCellClasses}`}
                            style={{ width: nameWidth, minWidth: nameWidth }}
                          >
                            <input 
                              type="checkbox" 
                              checked={!!checkedIds[`p-${project.id}`]} 
                              onChange={() => toggleCheckProject(project)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
                            />
                            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                              <GripVertical size={14} />
                            </div>
                            <button onClick={() => toggleProject(project.id)} className="p-0.5 hover:bg-gray-200 rounded">
                              {expandedProjects[project.id] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <EditableInput value={project.project_name} onChange={(v: string) => handleUpdate('project', project.id, 'project_name', v)} className="font-semibold" />
                            </div>
                            {project.is_overlapping && <span title="スケジュールに重複があります"><AlertTriangle size={14} className="text-amber-500 shrink-0" /></span>}
                            <button 
                              onClick={() => handleAddTask(project.id)} 
                              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0" 
                              title="タスクを追加"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className={`w-28 ${commonCellClasses}`}></div>
                          <div className={`w-28 ${commonCellClasses}`}></div>
                          <div className={`w-20 ${dateCellClasses}`}>
                            <div className="flex items-center gap-1 group/date h-full">
                              <EditableInput type="date" value={project.planned_start_date} onChange={(v: string) => handleUpdate('project', project.id, 'planned_start_date', v)} />
                              <button
                                onClick={() => handleUpdate('project', project.id, 'is_auto_planned_date', !project.is_auto_planned_date)}
                                className={`p-0.5 rounded transition-colors ${project.is_auto_planned_date ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:bg-gray-100 group-hover/date:opacity-100 opacity-0'}`}
                                title="下位要素から自動計算"
                              >
                                <Calendar size={12} />
                              </button>
                            </div>
                          </div>
                          <div className={`w-20 ${dateCellClasses}`}>
                            <EditableInput type="date" value={project.planned_end_date} onChange={(v: string) => handleUpdate('project', project.id, 'planned_end_date', v)} />
                          </div>
                          <div className={`w-20 ${dateCellClasses}`}>
                            <div className="flex items-center gap-1 group/date h-full">
                              <EditableInput type="date" value={project.actual_start_date} onChange={(v: string) => handleUpdate('project', project.id, 'actual_start_date', v)} />
                              <button
                                onClick={() => handleUpdate('project', project.id, 'is_auto_actual_date', !project.is_auto_actual_date)}
                                className={`p-0.5 rounded transition-colors ${project.is_auto_actual_date ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:bg-gray-100 group-hover/date:opacity-100 opacity-0'}`}
                                title="下位要素から自動計算"
                              >
                                <Calendar size={12} />
                              </button>
                            </div>
                          </div>
                          <div className={`w-20 ${dateCellClasses}`}>
                            <EditableInput type="date" value={project.actual_end_date} onChange={(v: string) => handleUpdate('project', project.id, 'actual_end_date', v)} />
                          </div>
                          <div className={`w-16 ${commonCellClasses}`}></div>
                        </div>

                        {expandedProjects[project.id] !== false && (
                          <Droppable droppableId={`project-${project.id}`} type="TASK">
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                {project.tasks.map((task, tIndex) => (
                                  <Draggable key={`t-${task.id}`} draggableId={`t-${task.id}`} index={tIndex}>
                                    {(provided) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps}>
                                        <div className={`flex group wbs-row-task ${commonRowClasses}`}>
                                          <div 
                                            className={`sticky left-0 z-20 flex items-center gap-1 font-medium pl-6 text-gray-700 wbs-cell-task transition-colors ${commonCellClasses}`}
                                            style={{ width: nameWidth, minWidth: nameWidth }}
                                          >
                                            <input 
                                              type="checkbox" 
                                              checked={!!checkedIds[`t-${task.id}`]} 
                                              onChange={() => toggleCheckTask(task)}
                                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
                                            />
                                            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                                              <GripVertical size={14} />
                                            </div>
                                            <button onClick={() => toggleTask(task.id)} className="p-0.5 hover:bg-gray-200 rounded">
                                              {expandedTasks[task.id] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                              <EditableInput value={task.task_name} onChange={(v: string) => handleUpdate('task', task.id, 'task_name', v)} className="font-medium" />
                                            </div>
                                            {task.is_overlapping && <span title="スケジュールに重複があります"><AlertTriangle size={14} className="text-amber-500 shrink-0" /></span>}
                                            <button 
                                              onClick={() => handleAddSubtask(task.id)} 
                                              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0" 
                                              title="サブタスクを追加"
                                            >
                                              <Plus size={14} />
                                            </button>
                                          </div>
                                          <div className={`w-28 ${commonCellClasses}`}></div>
                                          <div className={`w-28 ${commonCellClasses}`}></div>
                                          <div className={`w-20 ${dateCellClasses}`}>
                                            <div className="flex items-center gap-1 group/date h-full">
                                              <EditableInput type="date" value={task.planned_start_date} onChange={(v: string) => handleUpdate('task', task.id, 'planned_start_date', v)} />
                                              <button
                                                onClick={() => handleUpdate('task', task.id, 'is_auto_planned_date', !task.is_auto_planned_date)}
                                                className={`p-0.5 rounded transition-colors ${task.is_auto_planned_date ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:bg-gray-100 group-hover/date:opacity-100 opacity-0'}`}
                                                title="下位要素から自動計算"
                                              >
                                                <Calendar size={12} />
                                              </button>
                                            </div>
                                          </div>
                                          <div className={`w-20 ${dateCellClasses}`}>
                                            <EditableInput type="date" value={task.planned_end_date} onChange={(v: string) => handleUpdate('task', task.id, 'planned_end_date', v)} />
                                          </div>
                                          <div className={`w-20 ${dateCellClasses}`}>
                                            <div className="flex items-center gap-1 group/date h-full">
                                              <EditableInput type="date" value={task.actual_start_date} onChange={(v: string) => handleUpdate('task', task.id, 'actual_start_date', v)} />
                                              <button
                                                onClick={() => handleUpdate('task', task.id, 'is_auto_actual_date', !task.is_auto_actual_date)}
                                                className={`p-0.5 rounded transition-colors ${task.is_auto_actual_date ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:bg-gray-100 group-hover/date:opacity-100 opacity-0'}`}
                                                title="下位要素から自動計算"
                                              >
                                                <Calendar size={12} />
                                              </button>
                                            </div>
                                          </div>
                                          <div className={`w-20 ${dateCellClasses}`}>
                                            <EditableInput type="date" value={task.actual_end_date} onChange={(v: string) => handleUpdate('task', task.id, 'actual_end_date', v)} />
                                          </div>
                                          <div className={`w-16 ${commonCellClasses}`}></div>
                                        </div>

                                        {expandedTasks[task.id] !== false && (
                                          <Droppable droppableId={`task-${task.id}`} type="SUBTASK">
                                            {(provided) => (
                                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                                {task.subtasks.map((subtask, sIndex) => {
                                                  const statusInfo = getStatus(subtask.status_id);
                                                  return (
                                                    <Draggable key={`s-${subtask.id}`} draggableId={`s-${subtask.id}`} index={sIndex}>
                                                      {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} className={`flex group wbs-row-subtask ${commonRowClasses}`}>
                                                          <div 
                                                            className={`sticky left-0 z-20 flex items-center gap-1 pl-12 text-gray-600 wbs-cell-subtask transition-colors ${commonCellClasses}`}
                                                            style={{ width: nameWidth, minWidth: nameWidth }}
                                                          >
                                                            <input 
                                                              type="checkbox" 
                                                              checked={!!checkedIds[`s-${subtask.id}`]} 
                                                              onChange={() => toggleCheckSubtask(subtask.id)}
                                                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
                                                            />
                                                            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                                                              <GripVertical size={14} />
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                                              <select
                                                                className="bg-transparent font-semibold text-gray-700 outline-none cursor-pointer hover:bg-gray-100/50 rounded px-1 -ml-1 transition-colors shrink-0"
                                                                value={subtask.subtask_type_id}
                                                                onChange={e => handleUpdate('subtask', subtask.id, 'subtask_type_id', Number(e.target.value))}
                                                              >
                                                                {initialData?.subtask_types.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                                                              </select>
                                                              {subtask.subtask_detail && (
                                                                <span className="text-gray-400 text-xs truncate" title={subtask.subtask_detail}>
                                                                  {subtask.subtask_detail}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <button
                                                              onClick={() => { setEditingSubtask(subtask); setDetailValue(subtask.subtask_detail || ''); }}
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
                                                              onChange={e => handleUpdate('subtask', subtask.id, 'status_id', Number(e.target.value))}
                                                            >
                                                              {initialData?.statuses.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
                                                            </select>
                                                          </div>
                                                          <div className={`w-28 flex items-center ${commonCellClasses}`}>
                                                            <select
                                                              className="bg-transparent w-full outline-none text-sm"
                                                              value={subtask.assignee_id || ''}
                                                              onChange={e => handleUpdate('subtask', subtask.id, 'assignee_id', e.target.value ? Number(e.target.value) : null)}
                                                            >
                                                              <option value="">未設定</option>
                                                              {initialData?.members.map(m => <option key={m.id} value={m.id}>{m.member_name}</option>)}
                                                            </select>
                                                          </div>
                                                          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_start_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'planned_start_date', v)} /></div>
                                                          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_end_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'planned_end_date', v)} /></div>
                                                          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_start_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'actual_start_date', v)} /></div>
                                                          <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_end_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'actual_end_date', v)} /></div>
                                                          <div className={`w-16 ${commonCellClasses}`}>
                                                            <EditableInput type="number" value={subtask.progress_percent} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'progress_percent', v ? Number(v) : null)} />
                                                          </div>
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
}
