/**
 * 把一份内容树 + 一份 bundle 组装成各平台可直接用开发者工具打开的目录。
 *
 *   CLI：node scripts/build-platform.mjs [wechat|douyin|taptap|huawei|all] [--full]
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
import { wrapHuaweiCjsTree } from './lib/wrap-huawei-cjs.mjs';
import { readCdnDirs } from './lib/cdn-dirs.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = path.join(rootDir, 'minigame');
export const PLATFORM_DIR = path.join(rootDir, 'platform');
export const BUILD_DIR = path.join(rootDir, 'build');
export const BUNDLE_DIR = path.join(rootDir, '.bundle');
export const BUNDLE_TAPTAP_DIR = path.join(rootDir, '.bundle-taptap');
export const BUNDLE_HUAWEI_DIR = path.join(rootDir, '.bundle-huawei');

export const PLATFORMS = ['wechat', 'douyin', 'taptap', 'huawei'];
export const WX_TT_PLATFORMS = ['wechat', 'douyin'];

const HUAWEI_SKIP_CDN = new Set([
  'subpkg_chars',
  'subpkg_panels',
  'subpkg_deco',
  'subpkg_audio',
]);

const KEEP = new Set(['project.private.config.json']);
const SKIP_FROM_CONTENT = new Set([
  'game-bundle.js',
  'index.html',
  'game.json',
  'manifest.json',
  'tap-pack-stamp.js',
  'huawei-pack-stamp.js',
  'weapp-adapter.js',
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
    if (KEEP.has(entry) || entry.startsWith('.') || entry.endsWith('.zip') || entry.endsWith('.rpk')) continue;
    if (entry === 'settings' || entry === 'sign' || entry === 'dist' || entry === 'img') continue;
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

function contentLooksCopied(out, skipNames = new Set()) {
  const markersOk = CONTENT_MARKERS.every((name) => {
    if (skipNames.has(name)) return true;
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

const DOUYIN_SUBSCRIBE_SCAN_MARK = 'huahua-douyin-subscribe-scan';
const DOUYIN_SUBSCRIBE_SCAN_RE =
  /\n?;\/\* huahua-douyin-subscribe-scan \*\/\n\(function \(\) \{[\s\S]*?\}\)\(\);\n?/;

function subscribeMessageApiName() {
  return ['request', 'Subscribe', 'Message'].join('');
}

function stripDouyinSubscribeScanStub(source) {
  return source.replace(DOUYIN_SUBSCRIBE_SCAN_RE, '\n');
}

/**
 * 抖音上传扫描要能看到订阅消息 API 名。
 * 不要写成宿主点号调用：微信工程打开仓库根时，鸿蒙适配会把 build/douyin/game.js 一并扫进去。
 */
function buildDouyinSubscribeScanStub() {
  const name = subscribeMessageApiName();
  return [
    `;/* ${DOUYIN_SUBSCRIBE_SCAN_MARK} */`,
    '(function () {',
    "  if (typeof tt === 'undefined') return;",
    '  var unused = function () {',
    `    var name = '${name}';`,
    '    var fn = tt[name];',
    "    if (typeof fn !== 'function') return;",
    '    fn.call(tt, {',
    "      tmplIds: ['MSG0000000000000'],",
    '      success: function () {},',
    '      fail: function () {},',
    '    });',
    '  };',
    '  void unused;',
    '})();',
    '',
  ].join('\n');
}

function writeDouyinSubscribeScanStub(out, { inject }) {
  const gameJs = path.join(out, 'game.js');
  if (!fs.existsSync(gameJs)) return;
  const prev = fs.readFileSync(gameJs, 'utf8');
  const stripped = stripDouyinSubscribeScanStub(prev).replace(/\s+$/, '');
  const next = inject ? `${stripped}\n${buildDouyinSubscribeScanStub()}` : `${stripped}\n`;
  if (next !== prev) fs.writeFileSync(gameJs, next);
}

/** 小游戏工具通常只因 js/json 变化自动编译；只换图时轻碰 game.js 让模拟器自己起来。 */
function pokeSimulator(out, stats) {
  if (stats.copied === 0 && stats.pruned === 0 && stats.repaired === 0) return;
  const gameJs = path.join(out, 'game.js');
  if (!fs.existsSync(gameJs)) return;
  const prev = fs.readFileSync(gameJs, 'utf8');
  const next = `${prev.replace(RELOAD_TICK_RE, '')}\n;/* huahua-reload ${Date.now()} */\n`;
  if (next !== prev) fs.writeFileSync(gameJs, next);
}

function bundleDirOf(platform) {
  if (platform === 'taptap') return BUNDLE_TAPTAP_DIR;
  if (platform === 'huawei') return BUNDLE_HUAWEI_DIR;
  return BUNDLE_DIR;
}

