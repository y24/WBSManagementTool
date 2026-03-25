import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { InitialData } from '../types';
import { HolidaySection } from '../components/masterSettings/HolidaySection';
import { MemberSection } from '../components/masterSettings/MemberSection';
import { StatusMappingSection } from '../components/masterSettings/StatusMappingSection';
import { StatusSection } from '../components/masterSettings/StatusSection';
import { SubtaskTypeSection } from '../components/masterSettings/SubtaskTypeSection';
import { SystemSettingsSection } from '../components/masterSettings/SystemSettingsSection';
import { useWebSocket } from '../api/websocket';

type EditingItem = { id: number; field: string } | null;

interface NewStatus {
  status_name: string;
  color_code: string;
}

interface NewSubtaskType {
  type_name: string;
}

interface NewMember {
  member_name: string;
}

interface NewHoliday {
  holiday_date: string;
  holiday_name: string;
}

const parseMapping = (value?: string | null) =>
  (value || '')
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => !Number.isNaN(n));

export default function MasterSettings() {
  const [data, setData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingItem>(null);
  const [editValue, setEditValue] = useState('');
  const [editColorValue, setEditColorValue] = useState('#000000');

  const [newStatus, setNewStatus] = useState<NewStatus>({ status_name: '', color_code: '#3b82f6' });
  const [newSubtaskType, setNewSubtaskType] = useState<NewSubtaskType>({ type_name: '' });
  const [newMember, setNewMember] = useState<NewMember>({ member_name: '' });
  const [newHoliday, setNewHoliday] = useState<NewHoliday>({ holiday_date: '', holiday_name: '' });

  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddSubtaskType, setShowAddSubtaskType] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  const [ticketUrlTemplate, setTicketUrlTemplate] = useState('');
  const [statusMappingNew, setStatusMappingNew] = useState<number[]>([]);
  const [statusMappingBlocked, setStatusMappingBlocked] = useState<number[]>([]);
  const [statusMappingDone, setStatusMappingDone] = useState<number[]>([]);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [isHolidayListExpanded, setIsHolidayListExpanded] = useState(false);

  // Real-time synchronization
  useWebSocket((msg) => {
    if (msg.type === 'update') {
      console.log('MasterSettings received update signal, refreshing...');
      fetchData();
    }
  });

  const fetchData = useCallback(() => {
    apiClient.get<InitialData>('/initial-data')
      .then(res => {
        setData(res.data);
        setTicketUrlTemplate(res.data.ticket_url_template || '');
        setStatusMappingNew(parseMapping(res.data.status_mapping_new));
        setStatusMappingBlocked(parseMapping(res.data.status_mapping_blocked));
        setStatusMappingDone(parseMapping(res.data.status_mapping_done));
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEdit = (id: number, field: string, currentValue: string, colorValue?: string) => {
    setEditing({ id, field });
    setEditValue(currentValue);
    if (colorValue) {
      setEditColorValue(colorValue);
    }
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

  const deleteItem = async (endpoint: string, id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) {
      return;
    }

    try {
      await apiClient.delete(`${endpoint}/${id}`);
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const createStatus = async () => {
    if (!newStatus.status_name.trim()) {
      return;
    }

    try {
      await apiClient.post('/masters/statuses', {
        status_name: newStatus.status_name.trim(),
        color_code: newStatus.color_code,
        sort_order: data?.statuses.length ?? 0,
      });
      setNewStatus({ status_name: '', color_code: '#3b82f6' });
      setShowAddStatus(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const createSubtaskType = async () => {
    if (!newSubtaskType.type_name.trim()) {
      return;
    }

    try {
      await apiClient.post('/masters/subtask-types', {
        type_name: newSubtaskType.type_name.trim(),
        sort_order: data?.subtask_types.length ?? 0,
      });
      setNewSubtaskType({ type_name: '' });
      setShowAddSubtaskType(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const createMember = async () => {
    if (!newMember.member_name.trim()) {
      return;
    }

    try {
      await apiClient.post('/masters/members', {
        member_name: newMember.member_name.trim(),
        sort_order: data?.members.length ?? 0,
      });
      setNewMember({ member_name: '' });
      setShowAddMember(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const createHoliday = async () => {
    if (!newHoliday.holiday_date || !newHoliday.holiday_name.trim()) {
      return;
    }

    try {
      await apiClient.post('/masters/holidays', {
        holiday_date: newHoliday.holiday_date,
        holiday_name: newHoliday.holiday_name.trim(),
      });
      setNewHoliday({ holiday_date: '', holiday_name: '' });
      setShowAddHoliday(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const syncHolidays = async () => {
    if (!confirm('日本の祝日を内閣府APIから取得して更新しますか？\n(既に存在する祝日は上書きされ、新しい祝日は追加されます)')) {
      return;
    }

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

    if (category === 'new') {
      current = statusMappingNew;
      key = 'status_mapping_new';
    }

    if (category === 'blocked') {
      current = statusMappingBlocked;
      key = 'status_mapping_blocked';
    }

    if (category === 'done') {
      current = statusMappingDone;
      key = 'status_mapping_done';
    }

    const next = current.includes(statusId)
      ? current.filter(id => id !== statusId)
      : [...current, statusId];

    saveSetting(key, next.join(','));
  };

  const isEditing = (id: number, field: string) => editing?.id === id && editing?.field === field;

  if (loading) {
    return <div className="master-loading">マスタデータを読み込み中...</div>;
  }

  return (
    <div className="master-page">
      <div className="master-container">
        <h2 className="master-title">マスタ・設定</h2>

        <SubtaskTypeSection
          subtaskTypes={data?.subtask_types ?? []}
          showAddSubtaskType={showAddSubtaskType}
          setShowAddSubtaskType={setShowAddSubtaskType}
          newSubtaskType={newSubtaskType}
          setNewSubtaskType={setNewSubtaskType}
          createSubtaskType={createSubtaskType}
          isEditing={isEditing}
          editValue={editValue}
          setEditValue={setEditValue}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          startEdit={startEdit}
          deleteItem={deleteItem}
        />

        <MemberSection
          members={data?.members ?? []}
          showAddMember={showAddMember}
          setShowAddMember={setShowAddMember}
          newMember={newMember}
          setNewMember={setNewMember}
          createMember={createMember}
          isEditing={isEditing}
          editValue={editValue}
          setEditValue={setEditValue}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          startEdit={startEdit}
          deleteItem={deleteItem}
        />

        <HolidaySection
          holidays={data?.holidays ?? []}
          showAddHoliday={showAddHoliday}
          setShowAddHoliday={setShowAddHoliday}
          newHoliday={newHoliday}
          setNewHoliday={setNewHoliday}
          createHoliday={createHoliday}
          isSyncingHolidays={isSyncingHolidays}
          syncHolidays={syncHolidays}
          isHolidayListExpanded={isHolidayListExpanded}
          setIsHolidayListExpanded={setIsHolidayListExpanded}
          isEditing={isEditing}
          editValue={editValue}
          setEditValue={setEditValue}
          editColorValue={editColorValue}
          setEditColorValue={setEditColorValue}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          startEdit={startEdit}
          deleteItem={deleteItem}
        />

        <StatusSection
          statuses={data?.statuses ?? []}
          showAddStatus={showAddStatus}
          setShowAddStatus={setShowAddStatus}
          newStatus={newStatus}
          setNewStatus={setNewStatus}
          createStatus={createStatus}
          isEditing={isEditing}
          editValue={editValue}
          setEditValue={setEditValue}
          editColorValue={editColorValue}
          setEditColorValue={setEditColorValue}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          startEdit={startEdit}
          deleteItem={deleteItem}
        />

        <StatusMappingSection
          statuses={data?.statuses ?? []}
          statusMappingNew={statusMappingNew}
          statusMappingBlocked={statusMappingBlocked}
          statusMappingDone={statusMappingDone}
          toggleMapping={toggleMapping}
        />

        <SystemSettingsSection
          ticketUrlTemplate={ticketUrlTemplate}
          setTicketUrlTemplate={setTicketUrlTemplate}
          isSavingSetting={isSavingSetting}
          saveSetting={saveSetting}
        />
      </div>
    </div>
  );
}
