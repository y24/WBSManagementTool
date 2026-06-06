import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { ResourceRow } from '../../pages/mainboard/useResourceData';
import type { ResourceSortKey, ResourceSortState } from './ResourceBoard';
import { getOverlaidLaneHeight, UNASSIGNED_SEPARATOR_HEIGHT } from './ResourceGantt';
import {
  getLoadRateBarColor,
  getLoadRateTextColor,
  getScheduleVarianceTextColor,
  LoadRateThresholds,
  ScheduleVarianceThresholds,
} from '../../utils/loadRateThresholds';

const getStatusClasses = (count: number, type: 'inProgress' | 'delayed') => {
  if (count <= 0) return 'w-[72px] text-center text-slate-400 dark:text-slate-500 text-sm';

  const styleMap = {
    inProgress: [
      'text-blue-600 dark:text-blue-400 bg-blue-600/10 dark:bg-blue-400/20 font-medium',
      'text-blue-600 dark:text-blue-400 bg-blue-600/20 dark:bg-blue-400/30 font-semibold',
      'text-blue-600 dark:text-blue-400 bg-blue-600/35 dark:bg-blue-400/40 font-bold',
      'text-blue-600 dark:text-blue-400 bg-blue-600/50 dark:bg-blue-400/50 font-bold',
    ],
    delayed: [
      'text-amber-600 dark:text-amber-400 bg-amber-600/10 dark:bg-amber-400/20 font-bold',
      'text-amber-600 dark:text-amber-400 bg-amber-600/20 dark:bg-amber-400/30 font-bold',
      'text-amber-600 dark:text-amber-400 bg-amber-600/35 dark:bg-amber-400/40 font-bold',
      'text-amber-600 dark:text-amber-400 bg-amber-600/50 dark:bg-amber-400/50 font-bold',
    ],
  };

  const idx = Math.min(count - 1, 3);
  return `w-[72px] text-center rounded-md h-6 flex items-center justify-center transition-all duration-200 ${styleMap[type][idx]}`;
};

