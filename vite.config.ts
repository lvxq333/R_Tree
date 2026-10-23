import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '.env') });
export default defineConfig({
  root: 'client', plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'client/src'), '@client': path.resolve(__dirname, 'client'), '@shared': path.resolve(__dirname, 'shared') } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.SERVER_PORT || 3000}` } },
  build: { outDir: '../dist/client', emptyOutDir: true }
});
