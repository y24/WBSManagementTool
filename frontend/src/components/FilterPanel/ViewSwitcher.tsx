import React, { useState, useTransition } from 'react';
import { Layers, Users } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface ViewSwitcherProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
  onViewModeSwitchStart?: (viewMode: DisplayOptions['viewMode']) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  displayOptions,
  setDisplayOptions,
  onViewModeSwitchStart,
}) => {
  const [, startTransition] = useTransition();
  const [activeViewMode, setActiveViewMode] = useState(displayOptions.viewMode);

  const switchView = (viewMode: DisplayOptions['viewMode']) => {
    if (viewMode === activeViewMode) return;
    setActiveViewMode(viewMode);
    onViewModeSwitchStart?.(viewMode);
    startTransition(() => {
      setDisplayOptions((prev) => ({ ...prev, viewMode }));
    });
  };

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner h-[36px] items-center">
      <button
        onClick={() => switchView('wbs')}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${activeViewMode === 'wbs'
          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        title="WBSビュー"
      >
        <Layers size={14} />
        WBS
      </button>
      <button
        onClick={() => switchView('resource')}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none ${activeViewMode === 'resource'
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
