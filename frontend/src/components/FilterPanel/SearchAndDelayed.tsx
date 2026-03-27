import React from 'react';
import { Search, Clock, RotateCcw } from 'lucide-react';
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
      <div className="relative flex items-center min-w-[140px] max-w-[200px] h-[34px]">
        <Search size={14} className="absolute left-3 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={filters.searchTerm}
          onChange={(e) => setFilters((prev: FilterState) => ({ ...prev, searchTerm: e.target.value }))}
          placeholder="名称で検索..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium shadow-sm"
        />
      </div>

      <button
        onClick={() => setFilters((prev: FilterState) => ({ ...prev, onlyDelayed: !prev.onlyDelayed }))}
        className={`p-2 rounded-lg border transition-all text-xs font-bold whitespace-nowrap h-[34px] shadow-sm ${filters.onlyDelayed
          ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 ring-rose-500/10 ring-2'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-500'
          }`}
        title="遅延タスクを表示"
        aria-label="遅延タスクを表示"
      >
        <Clock size={18} className={filters.onlyDelayed ? 'animate-pulse' : ''} />
      </button>

      <button
        onClick={onClear}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 border border-slate-200 dark:border-slate-700 ${!isFiltered ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="フィルターをリセット"
      >
        <RotateCcw size={14} />
        リセット
      </button>
    </>
  );
};

export default SearchAndDelayed;
