import { useState, useEffect, useRef, useCallback, UIEvent, useMemo } from 'react';
import { wbsOps } from '../api/wbsOperations';
import { apiClient, getInitialData } from '../api/client';
import { WBSResponse, Project } from '../types/wbs';
import { InitialData } from '../types';
import FilterPanel, { DisplayOptions, FilterState } from '../components/FilterPanel';
import MainBoardContent from './mainboard/MainBoardContent';
import { useFilteredProjects } from './mainboard/useFilteredProjects';
import { useDynamicGanttRange } from './mainboard/useDynamicGanttRange';
import {
  createDefaultFilters,
  getInitialDisplayOptions,
  getInitialExpandedProjects,
  getInitialExpandedTasks,
  getInitialFilters,
  getInitialGanttScrollLeft,
  getInitialTreeWidth,
  persistDisplayOptions,
  persistExpandedProjects,
  persistExpandedTasks,
  persistFilters,
  persistGanttScrollLeft,
  persistTreeWidth,
} from './mainboard/storage';
import { useWebSocket } from '../api/websocket';
import ConfirmModal from '../components/WBSTree/ConfirmModal';
import { Download } from 'lucide-react';
import LoadingOverlay from '../components/LoadingOverlay';
import { parseISO } from 'date-fns';
import { getDateX } from '../utils/ganttUtils';
import { showErrorToastUnlessNetworkError } from '../utils/toast';
import { useCurrentDateString } from '../hooks/useCurrentDateString';

type WBSRefreshOptions = boolean | {
  showLoading?: boolean;
  skipStatusAutoRefresh?: boolean;
  refreshInitialData?: boolean;
  checkTreeVersion?: boolean;
};

