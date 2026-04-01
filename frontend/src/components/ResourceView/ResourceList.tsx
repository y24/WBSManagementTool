import React from 'react';
import { ResourceRow } from '../../pages/mainboard/useResourceData';

const RESOURCE_TRACK_HEIGHT = 32;

/**
 * 進行中、遅延、今週終了、レビューの各列のハイライトスタイルを取得する
 */
const getStatusClasses = (count: number, type: 'inProgress' | 'delayed' | 'ending' | 'review') => {
  if (count <= 0) return "w-12 text-center text-slate-400 dark:text-slate-500 text-sm";

  // 背景色の強さを定義 (Tailwindの任意値/不透明度を使用)
  // 文字色に合わせて、背景色も同じ系統の色を使用する
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
    ending: [
      'text-amber-600 dark:text-amber-400 bg-amber-600/10 dark:bg-amber-400/20 font-medium',
      'text-amber-600 dark:text-amber-400 bg-amber-600/20 dark:bg-amber-400/30 font-semibold',
      'text-amber-600 dark:text-amber-400 bg-amber-600/35 dark:bg-amber-400/40 font-bold',
      'text-amber-600 dark:text-amber-400 bg-amber-600/50 dark:bg-amber-400/50 font-bold',
    ],
    review: [
      'text-indigo-600 dark:text-indigo-400 bg-indigo-600/10 dark:bg-indigo-400/20 font-medium',
      'text-indigo-600 dark:text-indigo-400 bg-indigo-600/20 dark:bg-indigo-400/30 font-semibold',
      'text-indigo-600 dark:text-indigo-400 bg-indigo-600/35 dark:bg-indigo-400/40 font-bold',
      'text-indigo-600 dark:text-indigo-400 bg-indigo-600/50 dark:bg-indigo-400/50 font-bold',
    ]
  };

  const idx = Math.min(count - 1, 3);
  return `w-12 text-center rounded-md h-6 flex items-center justify-center transition-all duration-200 ${styleMap[type][idx]}`;
};

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
      <div className="sticky top-0 z-20 flex bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-sm h-[38px] min-w-max">
        {/* Header Row */}
        <div className="flex w-full items-center h-full">
          <div className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 min-w-[140px] pl-4 pr-4 h-full flex items-center flex-1 truncate border-r border-slate-200 dark:border-slate-700">担当者名</div>
          <div className="flex gap-2 shrink-0 px-3">
            <div className="w-12 text-center" title="進行中件数">進行中</div>
            <div className="w-12 text-center" title="遅延件数">遅延</div>
            <div className="w-12 text-center" title="今週終了予定">今週終了</div>
            <div className="w-12 text-center" title="レビュー待ち">レビュー</div>
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
              <div className="flex gap-2 shrink-0 text-sm px-3 items-center">
                <div className={getStatusClasses(row.inProgressCount, 'inProgress')}>
                  {row.inProgressCount}
                </div>
                <div className={getStatusClasses(row.delayedCount, 'delayed')}>
                  {row.delayedCount}
                </div>
                <div className={getStatusClasses(row.endingThisWeekCount, 'ending')}>
                  {row.endingThisWeekCount}
                </div>
                <div className={getStatusClasses(row.reviewWaitingCount, 'review')}>
                  {row.reviewWaitingCount}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
