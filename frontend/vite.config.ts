import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数をロード
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // サブディレクトリ配下でのパスを環境変数から取得（デフォルトはルート '/'）
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
    ],
    // 開発サーバーでのAPI通信を一様に扱うためのプロキシ設定
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
