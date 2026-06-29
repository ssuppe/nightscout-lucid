/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api/nurse': {
          target: env.NURSE_NIGHTSCOUT_URL || 'https://placeholder-url.com',
          changeOrigin: true,
          rewrite: (path) => {
            const cleanPath = path.replace(/^\/api\/nurse/, '');
            const separator = cleanPath.includes('?') ? '&' : '?';
            const token = env.NURSE_NIGHTSCOUT_TOKEN || 'placeholder-token';
            return `${cleanPath}${separator}token=${token}`;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (_proxyReq, req, res) => {
              const accessCode = env.NURSE_ACCESS_CODE || 'placeholder-code';
              if (req.headers['x-nurse-access-code'] !== accessCode) {
                res.writeHead(401, { 'Content-Type': 'text/plain' });
                res.end('Unauthorized');
                return;
              }
            });
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
    },
  };
})

