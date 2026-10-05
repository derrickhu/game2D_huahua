/**
 * 小游戏宿主识别与原生 API 绑定（启动期单一真源，逻辑对齐 src/core/platformDetect.ts）
 *
 * - 抖音宿主：注入 tt → 只走 tt（同时存在的 wx 仅是宿主兼容层）
 * - Tap 宿主：注入 tap（无 tt）
 * - 华为快游戏：注入 qg（快应用才是 qa）；也可能再塞 wx 壳，必须先认华为
 * - 微信宿主：注入 wx → 只走 wx
 *
 * 本文件在 game.js 最开头 require，须早于 pixi-adapter 与 game-bundle。
 */

function isHuaweiQuickGameHost() {
  if (typeof qg !== 'undefined') return true;
  if (typeof qa !== 'undefined') return true;
  try {
    if (typeof GameGlobal !== 'undefined' && (GameGlobal.__wx2huawei || GameGlobal.qa || GameGlobal.qg)) return true;
  } catch (_) { /* */ }
  if (typeof wx === 'undefined') return false;
  if (typeof __wxConfig !== 'undefined') return false;
  if (typeof wx.getAccountInfoSync === 'function') return false;
  return true;
}

function detectMinigamePlatform() {
  if (typeof tt !== 'undefined') return 'douyin';
  if (typeof tap !== 'undefined') return 'taptap';
  if (isHuaweiQuickGameHost()) return 'huawei';
  if (typeof wx !== 'undefined') return 'wechat';
  return 'unknown';
}

function getNativePlatformApi(platform) {
  var p = platform || detectMinigamePlatform();
  if (p === 'douyin') return typeof tt !== 'undefined' ? tt : null;
  if (p === 'taptap') return typeof tap !== 'undefined' ? tap : null;
  if (p === 'huawei') {
    if (typeof qg !== 'undefined') return qg;
    if (typeof qa !== 'undefined') return qa;
    return typeof wx !== 'undefined' ? wx : null;
  }
  if (p === 'wechat') return typeof wx !== 'undefined' ? wx : null;
  return null;
}

function _globalObject() {
  return (typeof globalThis !== 'undefined' && globalThis)
    || (typeof GameGlobal !== 'undefined' && GameGlobal)
    || (typeof global !== 'undefined' && global)
    || {};
}

function isUsableCanvas(c) {
  if (!c || typeof c.getContext !== 'function') return false;
  // 量字假画布也有 getContext，但拿不到 WebGL，绝不能当主屏交给 Pixi
  if (c.__huahuaMeasure || c.__tapTextWrap) return false;
  return true;
}

function _rememberHostDocument(g) {
  if (g.__hostDocument) return g.__hostDocument;
  var doc = null;
  try { if (typeof document !== 'undefined') doc = document; } catch (_) { /* */ }
  if (!doc) {
    try { doc = g.document || null; } catch (_) { doc = null; }
  }
  if (doc) {
    try { g.__hostDocument = doc; } catch (_) { /* */ }
  }
  return doc;
}

function _tryCanvas(label, value, acc) {
  if (acc.found || !isUsableCanvas(value)) return;
  acc.found = value;
  acc.src = label;
}

function captureHostTransports() {
  var g = _globalObject();
  try {
    if (typeof XMLHttpRequest === 'function' && !g.__hostXMLHttpRequest) {
      g.__hostXMLHttpRequest = XMLHttpRequest;
    }
  } catch (_) { /* */ }
  try {
    if (typeof fetch === 'function' && !g.__hostFetch) {
      g.__hostFetch = fetch.bind(g);
    }
  } catch (_) { /* */ }
  try {
    if (!g.__hostLocalStorage && typeof localStorage !== 'undefined'
      && localStorage && typeof localStorage.getItem === 'function') {
      g.__hostLocalStorage = localStorage;
    }
  } catch (_) { /* */ }
}

function _rememberHostCanvasRect(g, cv) {
  if (detectMinigamePlatform() !== 'huawei') return;
  if (!cv || typeof cv.getBoundingClientRect !== 'function') return;
  var native = cv.getBoundingClientRect.bind(cv);
  var probe = null;
  try { probe = native(); } catch (_) { return; }
  if (!probe || !(Number(probe.width) > 0) || !(Number(probe.height) > 0)) return;
  try { g.__hostCanvasRect = native; } catch (_) { /* */ }
}

