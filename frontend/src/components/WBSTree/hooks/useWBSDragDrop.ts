import { useCallback } from 'react';
import { DropResult } from '@hello-pangea/dnd';
import { wbsOps } from '../../../api/wbsOperations';
import { Project, Task } from '../../../types/wbs';

export const useWBSDragDrop = (
  projects: Project[],
  onUpdate: () => void,
  setSaving: (saving: boolean) => void,
  onLocalReorder?: (newProjects: Project[]) => void
) => {
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    try {
      if (type === 'PROJECT') {
        const newProjects = Array.from(projects);
        const [removed] = newProjects.splice(source.index, 1);
        newProjects.splice(destination.index, 0, removed);
        
        // Optimistic update
        if (onLocalReorder) onLocalReorder(newProjects);
        
        setSaving(true);
        await wbsOps.reorderProjects(newProjects.map(p => p.id));
      } else if (type === 'TASK') {
        const sourceProjectId = parseInt(source.droppableId.split('-').pop()!);
        const isRowDrop = destination.droppableId.startsWith('project-row-drop-');
        const destProjectId = isRowDrop 
          ? parseInt(destination.droppableId.replace('project-row-drop-', ''))
          : parseInt(destination.droppableId.split('-').pop()!);
        const taskId = parseInt(result.draggableId.split('-').pop()!);
        const destIndex = isRowDrop ? 0 : destination.index;

        if (sourceProjectId !== destProjectId || !isRowDrop) {
          // Calculate new state for optimistic update
          const newProjects = projects.map(p => {
            if (p.id === sourceProjectId || p.id === destProjectId) {
              const newP = { ...p, tasks: [...p.tasks] };
              return newP;
            }
            return p;
          });

          let taskToMove: Task | undefined;
          const sourceProj = newProjects.find(p => p.id === sourceProjectId);
          if (sourceProj) {
            const taskIndex = sourceProj.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
              [taskToMove] = sourceProj.tasks.splice(taskIndex, 1);
            }
          }

          const destProj = newProjects.find(p => p.id === destProjectId);
          if (destProj && taskToMove) {
            taskToMove.project_id = destProjectId;
            destProj.tasks.splice(destIndex, 0, taskToMove);
            
            // Optimistic update
            if (onLocalReorder) onLocalReorder(newProjects);
            
            setSaving(true);
            if (sourceProjectId !== destProjectId) {
              await wbsOps.updateTask(taskId, { project_id: destProjectId });
            }
            const updatedDestProj = newProjects.find(p => p.id === destProjectId);
            if (updatedDestProj) {
              await wbsOps.reorderTasks(updatedDestProj.tasks.map(t => t.id));
            }
          }
        }
      } else if (type === 'SUBTASK') {
        const sourceTaskId = parseInt(source.droppableId.split('-').pop()!);
        const isRowDrop = destination.droppableId.startsWith('task-row-drop-');
        const destTaskId = isRowDrop 
          ? parseInt(destination.droppableId.replace('task-row-drop-', ''))
          : parseInt(destination.droppableId.split('-').pop()!);
        const subtaskId = parseInt(result.draggableId.split('-').pop()!);
        const destIndex = isRowDrop ? 0 : destination.index;

        if (sourceTaskId !== destTaskId || !isRowDrop) {
          // Calculate new state for optimistic update
          let subtaskToMove: any;
          const newProjects = projects.map(p => {
            return {
              ...p,
              tasks: p.tasks.map(t => {
                if (t.id === sourceTaskId || t.id === destTaskId) {
                  const newT = { ...t, subtasks: [...t.subtasks] };
                  return newT;
                }
                return t;
              })
            };
          });

          // Find and remove subtask
          for (const p of newProjects) {
            const sourceT = p.tasks.find(t => t.id === sourceTaskId);
            if (sourceT) {
              const sIndex = sourceT.subtasks.findIndex(s => s.id === subtaskId);
              if (sIndex !== -1) {
                [subtaskToMove] = sourceT.subtasks.splice(sIndex, 1);
                break;
              }
            }
          }

          // Insert subtask
          let destT: any;
          for (const p of newProjects) {
            destT = p.tasks.find(t => t.id === destTaskId);
            if (destT) break;
          }

          if (destT && subtaskToMove) {
            subtaskToMove.task_id = destTaskId;
            destT.subtasks.splice(destIndex, 0, subtaskToMove);

            // Optimistic update
            if (onLocalReorder) onLocalReorder(newProjects);

            setSaving(true);
            if (sourceTaskId !== destTaskId) {
              await wbsOps.updateSubtask(subtaskId, { task_id: destTaskId });
            }
            await wbsOps.reorderSubtasks(destT.subtasks.map((s: any) => s.id));
          }
        }
      }
      // No need to call onUpdate() here because we already updated the state optimistically.
      // But we might want to call it to sync with server just in case, or if other things changed.
      // However, the user wants it to be immediate.
      // If we call onUpdate() immediately after await, it might still cause a slight jump if server returns different order.
      // Let's call it but it will be less disruptive now that the UI has already updated.
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('並び替えの保存に失敗しました');
      // Revert by fetching data
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [projects, onUpdate, setSaving, onLocalReorder]);

  return { onDragEnd };
};
