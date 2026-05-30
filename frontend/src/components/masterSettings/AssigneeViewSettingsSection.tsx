import { Dispatch, SetStateAction } from 'react';
import { LoadRateThresholdInputs, ScheduleVarianceThresholdInputs } from '../../utils/loadRateThresholds';
import { sectionIconStyle } from './icons';

interface AssigneeViewSettingsSectionProps {
  loadRateThresholds: LoadRateThresholdInputs;
  setLoadRateThresholds: Dispatch<SetStateAction<LoadRateThresholdInputs>>;
  scheduleVarianceThresholds: ScheduleVarianceThresholdInputs;
  setScheduleVarianceThresholds: Dispatch<SetStateAction<ScheduleVarianceThresholdInputs>>;
  isSavingSetting: boolean;
  saveLoadRateThresholds: () => void;
  saveScheduleVarianceThresholds: () => void;
}

export function AssigneeViewSettingsSection({
  loadRateThresholds,
  setLoadRateThresholds,
  scheduleVarianceThresholds,
  setScheduleVarianceThresholds,
  isSavingSetting,
  saveLoadRateThresholds,
  saveScheduleVarianceThresholds,
}: AssigneeViewSettingsSectionProps) {
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

  const varianceThresholdFields: {
    key: keyof ScheduleVarianceThresholdInputs;
    label: string;
    color: string;
  }[] = [
    { key: 'normal', label: '正常', color: '#059669' },
    { key: 'warning', label: '注意', color: '#f59e0b' },
    { key: 'critical', label: '重大', color: '#e11d48' },
  ];

  const updateThreshold = (key: keyof LoadRateThresholdInputs, value: string) => {
    setLoadRateThresholds(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateVarianceThreshold = (key: keyof ScheduleVarianceThresholdInputs, value: string) => {
    setScheduleVarianceThresholds(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={sectionIconStyle('linear-gradient(135deg, #10b981, #059669)')}>A</span>
          担当者ビュー
        </h3>
      </div>

      <div className="master-setting-card">
        <div className="master-setting-info">
          <label className="master-setting-label">稼働率しきい値</label>
          <p className="master-setting-desc">
            担当者ビューの予定稼働率・実績稼働率の色分けとサマリー判定に使用します。
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

      <div className="master-setting-card mt-4">
        <div className="master-setting-info">
          <label className="master-setting-label">予実差しきい値</label>
          <p className="master-setting-desc">
            担当者ビューの予実差（pt）の色分けに使用します。0ptに近いほど計画通りです。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {varianceThresholdFields.map(field => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 master-setting-desc font-semibold">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: field.color }}
                  aria-hidden="true"
                />
                {field.label}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  className="master-input"
                  value={scheduleVarianceThresholds[field.key]}
                  onChange={e => updateVarianceThreshold(field.key, e.target.value)}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">pt</span>
              </div>
            </label>
          ))}
        </div>

        <div className="master-setting-action-full mt-4 justify-end">
          <button
            className={`master-save-btn ${isSavingSetting ? 'opacity-50' : ''}`}
            onClick={saveScheduleVarianceThresholds}
            disabled={isSavingSetting}
          >
            {isSavingSetting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </section>
  );
}
