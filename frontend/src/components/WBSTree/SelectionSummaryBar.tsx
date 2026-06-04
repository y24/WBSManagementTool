import React from 'react';
import { createPortal } from 'react-dom';
import { Calculator, ListChecks } from 'lucide-react';
import { SelectedSubtaskSummary } from './hooks/useWBSSelection';

interface SelectionSummaryBarProps {
  summary: SelectedSubtaskSummary;
  visible: boolean;
}

const effortFormatter = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const formatEffort = (value: number) => `${effortFormatter.format(value)}人日`;

const SelectionSummaryBar: React.FC<SelectionSummaryBarProps> = ({ summary, visible }) => {
  const shouldRender = visible || summary.count > 0;

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-x-0 bottom-0 z-[10004] border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/95 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
          <ListChecks size={15} className="text-slate-500 dark:text-slate-400" />
          <span>選択サブタスク</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {summary.count}
          </span>
        </div>

        <div
          className="flex items-center gap-2"
          title={`予定工数が入力されているサブタスク: ${summary.plannedEffortInputCount}件`}
        >
          <Calculator size={14} className="text-slate-400" />
          <span className="text-slate-500 dark:text-slate-400">予定工数 合計</span>
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {formatEffort(summary.plannedEffortDays)}
          </span>
        </div>

        <div
          className="flex items-center gap-2"
          title={`実績工数が入力されているサブタスク: ${summary.actualEffortInputCount}件`}
        >
          <span className="text-slate-500 dark:text-slate-400">実績工数 合計</span>
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {formatEffort(summary.actualEffortDays)}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default React.memo(SelectionSummaryBar);
