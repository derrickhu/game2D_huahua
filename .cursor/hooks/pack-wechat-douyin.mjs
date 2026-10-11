#!/usr/bin/env node
/**
 * 代理改完一轮后，若源码或资源比上次打包新，就打最新的微信包和抖音包。
 * `npm run build` 一次编译，同时组装 build/wechat 与 build/douyin。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stampPath = path.join(root, '.cursor/hooks/.last-pack-ok');
const lockPath = path.join(root, '.cursor/hooks/.pack.lock');
const logPath = path.join(root, '.cursor/hooks/pack.log');

const WATCH = [
  'src',
  'minigame',
  'platform/wechat',
  'platform/douyin',
  'vite.config.ts',
  'package.json',
  'scripts/build-platform.mjs',
  'scripts/lib',
];

const SKIP_DIR = new Set(['node_modules', '.git', 'build', '.bundle', '.bundle-taptap', '.bundle-huawei']);
const SKIP_FILE = new Set(['index.html', 'game-bundle.js', '.DS_Store']);

function newestMtime(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return 0;
  const st = fs.statSync(abs);
  if (st.isFile()) return SKIP_FILE.has(path.basename(abs)) ? 0 : st.mtimeMs;
  let max = 0;
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIR.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (!SKIP_FILE.has(entry.name)) {
        try {
          const m = fs.statSync(full).mtimeMs;
          if (m > max) max = m;
        } catch { /* 文件在扫描中消失 */ }
      }
    }
  }
  return max;
}

function sourcesNewerThanStamp() {
  const stamp = fs.existsSync(stampPath) ? Number(fs.readFileSync(stampPath, 'utf8')) || 0 : 0;
  return WATCH.some((rel) => newestMtime(rel) > stamp + 1000);
}

function lockHeld() {
  if (!fs.existsSync(lockPath)) return false;
  const pid = Number(fs.readFileSync(lockPath, 'utf8'));
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function log(line) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
}

async function readStdin() {
  if (process.stdin.isTTY) return;
  await new Promise((resolve) => {
    process.stdin.on('data', () => {});
    process.stdin.on('end', resolve);
    process.stdin.resume();
  });
}

function runBuild() {
  const npm = path.join(path.dirname(process.execPath), 'npm');
  return new Promise((resolve) => {
    const child = spawn(fs.existsSync(npm) ? npm : 'npm', ['run', 'build'], {
      cwd: root,
      env: { ...process.env, HUAHUA_PLATFORM: 'all' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let tail = '';
    const take = (buf) => {
      tail = (tail + buf.toString()).slice(-4000);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => resolve({ code: code ?? 1, tail }));
  });
}

const force = process.argv.includes('--now');

await readStdin();

if (!force && !sourcesNewerThanStamp()) {
  process.stdout.write('{}\n');
  process.exit(0);
}

if (lockHeld()) {
  log('skip: another pack is running');
  process.stdout.write('{}\n');
  process.exit(0);
}

fs.mkdirSync(path.dirname(lockPath), { recursive: true });
fs.writeFileSync(lockPath, String(process.pid));

try {
  log(force ? 'pack start --now' : 'pack start');
  const { code, tail } = await runBuild();
  if (code === 0) {
    fs.writeFileSync(stampPath, String(Date.now()));
    log('pack ok → build/wechat build/douyin');
  } else {
    log(`pack failed exit ${code}\n${tail}`);
  }
} catch (err) {
  log(`pack error ${err instanceof Error ? err.message : err}`);
} finally {
  fs.rmSync(lockPath, { force: true });
}

process.stdout.write('{}\n');
process.exit(0);
