import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { offlineShell } from './build/offline.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3200,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), offlineShell()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@shared': path.resolve(import.meta.dirname, '../shared'),
      }
    }
  };
});
