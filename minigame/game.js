// 任何 require 之前先打点。华为助手控制台经常是空的，错误另走 qg.onError + 弹窗。
(function () {
  try {
    if (typeof globalThis !== 'undefined' && typeof require === 'function' && !globalThis.require) {
      globalThis.require = require;
    }
  } catch (eReq) {}
  try { console.log('[boot] game.js entered'); } catch (e0) {}
  try {
    console.log('[boot] hosts qg=' + (typeof qg)
      + ' qa=' + (typeof qa)
      + ' tap=' + (typeof tap)
      + ' wx=' + (typeof wx)
      + ' tt=' + (typeof tt)
      + ' GameGlobal=' + (typeof GameGlobal)
      + ' require=' + (typeof require));
  } catch (e1) {}
  try {
    if (typeof qg !== 'undefined' && typeof qg.onError === 'function') {
      qg.onError(function (res) {
        try { console.error('[boot] qg.onError', res && (res.message || res.errMsg || res)); } catch (e2) {}
      });
    }
  } catch (e4) {}
})();

// Tap / 华为真机没有 eval 绑定；Function() 内部会去找 eval，一加载 bundle 就
// ReferenceError: Can't find variable: eval。必须在 require bundle 之前挂上。
// 华为原生快游戏未必注入 GameGlobal，先把全局对象挂成 GameGlobal。
(function () {
  var g = (typeof globalThis !== 'undefined' && globalThis)
    || (typeof global !== 'undefined' && global)
    || (typeof GameGlobal !== 'undefined' && GameGlobal);
  if (!g) return;
  try { g.GameGlobal = g; } catch (e0) {}
  try { GameGlobal = g; } catch (e1) {}
  var evalFn = function () { return void 0; };
  if (typeof g.eval !== 'function') {
    try {
      Object.defineProperty(g, 'eval', { value: evalFn, writable: true, configurable: true });
    } catch (e1) {
      try { g.eval = evalFn; } catch (e2) {}
    }
  }
  if (typeof GameGlobal !== 'undefined' && typeof GameGlobal.eval !== 'function') {
    try { GameGlobal.eval = g.eval; } catch (e3) {}
  }
})();

// 最早加载：宿主识别 + 原生 API 绑定（须早于 pixi-adapter 与 bundle）
var _runtime = null;
try {
  _runtime = require('./runtime.js');
} catch (e) {
  try { console.error('[boot] runtime.js 失败', e); } catch (_) {}
  throw e;
}
if (!_runtime) {
  try {
    _runtime = (typeof globalThis !== 'undefined' && globalThis.__huahuaRuntime)
      || (typeof GameGlobal !== 'undefined' && GameGlobal.__huahuaRuntime)
      || null;
  } catch (_) { _runtime = null; }
}
if (!_runtime) {
  try { console.error('[boot] runtime.js 无导出'); } catch (_) {}
}

// ====== 启动诊断（仅启动失败时弹窗）======
var _diagMsgs = [];
var _diagStart = Date.now();
function _hostApi() {
  var api = _runtime && _runtime.getNativePlatformApi && _runtime.getNativePlatformApi();
  if (api) return api;
  return (typeof tap !== 'undefined' && tap)
    || (typeof qg !== 'undefined' && qg)
    || (typeof qa !== 'undefined' && qa)
    || (typeof wx !== 'undefined' && wx)
    || (typeof tt !== 'undefined' && tt)
    || null;
}
function _diag(msg) {
  var ts = Date.now() - _diagStart;
  var line = '[' + ts + 'ms] ' + msg;
  _diagMsgs.push(line);
  try { console.log('[boot] ' + line); } catch (_) {}
  try {
    var api = _hostApi();
    if (api && typeof api.setStorageSync === 'function') {
      api.setStorageSync('huahua_boot_diag', _diagMsgs.join('\n'));
    }
  } catch (_) {}
}

function _errText(err) {
  try {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    return String(err.message || err.errMsg || err);
  } catch (_) {
    return '';
  }
}

/** 微信开发者工具基础库 3.x：request/downloadFile 过桥的误报，不是启动失败。 */
function _isCloneNoise(err) {
  return _errText(err).indexOf('could not be cloned') >= 0;
}

var _cloneNoiseNoted = false;
function _noteCloneNoise(via) {
  if (_cloneNoiseNoted) return;
  _cloneNoiseNoted = true;
  try {
    console.warn('[boot] 忽略微信开发者工具误报 An object could not be cloned（' + via + '），游戏继续');
  } catch (_) {}
}

function _showDiag() {
  var dump = _diagMsgs.join('\n');
  try { console.error('[boot-diag]\n' + dump); } catch (_) {}
  try {
    var api = _hostApi();
    if (!api) return;
    var tail = _diagMsgs.length > 28 ? _diagMsgs.slice(-28) : _diagMsgs.slice();
    var content = tail.join('\n');
    if (typeof api.showModal === 'function') {
      api.showModal({ title: '启动诊断', content: content, showCancel: false });
      return;
    }
    if (typeof api.showDialog === 'function') {
      api.showDialog({ title: '启动诊断', message: content, buttons: [{ text: '确定' }] });
      return;
    }
    if (typeof api.showToast === 'function') {
      try { api.showToast({ title: content.slice(0, 80), icon: 'none', duration: 8000 }); return; } catch (_) {}
      try { api.showToast({ message: content.slice(0, 120), duration: 8000 }); } catch (_) {}
    }
  } catch (_) {}
}

