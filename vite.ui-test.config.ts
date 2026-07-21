import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  publicDir: path.resolve(rootDir, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': path.resolve(rootDir, 'src/renderer'),
      '@shared': path.resolve(rootDir, 'src/shared'),
      '@helpers': path.resolve(rootDir, 'src/helpers'),
    },
  },
  optimizeDeps: {
    entries: [path.resolve(rootDir, 'test/ui/index.html')],
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    watch: {
      ignored: ['**/.tmp/**', '**/out/**'],
    },
  },
});
