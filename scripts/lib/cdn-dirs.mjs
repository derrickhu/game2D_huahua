/**
 * 读 CdnConfig.cdnDirs。微信靠 project.config.json 的 packOptions.ignore 不打进上传包；
 * Tap 的 zip 不认 packOptions，组装时要用同一份目录排除，否则主包会把 CDN 资源一起下。
 */
import fs from 'node:fs';
import path from 'node:path';

export function readCdnDirs(rootDir) {
  const file = path.join(rootDir, 'src', 'config', 'CdnConfig.ts');
  const text = fs.readFileSync(file, 'utf8');
  const block = text.match(/cdnDirs:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error(`[cdn-dirs] 无法解析 ${file} 的 cdnDirs`);
  const dirs = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (dirs.length === 0) throw new Error(`[cdn-dirs] ${file} 的 cdnDirs 为空`);
  return dirs;
}
