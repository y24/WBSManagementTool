import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { InitialData } from '../../types';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { getLoadRateTextColor, LoadRateThresholds } from '../../utils/loadRateThresholds';
import { getResourcePlannedDateRange } from '../../utils/resourcePlanning';

interface ResourceSummaryBarProps {
  data: ResourceRow[];
  loadRateThresholds: LoadRateThresholds;
  initialData: InitialData | null;
  todayStr: string;
  loadScopeEndDate?: string;
}

type SummaryCardKind = 'average' | 'delayed' | 'idle' | 'overloaded';

interface SummaryCard {
  kind: SummaryCardKind;
  label: string;
  value: string;
  bg: string;
  textColor: string;
  labelColor: string;
  tooltip: React.ReactNode;
}

const MAX_TOOLTIP_ROWS = 8;
const MAX_TASK_ROWS = 4;

const isWorkingDay = (date: Date, holidaySet: Set<string>) => {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !holidaySet.has(format(date, 'yyyy-MM-dd'));
};

const formatDate = (dateStr: string | null | undefined) => dateStr?.split('T')[0].replace(/-/g, '/') ?? '-';

const formatDateRange = (start: string, end: string) => {
  const displayStart = formatDate(start);
  const displayEnd = formatDate(end);
  return start === end ? displayStart : `${displayStart} - ${displayEnd}`;
};

const getTaskTitle = (subtask: ResourceSubtask) =>
  [subtask.project_name, subtask.subtask_type_name].filter(Boolean).join(' / ') || '-';

const getLoadRateCardBg = (rate: number, thresholds: LoadRateThresholds) => {
  if (rate <= 0) return 'bg-slate-50 dark:bg-slate-800/60';
  if (rate <= thresholds.criticalLow) return 'bg-rose-50 dark:bg-rose-950/30';
  if (rate <= thresholds.warningLow) return 'bg-amber-50 dark:bg-amber-950/20';
  if (rate <= thresholds.normalHigh) return 'bg-emerald-50 dark:bg-emerald-950/20';
  if (rate <= thresholds.warningHigh) return 'bg-amber-50 dark:bg-amber-950/20';
  return 'bg-rose-50 dark:bg-rose-950/30';
};

const getLoadRateLabelColor = (rate: number, thresholds: LoadRateThresholds) => {
  if (rate <= 0) return 'text-slate-500 dark:text-slate-400';
  if (rate <= thresholds.criticalLow) return 'text-rose-500 dark:text-rose-500';
  if (rate <= thresholds.warningLow) return 'text-amber-600 dark:text-amber-500';
  if (rate <= thresholds.normalHigh) return 'text-emerald-600 dark:text-emerald-500';
  if (rate <= thresholds.warningHigh) return 'text-amber-600 dark:text-amber-500';
  return 'text-rose-500 dark:text-rose-500';
};

const getDelayedSubtasks = (
  row: ResourceRow,
  todayStr: string,
  doneStatusId: number | null,
  newStatusId: number | null
) => {
  return row.subtasks
    .map(subtask => {
      const isDone = doneStatusId !== null && subtask.status_id === doneStatusId;
      const isStartDelayed =
        newStatusId !== null &&
        subtask.status_id === newStatusId &&
        !!subtask.planned_start_date &&
        subtask.planned_start_date < todayStr;
      const isEndDelayed = !isDone && !!subtask.planned_end_date && subtask.planned_end_date < todayStr;
      if (!isStartDelayed && !isEndDelayed) return null;

      const basisDate = isEndDelayed ? subtask.planned_end_date : subtask.planned_start_date;
      const delayDays = basisDate
        ? Math.max(1, differenceInCalendarDays(parseISO(todayStr), parseISO(basisDate.split('T')[0])))
        : 0;
      return { subtask, delayDays, reason: isEndDelayed ? '終了遅延' : '開始遅延' };
    })
    .filter((item): item is { subtask: ResourceSubtask; delayDays: number; reason: string } => item !== null)
    .sort((a, b) => b.delayDays - a.delayDays);
};

