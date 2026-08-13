#!/usr/bin/env node
/**
 * 从 git 提交生成更新公告草稿（玩家向中文），供人工确认后再 apply。
 *
 * 用法（仓库根）:
 *   npm run announce:draft
 *   npm run announce:draft -- --version 2.0.2
 *   npm run announce:draft -- --since 2.0.1
 *   npm run announce:draft -- --since HEAD~30
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO, 'src/config/UpdateAnnouncementConfig.ts');
const OUT_DIR = path.join(REPO, 'docs/announcements');

function parseArgs(argv) {
  const out = { version: '', since: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') out.version = argv[++i] || '';
    else if (a === '--since') out.since = argv[++i] || '';
  }
  return out;
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  return String(pkg.version || '0.0.0');
}

function readActiveIdFromConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return '';
  const text = fs.readFileSync(CONFIG_PATH, 'utf8');
  const m = text.match(/id:\s*'([^']+)'/);
  return m ? m[1] : '';
}

function gitLog(since) {
  const range = since ? `${since}..HEAD` : 'HEAD~40..HEAD';
  try {
    return execSync(
      `git log ${range} --pretty=format:%s --no-merges`,
      { cwd: REPO, encoding: 'utf8' },
    ).trim();
  } catch {
    return execSync('git log -40 --pretty=format:%s --no-merges', {
      cwd: REPO,
      encoding: 'utf8',
    }).trim();
  }
}

/**
 * conventional commit → 分段 + 玩家向草稿句
 * 返回 { section, text, suggestDrop, raw }
 */
function mapCommit(subject) {
  const raw = subject.trim();
  const m = raw.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/);
  const type = (m?.[1] || '').toLowerCase();
  const scope = (m?.[2] || '').toLowerCase();
  const body = (m?.[3] || raw).trim();

  const dropTypes = new Set(['chore', 'docs', 'ci', 'build', 'test', 'style', 'refactor']);
  if (dropTypes.has(type)) {
    return { section: 'improve', text: body, suggestDrop: true, raw };
  }

  let section = 'improve';
  if (type === 'feat') section = 'new';
  else if (type === 'fix') section = 'fix';
  else if (type === 'balance' || type === 'perf') section = 'improve';
  if (/活动|event|cool.?summer|清凉|珠匣|jewelry/i.test(raw)) section = 'event';

  // 粗翻：保留中文主体，去掉内部术语噪音
  let text = body
    .replace(/DecorationConfig|TextureCache|MainScene|PersistService/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (section === 'new') {
    if (!/^新增/.test(text)) text = `新增${text}`;
  } else if (section === 'fix') {
    if (!/^修复/.test(text)) text = `修复${text}`;
  } else if (section === 'event') {
    if (!/活动|兑换|清凉|珠匣/.test(text)) text = `活动相关：${text}`;
  }

  // 过短或纯英文内部改动 → 建议删
  const suggestDrop =
    text.length < 6 ||
    /^(update|add|fix|wip)\b/i.test(body) ||
    /prompt|nb2|sheet_v\d|tmp\//i.test(raw);

  return { section, text, suggestDrop, raw, scope };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version || readPackageVersion();
  const since = args.since || readActiveIdFromConfig() || '';
  const log = gitLog(since);
  const lines = log ? log.split('\n').filter(Boolean) : [];

  const buckets = { new: [], improve: [], fix: [], event: [] };
  const dropped = [];

  for (const subject of lines) {
    const mapped = mapCommit(subject);
    if (mapped.suggestDrop) {
      dropped.push(`- ~~${mapped.text}~~ ← \`${mapped.raw}\``);
      continue;
    }
    buckets[mapped.section].push(`- ${mapped.text} ← \`${mapped.raw}\``);
  }

  const sectionOrder = [
    ['new', '【新增】'],
    ['event', '【活动】'],
    ['fix', '【修复】'],
    ['improve', '【优化】'],
  ];

  let md = '';
  md += `# 更新公告草稿 v${version}\n\n`;
  md += `> 自动生成于 ${new Date().toISOString().slice(0, 10)}`;
  md += since ? `（since \`${since}\`）` : '（近期提交）';
  md += `\n> 请改写成玩家向短句后执行：\`npm run announce:apply -- docs/announcements/draft_${version}.md\`\n\n`;
  md += `id: ${version}\n`;
  md += `version: ${version}\n`;
  md += `title: 更新公告\n`;
  md += `greeting: 花花妙屋又变好看啦～来看看这次新内容：\n`;
  md += `footer: 感谢一直陪伴花花妙屋，祝你装修愉快！\n\n`;

  for (const [key, title] of sectionOrder) {
    md += `## ${title}\n\n`;
    if (buckets[key].length === 0) {
      md += `_（无）_\n\n`;
    } else {
      md += `${buckets[key].join('\n')}\n\n`;
    }
  }

  if (dropped.length) {
    md += `## 建议删除（未写入分段）\n\n`;
    md += `${dropped.join('\n')}\n\n`;
  }

  md += `---\n\n`;
  md += `编辑说明：\n`;
  md += `- 保留 \`## 【新增】\` 等标题；每条以 \`- \` 开头\n`;
  md += `- 可删除 \`← \\\`commit\\\`\` 对照后缀\n`;
  md += `- 条目控制在 5～12 条，收益导向、口语化\n`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `draft_${version}.md`);
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`draft -> ${path.relative(REPO, outPath)}`);
  console.log(`commits scanned: ${lines.length}`);
}

main();
