#!/usr/bin/env node
/**
 * Strict check for decoration texture references.
 *
 * Decoration cards and room placement use dynamic TextureCache.get(deco.icon),
 * so generic static asset checks cannot prove these keys exist. This script
 * validates every DecorationConfig icon/bgTexture against TextureCache and the
 * actual minigame asset file before release.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const decorationConfigPath = path.join(REPO, 'src/config/DecorationConfig.ts');
const textureCachePath = path.join(REPO, 'src/utils/TextureCache.ts');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

const decorationConfig = read(decorationConfigPath);
const textureCache = read(textureCachePath);

const textureEntries = [...textureCache.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)]
  .map((match) => [match[1], match[2]]);
const textureMap = new Map(textureEntries);

const iconRefs = unique([...decorationConfig.matchAll(/icon:\s*'([^']+)'/g)].map((match) => match[1]));
const bgTextureRefs = unique([...decorationConfig.matchAll(/bgTexture:\s*'([^']+)'/g)].map((match) => match[1]));
const refs = unique([...iconRefs, ...bgTextureRefs]);

const missingKeys = refs.filter((key) => !textureMap.has(key));
const missingFiles = refs
  .filter((key) => textureMap.has(key))
  .map((key) => [key, textureMap.get(key)])
  .filter(([, relPath]) => !fs.existsSync(path.join(REPO, 'minigame', relPath)));

console.log(`[deco-texture-check] decoration icon refs: ${iconRefs.length}`);
console.log(`[deco-texture-check] room style bg refs: ${bgTextureRefs.length}`);
console.log(`[deco-texture-check] TextureCache keys checked: ${refs.length}`);

if (missingKeys.length > 0) {
  console.error('\n[deco-texture-check] missing TextureCache keys:');
  for (const key of missingKeys) console.error(`  - ${key}`);
}

if (missingFiles.length > 0) {
  console.error('\n[deco-texture-check] missing files for TextureCache keys:');
  for (const [key, relPath] of missingFiles) console.error(`  - ${key} -> ${relPath}`);
}

if (missingKeys.length > 0 || missingFiles.length > 0) {
  process.exitCode = 1;
} else {
  console.log('[deco-texture-check] OK');
}
