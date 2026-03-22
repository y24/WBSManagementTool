import React from 'react';
import { Filter, X, Search, Calendar, ChevronDown, Check, RotateCcw } from 'lucide-react';
import MultiSelect from './MultiSelect';
import { MstStatus, MstMember } from '../types';
import { Project } from '../types/wbs';

export interface FilterState {
  projectIds: number[];
  statusIds: number[];
  assigneeIds: number[];
  onlyDelayed: boolean;
  searchTerm: string;
  showRemoved: boolean;
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  projects: Project[];
  statuses: MstStatus[];
  members: MstMember[];
  onClear: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
  projects,
  statuses,
  members,
  onClear
}) => {
  const isFiltered = filters.projectIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.onlyDelayed ||
    filters.searchTerm !== '' ||
    filters.showRemoved;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0 shadow-sm z-40">
      <div className="flex items-center gap-2 text-blue-600 mr-2">
        <Filter size={18} className="stroke-[2.5px]" />
      </div>

      <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Project Filter */}
        <MultiSelect
          values={filters.projectIds}
          options={projects.map(p => ({ id: p.id, name: p.project_name }))}
          onChange={(ids) => setFilters(prev => ({ ...prev, projectIds: ids as number[] }))}
          placeholder="プロジェクトを選択"
          dropdownTitle="プロジェクト"
          className="hover:shadow-md h-[34px]"
        />

        {/* Status Filter */}
        <MultiSelect
          values={filters.statusIds}
          options={statuses.map(s => ({ id: s.id, name: s.status_name }))}
          onChange={(ids) => setFilters(prev => ({ ...prev, statusIds: ids as number[] }))}
          placeholder="ステータスを選択"
          dropdownTitle="ステータス"
          className="hover:shadow-md h-[34px]"
        />

        {/* Assignee Filter */}
        <MultiSelect
          values={filters.assigneeIds}
          options={members.map(m => ({ id: m.id, name: m.member_name }))}
          onChange={(ids) => setFilters(prev => ({ ...prev, assigneeIds: ids as number[] }))}
          placeholder="担当者を選択"
          dropdownTitle="担当者"
          className="hover:shadow-md h-[34px]"
        />

        {/* Search */}
        <div className="relative flex items-center min-w-[140px] max-w-[200px] h-[34px]">
          <Search size={14} className="absolute left-3 text-gray-400" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            placeholder="名称で検索..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium shadow-sm"
          />
        </div>

        {/* Delayed Toggle */}
        <button
          onClick={() => setFilters(prev => ({ ...prev, onlyDelayed: !prev.onlyDelayed }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold whitespace-nowrap h-[34px] shadow-sm ${filters.onlyDelayed
              ? 'bg-rose-50 border-rose-200 text-rose-600 ring-rose-500/10 ring-2'
              : 'bg-white border-gray-200 text-gray-600 hover:border-rose-400 hover:text-rose-500'
            }`}
        >
          <Calendar size={14} className={filters.onlyDelayed ? 'animate-pulse' : ''} />
          遅延タスクのみ
        </button>

        {/* Removed Toggle */}
        <button
          onClick={() => setFilters(prev => ({ ...prev, showRemoved: !prev.showRemoved }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold whitespace-nowrap h-[34px] shadow-sm ${filters.showRemoved
              ? 'bg-slate-100 border-slate-400 text-slate-700 ring-slate-500/10 ring-2 shadow-inner'
              : 'bg-white border-gray-200 text-gray-400 hover:border-slate-400 hover:text-slate-600'
            }`}
        >
          <X size={14} className={filters.showRemoved ? 'rotate-45 transition-transform' : ''} />
          Removedを表示
        </button>
      </div>

      <button
        onClick={onClear}
        disabled={!isFiltered}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all rounded-lg border font-bold uppercase tracking-tight ${isFiltered
            ? 'text-gray-600 bg-white border-gray-200 hover:border-blue-400 hover:text-blue-600 shadow-sm'
            : 'text-gray-300 bg-gray-50 border-gray-100 cursor-not-allowed'
          }`}
        title="すべて解除"
      >
        <RotateCcw size={14} className={isFiltered ? 'animate-in spin-in-180 duration-500' : ''} />
        <span>リセット</span>
      </button>
    </div>
  );
};

export default FilterPanel;
