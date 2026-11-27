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
      + ' ks=' + (typeof ks)
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

// 快手包才有这个文件。必须早于 runtime：工具若只注入 wx 兼容层，会误判成华为。
try { require('./kuaishou-pack-stamp.js'); } catch (e) { /* 非快手包没有 */ }

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
    || (typeof ks !== 'undefined' && ks)
    || (typeof kwaigame !== 'undefined' && kwaigame)
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

// ====== 复访探测：侧边栏 + 添加到桌面。抖音另探订阅消息 ======
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
  var _plat = _runtime.detectMinigamePlatform();
  if (_plat !== 'douyin' && _plat !== 'kuaishou') return;
  var P = _runtime.getNativePlatformApi && _runtime.getNativePlatformApi();
  if (!P) P = _hostApi();
  if (!P) return;

  function _markSidebarLaunch(info) {
    if (_plat !== 'kuaishou' || !info || typeof GameGlobal === 'undefined') return;
    var from = info.from || '';
    var scene = info.scene || '';
    if (from === 'sidebar_new' || scene === 'sidebar_new' || scene === 'sidebar_miniprogram') {
      GameGlobal.__sidebarSupported = true;
    }
  }

  function _noteShortcutStatus(res) {
    if (typeof GameGlobal === 'undefined') return;
    if (res && typeof res.installed === 'boolean') {
      GameGlobal.__desktopShortcutStatus = { exist: !!res.installed, needUpdate: false };
      return;
    }
    GameGlobal.__desktopShortcutStatus = res && res.status ? res.status : null;
  }

  function _noteFromShortcut(api) {
    if (_plat !== 'kuaishou' || typeof GameGlobal === 'undefined') return;
    var host = api || (typeof ks !== 'undefined' ? ks : P);
    try {
      if (host && typeof host.isLaunchFromShortcut === 'function' && host.isLaunchFromShortcut()) {
        GameGlobal.__launchFromShortcut = true;
        GameGlobal.__desktopShortcutSupported = true;
        GameGlobal.__desktopShortcutStatus = { exist: true, needUpdate: false };
      }
    } catch (e) {}
  }

  try {
    if (typeof P.onShow === 'function') {
      P.onShow(function (res) {
        if (typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = res || {};
        _markSidebarLaunch(res);
        _noteFromShortcut(P);
        if (_plat === 'kuaishou' && typeof GameGlobal !== 'undefined' && GameGlobal.__desktopAddRequested && GameGlobal.__desktopLeftApp) {
          GameGlobal.__desktopShortcutStatus = { exist: true, needUpdate: false };
          GameGlobal.__desktopLeftApp = false;
        }
      });
      if (typeof P.onHide === 'function') {
        P.onHide(function () {
          if (_plat === 'kuaishou' && typeof GameGlobal !== 'undefined' && GameGlobal.__desktopAddRequested) {
            GameGlobal.__desktopLeftApp = true;
          }
        });
      }
    }
    var _launch = typeof P.getLaunchOptionsSync === 'function'
      ? P.getLaunchOptionsSync()
      : null;
    if (_launch && typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = _launch;
    _markSidebarLaunch(_launch);
    _noteFromShortcut(P);
    var _enter = typeof P.getEnterOptionsSync === 'function'
      ? P.getEnterOptionsSync()
      : null;
    if (_enter && typeof GameGlobal !== 'undefined') GameGlobal.__launchInfo = _enter;
    _markSidebarLaunch(_enter);
  } catch (e) {
    _diag('onShow 注册失败:' + e);
  }

  try {
    if (_plat === 'kuaishou') {
      // 备案已过的预览码，checkSliderBarIsAvailable 仍常回 available:false。入口照常展示，跳转失败再把平台原因告诉玩家。
      if (typeof GameGlobal !== 'undefined') GameGlobal.__sidebarSupported = true;
      var _sliderHost = typeof ks !== 'undefined' ? ks : P;
      var _sliderCheck = _sliderHost && (
        _sliderHost.checkSliderBarIsAvailable || _sliderHost.checkSliderBarIsAvaliable
      );
      if (typeof _sliderCheck === 'function') {
        _sliderCheck.call(_sliderHost, {
          success: function (res) {
            var ok = !!(res && (res.available === true || res.available === 1 || res.isExist));
            console.log('[huahua] 侧边栏检测 available=' + ok + ' ' + JSON.stringify(res || {}));
            if (ok && typeof GameGlobal !== 'undefined') GameGlobal.__sidebarSupported = true;
          },
          fail: function (err) {
            console.warn('[huahua] 侧边栏检测失败', err && (err.msg || err.code || err));
          },
        });
      } else {
        console.warn('[huahua] 当前快手没有 checkSliderBarIsAvailable');
      }
    } else if (typeof P.checkScene === 'function') {
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
        success: function (res) { _noteShortcutStatus(res); },
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

_diag('boot tap=' + (typeof tap) + ' ks=' + (typeof ks) + ' wx=' + (typeof wx) + ' tt=' + (typeof tt)
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
// Tap 画布没有苹方 / 雅黑。字体在 fonts 分包，装好再进 bundle，否则第一帧字就是空的。
var _bundleStarted = false;
function _startBundle() {
  if (_bundleStarted) return;
  _bundleStarted = true;
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
}
function _fontHost() {
  if (typeof tap !== 'undefined' && typeof tap.loadFont === 'function') return tap;
  if (typeof wx !== 'undefined' && typeof wx.loadFont === 'function') return wx;
  return null;
}
function _pixelInk(ctx, w, h) {
  try {
    var data = ctx.getImageData(0, 0, w, h).data;
    var n = 0;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] > 16) n++;
    }
    return String(n);
  } catch (e) {
    return 'err';
  }
}
function _probeOffscreen(label, api, fam) {
  if (!api || typeof api.createOffscreenCanvas !== 'function') {
    _diag(label + ' offscreen=no');
    return false;
  }
  var makers = [
    function () { return api.createOffscreenCanvas({ type: '2d', width: 64, height: 64 }); },
    function () { return api.createOffscreenCanvas(64, 64); },
  ];
  var drew = false;
  for (var m = 0; m < makers.length; m++) {
    try {
      var c = makers[m]();
      var screen = typeof GameGlobal !== 'undefined' ? GameGlobal.canvas : null;
      if (!c) {
        _diag(label + '#' + m + ' canvas=null');
        continue;
      }
      if (screen && c === screen) {
        _diag(label + '#' + m + ' same-as-screen');
        continue;
      }
      var ctx = c.getContext && c.getContext('2d');
      if (!ctx || typeof ctx.fillText !== 'function') {
        _diag(label + '#' + m + ' ctx=' + (ctx ? 'no-fillText' : 'null'));
        continue;
      }
      c.width = 64;
      c.height = 64;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 64, 64);
      var rectInk = _pixelInk(ctx, 64, 64);
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = '#000000';
      ctx.font = '32px ' + (fam || 'sans-serif');
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('花', 4, 48);
      var textInk = _pixelInk(ctx, 64, 64);
      _diag(label + '#' + m + ' rect=' + rectInk + ' text=' + textInk + ' fam=' + (fam || 'sans'));
      drew = true;
      if (Number(textInk) > 0 && typeof GameGlobal !== 'undefined' && !GameGlobal.__huahuaTextCanvas) {
        GameGlobal.__huahuaTextCanvas = c;
      }
    } catch (e) {
      _diag(label + '#' + m + ' throw=' + e);
    }
  }
  return drew;
}
function _applyTapFont() {
  var host = _fontHost();
  var fam = '';
  if (!host) {
    _diag('fontApi=none tap=' + (typeof tap !== 'undefined' ? typeof tap.loadFont : 'no-tap')
      + ' wx=' + (typeof wx !== 'undefined' ? typeof wx.loadFont : 'no-wx'));
  } else {
    try {
      fam = host.loadFont('fonts/HuahuaUI.ttf') || '';
      if (fam && typeof GameGlobal !== 'undefined') {
        GameGlobal.__huahuaFontFamily = fam + ',sans-serif';
      }
      var _via = (typeof tap !== 'undefined' && host === tap) ? 'tap' : 'wx';
      _diag('font=' + (fam || 'null') + ' via=' + _via);
    } catch (eFont) {
      _diag('loadFont 失败:' + eFont);
    }
  }
  var tapOff = typeof tap !== 'undefined' ? typeof tap.createOffscreenCanvas : 'no-tap';
  var wxOff = typeof wx !== 'undefined' ? typeof wx.createOffscreenCanvas : 'no-wx';
  _diag('offscreen tap=' + tapOff + ' wx=' + wxOff);
  if (typeof tap !== 'undefined') _probeOffscreen('tap', tap, fam);
  if (typeof wx !== 'undefined' && (typeof tap === 'undefined' || wx !== tap)) _probeOffscreen('wx', wx, fam);
  _loadFontBytes(_startBundle);
}
function _decodeBase64ToU8(raw) {
  if (typeof raw !== 'string' || raw.length < 16) return null;
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var lut = [];
  for (var k = 0; k < 128; k++) lut[k] = -1;
  for (var m = 0; m < chars.length; m++) lut[chars.charCodeAt(m)] = m;
  lut[45] = 62;
  lut[95] = 63;
  var out = new Uint8Array(Math.floor((raw.length * 3) / 4) + 3);
  var o = 0;
  var acc = 0;
  var bits = 0;
  for (var i = 0; i < raw.length; i++) {
    var c = raw.charCodeAt(i);
    if (c === 61) break;
    if (c >= 128) continue;
    var v = lut[c];
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return o > 0 ? out.subarray(0, o) : null;
}
function _coerceFontU8(buf, depth) {
  if (!buf || (depth || 0) > 3) return null;
  if (buf instanceof Uint8Array) return buf;
  if (typeof buf === 'string') return _decodeBase64ToU8(buf);
  if (typeof buf !== 'object') return null;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(buf)) {
    try { return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength); } catch (e0) { /* */ }
  }
  var tag = Object.prototype.toString.call(buf);
  if (
    (typeof ArrayBuffer !== 'undefined' && buf instanceof ArrayBuffer)
    || tag === '[object ArrayBuffer]'
    || tag === '[object SharedArrayBuffer]'
  ) {
    try { return new Uint8Array(buf); } catch (e1) { /* */ }
  }
  if (buf.buffer && typeof buf.buffer.byteLength === 'number') {
    try {
      return typeof buf.byteLength === 'number'
        ? new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength)
        : new Uint8Array(buf.buffer, buf.byteOffset || 0);
    } catch (e2) { /* */ }
  }
  if (buf.data != null && buf.data !== buf) {
    var inner = _coerceFontU8(buf.data, (depth || 0) + 1);
    if (inner && inner.byteLength > 0) return inner;
  }
  if (typeof buf.byteLength === 'number' && buf.byteLength > 0) {
    try {
      var u = new Uint8Array(buf);
      if (u.byteLength === buf.byteLength) return u;
    } catch (e3) { /* */ }
  }
  if (Array.isArray(buf) || (typeof buf.length === 'number' && buf.length > 0)) {
    try { return new Uint8Array(buf); } catch (e4) { /* */ }
  }
  return null;
}
function _hasSfntMagic(u8) {
  if (!u8 || u8.byteLength < 12) return false;
  var b0 = u8[0], b1 = u8[1], b2 = u8[2], b3 = u8[3];
  return (b0 === 0 && b1 === 1 && b2 === 0 && b3 === 0)
    || (b0 === 0x74 && b1 === 0x72 && b2 === 0x75 && b3 === 0x65)
    || (b0 === 0x4f && b1 === 0x54 && b2 === 0x54 && b3 === 0x4f);
}
function _storeFontBytes(buf, via) {
  if (typeof GameGlobal === 'undefined') return false;
  var u8 = _coerceFontU8(buf, 0);
  var len = u8 ? u8.byteLength : 0;
  if (!u8 || len < 1000) {
    var tag = buf == null ? 'null' : Object.prototype.toString.call(buf);
    var rawLen = buf && (buf.byteLength != null ? buf.byteLength : buf.length);
    _diag('fontBytes=' + len + ' rawLen=' + (rawLen != null ? rawLen : 'na') + ' tag=' + tag + ' via=' + via);
    return false;
  }
  if (!_hasSfntMagic(u8)) {
    var hex = ((u8[0] << 24) | (u8[1] << 16) | (u8[2] << 8) | u8[3]) >>> 0;
    _diag('fontBytes bad-magic=' + hex.toString(16) + ' len=' + len + ' via=' + via);
    return false;
  }
  GameGlobal.__huahuaFontBytes = u8;
  _diag('fontBytes=' + len + ' via=' + via);
  return true;
}
function _tryReadFontSync(fs, label, path) {
  if (!fs || typeof fs.readFileSync !== 'function') return false;
  try {
    if (_storeFontBytes(fs.readFileSync(path), label + '-sync')) return true;
  } catch (eSync) {
    _diag(label + ' readFileSync ' + eSync);
  }
  try {
    if (_storeFontBytes(fs.readFileSync(path, 'base64'), label + '-sync-b64')) return true;
  } catch (eB64) {
    _diag(label + ' readFileSync(b64) ' + eB64);
  }
  return false;
}
function _loadFontBytes(done) {
  var tapFs = null;
  var wxFs = null;
  try {
    if (typeof tap !== 'undefined' && typeof tap.getFileSystemManager === 'function') {
      tapFs = tap.getFileSystemManager();
    }
  } catch (eFs1) { /* */ }
  try {
    if (typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function') {
      var candidate = wx.getFileSystemManager();
      if (candidate && candidate !== tapFs) wxFs = candidate;
    }
  } catch (eFs2) { /* */ }
  var fs = tapFs || wxFs;
  if (!fs) {
    _diag('fontFs=none');
    done();
    return;
  }
  var path = 'fonts/HuahuaUI.ttf';
  if (_tryReadFontSync(tapFs, 'tap', path) || _tryReadFontSync(wxFs, 'wx', path)) {
    done();
    return;
  }
  if (typeof fs.readFile !== 'function') {
    _diag('fontBytes=miss');
    done();
    return;
  }
  var finished = false;
  var finish = function () {
    if (finished) return;
    finished = true;
    done();
  };
  var tryAsyncBin = function () {
    try {
      fs.readFile({
        filePath: path,
        success: function (res) {
          _storeFontBytes(res && (res.data != null ? res.data : res), 'async');
          finish();
        },
        fail: function (err) {
          _diag('readFile fail ' + (err && (err.errMsg || err.msg || err)));
          finish();
        },
      });
    } catch (eBin) {
      _diag('readFile throw ' + eBin);
      finish();
    }
  };
  try {
    fs.readFile({
      filePath: path,
      encoding: 'base64',
      success: function (res) {
        if (_storeFontBytes(res && (res.data != null ? res.data : res), 'async-b64')) {
          finish();
          return;
        }
        tryAsyncBin();
      },
      fail: function () {
        tryAsyncBin();
      },
    });
    setTimeout(finish, 1500);
  } catch (eRead) {
    tryAsyncBin();
  }
}
var _isTapBoot = (_runtime && typeof _runtime.detectMinigamePlatform === 'function' && _runtime.detectMinigamePlatform() === 'taptap')
  || typeof tap !== 'undefined'
  || (typeof GameGlobal !== 'undefined' && !!(GameGlobal.__HUAHUA_TAP_VERSION || GameGlobal.__HUAHUA_TAP_PACK));
if (_isTapBoot) {
  var _subHost = (typeof tap !== 'undefined' && typeof tap.loadSubpackage === 'function')
    ? tap
    : ((typeof wx !== 'undefined' && typeof wx.loadSubpackage === 'function') ? wx : null);
  var _fontWait = setTimeout(function () {
    _diag('字体分包超时，直接启动');
    _applyTapFont();
  }, 3000);
  var _fontReady = function () {
    clearTimeout(_fontWait);
    _applyTapFont();
  };
  if (_subHost) {
    _subHost.loadSubpackage({
      name: 'fonts',
      success: _fontReady,
      fail: function (err) {
        _diag('字体分包失败 ' + (err && (err.errMsg || err.msg || err)));
        _fontReady();
      },
    });
  } else {
    _fontReady();
  }
} else {
  _startBundle();
}
