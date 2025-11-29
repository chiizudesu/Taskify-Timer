import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const rendererPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5183;

export default defineConfig({
  root: resolve(__dirname, 'renderer'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  server: {
    port: rendererPort,
    strictPort: true
  }
});

