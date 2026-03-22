import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiClient } from '../api/client';
import { Project, Task, WBSResponse } from '../types/wbs';
import { InitialData } from '../types';
import WBSTree from '../components/WBSTree';
import GanttChart from '../components/GanttChart';
import FilterPanel, { FilterState } from '../components/FilterPanel';

export default function MainBoard() {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  // フィルター状態
  const [filters, setFilters] = useState<FilterState>({
    projectIds: [],
    statusIds: [],
    assigneeIds: [],
    subtaskTypeIds: [],
    onlyDelayed: false,
    searchTerm: '',
    showRemoved: false,
    showDoneProjects: false,
  });

  // ツリー展開ステートのリフトアップ
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});

  // レイアウトの幅調整
  const [treeWidth, setTreeWidth] = useState(1000);
  const [isResizing, setIsResizing] = useState(false);

  // ガントとツリーのスクロール同期（DOM直接操作用Ref）
  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial || !data) setLoading(true);
      
      const wbsRes = await apiClient.get<WBSResponse>('/wbs');
      setData(wbsRes.data);

      // マスタデータは初回または未取得時のみ取得
      if (isInitial || !initialData) {
        const initRes = await apiClient.get<InitialData>('/initial-data');
        setInitialData(initRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [data, initialData]);

  useEffect(() => {
    fetchData(true);
  }, []);

  // フィルタリングロジック
  const filteredProjects = useMemo(() => {
    if (!data || !data.projects) return [];

    const todayStr = data.gantt_range?.today || new Date().toISOString().split('T')[0];
    const doneStatusId = initialData?.status_mapping_done ? parseInt(initialData.status_mapping_done) : null;
    const removedStatusId = initialData?.statuses.find(s => s.status_name === 'Removed')?.id || 7; // Default 7 if not found
    
    const hasConditions = filters.statusIds.length > 0 || 
                          filters.assigneeIds.length > 0 || 
                          filters.subtaskTypeIds.length > 0 ||
                          filters.onlyDelayed || 
                          filters.searchTerm !== '';

    return data.projects
      .filter(project => {
        // 1. プロジェクトIDによる抽出
        if (filters.projectIds.length > 0 && !filters.projectIds.includes(project.id)) return false;

        // 2. Removed項目の除外
        if (!filters.showRemoved && project.status_id === removedStatusId) return false;

        // 3. 完了済項目の非表示（デフォルト）
        if (!filters.showDoneProjects && doneStatusId !== null && project.status_id === doneStatusId) return false;

        return true;
      })
      .map(project => {
        const isProjectRemoved = project.status_id === removedStatusId;

        // タスク・サブタスクの絞り込み
        const filteredTasks = project.tasks.map(task => {
          const isTaskRemoved = task.status_id === removedStatusId;
          
          // 親がRemovedなら、!showRemovedのときは表示されないはずだが、念のためここでもチェック
          if (!filters.showRemoved && (isProjectRemoved || isTaskRemoved)) return null;

          const filteredSubtasks = task.subtasks.filter(subtask => {
            // 親(Project or Task)がRemoved、または自身がRemovedな場合、!showRemovedなら非表示
            if (!filters.showRemoved && (isProjectRemoved || isTaskRemoved || subtask.status_id === removedStatusId)) return false;

            // ステータス
            if (filters.statusIds.length > 0 && !filters.statusIds.includes(subtask.status_id)) return false;
            // 担当者
            if (filters.assigneeIds.length > 0 && (!subtask.assignee_id || !filters.assigneeIds.includes(subtask.assignee_id))) return false;
            // サブタスク種別
            if (filters.subtaskTypeIds.length > 0 && !filters.subtaskTypeIds.includes(subtask.subtask_type_id)) return false;
            // 遅延
            if (filters.onlyDelayed) {
              const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
              const isDelayed = !isDone && subtask.planned_end_date && subtask.planned_end_date < todayStr;
              if (!isDelayed) return false;
            }
            // 検索
            if (filters.searchTerm) {
              const term = filters.searchTerm.toLowerCase();
              const detailMatch = (subtask.subtask_detail || '').toLowerCase().includes(term);
              const typeName = initialData?.subtask_types.find(t => t.id === subtask.subtask_type_id)?.type_name || '';
              const typeMatch = typeName.toLowerCase().includes(term);
              if (!detailMatch && !typeMatch) return false;
            }
            return true;
          });

          // タスク自体の判定
          const taskMatches = (() => {
            // タスクに種別はないため、サブタスク種別フィルタが効いている場合はタスク単体でのマッチは（サブタスクがない限り）しないようにする
            // ただし、タスク自体をどう扱うかは要件次第。ここでは「サブタスク種別が選択されている＝サブタスクを対象としたフィルタ」と解釈し、
            // タスク単体ではマッチしないようにする。
            if (filters.subtaskTypeIds.length > 0) return false;

            if (filters.statusIds.length > 0 && task.status_id && !filters.statusIds.includes(task.status_id)) return false;
            if (filters.assigneeIds.length > 0 && task.assignee_id && !filters.assigneeIds.includes(task.assignee_id)) return false;
            if (filters.onlyDelayed) {
              const isDone = doneStatusId !== null && task.status_id === doneStatusId;
              const isDelayed = !isDone && task.planned_end_date && task.planned_end_date < todayStr;
              if (!isDelayed) return false;
            }
            if (filters.searchTerm) {
              const term = filters.searchTerm.toLowerCase();
              if (!task.task_name.toLowerCase().includes(term)) return false;
            }
            return true;
          })();

          // 条件がある場合、マッチするか、マッチするサブタスクがある場合のみ表示
          if (hasConditions) {
            if (taskMatches || filteredSubtasks.length > 0) {
              return { ...task, subtasks: filteredSubtasks };
            }
            return null;
          }
          return { ...task, subtasks: filteredSubtasks };
        }).filter(Boolean) as Task[];

        // プロジェクト自体の判定（検索語句など）
        const projectMatches = (() => {
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            if (project.project_name.toLowerCase().includes(term)) return true;
          }
          return false;
        })();

        if (hasConditions) {
          if (projectMatches || filteredTasks.length > 0) {
            return { ...project, tasks: filteredTasks };
          }
          return null;
        }

        return { ...project, tasks: filteredTasks };
      })
      .filter(Boolean) as Project[];
  }, [data, filters, initialData]);

  // マウス関連のリサイズイベント制御
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth - 300));
      setTreeWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleTreeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (ganttRef.current && Math.abs(ganttRef.current.scrollTop - e.currentTarget.scrollTop) > 0.5) {
      ganttRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (treeRef.current && Math.abs(treeRef.current.scrollTop - e.currentTarget.scrollTop) > 0.5) {
      treeRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  if (loading && !data) return <div className="p-4 text-gray-500 font-medium">Loading WBS...</div>;

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 overflow-hidden">
      {/* フィルターパネル */}
      <FilterPanel 
        filters={filters}
        setFilters={setFilters}
        projects={data?.projects || []}
        statuses={initialData?.statuses || []}
        members={initialData?.members || []}
        subtaskTypes={initialData?.subtask_types || []}
        onClear={() => setFilters({
          projectIds: [],
          statusIds: [],
          assigneeIds: [],
          subtaskTypeIds: [],
          onlyDelayed: false,
          searchTerm: '',
          showRemoved: false,
          showDoneProjects: false,
        })}
      />

      <div className="flex flex-1 w-full bg-white relative overflow-hidden select-none">
        {/* 左ペイン: WBSツリー */}
        <div 
          className="flex-shrink-0 flex flex-col relative z-20 overflow-hidden" 
          style={{ width: `${treeWidth}px` }}
        >
          <WBSTree 
            ref={treeRef}
            projects={filteredProjects} 
            initialData={initialData} 
            onUpdate={fetchData} 
            expandedProjects={expandedProjects}
            setExpandedProjects={setExpandedProjects}
            expandedTasks={expandedTasks}
            setExpandedTasks={setExpandedTasks}
            onScroll={handleTreeScroll}
          />
        </div>

        {/* リサイズバー */}
        <div 
          className="w-1.5 bg-gray-200 cursor-col-resize hover:bg-blue-400 transition-colors z-30 flex items-center justify-center shrink-0"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        >
        </div>

        {/* 右ペイン: ガントチャート */}
        <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col z-10 w-0">
          {data?.gantt_range && (
            <GanttChart 
              ref={ganttRef}
              projects={filteredProjects} 
              initialData={initialData}
              range={data.gantt_range}
              expandedProjects={expandedProjects}
              expandedTasks={expandedTasks}
              onScroll={handleGanttScroll}
            />
          )}
        </div>
      </div>
    </div>
  );
}
