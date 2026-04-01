import React from 'react';
import { Layers, Users } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface ViewSwitcherProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  displayOptions,
  setDisplayOptions
}) => {
  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner h-[36px] items-center">
      <button
        onClick={() => setDisplayOptions((prev) => ({ ...prev, viewMode: 'wbs' }))}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${displayOptions.viewMode === 'wbs'
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="WBSビュー"
      >
        <Layers size={14} />
        WBS
      </button>
      <button
        onClick={() => setDisplayOptions((prev) => ({ ...prev, viewMode: 'resource' }))}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${displayOptions.viewMode === 'resource'
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="担当者ビュー"
      >
        <Users size={14} />
        担当者
      </button>
    </div>
  );
};

export default ViewSwitcher;
