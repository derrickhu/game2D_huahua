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
  id: '1.6.36',
  version: '1.6.36',
  title: '更新公告',
  greeting: '花花妙屋又有新动静啦～',
  sections: [
    {
      id: 'new',
      title: '【新增】',
      items: [
        '新场景「松溪花桥庭」：45级在晴汐花湾开放，45–48级可解锁繁花拱架摇椅秋千、流泉水钵花坛、苔木槽绣球、花藤空茶桌等专属花草装饰',
        '新主题「晴风花绘坊」：紫藤花伞茶座、天窗藤幔卧榻、彩绘琉璃隔断等19件上线，在装修「主题」里切换查看',
        '新家具「雪绒山茶」：40–45级解锁绒帐暖床、厚枕软榻、绛蕊屏风、松棚花车等',
      ],
    },
    {
      id: 'fix',
      title: '【修复】',
      items: [
        '修复了装修中或退出装修后，店主偶尔拖不动的问题',
      ],
    },
  ],
  footer: '感谢一直陪伴花花妙屋，祝你游戏愉快！',
};
