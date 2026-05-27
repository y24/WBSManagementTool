import { Dispatch, SetStateAction } from 'react';
import { LoadRateThresholdInputs } from '../../utils/loadRateThresholds';

interface SystemSettingsSectionProps {
  ticketUrlTemplate: string;
  setTicketUrlTemplate: (value: string) => void;
  loadRateThresholds: LoadRateThresholdInputs;
  setLoadRateThresholds: Dispatch<SetStateAction<LoadRateThresholdInputs>>;
  isSavingSetting: boolean;
  saveSetting: (key: string, value: string) => void;
  saveLoadRateThresholds: () => void;
}

export function SystemSettingsSection({
  ticketUrlTemplate,
  setTicketUrlTemplate,
  loadRateThresholds,
  setLoadRateThresholds,
  isSavingSetting,
  saveSetting,
  saveLoadRateThresholds,
}: SystemSettingsSectionProps) {
  const thresholdFields: {
    key: keyof LoadRateThresholdInputs;
    label: string;
    color: string;
  }[] = [
    { key: 'criticalLow', label: '低すぎ', color: '#e11d48' },
    { key: 'warningLow', label: '低め', color: '#f59e0b' },
    { key: 'normalHigh', label: '適正上限', color: '#059669' },
    { key: 'warningHigh', label: '高め', color: '#f59e0b' },
    { key: 'overload', label: '過負荷', color: '#e11d48' },
  ];

  const updateThreshold = (key: keyof LoadRateThresholdInputs, value: string) => {
    setLoadRateThresholds(prev => ({
      ...prev,
      [key]: value,
    }));
  };

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
        <div className="master-setting-info">
          <label className="master-setting-label">稼働率しきい値</label>
          <p className="master-setting-desc">
            リソースビューの予定稼働率・実績稼働率の色分けとサマリー判定に使用します。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          {thresholdFields.map(field => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 master-setting-desc font-semibold">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: field.color }}
                  aria-hidden="true"
                />
                {field.label}
              </span>
              <input
                type="number"
                min="0"
                className="master-input"
                value={loadRateThresholds[field.key]}
                onChange={e => updateThreshold(field.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="master-setting-action-full mt-4 justify-end">
          <button
            className={`master-save-btn ${isSavingSetting ? 'opacity-50' : ''}`}
            onClick={saveLoadRateThresholds}
            disabled={isSavingSetting}
          >
            {isSavingSetting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </section>
  );
}
