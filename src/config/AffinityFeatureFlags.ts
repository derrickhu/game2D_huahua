/**
 * 熟客系统功能开关（Feature Flags）
 *
 * 用于「友谊卡 + 图鉴」与「赛季制」两块新系统的灰度上线/紧急回退。
 * 所有开关默认 false，P0 调速期不影响现有玩法；待 P1 demo 验收后逐项打开。
 *
 * 调用约定：
 *  - 业务代码读取 `isAffinityCardSystemEnabled()` 等访问器，**勿**直接 `import` 常量；
 *    便于未来切换到 RemoteConfig（线上动态下发）而无需大改。
 *  - GM 工具可调用 `gmSetFeatureFlag(name, value)` 临时开关（仅当前会话）。
 */

interface AffinityFlags {
  /** 启用友谊卡片 + 图鉴系统：true 时 Bond 点改由卡片积分驱动；false 时回到 +1/+2 兼容路径 */
  cardSystem: boolean;
  /** 启用赛季制：true 时 CodexPanel 显示赛季倒计时、旧赛季客人不再掉卡 */
  season: boolean;
}

const _defaults: AffinityFlags = {
  cardSystem: false,
  season: false,
};

const _runtime: AffinityFlags = { ..._defaults };

export function isAffinityCardSystemEnabled(): boolean {
  return _runtime.cardSystem;
}

export function isAffinitySeasonEnabled(): boolean {
  return _runtime.season;
}

/** GM/调试用：临时切换开关（仅当前会话，不持久化） */
export function gmSetAffinityFlag<K extends keyof AffinityFlags>(name: K, value: AffinityFlags[K]): void {
  _runtime[name] = value;
  console.log(`[AffinityFlag] ${name} = ${value}`);
}

/** 调试快照 */
export function dumpAffinityFlags(): Readonly<AffinityFlags> {
  return { ..._runtime };
}
