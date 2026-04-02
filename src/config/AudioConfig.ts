/**
 * 音效配置
 *
 * 所有音效资源统一在此注册。
 * 文件放在 minigame/subpkg_audio/ 分包目录下。
 * 占位 WAV 由 scripts/gen_subpkg_audio_placeholders.py 生成（避免仓库内 .mp3 为 Git LFS 指针时微信无法解码）。
 * 正式资源可改为 mp3/wav 并更新 src；若用 mp3 请确保已 git lfs pull 或文件为真实二进制。
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

/**
 * 分包内占位：merge_success.wav、button_click.wav、bgm_main.wav（脚本生成，非 LFS）。
 */
export const SOUND_DEFS: SoundDef[] = [
  { name: 'merge_success', src: 'subpkg_audio/merge_success.wav', volume: 0.8, desc: '合成成功' },
  { name: 'tap_building', src: 'subpkg_audio/button_click.wav', volume: 0.6, desc: '点击建筑（暂用 button_click）' },

  { name: 'customer_arrive', src: 'subpkg_audio/button_click.wav', volume: 0.7, desc: '客人到来（占位）' },
  { name: 'customer_deliver', src: 'subpkg_audio/merge_success.wav', volume: 0.8, desc: '订单完成（占位）' },
  { name: 'chest_open', src: 'subpkg_audio/button_click.wav', volume: 0.7, desc: '宝箱（占位）' },
  { name: 'cell_unlock', src: 'subpkg_audio/button_click.wav', volume: 0.6, desc: '格子解锁（占位）' },

  { name: 'button_click', src: 'subpkg_audio/button_click.wav', volume: 0.5, desc: 'UI 按钮' },
  { name: 'level_up', src: 'subpkg_audio/merge_success.wav', volume: 0.8, desc: '升级（占位）' },
  { name: 'achievement', src: 'subpkg_audio/merge_success.wav', volume: 0.8, desc: '成就（占位）' },
  { name: 'checkin', src: 'subpkg_audio/merge_success.wav', volume: 0.7, desc: '签到（占位）' },
];

export const BGM_DEFS: SoundDef[] = [
  { name: 'bgm_main', src: 'subpkg_audio/bgm_main.wav', volume: 0.4, desc: '主玩法 BGM' },
  { name: 'bgm_story', src: 'subpkg_audio/bgm_main.wav', volume: 0.35, desc: '剧情 BGM（暂同主 BGM）' },
];
