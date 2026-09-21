/**
 * Canvas 管理：第一次 createCanvas() 返回主屏 canvas。
 * 华为原生 qg 没有 createCanvas，必须回落到 runtime 捕获的宿主画布。
 */

const platform = require('./platform');

function _usable(c) {
  if (!c || typeof c.getContext !== 'function') return false;
  // 量字假画布拿不到 WebGL，不能当主屏
  return !c.__huahuaMeasure && !c.__tapTextWrap;
}

let canvas;
try {
  canvas = platform.createCanvas();
  if (!_usable(canvas) && typeof GameGlobal !== 'undefined' && _usable(GameGlobal.__hostCanvas)) {
    canvas = GameGlobal.__hostCanvas;
  }

  const _sysPlat = platform.getSystemInfoSync().platform;
  if ((_sysPlat === 'ios' || platform.name === 'taptap' || platform.name === 'huawei') && canvas && typeof canvas.getContext === 'function') {
    const origGetContext = canvas.getContext.bind(canvas);
    canvas.getContext = function(type, opts) {
      if (type === 'webgl2') return null;
      return origGetContext(type, opts);
    };
  }
} catch (e) {
  console.error('[canvas] createCanvas 失败:', e);
  canvas = (typeof GameGlobal !== 'undefined' && _usable(GameGlobal.__hostCanvas))
    ? GameGlobal.__hostCanvas
    : { width: 0, height: 0, getContext: function() { return null; } };
}

module.exports = { canvas };