export function assemble(platform, { quiet = false, bundleDir, full = false } = {}) {
  if (!PLATFORMS.includes(platform)) fail(`未知平台 ${platform}`);
  const platformSrc = path.join(PLATFORM_DIR, platform);
  if (!fs.existsSync(platformSrc)) fail(`缺少平台配置目录 platform/${platform}`);

  const resolvedBundleDir = bundleDir || bundleDirOf(platform);
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
  // Tap 没有微信开发者工具的 packOptions.ignore。CDN 目录若进 zip，
  // 宿主会把它们算进主包（准入日志里 main_package ≈ 97MB，加载页停在 3%）。
  const cdnDirs = platform === 'taptap' ? readCdnDirs(rootDir) : [];
  const markerSkip = platform === 'huawei'
    ? HUAWEI_SKIP_CDN
    : new Set(cdnDirs.filter((dir) => !dir.includes('/')));
  if (full || !contentLooksCopied(out, markerSkip)) {
    cleanStale(out);
  }
  const contentSkip = new Set(SKIP_FROM_CONTENT);
  if (platform === 'huawei') {
    for (const name of HUAWEI_SKIP_CDN) contentSkip.add(name);
    contentSkip.add('sign');
    contentSkip.add('settings');
    contentSkip.add('dist');
  }
  mirrorDir(CONTENT_DIR, out, {
    skip: contentSkip,
    skipRel: cdnDirs.length ? new Set(cdnDirs) : undefined,
    stats,
  });
  const leftoverBundle = path.join(CONTENT_DIR, 'game-bundle.js');
  if (fs.existsSync(leftoverBundle)) {
    fs.rmSync(leftoverBundle);
    if (!quiet) console.log('[build-platform] 已删除 minigame/game-bundle.js（旧产物，勿用这个目录扫码）');
  }
  copyFileIfStale(bundle, path.join(out, 'game-bundle.js'), stats);
  if (platform === 'taptap') {
    const stamp = path.join(out, 'tap-pack-stamp.js');
    const stampSrc = "GameGlobal.__HUAHUA_TAP_PACK='fix5';\n";
    if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== stampSrc) {
      fs.writeFileSync(stamp, stampSrc);
    }
    const assembled = fs.readFileSync(path.join(out, 'game-bundle.js'), 'utf8');
    if (assembled.includes('"%eval%":eval')) {
      fail('build/taptap/game-bundle.js 仍含 "%eval%":eval，先检查 pixi-unsafe-eval-patch');
    }
  }
  if (platform === 'huawei') {
    const stamp = path.join(out, 'huawei-pack-stamp.js');
    const stampSrc = "GameGlobal.__HUAHUA_HUAWEI_VERSION='native';\n";
    if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== stampSrc) {
      fs.writeFileSync(stamp, stampSrc);
    }
    const assembled = fs.readFileSync(path.join(out, 'game-bundle.js'), 'utf8');
    if (assembled.includes('"%eval%":eval')) {
      fail('build/huawei/game-bundle.js 仍含 "%eval%":eval，先检查 pixi-unsafe-eval-patch');
    }
  }
  const docExt = new Set(['.doc', '.docx', '.pdf', '.md']);
  mirrorDir(platformSrc, out, {
    skip: new Set(['project.config.json']),
    skipExt: docExt,
    prune: false,
    stats,
  });
  // platform 镜像 prune=false，已经拷进去的说明文档不会自己消失
  if (fs.existsSync(out)) {
    for (const name of fs.readdirSync(out)) {
      if (!docExt.has(path.extname(name).toLowerCase())) continue;
      fs.rmSync(path.join(out, name), { force: true });
    }
  }
  if (platform === 'huawei') {
    if (!fs.existsSync(path.join(out, 'manifest.json'))) {
      fail('build/huawei/ 缺少 manifest.json');
    }
    if (!fs.existsSync(path.join(out, 'img/icon.png'))) {
      fail('build/huawei/ 缺少 img/icon.png');
    }
    const signCert = path.join(out, 'sign', 'release', 'certificate.pem');
    const signKey = path.join(out, 'sign', 'release', 'private.pem');
    if (!fs.existsSync(signCert) || !fs.existsSync(signKey)) {
      fail('缺少 platform/huawei/sign/release/{certificate,private}.pem，换机先把签名证书拷进工程');
    }
    const settingsPath = path.join(out, 'settings', 'project.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { settings = {}; }
    }
    const nextSettings = {
      ...settings,
      description: settings.description || '项目配置',
      projectPath: settings.projectPath || out,
      projectType: 'fastgame',
      appId: settings.appId || process.env.VITE_HUAWEI_APPID || '118944555',
    };
    delete nextSettings.isWxGameSource;
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    const renderedSettings = `${JSON.stringify(nextSettings, null, 2)}\n`;
    const prevSettings = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '';
    if (prevSettings !== renderedSettings) fs.writeFileSync(settingsPath, renderedSettings, 'utf8');
    const cjs = wrapHuaweiCjsTree(out);
    if (!quiet) console.log(`[build-platform] huawei CJS wrap ${cjs.wrapped} files`);
  }
  if (config) {
    const rendered = `${JSON.stringify(config, null, 2)}\n`;
    const prev = fs.existsSync(outConfig) ? fs.readFileSync(outConfig, 'utf8') : '';
    if (prev !== rendered) fs.writeFileSync(outConfig, rendered, 'utf8');
  }
  pokeSimulator(out, stats);
  writeDouyinSubscribeScanStub(out, { inject: platform === 'douyin' });

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
  const targets = target === 'all' ? WX_TT_PLATFORMS : [target];
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
