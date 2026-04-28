import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const textureCachePath = path.join(root, 'src/utils/TextureCache.ts');
const srcDir = path.join(root, 'src');

const text = fs.readFileSync(textureCachePath, 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (/\.(ts|js)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

function extractMap(name) {
  const start = text.indexOf(`const ${name}`);
  if (start < 0) return new Map();
  const braceStart = text.indexOf('{', start);
  let depth = 0;
  let end = braceStart;
  for (; end < text.length; end++) {
    const ch = text[end];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = text.slice(braceStart + 1, end);
  const result = new Map();
  const re = /^\s*([A-Za-z0-9_]+)\s*:\s*['"`]([^'"`]+)['"`]/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    result.set(m[1], m[2]);
  }
  return result;
}

const maps = [
  'MAIN_IMAGE_MAP',
  'CHARS_IMAGE_MAP',
  'PANELS_IMAGE_MAP',
  'ITEMS_IMAGE_MAP',
  'DECO_IMAGE_MAP',
  'CRITICAL_IMAGE_MAP',
];

const registered = new Map();
for (const mapName of maps) {
  for (const [key, value] of extractMap(mapName)) {
    registered.set(key, { path: value, mapName });
  }
}

const files = walk(srcDir);
const staticGets = [];
const dynamicGets = [];
const bypasses = [];

const allowedBypassFiles = new Set([
  'src/utils/TextureCache.ts',
  'src/core/CdnAssetService.ts',
  'src/core/AudioManager.ts',
  'src/core/pixiUnsafeEvalPatch.ts',
  'src/core/PlatformService.ts',
]);

for (const file of files) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  const getRe = /TextureCache\.get\(\s*([^)\n]+?)\s*\)/g;
  let m;
  while ((m = getRe.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    const line = before.split(/\r?\n/).length;
    const arg = m[1].trim();
    const literal = arg.match(/^['"`]([^'"`$]+)['"`]$/);
    if (literal) {
      staticGets.push({ rel, line, key: literal[1] });
    } else {
      dynamicGets.push({ rel, line, arg });
    }
  }

  if (!allowedBypassFiles.has(rel)) {
    const bypassRe = /(PIXI\.Texture\.from|PIXI\.Assets|createImage\(|new Image\(|XMLHttpRequest\()/g;
    while ((m = bypassRe.exec(content)) !== null) {
      const line = content.slice(0, m.index).split(/\r?\n/).length;
      const sourceLine = lines[line - 1]?.trim() || '';
      bypasses.push({ rel, line, token: m[1], sourceLine });
    }
  }
}

const missing = staticGets.filter(item => !registered.has(item.key));
const duplicateKeys = [];
const seen = new Map();
for (const mapName of maps) {
  for (const [key] of extractMap(mapName)) {
    if (seen.has(key)) duplicateKeys.push({ key, first: seen.get(key), second: mapName });
    seen.set(key, mapName);
  }
}

console.log(`[asset-check] registered texture keys: ${registered.size}`);
console.log(`[asset-check] static TextureCache.get calls: ${staticGets.length}`);
console.log(`[asset-check] dynamic TextureCache.get calls: ${dynamicGets.length}`);

if (duplicateKeys.length > 0) {
  console.log('\n[asset-check] duplicate keys (later maps may intentionally override earlier maps):');
  for (const item of duplicateKeys) {
    console.log(`  - ${item.key}: ${item.first} -> ${item.second}`);
  }
}

if (dynamicGets.length > 0) {
  console.log('\n[asset-check] dynamic TextureCache.get calls require resource-domain coverage:');
  for (const item of dynamicGets) {
    console.log(`  - ${item.rel}:${item.line} ${item.arg}`);
  }
}

if (missing.length > 0) {
  console.error('\n[asset-check] missing registered texture keys:');
  for (const item of missing) {
    console.error(`  - ${item.rel}:${item.line} ${item.key}`);
  }
}

if (bypasses.length > 0) {
  console.error('\n[asset-check] possible texture-loading bypasses:');
  for (const item of bypasses) {
    console.error(`  - ${item.rel}:${item.line} ${item.token} :: ${item.sourceLine}`);
  }
}

if (missing.length > 0 || bypasses.length > 0) {
  process.exitCode = 1;
}
