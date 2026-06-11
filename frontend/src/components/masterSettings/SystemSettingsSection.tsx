import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { MstStatus } from '../../types';

type DevOpsSyncField =
  | 'planned_start_date'
  | 'planned_end_date'
  | 'actual_start_date'
  | 'actual_end_date';

type DevOpsSyncStatusConditions = Record<DevOpsSyncField, number[]>;

interface SystemSettingsSectionProps {
  ticketUrlTemplate: string;
  setTicketUrlTemplate: (value: string) => void;
  statuses: MstStatus[];
  devOpsSyncStatusConditions: DevOpsSyncStatusConditions;
  saveDevOpsSyncStatusConditions: (conditions: DevOpsSyncStatusConditions) => void;
  isSavingSetting: boolean;
  saveSetting: (key: string, value: string) => void;
}

export function SystemSettingsSection({
  ticketUrlTemplate,
  setTicketUrlTemplate,
  statuses,
  devOpsSyncStatusConditions,
  saveDevOpsSyncStatusConditions,
  isSavingSetting,
  saveSetting,
}: SystemSettingsSectionProps) {
  const [isAddingSyncRule, setIsAddingSyncRule] = useState(false);
  const [selectedSyncField, setSelectedSyncField] = useState<DevOpsSyncField>('actual_end_date');
  const [selectedSyncStatusId, setSelectedSyncStatusId] = useState('');

  const syncFields: { key: DevOpsSyncField; label: string }[] = [
    { key: 'planned_start_date', label: '開始日(予定)' },
    { key: 'planned_end_date', label: '終了日(予定)' },
    { key: 'actual_start_date', label: '開始日(実績)' },
    { key: 'actual_end_date', label: '終了日(実績)' },
  ];

  const activeSyncRules = syncFields
    .map(field => ({
      field: field.key,
      label: field.label,
      statusIds: devOpsSyncStatusConditions[field.key] ?? [],
    }))
    .filter(rule => rule.statusIds.length > 0);

  const selectedStatusIdNumber = Number(selectedSyncStatusId);
  const canAddSyncRule =
    selectedSyncField &&
    selectedSyncStatusId !== '' &&
    Number.isInteger(selectedStatusIdNumber) &&
    !devOpsSyncStatusConditions[selectedSyncField]?.includes(selectedStatusIdNumber);

  const addSyncRuleStatus = () => {
    if (!canAddSyncRule) return;
    const current = devOpsSyncStatusConditions[selectedSyncField] ?? [];
    saveDevOpsSyncStatusConditions({
      ...devOpsSyncStatusConditions,
      [selectedSyncField]: [...current, selectedStatusIdNumber],
    });
  };

  const removeSyncRuleStatus = (field: DevOpsSyncField, statusId: number) => {
    saveDevOpsSyncStatusConditions({
      ...devOpsSyncStatusConditions,
      [field]: (devOpsSyncStatusConditions[field] ?? []).filter(id => id !== statusId),
    });
  };

  const clearSyncRule = (field: DevOpsSyncField) => {
    saveDevOpsSyncStatusConditions({
      ...devOpsSyncStatusConditions,
      [field]: [],
    });
  };

  const getStatus = (statusId: number) => statuses.find(status => status.id === statusId);

  return (
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
            チケットIDを置換するURLの形式を指定します。<code>{'{TICKET_ID}'}</code> が実際のIDに置き換わります。
          </p>
          <p className="master-setting-desc text-xs text-blue-500 mt-1">
            例: <code>https://dev.azure.com/Organization/Project/_workitems/edit/{'{TICKET_ID}'}</code>
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

      <div className="master-setting-card mt-4">
        <div className="master-setting-info flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <label className="master-setting-label">Azure DevOps 連携条件</label>
            <p className="master-setting-desc">
              特定のステータスのときのみ連携したい項目を設定します。ここで設定していない項目は常に連携されます。
            </p>
          </div>
          <button
            type="button"
            className="master-save-btn inline-flex items-center gap-1.5 px-3 py-2"
            onClick={() => setIsAddingSyncRule(prev => !prev)}
            disabled={isSavingSetting}
          >
            <Plus size={15} />
            条件
          </button>
        </div>

        {isAddingSyncRule && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="flex flex-col gap-1">
                <span className="master-setting-desc font-semibold">連携項目</span>
                <select
                  className="master-input"
                  value={selectedSyncField}
                  onChange={e => setSelectedSyncField(e.target.value as DevOpsSyncField)}
                >
                  {syncFields.map(field => (
                    <option key={field.key} value={field.key}>{field.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="master-setting-desc font-semibold">同期するステータス</span>
                <select
                  className="master-input"
                  value={selectedSyncStatusId}
                  onChange={e => setSelectedSyncStatusId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {statuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.status_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`master-save-btn w-full sm:w-auto ${!canAddSyncRule || isSavingSetting ? 'opacity-50' : ''}`}
                  onClick={addSyncRuleStatus}
                  disabled={!canAddSyncRule || isSavingSetting}
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {activeSyncRules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              条件付き連携はありません。
            </div>
          ) : (
            activeSyncRules.map(rule => (
              <div
                key={rule.field}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center"
              >
                <div className="min-w-32 text-sm font-semibold text-slate-700 dark:text-slate-100">
                  {rule.label}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {rule.statusIds.map(statusId => {
                    const status = getStatus(statusId);
                    return (
                      <span
                        key={statusId}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: status?.color_code ?? '#94a3b8' }}
                          aria-hidden="true"
                        />
                        {status?.status_name ?? `ID:${statusId}`}
                        <button
                          type="button"
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                          onClick={() => removeSyncRuleStatus(rule.field, statusId)}
                          disabled={isSavingSetting}
                          title={`${status?.status_name ?? statusId} を条件から外す`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:self-center"
                  onClick={() => clearSyncRule(rule.field)}
                  disabled={isSavingSetting}
                  title={`${rule.label} の連携条件を削除`}
                  aria-label={`${rule.label} の連携条件を削除`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </section>
  );
}
