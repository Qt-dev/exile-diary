import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': path.resolve(rootDir, 'src/renderer'),
      '@shared': path.resolve(rootDir, 'src/shared'),
      '@helpers': path.resolve(rootDir, 'src/helpers'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/renderer/**/*.spec.tsx'],
    setupFiles: ['src/renderer/setupTests.ts'],
    css: false,
  },
});
