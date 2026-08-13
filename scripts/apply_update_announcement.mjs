#!/usr/bin/env node
/**
 * 将确认后的公告草稿写入 UpdateAnnouncementConfig.ts 的 ACTIVE。
 *
 * 用法:
 *   npm run announce:apply -- docs/announcements/draft_2.0.1.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO, 'src/config/UpdateAnnouncementConfig.ts');

const SECTION_MAP = {
  '【新增】': 'new',
  '【优化】': 'improve',
  '【修复】': 'fix',
  '【活动】': 'event',
};

function parseDraft(md) {
  const meta = {
    id: '',
    version: '',
    title: '更新公告',
    greeting: '花花妙屋又变好看啦～来看看这次新内容：',
    footer: '感谢一直陪伴花花妙屋，祝你装修愉快！',
  };
  const sections = { new: [], improve: [], fix: [], event: [] };
  let current = null;

  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('>')) continue;
    if (line.startsWith('# ') || line === '---') continue;
    if (line.startsWith('编辑说明') || line.startsWith('- 保留') || line.startsWith('- 可删除') || line.startsWith('- 条目')) {
      continue;
    }
    if (line.startsWith('## 建议删除')) {
      current = null;
      continue;
    }

    const metaM = line.match(/^(id|version|title|greeting|footer):\s*(.+)$/);
    if (metaM) {
      meta[metaM[1]] = metaM[2].trim();
      continue;
    }

    const h = line.match(/^##\s*(【[^】]+】)/);
    if (h) {
      current = SECTION_MAP[h[1]] || null;
      continue;
    }

    if (line.startsWith('_（无）_') || line.startsWith('~~')) continue;
    if (line.startsWith('- ') && current) {
      let item = line.slice(2).trim();
      // 去掉 commit 对照
      item = item.replace(/\s*←\s*`[^`]+`\s*$/, '').trim();
      item = item.replace(/^~~|~~$/g, '').trim();
      if (item) sections[current].push(item);
    }
  }

  if (!meta.id) meta.id = meta.version || '0.0.0';
  if (!meta.version) meta.version = meta.id;

  return { meta, sections };
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildConfigSource(meta, sections) {
  const sectionBlocks = [];
  const order = [
    ['new', '【新增】'],
    ['event', '【活动】'],
    ['fix', '【修复】'],
    ['improve', '【优化】'],
  ];
  for (const [id, title] of order) {
    const items = sections[id] || [];
    if (!items.length) continue;
    const itemLines = items.map((it) => `        '${esc(it)}',`).join('\n');
    sectionBlocks.push(`    {
      id: '${id}',
      title: '${title}',
      items: [
${itemLines}
      ],
    },`);
  }

  return `/**
 * 更新公告 — 当前生效文案
 *
 * 发版流程见 \`docs/announcements/README.md\`：
 * 1. bump package.json version
 * 2. npm run announce:draft
 * 3. 人工确认/改写 docs/announcements/draft_*.md
 * 4. npm run announce:apply
 *
 * \`id\` 与发版 version 对齐；玩家 Persist 的 seenId === id 后不再弹出。
 * 本文件由 scripts/apply_update_announcement.mjs 生成/覆盖 ACTIVE 段。
 */

export type UpdateAnnouncementSectionId = 'new' | 'improve' | 'fix' | 'event';

export interface UpdateAnnouncementSection {
  id: UpdateAnnouncementSectionId;
  /** 展示用标题，如【新增】 */
  title: string;
  items: string[];
}

export interface UpdateAnnouncementDef {
  /** 与 package.json version / 发版号对齐 */
  id: string;
  /** 面板副标题展示，通常同 id */
  version: string;
  title: string;
  greeting: string;
  sections: UpdateAnnouncementSection[];
  footer?: string;
}

export const UPDATE_ANNOUNCEMENT_STORAGE_KEY = 'huahua_update_announcement';

/** 分段标题（apply 脚本与面板共用） */
export const UPDATE_ANNOUNCEMENT_SECTION_META: Record<
  UpdateAnnouncementSectionId,
  { title: string; order: number }
> = {
  new: { title: '【新增】', order: 0 },
  improve: { title: '【优化】', order: 1 },
  fix: { title: '【修复】', order: 2 },
  event: { title: '【活动】', order: 3 },
};

/**
 * 当前生效公告。无内容或 \`enabled: false\` 时不弹。
 */
export const UPDATE_ANNOUNCEMENT_ACTIVE: UpdateAnnouncementDef & { enabled: boolean } = {
  enabled: true,
  id: '${esc(meta.id)}',
  version: '${esc(meta.version)}',
  title: '${esc(meta.title)}',
  greeting: '${esc(meta.greeting)}',
  sections: [
${sectionBlocks.join('\n')}
  ],
  footer: '${esc(meta.footer)}',
};
`;
}

function main() {
  const draftArg = process.argv[2];
  if (!draftArg) {
    console.error('用法: npm run announce:apply -- docs/announcements/draft_x.md');
    process.exit(1);
  }
  const draftPath = path.resolve(REPO, draftArg);
  if (!fs.existsSync(draftPath)) {
    console.error(`找不到草稿: ${draftPath}`);
    process.exit(1);
  }
  const md = fs.readFileSync(draftPath, 'utf8');
  const { meta, sections } = parseDraft(md);
  const total = Object.values(sections).reduce((n, a) => n + a.length, 0);
  if (total === 0) {
    console.error('草稿没有可应用的条目，请先编辑后再 apply');
    process.exit(1);
  }
  const src = buildConfigSource(meta, sections);
  fs.writeFileSync(CONFIG_PATH, src, 'utf8');
  console.log(`applied -> ${path.relative(REPO, CONFIG_PATH)}`);
  console.log(`id=${meta.id} items=${total}`);
}

main();