const getIdleRanges = (
  row: ResourceRow,
  todayStr: string,
  endDateStr: string | undefined,
  holidaySet: Set<string>,
  doneStatusId: number | null
) => {
  if (!endDateStr) return [];

  const plannedDates = new Set<string>();
  row.subtasks.forEach(subtask => {
    const plannedRange = getResourcePlannedDateRange(subtask, doneStatusId);
    if (!plannedRange) return;

    let current = parseISO(plannedRange.start);
    const end = parseISO(plannedRange.end);
    while (current <= end) {
      plannedDates.add(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
  });

  const ranges: { start: string; end: string; days: number }[] = [];
  let current = parseISO(todayStr);
  const endDate = parseISO(endDateStr);
  let activeRange: { start: string; end: string; days: number } | null = null;

  while (current <= endDate) {
    const dateKey = format(current, 'yyyy-MM-dd');
    const isIdle = isWorkingDay(current, holidaySet) && !plannedDates.has(dateKey);
    if (isIdle) {
      if (activeRange) {
        activeRange.end = dateKey;
        activeRange.days += 1;
      } else {
        activeRange = { start: dateKey, end: dateKey, days: 1 };
      }
    } else if (activeRange) {
      ranges.push(activeRange);
      activeRange = null;
    }
    current = addDays(current, 1);
  }
  if (activeRange) ranges.push(activeRange);

  return ranges.sort((a, b) => b.days - a.days);
};

const getBusiestPeriod = (
  row: ResourceRow,
  todayStr: string,
  endDateStr: string | undefined,
  holidaySet: Set<string>,
  doneStatusId: number | null
) => {
  if (!endDateStr) return null;

  const dailyTasks: { date: string; tasks: ResourceSubtask[] }[] = [];
  let current = parseISO(todayStr);
  const endDate = parseISO(endDateStr);

  while (current <= endDate) {
    const dateKey = format(current, 'yyyy-MM-dd');
    if (isWorkingDay(current, holidaySet)) {
      const tasks = row.subtasks.filter(subtask => {
        const plannedRange = getResourcePlannedDateRange(subtask, doneStatusId);
        return !!plannedRange && plannedRange.start <= dateKey && dateKey <= plannedRange.end;
      });
      dailyTasks.push({ date: dateKey, tasks });
    }
    current = addDays(current, 1);
  }

  const maxCount = Math.max(0, ...dailyTasks.map(day => day.tasks.length));
  if (maxCount === 0) return null;

  const maxDays = dailyTasks.filter(day => day.tasks.length === maxCount);
  const start = maxDays[0].date;
  let end = start;
  const taskMap = new Map<number, ResourceSubtask>();
  for (const day of maxDays) {
    if (day.date > end) end = day.date;
    day.tasks.forEach(task => taskMap.set(task.id, task));
  }

  return { start, end, maxCount, tasks: Array.from(taskMap.values()) };
};

const SummaryTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
}> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showTooltip = useCallback((event: React.MouseEvent<HTMLElement>) => {
    clearHideTimer();
    if (timerRef.current) clearTimeout(timerRef.current);

    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedWidth = 440;
    const estimatedHeight = 380;
    const margin = 8;
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );
    const topBelow = rect.bottom + margin;
    const top = topBelow + estimatedHeight > window.innerHeight
      ? Math.max(margin, rect.top - estimatedHeight - margin)
      : topBelow;

    setTooltipPos({ x: left, y: top });
    timerRef.current = setTimeout(() => setIsVisible(true), 250);
  }, [clearHideTimer]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hideTimerRef.current = setTimeout(() => setIsVisible(false), 140);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!content) return children;

  return (
    <>
      {React.cloneElement(children as React.ReactElement<any>, {
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
      })}
      {isVisible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 text-[12px] min-w-[280px] max-w-[440px] text-slate-700 dark:text-slate-200 transition-opacity duration-200"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          onMouseEnter={clearHideTimer}
          onMouseLeave={hideTooltip}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

export default function ResourceSummaryBar({
  data,
  loadRateThresholds,
  initialData,
  todayStr,
  loadScopeEndDate,
}: ResourceSummaryBarProps) {
  const assigned = data.filter(r => r.assignee !== null);

  const holidaySet = useMemo(
    () => new Set(initialData?.holidays.map(h => h.holiday_date) ?? []),
    [initialData]
  );
  const doneStatusId = useMemo(
    () => initialData?.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null,
    [initialData]
  );
  const newStatusId = useMemo(() => {
    if (initialData?.status_mapping_new) return Number.parseInt(initialData.status_mapping_new, 10);
    return initialData?.statuses.find(status => status.status_name === 'New')?.id ?? null;
  }, [initialData]);

  if (assigned.length === 0) return null;

  const avgLoadRate = Math.round(
    assigned.reduce((sum, r) => sum + r.loadRate, 0) / assigned.length
  );
  const delayedCount = assigned.filter(r => r.delayedCount > 0).length;
  const idleCount = assigned.filter(r => r.loadRate <= loadRateThresholds.criticalLow).length;
  const overloadedCount = assigned.filter(r => r.loadRate >= loadRateThresholds.overload).length;

  const delayedRows = assigned
    .map(row => ({ row, delayed: getDelayedSubtasks(row, todayStr, doneStatusId, newStatusId) }))
    .filter(item => item.delayed.length > 0);
  const idleRows = assigned
    .filter(row => row.loadRate <= loadRateThresholds.criticalLow)
    .map(row => ({ row, idleRanges: getIdleRanges(row, todayStr, loadScopeEndDate, holidaySet, doneStatusId) }));
  const overloadedRows = assigned
    .filter(row => row.loadRate >= loadRateThresholds.overload)
    .map(row => ({ row, busiest: getBusiestPeriod(row, todayStr, loadScopeEndDate, holidaySet, doneStatusId) }));

  const cards: SummaryCard[] = [
    {
      kind: 'average',
      label: '平均予定稼働率',
      value: avgLoadRate > 0 ? `${avgLoadRate}%` : '—',
      bg: getLoadRateCardBg(avgLoadRate, loadRateThresholds),
      textColor: getLoadRateTextColor(avgLoadRate, loadRateThresholds),
      labelColor: getLoadRateLabelColor(avgLoadRate, loadRateThresholds),
      tooltip: null,
    },
    {
      kind: 'delayed',
      label: '遅延発生',
      value: `${delayedCount}人`,
      bg: delayedCount > 0
        ? 'bg-rose-50 dark:bg-rose-950/30'
        : 'bg-slate-50 dark:bg-slate-800/60',
      textColor: delayedCount > 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-400 dark:text-slate-500',
      labelColor: delayedCount > 0
        ? 'text-rose-500 dark:text-rose-500'
        : 'text-slate-500 dark:text-slate-400',
      tooltip: delayedRows.length > 0 && (
        <div className="space-y-2.5">
          <div className="font-bold text-[13px] text-rose-600 dark:text-rose-400">遅延発生</div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {delayedRows.slice(0, MAX_TOOLTIP_ROWS).map(({ row, delayed }) => (
              <div key={row.assignee?.id} className="border-t border-slate-100 dark:border-slate-800 pt-2.5 first:border-t-0 first:pt-0">
                <div className="mb-1.5 font-bold text-[12px] text-slate-900 dark:text-white">{row.assignee?.member_name}</div>
                <div className="space-y-1.5">
                  {delayed.slice(0, 2).map(({ subtask, delayDays, reason }) => (
                    <div key={subtask.id} className="leading-snug">
                      <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">{getTaskTitle(subtask)}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{reason}</span>
                        <span>{delayDays}日遅延</span>
                      </div>
                    </div>
                  ))}
                </div>
                {delayed.length > 2 && <div className="mt-1.5 text-[11px] text-slate-400">他 {delayed.length - 2} 件</div>}
              </div>
            ))}
            {delayedRows.length > MAX_TOOLTIP_ROWS && <div className="text-[11px] text-slate-400">他 {delayedRows.length - MAX_TOOLTIP_ROWS} 人</div>}
          </div>
        </div>
      ),
    },
    {
      kind: 'idle',
      label: `空き多い（≤${loadRateThresholds.criticalLow}%）`,
      value: `${idleCount}人`,
      bg: idleCount > 0
        ? 'bg-amber-50 dark:bg-amber-950/20'
        : 'bg-slate-50 dark:bg-slate-800/60',
      textColor: idleCount > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-400 dark:text-slate-500',
      labelColor: idleCount > 0
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-slate-500 dark:text-slate-400',
      tooltip: idleRows.length > 0 && (
        <div className="space-y-2.5">
          <div className="font-bold text-[13px] text-amber-600 dark:text-amber-400">空き多い</div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {idleRows.slice(0, MAX_TOOLTIP_ROWS).map(({ row, idleRanges }) => (
              <div key={row.assignee?.id} className="border-t border-slate-100 dark:border-slate-800 pt-2.5 first:border-t-0 first:pt-0">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="font-bold text-[12px] text-slate-900 dark:text-white">{row.assignee?.member_name}</span>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">計画率 {row.loadRate}%</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {idleRanges.length > 0 ? (
                    idleRanges.slice(0, 3).map(range => (
                      <div key={`${row.assignee?.id}-${range.start}-${range.end}`} className="flex items-center justify-between gap-3">
                        <span>{formatDateRange(range.start, range.end)}</span>
                        <span className="shrink-0 font-medium">{range.days}営業日</span>
                      </div>
                    ))
                  ) : (
                    <div>対象期間内にまとまった空きはありません</div>
                  )}
                </div>
              </div>
            ))}
            {idleRows.length > MAX_TOOLTIP_ROWS && <div className="text-[11px] text-slate-400">他 {idleRows.length - MAX_TOOLTIP_ROWS} 人</div>}
          </div>
        </div>
      ),
    },
    {
      kind: 'overloaded',
      label: `過負荷（≥${loadRateThresholds.overload}%）`,
      value: `${overloadedCount}人`,
      bg: overloadedCount > 0
        ? 'bg-amber-50 dark:bg-amber-950/20'
        : 'bg-slate-50 dark:bg-slate-800/60',
      textColor: overloadedCount > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-400 dark:text-slate-500',
      labelColor: overloadedCount > 0
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-slate-500 dark:text-slate-400',
      tooltip: overloadedRows.length > 0 && (
        <div className="space-y-2.5">
          <div className="font-bold text-[13px] text-amber-600 dark:text-amber-400">過負荷</div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {overloadedRows.slice(0, MAX_TOOLTIP_ROWS).map(({ row, busiest }) => (
              <div key={row.assignee?.id} className="border-t border-slate-100 dark:border-slate-800 pt-2.5 first:border-t-0 first:pt-0">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="font-bold text-[12px] text-slate-900 dark:text-white">{row.assignee?.member_name}</span>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">計画率 {row.loadRate}%</span>
                </div>
                {busiest ? (
                  <div className="text-[11px] leading-relaxed">
                    <div className="mb-1 text-slate-500 dark:text-slate-400">
                      高負荷期間: {formatDateRange(busiest.start, busiest.end)}（最大 {busiest.maxCount} 件）
                    </div>
                    <div className="space-y-1 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {busiest.tasks.slice(0, MAX_TASK_ROWS).map(task => (
                        <div key={task.id} className="truncate">{getTaskTitle(task)}</div>
                      ))}
                      {busiest.tasks.length > MAX_TASK_ROWS && (
                        <div className="text-[11px] text-slate-400">他 {busiest.tasks.length - MAX_TASK_ROWS} 件</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">対象期間内の予定タスクを特定できません</div>
                )}
              </div>
            ))}
            {overloadedRows.length > MAX_TOOLTIP_ROWS && <div className="text-[11px] text-slate-400">他 {overloadedRows.length - MAX_TOOLTIP_ROWS} 人</div>}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="shrink-0 flex gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {cards.map(card => (
        <SummaryTooltip key={card.kind} content={card.tooltip}>
          <div
            className={`flex-1 rounded-lg px-3 py-2 ${card.bg} ${card.tooltip ? 'cursor-help' : ''}`}
          >
            <div className={`text-[10px] font-medium leading-none mb-1 ${card.labelColor}`}>
              {card.label}
            </div>
            <div className={`text-[17px] font-semibold leading-none ${card.textColor}`}>
              {card.value}
            </div>
          </div>
        </SummaryTooltip>
      ))}
    </div>
  );
}
