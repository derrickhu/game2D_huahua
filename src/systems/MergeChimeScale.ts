/**
 * 连续合成时 `merge_success` 用 playbackRate 做温和爬升。
 * 若按完整八度拉到 2.0，后几档会尖啸刺耳；这里把 **最高档压在约 +5～6 半音**，
 * 8 档之间用指数插值，既听得出台阶又不炸耳。
 *
 * 「连续」：**两次合成间隔 ≤ MERGE_CHIME_IDLE_RESET_MS** 时下一声升一档，否则回到最低档。
 */
export const MERGE_CHIME_IDLE_RESET_MS = 3500;

/** 最低档 = 原速；再高调听感刺耳，勿接近 2 */
const RATE_MIN = 1.0;
/** 最高档约等于升 5～6 个半音（2^5.5/12≈1.35），可按听感微调 1.28～1.4 */
const RATE_MAX = 1.34;

const STEP_COUNT = 8;

/** 指数均分：相邻档比例一致，人耳更易辨 */
const RATES = Array.from({ length: STEP_COUNT }, (_, i) => {
  if (STEP_COUNT <= 1) return RATE_MIN;
  const t = i / (STEP_COUNT - 1);
  return RATE_MIN * Math.pow(RATE_MAX / RATE_MIN, t);
});

let _lastMergeAt = 0;
let _step = 0;

/** @returns 传给 AudioManager.play(..., { playbackRate })，约 1.0～RATE_MAX */
export function getNextMergeChimePlaybackRate(): number {
  const now = Date.now();
  if (now - _lastMergeAt > MERGE_CHIME_IDLE_RESET_MS) {
    _step = 0;
  } else {
    _step = (_step + 1) % RATES.length;
  }
  _lastMergeAt = now;
  return RATES[_step]!;
}