interface ResourceListProps {
  data: ResourceRow[];
  width: number;
  loadRateThresholds: LoadRateThresholds;
  scheduleVarianceThresholds: ScheduleVarianceThresholds;
  sortState: ResourceSortState | null;
  onSortChange: (key: ResourceSortKey) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

const SortHeaderButton: React.FC<{
  label: string;
  title: string;
  sortKey: ResourceSortKey;
  sortState: ResourceSortState | null;
  onSortChange: (key: ResourceSortKey) => void;
  className?: string;
}> = ({ label, title, sortKey, sortState, onSortChange, className = '' }) => {
  const isActive = sortState?.key === sortKey;
  const Icon = isActive
    ? sortState.direction === 'asc' ? ArrowUp : ArrowDown
    : ChevronsUpDown;
  const directionLabel = isActive ? (sortState.direction === 'asc' ? '昇順' : '降順') : '未設定';

  return (
    <button
      type="button"
      className={`group inline-flex h-full min-w-0 items-center justify-center gap-1 rounded px-1 text-center transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${className}`}
      title={`${title}`}
      aria-label={`${label}でソート（現在: ${directionLabel}）`}
      aria-sort={isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSortChange(sortKey)}
    >
      <span className="truncate">{label}</span>
      <Icon
        size={13}
        className={isActive ? 'shrink-0 text-slate-700 dark:text-slate-200' : 'shrink-0 text-slate-400 opacity-70 group-hover:opacity-100 dark:text-slate-500'}
        aria-hidden="true"
      />
    </button>
  );
};

export default function ResourceList({
  data,
  width,
  loadRateThresholds,
  scheduleVarianceThresholds,
  sortState,
  onSortChange,
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
            <SortHeaderButton
              label="担当者名"
              title="担当者名"
              sortKey="assignee"
              sortState={sortState}
              onSortChange={onSortChange}
              className="justify-start"
            />
          </div>
          <div className="flex items-center shrink-0 gap-1 px-2">
            <SortHeaderButton
              label="予定稼働"
              title="今日からスコープ終了日までの予定稼働率"
              sortKey="loadRate"
              sortState={sortState}
              onSortChange={onSortChange}
              className="w-[76px]"
            />
            <SortHeaderButton
              label="実績稼働"
              title="スコープ開始日から今日までの実績稼働率"
              sortKey="actualLoadRate"
              sortState={sortState}
              onSortChange={onSortChange}
              className="w-[76px]"
            />
            <div className="h-full border-l border-slate-200 dark:border-slate-700 pl-1">
              <SortHeaderButton
                label="進行中"
                title="進行中件数"
                sortKey="inProgressCount"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-[72px]"
              />
            </div>
            <SortHeaderButton
              label="遅延"
              title="遅延件数"
              sortKey="delayedCount"
              sortState={sortState}
              onSortChange={onSortChange}
              className="w-[72px]"
            />
            <div className="w-[76px] h-full border-l border-slate-200 dark:border-slate-700 px-1 ml-1">
              <SortHeaderButton
                label="予実差"
                title="今日までの実績工数 − 計画消化予定工数（人日）。負 = 遅れ、正 = 前倒し"
                sortKey="scheduleVariancePt"
                sortState={sortState}
                onSortChange={onSortChange}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-[100px] bg-slate-50 dark:bg-slate-950">
        {data.map((row, rowIndex) => {
          const rowHeight = getOverlaidLaneHeight(row);
          const isDelayed = row.delayedCount > 0;
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
                        {row.assignee !== null && isDelayed && (
                          <span title="遅延しているサブタスクがあります" className="inline-flex shrink-0">
                            <AlertTriangle
                              size={14}
                              className="text-amber-500"
                              aria-label="遅延あり"
                            />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Load rate + status badges */}
                  <div className="flex items-center shrink-0 gap-1 px-2 h-full">
                    {row.assignee === null ? (
                      <>
                        <div className="w-[76px] flex items-center justify-center">
                          <span className="text-[15px] font-semibold leading-none text-slate-300 dark:text-slate-600">—</span>
                        </div>
                        <div className="w-[76px] flex items-center justify-center">
                          <span className="text-[15px] font-semibold leading-none text-slate-300 dark:text-slate-600">—</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-[72px] flex items-center justify-center text-[13px] font-medium text-slate-300 dark:text-slate-600 border-l border-slate-200 dark:border-slate-700 ml-1 pl-1">—</div>
                          <div className="w-[72px] flex items-center justify-center text-[13px] font-medium text-slate-300 dark:text-slate-600">—</div>
                        </div>
                        <div className="w-[76px] flex items-center justify-center border-l border-slate-200 dark:border-slate-700 px-2 ml-1">
                          <span className="min-w-[54px] h-6 px-1.5 flex items-center justify-center text-[13px] font-normal leading-none text-slate-300 dark:text-slate-600">—</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Load rate column */}
                        <div className="w-[76px] flex flex-col items-center justify-center gap-0.5">
                          <span className={`text-[15px] font-semibold leading-none ${getLoadRateTextColor(row.loadRate, loadRateThresholds)}`}>
                            {`${row.loadRate}%`}
                          </span>
                          <div className="w-12 h-[3px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(row.loadRate, 100)}%`,
                                backgroundColor: getLoadRateBarColor(row.loadRate, loadRateThresholds),
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-[76px] flex flex-col items-center justify-center gap-0.5">
                          <span className={`text-[15px] font-semibold leading-none ${getLoadRateTextColor(row.actualLoadRate, loadRateThresholds)}`}>
                            {`${row.actualLoadRate}%`}
                          </span>
                          <div className="w-12 h-[3px] rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(row.actualLoadRate, 100)}%`,
                                backgroundColor: getLoadRateBarColor(row.actualLoadRate, loadRateThresholds),
                              }}
                            />
                          </div>
                        </div>
                        {/* Status badges */}
                        <div className="flex items-center gap-1">
                          <div className="border-l border-slate-200 dark:border-slate-700 ml-1 pl-1">
                            <div className={getStatusClasses(row.inProgressCount, 'inProgress')}>
                              {row.inProgressCount}
                            </div>
                          </div>
                          <div className={getStatusClasses(row.delayedCount, 'delayed')}>
                            {row.delayedCount}
                          </div>
                        </div>

                        <div className="w-[76px] flex items-center justify-center border-l border-slate-200 dark:border-slate-700 px-2 ml-1">
                          <span
                            className={`min-w-[54px] h-6 px-1.5 flex items-center justify-center text-[13px] font-normal leading-none ${getScheduleVarianceTextColor(row.scheduleVariancePt, scheduleVarianceThresholds)}`}
                            title="今日までの実績工数 − 計画消化予定工数（人日）。負値が大きいほど遅れ、正値は前倒し"
                          >
                            {row.scheduleVariancePt === null
                              ? '—'
                              : `${row.scheduleVariancePt > 0 ? '+' : ''}${row.scheduleVariancePt}日`}
                          </span>
                        </div>
                      </>
                    )}
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
