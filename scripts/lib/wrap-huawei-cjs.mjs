/**
 * 华为快游戏 JSB 的 require 能加载文件，但不注入 CommonJS 的 module。
 * 必须和 xiaochu2 同一套 wrapper（含 game.js）。
 */
import fs from 'node:fs';
import path from 'node:path';

const MARK = '/*! huahua-huawei-cjs */';
const SKIP_DIR = new Set(['dist', 'temp', 'sign', 'settings', 'img', 'images']);
const SKIP_FILE = new Set(['game-bundle.js']);

function shouldWrap(source) {
  if (source.includes(MARK)) return false;
  return /\bmodule\.exports\b|\brequire\s*\(/.test(source);
}

function wrapSource(source, filename, dirname) {
  return `${MARK}
(function () {
  var __exports = {};
  var __module = { exports: __exports };
  (function (module, exports, __filename, __dirname) {
    var originalRequire = (typeof globalThis !== 'undefined' && globalThis.require)
      || (typeof global !== 'undefined' && global.require);
    function require(id) {
      return originalRequire(id, __dirname);
    }
${source}
  })(__module, __exports, ${JSON.stringify(filename)}, ${JSON.stringify(dirname)});
  return __module.exports;
})();
`;
}

function walkJs(dir, root, stats) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIR.has(name)) continue;
      walkJs(abs, root, stats);
      continue;
    }
    if (!name.endsWith('.js') || SKIP_FILE.has(name)) continue;
    const source = fs.readFileSync(abs, 'utf8');
    if (!shouldWrap(source)) {
      stats.skipped += 1;
      continue;
    }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const dirname = path.posix.dirname(rel);
    fs.writeFileSync(abs, wrapSource(source, name, dirname === '.' ? '.' : dirname));
    stats.wrapped += 1;
  }
}

export function wrapHuaweiCjsTree(outDir) {
  const stats = { wrapped: 0, skipped: 0 };
  walkJs(outDir, outDir, stats);
  return stats;
}
