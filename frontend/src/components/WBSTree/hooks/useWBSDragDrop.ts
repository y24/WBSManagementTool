import { useCallback } from 'react';
import { DropResult } from '@hello-pangea/dnd';
import { wbsOps } from '../../../api/wbsOperations';
import { Project, Task } from '../../../types/wbs';

export const useWBSDragDrop = (
  projects: Project[],
  onUpdate: () => void,
  setSaving: (saving: boolean) => void
) => {
  const onDragEnd = useCallback(async (result: DropResult) => {
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
        const sourceProjectId = parseInt(source.droppableId.split('-').pop()!);
        const isRowDrop = destination.droppableId.startsWith('project-row-drop-');
        const destProjectId = isRowDrop 
          ? parseInt(destination.droppableId.replace('project-row-drop-', ''))
          : parseInt(destination.droppableId.split('-').pop()!);
        const taskId = parseInt(result.draggableId.split('-').pop()!);
        const destIndex = isRowDrop ? 0 : destination.index;

        if (sourceProjectId !== destProjectId || !isRowDrop) {
          // If moving between projects or reordering within a project
          if (sourceProjectId !== destProjectId) {
            await wbsOps.updateTask(taskId, { project_id: destProjectId });
          }
          
          const destProject = projects.find(p => p.id === destProjectId);
          if (destProject) {
            const newTasks = Array.from(destProject.tasks);
            if (sourceProjectId === destProjectId) {
              const [removed] = newTasks.splice(source.index, 1);
              newTasks.splice(destIndex, 0, removed);
            } else {
              let taskToMove: Task | undefined;
              for (const p of projects) {
                taskToMove = p.tasks.find(t => t.id === taskId);
                if (taskToMove) break;
              }
              if (taskToMove) {
                newTasks.splice(destIndex, 0, taskToMove);
              }
            }
            if (newTasks.length > 0) {
              await wbsOps.reorderTasks(newTasks.map(t => t.id));
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
          if (sourceTaskId !== destTaskId) {
            await wbsOps.updateSubtask(subtaskId, { task_id: destTaskId });
          }

          let destTask: Task | undefined;
          let subtaskToMove: any;
          for (const p of projects) {
            if (!destTask) destTask = p.tasks.find(t => t.id === destTaskId);
            if (!subtaskToMove) {
              for (const t of p.tasks) {
                const s = t.subtasks.find(sub => sub.id === subtaskId);
                if (s) { subtaskToMove = s; break; }
              }
            }
          }

          if (destTask) {
            const newSubtasks = Array.from(destTask.subtasks);
            if (sourceTaskId === destTaskId) {
              const [removed] = newSubtasks.splice(source.index, 1);
              newSubtasks.splice(destIndex, 0, removed);
            } else if (subtaskToMove) {
              newSubtasks.splice(destIndex, 0, subtaskToMove);
            }
            if (newSubtasks.length > 0) {
              await wbsOps.reorderSubtasks(newSubtasks.map(s => s.id));
            }
          }
        }
      }
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('並び替えの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [projects, onUpdate, setSaving]);

  return { onDragEnd };
};
