import React from 'react';
import { Filter, X, Search, Calendar, ChevronDown, Check, RotateCcw, Settings } from 'lucide-react';
import MultiSelect from './MultiSelect';
import { InitialData } from '../types';
import { Project } from '../types/wbs';

export interface FilterState {
  projectIds: number[];
  statusIds: number[];
  assigneeIds: number[];
  subtaskTypeIds: number[];
  onlyDelayed: boolean;
  searchTerm: string;
  showRemoved: boolean;
  showDoneProjects: boolean;
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  displayOptions: { showProjectRange: boolean };
  setDisplayOptions: React.Dispatch<React.SetStateAction<{ showProjectRange: boolean }>>;
  projects: Project[];
  initialData: InitialData | null;
  onClear: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
  displayOptions,
  setDisplayOptions,
  projects,
  initialData,
  onClear
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  // ポップアップの外をクリックしたら閉じる
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);
  const statuses = initialData?.statuses || [];
  const members = initialData?.members || [];
  const subtaskTypes = initialData?.subtask_types || [];

  const isFiltered = filters.projectIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.subtaskTypeIds.length > 0 ||
    filters.onlyDelayed ||
    filters.searchTerm !== '' ||
    filters.showRemoved ||
    filters.showDoneProjects;

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0 shadow-sm z-40">
      <div className="flex items-center gap-2 text-blue-600 mr-2">
        <Filter size={18} className="stroke-[2.5px]" />
      </div>

      <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Project Filter */}
        <MultiSelect
          values={filters.projectIds}
          options={projects
            .filter(p => {
              const doneStatusId = initialData?.status_mapping_done ? parseInt(initialData.status_mapping_done) : null;
              const removedStatusId = statuses.find(s => s.status_name === 'Removed')?.id || 7;

              // 選択中のプロジェクトは常に表示（非表示にするとボタンのラベルが空になってしまうため）
              if (filters.projectIds.includes(p.id)) return true;

              if (!filters.showRemoved && p.status_id === removedStatusId) return false;
              if (!filters.showDoneProjects && doneStatusId !== null && p.status_id === doneStatusId) return false;

              return true;
            })
            .map(p => ({ id: p.id, name: p.project_name }))}
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

        {/* Subtask Type Filter */}
        <MultiSelect
          values={filters.subtaskTypeIds}
          options={subtaskTypes.map(t => ({ id: t.id, name: t.type_name }))}
          onChange={(ids) => setFilters(prev => ({ ...prev, subtaskTypeIds: ids as number[] }))}
          placeholder="サブタスク種別を選択"
          dropdownTitle="サブタスク種別"
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
          遅延タスク
        </button>

        {/* Done Projects Toggle は設定ポップアップへ移動 */}
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

      <div className="relative" ref={settingsRef}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-lg border transition-all shadow-sm ${isSettingsOpen
            ? 'bg-blue-50 border-blue-400 text-blue-600'
            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'
            }`}
          title="表示設定"
        >
          <Settings size={18} className={isSettingsOpen ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
        </button>

        {isSettingsOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
              <Settings size={14} />
              表示オプション
            </h3>

            <div className="space-y-4">
              {/*ツリー設定 */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">ツリー</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                      完了済プロジェクトを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.showDoneProjects}
                        onChange={(e) => setFilters(prev => ({ ...prev, showDoneProjects: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                      削除済アイテムを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.showRemoved}
                        onChange={(e) => setFilters(prev => ({ ...prev, showRemoved: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-500"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* ガントチャート設定 */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">ガントチャート</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                      プロジェクト期間のハイライトを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showProjectRange}
                        onChange={(e) => setDisplayOptions({ ...displayOptions, showProjectRange: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
