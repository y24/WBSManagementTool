import React, { memo } from 'react';
import { GripVertical, AlertTriangle, Pencil } from 'lucide-react';
import { Subtask } from '../../types/wbs';
import { InitialData } from '../../types';
import EditableInput from './EditableInput';
import StatusSelect from './StatusSelect';
import PortalSelect from './PortalSelect';
import { getWarning } from './utils';
import { commonRowClasses, commonCellClasses, dateCellClasses } from './constants';

interface SubtaskRowProps {
  subtask: Subtask;
  nameWidth: number;
  checked: boolean;
  onToggleCheck: () => void;
  initialData: InitialData | null;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  onEditDetail: () => void;
  provided: any;
}

const SubtaskRow = memo(({ 
  subtask, 
  nameWidth, 
  checked, 
  onToggleCheck, 
  initialData, 
  onUpdateField, 
  onEditDetail, 
  provided 
}: SubtaskRowProps) => {
  const warning = getWarning(subtask);
  return (
    <div className={`flex group wbs-row-subtask ${commonRowClasses}`}>
      <div
        className={`sticky left-0 z-20 flex items-center gap-1 pl-12 text-gray-600 wbs-cell-subtask transition-colors ${commonCellClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-1"
        />
        <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <PortalSelect
            value={subtask.subtask_type_id}
            options={initialData?.subtask_types.map(t => ({ id: t.id, name: t.type_name })) || []}
            onChange={v => onUpdateField('subtask', subtask.id, 'subtask_type_id', v)}
            className="font-semibold text-gray-700 -ml-1"
            dropdownTitle="種別を変更"
          />
          <span className="text-gray-400 text-xs truncate" title={subtask.subtask_detail || undefined}>
            {subtask.subtask_detail}
          </span>
          {warning && (
            <span title={warning} className="cursor-help inline-flex">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            </span>
          )}
        </div>
        <button
          onClick={onEditDetail}
          className="text-gray-300 hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          title="詳細を編集"
        >
          <Pencil size={14} />
        </button>
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <StatusSelect 
          subtask={subtask} 
          initialData={initialData} 
          onUpdateField={onUpdateField} 
        />
      </div>
      <div className={`w-28 flex items-center ${commonCellClasses}`}>
        <PortalSelect
          value={subtask.assignee_id}
          options={initialData?.members.map(m => ({ id: m.id, name: m.member_name })) || []}
          onChange={v => onUpdateField('subtask', subtask.id, 'assignee_id', v)}
          className="w-full text-sm"
          placeholder="未設定"
          dropdownTitle="担当者を変更"
        />
      </div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_start_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_start_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.planned_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'planned_end_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_start_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_start_date', v) } /></div>
      <div className={`w-20 ${dateCellClasses}`}><EditableInput type="date" value={subtask.actual_end_date} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'actual_end_date', v) } /></div>
      <div className={`w-16 ${commonCellClasses}`}>
        <EditableInput type="number" value={subtask.progress_percent} onChange={(v: string) => onUpdateField('subtask', subtask.id, 'progress_percent', v ? Number(v) : null)} />
      </div>
    </div>
  );
});

export default SubtaskRow;
