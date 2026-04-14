import React from 'react';
import { GanttScale } from '../../types/wbs';
import { DisplayOptions } from './FilterPanelTypes';
import { CalendarDays, CalendarRange, CalendarDays as CalendarMonth } from 'lucide-react';

interface GanttScaleSwitcherProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const GanttScaleSwitcher: React.FC<GanttScaleSwitcherProps> = ({
  displayOptions,
  setDisplayOptions,
}) => {
  const scales: { value: GanttScale; label: string; icon: React.ReactNode }[] = [
    { value: 'day', label: '日', icon: <CalendarDays size={14} /> },
    { value: 'week', label: '週', icon: <CalendarRange size={14} /> },
    { value: 'month', label: '月', icon: <CalendarMonth size={14} /> },
  ];

  return (
    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
      {scales.map((scale) => (
        <button
          key={scale.value}
          onClick={() => setDisplayOptions(prev => ({ ...prev, ganttScale: scale.value }))}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
            ${displayOptions.ganttScale === scale.value
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }
          `}
          title={`${scale.label}単位で表示`}
        >
          {scale.icon}
          <span>{scale.label}</span>
        </button>
      ))}
    </div>
  );
};

export default GanttScaleSwitcher;
