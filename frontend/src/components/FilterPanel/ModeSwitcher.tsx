import React from 'react';
import { Layout, PenTool, LayoutDashboard } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface ModeSwitcherProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  displayOptions,
  setDisplayOptions
}) => {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner h-[36px] items-center">
      <button
        onClick={() => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, isPlanningMode: false, hidePlanningColumns: false }))}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${!displayOptions.isPlanningMode && !displayOptions.hidePlanningColumns
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="標準表示"
      >
        <Layout size={14} />
        標準
      </button>
      <button
        onClick={() => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, isPlanningMode: true, hidePlanningColumns: false }))}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${displayOptions.isPlanningMode
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="計画モード"
      >
        <PenTool size={14} />
        計画
      </button>
      <button
        onClick={() => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, hidePlanningColumns: true, isPlanningMode: false }))}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${displayOptions.hidePlanningColumns
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="実績モード"
      >
        <LayoutDashboard size={14} />
        実績
      </button>
    </div>
  );
};

export default ModeSwitcher;
