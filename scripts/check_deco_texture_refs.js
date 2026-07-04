#!/usr/bin/env node
/**
 * Strict check for decoration texture references.
 *
 * Decoration cards and room placement use dynamic TextureCache.get(deco.icon),
 * so generic static asset checks cannot prove these keys exist. This script
 * validates every DecorationConfig icon/bgTexture against TextureCache and the
 * actual minigame asset file before release.
 *
 * Furniture atlas: when FurnitureRenderConfig maps decoId → atlas.sheetKey,
 * the on-disk PNG is the sheet; icon key may remain the deco id for UI alias.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const decorationConfigPath = path.join(REPO, 'src/config/DecorationConfig.ts');
const textureCachePath = path.join(REPO, 'src/utils/TextureCache.ts');
const furnitureRenderConfigPath = path.join(REPO, 'src/config/FurnitureRenderConfig.ts');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

const decorationConfig = read(decorationConfigPath);
const textureCache = read(textureCachePath);
const furnitureRenderConfig = read(furnitureRenderConfigPath);

const textureEntries = [...textureCache.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)]
  .map((match) => [match[1], match[2]]);
const textureMap = new Map(textureEntries);

/** decoId → atlas sheetKey (on-disk PNG) */
const decoAtlasSheetKey = new Map();
for (const match of furnitureRenderConfig.matchAll(
  /decoId:\s*'([^']+)'[\s\S]*?atlas:\s*\{[\s\S]*?sheetKey:\s*'([^']+)'/g,
)) {
  decoAtlasSheetKey.set(match[1], match[2]);
}

function resolveStorageKey(iconKey) {
  const sheetKey = decoAtlasSheetKey.get(iconKey);
  return sheetKey ?? iconKey;
}

const iconRefs = unique([...decorationConfig.matchAll(/icon:\s*'([^']+)'/g)].map((match) => match[1]));
const bgTextureRefs = unique([...decorationConfig.matchAll(/bgTexture:\s*'([^']+)'/g)].map((match) => match[1]));
const refs = unique([...iconRefs, ...bgTextureRefs]);

const missingKeys = refs.filter((key) => {
  const storageKey = resolveStorageKey(key);
  return !textureMap.has(key) && !textureMap.has(storageKey);
});

const missingFiles = refs
  .map((key) => {
    const storageKey = resolveStorageKey(key);
    const relPath = textureMap.get(storageKey) ?? textureMap.get(key);
    return relPath ? [key, storageKey, relPath] : null;
  })
  .filter(Boolean)
  .filter(([, , relPath]) => !fs.existsSync(path.join(REPO, 'minigame', relPath)));

const atlasSheetKeys = unique([...decoAtlasSheetKey.values()]);
const missingAtlasSheets = atlasSheetKeys
  .filter((key) => textureMap.has(key))
  .map((key) => [key, textureMap.get(key)])
  .filter(([, relPath]) => !fs.existsSync(path.join(REPO, 'minigame', relPath)));

console.log(`[deco-texture-check] decoration icon refs: ${iconRefs.length}`);
console.log(`[deco-texture-check] room style bg refs: ${bgTextureRefs.length}`);
console.log(`[deco-texture-check] furniture atlas sheets: ${atlasSheetKeys.length}`);
console.log(`[deco-texture-check] TextureCache keys checked: ${refs.length}`);

if (missingKeys.length > 0) {
  console.error('\n[deco-texture-check] missing TextureCache keys:');
  for (const key of missingKeys) console.error(`  - ${key}`);
}

if (missingFiles.length > 0) {
  console.error('\n[deco-texture-check] missing files for decoration refs:');
  for (const [key, storageKey, relPath] of missingFiles) {
    console.error(`  - ${key} -> ${storageKey} (${relPath})`);
  }
}

if (missingAtlasSheets.length > 0) {
  console.error('\n[deco-texture-check] missing furniture atlas sheet files:');
  for (const [key, relPath] of missingAtlasSheets) console.error(`  - ${key} -> ${relPath}`);
}

if (missingKeys.length > 0 || missingFiles.length > 0 || missingAtlasSheets.length > 0) {
  process.exitCode = 1;
} else {
  console.log('[deco-texture-check] OK');
}
