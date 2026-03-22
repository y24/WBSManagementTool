import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Project, Task, Subtask } from '../types/wbs';
import { InitialData } from '../types';
import { wbsOps } from '../api/wbsOperations';

// Sub-components
import ProjectRow from './WBSTree/ProjectRow';
import TaskRow from './WBSTree/TaskRow';
import SubtaskRow from './WBSTree/SubtaskRow';
import DetailModal from './WBSTree/DetailModal';
import FloatingMenu from './WBSTree/FloatingMenu';
import ConfirmModal from './WBSTree/ConfirmModal';
import { commonHeaderClasses } from './WBSTree/constants';

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
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ total: 0, detail: '' });
  const isConfirming = useRef(false);

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

  const handleDeleteSelected = () => {
    if (saving || isConfirmModalOpen) return;

    if (totalSelectedCount === 0) return;

    // 削除対象を算出
    const projectIdsToDelete = projects.filter(p => checkedIds[`p-${p.id}`]).map(p => p.id);
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

    const detailMsg = `削除対象の内訳: プロジェクト:${projectIdsToDelete.length}, タスク:${tasksToDelete.length}, サブタスク:${subtasksToDelete.length}`;
    setConfirmData({ total: totalSelectedCount, detail: detailMsg });
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    setIsConfirmModalOpen(false);
    setSaving(true);
    
    try {
      const projectIdsToDelete = projects.filter(p => checkedIds[`p-${p.id}`]).map(p => p.id);
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

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      setCheckedIds({});
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('削除中にエラーが発生しました。');
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

  const toggleProject = useCallback((id: number) => setExpandedProjects(p => ({ ...p, [id]: !(p[id] !== false) })), [setExpandedProjects]);
  const toggleTask = useCallback((id: number) => setExpandedTasks(t => ({ ...t, [id]: !(t[id] !== false) })), [setExpandedTasks]);

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
      const updates: any = { [field]: value };

      // Side effect: If status changed to Done, set progress to 100%
      if (type === 'subtask' && field === 'status_id' && initialData) {
        const doneStatus = initialData.statuses.find(s => s.status_name === 'Done');
        if (doneStatus && value === doneStatus.id) {
          updates.progress_percent = 100;
        }
      }

      if (type === 'project') await wbsOps.updateProject(id, updates);
      else if (type === 'task') await wbsOps.updateTask(id, updates);
      else await wbsOps.updateSubtask(id, updates);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, initialData]);

  const handleAddTask = useCallback(async (projectId: number) => {
    await wbsOps.createTask(projectId, '新しいタスク');
    setExpandedProjects(p => ({ ...p, [projectId]: true }));
    onUpdate();
  }, [onUpdate, setExpandedProjects]);

  const handleAddSubtask = useCallback(async (taskId: number) => {
    if (!initialData) return;
    const typeId = null;
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

        <div className="sticky top-0 z-30 flex border-b border-[#f1f5f9] bg-gray-50 shadow-sm whitespace-nowrap h-[33px]">
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
                        <ProjectRow 
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
                                        <TaskRow 
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
                                                          <SubtaskRow 
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

      {editingSubtask && (
        <DetailModal 
          editingSubtask={editingSubtask}
          detailValue={detailValue}
          setDetailValue={setDetailValue}
          onClose={() => setEditingSubtask(null)}
          onSave={async () => {
             await handleUpdate('subtask', editingSubtask.id, 'subtask_detail', detailValue);
             setEditingSubtask(null);
          }}
        />
      )}

      <FloatingMenu 
        totalSelectedCount={totalSelectedCount}
        onDelete={handleDeleteSelected}
        onClear={() => setCheckedIds({})}
        menuRendered={menuRendered}
        loading={saving}
      />

      <ConfirmModal 
        isOpen={isConfirmModalOpen}
        totalCount={confirmData.total}
        detailMsg={confirmData.detail}
        onConfirm={executeDelete}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
});

export default WBSTree;
