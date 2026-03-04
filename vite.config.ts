import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  publicDir: false,
  build: {
    outDir: 'minigame',
    assetsInlineLimit: 0,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'HuahuaGame',
      fileName: () => 'game-bundle.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'images/[name][extname]',
      },
    },
    minify: 'terser',
    emptyOutDir: false,
  },
});
