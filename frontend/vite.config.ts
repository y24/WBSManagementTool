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
    build: {
      rollupOptions: {
        output: {
          // 関数形式を使用してライブラリを分割（TypeScriptの型エラー回避）
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('axios') || id.includes('date-fns') || id.includes('lucide-react') || id.includes('@hello-pangea/dnd')) {
                return 'vendor-utils';
              }
            }
          },
        },
      },
    },
  }
})
