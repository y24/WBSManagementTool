import { useState, useCallback, useMemo } from 'react';
import { Project, Task } from '../../../types/wbs';

export const useWBSSelection = (projects: Project[]) => {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

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

  const { selectedCounts, totalSelectedCount, selectedIds, minimalIds } = useMemo(() => {
    let pCount = 0;
    let tCount = 0;
    let sCount = 0;
    const pIds: number[] = [];
    const tIds: number[] = [];
    const sIds: number[] = [];
    const minPIds: number[] = [];
    const minTIds: number[] = [];
    const minSIds: number[] = [];

    projects.forEach(p => {
      const pChecked = !!checkedIds[`p-${p.id}`];
      if (pChecked) {
        pCount++;
        pIds.push(p.id);
        minPIds.push(p.id);
      }
      p.tasks.forEach(t => {
        const tChecked = !!checkedIds[`t-${t.id}`];
        if (tChecked) {
          tCount++;
          tIds.push(t.id);
          if (!pChecked) minTIds.push(t.id);
        }
        t.subtasks.forEach(s => {
          const sChecked = !!checkedIds[`s-${s.id}`];
          if (sChecked) {
            sCount++;
            sIds.push(s.id);
            if (!pChecked && !tChecked) minSIds.push(s.id);
          }
        });
      });
    });

    return {
      selectedCounts: { pCount, tCount, sCount },
      totalSelectedCount: pCount + tCount + sCount,
      selectedIds: { pIds, tIds, sIds },
      minimalIds: { pIds: minPIds, tIds: minTIds, sIds: minSIds }
    };
  }, [projects, checkedIds]);

  const clearSelection = useCallback(() => setCheckedIds({}), []);

  return {
    checkedIds,
    setCheckedIds,
    toggleCheckProject,
    toggleCheckTask,
    toggleCheckSubtask,
    selectedCounts,
    totalSelectedCount,
    selectedIds,
    minimalIds,
    clearSelection
  };
};
