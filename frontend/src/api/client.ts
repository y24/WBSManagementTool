import axios from 'axios';

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
    return Promise.reject(error);
  }
);
// 初期データの取得リクエストを重複させないためのプロミス保存用
let initialDataPromise: Promise<any> | null = null;

export const getInitialData = () => {
  if (initialDataPromise) return initialDataPromise;
  
  initialDataPromise = apiClient.get('/initial-data')
    .finally(() => {
      // リクエストが完了（成功 or 失敗）したらプロミスをクリア
      // これにより、起動時の同時呼び出しは重複排除され、その後の明示的な更新では最新が取得可能になる
      initialDataPromise = null;
    });
    
  return initialDataPromise;
};
