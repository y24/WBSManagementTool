import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, getAzureDevOpsUsers, getInitialData } from '../api/client';
import { wbsOps } from '../api/wbsOperations';
import { AzureDevOpsUser, InitialData } from '../types';
import { HolidaySection } from '../components/masterSettings/HolidaySection';
import { MemberSection } from '../components/masterSettings/MemberSection';
import { StatusMappingSection } from '../components/masterSettings/StatusMappingSection';
import { StatusSection } from '../components/masterSettings/StatusSection';
import { SubtaskTypeSection } from '../components/masterSettings/SubtaskTypeSection';
import { AssigneeViewSettingsSection } from '../components/masterSettings/AssigneeViewSettingsSection';
import { SystemSettingsSection } from '../components/masterSettings/SystemSettingsSection';
import { MaintenanceSection } from '../components/masterSettings/MaintenanceSection';
import { DropResult } from '@hello-pangea/dnd';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  defaultLoadRateThresholds,
  defaultScheduleVarianceThresholds,
  getLoadRateThresholds,
  getScheduleVarianceThresholds,
  isLoadRateThresholdsValid,
  isScheduleVarianceThresholdsValid,
  LoadRateThresholdInputs,
  parseLoadRateThresholdInputs,
  parseScheduleVarianceThresholdInputs,
  ScheduleVarianceThresholdInputs,
  toLoadRateThresholdInputs,
  toScheduleVarianceThresholdInputs,
} from '../utils/loadRateThresholds';
import { showErrorToast, showErrorToastUnlessNetworkError, showInfoToast } from '../utils/toast';

type EditingItem = { id: number; field: string } | null;
type MasterSectionId =
  | 'subtask-types'
  | 'members'
  | 'statuses'
  | 'status-mapping'
  | 'system-settings'
  | 'assignee-view'
  | 'holidays'
  | 'maintenance';

type DevOpsSyncField =
  | 'planned_start_date'
  | 'planned_end_date'
  | 'actual_start_date'
  | 'actual_end_date';

type DevOpsSyncStatusConditions = Record<DevOpsSyncField, number[]>;

interface NewStatus {
  status_name: string;
  color_code: string;
  azure_devops_state: string;
  azure_devops_sync_ticket_id: boolean;
  azure_devops_sync_testing_id: boolean;
}

interface NewSubtaskType {
  type_name: string;
  azure_devops_work_item_type: string;
}

