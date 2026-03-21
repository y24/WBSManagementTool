import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { MstStatus, MstSubtaskType, MstMember, InitialData } from '../types';

export default function MasterSettings() {
  const [data, setData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<InitialData>('/initial-data')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Loading masters...</div>;

  return (
    <div className="flex w-full h-full p-6">
      <div className="max-w-4xl mx-auto w-full space-y-8 bg-white rounded-lg shadow-sm border border-gray-100 p-8">
        <h2 className="text-2xl font-bold border-b pb-2">マスタ管理 (設定プレビュー)</h2>
        
        <section>
          <h3 className="text-lg font-semibold mb-4 bg-gray-50 px-3 py-2 rounded">ステータス一覧</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm text-gray-700">
            {data?.statuses.map(s => (
              <li key={s.id} className="flex items-center gap-3 p-2 border rounded shadow-sm bg-white">
                <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: s.color_code }}></span>
                <span className="font-medium">{s.status_name}</span>
              </li>
            ))}
          </ul>
        </section>
        
        <section>
          <h3 className="text-lg font-semibold mb-4 bg-gray-50 px-3 py-2 rounded">サブタスク種別一覧</h3>
          <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
            {data?.subtask_types.map(t => (
              <li key={t.id} className="px-3 py-1.5 border rounded-full bg-blue-50 text-blue-800 font-medium">
                {t.type_name}
              </li>
            ))}
          </ul>
        </section>
        
        <section>
          <h3 className="text-lg font-semibold mb-4 bg-gray-50 px-3 py-2 rounded">担当者一覧</h3>
          <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
            {data?.members.map(m => (
              <li key={m.id} className="px-3 py-1.5 border rounded-full bg-emerald-50 text-emerald-800 font-medium">
                {m.member_name}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-4 bg-gray-50 px-3 py-2 rounded">祝日一覧</h3>
          <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
            {data?.holidays.map(h => (
              <li key={h.id} className="px-3 py-1.5 border rounded-lg bg-orange-50 text-orange-800 font-medium">
                {h.holiday_date}: {h.holiday_name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
