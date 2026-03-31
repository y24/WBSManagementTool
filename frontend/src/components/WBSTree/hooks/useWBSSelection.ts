import { useState, useCallback, useMemo } from 'react';
import { Project, Task } from '../../../types/wbs';

export const useWBSSelection = (projects: Project[]) => {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [lastCheckedId, setLastCheckedId] = useState<string | null>(null);

  // 全てのIDを順番に並べたフラットなリスト
  const allIds = useMemo(() => {
    const ids: string[] = [];
    projects.forEach(p => {
      ids.push(`p-${p.id}`);
      p.tasks.forEach(t => {
        ids.push(`t-${t.id}`);
        t.subtasks.forEach(s => {
          ids.push(`s-${s.id}`);
        });
      });
    });
    return ids;
  }, [projects]);

  // 指定されたIDとその子要素すべてにチェック状態を適用するヘルパー
  const applyCheck = useCallback((newChecked: Record<string, boolean>, id: string, isChecked: boolean) => {
    newChecked[id] = isChecked;
    if (id.startsWith('p-')) {
      const pId = parseInt(id.substring(2));
      const project = projects.find(p => p.id === pId);
      if (project) {
        project.tasks.forEach(task => {
          newChecked[`t-${task.id}`] = isChecked;
          task.subtasks.forEach(subtask => {
            newChecked[`s-${subtask.id}`] = isChecked;
          });
        });
      }
    } else if (id.startsWith('t-')) {
      const tId = parseInt(id.substring(2));
      
      // taskを探す (全プロジェクトを検索)
      let foundTask: Task | undefined;
      for (const p of projects) {
        const t = p.tasks.find(tk => tk.id === tId);
        if (t) {
          foundTask = t;
          break;
        }
      }

      if (foundTask) {
        foundTask.subtasks.forEach(subtask => {
          newChecked[`s-${subtask.id}`] = isChecked;
        });
      }
    }
  }, [projects]);

  // Shiftキー押下時の範囲選択ロジック
  const handleShiftSelect = useCallback((targetId: string, isChecked: boolean, newChecked: Record<string, boolean>) => {
    if (lastCheckedId && lastCheckedId !== targetId) {
      const lastIdx = allIds.indexOf(lastCheckedId);
      const currentIdx = allIds.indexOf(targetId);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangeIds = allIds.slice(start, end + 1);
        rangeIds.forEach(id => {
          applyCheck(newChecked, id, isChecked);
        });
        return true;
      }
    }
    return false;
  }, [allIds, lastCheckedId, applyCheck]);

  const toggleCheckProject = useCallback((project: Project, isShift: boolean = false) => {
    const id = `p-${project.id}`;
    setCheckedIds(prev => {
      const isChecked = !prev[id];
      const newChecked = { ...prev };
      
      const handled = isShift ? handleShiftSelect(id, isChecked, newChecked) : false;
      if (!handled) {
        applyCheck(newChecked, id, isChecked);
      }
      
      return newChecked;
    });
    setLastCheckedId(id);
  }, [handleShiftSelect, applyCheck]);

  const toggleCheckTask = useCallback((task: Task, isShift: boolean = false) => {
    const id = `t-${task.id}`;
    setCheckedIds(prev => {
      const isChecked = !prev[id];
      const newChecked = { ...prev };
      
      const handled = isShift ? handleShiftSelect(id, isChecked, newChecked) : false;
      if (!handled) {
        applyCheck(newChecked, id, isChecked);
      }
      
      return newChecked;
    });
    setLastCheckedId(id);
  }, [handleShiftSelect, applyCheck]);

  const toggleCheckSubtask = useCallback((subtaskId: number, isShift: boolean = false) => {
    const id = `s-${subtaskId}`;
    setCheckedIds(prev => {
      const isChecked = !prev[id];
      const newChecked = { ...prev };
      
      const handled = isShift ? handleShiftSelect(id, isChecked, newChecked) : false;
      if (!handled) {
        newChecked[id] = isChecked;
      }
      
      return newChecked;
    });
    setLastCheckedId(id);
  }, [handleShiftSelect]);

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

  const clearSelection = useCallback(() => {
    setCheckedIds({});
    setLastCheckedId(null);
  }, []);

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
