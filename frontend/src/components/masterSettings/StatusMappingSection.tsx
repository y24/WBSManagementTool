import type { MstStatus } from '../../types';

interface StatusMappingSectionProps {
  statuses: MstStatus[];
  statusMappingNew: number[];
  statusMappingBlocked: number[];
  statusMappingDone: number[];
  toggleMapping: (category: 'new' | 'blocked' | 'done', statusId: number) => void;
}

export function StatusMappingSection({
  statuses,
  statusMappingNew,
  statusMappingBlocked,
  statusMappingDone,
  toggleMapping,
}: StatusMappingSectionProps) {
  return (
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
            <label className="master-setting-label mb-3 block font-bold text-gray-700 dark:text-slate-300">「未着手」と判定するステータス</label>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleMapping('new', s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingNew.includes(s.id)
                    ? 'bg-gray-100 dark:bg-slate-700 border-gray-400 dark:border-slate-500 text-gray-900 dark:text-white font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600'}`}
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
              {statuses.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleMapping('blocked', s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingBlocked.includes(s.id)
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600'}`}
                >
                  {s.status_name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">※ 子に1つでも含まれれば、親を強制的に「ブロック（Blocked）」にします。</p>
          </div>

          <div className="mapping-group">
            <label className="master-setting-label mb-3 block font-bold text-green-600 dark:text-green-400">「完了」と判定するステータス</label>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleMapping('done', s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all border ${statusMappingDone.includes(s.id)
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600'}`}
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
  );
}
