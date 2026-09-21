/**
 * Tap 后台版本号（V x.y.z）和工程 package.json.version 分开：
 * 微信/抖音继续用现有 version，Tap 上传必须单调递增。
 */
import fs from 'node:fs';

export function bumpPatch(version) {
  const m = String(version ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`非法 Tap 版本号 ${version}，需要 x.y.z`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

export function readTapVersion(pkg) {
  return String(pkg.tapVersion || pkg.version || '').trim();
}

export function persistTapVersion(pkgPath, next) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.tapVersion = next;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return next;
}
