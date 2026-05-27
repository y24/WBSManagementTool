import React from 'react';
import { DisplayOptions, ResourceLoadScope } from './FilterPanelTypes';

interface ResourceLoadScopeSelectProps {
  displayOptions: DisplayOptions;
  setDisplayOptions: React.Dispatch<React.SetStateAction<DisplayOptions>>;
}

const SCOPE_OPTIONS: { value: ResourceLoadScope; label: string }[] = [
  { value: '1w', label: '1週間' },
  { value: '2w', label: '2週間' },
  { value: '1m', label: '1ヶ月' },
  { value: '2m', label: '2ヶ月' },
  { value: '3m', label: '3ヶ月' },
];

const ResourceLoadScopeSelect: React.FC<ResourceLoadScopeSelectProps> = ({
  displayOptions,
  setDisplayOptions,
}) => {
  return (
    <select
      value={displayOptions.resourceLoadScope}
      onChange={(e) =>
        setDisplayOptions((prev) => ({
          ...prev,
          resourceLoadScope: e.target.value as ResourceLoadScope,
        }))
      }
      className="h-8 px-2 pr-6 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 rounded-lg shadow-sm cursor-pointer focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 appearance-none"
      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '16px' }}
      title="負荷率・空き期間の計算スコープ"
    >
      {SCOPE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

export default ResourceLoadScopeSelect;
