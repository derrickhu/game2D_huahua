/**
 * 音效配置
 *
 * 所有音效资源统一在此注册。
 * 文件放在 minigame/subpkg_audio/ 分包目录下。
 * 正式资源为 **真实二进制 MP3**（InnerAudioContext 可播）。无资源时可用 `scripts/gen_subpkg_audio_placeholders.py` 生占位 WAV 并改 src 调试。
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
  // merge_success：合成音效；连续合成时由 MergeChimeScale + playbackRate 做音阶
  { name: 'merge_success', src: 'subpkg_audio/merge_success.mp3', volume: 0.62, desc: '合成成功' },
  { name: 'tap_building', src: 'subpkg_audio/button_click.mp3', volume: 0.6, desc: '点击建筑（暂用 button_click）' },

  { name: 'customer_arrive', src: 'subpkg_audio/button_click.mp3', volume: 0.7, desc: '客人到来（占位）' },
  { name: 'customer_deliver', src: 'subpkg_audio/button_click.mp3', volume: 0.7, desc: '订单完成（占位）' },
  { name: 'chest_open', src: 'subpkg_audio/button_click.mp3', volume: 0.7, desc: '宝箱（占位）' },
  { name: 'cell_unlock', src: 'subpkg_audio/button_click.mp3', volume: 0.6, desc: '格子解锁（占位）' },

  { name: 'button_click', src: 'subpkg_audio/button_click.mp3', volume: 0.5, desc: 'UI 按钮' },
  { name: 'level_up', src: 'subpkg_audio/button_click.mp3', volume: 0.65, desc: '升级（占位）' },
  { name: 'achievement', src: 'subpkg_audio/button_click.mp3', volume: 0.65, desc: '成就（占位）' },
  { name: 'checkin', src: 'subpkg_audio/button_click.mp3', volume: 0.6, desc: '签到（占位）' },
];

export const BGM_DEFS: SoundDef[] = [
  { name: 'bgm_main', src: 'subpkg_audio/bgm_main.mp3', volume: 0.4, desc: '主玩法 BGM' },
  { name: 'bgm_story', src: 'subpkg_audio/bgm_main.mp3', volume: 0.35, desc: '剧情 BGM（暂同主 BGM）' },
];