export default function MainBoard() {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewSwitchLoading, setViewSwitchLoading] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<DisplayOptions['viewMode'] | null>(null);

  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(getInitialDisplayOptions);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(getInitialExpandedProjects);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(getInitialExpandedTasks);

  const [treeWidth, setTreeWidth] = useState(() => getInitialTreeWidth(displayOptions.viewMode));
  const [isResizing, setIsResizing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef<'tree' | 'gantt' | null>(null);
  const viewSwitchFrameRefs = useRef<number[]>([]);
  const todayScrollAnimationRef = useRef<number | null>(null);
  const initialDataRef = useRef<InitialData | null>(null);
  const wbsTreeVersionRef = useRef<string | null>(null);
  const initialDataVersionRef = useRef<string | null>(null);
  const isAppFocusedRef = useRef(document.hasFocus() && document.visibilityState === 'visible');
  const currentTodayStr = useCurrentDateString();

  const loadInitialData = useCallback(async (forceRefresh = false) => {
    const initRes = await getInitialData({ forceRefresh });
    initialDataRef.current = initRes.data;
    setInitialData(initRes.data);
  }, []);

  const loadInitialDataWithLatestVersion = useCallback(async () => {
    await loadInitialData(true);
    const versionRes = await wbsOps.getWBSVersion();
    initialDataVersionRef.current = versionRes.data.initial_data_version;
  }, [loadInitialData]);

  // Real-time synchronization
  useWebSocket((msg) => {
    if (msg.type === 'connected') {
      if (msg.is_reconnect) {
        console.log('MainBoard received reconnect signal, checking WBS version...');
        fetchData({ checkTreeVersion: true, skipStatusAutoRefresh: true });
      }
      return;
    }

    if (msg.type === 'update') {
      const initialDataEntities = new Set(['status', 'subtask_type', 'member', 'marker']);
      if (msg.entity && initialDataEntities.has(msg.entity)) {
        console.log(`MainBoard received ${msg.entity} update signal, refreshing initial data...`);
        loadInitialDataWithLatestVersion();
        return;
      }

      console.log(`MainBoard received ${msg.type} signal, refreshing WBS...`);
      fetchData({ skipStatusAutoRefresh: !!msg.skip_status_auto_refresh });
    }
  });

  const isFetchingRef = useRef(false);

  const fetchData = useCallback(
    async (options: WBSRefreshOptions = false) => {
      const showLoading = typeof options === 'boolean' ? options : !!options.showLoading;
      const skipStatusAutoRefresh = typeof options === 'object' && !!options.skipStatusAutoRefresh;
      const refreshInitialData = typeof options === 'object' && !!options.refreshInitialData;
      const checkTreeVersion = typeof options === 'object' && !!options.checkTreeVersion;
      let shouldRefreshInitialData = refreshInitialData;
      let forceInitialDataRefresh = refreshInitialData;

      // Prevent concurrent WBS fetches
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (showLoading) setLoading(true);

        if (checkTreeVersion && wbsTreeVersionRef.current) {
          const versionRes = await wbsOps.getWBSVersion();
          if (
            initialDataVersionRef.current &&
            versionRes.data.initial_data_version !== initialDataVersionRef.current
          ) {
            shouldRefreshInitialData = true;
            forceInitialDataRefresh = true;
          }

          if (versionRes.data.tree_version === wbsTreeVersionRef.current) {
            if (shouldRefreshInitialData || !initialDataRef.current) {
              await loadInitialData(forceInitialDataRefresh);
              initialDataVersionRef.current = versionRes.data.initial_data_version;
            }
            return;
          }
        }

        const wbsRes = await wbsOps.getWBS(
          undefined, // projectIds
          true,
          true,
          8,
          !skipStatusAutoRefresh
        );
        setData(wbsRes.data);
        wbsTreeVersionRef.current = wbsRes.data.tree_version;
        initialDataVersionRef.current = wbsRes.data.initial_data_version;

        if (shouldRefreshInitialData || !initialDataRef.current) {
          await loadInitialData(forceInitialDataRefresh);
        }
      } catch (error) {
        console.error(error);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
      }
    },
    [loadInitialData],
  );

  useEffect(() => {
    const checkTreeOnResume = () => {
      if (document.visibilityState !== 'visible') return;

      const isFocused = document.hasFocus();
      if (isFocused && !isAppFocusedRef.current) {
        isAppFocusedRef.current = true;
        fetchData({ checkTreeVersion: true, skipStatusAutoRefresh: true });
      } else if (!isFocused) {
        isAppFocusedRef.current = false;
      }
    };

    const markBlurred = () => {
      isAppFocusedRef.current = false;
    };

    window.addEventListener('focus', checkTreeOnResume);
    window.addEventListener('blur', markBlurred);
    document.addEventListener('visibilitychange', checkTreeOnResume);
    document.addEventListener('pointerdown', checkTreeOnResume, true);

    return () => {
      window.removeEventListener('focus', checkTreeOnResume);
      window.removeEventListener('blur', markBlurred);
      document.removeEventListener('visibilitychange', checkTreeOnResume);
      document.removeEventListener('pointerdown', checkTreeOnResume, true);
    };
  }, [fetchData]);

  useEffect(() => {
    persistFilters(filters);
  }, [filters]);

  useEffect(() => {
    persistExpandedProjects(expandedProjects);
  }, [expandedProjects]);

  useEffect(() => {
    persistExpandedTasks(expandedTasks);
  }, [expandedTasks]);

  useEffect(() => {
    persistTreeWidth(treeWidth, displayOptions.viewMode);
  }, [treeWidth]);

  useEffect(() => {
    setTreeWidth(getInitialTreeWidth(displayOptions.viewMode));
  }, [displayOptions.viewMode]);

  useEffect(() => {
    persistDisplayOptions(displayOptions);
  }, [displayOptions]);

  useEffect(() => {
    if (!viewSwitchLoading || pendingViewMode !== displayOptions.viewMode) return;

    viewSwitchFrameRefs.current.forEach((frameId) => cancelAnimationFrame(frameId));
    viewSwitchFrameRefs.current = [];

    const firstFrameId = requestAnimationFrame(() => {
      const secondFrameId = requestAnimationFrame(() => {
        setViewSwitchLoading(false);
        setPendingViewMode(null);
        viewSwitchFrameRefs.current = [];
      });
      viewSwitchFrameRefs.current = [secondFrameId];
    });
    viewSwitchFrameRefs.current = [firstFrameId];

    return () => {
      viewSwitchFrameRefs.current.forEach((frameId) => cancelAnimationFrame(frameId));
      viewSwitchFrameRefs.current = [];
    };
  }, [displayOptions.viewMode, pendingViewMode, viewSwitchLoading]);

  useEffect(() => {
    fetchData(true);
  }, [displayOptions.showDoneProjects, displayOptions.showRemoved]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('share');
    if (shareToken) {
      const fetchSharedFilters = async () => {
        try {
          const res = await apiClient.get(`/shared-filters/${shareToken}`);
          if (res.data && res.data.filter_data) {
            setFilters(res.data.filter_data);
            // URLからshareパラメータを削除（リロード時に再度適用されるのを防ぐ）
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (error) {
          console.error('Failed to fetch shared filters:', error);
        }
      };
      fetchSharedFilters();
    }
  }, []);

  useEffect(() => {
    if (displayOptions.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [displayOptions.isDarkMode]);

  useEffect(() => {
    const handleRefresh = () => fetchData(true);
    window.addEventListener('refresh-wbs', handleRefresh);
    return () => window.removeEventListener('refresh-wbs', handleRefresh);
  }, [fetchData]);

  const filteredProjects = useFilteredProjects({ data, filters, initialData, displayOptions, currentTodayStr });
  const dynamicGanttRange = useDynamicGanttRange({ data, filteredProjects, currentTodayStr });

  const scrollGanttHorizontally = useCallback((targetScrollLeft: number) => {
    const gantt = ganttRef.current;
    if (!gantt) return;

    if (todayScrollAnimationRef.current !== null) {
      cancelAnimationFrame(todayScrollAnimationRef.current);
      todayScrollAnimationRef.current = null;
    }

    const maxScrollLeft = Math.max(0, gantt.scrollWidth - gantt.clientWidth);
    const boundedTarget = Math.min(maxScrollLeft, Math.max(0, targetScrollLeft));
    const startScrollLeft = gantt.scrollLeft;
    const distance = boundedTarget - startScrollLeft;

    if (Math.abs(distance) < 1) {
      gantt.scrollLeft = boundedTarget;
      return;
    }

    const duration = Math.min(720, Math.max(320, Math.abs(distance) * 0.35));
    const startTime = performance.now();
    const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      gantt.scrollLeft = startScrollLeft + distance * easeOutCubic(progress);

      if (progress < 1) {
        todayScrollAnimationRef.current = requestAnimationFrame(tick);
      } else {
        todayScrollAnimationRef.current = null;
      }
    };

    todayScrollAnimationRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (todayScrollAnimationRef.current !== null) {
        cancelAnimationFrame(todayScrollAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleScrollToToday = () => {
      if (ganttRef.current && dynamicGanttRange?.start_date) {
        const today = new Date();
        const baseDate = parseISO(dynamicGanttRange.start_date);
        const scrollX = getDateX(today, baseDate, displayOptions.ganttScale);
        
        // Center the today date in the visible area
        const containerWidth = ganttRef.current.clientWidth;
        const targetScroll = Math.max(0, scrollX - containerWidth / 2);

        scrollGanttHorizontally(targetScroll);
      }
    };
    
    window.addEventListener('gantt-scroll-to-today', handleScrollToToday);
    return () => window.removeEventListener('gantt-scroll-to-today', handleScrollToToday);
  }, [dynamicGanttRange, displayOptions.ganttScale, scrollGanttHorizontally]);

  useEffect(() => {
    if (!loading && data && ganttRef.current) {
      const initialScrollLeft = getInitialGanttScrollLeft();
      if (initialScrollLeft > 0) {
        const timer = setTimeout(() => {
          if (ganttRef.current) {
            ganttRef.current.scrollLeft = initialScrollLeft;
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [loading, data, dynamicGanttRange]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(event.clientX, window.innerWidth - 300));
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

  const syncVerticalScroll = (
    source: HTMLDivElement,
    target: HTMLDivElement,
    sourceType: 'tree' | 'gantt',
    targetType: 'tree' | 'gantt',
  ) => {
    if (syncLockRef.current === sourceType) return;

    const sourceMaxScrollTop = Math.max(0, source.scrollHeight - source.clientHeight);
    const targetMaxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);

    if (sourceMaxScrollTop === 0 || targetMaxScrollTop === 0) {
      if (Math.abs(target.scrollTop) > 0.5) {
        syncLockRef.current = targetType;
        target.scrollTop = 0;
        requestAnimationFrame(() => {
          if (syncLockRef.current === targetType) {
            syncLockRef.current = null;
          }
        });
      }
      return;
    }

    const scrollRatio = source.scrollTop / sourceMaxScrollTop;
    const nextTargetScrollTop = Math.min(targetMaxScrollTop, scrollRatio * targetMaxScrollTop);

    if (Math.abs(target.scrollTop - nextTargetScrollTop) > 0.5) {
      syncLockRef.current = targetType;
      target.scrollTop = nextTargetScrollTop;
      requestAnimationFrame(() => {
        if (syncLockRef.current === targetType) {
          syncLockRef.current = null;
        }
      });
    }
  };

  const localUpdate = useCallback((type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, any>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map(p => {
          if (type === 'project' && p.id === id) return { ...p, ...updates };
          return {
            ...p,
            tasks: p.tasks.map(t => {
              if (type === 'task' && t.id === id) return { ...t, ...updates };
              return {
                ...t,
                subtasks: t.subtasks.map(s => {
                  if (type === 'subtask' && s.id === id) return { ...s, ...updates };
                  return s;
                })
              };
            })
          };
        })
      };
    });
  }, []);

  const localReorder = useCallback((newProjects: Project[]) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: newProjects
      };
    });
  }, []);

  const handleTreeScroll = (event: UIEvent<HTMLDivElement>) => {
    if (ganttRef.current) {
      syncVerticalScroll(event.currentTarget, ganttRef.current, 'tree', 'gantt');
    }
  };

  const handleGanttScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft } = event.currentTarget;

    if (treeRef.current) {
      syncVerticalScroll(event.currentTarget, treeRef.current, 'gantt', 'tree');
    }

    persistGanttScrollLeft(scrollLeft);
  };

  const counts = useMemo(() => {
    let projectCount = 0;
    let taskCount = 0;
    let subtaskCount = 0;

    filteredProjects.forEach(p => {
      projectCount++;
      p.tasks.forEach(t => {
        taskCount++;
        subtaskCount += t.subtasks.length;
      });
    });

    return {
      projectCount,
      taskCount,
      subtaskCount,
      total: projectCount + taskCount + subtaskCount
    };
  }, [filteredProjects]);

  const handleExport = async () => {
    setIsExportModalOpen(false);
    try {
      const response = await wbsOps.exportWBS(filteredProjects);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const today = currentTodayStr.replace(/-/g, '');
      link.setAttribute('download', `wbs_export_${today}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      showErrorToastUnlessNetworkError(error, 'Excelの出力に失敗しました。');
    }
  };

  const handleViewModeSwitchStart = useCallback((viewMode: DisplayOptions['viewMode']) => {
    setPendingViewMode(viewMode);
    setViewSwitchLoading(true);
  }, []);


  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        displayOptions={displayOptions}
        setDisplayOptions={setDisplayOptions}
        projects={data?.projects || []}
        initialData={initialData}
        onClear={() => setFilters(createDefaultFilters())}
        onExport={() => setIsExportModalOpen(true)}
        onRefresh={() => fetchData(true)}
        onViewModeSwitchStart={handleViewModeSwitchStart}
      />

      <MainBoardContent
        displayOptions={displayOptions}
        treeWidth={treeWidth}
        setIsResizing={setIsResizing}
        treeRef={treeRef}
        ganttRef={ganttRef}
        filteredProjects={filteredProjects}
        initialData={initialData}
        onUpdate={fetchData}
        onLocalUpdate={localUpdate}
        onLocalReorder={localReorder}
        expandedProjects={expandedProjects}
        setExpandedProjects={setExpandedProjects}
        expandedTasks={expandedTasks}
        setExpandedTasks={setExpandedTasks}
        dynamicGanttRange={dynamicGanttRange}
        currentTodayStr={currentTodayStr}
        onTreeScroll={handleTreeScroll}
        onGanttScroll={handleGanttScroll}
      />

      <ConfirmModal
        isOpen={isExportModalOpen}
        totalCount={counts.total}
        title="Excelダウンロード"
        description="表示されている内容をExcelファイルとして書き出します。"
        confirmText="ダウンロード"
        onConfirm={handleExport}
        onCancel={() => setIsExportModalOpen(false)}
        variant="primary"
        icon={<Download size={20} />}
        showBodyIcon={true}
        descriptionPosition="afterButtons"
        footerPosition="beforeButtons"
        footer={(
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-4">
            ダウンロード対象の内訳: プロジェクト:{counts.projectCount}, タスク:{counts.taskCount}, サブタスク:{counts.subtaskCount}
          </div>
        )}
      />
      <LoadingOverlay isVisible={loading || viewSwitchLoading} delay={viewSwitchLoading ? 0 : undefined} />
    </div>
  );
}
