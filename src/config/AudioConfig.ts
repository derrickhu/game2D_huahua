/**
 * 音效配置
 *
 * 所有音效资源统一在此注册。
 * 文件放在 minigame/subpkg_audio/ 分包目录下。
 * 音效多为 **WAV** 占位（`scripts/gen_subpkg_audio_placeholders.py`）；已替换为 **MP3** 的见各条注释（如 `merge_success`、`tap_building`、`customer_deliver` 等）。**BGM** 均为 **MP3**。
 */

export interface SoundDef {
  /** 音效名称（用于 AudioManager.play(name)） */
  name: string;
  /** 文件路径（相对于 minigame/ 根目录） */
  src: string;
  /** 音量 0~1 */
  volume: number;
  /** 说明 */
  desc: string;
}

export const SOUND_DEFS: SoundDef[] = [
  /** 源：`game_assets/huahua/bgm/合成3.mp3` 截取首 1s；`board:merged`；连续变调见 SoundSystem */
  { name: 'merge_success', src: 'subpkg_audio/merge_success.mp3', volume: 0.52, desc: '合成' },
  /** 源：`game_assets/huahua/bgm/合成2.mp3`；点击生产器产出（`building:produced`） */
  { name: 'tap_building', src: 'subpkg_audio/tap_building.mp3', volume: 0.48, desc: '点击建筑产出' },

  { name: 'customer_arrive', src: 'subpkg_audio/customer_arrive.wav', volume: 0.7, desc: '客人到来' },
  /** 源：`game_assets/huahua/bgm/完成订单.mp3`；完成订单起点 + 所有奖励物品飞入起点（RewardFlyCoordinator / MainScene） */
  { name: 'customer_deliver', src: 'subpkg_audio/customer_deliver.mp3', volume: 0.7, desc: '完成订单 / 奖励飞入' },
  { name: 'chest_open', src: 'subpkg_audio/chest_open.wav', volume: 0.7, desc: '宝箱开启' },
  { name: 'cell_unlock', src: 'subpkg_audio/cell_unlock.wav', volume: 0.6, desc: '格子解锁' },

  /** 源：`game_assets/huahua/bgm/按钮通用.mp3`；全局默认点击（见 SoundSystem stage `pointerdown` + `GameButton` 默认） */
  { name: 'button_click', src: 'subpkg_audio/button_click.mp3', volume: 0.38, desc: 'UI 通用按钮' },
  /** 源：`game_assets/huahua/bgm/购买.mp3` 短截 + 尾淡出；家具/商城等扣花愿或钻石时 */
  { name: 'purchase_tap', src: 'subpkg_audio/purchase_tap.mp3', volume: 0.58, desc: '购买扣费' },
  { name: 'level_up', src: 'subpkg_audio/level_up.wav', volume: 0.65, desc: '升级/升星' },
  { name: 'achievement', src: 'subpkg_audio/achievement.wav', volume: 0.65, desc: '成就' },
  { name: 'checkin', src: 'subpkg_audio/checkin.wav', volume: 0.6, desc: '签到/里程碑' },

  /** 源：`game_assets/huahua/bgm/奖励.mp3`；恭喜获得 / 升星祝贺等弹层（ItemObtainOverlay、LevelUpPopup） */
  { name: 'ui_reward_fanfare', src: 'subpkg_audio/ui_reward_fanfare.mp3', volume: 0.55, desc: '弹出奖励面板' },
  /** 源：`game_assets/huahua/bgm/解锁图鉴.mp3`；首次合成图鉴「新解锁」弹窗（FlowerEasterEggSystem） */
  { name: 'collection_unlock', src: 'subpkg_audio/collection_unlock.mp3', volume: 0.52, desc: '图鉴新解锁弹窗' },
  { name: 'world_map_open', src: 'subpkg_audio/world_map_open.wav', volume: 0.42, desc: '大地图展开' },
];

export const BGM_DEFS: SoundDef[] = [
  /** 合成主界面：沿用正式 MP3；勿改为脚本生成的 wav，除非有意替换整条 BGM */
  { name: 'bgm_main', src: 'subpkg_audio/bgm_main.mp3', volume: 0.4, desc: '主玩法 BGM' },
  { name: 'bgm_story', src: 'subpkg_audio/bgm_main.mp3', volume: 0.35, desc: '剧情 BGM（暂同主 BGM）' },
  /** 源文件：`../game_assets/huahua/bgm/Felt Petals.mp3` 拷贝为无空格文件名便于运行时路径 */
  { name: 'bgm_shop', src: 'subpkg_audio/bgm_shop_felt_petals.mp3', volume: 0.38, desc: '花店/装修场景 BGM（Felt Petals）' },
];
