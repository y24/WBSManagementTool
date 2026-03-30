import React from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { FilterState } from './FilterPanelTypes';

interface SearchAndDelayedProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isFiltered: boolean;
  onClear: () => void;
}

const SearchAndDelayed: React.FC<SearchAndDelayedProps> = ({
  filters,
  setFilters,
  isFiltered,
  onClear
}) => {
  return (
    <>
      <button
        onClick={() => setFilters((prev: FilterState) => ({ ...prev, onlyDelayed: !prev.onlyDelayed }))}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-bold whitespace-nowrap h-[34px] shadow-sm ${filters.onlyDelayed
          ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 ring-rose-500/10 ring-2'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-500'
          }`}
        title="遅延タスクを表示"
        aria-label="遅延タスクを表示"
      >
        <Clock size={16} className={filters.onlyDelayed ? 'animate-pulse' : ''} />
        遅延タスク
      </button>

    </>
  );
};

export default SearchAndDelayed;
