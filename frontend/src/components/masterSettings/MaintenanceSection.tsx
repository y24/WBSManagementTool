import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { showToast, showErrorToastUnlessNetworkError } from '../../utils/toast';

export function MaintenanceSection() {
  const [isRecalculating, setIsRecalculating] = useState(false);

  const recalcAllEffort = async () => {
    setIsRecalculating(true);
    try {
      const res = await apiClient.post<{ updated: number; total: number }>('/admin/recalc-effort');
      showToast({
        type: 'success',
        title: '工数を一括再計算しました',
        message: `${res.data.total}件中 ${res.data.updated}件を更新`,
      });
    } catch (err) {
      showErrorToastUnlessNetworkError(err, '工数の再計算に失敗しました');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>🔧</span>
          メンテナンス
        </h3>
      </div>

      <div className="master-setting-card">
        <div className="master-setting-info">
          <label className="master-setting-label">工数の一括再計算</label>
          <p className="master-setting-desc">
            自動計算が有効なサブタスクの工数を全件再計算します。工数計算ロジックを変更した後など、既存データに一括で再適用したい場合に使用します。
          </p>
        </div>
        <div className="master-setting-action mt-4">
          <button
            type="button"
            onClick={recalcAllEffort}
            disabled={isRecalculating}
            className={`master-save-btn inline-flex items-center gap-2 ${isRecalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={15} className={isRecalculating ? 'animate-spin' : ''} />
            {isRecalculating ? '再計算中...' : '工数を一括再計算'}
          </button>
        </div>
      </div>
    </section>
  );
}
