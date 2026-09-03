/**
 * 把一份内容树 + 一份 bundle 组装成各平台可直接用开发者工具打开的目录。
 *
 *   CLI：node scripts/build-platform.mjs [wechat|douyin|all] [--full]
 *   仅 `vite build --watch` 会在插件里组装；一次性 `vite build` 不组装，
 *   留给本脚本在 vite 之后跑，避免先拷未完成的树。
 *
 * 增量镜像见 scripts/lib/mirror-tree.mjs。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFileIfStale,
  createMirrorStats,
  isRealDir,
  lstatOrNull,
  mirrorDir,
} from './lib/mirror-tree.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = path.join(rootDir, 'minigame');
export const PLATFORM_DIR = path.join(rootDir, 'platform');
export const BUILD_DIR = path.join(rootDir, 'build');
export const BUNDLE_DIR = path.join(rootDir, '.bundle');

export const PLATFORMS = ['wechat', 'douyin'];

const KEEP = new Set(['project.private.config.json']);
const SKIP_FROM_CONTENT = new Set([
  'game-bundle.js',
  'index.html',
  'game.json',
  'project.config.json',
  'project.private.config.json',
  '.cdn_stripped',
]);

const CONTENT_MARKERS = [
  'images',
  'pixi-adapter',
  'subpkg_items',
  'subpkg_events',
  'subpkg_chars',
  'subpkg_panels',
  'subpkg_deco',
  'subpkg_audio',
];

function fail(msg) {
  throw new Error(`[build-platform] ${msg}`);
}

function cleanStale(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (KEEP.has(entry) || entry.startsWith('.') || entry.endsWith('.zip')) continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function inheritAppid(outConfigPath, freshConfig) {
  let existing = {};
  if (fs.existsSync(outConfigPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outConfigPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  const inherited = !freshConfig.appid && existing.appid ? existing.appid : null;
  const config = {
    ...existing,
    ...freshConfig,
    setting: {
      ...(existing.setting || {}),
      ...(freshConfig.setting || {}),
    },
    appid: freshConfig.appid || existing.appid || '',
  };
  // 独立打开 build/wechat 时不能带根目录的 miniprogramRoot，否则会去找 build/wechat/build/wechat
  if (!Object.prototype.hasOwnProperty.call(freshConfig, 'miniprogramRoot')) {
    delete config.miniprogramRoot;
  }
  if (!Object.prototype.hasOwnProperty.call(freshConfig, 'cloudfunctionRoot')) {
    delete config.cloudfunctionRoot;
  }
  return { config, inherited };
}

function contentLooksCopied(out) {
  const markersOk = CONTENT_MARKERS.every((name) => {
    const src = path.join(CONTENT_DIR, name);
    if (!fs.existsSync(src)) return true;
    return isRealDir(path.join(out, name)) || fs.existsSync(path.join(out, name));
  });
  const leftoverLink = ['images', 'pixi-adapter', 'game.js', 'runtime.js', ...CONTENT_MARKERS]
    .some((name) => {
      const st = lstatOrNull(path.join(out, name));
      return Boolean(st && st.isSymbolicLink());
    });
  return markersOk && !leftoverLink;
}

function formatStats(stats) {
  return `+${stats.copied} ~${stats.skipped} -${stats.pruned}`
    + (stats.repaired ? ` !${stats.repaired}` : '');
}

const RELOAD_TICK_RE = /\n;\/\* huahua-reload \d+ \*\/\n$/;

/** 小游戏工具通常只因 js/json 变化自动编译；只换图时轻碰 game.js 让模拟器自己起来。 */
function pokeSimulator(out, stats) {
  if (stats.copied === 0 && stats.pruned === 0 && stats.repaired === 0) return;
  const gameJs = path.join(out, 'game.js');
  if (!fs.existsSync(gameJs)) return;
  const prev = fs.readFileSync(gameJs, 'utf8');
  const next = `${prev.replace(RELOAD_TICK_RE, '')}\n;/* huahua-reload ${Date.now()} */\n`;
  if (next !== prev) fs.writeFileSync(gameJs, next);
}

