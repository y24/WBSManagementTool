interface SystemSettingsSectionProps {
  ticketUrlTemplate: string;
  setTicketUrlTemplate: (value: string) => void;
  isSavingSetting: boolean;
  saveSetting: (key: string, value: string) => void;
}

export function SystemSettingsSection({
  ticketUrlTemplate,
  setTicketUrlTemplate,
  isSavingSetting,
  saveSetting,
}: SystemSettingsSectionProps) {
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
    </section>
  );
}
