import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { wbsOps } from '../api/wbsOperations';
import { DashboardData } from '../types/dashboard';
import { DashboardAnalyticsChartsSection, DashboardChartsSection } from '../components/dashboard/DashboardChartsSection';
import { DashboardKPISection } from '../components/dashboard/DashboardKPISection';
import {
  AssigneeSummarySection,
  DashboardInsightsSection,
  DashboardListsSection,
} from '../components/dashboard/DashboardListsSection';
import { DashboardChartTheme } from '../components/dashboard/constants';
import { useWebSocket } from '../api/websocket';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [showAllAssignees, setShowAllAssignees] = useState(false);

  const dashboardScrollRef = useRef<HTMLDivElement | null>(null);
  const assigneeSectionRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const assigneeHeightBeforeToggleRef = useRef<number | null>(null);
  const isAssigneeTogglingRef = useRef(false);

  // Real-time synchronization
  useWebSocket((msg) => {
    if (msg.type === 'update' || msg.type === 'connected') {
      console.log(`Dashboard received ${msg.type} signal, refreshing...`);
      fetchData();
    }
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!isAssigneeTogglingRef.current) {
      return;
    }

    const section = assigneeSectionRef.current;
    const from = assigneeHeightBeforeToggleRef.current;

    if (!section || from === null) {
      isAssigneeTogglingRef.current = false;
      assigneeHeightBeforeToggleRef.current = null;
      return;
    }

    const to = section.getBoundingClientRect().height;

    if (Math.abs(to - from) < 1) {
      isAssigneeTogglingRef.current = false;
      assigneeHeightBeforeToggleRef.current = null;
      return;
    }

    section.style.height = `${from}px`;
    section.style.overflow = 'hidden';
    section.style.willChange = 'height';
    section.getBoundingClientRect();
    section.style.transition = 'height 420ms cubic-bezier(0.22, 1, 0.36, 1)';
    section.style.height = `${to}px`;

    const handleEnd = () => {
      section.style.height = '';
      section.style.overflow = '';
      section.style.transition = '';
      section.style.willChange = '';
      isAssigneeTogglingRef.current = false;
      assigneeHeightBeforeToggleRef.current = null;
    };

    section.addEventListener('transitionend', handleEnd, { once: true });

    return () => {
      section.removeEventListener('transitionend', handleEnd);
    };
  }, [showAllAssignees]);

  const fetchData = async () => {
    try {
      const res = await wbsOps.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAssignees = () => {
    const section = assigneeSectionRef.current;

    if (section) {
      assigneeHeightBeforeToggleRef.current = section.getBoundingClientRect().height;
      isAssigneeTogglingRef.current = true;
    }

    setShowAllAssignees((prev) => {
      const next = !prev;

      if (prev && !next) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const container = dashboardScrollRef.current;
            const currentSection = assigneeSectionRef.current;

            if (!container || !currentSection) {
              return;
            }

            const containerRect = container.getBoundingClientRect();
            const sectionRect = currentSection.getBoundingClientRect();
            const topOffset = 12;
            const targetTop = container.scrollTop + (sectionRect.top - containerRect.top) - topOffset;
            const to = Math.max(0, targetTop);
            const from = container.scrollTop;
            const distance = to - from;
            const duration = 520;
            const start = performance.now();
            const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

            if (scrollAnimationRef.current !== null) {
              cancelAnimationFrame(scrollAnimationRef.current);
            }

            const tick = (now: number) => {
              const elapsed = now - start;
              const progress = Math.min(1, elapsed / duration);
              const eased = easeInOutCubic(progress);
              container.scrollTop = from + distance * eased;

              if (progress < 1) {
                scrollAnimationRef.current = requestAnimationFrame(tick);
              } else {
                scrollAnimationRef.current = null;
              }
            };

            scrollAnimationRef.current = requestAnimationFrame(tick);
          });
        });
      }

      return next;
    });
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="text-slate-500 dark:text-slate-400 text-base font-medium animate-pulse">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  const chartTheme: DashboardChartTheme = {
    gridColor: isDark ? '#334155' : '#e2e8f0',
    axisColor: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#e2e8f0' : '#1e293b',
  };

  return (
    <div
      ref={dashboardScrollRef}
      className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-full text-slate-700 dark:text-slate-200 overflow-y-auto transition-colors duration-300"
    >
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Dashboard
        </h2>
      </div>

      <DashboardKPISection kpis={data.kpis} />

      <DashboardChartsSection data={data} theme={chartTheme} />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 pb-8">
        <DashboardListsSection data={data} />
        <AssigneeSummarySection
          ref={assigneeSectionRef}
          assigneeSummary={data.assignee_summary}
          showAllAssignees={showAllAssignees}
          onToggle={handleToggleAssignees}
        />
      </div>

      <DashboardAnalyticsChartsSection data={data} theme={chartTheme} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
        <DashboardInsightsSection data={data} />
      </div>
    </div>
  );
}
