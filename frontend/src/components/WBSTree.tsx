import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef } from 'react';
import { List, Layers, ChevronsDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Project, Task, Subtask } from '../types/wbs';
import { InitialData } from '../types';
import { wbsOps } from '../api/wbsOperations';

// Sub-components
import ProjectRow from './WBSTree/ProjectRow';
import TaskRow from './WBSTree/TaskRow';
import SubtaskRow from './WBSTree/SubtaskRow';
import DetailModal, { EditingType } from './WBSTree/DetailModal';
import FloatingMenu from './WBSTree/FloatingMenu';
import ConfirmModal from './WBSTree/ConfirmModal';
import ShiftDatesModal from './WBSTree/ShiftDatesModal';
import { commonHeaderClasses } from './WBSTree/constants';

interface WBSTreeProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  hidePlanningColumns?: boolean;
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
  hidePlanningColumns = false,
  onScroll
}, ref) => {
  const [saving, setSaving] = useState(false);
  // 詳細編集モーダルの状態（project/task/subtask 共通）
  const [editingItem, setEditingItem] = useState<{
    type: EditingType;
    id: number;
    name: string;
  } | null>(null);
  const [detailValue, setDetailValue] = useState('');
  const [ticketIdValue, setTicketIdValue] = useState('');
  const [memoValue, setMemoValue] = useState('');
  const [workloadPercentValue, setWorkloadPercentValue] = useState('100');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [menuRendered, setMenuRendered] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isShiftDatesModalOpen, setIsShiftDatesModalOpen] = useState(false);
  const [currentMinDate, setCurrentMinDate] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState({ 
    total: 0, 
    detail: '', 
    title: '', 
    confirmText: '', 
    variant: 'danger' as 'danger' | 'warning',
    onConfirm: () => {} 
  });
  const isConfirming = useRef(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // 新しく追加された項目へスクロールするEffect
  useEffect(() => {
    if (lastAddedId) {
      let attempts = 0;
      const scrollInterval = setInterval(() => {
        const element = document.querySelector(`[data-wbs-id="${lastAddedId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setLastAddedId(null);
          clearInterval(scrollInterval);
        } else {
          attempts++;
          if (attempts > 20) { // 最大2秒間試行
            setLastAddedId(null);
            clearInterval(scrollInterval);
          }
        }
      }, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [projects, lastAddedId]);

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

  const handleDeleteSelected = () => {
    if (saving || isConfirmModalOpen) return;
    if (totalSelectedCount === 0) return;

    const detailMsg = `削除対象の内訳: プロジェクト:${selectedCounts.pCount}, タスク:${selectedCounts.tCount}, サブタスク:${selectedCounts.sCount}`;
    setConfirmData({ 
      total: totalSelectedCount, 
      detail: detailMsg,
      title: '項目の削除確認',
      confirmText: '削除を実行する',
      variant: 'danger',
      onConfirm: executeDelete
    });
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    setIsConfirmModalOpen(false);
    setSaving(true);
    
    try {
      const promises = [
        ...minimalIds.pIds.map(id => wbsOps.deleteProject(id)),
        ...minimalIds.tIds.map(id => wbsOps.deleteTask(id)),
        ...minimalIds.sIds.map(id => wbsOps.deleteSubtask(id))
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

  const handleClearActualsSelected = () => {
    if (saving || isConfirmModalOpen) return;
    if (totalSelectedCount === 0) return;

    const detailMsg = `クリア対象の内訳: プロジェクト:${selectedCounts.pCount}, タスク:${selectedCounts.tCount}, サブタスク:${selectedCounts.sCount}\n\n対象の実績開始、レビュー開始、実績終了、実績工数、進捗が消去されます。`;
    
    setConfirmData({ 
      total: totalSelectedCount, 
      detail: detailMsg,
      title: '実績値のクリア確認',
      confirmText: '実績値をクリアする',
      variant: 'warning',
      onConfirm: () => executeClearActuals(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds)
    });
    setIsConfirmModalOpen(true);
  };

  const executeClearActuals = async (pIds: number[], tIds: number[], sIds: number[]) => {
    setIsConfirmModalOpen(false);
    setSaving(true);
    try {
      await wbsOps.clearActuals(pIds, tIds, sIds);
      setCheckedIds({});
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('クリア中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateSelected = async () => {
    if (saving || totalSelectedCount === 0) return;

    setSaving(true);
    try {
      await wbsOps.duplicateItems(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds);
      setCheckedIds({});
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('複製中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleShiftDatesSelected = () => {
    if (saving || isShiftDatesModalOpen) return;
    if (totalSelectedCount === 0) return;

    // 起点となる最小の日付を探す
    let minDate: string | null = null;
    const updateMinDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return;
      if (!minDate || dateStr < minDate) {
        minDate = dateStr;
      }
    };

    projects.forEach(p => {
      const isPChecked = checkedIds[`p-${p.id}`];
      if (isPChecked) {
        updateMinDate(p.planned_start_date);
        updateMinDate(p.planned_end_date);
        updateMinDate(p.actual_start_date);
        updateMinDate(p.actual_end_date);
      }
      p.tasks.forEach(t => {
        const isTChecked = checkedIds[`t-${t.id}`] || isPChecked;
        if (isTChecked) {
          updateMinDate(t.planned_start_date);
          updateMinDate(t.planned_end_date);
          updateMinDate(t.actual_start_date);
          updateMinDate(t.actual_end_date);
        }
        t.subtasks.forEach(s => {
          const isSChecked = checkedIds[`s-${s.id}`] || isTChecked;
          if (isSChecked) {
            updateMinDate(s.planned_start_date);
            updateMinDate(s.planned_end_date);
            updateMinDate(s.actual_start_date);
            updateMinDate(s.review_start_date);
            updateMinDate(s.actual_end_date);
          }
        });
      });
    });

    if (!minDate) {
      alert('日付が設定されている項目がありません。');
      return;
    }

    setCurrentMinDate(minDate);
    setIsShiftDatesModalOpen(true);
  };

  const executeShiftDates = async (newBaseDate: string) => {
    setIsShiftDatesModalOpen(false);
    setSaving(true);
    try {
      await wbsOps.shiftDates(selectedIds.pIds, selectedIds.tIds, selectedIds.sIds, newBaseDate);
      setCheckedIds({});
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('日付の移動中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const getInitialNameWidth = (): number => {
    const saved = localStorage.getItem('wbs_name_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 320;
  };

  const [nameWidth, setNameWidth] = useState(getInitialNameWidth);

  // 状態の保存用Effect
  useEffect(() => {
    localStorage.setItem('wbs_name_width', nameWidth.toString());
  }, [nameWidth]);

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

  const handleProjectLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = false;
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks({});
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const handleTaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => {
        newExpandedTasks[t.id] = false;
      });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const handleSubtaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => {
        newExpandedTasks[t.id] = true;
      });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const handleAddProject = useCallback(async () => {
    try {
      setSaving(true);
      const res = await wbsOps.createProject('新しいプロジェクト');
      if (res.data && res.data.id) {
        setLastAddedId(`p-${res.data.id}`);
      }
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('プロジェクトの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    const handler = () => handleAddProject();
    window.addEventListener('add-project', handler);
    return () => window.removeEventListener('add-project', handler);
  }, [handleAddProject]);

  const handleUpdate = useCallback(async (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => {
    // Date range validation
    if (['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].includes(field)) {
      let item: any = null;
      if (type === 'project') item = projects.find(p => p.id === id);
      else if (type === 'task') {
        for (const p of projects) {
          item = p.tasks.find(t => t.id === id);
          if (item) break;
        }
      } else {
        for (const p of projects) {
          for (const t of p.tasks) {
            item = t.subtasks.find(s => s.id === id);
            if (item) break;
          }
          if (item) break;
        }
      }

      if (item) {
        const isPlanned = field.startsWith('planned');
        const isStart = field.endsWith('start_date');
        const otherField = isStart 
          ? (isPlanned ? 'planned_end_date' : 'actual_end_date')
          : (isPlanned ? 'planned_start_date' : 'actual_start_date');
        
        const startVal = isStart ? value : item[otherField];
        const endVal = isStart ? item[otherField] : value;

        if (startVal && endVal && startVal > endVal) {
          alert('開始日より後の日付を終了日に設定してください。');
          onUpdate(); // Revert local state by refreshing
          setSaving(false);
          return;
        }
      }
    }

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
      alert('保存に失敗しました。開始日より後の日付を設定してください。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, initialData, projects]);

  const handleAddTask = useCallback(async (projectId: number) => {
    try {
      setSaving(true);
      const res = await wbsOps.createTask(projectId, '新しいタスク');
      if (res.data && res.data.id) {
        setLastAddedId(`t-${res.data.id}`);
      }
      setExpandedProjects(p => ({ ...p, [projectId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('タスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [onUpdate, setExpandedProjects]);

  const handleAddSubtask = useCallback(async (taskId: number) => {
    if (!initialData) return;
    try {
      setSaving(true);
      const typeId = null;
      const newStatus = initialData.statuses.find(s => s.status_name === 'New') || initialData.statuses[0];
      const statusId = newStatus?.id || 1;
      const res = await wbsOps.createSubtask(taskId, typeId, statusId);
      if (res.data && res.data.id) {
        setLastAddedId(`s-${res.data.id}`);
      }
      setExpandedTasks(t => ({ ...t, [taskId]: true }));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('サブタスクの追加に失敗しました。');
    } finally {
      setSaving(false);
    }
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
      className="flex-1 w-full overflow-auto bg-white dark:bg-slate-900 border-r dark:border-slate-800 relative no-scrollbar transition-colors"
      onScroll={onScroll}
    >
      <div className="min-w-max">
        {saving && (
          <div className="absolute top-1 right-2 z-50">
            <span className="text-[10px] text-blue-500 font-medium">Saving...</span>
          </div>
        )}

        <div className="sticky top-0 z-30 flex border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm whitespace-nowrap h-[33px] transition-colors">
          <div
            className={`sticky left-0 z-40 flex items-center bg-slate-100 dark:bg-slate-800 ${commonHeaderClasses}`}
            style={{ width: nameWidth, minWidth: nameWidth }}
          >
            <div className="flex items-center gap-1 mr-2 no-drag ml-1">
              <button
                onClick={handleProjectLevel}
                className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="プロジェクトレベルで表示 (全プロジェクトを折りたたむ)"
              >
                <List size={16} />
              </button>
              <button
                onClick={handleTaskLevel}
                className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="タスクレベルで表示 (プロジェクトを展開、タスクを折りたたむ)"
              >
                <Layers size={16} />
              </button>
              <button
                onClick={handleSubtaskLevel}
                className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="サブタスクレベルで表示 (すべて展開)"
              >
                <ChevronsDown size={16} />
              </button>
            </div>
            名称
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
              onMouseDown={startResizing}
            />
          </div>
          <div className={`w-28 flex items-center ${commonHeaderClasses}`}>ステータス</div>
          <div className={`w-28 flex items-center ${commonHeaderClasses}`}>担当者</div>
          {!hidePlanningColumns && (
            <>
              <div className={`w-20 flex items-center ${commonHeaderClasses}`}>レビュー日数</div>
              <div className={`w-20 flex items-center ${commonHeaderClasses}`}>開始(計画)</div>
              <div className={`w-20 flex items-center ${commonHeaderClasses}`}>終了(計画)</div>
              <div className={`w-16 flex items-center ${commonHeaderClasses}`}>予定工数</div>
            </>
          )}
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>開始(実績)</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>レビュー開始</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>終了(実績)</div>
          <div className={`w-16 flex items-center ${commonHeaderClasses}`}>実績工数</div>
          <div className={`w-24 flex items-center ${commonHeaderClasses}`}>進捗</div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="projects-root" type="PROJECT">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="min-w-max">
                {projects.map((project, pIndex) => (
                  <Draggable key={`p-${project.id}`} draggableId={`p-${project.id}`} index={pIndex}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`p-${project.id}`}>
                        <ProjectRow 
                          project={project}
                          nameWidth={nameWidth}
                          checked={!!checkedIds[`p-${project.id}`]}
                          onToggleCheck={() => toggleCheckProject(project)}
                          onToggleExpand={() => toggleProject(project.id)}
                          expanded={expandedProjects[project.id] !== false}
                          onUpdateField={handleUpdate}
                          onAddTask={() => handleAddTask(project.id)}
                            onEditDetail={() => {
                              setEditingItem({ type: 'project', id: project.id, name: project.project_name });
                              setDetailValue(project.detail || '');
                               setTicketIdValue(project.ticket_id != null ? String(project.ticket_id) : '');
                               setMemoValue(project.memo || '');
                               setWorkloadPercentValue('100');
                             }}
                            initialData={initialData}
                            provided={provided}
                            hidePlanningColumns={hidePlanningColumns}
                          />

                        {expandedProjects[project.id] !== false && (
                          <Droppable droppableId={`project-${project.id}`} type="TASK">
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                {project.tasks.map((task, tIndex) => (
                                  <Draggable key={`t-${task.id}`} draggableId={`t-${task.id}`} index={tIndex}>
                                    {(provided) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`t-${task.id}`}>
                                        <TaskRow 
                                          task={task}
                                          nameWidth={nameWidth}
                                          checked={!!checkedIds[`t-${task.id}`]}
                                          onToggleCheck={() => toggleCheckTask(task)}
                                          onToggleExpand={() => toggleTask(task.id)}
                                          expanded={expandedTasks[task.id] !== false}
                                          onUpdateField={handleUpdate}
                                          onAddSubtask={() => handleAddSubtask(task.id)}
                                            onEditDetail={() => {
                                              setEditingItem({ type: 'task', id: task.id, name: task.task_name });
                                              setDetailValue(task.detail || '');
                                               setTicketIdValue(task.ticket_id != null ? String(task.ticket_id) : '');
                                               setMemoValue(task.memo || '');
                                               setWorkloadPercentValue('100');
                                             }}
                                            initialData={initialData}
                                            provided={provided}
                                            hidePlanningColumns={hidePlanningColumns}
                                          />

                                        {expandedTasks[task.id] !== false && (
                                          <Droppable droppableId={`task-${task.id}`} type="SUBTASK">
                                            {(provided) => (
                                              <div {...provided.droppableProps} ref={provided.innerRef}>
                                                {task.subtasks.map((subtask, sIndex) => {
                                                  return (
                                                    <Draggable key={`s-${subtask.id}`} draggableId={`s-${subtask.id}`} index={sIndex}>
                                                      {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`s-${subtask.id}`}>
                                                          <SubtaskRow 
                                                            subtask={subtask}
                                                            nameWidth={nameWidth}
                                                            checked={!!checkedIds[`s-${subtask.id}`]}
                                                            onToggleCheck={() => toggleCheckSubtask(subtask.id)}
                                                            initialData={initialData}
                                                            onUpdateField={handleUpdate}
                                                            onEditDetail={() => {
                                                              // initialDataからサブタスク種別名を取得
                                                              const typeName = initialData?.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name || '未設定';
                                                              const displayName = subtask.subtask_detail ? `${typeName}(${subtask.subtask_detail})` : typeName;
                                                              setEditingItem({ type: 'subtask', id: subtask.id, name: displayName });
                                                              setDetailValue(subtask.subtask_detail || '');
                                                              setTicketIdValue(subtask.ticket_id != null ? String(subtask.ticket_id) : '');
                                                              setMemoValue(subtask.memo || '');
                                                              setWorkloadPercentValue(subtask.workload_percent != null ? String(subtask.workload_percent) : '100');
                                                            }}
                                                            provided={provided}
                                                            hidePlanningColumns={hidePlanningColumns}
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
          <div className="p-8 text-center text-gray-500 dark:text-slate-500 w-full col-span-full">
            上部のボタンからプロジェクトを追加してください。
          </div>
        )}
      </div>

      {editingItem && (
        <DetailModal
          editingType={editingItem.type}
          editingName={editingItem.name}
          detailValue={detailValue}
          setDetailValue={setDetailValue}
          ticketIdValue={ticketIdValue}
          setTicketIdValue={setTicketIdValue}
          memoValue={memoValue}
           setMemoValue={setMemoValue}
           workloadPercentValue={workloadPercentValue}
           setWorkloadPercentValue={setWorkloadPercentValue}
           ticketUrlTemplate={initialData?.ticket_url_template}
          onClose={() => setEditingItem(null)}
          onSave={async () => {
            const updates: Record<string, any> = {
              ticket_id: ticketIdValue !== '' ? parseInt(ticketIdValue, 10) : null,
              memo: memoValue || null,
            };
            // subtask_detail は subtask のみ、project/task は detail フィールド
             if (editingItem.type === 'subtask') {
               updates.subtask_detail = detailValue || null;
               updates.workload_percent = workloadPercentValue !== '' ? parseInt(workloadPercentValue, 10) : 100;
             } else {
               updates.detail = detailValue || null;
             }
            try {
              setSaving(true);
              if (editingItem.type === 'project') await wbsOps.updateProject(editingItem.id, updates);
              else if (editingItem.type === 'task') await wbsOps.updateTask(editingItem.id, updates);
              else await wbsOps.updateSubtask(editingItem.id, updates);
              setEditingItem(null);
              onUpdate();
            } catch (err) {
              console.error(err);
              alert('保存に失敗しました');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      <FloatingMenu 
        totalSelectedCount={totalSelectedCount}
        onDelete={handleDeleteSelected}
        onDuplicate={handleDuplicateSelected}
        onClearActuals={handleClearActualsSelected}
        onShiftDates={handleShiftDatesSelected}
        onClear={() => setCheckedIds({})}
        menuRendered={menuRendered}
        loading={saving}
      />

      <ShiftDatesModal
        isOpen={isShiftDatesModalOpen}
        onClose={() => setIsShiftDatesModalOpen(false)}
        onConfirm={executeShiftDates}
        currentMinDate={currentMinDate}
        totalSelectedCount={totalSelectedCount}
      />

      <ConfirmModal 
        isOpen={isConfirmModalOpen}
        totalCount={confirmData.total}
        title={confirmData.title}
        description={confirmData.detail}
        confirmText={confirmData.confirmText}
        variant={confirmData.variant}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
});

export default WBSTree;
