import axios, { type AxiosResponse } from 'axios';
import type { AzureDevOpsUser, InitialData } from '../types';
import { markNetworkErrorToastShown, showToast } from '../utils/toast';

// APIクライアントのベース設定
export const apiClient = axios.create({
  // VITE_API_URL優先、なければ現在のドメインからの相対パス(/wbs/api など)
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.BASE_URL + 'api').replace(/\/+$/, '/').replace(/^\/+/, '/'),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error.message);
    if (axios.isAxiosError(error) && !error.response) {
      markNetworkErrorToastShown(error);
      showToast(
        {
          type: 'error',
          title: 'ネットワークエラー',
          message: 'サーバーに接続できません。通信状態またはAPIサーバーの起動状態を確認してください。',
        },
        { dedupeKey: 'api-network-error' },
      );
    }
    return Promise.reject(error);
  }
);
// 初期データの取得リクエストを重複させないためのプロミス保存用
let initialDataPromise: Promise<AxiosResponse<InitialData>> | null = null;
let initialDataCache: AxiosResponse<InitialData> | null = null;
let markersPromise: Promise<AxiosResponse<import('../types').Marker[]>> | null = null;

export const getMarkers = () => {
  if (markersPromise) return markersPromise;

  markersPromise = apiClient.get<import('../types').Marker[]>('/markers')
    .finally(() => {
      markersPromise = null;
    });

  return markersPromise;
};

export const getAzureDevOpsUsers = (query: string) => (
  apiClient.get<AzureDevOpsUser[]>('/integrations/azure-devops/users', { params: { query } })
);

export const getInitialData = (options: { forceRefresh?: boolean } = {}) => {
  if (!options.forceRefresh && initialDataCache) return Promise.resolve(initialDataCache);
  if (initialDataPromise) return initialDataPromise;
  
  initialDataPromise = apiClient.get('/initial-data')
    .then((response) => {
      initialDataCache = response;
      return response;
    })
    .finally(() => {
      // リクエストが完了（成功 or 失敗）したらプロミスをクリア
      // 成功レスポンスは initialDataCache に残し、明示的な forceRefresh のみ再取得する
      initialDataPromise = null;
    });
    
  return initialDataPromise;
};
