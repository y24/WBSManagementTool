import React from 'react';
import { Filter } from 'lucide-react';
import { InitialData } from '../types';
import { Project } from '../types/wbs';
export * from './FilterPanel/FilterPanelTypes';
import { FilterState, DisplayOptions } from './FilterPanel/FilterPanelTypes';
import FilterControls from './FilterPanel/FilterControls';
import SearchAndDelayed from './FilterPanel/SearchAndDelayed';
import ModeSwitcher from './FilterPanel/ModeSwitcher';
import ActionButtons from './FilterPanel/ActionButtons';
import SettingsDropdown from './FilterPanel/SettingsDropdown';

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
  const statuses = initialData?.statuses || [];

  const isFiltered = filters.projectIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.subtaskTypeIds.length > 0 ||
    filters.onlyDelayed ||
    filters.searchTerm !== '';

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
    <div className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-5 py-2 flex items-center gap-4 shrink-0 shadow-sm z-40 transition-colors">
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
  );
};

export default FilterPanel;
