import React from 'react';
import { Filter, X, Search, Calendar, ChevronDown, Check, RotateCcw, Settings, Columns3, Columns2, ChartNoAxesGantt, Link2, Share2, Download } from 'lucide-react';
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
}

export interface DisplayOptions {
  showProjectRange: boolean;
  showTodayHighlight: boolean;
  showRemoved: boolean;
  showDoneProjects: boolean;
  hidePlanningColumns: boolean;
  showGanttChart: boolean;
  showAssigneeName: boolean;
  showProgressRate: boolean;
  isDarkMode: boolean;
}

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
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  // ポップアップの外をクリック、あるいはEscキー押下で閉じる
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
    <div className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-3 flex items-center gap-4 shrink-0 shadow-sm z-40 transition-colors">
      <div className="flex items-center gap-2 text-blue-600">
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

              if (!displayOptions.showRemoved && p.status_id === removedStatusId) return false;
              if (!displayOptions.showDoneProjects && doneStatusId !== null && p.status_id === doneStatusId) return false;

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
          options={statuses.map(s => ({
            id: s.id,
            name: s.status_name,
            color: s.color_code,
            disabled: !displayOptions.showRemoved && s.status_name === 'Removed'
          }))}
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
          <Search size={14} className="absolute left-3 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            placeholder="名称で検索..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium shadow-sm"
          />
        </div>

        {/* Delayed Toggle */}
        <button
          onClick={() => setFilters(prev => ({ ...prev, onlyDelayed: !prev.onlyDelayed }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold whitespace-nowrap h-[34px] shadow-sm ${filters.onlyDelayed
            ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 ring-rose-500/10 ring-2'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-500'
            }`}
        >
          <Calendar size={14} className={filters.onlyDelayed ? 'animate-pulse' : ''} />
          遅延タスク
        </button>

        <button
          onClick={onClear}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 border border-slate-200 dark:border-slate-700 ${!isFiltered ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          title="フィルターをリセット"
        >
          <RotateCcw size={14} />
          リセット
        </button>

        {/* Done Projects Toggle は設定ポップアップへ移動 */}
      </div>

      <button
        onClick={() => setDisplayOptions(prev => ({ ...prev, hidePlanningColumns: !prev.hidePlanningColumns }))}
        className={`p-2 rounded-lg border transition-all shadow-sm ${displayOptions.hidePlanningColumns
          ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        title={displayOptions.hidePlanningColumns ? '計画列を表示' : '計画列を非表示'}
        aria-label={displayOptions.hidePlanningColumns ? '計画列を表示' : '計画列を非表示'}
      >
        {displayOptions.hidePlanningColumns ? <Columns2 size={18} /> : <Columns3 size={18} />}
      </button>

      <button
        onClick={() => setDisplayOptions(prev => ({ ...prev, showGanttChart: !prev.showGanttChart }))}
        className={`p-2 rounded-lg border transition-all shadow-sm ${displayOptions.showGanttChart
          ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-500'
          : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
          }`}
        title={displayOptions.showGanttChart ? 'ガントチャートを非表示' : 'ガントチャートを表示'}
        aria-label={displayOptions.showGanttChart ? 'ガントチャートを非表示' : 'ガントチャートを表示'}
      >
        <ChartNoAxesGantt size={18} />
      </button>

      <button
        onClick={async () => {
          try {
            const { apiClient } = await import('../api/client');
            const response = await apiClient.post<{ token: string }>('/shared-filters', { filter_data: filters });
            const token = response.data.token;
            const url = `${window.location.origin}${window.location.pathname}?share=${token}`;
            await navigator.clipboard.writeText(url);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          } catch (error) {
            console.error('Failed to share filters:', error);
            alert('URLの発行に失敗しました。');
          }
        }}
        className={`relative p-2 rounded-lg border transition-all shadow-sm ${isCopied
          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-600'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500'
          }`}
        title="URLをコピーして共有"
      >
        {isCopied ? <Check size={18} /> : <Link2 size={18} />}
        {isCopied && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded shadow-lg animate-in fade-in slide-in-from-top-1 z-50">
            Copied!
          </div>
        )}
      </button>

      <button
        onClick={onExport}
        className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all shadow-sm"
        title="Excelをダウンロード"
      >
        <Download size={18} />
      </button>

      <div className="relative" ref={settingsRef}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-lg border transition-all shadow-sm ${isSettingsOpen
            ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 dark:shadow-blue-900/20'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500'
            }`}
          title="表示設定"
        >
          <Settings size={18} className={isSettingsOpen ? 'animate-spin-slow' : ''} />
        </button>

        {isSettingsOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-4 border-b dark:border-slate-700 pb-2 flex items-center gap-2">
              <Settings size={14} />
              表示オプション
            </h3>

            <div className="space-y-4">
              {/*ツリー設定 */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">ツリー</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      完了済プロジェクトを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showDoneProjects}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showDoneProjects: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      Removedアイテムを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showRemoved}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showRemoved: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-500 shadow-inner"></div>
                    </div>
                  </label>

                </div>
              </div>

              {/* ガントチャート設定 */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">ガントチャート</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      今日の日付をハイライト
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showTodayHighlight}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showTodayHighlight: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      担当者名を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showAssigneeName}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showAssigneeName: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      進捗率を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showProgressRate}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showProgressRate: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      プロジェクト期間のハイライトを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showProjectRange}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, showProjectRange: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                    </div>
                  </label>

                </div>
              </div>

              {/* 全体設定 */}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">全体</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      ダークモード
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.isDarkMode}
                        onChange={(e) => setDisplayOptions(prev => ({ ...prev, isDarkMode: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-700 shadow-inner"></div>
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
