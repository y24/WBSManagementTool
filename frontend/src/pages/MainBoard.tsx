import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { apiClient } from '../api/client';
import { Project, Task, WBSResponse } from '../types/wbs';
import { InitialData } from '../types';
import WBSTree from '../components/WBSTree';
import GanttChart from '../components/GanttChart';
import FilterPanel, { FilterState, DisplayOptions } from '../components/FilterPanel';

export default function MainBoard() {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. 各種UI状態の初期値をlocalStorageから読み込み
  const getInitialFilters = (): FilterState => {
    const saved = localStorage.getItem('wbs_filters');
    const defaultFilters: FilterState = {
      projectIds: [],
      statusIds: [],
      assigneeIds: [],
      subtaskTypeIds: [],
      onlyDelayed: false,
      searchTerm: '',
    };
    if (saved) {
      try {
        return { ...defaultFilters, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse saved filters', e);
      }
    }
    return defaultFilters;
  };

  const getInitialExpandedProjects = (): Record<number, boolean> => {
    const saved = localStorage.getItem('wbs_expanded_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved expanded projects', e);
      }
    }
    return {};
  };

  const getInitialExpandedTasks = (): Record<number, boolean> => {
    const saved = localStorage.getItem('wbs_expanded_tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved expanded tasks', e);
      }
    }
    return {};
  };

  const getInitialTreeWidth = (): number => {
    const saved = localStorage.getItem('wbs_tree_width');
    let width = 1000;
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) width = parsed;
    }

    // アプリ起動時に画面幅を超えていないかチェック
    // リサイズバーとガントチャートが最低限（100px程度）見えるように調整
    if (typeof window !== 'undefined') {
      const maxWidth = window.innerWidth - 100;
      if (width > maxWidth) {
        return Math.max(300, maxWidth);
      }
    }
    return width;
  };

  const getInitialGanttScrollLeft = (): number => {
    const saved = localStorage.getItem('wbs_gantt_scroll_left');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  };

  // フィルター状態
  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  
  // 表示設定
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(() => {
    const saved = localStorage.getItem('wbs_display_options');
    const defaultOptions: DisplayOptions = { 
      showProjectRange: true,
      showTodayHighlight: true,
      showRemoved: false,
      showDoneProjects: false
    };
    if (saved) {
      try {
        return { ...defaultOptions, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return defaultOptions;
  });

  // ツリー展開ステートのリフトアップ
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(getInitialExpandedProjects);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(getInitialExpandedTasks);

  // レイアウトの幅調整
  const [treeWidth, setTreeWidth] = useState(getInitialTreeWidth);
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

  // 状態の保存用Effect
  useEffect(() => {
    localStorage.setItem('wbs_filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('wbs_expanded_projects', JSON.stringify(expandedProjects));
  }, [expandedProjects]);

  useEffect(() => {
    localStorage.setItem('wbs_expanded_tasks', JSON.stringify(expandedTasks));
  }, [expandedTasks]);

  useEffect(() => {
    localStorage.setItem('wbs_tree_width', treeWidth.toString());
  }, [treeWidth]);

  useEffect(() => {
    localStorage.setItem('wbs_display_options', JSON.stringify(displayOptions));
  }, [displayOptions]);

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
        if (!displayOptions.showRemoved && project.status_id === removedStatusId) return false;

        // 3. 完了済項目の非表示（デフォルト）
        if (!displayOptions.showDoneProjects && doneStatusId !== null && project.status_id === doneStatusId) return false;

        return true;
      })
      .map(project => {
        const isProjectRemoved = project.status_id === removedStatusId;

        // タスク・サブタスクの絞り込み
        const filteredTasks = project.tasks.map(task => {
          const isTaskRemoved = task.status_id === removedStatusId;
          
          // 親がRemovedなら、!showRemovedのときは表示されないはずだが、念のためここでもチェック
          if (!displayOptions.showRemoved && (isProjectRemoved || isTaskRemoved)) return null;

          const filteredSubtasks = task.subtasks.filter(subtask => {
            // 親(Project or Task)がRemoved、または自身がRemovedな場合、!showRemovedなら非表示
            if (!displayOptions.showRemoved && (isProjectRemoved || isTaskRemoved || subtask.status_id === removedStatusId)) return false;

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
  }, [data, filters, initialData, displayOptions]);

  // フィルタ後のガントチャート表示期間の再計算
  const dynamicGanttRange = useMemo(() => {
    if (!data || !data.gantt_range || !filteredProjects.length) return data?.gantt_range;

    const todayStr = data.gantt_range.today;
    const today = new Date(todayStr);
    
    let allDates: Date[] = [];

    const collectDates = (item: any) => {
      if (item.planned_start_date) allDates.push(new Date(item.planned_start_date));
      if (item.planned_end_date) allDates.push(new Date(item.planned_end_date));
      if (item.actual_start_date) allDates.push(new Date(item.actual_start_date));
      if (item.actual_end_date) allDates.push(new Date(item.actual_end_date));
    };

    filteredProjects.forEach(p => {
      collectDates(p);
      p.tasks.forEach(t => {
        collectDates(t);
        t.subtasks.forEach(s => {
          collectDates(s);
        });
      });
    });

    if (allDates.length === 0) return data.gantt_range;

    const minDateTs = Math.min(...allDates.map(d => d.getTime()));
    const maxDateTs = Math.max(...allDates.map(d => d.getTime()));
    
    const minDate = new Date(minDateTs);
    const maxDate = new Date(maxDateTs);

    const startDate = subDays(new Date(Math.min(minDate.getTime(), today.getTime())), 7);
    
    const weeks = 8;
    const targetEndDate = new Date(Math.max(
      addDays(maxDate, 14).getTime(),
      addDays(today, weeks * 7).getTime()
    ));

    return {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(targetEndDate, 'yyyy-MM-dd'),
      today: todayStr
    };
  }, [data, filteredProjects]);

  // ガントチャートの初期スクロール位置の復元
  useEffect(() => {
    if (!loading && data && ganttRef.current) {
      const initialScrollLeft = getInitialGanttScrollLeft();
      if (initialScrollLeft > 0) {
        // レンダリングが完了するのを少し待ってからスクロールを適用
        const timer = setTimeout(() => {
          if (ganttRef.current) {
            ganttRef.current.scrollLeft = initialScrollLeft;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, !!data, !!dynamicGanttRange]); // dataとdynamicGanttRangeの存在を監視

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
    const { scrollTop, scrollLeft } = e.currentTarget;
    
    // 垂直スクロールの同期
    if (treeRef.current && Math.abs(treeRef.current.scrollTop - scrollTop) > 0.5) {
      treeRef.current.scrollTop = scrollTop;
    }
    
    // 水平スクロール位置の保存
    localStorage.setItem('wbs_gantt_scroll_left', scrollLeft.toString());
  };

  if (loading && !data) return <div className="p-4 text-gray-500 font-medium">Loading WBS...</div>;

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 overflow-hidden">
      {/* フィルターパネル */}
      <FilterPanel 
        filters={filters}
        setFilters={setFilters}
        displayOptions={displayOptions}
        setDisplayOptions={setDisplayOptions}
        projects={data?.projects || []}
        initialData={initialData}
        onClear={() => setFilters({
          projectIds: [],
          statusIds: [],
          assigneeIds: [],
          subtaskTypeIds: [],
          onlyDelayed: false,
          searchTerm: '',
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
          {dynamicGanttRange && (
            <GanttChart 
              ref={ganttRef}
              projects={filteredProjects} 
              initialData={initialData}
              range={dynamicGanttRange}
              expandedProjects={expandedProjects}
              expandedTasks={expandedTasks}
              showProjectRange={displayOptions.showProjectRange}
              showTodayHighlight={displayOptions.showTodayHighlight}
              onScroll={handleGanttScroll}
            />
          )}
        </div>
      </div>
    </div>
  );
}