function _dumpRecentXhr(reason) {
  try {
    var g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : null);
    var logs = g && g.__xhrDebugLogs;
    if (!logs || !logs.length) return;
    var start = Math.max(0, logs.length - 30);
    console.warn('[XHR-DUMP]', reason, 'recent=' + (logs.length - start) + '/' + logs.length);
    for (var i = start; i < logs.length; i++) console.warn(logs[i]);
  } catch (_) {}
}

try {
  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.__bootDiag = _diag;
    GameGlobal.__showBootDiag = _showDiag;
    GameGlobal.onError = function (msg) {
      if (_isCloneNoise(msg)) {
        _noteCloneNoise('onError');
        return;
      }
      _diag('onError:' + msg);
      _dumpRecentXhr('onError');
      _showDiag();
    };
    GameGlobal.onUnhandledRejection = function (ev) {
      var reason = ev && ev.reason;
      if (_isCloneNoise(reason) || _isCloneNoise(reason && reason.message)) {
        _noteCloneNoise('unhandledRej');
        return;
      }
      _diag('unhandledRej:' + (reason || ev));
      _dumpRecentXhr('onUnhandledRejection');
      _showDiag();
    };
  }
} catch (_) {}
try {
  var _errApi = _hostApi();
  if (_errApi && typeof _errApi.onError === 'function') {
    _errApi.onError(function (err) {
      if (_isCloneNoise(err)) {
        _noteCloneNoise('host.onError');
        return;
      }
      _diag('host.onError:' + _errText(err));
      _showDiag();
    });
  }
} catch (_) {}