function captureHostCanvas() {
  captureHostTransports();
  var g = _globalObject();
  if (isUsableCanvas(g.__hostCanvas)) return g.__hostCanvas;

  var acc = { found: null, src: 'none' };
  _rememberHostDocument(g);

  try { if (typeof canvas !== 'undefined') _tryCanvas('id:canvas', canvas, acc); } catch (_) { /* */ }
  try { _tryCanvas('g.canvas', g.canvas, acc); } catch (_) { /* */ }
  try { if (typeof screencanvas !== 'undefined') _tryCanvas('id:screencanvas', screencanvas, acc); } catch (_) { /* */ }
  try { _tryCanvas('g.screencanvas', g.screencanvas, acc); } catch (_) { /* */ }

  var hostDoc = g.__hostDocument;
  if (!acc.found && hostDoc) {
    if (typeof hostDoc.getElementById === 'function') {
      try { _tryCanvas('getElementById', hostDoc.getElementById('canvas'), acc); } catch (_) { /* */ }
    }
    if (!acc.found && typeof hostDoc.querySelector === 'function') {
      try { _tryCanvas('querySelector', hostDoc.querySelector('canvas'), acc); } catch (_) { /* */ }
    }
  }

  if (!acc.found) {
    var apis = [];
    // 不要在这里调 tap.createCanvas。主屏只能由 adapter 的第一次 createCanvas 认领，
    // 提前调用会把主屏用掉，后面再开的才是真正上屏的那块。
    try { if (typeof qg !== 'undefined' && qg) apis.push(['qg', qg]); } catch (_) { /* */ }
    try { if (typeof qa !== 'undefined' && qa) apis.push(['qa', qa]); } catch (_) { /* */ }
    for (var i = 0; i < apis.length; i++) {
      var api = apis[i][1];
      if (typeof api.createCanvas !== 'function') continue;
      try { _tryCanvas(apis[i][0] + '.createCanvas', api.createCanvas(), acc); } catch (_) { /* */ }
      if (acc.found) break;
    }
  }

  if (!acc.found && hostDoc && typeof hostDoc.createElement === 'function') {
    try { _tryCanvas('createElement', hostDoc.createElement('canvas'), acc); } catch (_) { /* */ }
  }

  try { g.__hostCanvasSrc = acc.src; } catch (_) { /* */ }
  if (acc.found) {
    try { g.__hostCanvas = acc.found; } catch (_) { /* */ }
    _rememberHostCanvasRect(g, acc.found);
    try {
      if (!isUsableCanvas(g.canvas)) g.canvas = acc.found;
    } catch (_) { /* */ }
    try {
      if (typeof GameGlobal !== 'undefined' && GameGlobal && !isUsableCanvas(GameGlobal.canvas)) {
        GameGlobal.canvas = acc.found;
      }
    } catch (_) { /* */ }
  }
  return acc.found;
}

function _isAdapterDocument(doc) {
  return !!(doc && doc.__huahuaAdapterDoc);
}

function _hostCreateElementCanvas() {
  var g = _globalObject();
  var hostDoc = g.__hostDocument;
  if (!hostDoc || _isAdapterDocument(hostDoc) || typeof hostDoc.createElement !== 'function') return null;
  try {
    var el = hostDoc.createElement('canvas');
    if (isUsableCanvas(el)) return el;
  } catch (_) { /* */ }
  return null;
}

function createHuaweiCanvas() {
  var g = _globalObject();
  var main = isUsableCanvas(g.__hostCanvas) ? g.__hostCanvas : captureHostCanvas();
  if (!g.__huaweiMainIssued && isUsableCanvas(main)) {
    try { g.__huaweiMainIssued = true; } catch (_) { /* */ }
    return main;
  }
  if (typeof qg !== 'undefined' && typeof qg.createCanvas === 'function' && !qg.__huahuaCanvasShim) {
    try {
      var off = qg.createCanvas();
      if (isUsableCanvas(off)) return off;
    } catch (_) { /* */ }
  }
  var created = _hostCreateElementCanvas();
  if (created) return created;
  return null;
}

function createHuaweiOffscreenCanvas() {
  var g = _globalObject();
  var main = g.__hostCanvas || g.canvas;
  if (typeof qg !== 'undefined' && typeof qg.createCanvas === 'function' && !qg.__huahuaCanvasShim) {
    try {
      var off = qg.createCanvas();
      if (isUsableCanvas(off) && off !== main) return off;
    } catch (_) { /* */ }
  }
  for (var n = 0; n < 2; n++) {
    var el = _hostCreateElementCanvas();
    if (!el || el === main) continue;
    try {
      if (!el.width) el.width = 64;
      if (!el.height) el.height = 64;
    } catch (_) { /* */ }
    return el;
  }
  return null;
}

/** 华为原生 qg 没有 createCanvas。Pixi / 旧代码仍会调 qg.createCanvas，不补就会直接白屏。 */
function installHuaweiCreateCanvasShim() {
  var apis = [];
  try { if (typeof qg !== 'undefined' && qg) apis.push(qg); } catch (_) { /* */ }
  try { if (typeof qa !== 'undefined' && qa) apis.push(qa); } catch (_) { /* */ }
  for (var i = 0; i < apis.length; i++) {
    var api = apis[i];
    if (typeof api.createCanvas === 'function' && !api.__huahuaCanvasShim) continue;
    try {
      api.createCanvas = function () {
        return createHuaweiCanvas() || createHuaweiOffscreenCanvas() || {
          width: 1,
          height: 1,
          style: {},
          getContext: function () { return null; },
        };
      };
      api.__huahuaCanvasShim = true;
    } catch (_) { /* */ }
  }
}

