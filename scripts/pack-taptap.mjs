/**
 * 把 build/taptap/ 打成上传用 zip，产物就放在该目录里。
 * 打包时排除 *.zip，避免把旧包打进新包。
 * 每次打包把 tapVersion 补丁位 +1，后台版本号填 zip 名里的 V x.y.z；
 * 目录里只保留本次新包，老包一律删掉，避免上传时拿错。
 *
 * zip / .bundle-taptap / build 都不入库（见 .gitignore）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bumpPatch, persistTapVersion, readTapVersion } from './lib/tap-version.mjs';
import { readCdnDirs } from './lib/cdn-dirs.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tapDir = path.join(rootDir, 'build', 'taptap');
const pkgPath = path.join(rootDir, 'package.json');
const require = createRequire(import.meta.url);

function fail(msg) {
  throw new Error(`[pack-taptap] ${msg}`);
}

if (!fs.existsSync(path.join(tapDir, 'game.js')) || !fs.existsSync(path.join(tapDir, 'game.json'))) {
  fail('找不到 build/taptap/game.js，请先 npm run build:taptap');
}

// 准入机在主包下完之前不会跑 JS。微信用 packOptions.ignore 丢掉 CDN 目录，
// 这里再拦一次，避免组装漏剔除时又打出 90MB+ 的主包。先于版本号递增，失败不消耗版本。
const cdnDirs = readCdnDirs(rootDir);
const leaked = [];
for (const rel of cdnDirs) {
  const abs = path.join(tapDir, rel);
  if (!fs.existsSync(abs)) continue;
  const stack = [abs];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      if (name === 'game.js' || name === '.DS_Store' || name === 'Thumbs.db') continue;
      const full = path.join(cur, name);
      if (fs.statSync(full).isDirectory()) stack.push(full);
      else leaked.push(path.relative(tapDir, full));
    }
  }
}
if (leaked.length) {
  fail(`CDN 目录仍在 Tap 产物里（${leaked.length} 个文件，例如 ${leaked[0]}）。主包会再次大到准入加载超时`);
}

const gameJson = JSON.parse(fs.readFileSync(path.join(tapDir, 'game.json'), 'utf8'));
const subRoots = (gameJson.subPackages || gameJson.subpackages || [])
  .map((item) => String(item.root || '').replace(/^\.\/+/, '').replace(/\/+$/, ''))
  .filter(Boolean);

function walkBytes(dir) {
  let bytes = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.zip') || name === '.DS_Store') continue;
    const full = path.join(dir, name);
    const rel = path.relative(tapDir, full).split(path.sep).join('/');
    const st = fs.statSync(full);
    if (st.isDirectory()) bytes += walkBytes(full);
    else if (!subRoots.some((root) => rel === root || rel.startsWith(`${root}/`))) bytes += st.size;
  }
  return bytes;
}

const entryBytes = walkBytes(tapDir);
const entryMb = entryBytes / 1024 / 1024;
// 准入实验室大约 50KB/s，加载页只给约 30 秒。未压缩主包到 3MB 时，
// 压完仍会超过 1MB（1.0.2 把 images/ 留在主包，线上主包 2.4MB，小米停在 77%）。
if (entryMb > 3) {
  fail(`主包未压缩约 ${entryMb.toFixed(1)}MB，超过 3MB。images/ 必须在 subPackages 里，否则准入加载页下不完`);
}

const prev = readTapVersion(require(pkgPath));
const version = persistTapVersion(pkgPath, bumpPatch(prev));

const stale = fs.readdirSync(tapDir).filter((name) => /^taptap-V.+\.zip$/.test(name));
for (const name of stale) fs.rmSync(path.join(tapDir, name));

// 版本号打进包内，启动诊断弹窗第一屏就能自证装的是哪个包
fs.writeFileSync(
  path.join(tapDir, 'tap-pack-stamp.js'),
  `GameGlobal.__HUAHUA_TAP_VERSION='${version}';\n`,
);

const zipName = `taptap-V${version}.zip`;
const zipPath = path.join(tapDir, zipName);

const packed = spawnSync(
  'zip',
  ['-qr', zipName, '.', '-x', '*.zip', '-x', '*.DS_Store', '-x', '.*/', '-x', '*.huahua-tmp'],
  { cwd: tapDir, stdio: 'inherit' },
);
if (packed.status !== 0) fail(`zip 失败，exit ${packed.status}`);

const measured = spawnSync('python3', ['-c', `
import json, sys, zipfile
roots = json.loads(sys.argv[2])
total = 0
with zipfile.ZipFile(sys.argv[1]) as z:
    for info in z.infolist():
        name = info.filename
        if name.endswith('/'):
            continue
        if any(name == root or name.startswith(root + '/') for root in roots):
            continue
        total += info.compress_size
print(total)
`, zipPath, JSON.stringify(subRoots)], { encoding: 'utf8' });
if (measured.status !== 0) fail(`无法统计主包压缩体积: ${measured.stderr || measured.stdout}`);
const entryZipMb = Number(measured.stdout.trim()) / 1024 / 1024;
if (!Number.isFinite(entryZipMb)) fail(`主包压缩体积无效: ${measured.stdout}`);
if (entryZipMb > 1.1) {
  fs.rmSync(zipPath, { force: true });
  fail(`主包压缩后 ${entryZipMb.toFixed(2)}MB，超过 1.1MB。准入机大约 50KB/s，30 秒内下不完就会停在加载页`);
}

const kb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
const dropped = stale.length ? `，清掉老包 ${stale.length} 个` : '';
console.log(`[pack-taptap] ${path.relative(rootDir, zipPath)} (${kb}MB, 主包压缩 ${entryZipMb.toFixed(2)}MB)  ${prev} → ${version}${dropped}`);
