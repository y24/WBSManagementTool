import React from 'react';
import { ResourceRow } from '../../pages/mainboard/useResourceData';

const RESOURCE_TRACK_HEIGHT = 37;

interface ResourceListProps {
  data: ResourceRow[];
  width: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export default function ResourceList({ data, width, onScroll, listRef }: ResourceListProps) {
  return (
    <div 
      className="flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 h-full overflow-y-auto overflow-x-scroll"
      style={{ width: `${width}px` }}
      onScroll={onScroll}
      ref={listRef as unknown as React.RefObject<HTMLDivElement>}
    >
      <div className="sticky top-0 z-20 flex bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-sm min-h-[42px] min-w-max">
        {/* Header Row */}
        <div className="flex w-full py-1 items-center">
          <div className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 min-w-[140px] pl-4 pr-4 py-2 flex-1 truncate border-r border-slate-200 dark:border-slate-700">担当者名</div>
          <div className="flex gap-2 shrink-0 pr-2">
            <div className="w-12 text-center" title="進行中件数">進行中</div>
            <div className="w-12 text-center" title="遅延件数">遅延</div>
            <div className="w-12 text-center" title="今週終了予定">今週終了</div>
            <div className="w-12 text-center" title="レビュー待ち">レビュー</div>
            <div className="w-12 text-center" title="今週予定工数(日)">予定工数</div>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-[100px] bg-slate-50 dark:bg-slate-950">
        {data.map((row) => (
          <div 
            key={row.assignee?.id ?? 'unassigned'} 
            className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row min-w-max"
            style={{ height: `${row.tracks.length * RESOURCE_TRACK_HEIGHT}px` }}
          >
            <div className="flex w-full py-1 items-center h-full">
              <div className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/50 min-w-[140px] pl-4 pr-4 truncate font-medium text-[15px] text-slate-800 dark:text-slate-200 h-full flex items-center flex-1 border-r border-slate-200 dark:border-slate-700">
                {row.assignee?.member_name || '未アサイン'}
              </div>
              <div className="flex gap-2 shrink-0 text-sm pr-2">
                <div className={`w-12 text-center font-medium ${row.inProgressCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {row.inProgressCount}
                </div>
                <div className={`w-12 text-center font-bold ${row.delayedCount > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {row.delayedCount}
                </div>
                <div className={`w-12 text-center font-medium ${row.endingThisWeekCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {row.endingThisWeekCount}
                </div>
                <div className={`w-12 text-center font-medium ${row.reviewWaitingCount > 0 ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {row.reviewWaitingCount}
                </div>
                <div className={`w-12 text-center font-medium ${(Number(row.plannedEffortThisWeek) || 0) > 1.0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {(Number(row.plannedEffortThisWeek) || 0).toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
