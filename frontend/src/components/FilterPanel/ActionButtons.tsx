import React from 'react';
import { ChartNoAxesGantt, Check, Link2, Download } from 'lucide-react';
import { FilterState, DisplayOptions } from './FilterPanelTypes';
import { apiClient } from '../../api/client';

interface ActionButtonsProps {
  filters: FilterState;
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
  onExport: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  filters,
  displayOptions,
  setDisplayOptions,
  onExport
}) => {
  const [isCopied, setIsCopied] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setDisplayOptions((prev: DisplayOptions) => ({ ...prev, showGanttChart: !prev.showGanttChart }))}
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
    </>
  );
};

export default ActionButtons;
