import React from 'react';
import { Activity } from 'lucide-react';
import { DisplayOptions } from './FilterPanelTypes';

interface OverlapThresholdSelectProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const OverlapThresholdSelect: React.FC<OverlapThresholdSelectProps> = ({
  displayOptions,
  setDisplayOptions
}) => {
  const options = [
    { value: 1, label: '1 (標準)' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  return (
    <div className="flex items-center gap-2 mr-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm transition-all hover:border-gray-300 dark:hover:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500">
        <Activity size={14} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">
          しきい値:
        </span>
        <select
          value={displayOptions.overlapThreshold}
          onChange={(e) => setDisplayOptions(prev => ({ ...prev, overlapThreshold: parseInt(e.target.value, 10) }))}
          className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 border-none p-0 pr-2 focus:ring-0 cursor-pointer outline-none min-w-[32px]"
          title="ヒートマップのしきい値を変更"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-800">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default OverlapThresholdSelect;
