import { useState, useEffect, useRef, useCallback, UIEvent } from 'react';
import { wbsOps } from '../api/wbsOperations';
import { apiClient } from '../api/client';
import { WBSResponse } from '../types/wbs';
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

export default function MainBoard() {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(getInitialDisplayOptions);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(getInitialExpandedProjects);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>(getInitialExpandedTasks);

  const [treeWidth, setTreeWidth] = useState(getInitialTreeWidth);
  const [isResizing, setIsResizing] = useState(false);

  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  // Real-time synchronization
  useWebSocket((msg) => {
    if (msg.type === 'update') {
      console.log('MainBoard received update signal, refreshing...');
      fetchData();
    }
  });

  const fetchData = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial || !data) setLoading(true);

        const wbsRes = await wbsOps.getWBS(
          undefined, // projectIds
          displayOptions.showDoneProjects,
          displayOptions.showRemoved
        );
        setData(wbsRes.data);

        if (isInitial || !initialData) {
          const initRes = await apiClient.get<InitialData>('/initial-data');
          setInitialData(initRes.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [data, initialData, displayOptions],
  );

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
    persistTreeWidth(treeWidth);
  }, [treeWidth]);

  useEffect(() => {
    persistDisplayOptions(displayOptions);
  }, [displayOptions]);

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

  const filteredProjects = useFilteredProjects({ data, filters, initialData, displayOptions });
  const dynamicGanttRange = useDynamicGanttRange({ data, filteredProjects });

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

  const handleTreeScroll = (event: UIEvent<HTMLDivElement>) => {
    if (ganttRef.current && Math.abs(ganttRef.current.scrollTop - event.currentTarget.scrollTop) > 0.5) {
      ganttRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleGanttScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;

    if (treeRef.current && Math.abs(treeRef.current.scrollTop - scrollTop) > 0.5) {
      treeRef.current.scrollTop = scrollTop;
    }

    persistGanttScrollLeft(scrollLeft);
  };

  if (loading && !data) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-14 w-14 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading WBS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        displayOptions={displayOptions}
        setDisplayOptions={setDisplayOptions}
        projects={data?.projects || []}
        initialData={initialData}
        onClear={() => setFilters(createDefaultFilters())}
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
        expandedProjects={expandedProjects}
        setExpandedProjects={setExpandedProjects}
        expandedTasks={expandedTasks}
        setExpandedTasks={setExpandedTasks}
        dynamicGanttRange={dynamicGanttRange}
        onTreeScroll={handleTreeScroll}
        onGanttScroll={handleGanttScroll}
      />
    </div>
  );
}
