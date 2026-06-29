/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/nurse': {
        target: 'https://mock-nurse-nightscout.example.com',
        changeOrigin: true,
        rewrite: (path) => {
          const cleanPath = path.replace(/^\/api\/nurse/, '');
          const separator = cleanPath.includes('?') ? '&' : '?';
          return `${cleanPath}${separator}token=mock-nurse-token`;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req, res) => {
            if (req.headers['x-nurse-access-code'] !== 'mock-access-code') {
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
})

