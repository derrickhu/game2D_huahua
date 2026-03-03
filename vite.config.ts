import { defineConfig } from 'vite';
import path from 'path';

const isMinigameBuild = process.env.BUILD_TARGET === 'minigame';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: isMinigameBuild
    ? {
        // 微信小游戏构建配置
        outDir: 'minigame',
        assetsInlineLimit: 100000000, // 内联所有资源
        lib: {
          entry: path.resolve(__dirname, 'src/main.ts'),
          formats: ['iife'],
          name: 'HuahuaGame',
          fileName: () => 'game-bundle.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
        minify: false,
        emptyOutDir: false, // 不清空输出目录（保留 game.js/game.json/weapp-adapter.js）
      }
    : {
        // 浏览器构建配置
        outDir: 'dist',
        assetsInlineLimit: 0,
      },
});
