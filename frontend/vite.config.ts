import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const normalizeBasePath = (value: string | undefined) => {
  if (!value) return '/';

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '/';

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLocalApiProxyPath = (appBasePath: string) => {
  return `${appBasePath}api`.replace(/\/$/, '');
};

const createApiProxy = (appBasePath: string): Record<string, ProxyOptions> => {
  const defaultProxy: ProxyOptions = {
    target: 'http://localhost:8000',
    changeOrigin: true,
    ws: true,
  };

  const proxy: Record<string, ProxyOptions> = {
    '/api': defaultProxy,
  };

  const localApiProxyPath = getLocalApiProxyPath(appBasePath);
  if (localApiProxyPath !== '/api') {
    proxy[localApiProxyPath] = {
      ...defaultProxy,
      rewrite: (path) => path.replace(new RegExp(`^${escapeRegExp(localApiProxyPath)}(?=/|$)`), '/api'),
    };
  }

  return proxy;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数をロード
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    // サブディレクトリ配下でのパスを環境変数から取得（デフォルトはルート '/'）
    base,
    plugins: [
      react(),
      tailwindcss(),
    ],
    // 開発サーバーでのAPI通信を一様に扱うためのプロキシ設定
    server: {
      proxy: createApiProxy(base),
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
