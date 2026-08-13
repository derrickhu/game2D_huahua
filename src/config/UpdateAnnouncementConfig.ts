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
  id: '1.6.31',
  version: '1.6.31',
  title: '更新公告',
  greeting: '花花妙屋又变好看啦～来看看这次新内容：',
  sections: [
    {
      id: 'new',
      title: '【新增】',
      items: [
        '家具上新：落地灯、扇贝侧几、花串壁架粉彩收音机等家具上架家具商城',
        '家具工坊新品：花漾圆浴盆、蜜语软床、霜糖软座3个家具图纸上新',
      ],
    },
    {
      id: 'event',
      title: '【活动】',
      items: [
        '清凉一夏小扇获取：订单获取的小扇数量调高',
      ],
    },
    {
      id: 'fix',
      title: '【修复】',
      items: [
        '修复奖励收纳物品较多时，下滑后无法上滑、无法点击取物的问题',
      ],
    },
    {
      id: 'improve',
      title: '【优化】',
      items: [
        '部分家具默认尺寸已按摆放观感微调',
      ],
    },
  ],
  footer: '感谢一直陪伴花花妙屋，祝你游戏愉快！',
};
