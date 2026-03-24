import { useState, useEffect, useRef, useCallback, UIEvent } from 'react';
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

  const fetchData = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial || !data) setLoading(true);

        const wbsRes = await apiClient.get<WBSResponse>('/wbs');
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
    [data, initialData],
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
    // Main board initial fetch should run only once on mount.
    // Adding fetchData to deps recreates this effect whenever data changes and causes refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (loading && !data) return <div className="p-4 text-gray-500 font-medium">Loading WBS...</div>;

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
