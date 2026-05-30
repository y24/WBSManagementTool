import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { ResourceRow } from '../../pages/mainboard/useResourceData';
import { getOverlaidLaneHeight, UNASSIGNED_SEPARATOR_HEIGHT } from './ResourceGantt';
import {
  getLoadRateBarColor,
  getLoadRateTextColor,
  getScheduleVarianceBadgeClasses,
  getScheduleVarianceTextColor,
  isLoadRateCritical,
  LoadRateThresholds,
  ScheduleVarianceThresholds,
} from '../../utils/loadRateThresholds';

const getStatusClasses = (count: number, type: 'inProgress' | 'delayed' | 'completed') => {
  if (count <= 0) return 'w-10 text-center text-slate-400 dark:text-slate-500 text-sm';

  const styleMap = {
    inProgress: [
      'text-blue-600 dark:text-blue-400 bg-blue-600/10 dark:bg-blue-400/20 font-medium',
      'text-blue-600 dark:text-blue-400 bg-blue-600/20 dark:bg-blue-400/30 font-semibold',
      'text-blue-600 dark:text-blue-400 bg-blue-600/35 dark:bg-blue-400/40 font-bold',
      'text-blue-600 dark:text-blue-400 bg-blue-600/50 dark:bg-blue-400/50 font-bold',
    ],
    delayed: [
      'text-rose-600 dark:text-rose-400 bg-rose-600/10 dark:bg-rose-400/20 font-bold',
      'text-rose-600 dark:text-rose-400 bg-rose-600/20 dark:bg-rose-400/30 font-bold',
      'text-rose-600 dark:text-rose-400 bg-rose-600/35 dark:bg-rose-400/40 font-bold',
      'text-rose-600 dark:text-rose-400 bg-rose-600/50 dark:bg-rose-400/50 font-bold',
    ],
    completed: [
      'text-slate-500 dark:text-slate-400 bg-slate-500/10 dark:bg-slate-400/15 font-medium',
      'text-slate-500 dark:text-slate-400 bg-slate-500/15 dark:bg-slate-400/20 font-medium',
      'text-slate-500 dark:text-slate-400 bg-slate-500/20 dark:bg-slate-400/25 font-medium',
      'text-slate-500 dark:text-slate-400 bg-slate-500/25 dark:bg-slate-400/30 font-medium',
    ],
  };

  const idx = Math.min(count - 1, 3);
  return `w-10 text-center rounded-md h-6 flex items-center justify-center transition-all duration-200 ${styleMap[type][idx]}`;
};

