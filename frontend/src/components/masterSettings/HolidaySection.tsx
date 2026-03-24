import type { MstHoliday } from '../../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, SyncIcon, TrashIcon, XIcon, sectionIconStyle } from './icons';

interface NewHoliday {
  holiday_date: string;
  holiday_name: string;
}

interface HolidaySectionProps {
  holidays: MstHoliday[];
  showAddHoliday: boolean;
  setShowAddHoliday: (value: boolean) => void;
  newHoliday: NewHoliday;
  setNewHoliday: (value: NewHoliday) => void;
  createHoliday: () => void;
  isSyncingHolidays: boolean;
  syncHolidays: () => void;
  isHolidayListExpanded: boolean;
  setIsHolidayListExpanded: (value: boolean) => void;
  isEditing: (id: number, field: string) => boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  editColorValue: string;
  setEditColorValue: (value: string) => void;
  saveEdit: (endpoint: string, id: number, payload: Record<string, unknown>) => void;
  cancelEdit: () => void;
  startEdit: (id: number, field: string, currentValue: string, colorValue?: string) => void;
  deleteItem: (endpoint: string, id: number, name: string) => void;
}

export function HolidaySection({
  holidays,
  showAddHoliday,
  setShowAddHoliday,
  newHoliday,
  setNewHoliday,
  createHoliday,
  isSyncingHolidays,
  syncHolidays,
  isHolidayListExpanded,
  setIsHolidayListExpanded,
  isEditing,
  editValue,
  setEditValue,
  editColorValue,
  setEditColorValue,
  saveEdit,
  cancelEdit,
  startEdit,
  deleteItem,
}: HolidaySectionProps) {
  const displayedHolidays = isHolidayListExpanded ? holidays : holidays.slice(0, 8);

  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={sectionIconStyle('linear-gradient(135deg, #f97316, #ef4444)')}>H</span>
          祝日一覧
        </h3>
        <div className="flex gap-2">
          <button
            className={`master-sync-btn ${isSyncingHolidays ? 'animate-spin-slow' : ''}`}
            onClick={syncHolidays}
            disabled={isSyncingHolidays}
            title="APIから更新"
          >
            <SyncIcon />
          </button>
          <button className="master-add-btn" onClick={() => setShowAddHoliday(!showAddHoliday)} title="新規追加">
            <PlusIcon />
          </button>
        </div>
      </div>

      {showAddHoliday && (
        <div className="master-add-form">
          <div className="master-add-form-row">
            <input
              type="date"
              className="master-input master-input-date"
              value={newHoliday.holiday_date}
              onChange={e => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
            />
            <input
              type="text"
              className="master-input"
              placeholder="祝日名"
              value={newHoliday.holiday_name}
              onChange={e => setNewHoliday({ ...newHoliday, holiday_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createHoliday()}
            />
            <button className="master-confirm-btn" onClick={createHoliday}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddHoliday(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <div className="master-list">
        {displayedHolidays.map((h) => (
          <div key={h.id} className="master-list-item master-list-item-holiday">
            <div className="master-list-item-content">
              <span className="master-holiday-date">{h.holiday_date}</span>
              {isEditing(h.id, 'holiday') ? (
                <div className="master-edit-inline">
                  <input
                    type="date"
                    className="master-input master-input-date master-input-sm"
                    value={editColorValue}
                    onChange={e => setEditColorValue(e.target.value)}
                  />
                  <input
                    className="master-input master-input-sm"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit('/masters/holidays', h.id, { holiday_name: editValue, holiday_date: editColorValue });
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                  <button className="master-confirm-btn" onClick={() => saveEdit('/masters/holidays', h.id, { holiday_name: editValue, holiday_date: editColorValue })}>
                    <CheckIcon />
                  </button>
                  <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                </div>
              ) : (
                <span className="master-item-name">{h.holiday_name}</span>
              )}
            </div>
            {!isEditing(h.id, 'holiday') && (
              <div className="master-actions">
                <button className="master-action-btn master-edit" onClick={() => startEdit(h.id, 'holiday', h.holiday_name, h.holiday_date)} title="編集">
                  <PencilIcon />
                </button>
                <button className="master-action-btn master-delete" onClick={() => deleteItem('/masters/holidays', h.id, h.holiday_name)} title="削除">
                  <TrashIcon />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {holidays.length > 8 && (
        <button
          className="master-list-expand-btn"
          onClick={() => setIsHolidayListExpanded(!isHolidayListExpanded)}
        >
          {isHolidayListExpanded ? (
            <>
              <ChevronUpIcon />
              閉じる
            </>
          ) : (
            <>
              <ChevronDownIcon />
              すべての祝日を表示 ({holidays.length}件)
            </>
          )}
        </button>
      )}
    </section>
  );
}