// ====== 抖音必接能力探测：侧边栏复访 + 添加到桌面 + 订阅消息 ======
// onShow 首次回调可能早于 bundle 执行，必须在这里就接住启动参数。
(function () {
  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.__launchInfo = {};
    GameGlobal.__sidebarSupported = false;
    GameGlobal.__desktopShortcutSupported = false;
    GameGlobal.__desktopShortcutStatus = null;
    GameGlobal.__subscribeMessageSupported = false;
  }
  if (!_runtime || typeof _runtime.detectMinigamePlatform !== 'function') return;
  if (_runtime.detectMinigamePlatform() !== 'douyin') return;
  var P = _runtime.getNativePlatformApi && _runtime.getNativePlatformApi();
  if (!P) P = _hostApi();
  if (!P) return;

  try {
    if (typeof P.onShow === 'function') {
      P.onShow(function (res) {
        if (typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = res || {};
      });
    }
    var _launch = typeof P.getLaunchOptionsSync === 'function'
      ? P.getLaunchOptionsSync()
      : null;
    if (_launch && typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = _launch;
    var _enter = typeof P.getEnterOptionsSync === 'function'
      ? P.getEnterOptionsSync()
      : null;
    if (_enter && typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = _enter;
  } catch (e) {
    _diag('onShow 注册失败:' + e);
  }

  try {
    if (typeof P.checkScene === 'function') {
      P.checkScene({
        scene: 'sidebar',
        success: function (res) {
          if (typeof GameGlobal !== 'undefined') GameGlobal.__sidebarSupported = !!(res && res.isExist);
        },
        fail: function () {
          if (typeof GameGlobal !== 'undefined') GameGlobal.__sidebarSupported = false;
        },
      });
    }
  } catch (_) {}

  try {
    if (typeof P.addShortcut === 'function' && typeof GameGlobal !== 'undefined') {
      GameGlobal.__desktopShortcutSupported = true;
    }
    if (typeof P.checkShortcut === 'function') {
      P.checkShortcut({
        success: function (res) {
          if (typeof GameGlobal !== 'undefined') {
            GameGlobal.__desktopShortcutStatus = res && res.status ? res.status : null;
          }
        },
        fail: function () {},
      });
    }
  } catch (_) {}

  // 订阅消息：只 canIUse 探测。不要写宿主点号调用，鸿蒙适配扫描会判不适配。
  // 运行期不调起授权、不发信、无 UI。抖音上传扫描用的点号调用在 build/douyin 组装时注入。
  try {
    if (typeof tt !== 'undefined' && typeof tt.canIUse === 'function') {
      var _subOk = false;
      try { _subOk = !!tt.canIUse('requestSubscribeMessage'); } catch (_) {}
      if (typeof GameGlobal !== 'undefined') GameGlobal.__subscribeMessageSupported = _subOk;
    }
  } catch (_) {}
})();

try {
  if (_runtime && typeof _runtime.captureHostCanvas === 'function') {
    var _hostCv = _runtime.captureHostCanvas();
    _diag((_runtime.listHostCanvasHints ? _runtime.listHostCanvasHints() : 'no-hints')
      + ' captured=' + (_hostCv ? 'yes' : 'no'));
  }
  if (_runtime && typeof _runtime.installHuaweiCreateCanvasShim === 'function') {
    _runtime.installHuaweiCreateCanvasShim();
  }
} catch (eCap) {
  _diag('captureHostCanvas 失败:' + eCap);
}

try {
  require('./pixi-adapter/index');
  var _cv = typeof GameGlobal !== 'undefined' ? GameGlobal.canvas : null;
  if ((!_cv || typeof _cv.getContext !== 'function') && typeof GameGlobal !== 'undefined' && GameGlobal.__hostCanvas) {
    _cv = GameGlobal.__hostCanvas;
    try { GameGlobal.canvas = _cv; } catch (_) {}
  }
  var _doc = typeof document !== 'undefined' ? document : (GameGlobal && GameGlobal.document);
  _diag('cv=' + (_cv ? ((_cv.width || 0) + 'x' + (_cv.height || 0) + ' getContext=' + (typeof _cv.getContext)) : 'none')
    + ' createCanvas=' + (typeof tap !== 'undefined' ? typeof tap.createCanvas
      : (typeof qg !== 'undefined' ? typeof qg.createCanvas
        : (typeof qa !== 'undefined' ? typeof qa.createCanvas : 'no-host')))
    + ' rAF=' + (typeof requestAnimationFrame)
    + ' createElement=' + (_doc ? typeof _doc.createElement : 'no-doc')
    + ' hostSrc=' + (typeof GameGlobal !== 'undefined' ? GameGlobal.__hostCanvasSrc : '?'));
} catch (e) {
  _diag('pixi-adapter 失败:' + e);
  _showDiag();
}

// 鸿蒙 V8 不含 ICU，Intl 不存在时 PixiJS graphemeSegmenter 会 ReferenceError
if (typeof Intl === 'undefined') {
  var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : {});
  _g.Intl = {};
}

_diag('boot tap=' + (typeof tap) + ' wx=' + (typeof wx) + ' tt=' + (typeof tt)
  + ' qg=' + (typeof qg) + ' qa=' + (typeof qa)
  + ' plat=' + (_runtime && _runtime.detectMinigamePlatform ? _runtime.detectMinigamePlatform() : '?'));
try { require('./tap-pack-stamp.js'); } catch (e) { /* 非 Tap 包没有 */ }
try { require('./huawei-pack-stamp.js'); } catch (e) { /* 非华为包没有 */ }
try {
  var _pack = typeof GameGlobal !== 'undefined'
    ? (GameGlobal.__HUAHUA_TAP_VERSION || GameGlobal.__HUAHUA_TAP_PACK || GameGlobal.__HUAHUA_HUAWEI_VERSION)
    : null;
  if (_pack) _diag('pack=' + _pack);
} catch (e) { /* */ }
// 宿主 URL 在 base 不是字符串时直接抛，bundle 里的 new URL 会把启动打断。
try {
  var _urlHost = typeof globalThis !== 'undefined' ? globalThis : GameGlobal;
  var _NativeURL = _urlHost && _urlHost.URL;
  if (typeof _NativeURL === 'function' && !_NativeURL.__huahuaSafe) {
    var _urlFallback = 'https://taptap.local/';
    var _SafeURL = function URL(url, base) {
      var u = typeof url === 'string' ? url : '';
      var b = (typeof base === 'string' && base) ? base : _urlFallback;
      try { return new _NativeURL(u, b); } catch (e1) {
        return new _NativeURL(_urlFallback);
      }
    };
    _SafeURL.prototype = _NativeURL.prototype;
    _SafeURL.__huahuaSafe = true;
    try { if (_NativeURL.createObjectURL) _SafeURL.createObjectURL = _NativeURL.createObjectURL.bind(_NativeURL); } catch (e2) { /* */ }
    try { if (_NativeURL.revokeObjectURL) _SafeURL.revokeObjectURL = _NativeURL.revokeObjectURL.bind(_NativeURL); } catch (e3) { /* */ }
    _urlHost.URL = _SafeURL;
  }
  var _docForUrl = typeof document !== 'undefined' ? document : null;
  if (_docForUrl && typeof _docForUrl.baseURI !== 'string') {
    _docForUrl.baseURI = 'https://taptap.local/game-bundle.js';
  }
} catch (eUrl) { /* URL 补丁失败不挡启动 */ }
try {
  require('./game-bundle.js');
} catch (e) {
  _diag('game-bundle 失败:' + e);
  _showDiag();
}

setTimeout(function () {
  if (typeof GameGlobal !== 'undefined' && !GameGlobal.__bootOk) {
    _diag('6秒未进主场景 step=' + (GameGlobal.__bootStep || '?')
      + ' rendered=' + GameGlobal.__gameRendered);
    _showDiag();
  }
}, 6000);