function createHuaweiImage() {
  var g = _globalObject();
  if (typeof qg !== 'undefined' && typeof qg.createImage === 'function') {
    try {
      var img = qg.createImage();
      if (img) return img;
    } catch (_) { /* */ }
  }
  var hostDoc = g.__hostDocument || _rememberHostDocument(g);
  if (hostDoc && typeof hostDoc.createElement === 'function') {
    try {
      var el = hostDoc.createElement('img') || hostDoc.createElement('image');
      if (el) return el;
    } catch (_) { /* */ }
  }
  try { if (typeof Image !== 'undefined') return new Image(); } catch (_) { /* */ }
  return { src: '', onload: null, onerror: null };
}

function listHostCanvasHints() {
  var parts = [];
  try { parts.push('idCanvas=' + (typeof canvas)); } catch (_) { parts.push('idCanvas=unref'); }
  try { parts.push('screencanvas=' + (typeof screencanvas)); } catch (_) { parts.push('screencanvas=unref'); }
  try {
    var g = _globalObject();
    parts.push('gCanvas=' + (g.canvas ? 'obj' : typeof g.canvas));
    parts.push('hostSrc=' + (g.__hostCanvasSrc || 'none'));
  } catch (_) { /* */ }
  try {
    if (typeof qg !== 'undefined' && qg) {
      var names = [
        'createCanvas', 'createImage', 'createOffscreenCanvas',
        'getSystemInfoSync', 'getSystemInfo', 'getDeviceInfo',
        'showToast', 'showModal', 'showDialog', 'onError',
        'onShow', 'onHide', 'onTouchStart', 'createInnerAudioContext',
        'setStorageSync', 'getStorageSync', 'setStorage', 'getStorage',
        'request', 'downloadFile', 'download', 'loadSubpackage', 'getFileSystemManager',
        'fetch', 'gameLoginWithReal', 'gameLogin', 'getCachePlayerId',
      ];
      var present = [];
      for (var i = 0; i < names.length; i++) {
        if (typeof qg[names[i]] === 'function') present.push(names[i]);
      }
      parts.push('qgFn=' + (present.join(',') || 'none'));
    }
  } catch (_) { /* */ }
  return parts.join(' ');
}

function canUsePrivacyApi(api, name) {
  if (!api) return false;
  if (typeof api.canIUse === 'function') {
    try { return !!api.canIUse(name); } catch (_) { /* 部分基础库 canIUse 会抛 */ }
  }
  return typeof api[name] === 'function';
}

function makePrivacyFallback(name) {
  return function (opts) {
    opts = opts || {};
    var res = {
      needAuthorization: false,
      privacyContractName: '',
      errMsg: name + ':ok (fallback)',
    };
    if (typeof opts.success === 'function') opts.success(res);
    if (typeof opts.complete === 'function') opts.complete(res);
  };
}

function initDouyinPrivacyBootstrap() {
  if (detectMinigamePlatform() !== 'douyin' || typeof tt === 'undefined') return;

  var privacyNames = [
    'getPrivacySetting',
    'requirePrivacyAuthorize',
    'openPrivacyContract',
    'onNeedPrivacyAuthorization',
  ];

  if (!canUsePrivacyApi(tt, 'getPrivacySetting')) {
    console.warn(
      '[Privacy] tt.getPrivacySetting 未注册。处理顺序：'
      + '①抖音开放平台→设置→基础设置→小游戏隐私政策 填写并发布；'
      + '②开发者工具升级到 4.2.3+ 并用真机扫码验证（工具内常报 unregistered）。',
    );
  }

  if (typeof wx === 'undefined') return;

  privacyNames.forEach(function (name) {
    if (name === 'onNeedPrivacyAuthorization') {
      if (typeof tt[name] === 'function') {
        wx[name] = function (cb) { return tt[name](cb); };
      }
      return;
    }
    if (canUsePrivacyApi(tt, name)) {
      wx[name] = function (opts) { return tt[name](opts); };
      return;
    }
    wx[name] = makePrivacyFallback(name);
  });
}

initDouyinPrivacyBootstrap();

var __runtimeApi = {
  detectMinigamePlatform: detectMinigamePlatform,
  getNativePlatformApi: getNativePlatformApi,
  isUsableCanvas: isUsableCanvas,
  captureHostCanvas: captureHostCanvas,
  captureHostTransports: captureHostTransports,
  createHuaweiCanvas: createHuaweiCanvas,
  createHuaweiOffscreenCanvas: createHuaweiOffscreenCanvas,
  createHuaweiImage: createHuaweiImage,
  installHuaweiCreateCanvasShim: installHuaweiCreateCanvasShim,
  listHostCanvasHints: listHostCanvasHints,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = __runtimeApi;
}
try {
  var g = (typeof globalThis !== 'undefined' && globalThis)
    || (typeof GameGlobal !== 'undefined' && GameGlobal);
  if (g) g.__huahuaRuntime = __runtimeApi;
} catch (_) { /* */ }
try {
  if (detectMinigamePlatform() === 'huawei') installHuaweiCreateCanvasShim();
} catch (_) { /* */ }