export function assemble(platform, { quiet = false, bundleDir, full = false } = {}) {
  if (!PLATFORMS.includes(platform)) fail(`未知平台 ${platform}`);
  const platformSrc = path.join(PLATFORM_DIR, platform);
  if (!fs.existsSync(platformSrc)) fail(`缺少平台配置目录 platform/${platform}`);

  const resolvedBundleDir = bundleDir || BUNDLE_DIR;
  const bundle = path.join(resolvedBundleDir, 'game-bundle.js');
  if (!fs.existsSync(bundle)) {
    fail(`找不到 ${path.relative(rootDir, bundle)}，请先跑对应 vite build`);
  }
  if (!fs.existsSync(CONTENT_DIR)) fail('缺少 minigame/ 内容树');

  const out = path.join(BUILD_DIR, platform);
  const outConfig = path.join(out, 'project.config.json');
  const configSrc = path.join(platformSrc, 'project.config.json');
  let inherited = null;
  let config = null;
  if (fs.existsSync(configSrc)) {
    const fresh = JSON.parse(fs.readFileSync(configSrc, 'utf8'));
    ({ config, inherited } = inheritAppid(outConfig, fresh));
  }

  const stats = createMirrorStats();
  fs.mkdirSync(out, { recursive: true });
  if (full || !contentLooksCopied(out)) {
    cleanStale(out);
  }
  mirrorDir(CONTENT_DIR, out, { skip: SKIP_FROM_CONTENT, stats });
  const leftoverBundle = path.join(CONTENT_DIR, 'game-bundle.js');
  if (fs.existsSync(leftoverBundle)) {
    fs.rmSync(leftoverBundle);
    if (!quiet) console.log('[build-platform] 已删除 minigame/game-bundle.js（旧产物，勿用这个目录扫码）');
  }
  copyFileIfStale(bundle, path.join(out, 'game-bundle.js'), stats);
  mirrorDir(platformSrc, out, {
    skip: new Set(['project.config.json']),
    prune: false,
    stats,
  });
  if (config) {
    const rendered = `${JSON.stringify(config, null, 2)}\n`;
    const prev = fs.existsSync(outConfig) ? fs.readFileSync(outConfig, 'utf8') : '';
    if (prev !== rendered) fs.writeFileSync(outConfig, rendered, 'utf8');
  }
  pokeSimulator(out, stats);

  if (!quiet) {
    const size = (fs.statSync(bundle).size / 1024).toFixed(0);
    const appidNote = config?.appid
      ? `appid ${config.appid}${inherited ? '（沿用工具里填的，建议同步回 platform/）' : ''}`
      : '无 project.config 或 appid 未填';
    console.log(
      `[build-platform] ${platform} → build/${platform}/ (bundle ${size}KB, ${formatStats(stats)}, ${appidNote})`,
    );
  }
  return stats;
}

export function assembleAll(target = 'all', opts) {
  const targets = target === 'all' ? PLATFORMS : [target];
  const all = createMirrorStats();
  for (const p of targets) {
    if (!PLATFORMS.includes(p)) fail(`未知平台 ${p}，可选：${PLATFORMS.join(' / ')} / all`);
    const one = assemble(p, opts);
    all.copied += one.copied;
    all.skipped += one.skipped;
    all.pruned += one.pruned;
    all.repaired += one.repaired;
  }
  return all;
}

function shouldIgnoreWatchName(filename) {
  if (!filename) return false;
  const base = String(filename).split(/[\\/]/).pop() || '';
  if (!base) return false;
  if (base.startsWith('.')) return true;
  return base === 'game-bundle.js'
    || base === 'index.html'
    || base === '.DS_Store'
    || base === '.cdn_stripped'
    || base.endsWith('.huahua-tmp');
}

/**
 * 只听 minigame/ 与 platform/，不听 build/。
 * 改图不会触发 Vite 重打 JS；由调用方排队跑增量 assemble。
 */
export function watchContentTrees(onChange, { debounceMs = 250 } = {}) {
  let timer = null;
  const kick = (_event, filename) => {
    if (shouldIgnoreWatchName(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };
  const watchers = [];
  const opts = { recursive: true };
  if (fs.existsSync(CONTENT_DIR)) watchers.push(fs.watch(CONTENT_DIR, opts, kick));
  if (fs.existsSync(PLATFORM_DIR)) watchers.push(fs.watch(PLATFORM_DIR, opts, kick));
  return () => {
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const full = args.includes('--full');
    const target = args.find((a) => a !== '--full') ?? process.env.HUAHUA_PLATFORM ?? 'all';
    assembleAll(target, { full });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