interface NewMember {
  member_name: string;
  color_code: string;
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

const emptyDevOpsSyncStatusConditions = (): DevOpsSyncStatusConditions => ({
  planned_start_date: [],
  planned_end_date: [],
  actual_start_date: [],
  actual_end_date: [],
});

const parseDevOpsSyncStatusConditions = (value?: string | null): DevOpsSyncStatusConditions => {
  const conditions = emptyDevOpsSyncStatusConditions();
  if (!value) return conditions;

  try {
    const parsed = JSON.parse(value) as Partial<Record<DevOpsSyncField, unknown>>;
    (Object.keys(conditions) as DevOpsSyncField[]).forEach(field => {
      const fieldValue = parsed[field];
      if (Array.isArray(fieldValue)) {
        conditions[field] = fieldValue
          .map(statusId => Number(statusId))
          .filter(statusId => Number.isInteger(statusId));
      }
    });
  } catch {
    return conditions;
  }

  return conditions;
};

const masterSections: { id: MasterSectionId; label: string; description: string }[] = [
  { id: 'subtask-types', label: 'サブタスク種別', description: '工程種別の追加・並び順変更' },
  { id: 'members', label: '担当者', description: '担当者の追加・並び順変更' },
  { id: 'statuses', label: 'ステータス', description: '名称と表示色の設定' },
  { id: 'status-mapping', label: '自動更新条件', description: '親タスクのステータス判定設定' },
  { id: 'system-settings', label: 'システム設定', description: 'チケットURL / Azure DevOps連携条件' },
  { id: 'assignee-view', label: '担当者ビュー', description: '稼働率・予実差のしきい値' },
  { id: 'holidays', label: '祝日', description: '非稼働日の設定' },
  { id: 'maintenance', label: 'メンテナンス', description: '一括再計算など管理用操作' },
];

export default function MasterSettings() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const initialDataVersionRef = useRef<string | null>(null);
  const [data, setData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<MasterSectionId>('subtask-types');
  const [editing, setEditing] = useState<EditingItem>(null);
  const [editValue, setEditValue] = useState('');
  const [editColorValue, setEditColorValue] = useState('#000000');

  const [newStatus, setNewStatus] = useState<NewStatus>({
    status_name: '',
    color_code: '#3b82f6',
    azure_devops_state: '',
    azure_devops_sync_ticket_id: true,
    azure_devops_sync_testing_id: true,
  });
  const [newSubtaskType, setNewSubtaskType] = useState<NewSubtaskType>({ type_name: '', azure_devops_work_item_type: '' });
  const [newMember, setNewMember] = useState<NewMember>({ member_name: '', color_code: '#9ca3af' });
  const [newHoliday, setNewHoliday] = useState<NewHoliday>({ holiday_date: '', holiday_name: '' });

  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddSubtaskType, setShowAddSubtaskType] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  const [ticketUrlTemplate, setTicketUrlTemplate] = useState('');
  const [loadRateThresholds, setLoadRateThresholds] = useState<LoadRateThresholdInputs>(
    toLoadRateThresholdInputs(defaultLoadRateThresholds)
  );
  const [scheduleVarianceThresholds, setScheduleVarianceThresholds] = useState<ScheduleVarianceThresholdInputs>(
    toScheduleVarianceThresholdInputs(defaultScheduleVarianceThresholds)
  );
  const [devOpsSyncStatusConditions, setDevOpsSyncStatusConditions] = useState<DevOpsSyncStatusConditions>(
    emptyDevOpsSyncStatusConditions()
  );
  const [statusMappingNew, setStatusMappingNew] = useState<number[]>([]);
  const [statusMappingBlocked, setStatusMappingBlocked] = useState<number[]>([]);
  const [statusMappingDone, setStatusMappingDone] = useState<number[]>([]);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);
  const [isFetchingDevOpsUsers, setIsFetchingDevOpsUsers] = useState(false);
  const [devOpsUsers, setDevOpsUsers] = useState<AzureDevOpsUser[]>([]);
  const [isSubtaskTypeListExpanded, setIsSubtaskTypeListExpanded] = useState(false);
  const [isMemberListExpanded, setIsMemberListExpanded] = useState(false);
  const [isHolidayListExpanded, setIsHolidayListExpanded] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    getInitialData({ forceRefresh: true })
      .then(async res => {
        setData(res.data);
        setTicketUrlTemplate(res.data.ticket_url_template || '');
        setLoadRateThresholds(toLoadRateThresholdInputs(getLoadRateThresholds(res.data)));
        setScheduleVarianceThresholds(toScheduleVarianceThresholdInputs(getScheduleVarianceThresholds(res.data)));
        setDevOpsSyncStatusConditions(parseDevOpsSyncStatusConditions(res.data.azure_devops_sync_status_conditions));
        setStatusMappingNew(parseMapping(res.data.status_mapping_new));
        setStatusMappingBlocked(parseMapping(res.data.status_mapping_blocked));
        setStatusMappingDone(parseMapping(res.data.status_mapping_done));

        const versionRes = await wbsOps.getWBSVersion();
        initialDataVersionRef.current = versionRes.data.initial_data_version;
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const checkForMasterUpdates = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;

    try {
      const versionRes = await wbsOps.getWBSVersion();
      if (!initialDataVersionRef.current) {
        initialDataVersionRef.current = versionRes.data.initial_data_version;
        return;
      }

      if (versionRes.data.initial_data_version !== initialDataVersionRef.current) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to check master settings version', err);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const intervalId = window.setInterval(checkForMasterUpdates, 30000);
    window.addEventListener('focus', checkForMasterUpdates);
    document.addEventListener('visibilitychange', checkForMasterUpdates);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkForMasterUpdates);
      document.removeEventListener('visibilitychange', checkForMasterUpdates);
    };
  }, [checkForMasterUpdates]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const updateActiveSection = () => {
      const pageTop = page.getBoundingClientRect().top;
      const targetOffset = pageTop + 112;
      const currentSection = masterSections.reduce<MasterSectionId>((current, section) => {
        const element = document.getElementById(section.id);
        if (!element) return current;
        return element.getBoundingClientRect().top <= targetOffset ? section.id : current;
      }, masterSections[0].id);

      setActiveSectionId(currentSection);
    };

    updateActiveSection();
    page.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => page.removeEventListener('scroll', updateActiveSection);
  }, []);

  const scrollToSection = (sectionId: MasterSectionId) => {
    const page = pageRef.current;
    const element = document.getElementById(sectionId);
    if (!page || !element) return;

    page.scrollTo({
      top: element.offsetTop - 24,
      behavior: 'smooth',
    });
    setActiveSectionId(sectionId);
  };

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

  const reorderItems = async (endpoint: string, orderedIds: number[]) => {
    try {
      await apiClient.post(`${endpoint}/reorder`, { ordered_ids: orderedIds });
      fetchData();
    } catch (err) {
      console.error('Reorder failed', err);
    }
  };

  const onDragEnd = (result: DropResult, type: 'status' | 'subtask_type' | 'member') => {
    if (!result.destination || !data) return;
    if (result.destination.index === result.source.index) return;

    let items: any[] = [];
    let endpoint = '';
    if (type === 'status') {
      items = [...data.statuses];
      endpoint = '/masters/statuses';
    } else if (type === 'subtask_type') {
      items = [...data.subtask_types];
      endpoint = '/masters/subtask-types';
    } else if (type === 'member') {
      items = [...data.members];
      endpoint = '/masters/members';
    }

    const itemsCopy = Array.from(items);
    const [reorderedItem] = itemsCopy.splice(result.source.index, 1);
    itemsCopy.splice(result.destination.index, 0, reorderedItem);

    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      if (type === 'status') next.statuses = itemsCopy;
      else if (type === 'subtask_type') next.subtask_types = itemsCopy;
      else if (type === 'member') next.members = itemsCopy;
      return next;
    });

    reorderItems(endpoint, itemsCopy.map(i => i.id));
  };

  const createStatus = async () => {
    if (!newStatus.status_name.trim()) {
      return;
    }

    try {
      await apiClient.post('/masters/statuses', {
        status_name: newStatus.status_name.trim(),
        color_code: newStatus.color_code,
        azure_devops_state: newStatus.azure_devops_state.trim() || null,
        azure_devops_sync_ticket_id: newStatus.azure_devops_sync_ticket_id,
        azure_devops_sync_testing_id: newStatus.azure_devops_sync_testing_id,
        sort_order: data?.statuses.length ?? 0,
      });
      setNewStatus({
        status_name: '',
        color_code: '#3b82f6',
        azure_devops_state: '',
        azure_devops_sync_ticket_id: true,
        azure_devops_sync_testing_id: true,
      });
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
        azure_devops_work_item_type: newSubtaskType.azure_devops_work_item_type.trim() || null,
        sort_order: data?.subtask_types.length ?? 0,
      });
      setNewSubtaskType({ type_name: '', azure_devops_work_item_type: '' });
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
        color_code: newMember.color_code,
        sort_order: data?.members.length ?? 0,
      });
      setNewMember({ member_name: '', color_code: '#9ca3af' });
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
      showInfoToast('祝日の同期が完了しました。', res.data.message);
      fetchData();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, '祝日の同期に失敗しました。');
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const refreshDevOpsUsers = async () => {
    try {
      setIsFetchingDevOpsUsers(true);
      const res = await getAzureDevOpsUsers();
      setDevOpsUsers(res.data);
      showInfoToast('Azure DevOpsユーザーを取得しました。', `${res.data.length}件のユーザーを読み込みました。`);
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, 'Azure DevOpsユーザーの取得に失敗しました。');
    } finally {
      setIsFetchingDevOpsUsers(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      setIsSavingSetting(true);
      await apiClient.put(`/settings/${key}`, { setting_value: value });
      fetchData();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, '設定の保存に失敗しました。');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const saveLoadRateThresholds = async () => {
    const parsedThresholds = parseLoadRateThresholdInputs(loadRateThresholds);
    if (!parsedThresholds) {
      showErrorToast('稼働率しきい値は0以上の数値で入力してください。');
      return;
    }

    if (!isLoadRateThresholdsValid(parsedThresholds)) {
      showErrorToast('稼働率しきい値は 低すぎ < 低め < 適正上限 < 高め < 過負荷 の順で入力してください。');
      return;
    }

    try {
      setIsSavingSetting(true);
      await Promise.all([
        apiClient.put('/settings/load_rate_critical_low', { setting_value: String(parsedThresholds.criticalLow) }),
        apiClient.put('/settings/load_rate_warning_low', { setting_value: String(parsedThresholds.warningLow) }),
        apiClient.put('/settings/load_rate_normal_high', { setting_value: String(parsedThresholds.normalHigh) }),
        apiClient.put('/settings/load_rate_warning_high', { setting_value: String(parsedThresholds.warningHigh) }),
        apiClient.put('/settings/load_rate_overload', { setting_value: String(parsedThresholds.overload) }),
      ]);
      fetchData();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, '稼働率しきい値の保存に失敗しました。');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const saveScheduleVarianceThresholds = async () => {
    const parsedThresholds = parseScheduleVarianceThresholdInputs(scheduleVarianceThresholds);
    if (!parsedThresholds) {
      showErrorToast('予実差しきい値は1以上の数値で入力してください。');
      return;
    }

    if (!isScheduleVarianceThresholdsValid(parsedThresholds)) {
      showErrorToast('予実差の重大しきい値は1以上の数値で入力してください。');
      return;
    }

    try {
      setIsSavingSetting(true);
      await apiClient.put('/settings/schedule_variance_critical', { setting_value: String(parsedThresholds.critical) });
      fetchData();
    } catch (err) {
      console.error(err);
      showErrorToastUnlessNetworkError(err, '予実差しきい値の保存に失敗しました。');
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

  const saveDevOpsSyncStatusConditions = (nextConditions: DevOpsSyncStatusConditions) => {
    setDevOpsSyncStatusConditions(nextConditions);
    saveSetting('azure_devops_sync_status_conditions', JSON.stringify(nextConditions));
  };

  const isEditing = (id: number, field: string) => editing?.id === id && editing?.field === field;


  return (
    <div className="master-page" ref={pageRef}>
      <div className="master-layout">
        <aside className="master-nav" aria-label="マスタ・設定メニュー">
          <div className="master-nav-heading">設定メニュー</div>
          <nav className="master-nav-list">
            {masterSections.map(section => (
              <button
                key={section.id}
                type="button"
                className={`master-nav-item ${activeSectionId === section.id ? 'active' : ''}`}
                onClick={() => scrollToSection(section.id)}
              >
                <span className="master-nav-label">{section.label}</span>
                <span className="master-nav-description">{section.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="master-container">
          <h2 className="master-title">マスタ・設定</h2>

          <div id="subtask-types" className="master-scroll-section">
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
              onDragEnd={(res) => onDragEnd(res, 'subtask_type')}
              isSubtaskTypeListExpanded={isSubtaskTypeListExpanded}
              setIsSubtaskTypeListExpanded={setIsSubtaskTypeListExpanded}
            />
          </div>

          <div id="members" className="master-scroll-section">
            <MemberSection
              members={data?.members ?? []}
              devOpsUsers={devOpsUsers}
              isFetchingDevOpsUsers={isFetchingDevOpsUsers}
              refreshDevOpsUsers={refreshDevOpsUsers}
              showAddMember={showAddMember}
              setShowAddMember={setShowAddMember}
              newMember={newMember}
              setNewMember={setNewMember}
              createMember={createMember}
              isEditing={isEditing}
              editValue={editValue}
              setEditValue={setEditValue}
              editColorValue={editColorValue}
              setEditColorValue={setEditColorValue}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              startEdit={startEdit}
              deleteItem={deleteItem}
              onDragEnd={(res) => onDragEnd(res, 'member')}
              isMemberListExpanded={isMemberListExpanded}
              setIsMemberListExpanded={setIsMemberListExpanded}
            />
          </div>

          <div id="statuses" className="master-scroll-section">
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
              onDragEnd={(res) => onDragEnd(res, 'status')}
            />
          </div>

          <div id="status-mapping" className="master-scroll-section">
            <StatusMappingSection
              statuses={data?.statuses ?? []}
              statusMappingNew={statusMappingNew}
              statusMappingBlocked={statusMappingBlocked}
              statusMappingDone={statusMappingDone}
              toggleMapping={toggleMapping}
            />
          </div>

          <div id="system-settings" className="master-scroll-section">
            <SystemSettingsSection
              ticketUrlTemplate={ticketUrlTemplate}
              setTicketUrlTemplate={setTicketUrlTemplate}
              statuses={data?.statuses ?? []}
              devOpsSyncStatusConditions={devOpsSyncStatusConditions}
              saveDevOpsSyncStatusConditions={saveDevOpsSyncStatusConditions}
              isSavingSetting={isSavingSetting}
              saveSetting={saveSetting}
            />
          </div>

          <div id="assignee-view" className="master-scroll-section">
            <AssigneeViewSettingsSection
              loadRateThresholds={loadRateThresholds}
              setLoadRateThresholds={setLoadRateThresholds}
              scheduleVarianceThresholds={scheduleVarianceThresholds}
              setScheduleVarianceThresholds={setScheduleVarianceThresholds}
              isSavingSetting={isSavingSetting}
              saveLoadRateThresholds={saveLoadRateThresholds}
              saveScheduleVarianceThresholds={saveScheduleVarianceThresholds}
            />
          </div>

          <div id="holidays" className="master-scroll-section">
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
          </div>

          <div id="maintenance" className="master-scroll-section">
            <MaintenanceSection />
          </div>
        </div>
      </div>
      <LoadingOverlay isVisible={loading} />
    </div>
  );
}
