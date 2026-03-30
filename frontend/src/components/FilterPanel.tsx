import React from 'react';
import { Filter, ChevronDown, ChevronUp, Search, Settings2, RotateCcw } from 'lucide-react';
import { InitialData } from '../types';
import { Project } from '../types/wbs';
export * from './FilterPanel/FilterPanelTypes';
import { FilterState, DisplayOptions } from './FilterPanel/FilterPanelTypes';
import FilterControls from './FilterPanel/FilterControls';
import SearchAndDelayed from './FilterPanel/SearchAndDelayed';
import ModeSwitcher from './FilterPanel/ModeSwitcher';
import ActionButtons from './FilterPanel/ActionButtons';
import SettingsDropdown from './FilterPanel/SettingsDropdown';
import MultiSelect from './MultiSelect';

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
  projects: Project[];
  initialData: InitialData | null;
  onClear: () => void;
  onExport: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
  displayOptions,
  setDisplayOptions,
  projects,
  initialData,
  onClear,
  onExport
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const statuses = initialData?.statuses || [];
  const subtaskTypes = initialData?.subtask_types || [];

  const isFiltered = filters.projectIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.subtaskTypeIds.length > 0 ||
    filters.onlyDelayed ||
    filters.searchTerm !== '';

  const secondaryFilterCount = (filters.subtaskTypeIds.length > 0 ? filters.subtaskTypeIds.length : 0) + (filters.searchTerm !== '' ? 1 : 0);

  // Removedステータスの自動解除
  React.useEffect(() => {
    if (!displayOptions.showRemoved) {
      const removedStatusId = statuses.find(s => s.status_name === 'Removed')?.id;
      if (removedStatusId && filters.statusIds.includes(removedStatusId)) {
        setFilters(prev => ({
          ...prev,
          statusIds: prev.statusIds.filter(id => id !== removedStatusId)
        }));
      }
    }
  }, [displayOptions.showRemoved, statuses, filters.statusIds, setFilters]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex flex-col shrink-0 shadow-sm z-40 transition-colors">
      <div className="px-5 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-600">
          <Filter size={18} className="stroke-[2.5px]" />
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1.5 font-medium">
          <FilterControls
            filters={filters}
            setFilters={setFilters}
            displayOptions={displayOptions}
            projects={projects}
            initialData={initialData}
          />

          <SearchAndDelayed
            filters={filters}
            setFilters={setFilters}
            isFiltered={isFiltered}
            onClear={onClear}
          />

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold transition-all shadow-sm border ${isExpanded ? 'border-blue-400 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}
          >
            <Settings2 size={14} />
            詳細
            {secondaryFilterCount > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full text-[10px] min-w-[18px] text-center">
                {secondaryFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={onClear}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 border border-slate-200 dark:border-slate-700 ${!isFiltered ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            title="フィルターをリセット"
          >
            <RotateCcw size={14} />
            リセット
          </button>
        </div>

        <ModeSwitcher
          displayOptions={displayOptions}
          setDisplayOptions={setDisplayOptions}
        />

        <ActionButtons
          filters={filters}
          displayOptions={displayOptions}
          setDisplayOptions={setDisplayOptions}
          onExport={onExport}
        />

        <SettingsDropdown
          displayOptions={displayOptions}
          setDisplayOptions={setDisplayOptions}
        />
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-[18px] mr-2" /> {/* Alignment shim for Filter icon */}

          <div className="flex items-center gap-4 flex-1">
            {/* Subtask Type Filter moved from FilterControls */}
            <div className="flex items-center gap-2">
              <MultiSelect
                values={filters.subtaskTypeIds}
                options={subtaskTypes.map(t => ({ id: t.id, name: t.type_name }))}
                onChange={(ids) => setFilters((prev: FilterState) => ({ ...prev, subtaskTypeIds: ids as number[] }))}
                placeholder="種別を選択"
                dropdownTitle="サブタスク種別"
                className="hover:shadow-md h-[34px] min-w-[150px]"
              />
            </div>

            {/* Search Input moved from SearchAndDelayed */}
            <div className="flex items-center gap-2 min-w-[140px] max-w-[200px]">
              <div className="relative flex items-center flex-1 h-[34px]">
                <Search size={14} className="absolute left-3 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters((prev: FilterState) => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder="名称で検索..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