interface ResourceListProps {
  data: ResourceRow[];
  width: number;
  loadRateThresholds: LoadRateThresholds;
  scheduleVarianceThresholds: ScheduleVarianceThresholds;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export default function ResourceList({
  data,
  width,
  loadRateThresholds,
  scheduleVarianceThresholds,
  onScroll,
  listRef
}: ResourceListProps) {
  return (
    <div
      className="flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 h-full overflow-y-auto overflow-x-scroll"
      style={{ width: `${width}px`, scrollbarGutter: 'stable' }}
      onScroll={onScroll}
      ref={listRef as unknown as React.RefObject<HTMLDivElement>}
    >
      {/* Header */}
      <div className="sticky top-0 z-50 flex shrink-0 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-sm h-[38px] min-h-[38px] min-w-max">
        <div className="flex w-full items-center h-full">
          <div className="sticky left-0 z-[60] bg-slate-50 dark:bg-slate-900 min-w-[160px] pl-4 pr-2 h-full flex items-center flex-1 truncate border-r border-slate-200 dark:border-slate-700">
            担当者名
          </div>
          <div className="flex items-center shrink-0 gap-1 px-2">
            <div className="w-[76px] text-center" title="今日からスコープ終了日までの予定稼働率">計画</div>
            <div className="w-[76px] text-center" title="スコープ開始日から今日までの実績稼働率">実績</div>
            <div className="w-[76px] text-center border-r border-slate-200 dark:border-slate-700 pr-2 mr-1" title="スコープ内サブタスクごとの今日時点の実績進捗 - 計画進捗">予実差</div>
            <div className="w-10 text-center" title="進行中件数">進行</div>
            <div className="w-10 text-center" title="遅延件数">遅延</div>
            <div className="w-10 text-center" title="完了件数">完了</div>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-[100px] bg-slate-50 dark:bg-slate-950">
        {data.map((row, rowIndex) => {
          const rowHeight = getOverlaidLaneHeight(row);
          const isDelayed = row.delayedCount > 0;
          const hasCriticalLoadRate =
            isLoadRateCritical(row.loadRate, loadRateThresholds) ||
            isLoadRateCritical(row.actualLoadRate, loadRateThresholds);
          const isFirstUnassigned =
            row.assignee === null &&
            (rowIndex === 0 || data[rowIndex - 1].assignee !== null);

          return (
            <React.Fragment key={row.assignee?.id ?? 'unassigned'}>
              {isFirstUnassigned && (
                <div
                  className="flex items-center gap-2 px-4 border-t border-b border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/50 min-w-max"
                  style={{ height: `${UNASSIGNED_SEPARATOR_HEIGHT}px` }}
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    未アサイン
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    （{data.filter(r => r.assignee === null).reduce((s, r) => s + r.subtasks.length, 0)}件）
                  </span>
                </div>
              )}
              <div
                className="relative flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row min-w-max bg-white dark:bg-slate-900"
                style={{ height: `${rowHeight}px` }}
              >
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                {rowIndex === data.length - 1 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-px bg-slate-400 dark:bg-slate-600" />
                )}
                <div className="flex w-full items-center h-full">
                  {/* Assignee name */}
                  <div className="sticky left-0 z-10 bg-inherit group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50 min-w-[160px] pl-4 pr-2 h-full flex items-center gap-1.5 flex-1 border-r border-slate-200 dark:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-[14px] text-slate-800 dark:text-slate-200">
                          {row.assignee?.member_name || '未アサイン'}
                        </span>
                        {isDelayed && (
                          <span title="遅延しているサブタスクがあります" className="inline-flex shrink-0">
                            <AlertTriangle
                              size={14}
                              className="text-amber-500"
                              aria-label="遅延あり"
                            />
                          </span>
                        )}
                        {hasCriticalLoadRate && (
                          <span title="計画または実績稼働率が赤しきい値です" className="inline-flex shrink-0">
                            <AlertCircle
                              size={13}
                              className="text-rose-500"
                              aria-label="計画または実績稼働率が赤しきい値です"
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Load rate + status badges */}
                  <div className="flex items-center shrink-0 gap-1 px-2 h-full">
                    {/* Load rate column */}
                    <div className="w-[76px] flex flex-col items-center justify-center gap-0.5">
                      <span className={`text-[15px] font-semibold leading-none ${getLoadRateTextColor(row.loadRate, loadRateThresholds)}`}>
                        {row.loadRate > 0 ? `${row.loadRate}%` : '—'}
                      </span>
                      {row.loadRate > 0 && (
                        <div className="w-12 h-[3px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mt-0.5">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(row.loadRate, 100)}%`,
                              backgroundColor: getLoadRateBarColor(row.loadRate, loadRateThresholds),
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="w-[76px] flex flex-col items-center justify-center gap-0.5">
                      <span className={`text-[15px] font-semibold leading-none ${getLoadRateTextColor(row.actualLoadRate, loadRateThresholds)}`}>
                        {row.actualLoadRate > 0 ? `${row.actualLoadRate}%` : '—'}
                      </span>
                      {row.actualLoadRate > 0 && (
                        <div className="w-12 h-[3px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mt-0.5">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(row.actualLoadRate, 100)}%`,
                              backgroundColor: getLoadRateBarColor(row.actualLoadRate, loadRateThresholds),
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="w-[76px] flex items-center justify-center border-r border-slate-200 dark:border-slate-700 pr-2 mr-1">
                      <span
                        className={`min-w-[54px] h-6 px-1.5 rounded-md flex items-center justify-center text-[14px] font-semibold leading-none ${getScheduleVarianceTextColor(row.scheduleVariancePt, scheduleVarianceThresholds)} ${getScheduleVarianceBadgeClasses(row.scheduleVariancePt, scheduleVarianceThresholds)}`}
                        title="0ptに近いほど計画通りです"
                      >
                        {row.scheduleVariancePt === null
                          ? '—'
                          : `${row.scheduleVariancePt > 0 ? '+' : ''}${row.scheduleVariancePt}pt`}
                      </span>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-1">
                      <div className={getStatusClasses(row.inProgressCount, 'inProgress')}>
                        {row.inProgressCount}
                      </div>
                      <div className={getStatusClasses(row.delayedCount, 'delayed')}>
                        {row.delayedCount}
                      </div>
                      <div className={getStatusClasses(row.completedCount, 'completed')}>
                        {row.completedCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
