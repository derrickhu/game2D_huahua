/**
 * 平台抽象层 - 统一微信/抖音/Tap/华为快游戏 API
 * 宿主识别与 src/core/platformDetect.ts / runtime.js 一致
 */

const {
  detectMinigamePlatform,
  getNativePlatformApi,
  createHuaweiCanvas,
  createHuaweiImage,
} = require('../runtime.js');
const { createMeasureCanvas } = require('./safeCanvas');
const _platformName = detectMinigamePlatform();
const _api = getNativePlatformApi(_platformName);
const _dummyCanvas = { width: 0, height: 0, getContext: function() { return null; } };

if (!_api) {
  console.error('[platform] 未检测到小游戏运行环境（wx/tt/tap/qg）');
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

function _hostLocalStorage() {
  try {
    if (typeof GameGlobal !== 'undefined' && GameGlobal.__hostLocalStorage) {
      return GameGlobal.__hostLocalStorage;
    }
  } catch (_) { /* */ }
  return null;
}

function _unwrapStorage(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw.data || raw.value || '';
  return String(raw);
}

function _readStorage(key) {
  if (_api && typeof _api.getStorageSync === 'function') {
    const wxStyle = _safeCall(() => _unwrapStorage(_api.getStorageSync(key)), '');
    if (wxStyle) return wxStyle;
    const qgStyle = _safeCall(() => _unwrapStorage(_api.getStorageSync({ key: key })), '');
    if (qgStyle) return qgStyle;
  }
  const ls = _hostLocalStorage();
  if (ls && typeof ls.getItem === 'function') {
    return _safeCall(() => ls.getItem(key) || '', '');
  }
  return '';
}

function _writeStorage(key, data) {
  if (_api && typeof _api.setStorageSync === 'function') {
    try {
      _api.setStorageSync(key, data);
    } catch (_) {
      _safeCall(() => _api.setStorageSync({ key: key, value: data }));
    }
  }
  const ls = _hostLocalStorage();
  if (ls && typeof ls.setItem === 'function') {
    _safeCall(() => { ls.setItem(key, data); });
  }
}

function _removeStorage(key) {
  if (_api && typeof _api.removeStorageSync === 'function') {
    _safeCall(() => _api.removeStorageSync(key));
    _safeCall(() => _api.removeStorageSync({ key: key }));
  }
  if (_api && typeof _api.deleteStorageSync === 'function') {
    _safeCall(() => _api.deleteStorageSync({ key: key }));
  }
  const ls = _hostLocalStorage();
  if (ls && typeof ls.removeItem === 'function') {
    _safeCall(() => { ls.removeItem(key); });
  }
}

let _tapScreenIssued = false;

function _sealTapCreateCanvas() {
  if (!_api || _api.__huahuaTapCanvasSealed || typeof _api.createCanvas !== 'function') return;
  _api.__huahuaTapCanvasSealed = true;
  // 业务侧还会直接调 tap.createCanvas()（文字光栅、探测）。第二次原生画布就是日志里的 #1。
  _api.createCanvas = function() {
    return createMeasureCanvas(1, 1);
  };
}

function _createCanvas() {
  if (_platformName === 'huawei' && typeof createHuaweiCanvas === 'function') {
    const hw = createHuaweiCanvas();
    if (hw) return hw;
  }
  if (_platformName === 'taptap' && _tapScreenIssued) {
    return createMeasureCanvas(1, 1);
  }
  if (_api && typeof _api.createCanvas === 'function') {
    try {
      const c = _api.createCanvas();
      if (c && typeof c.getContext === 'function') {
        if (_platformName === 'taptap') {
          _tapScreenIssued = true;
          _sealTapCreateCanvas();
        }
        return c;
      }
    } catch (e) {
      console.warn('[platform] createCanvas 失败:', e);
    }
  }
  return _dummyCanvas;
}

function _createImage() {
  if (_platformName === 'huawei' && typeof createHuaweiImage === 'function') {
    return createHuaweiImage();
  }
  if (_api && typeof _api.createImage === 'function') {
    try { return _api.createImage(); } catch (e) {
      console.warn('[platform] createImage 失败:', e);
    }
  }
  return { src: '', onload: null, onerror: null };
}

const noop = function() {};

function _isWechatDevtools() {
  if (_platformName !== 'wechat') return false;
  try {
    if (typeof navigator !== 'undefined' && /wechatdevtools/i.test(String(navigator.userAgent || ''))) {
      return true;
    }
  } catch (_) { /* */ }
  try {
    const cfg = typeof __wxConfig !== 'undefined' ? __wxConfig : null;
    if (cfg && String(cfg.platform || '').toLowerCase() === 'devtools') return true;
  } catch (_) { /* */ }
  try {
    const dev = _api && typeof _api.getDeviceInfo === 'function' ? _api.getDeviceInfo() : null;
    if (dev && String(dev.platform || '').toLowerCase() === 'devtools') return true;
  } catch (_) { /* */ }
  try {
    const info = _api && _api.getSystemInfoSync ? _api.getSystemInfoSync() : null;
    if (!info) return false;
    const platform = String(info.platform || '').toLowerCase();
    const brand = String(info.brand || '').toLowerCase();
    const model = String(info.model || '').toLowerCase();
    return platform === 'devtools' || brand === 'devtools' || model.indexOf('devtools') >= 0;
  } catch (_) {
    return false;
  }
}

function _finishHostCall(opts, ok, result) {
  try {
    if (ok && typeof opts.success === 'function') opts.success(result);
    if (!ok && typeof opts.fail === 'function') opts.fail(result);
  } catch (e) {
    console.warn('[platform] 回调失败:', e);
  }
  try {
    if (typeof opts.complete === 'function') opts.complete(result);
  } catch (_) { /* */ }
}

function _devtoolsFetchRequest(opts) {
  const method = String(opts && opts.method || 'GET').toUpperCase();
  const headers = (opts && opts.header) || {};
  const init = { method: method, headers: headers };
  if (opts && opts.data !== undefined && method !== 'GET') {
    init.body = typeof opts.data === 'string' || opts.data instanceof ArrayBuffer
      ? opts.data
      : JSON.stringify(opts.data);
  }
  const responseType = opts && opts.responseType === 'arraybuffer' ? 'arraybuffer' : 'text';
  fetch(String(opts && opts.url || ''), init).then(function(res) {
    const read = responseType === 'arraybuffer' ? res.arrayBuffer() : res.text();
    return read.then(function(data) {
      const header = {};
      try { res.headers.forEach(function(v, k) { header[k] = v; }); } catch (_) { /* */ }
      _finishHostCall(opts, true, {
        statusCode: res.status,
        data: data,
        header: header,
        errMsg: 'request:ok',
      });
    });
  }).catch(function(err) {
    _finishHostCall(opts, false, { errMsg: err && err.message ? err.message : String(err) });
  });
  return null;
}

function _devtoolsFetchDownload(opts) {
  fetch(String(opts && opts.url || '')).then(function(res) {
    if (!res.ok) throw new Error('download status=' + res.status);
    return res.arrayBuffer().then(function(buf) {
      const fs = _api && _api.getFileSystemManager ? _api.getFileSystemManager() : null;
      const root = _api && _api.env ? _api.env.USER_DATA_PATH : '';
      if (!fs || !fs.writeFileSync || !root) throw new Error('downloadFile fetch has no fs');
      const filePath = root + '/fetch_dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.bin';
      fs.writeFileSync(filePath, buf);
      _finishHostCall(opts, true, {
        statusCode: res.status,
        tempFilePath: filePath,
        errMsg: 'downloadFile:ok',
      });
    });
  }).catch(function(err) {
    _finishHostCall(opts, false, { errMsg: err && err.message ? err.message : String(err) });
  });
  return null;
}

function _sanitizeRequestOptions(opts) {
  const out = {
    url: String(opts && opts.url || ''),
    method: String(opts && opts.method || 'GET'),
  };
  if (opts && opts.header) {
    out.header = {};
    for (const k in opts.header) out.header[k] = String(opts.header[k]);
  }
  if (opts && opts.data !== undefined) {
    out.data = typeof opts.data === 'string' || opts.data instanceof ArrayBuffer
      ? opts.data
      : JSON.stringify(opts.data);
  }
  if (opts && opts.responseType) out.responseType = String(opts.responseType);
  if (opts && opts.dataType) out.dataType = String(opts.dataType);
  if (opts && opts.timeout) out.timeout = Number(opts.timeout);
  if (opts && typeof opts.success === 'function') out.success = opts.success;
  if (opts && typeof opts.fail === 'function') {
    out.fail = function(err) {
      const msg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : String(err);
      opts.fail({ errMsg: msg });
    };
  }
  if (opts && typeof opts.complete === 'function') out.complete = opts.complete;
  return out;
}

const platform = {
  createCanvas: _createCanvas,
  createImage: _createImage,

  getSystemInfoSync: () => _api ? _safeCall(() => _api.getSystemInfoSync(), { platform: 'unknown', screenWidth: 375, screenHeight: 667 }) : { platform: 'unknown', screenWidth: 375, screenHeight: 667 },
  getWindowInfo: () => {
    if (_api && _api.getWindowInfo) {
      try {
        const info = _api.getWindowInfo();
        if (info && (info.windowWidth || info.screenWidth) && (info.windowHeight || info.screenHeight)) {
          return info;
        }
      } catch (_) {}
    }
    return _api
      ? _safeCall(() => _api.getSystemInfoSync(), { windowWidth: 375, windowHeight: 667 })
      : { windowWidth: 375, windowHeight: 667 };
  },

  getStorageSync: (key) => _readStorage(key),
  setStorageSync: (key, data) => _writeStorage(key, data),
  removeStorageSync: (key) => _removeStorage(key),

  request: (opts) => {
    if (_isWechatDevtools() && typeof fetch === 'function') {
      return _devtoolsFetchRequest(opts || {});
    }
    if (!_api) return null;
    const clean = _sanitizeRequestOptions(opts || {});
    return _api.request(clean);
  },
  downloadFile: (opts) => {
    if (_isWechatDevtools() && typeof fetch === 'function') {
      return _devtoolsFetchDownload(opts || {});
    }
    if (!_api || !_api.downloadFile) return null;
    const clean = {
      url: String(opts && opts.url || ''),
    };
    if (opts && typeof opts.success === 'function') clean.success = opts.success;
    if (opts && typeof opts.fail === 'function') {
      clean.fail = function(err) {
        const msg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : String(err);
        opts.fail({ errMsg: msg });
      };
    }
    if (opts && typeof opts.complete === 'function') clean.complete = opts.complete;
    if (opts && opts.timeout) clean.timeout = Number(opts.timeout);
    return _api.downloadFile(clean);
  },
  getFileSystemManager: () => _api && _api.getFileSystemManager ? _api.getFileSystemManager() : null,
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

  name: _platformName,
  api: _api,
  hasTouchApi: !!( _api && typeof _api.onTouchStart === 'function'),
};

module.exports = platform;

