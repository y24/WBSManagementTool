import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { MstStatus, MstSubtaskType, MstMember, MstHoliday, InitialData } from '../types';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────
type EditingItem = { id: number; field: string } | null;

interface NewStatus { status_name: string; color_code: string; }
interface NewSubtaskType { type_name: string; }
interface NewMember { member_name: string; }
interface NewHoliday { holiday_date: string; holiday_name: string; }

// ─────────────────────────────────────────────────
// Icons (inline SVG for minimal dep)
// ─────────────────────────────────────────────────
const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon-lg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SyncIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="master-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────
export default function MasterSettings() {
  const [data, setData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingItem>(null);
  const [editValue, setEditValue] = useState('');
  const [editColorValue, setEditColorValue] = useState('#000000');

  // New item forms
  const [newStatus, setNewStatus] = useState<NewStatus>({ status_name: '', color_code: '#3b82f6' });
  const [newSubtaskType, setNewSubtaskType] = useState<NewSubtaskType>({ type_name: '' });
  const [newMember, setNewMember] = useState<NewMember>({ member_name: '' });
  const [newHoliday, setNewHoliday] = useState<NewHoliday>({ holiday_date: '', holiday_name: '' });

  // Show/hide add forms
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddSubtaskType, setShowAddSubtaskType] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  // System Settings
  const [ticketUrlTemplate, setTicketUrlTemplate] = useState('');
  const [statusMappingNew, setStatusMappingNew] = useState<number[]>([]);
  const [statusMappingBlocked, setStatusMappingBlocked] = useState<number[]>([]);
  const [statusMappingDone, setStatusMappingDone] = useState<number[]>([]);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [isHolidayListExpanded, setIsHolidayListExpanded] = useState(false);

  const fetchData = useCallback(() => {
    apiClient.get<InitialData>('/initial-data')
      .then(res => {
        setData(res.data);
        setTicketUrlTemplate(res.data.ticket_url_template || '');
        setStatusMappingNew((res.data.status_mapping_new || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)));
        setStatusMappingBlocked((res.data.status_mapping_blocked || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)));
        setStatusMappingDone((res.data.status_mapping_done || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)));
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Inline Editing ───
  const startEdit = (id: number, field: string, currentValue: string, colorValue?: string) => {
    setEditing({ id, field });
    setEditValue(currentValue);
    if (colorValue) setEditColorValue(colorValue);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const saveEdit = async (endpoint: string, id: number, payload: Record<string, unknown>) => {
    try {
      await apiClient.patch(`${endpoint}/${id}`, payload);
      fetchData();
      cancelEdit();
    } catch (err) {
      console.error('Update failed', err);
    }
  };

  // ─── Delete ───
  const deleteItem = async (endpoint: string, id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try {
      await apiClient.delete(`${endpoint}/${id}`);
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  // ─── Create ───
  const createStatus = async () => {
    if (!newStatus.status_name.trim()) return;
    try {
      await apiClient.post('/masters/statuses', {
        status_name: newStatus.status_name.trim(),
        color_code: newStatus.color_code,
        sort_order: (data?.statuses.length ?? 0),
      });
      setNewStatus({ status_name: '', color_code: '#3b82f6' });
      setShowAddStatus(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const createSubtaskType = async () => {
    if (!newSubtaskType.type_name.trim()) return;
    try {
      await apiClient.post('/masters/subtask-types', {
        type_name: newSubtaskType.type_name.trim(),
        sort_order: (data?.subtask_types.length ?? 0),
      });
      setNewSubtaskType({ type_name: '' });
      setShowAddSubtaskType(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const createMember = async () => {
    if (!newMember.member_name.trim()) return;
    try {
      await apiClient.post('/masters/members', {
        member_name: newMember.member_name.trim(),
        sort_order: (data?.members.length ?? 0),
      });
      setNewMember({ member_name: '' });
      setShowAddMember(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const createHoliday = async () => {
    if (!newHoliday.holiday_date || !newHoliday.holiday_name.trim()) return;
    try {
      await apiClient.post('/masters/holidays', {
        holiday_date: newHoliday.holiday_date,
        holiday_name: newHoliday.holiday_name.trim(),
      });
      setNewHoliday({ holiday_date: '', holiday_name: '' });
      setShowAddHoliday(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const syncHolidays = async () => {
    if (!confirm('日本の祝日を外部APIから取得して更新しますか？\n(既に存在する日は上書きされ、新しい日は追加されます)')) return;
    try {
      setIsSyncingHolidays(true);
      const res = await apiClient.post<{ message: string }>('/masters/holidays/sync');
      alert(res.data.message);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('祝日の同期に失敗しました。');
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      setIsSavingSetting(true);
      await apiClient.put(`/settings/${key}`, { setting_value: value });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const toggleMapping = (category: 'new' | 'blocked' | 'done', statusId: number) => {
    let current: number[] = [];
    let key = '';
    if (category === 'new') { current = statusMappingNew; key = 'status_mapping_new'; }
    if (category === 'blocked') { current = statusMappingBlocked; key = 'status_mapping_blocked'; }
    if (category === 'done') { current = statusMappingDone; key = 'status_mapping_done'; }

    const next = current.includes(statusId)
      ? current.filter(id => id !== statusId)
      : [...current, statusId];

    saveSetting(key, next.join(','));
  };

  // ─── Render helpers ───
  const isEditing = (id: number, field: string) =>
    editing?.id === id && editing?.field === field;

  if (loading) return <div className="master-loading">マスタデータを読み込み中...</div>;

  return (
    <div className="master-page">
      <div className="master-container">
        <h2 className="master-title">マスタ・設定</h2>

        {/* ═══════════ ステータス一覧 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>S</span>
              ステータス一覧
            </h3>
            <button className="master-add-btn" onClick={() => setShowAddStatus(!showAddStatus)} title="新規追加">
              <PlusIcon />
            </button>
          </div>

          {showAddStatus && (
            <div className="master-add-form">
              <div className="master-add-form-row">
                <input
                  type="text"
                  className="master-input"
                  placeholder="ステータス名"
                  value={newStatus.status_name}
                  onChange={e => setNewStatus({ ...newStatus, status_name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && createStatus()}
                  autoFocus
                />
                <input
                  type="color"
                  className="master-color-input"
                  value={newStatus.color_code}
                  onChange={e => setNewStatus({ ...newStatus, color_code: e.target.value })}
                />
                <button className="master-confirm-btn" onClick={createStatus}><CheckIcon /></button>
                <button className="master-cancel-btn" onClick={() => setShowAddStatus(false)}><XIcon /></button>
              </div>
            </div>
          )}

          <div className="master-list">
            {data?.statuses.map((s: MstStatus) => (
              <div key={s.id} className="master-list-item">
                <div className="master-list-item-content">
                  <span className="master-color-dot" style={{ backgroundColor: s.color_code }}></span>
                  {isEditing(s.id, 'status') ? (
                    <div className="master-edit-inline">
                      <input
                        className="master-input master-input-sm"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit('/masters/statuses', s.id, { status_name: editValue, color_code: editColorValue });
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                      />
                      <input
                        type="color"
                        className="master-color-input"
                        value={editColorValue}
                        onChange={e => setEditColorValue(e.target.value)}
                      />
                      <button className="master-confirm-btn" onClick={() => saveEdit('/masters/statuses', s.id, { status_name: editValue, color_code: editColorValue })}>
                        <CheckIcon />
                      </button>
                      <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                    </div>
                  ) : (
                    <span className="master-item-name">{s.status_name}</span>
                  )}
                </div>
                {!isEditing(s.id, 'status') && (
                  <div className="master-actions">
                    <button className="master-action-btn master-edit" onClick={() => startEdit(s.id, 'status', s.status_name, s.color_code)} title="編集">
                      <PencilIcon />
                    </button>
                    {!s.is_system_reserved && (
                      <button className="master-action-btn master-delete" onClick={() => deleteItem('/masters/statuses', s.id, s.status_name)} title="削除">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ サブタスク種別一覧 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>T</span>
              サブタスク種別一覧
            </h3>
            <button className="master-add-btn" onClick={() => setShowAddSubtaskType(!showAddSubtaskType)} title="新規追加">
              <PlusIcon />
            </button>
          </div>

          {showAddSubtaskType && (
            <div className="master-add-form">
              <div className="master-add-form-row">
                <input
                  type="text"
                  className="master-input"
                  placeholder="種別名"
                  value={newSubtaskType.type_name}
                  onChange={e => setNewSubtaskType({ type_name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && createSubtaskType()}
                  autoFocus
                />
                <button className="master-confirm-btn" onClick={createSubtaskType}><CheckIcon /></button>
                <button className="master-cancel-btn" onClick={() => setShowAddSubtaskType(false)}><XIcon /></button>
              </div>
            </div>
          )}

          <div className="master-list master-list-chips">
            {data?.subtask_types.map((t: MstSubtaskType) => (
              <div key={t.id} className="master-chip master-chip-blue">
                {isEditing(t.id, 'subtask_type') ? (
                  <div className="master-edit-inline">
                    <input
                      className="master-input master-input-sm"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit('/masters/subtask-types', t.id, { type_name: editValue });
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <button className="master-confirm-btn" onClick={() => saveEdit('/masters/subtask-types', t.id, { type_name: editValue })}>
                      <CheckIcon />
                    </button>
                    <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                  </div>
                ) : (
                  <>
                    <span className="master-chip-text">{t.type_name}</span>
                    <div className="master-chip-actions">
                      <button className="master-chip-btn" onClick={() => startEdit(t.id, 'subtask_type', t.type_name)} title="編集"><PencilIcon /></button>
                      <button className="master-chip-btn master-chip-btn-del" onClick={() => deleteItem('/masters/subtask-types', t.id, t.type_name)} title="削除"><TrashIcon /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ 担当者一覧 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>M</span>
              担当者一覧
            </h3>
            <button className="master-add-btn" onClick={() => setShowAddMember(!showAddMember)} title="新規追加">
              <PlusIcon />
            </button>
          </div>

          {showAddMember && (
            <div className="master-add-form">
              <div className="master-add-form-row">
                <input
                  type="text"
                  className="master-input"
                  placeholder="担当者名"
                  value={newMember.member_name}
                  onChange={e => setNewMember({ member_name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && createMember()}
                  autoFocus
                />
                <button className="master-confirm-btn" onClick={createMember}><CheckIcon /></button>
                <button className="master-cancel-btn" onClick={() => setShowAddMember(false)}><XIcon /></button>
              </div>
            </div>
          )}

          <div className="master-list master-list-chips">
            {data?.members.map((m: MstMember) => (
              <div key={m.id} className="master-chip master-chip-green">
                {isEditing(m.id, 'member') ? (
                  <div className="master-edit-inline">
                    <input
                      className="master-input master-input-sm"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit('/masters/members', m.id, { member_name: editValue });
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <button className="master-confirm-btn" onClick={() => saveEdit('/masters/members', m.id, { member_name: editValue })}>
                      <CheckIcon />
                    </button>
                    <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                  </div>
                ) : (
                  <>
                    <span className="master-chip-text">{m.member_name}</span>
                    <div className="master-chip-actions">
                      <button className="master-chip-btn" onClick={() => startEdit(m.id, 'member', m.member_name)} title="編集"><PencilIcon /></button>
                      <button className="master-chip-btn master-chip-btn-del" onClick={() => deleteItem('/masters/members', m.id, m.member_name)} title="削除"><TrashIcon /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ 祝日一覧 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>H</span>
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
            {(isHolidayListExpanded ? data?.holidays : data?.holidays.slice(0, 8))?.map((h: MstHoliday) => (
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

          {(data?.holidays.length ?? 0) > 8 && (
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
                  すべての祝日を表示 ({data?.holidays.length}件)
                </>
              )}
            </button>
          )}
        </section>

        {/* ═══════════ システム設定 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #4b5563, #1f2937)' }}>⚙️</span>
              システム設定
            </h3>
          </div>

          <div className="master-setting-card">
            <div className="master-setting-info">
              <label className="master-setting-label">チケットURLテンプレート</label>
              <p className="master-setting-desc">
                チケットIDを置換するURLの形式を指定します。<code>{"{TICKET_ID}"}</code> が実際のIDに置き換わります。
              </p>
              <p className="master-setting-desc text-xs text-blue-500 mt-1">
                例: <code>https://dev.azure.com/Organization/Project/_workitems/edit/{"{TICKET_ID}"}</code>
              </p>
            </div>
            <div className="master-setting-action-full mt-4 flex gap-2">
              <input
                type="text"
                className="master-input flex-1"
                placeholder="https://..."
                value={ticketUrlTemplate}
                onChange={e => setTicketUrlTemplate(e.target.value)}
              />
              <button
                className={`master-save-btn ${isSavingSetting ? 'opacity-50' : ''}`}
                onClick={() => saveSetting('ticket_url_template', ticketUrlTemplate)}
                disabled={isSavingSetting}
              >
                {isSavingSetting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </section>

        {/* ═══════════ ステータス伝搬ルール設定 ═══════════ */}
        <section className="master-section">
          <div className="master-section-header">
            <h3 className="master-section-title">
              <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>⚙️</span>
              ステータス自動更新条件設定
            </h3>
          </div>
          <div className="master-setting-card">
            <p className="master-setting-desc mb-6">
              プロジェクトやタスクのステータスを、子アイテムの状態に合わせて自動更新する際の判定条件（カテゴリー）を指定します。
            </p>

            <div className="space-y-8">
              <div className="mapping-group">
                <label className="master-setting-label mb-3 block font-bold text-gray-700">「未着手」と判定するステータス</label>
                <div className="flex flex-wrap gap-2">
                  {data?.statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleMapping('new', s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingNew.includes(s.id) ? 'bg-gray-100 border-gray-400 text-gray-900 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      {s.status_name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">※ 子がすべてこれらのステータスなら、親も「未着手（New）」を維持します。</p>
              </div>

              <div className="mapping-group">
                <label className="master-setting-label mb-3 block font-bold text-red-600">「ブロック」と判定するステータス</label>
                <div className="flex flex-wrap gap-2">
                  {data?.statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleMapping('blocked', s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingBlocked.includes(s.id) ? 'bg-red-50 border-red-400 text-red-700 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      {s.status_name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">※ 子に1つでも含まれれば、親を強制的に「ブロック（Blocked）」にします。</p>
              </div>

              <div className="mapping-group">
                <label className="master-setting-label mb-3 block font-bold text-green-600">「完了」と判定するステータス</label>
                <div className="flex flex-wrap gap-2">
                  {data?.statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleMapping('done', s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingDone.includes(s.id) ? 'bg-green-50 border-green-400 text-green-700 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      {s.status_name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">※ 子がすべてこれらのステータスなら、親を「完了（Done）」にします。</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
