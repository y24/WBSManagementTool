import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import LoadingOverlay from '../components/LoadingOverlay';

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
  const wbsTreeVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, versionRes] = await Promise.all([
        wbsOps.getDashboard(),
        wbsOps.getWBSVersion(),
      ]);
      setData(res.data);
      wbsTreeVersionRef.current = versionRes.data.tree_version;
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkForDashboardUpdates = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;

    try {
      const versionRes = await wbsOps.getWBSVersion();
      if (!wbsTreeVersionRef.current) {
        wbsTreeVersionRef.current = versionRes.data.tree_version;
        return;
      }

      if (versionRes.data.tree_version !== wbsTreeVersionRef.current) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to check dashboard version', err);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(checkForDashboardUpdates, 30000);
    window.addEventListener('focus', checkForDashboardUpdates);
    document.addEventListener('visibilitychange', checkForDashboardUpdates);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkForDashboardUpdates);
      document.removeEventListener('visibilitychange', checkForDashboardUpdates);
    };
  }, [checkForDashboardUpdates]);

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

      {data && (
        <>
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
        </>
      )}
      <LoadingOverlay isVisible={loading} />
    </div>
  );
}
