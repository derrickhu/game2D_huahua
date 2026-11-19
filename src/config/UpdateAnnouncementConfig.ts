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
  id: '1.6.37',
  version: '1.6.37',
  title: '更新公告',
  greeting: '花店的季节要换一换啦～',
  sections: [
    {
      id: 'new',
      title: '【新增】',
      items: [
        '晴汐花湾新增两座高阶花房：50级解锁「晴汐琉璃花房」（复式玻璃阳光花房）、60级解锁「绯樱镜水花阁」（三台错层落樱水院），全屋通透无遮挡，随心布置多层空间',
        '同步上架 20 件场景专属家具（两座花房各 10 件），包含可自由摆放的独立隔断「琉璃三拱花窗隔断」「绯樱花格透光屏隔」，以及纱幔大床、涌泉花池、空茶桌与桌面小物等',
      ],
    },
    {
      id: 'event',
      title: '【活动】',
      items: [
        '「金秋丰收」将于11月30日结束。结束前记得用枫叶兑换秋日家具和补给，没花完的枫叶会自动换成花愿',
        '12月1日起「冬日星愿季」，持续到明年1月7日。星愿铃铛可转动星愿转盘，抽取限定工坊图纸、锤子和染料，还有店主装扮「雪绒星愿」',
      ],
    },
  ],
  footer: '感谢一直陪伴花花妙屋，祝你游戏愉快！',
};
