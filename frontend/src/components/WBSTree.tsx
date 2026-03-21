import { ChevronRight, ChevronDown, Plus, Trash2, Copy, FileText } from 'lucide-react';
import { useRef, useEffect, useState, useCallback } from 'react';
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
  const handleUpdate = async (type: 'project'|'task'|'subtask', id: number, field: string, value: any) => {
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

  const handleDelete = async (type: 'project'|'task'|'subtask', id: number) => {
    if (!window.confirm('削除してもよろしいですか？')) return;
    if (type === 'project') await wbsOps.deleteProject(id);
    else if (type === 'task') await wbsOps.deleteTask(id);
    else await wbsOps.deleteSubtask(id);
    onUpdate();
  };

  const getStatus = (id: number) => initialData?.statuses.find(s => s.id === id);

  const EditableInput = ({ value, onChange, type = "text", className = "" }: any) => {
    const [val, setVal] = useState(value || '');
    useEffect(() => setVal(value || ''), [value]);
    return (
      <input 
        type={type}
        className={`bg-transparent w-full h-full border-none outline-blue-400 px-1 ${className}`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== (value||'') && onChange(val)}
      />
    );
  };

  const commonCellClasses = "px-2 py-1 text-sm border-r border-gray-200 truncate";
  const commonHeaderClasses = "px-2 py-2 text-xs font-semibold text-gray-600 border-r border-gray-200 bg-gray-50 uppercase tracking-wide";
  const commonRowClasses = "border-b hover:bg-gray-50 bg-white h-[37px]";

  return (
    <div className="flex flex-col h-full w-full bg-white border-r relative">
      {/* WBSTree component starts directly below the global header */}
      {saving && (
        <div className="absolute top-0 right-4 z-50">
           <span className="text-xs text-blue-500 font-medium">Saving...</span>
        </div>
      )}

      <div className="sticky top-0 z-10 flex border-b bg-gray-50 shadow-sm whitespace-nowrap min-w-max h-[33px]">
        <div className={`w-80 flex items-center ${commonHeaderClasses}`}>名称</div>
        <div className={`w-28 flex items-center ${commonHeaderClasses}`}>ステータス</div>
        <div className={`w-28 flex items-center ${commonHeaderClasses}`}>担当者</div>
        <div className={`w-32 flex items-center ${commonHeaderClasses}`}>計画開始日</div>
        <div className={`w-32 flex items-center ${commonHeaderClasses}`}>計画終了日</div>
        <div className={`w-16 flex items-center ${commonHeaderClasses}`}>進捗</div>
        <div className={`w-20 flex items-center justify-center ${commonHeaderClasses}`}>操作</div>
      </div>

      <div ref={containerRef} className="flex-1 w-full overflow-y-auto overflow-x-auto pb-32" onScroll={onScroll}>
        <div className="min-w-max pb-16">
          {projects.map(project => (
            <div key={`p-${project.id}`}>
              <div className={`flex bg-gray-100/50 ${commonRowClasses}`}>
                <div className={`w-80 flex items-center gap-1 font-semibold text-gray-800 ${commonCellClasses}`}>
                  <button onClick={() => toggleProject(project.id)} className="p-0.5 hover:bg-gray-200 rounded">
                    {expandedProjects[project.id] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <EditableInput value={project.project_name} onChange={(v: string) => handleUpdate('project', project.id, 'project_name', v)} className="font-semibold" />
                </div>
                <div className={`w-28 ${commonCellClasses}`}></div>
                <div className={`w-28 ${commonCellClasses}`}></div>
                <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={project.planned_start_date} onChange={(v: string) => handleUpdate('project', project.id, 'planned_start_date', v)} /></div>
                <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={project.planned_end_date} onChange={(v: string) => handleUpdate('project', project.id, 'planned_end_date', v)} /></div>
                <div className={`w-16 ${commonCellClasses}`}></div>
                <div className={`w-20 flex gap-1 items-center justify-center ${commonCellClasses}`}>
                  <button onClick={() => handleAddTask(project.id)} className="text-gray-400 hover:text-blue-500" title="タスクを追加"><Plus size={14}/></button>
                  <button onClick={() => handleDelete('project', project.id)} className="text-gray-400 hover:text-red-500" title="削除"><Trash2 size={14}/></button>
                </div>
              </div>

              {expandedProjects[project.id] !== false && project.tasks.map(task => (
                <div key={`t-${task.id}`}>
                  <div className={`flex ${commonRowClasses}`}>
                    <div className={`w-80 flex items-center gap-1 font-medium pl-6 text-gray-700 ${commonCellClasses}`}>
                      <button onClick={() => toggleTask(task.id)} className="p-0.5 hover:bg-gray-200 rounded">
                        {expandedTasks[task.id] === false ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <EditableInput value={task.task_name} onChange={(v: string) => handleUpdate('task', task.id, 'task_name', v)} className="font-medium" />
                    </div>
                    <div className={`w-28 ${commonCellClasses}`}></div>
                    <div className={`w-28 ${commonCellClasses}`}></div>
                    <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={task.planned_start_date} onChange={(v: string) => handleUpdate('task', task.id, 'planned_start_date', v)} /></div>
                    <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={task.planned_end_date} onChange={(v: string) => handleUpdate('task', task.id, 'planned_end_date', v)} /></div>
                    <div className={`w-16 ${commonCellClasses}`}></div>
                    <div className={`w-20 flex gap-1 items-center justify-center ${commonCellClasses}`}>
                      <button onClick={() => handleAddSubtask(task.id)} className="text-gray-400 hover:text-blue-500" title="サブタスクを追加"><Plus size={14}/></button>
                      <button onClick={() => handleDelete('task', task.id)} className="text-gray-400 hover:text-red-500" title="削除"><Trash2 size={14}/></button>
                    </div>
                  </div>

                  {expandedTasks[task.id] !== false && task.subtasks.map(subtask => {
                    const statusInfo = getStatus(subtask.status_id);
                    return (
                      <div key={`s-${subtask.id}`} className={`flex group hover:bg-blue-50/30 ${commonRowClasses}`}>
                        <div className={`w-80 flex items-center gap-1 pl-12 text-gray-600 ${commonCellClasses}`}>
                          <EditableInput value={subtask.subtask_detail} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'subtask_detail', v)} />
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
                        <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={subtask.planned_start_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'planned_start_date', v)} /></div>
                        <div className={`w-32 ${commonCellClasses}`}><EditableInput type="date" value={subtask.planned_end_date} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'planned_end_date', v)} /></div>
                        <div className={`w-16 ${commonCellClasses}`}>
                          <EditableInput type="number" value={subtask.progress_percent} onChange={(v: string) => handleUpdate('subtask', subtask.id, 'progress_percent', v ? Number(v) : null)} />
                        </div>
                        <div className={`w-20 flex gap-1 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${commonCellClasses}`}>
                          <button className="text-gray-400 hover:text-blue-500" title="詳細"><FileText size={14}/></button>
                          <button onClick={() => handleDelete('subtask', subtask.id)} className="text-gray-400 hover:text-red-500" title="削除"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          {projects.length === 0 && (
            <div className="p-8 text-center text-gray-500 w-full col-span-full">
              上部のボタンからプロジェクトを追加してください。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
