/**
 * 音效配置
 *
 * 所有音效资源统一在此注册。
 * 文件放在 minigame/audio/ 目录下。
 * 当前为占位配置，添加真实 mp3 文件后即可生效。
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

/** 音效列表 */
export const SOUND_DEFS: SoundDef[] = [
  // ---- 核心操作 ----
  { name: 'merge_success', src: 'audio/merge_success.mp3', volume: 0.8, desc: '合成成功 - 清脆叮咚' },
  { name: 'merge_combo', src: 'audio/merge_combo.mp3', volume: 0.7, desc: '连击 - 递进音阶' },
  { name: 'merge_frenzy', src: 'audio/merge_frenzy.mp3', volume: 0.6, desc: '狂热模式 - 欢快加速' },
  { name: 'tap_building', src: 'audio/tap_building.mp3', volume: 0.6, desc: '点击建筑 - 轻柔按键' },

  // ---- 经营 ----
  { name: 'customer_arrive', src: 'audio/customer_arrive.mp3', volume: 0.7, desc: '客人到来 - 门铃叮当' },
  { name: 'customer_deliver', src: 'audio/customer_deliver.mp3', volume: 0.8, desc: '订单完成 - 金币散落' },
  { name: 'chest_open', src: 'audio/chest_open.mp3', volume: 0.7, desc: '宝箱开启 - 木箱打开' },
  { name: 'cell_unlock', src: 'audio/cell_unlock.mp3', volume: 0.6, desc: '格子解锁 - 魔法解封' },

  // ---- UI ----
  { name: 'button_click', src: 'audio/button_click.mp3', volume: 0.5, desc: 'UI按钮 - 轻柔点击' },
  { name: 'level_up', src: 'audio/level_up.mp3', volume: 0.8, desc: '升级 - 欢快铜管' },
  { name: 'achievement', src: 'audio/achievement.mp3', volume: 0.8, desc: '成就解锁 - 辉煌号角' },
  { name: 'checkin', src: 'audio/checkin.mp3', volume: 0.7, desc: '签到 - 轻快铃声' },
];

/** BGM 列表 */
export const BGM_DEFS: SoundDef[] = [
  { name: 'bgm_main',  src: 'audio/bgm_main.mp3',  volume: 0.4, desc: '主玩法BGM - 温暖治愈轻浪漫' },
  { name: 'bgm_story', src: 'audio/bgm_story.mp3', volume: 0.35, desc: '花语剧情BGM - 细腻钢琴+八音盒' },
];
