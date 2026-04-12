/**
 * 平台抽象层 - 统一微信/抖音小游戏 API
 * 所有 adapter 模块通过此模块调用平台 API，不直接写 wx.xxx 或 tt.xxx
 */

const _isWechat = typeof wx !== 'undefined';
const _isDouyin = typeof tt !== 'undefined';
const _api = _isWechat ? wx : _isDouyin ? tt : null;

if (!_api) {
  console.error('[platform] 未检测到小游戏运行环境（wx/tt）');
}

// 安全调用包装：防止鸿蒙等环境中 API 缺失导致崩溃
function _safeCall(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    console.warn('[platform] API 调用失败:', e);
    return fallback;
  }
}

const noop = function() {};

const platform = {
  createCanvas: () => _api ? _api.createCanvas() : { width: 0, height: 0, getContext: function() { return null; } },
  createImage: () => _api ? _api.createImage() : { src: '', onload: null, onerror: null },

  getSystemInfoSync: () => _api ? _safeCall(() => _api.getSystemInfoSync(), { platform: 'unknown', screenWidth: 375, screenHeight: 667 }) : { platform: 'unknown', screenWidth: 375, screenHeight: 667 },

  getStorageSync: (key) => _api ? _safeCall(() => _api.getStorageSync(key), '') : '',
  setStorageSync: (key, data) => _api ? _safeCall(() => _api.setStorageSync(key, data)) : undefined,
  removeStorageSync: (key) => _api ? _safeCall(() => _api.removeStorageSync(key)) : undefined,

  request: (opts) => _api ? _api.request(opts) : null,
  connectSocket: (opts) => _api ? _api.connectSocket(opts) : null,

  onTouchStart: (cb) => _api && _api.onTouchStart ? _api.onTouchStart(cb) : noop,
  onTouchMove: (cb) => _api && _api.onTouchMove ? _api.onTouchMove(cb) : noop,
  onTouchEnd: (cb) => _api && _api.onTouchEnd ? _api.onTouchEnd(cb) : noop,
  onTouchCancel: (cb) => _api && _api.onTouchCancel ? _api.onTouchCancel(cb) : noop,
  offTouchStart: (cb) => _api && _api.offTouchStart ? _api.offTouchStart(cb) : noop,
  offTouchMove: (cb) => _api && _api.offTouchMove ? _api.offTouchMove(cb) : noop,
  offTouchEnd: (cb) => _api && _api.offTouchEnd ? _api.offTouchEnd(cb) : noop,
  offTouchCancel: (cb) => _api && _api.offTouchCancel ? _api.offTouchCancel(cb) : noop,

  createInnerAudioContext: () => _api && _api.createInnerAudioContext ? _api.createInnerAudioContext() : null,

  name: _isWechat ? 'wechat' : _isDouyin ? 'douyin' : 'unknown',
  api: _api,
};

module.exports = platform;
