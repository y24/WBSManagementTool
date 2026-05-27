import React from 'react';
import { Settings } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface SettingsDropdownProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const SettingsDropdown: React.FC<SettingsDropdownProps> = ({
  displayOptions,
  setDisplayOptions
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
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

  return (
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
            {/* 共通設定 */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">共通</div>
              <div className="space-y-2">
                <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    今日の日付をハイライト
                  </span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displayOptions.showTodayHighlight}
                      onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showTodayHighlight: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    マーカーを表示
                  </span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displayOptions.showMarkers}
                      onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showMarkers: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* WBSビュー設定 */}
            {displayOptions.viewMode === 'wbs' && (
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">WBSビュー</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      工数列を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showManHours}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showManHours: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      タスク種別・担当者名を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showAssigneeName}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showAssigneeName: e.target.checked }))}
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
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showProgressRate: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      プロジェクト期間にハイライトを表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showProjectRange}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showProjectRange: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      バーを担当者ごとに色分け
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.colorMode === 'assignee'}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          colorMode: e.target.checked ? 'assignee' : 'status'
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      同一担当者を強調表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.highlightSameAssignee}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          highlightSameAssignee: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      遅延タスクを強調
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.highlightDelayedTasks}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          highlightDelayedTasks: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      中断理由を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showInterruptionReason}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          showInterruptionReason: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-500 shadow-inner"></div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {displayOptions.viewMode === 'resource' && (
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">担当者ビュー</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      タスク種別を表示
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.showResourceTaskType}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          showResourceTaskType: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500 shadow-inner"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      バーをタスクごとに色分け
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displayOptions.colorByTask}
                        onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({
                          ...prev,
                          colorByTask: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 shadow-inner"></div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 全体設定 */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 border-t pt-3">システム</div>
              <div className="space-y-2">
                <label className="flex items-center justify-between cursor-pointer group px-1 py-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    ダークモード
                  </span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displayOptions.isDarkMode}
                      onChange={(e) => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, isDarkMode: e.target.checked }))}
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
  );
};

export default SettingsDropdown;
