import React from 'react';
import { ChevronDown } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface ModeSwitcherProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  displayOptions,
  setDisplayOptions
}) => {
  const selectedMode = displayOptions.hidePlanningColumns
    ? 'actual'
    : displayOptions.isPlanningMode
      ? 'planned'
      : 'standard';

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = event.target.value;

    if (mode === 'planned') {
      setDisplayOptions((prev: DisplayOptions) => ({
        ...prev,
        isPlanningMode: true,
        hidePlanningColumns: false
      }));
      return;
    }

    if (mode === 'actual') {
      setDisplayOptions((prev: DisplayOptions) => ({
        ...prev,
        isPlanningMode: false,
        hidePlanningColumns: true
      }));
      return;
    }

    setDisplayOptions((prev: DisplayOptions) => ({
      ...prev,
      isPlanningMode: false,
      hidePlanningColumns: false
    }));
  };

  return (
    <div className="relative flex items-center h-[36px]">
      <select
        value={selectedMode}
        onChange={handleModeChange}
        className="h-[36px] pl-3 pr-10 appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
        title="表示モード"
      >
        <option value="standard">標準</option>
        <option value="planned">計画入力</option>
        <option value="actual">実績入力</option>
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 text-slate-500 dark:text-slate-400"
      />
    </div>
  );
};

export default ModeSwitcher;
