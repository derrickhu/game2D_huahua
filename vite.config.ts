import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

// 读取 package.json 拿到版本号，注入到客户端供经分 SDK 使用，避免 app_version 硬编码导致 dashboard 区分不出版本。
const requirePkg = createRequire(import.meta.url);
const pkg = requirePkg('./package.json') as { version: string };

const BUNDLE_DIR = '.bundle';

/**
 * Vite 插件：构建后替换 bundle 中所有 ShaderSystem 的 systemCheck 方法体，
 * 使其不再抛出 unsafe-eval 错误。
 * 原因：@pixi/unsafe-eval 的 selfInstall() 副作用代码被 tree-shaking 移除，
 * 且 @pixi/core 可能在 bundle 中出现多个副本，prototype patch 只能覆盖其中一个。
 */
function pixiUnsafeEvalPlugin(): Plugin {
  return {
    name: 'pixi-unsafe-eval-patch',
    writeBundle(options) {
      const outDir = options.dir || BUNDLE_DIR;
      const bundlePath = path.resolve(outDir, 'game-bundle.js');
      if (!fs.existsSync(bundlePath)) return;
      let code = fs.readFileSync(bundlePath, 'utf8');
      // 替换所有 systemCheck(){if(!xx())throw new Error("Current environment does not allow unsafe-eval...")}
      // 为 systemCheck(){}
      const re = /systemCheck\(\)\{if\(!\w+\(\)\)throw new Error\("Current environment does not allow unsafe-eval[^}]*\}/g;
      const patched = code.replace(re, 'systemCheck(){}');
      if (patched !== code) {
        fs.writeFileSync(bundlePath, patched, 'utf8');
        console.log('[pixi-unsafe-eval-patch] Patched systemCheck in bundle');
        code = patched;
      }
      // 微信上传代码质量检测用旧解析器，?? 运算符会报 invalid file / Unexpected token ?
      // 占位文案 "???" 可保留。
      const nullish = (code.match(/(?<!\?)\?\?(?!\?)/g) || []).length;
      if (nullish > 0) {
        throw new Error(
          `[wechat-js] game-bundle.js 仍含 ${nullish} 处 ?? 运算符，微信上传会失败。请确认 build.target 低于 es2020。`,
        );
      }
      const leftover = path.resolve(__dirname, 'minigame/game-bundle.js');
      if (fs.existsSync(leftover)) {
        fs.rmSync(leftover);
        console.log('[pixi-unsafe-eval-patch] 已删除 minigame/game-bundle.js（旧产物，扫码开错目录会中毒）');
      }
    },
  };
}

/**
 * 只在 `vite build --watch` 里组装。一次性 build 由 npm script 在 vite 之后跑 CLI。
 *
 * 改 TS：writeBundle → 增量 assemble。
 * 改 minigame/platform：目录监听 → 只 assemble，不重打 JS。
 */
function assemblePlatformsPlugin(): Plugin {
  let stopWatch: (() => void) | undefined;
  let queue: Promise<void> = Promise.resolve();

  const target = () => process.env.HUAHUA_PLATFORM ?? 'all';

  const enqueue = (reason: string) => {
    queue = queue
      .then(async () => {
        const { assembleAll } = await import('./scripts/build-platform.mjs');
        console.log(`[build-platform] watch assemble (${reason})`);
        assembleAll(target());
      })
      .catch((err: unknown) => {
        console.error('[build-platform]', err instanceof Error ? err.message : err);
      });
    return queue;
  };

  return {
    name: 'assemble-platforms',
    async buildStart() {
      if (!this.meta.watchMode || stopWatch) return;
      const { watchContentTrees } = await import('./scripts/build-platform.mjs');
      stopWatch = watchContentTrees(() => {
        void enqueue('assets');
      });
    },
    async writeBundle() {
      if (!this.meta.watchMode) return;
      await enqueue('bundle');
    },
    closeWatcher() {
      stopWatch?.();
      stopWatch = undefined;
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['@pixi/core', '@pixi/display', '@pixi/settings', '@pixi/constants', '@pixi/utils'],
  },
  publicDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [pixiUnsafeEvalPlugin(), assemblePlatformsPlugin()],
  build: {
    // 微信上传校验不认 ES2020 的 ?? / ?.（invalid file: Unexpected token ?）
    target: 'es2017',
    outDir: BUNDLE_DIR,
    assetsInlineLimit: 0,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'Huahua',
      fileName: () => 'game-bundle.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
    emptyOutDir: true,
  },
});
