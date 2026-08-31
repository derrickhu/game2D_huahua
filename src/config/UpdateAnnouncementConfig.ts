/**
 * 更新公告 — 当前生效文案
 *
 * 发版流程见 `docs/announcements/README.md`：
 * 1. bump package.json version
 * 2. npm run announce:draft
 * 3. 人工确认/改写 docs/announcements/draft_*.md
 * 4. npm run announce:apply
 *
 * `id` 与发版 version 对齐；玩家 Persist 的 seenId === id 后不再弹出。
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
 * 当前生效公告。无内容或 `enabled: false` 时不弹。
 */
export const UPDATE_ANNOUNCEMENT_ACTIVE: UpdateAnnouncementDef & { enabled: boolean } = {
  enabled: true,
  id: '1.6.33',
  version: '1.6.33',
  title: '更新公告',
  greeting: '花花妙屋又有新动静啦～',
  sections: [
    {
      id: 'event',
      title: '【活动】',
      items: [
        '清凉一夏活动下线',
        '限时活动「月满中秋」开启：完成月饼订单，获取中秋抽奖机会',
      ],
    },
    {
      id: 'improve',
      title: '【优化】',
      items: [
        '广告解锁的家具看完广告即可获得，无需再花愿购买',
        '成长之路友谊卡任务数量下调，更容易完成',
      ],
    },
  ],
  footer: '感谢一直陪伴花花妙屋，祝你游戏愉快！',
};
