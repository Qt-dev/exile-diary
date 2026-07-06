import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
const electronTsconfigRaw = {
  compilerOptions: {
    allowJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'node',
    resolveJsonModule: true,
    target: 'esnext',
    useDefineForClassFields: true,
  },
};

const externalPackages = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
  'electron',
  ...Object.keys(packageJson.dependencies ?? {}),
];

export default defineConfig({
  main: {
    esbuild: {
      tsconfigRaw: electronTsconfigRaw,
    },
    build: {
      outDir: 'out/electron/main',
      commonjsOptions: {
        include: [/src/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: externalPackages,
        output: {
          entryFileNames: '[name].js',
          format: 'cjs',
        },
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts'),
          'ocr-sidecar': path.resolve(
            __dirname,
            'src/main/modules/ImageParser/OcrSidecarBootstrap.ts'
          ),
          'runtime-sidecar': path.resolve(
            __dirname,
            'src/main/runtime/RuntimeSidecarBootstrap.ts'
          ),
        },
      },
    },
    resolve: {
      alias: {
        '@main': path.resolve(__dirname, 'src/main'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
  },
  preload: {
    esbuild: {
      tsconfigRaw: electronTsconfigRaw,
    },
    build: {
      outDir: 'out/electron/preload',
      commonjsOptions: {
        include: [/src/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: externalPackages,
        output: {
          entryFileNames: '[name].js',
          format: 'cjs',
        },
        input: {
          index: path.resolve(__dirname, 'src/main/preload.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@main': path.resolve(__dirname, 'src/main'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
  },
  renderer: {
    root: '.',
    publicDir: 'public',
    base: './',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@helpers': path.resolve(__dirname, 'src/helpers'),
      },
    },
    server: {
      port: 3003,
      strictPort: true,
    },
  },
});
