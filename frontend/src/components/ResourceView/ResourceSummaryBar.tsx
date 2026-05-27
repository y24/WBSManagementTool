import React from 'react';
import { ResourceRow } from '../../pages/mainboard/useResourceData';

interface ResourceSummaryBarProps {
  data: ResourceRow[];
}

export default function ResourceSummaryBar({ data }: ResourceSummaryBarProps) {
  const assigned = data.filter(r => r.assignee !== null);
  if (assigned.length === 0) return null;

  const avgLoadRate = Math.round(
    assigned.reduce((sum, r) => sum + r.loadRate, 0) / assigned.length
  );
  const delayedCount = assigned.filter(r => r.delayedCount > 0).length;
  const idleCount = assigned.filter(r => r.loadRate > 0 && r.loadRate <= 30).length;
  const overloadedCount = assigned.filter(r => r.loadRate > 100).length;

  const cards = [
    {
      label: '平均負荷率',
      value: avgLoadRate > 0 ? `${avgLoadRate}%` : '—',
      bg: 'bg-slate-50 dark:bg-slate-800/60',
      textColor:
        avgLoadRate > 120
          ? 'text-rose-600 dark:text-rose-400'
          : avgLoadRate > 100
            ? 'text-amber-600 dark:text-amber-400'
            : avgLoadRate <= 30
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-slate-700 dark:text-slate-200',
      labelColor: 'text-slate-500 dark:text-slate-400',
    },
    {
      label: '遅延担当者',
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
    },
    {
      label: '空き多い（≤30%）',
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
    },
    {
      label: '過負荷（>100%）',
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
    },
  ];

  return (
    <div className="shrink-0 flex gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {cards.map(card => (
        <div
          key={card.label}
          className={`flex-1 rounded-lg px-3 py-2 ${card.bg}`}
        >
          <div className={`text-[10px] font-medium leading-none mb-1 ${card.labelColor}`}>
            {card.label}
          </div>
          <div className={`text-[17px] font-semibold leading-none ${card.textColor}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
