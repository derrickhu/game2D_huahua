/**
 * 微信小游戏适配器 — 为 Phaser 3 提供 BOM/DOM 模拟
 * 
 * 核心原则：
 * 1. 只用一个 canvas，确保全局引用一致
 * 2. getBoundingClientRect 返回值与游戏设计分辨率匹配
 * 3. 触摸事件只派发到 canvas（Phaser 注册的目标），不重复派发到 window
 */

// ============================================================
// 1. 基础环境
// ============================================================
var systemInfo = wx.getSystemInfoSync();
var screenWidth = systemInfo.windowWidth;
var screenHeight = systemInfo.windowHeight;
var dpr = systemInfo.pixelRatio;

// 创建主 canvas
var canvas = wx.createCanvas();

// 安全属性设置
function safeSet(obj, name, value) {
  try {
    obj[name] = value;
    if (obj[name] !== value) throw new Error('set failed');
  } catch (e) {
    try {
      Object.defineProperty(obj, name, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e2) { /* 无法设置 */ }
  }
}

function safeDefineGetter(obj, name, getter) {
  try {
    Object.defineProperty(obj, name, {
      get: getter,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    try { obj[name] = getter(); } catch (e2) { /* skip */ }
  }
}

// ============================================================
// 2. window / global
// ============================================================
if (typeof window === 'undefined') {
  GameGlobal.window = GameGlobal;
}
var _window = typeof window !== 'undefined' ? window : GameGlobal;

safeSet(_window, 'innerWidth', screenWidth);
safeSet(_window, 'innerHeight', screenHeight);
safeSet(_window, 'devicePixelRatio', dpr);
safeSet(_window, 'screenWidth', systemInfo.screenWidth);
safeSet(_window, 'screenHeight', systemInfo.screenHeight);

// Phaser 检查 'ontouchstart' in window
safeSet(_window, 'ontouchstart', null);
safeSet(_window, 'ontouchmove', null);
safeSet(_window, 'ontouchend', null);
safeSet(_window, 'ontouchcancel', null);
safeSet(_window, 'onwheel', null);
safeSet(_window, 'onclick', null);

// ============================================================
// 3. 事件系统（统一管理 canvas 和 window 的监听器）
// ============================================================
var _listenerStore = new Map();

function getListenerMap(obj) {
  var m = _listenerStore.get(obj);
  if (!m) { m = {}; _listenerStore.set(obj, m); }
  return m;
}

function addEventListener(obj, type, fn, options) {
  if (!type || !fn) return;
  var map = getListenerMap(obj);
  if (!map[type]) map[type] = [];
  if (map[type].indexOf(fn) === -1) {
    map[type].push(fn);
  }
}

function removeEventListener(obj, type, fn) {
  var map = getListenerMap(obj);
  if (!map[type]) return;
  var idx = map[type].indexOf(fn);
  if (idx > -1) map[type].splice(idx, 1);
}

function dispatchEvent(obj, event) {
  var map = getListenerMap(obj);
  var arr = map[event.type];
  if (!arr) return;
  var copy = arr.slice();
  for (var i = 0; i < copy.length; i++) {
    try { copy[i].call(obj, event); } catch (e) {
      console.error('[adapter] event callback error:', event.type, e);
    }
  }
}

// canvas 事件方法
canvas.addEventListener = function(type, fn, options) {
  addEventListener(canvas, type, fn, options);
};
canvas.removeEventListener = function(type, fn, options) {
  removeEventListener(canvas, type, fn);
};
canvas.dispatchEvent = function(event) {
  dispatchEvent(canvas, event);
};

// window 事件方法
_window.addEventListener = function(type, fn, options) {
  addEventListener(_window, type, fn, options);
};
_window.removeEventListener = function(type, fn, options) {
  removeEventListener(_window, type, fn);
};
_window.dispatchEvent = function(event) {
  dispatchEvent(_window, event);
};

safeSet(_window, 'top', _window);

// ============================================================
// 4. Canvas 适配
// ============================================================
// 核心思路：游戏分辨率的宽高比 === 屏幕宽高比
// GameConfig 中已设 width=750, height=750*(screenH/screenW)
// 微信全屏渲染 canvas，因为比例一致所以不会变形
// getBoundingClientRect 返回屏幕逻辑像素尺寸
// Phaser displayScale = gameWidth/screenWidth (X和Y相同) → 触摸坐标正确
canvas.getBoundingClientRect = function() {
  return {
    x: 0, y: 0, top: 0, left: 0,
    right: screenWidth, bottom: screenHeight,
    width: screenWidth, height: screenHeight
  };
};

if (!canvas.style) {
  canvas.style = { width: screenWidth + 'px', height: screenHeight + 'px', cursor: 'default' };
}
if (!canvas.setAttribute) canvas.setAttribute = function() {};
if (!canvas.getAttribute) {
  canvas.getAttribute = function(name) {
    if (name === 'width') return canvas.width;
    if (name === 'height') return canvas.height;
    return null;
  };
}
if (!canvas.classList) canvas.classList = { add: function(){}, remove: function(){} };
if (!canvas.focus) canvas.focus = function() {};

// clientWidth/clientHeight 返回屏幕逻辑像素尺寸
try {
  Object.defineProperty(canvas, 'clientWidth', { get: function() { return screenWidth; }, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { get: function() { return screenHeight; }, configurable: true });
} catch(e) {}

// ============================================================
// 5. 将 canvas 暴露到全局（确保引用一致性）
// ============================================================
// 微信小游戏的 GameGlobal.canvas 通常是第一个 createCanvas() 的结果
// 这里额外用 __wxCanvas 作为备用引用
GameGlobal.__wxCanvas = canvas;
safeSet(GameGlobal, 'canvas', canvas);
safeSet(_window, 'canvas', canvas);

// 验证引用一致性
var _canvasOK = (GameGlobal.canvas === canvas);
console.log('[adapter] canvas引用一致:', _canvasOK);
if (!_canvasOK) {
  // GameGlobal.canvas 是只读的，但可能就是我们的 canvas（第一个创建的）
  // 微信小游戏中，第一个 createCanvas 自动成为 GameGlobal.canvas
  console.log('[adapter] GameGlobal.canvas:', typeof GameGlobal.canvas);
  // 用 GameGlobal.canvas 替代我们的 canvas 引用
  if (GameGlobal.canvas && GameGlobal.canvas.getContext) {
    console.log('[adapter] 使用 GameGlobal.canvas 作为主 canvas');
    // 实际上在微信小游戏中，第一个 createCanvas() 返回的就是 GameGlobal.canvas
    // 它们应该是同一个对象，只是 === 检查可能因为 getter 的原因失败
    // 我们把适配方法也加到 GameGlobal.canvas 上
    var gc = GameGlobal.canvas;
    if (gc !== canvas) {
      gc.getBoundingClientRect = canvas.getBoundingClientRect;
      gc.addEventListener = canvas.addEventListener;
      gc.removeEventListener = canvas.removeEventListener;
      gc.dispatchEvent = canvas.dispatchEvent;
      gc.style = canvas.style;
      gc.setAttribute = canvas.setAttribute;
      gc.getAttribute = canvas.getAttribute;
      gc.classList = canvas.classList;
      gc.focus = canvas.focus || function() {};
      try {
        Object.defineProperty(gc, 'clientWidth', { get: function() { return screenWidth; }, configurable: true });
        Object.defineProperty(gc, 'clientHeight', { get: function() { return screenHeight; }, configurable: true });
      } catch(e) {}
      // 更新 canvas 引用为 GameGlobal.canvas
      canvas = gc;
      GameGlobal.__wxCanvas = gc;
      // 重新绑定事件方法到正确的 canvas
      canvas.addEventListener = function(type, fn, options) { addEventListener(canvas, type, fn, options); };
      canvas.removeEventListener = function(type, fn) { removeEventListener(canvas, type, fn); };
      canvas.dispatchEvent = function(event) { dispatchEvent(canvas, event); };
    }
  }
}

// parentNode/parentElement（可能是只读 getter，用 defineProperty 覆盖）
try { canvas.parentNode = null; } catch(e) {
  Object.defineProperty(canvas, 'parentNode', { configurable: true, writable: true, value: null });
}
try { canvas.parentElement = null; } catch(e) {
  Object.defineProperty(canvas, 'parentElement', { configurable: true, writable: true, value: null });
}

// ============================================================
// 6. performance
// ============================================================
if (!_window.performance) {
  safeSet(_window, 'performance', { now: function() { return Date.now(); } });
}

// ============================================================
// 7. requestAnimationFrame / cancelAnimationFrame
// ============================================================
var _raf = _window.requestAnimationFrame;
if (!_raf) {
  safeSet(_window, 'requestAnimationFrame', function(cb) {
    return canvas.requestAnimationFrame(cb);
  });
}
var _caf = _window.cancelAnimationFrame;
if (!_caf) {
  safeSet(_window, 'cancelAnimationFrame', function(id) {
    return canvas.cancelAnimationFrame(id);
  });
}

// ============================================================
// 8. navigator
// ============================================================
var _nav = (typeof navigator !== 'undefined') ? navigator : {};
if (!_window.navigator) safeSet(_window, 'navigator', _nav);
var navProps = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) WeChatMiniGame',
  language: 'zh-CN', platform: 'iPhone', appVersion: '5.0', onLine: true, maxTouchPoints: 5
};
for (var k in navProps) safeSet(_nav, k, navProps[k]);

// ============================================================
// 9. localStorage
// ============================================================
var _ls = (typeof localStorage !== 'undefined') ? localStorage : null;
if (!_ls || typeof _ls.getItem !== 'function') {
  _ls = {
    getItem: function(k) { return wx.getStorageSync(k) || null; },
    setItem: function(k, v) { wx.setStorageSync(k, v); },
    removeItem: function(k) { wx.removeStorageSync(k); },
    clear: function() { wx.clearStorageSync(); },
    key: function() { return null; }, length: 0
  };
  safeSet(_window, 'localStorage', _ls);
}

// ============================================================
// 10. document
// ============================================================
var _doc = (typeof document !== 'undefined') ? document : null;
var needNewDoc = !_doc;
if (needNewDoc) _doc = {};

// documentElement
if (!_doc.documentElement) safeSet(_doc, 'documentElement', {});
var _de = _doc.documentElement;
safeSet(_de, 'ontouchstart', null);
safeSet(_de, 'ontouchmove', null);
safeSet(_de, 'ontouchend', null);
safeSet(_de, 'ontouchcancel', null);
safeSet(_de, 'style', _de.style || {});
safeSet(_de, 'classList', _de.classList || { add: function(){}, remove: function(){} });
safeSet(_de, 'appendChild', function(c) { return c; });
safeSet(_de, 'removeChild', function(c) { return c; });
safeSet(_de, 'insertBefore', function(n) { return n; });
safeSet(_de, 'addEventListener', function() {});
safeSet(_de, 'removeEventListener', function() {});
safeSet(_de, 'setAttribute', function() {});
safeSet(_de, 'getAttribute', function() { return null; });
safeSet(_de, 'clientWidth', screenWidth);
safeSet(_de, 'clientHeight', screenHeight);
safeSet(_de, 'clientLeft', 0);
safeSet(_de, 'clientTop', 0);
safeSet(_de, 'scrollWidth', screenWidth);
safeSet(_de, 'scrollHeight', screenHeight);
safeSet(_de, 'getBoundingClientRect', function() {
  return { x: 0, y: 0, top: 0, left: 0, width: screenWidth, height: screenHeight, right: screenWidth, bottom: screenHeight };
});

// pageXOffset / pageYOffset
safeSet(_window, 'pageXOffset', 0);
safeSet(_window, 'pageYOffset', 0);

// document 属性
safeSet(_doc, 'readyState', 'complete');
safeSet(_doc, 'visibilityState', 'visible');
safeSet(_doc, 'hidden', false);
safeSet(_doc, 'fullscreenEnabled', false);

var _body = {
  appendChild: function(c) { return c; },
  removeChild: function(c) { return c; },
  insertBefore: function(n) { return n; },
  style: {}
};
if (!_doc.head) safeSet(_doc, 'head', { appendChild: function() {} });
if (!_doc.body) safeSet(_doc, 'body', _body);

// 补上 parentNode（属性可能已被 defineProperty 覆盖为 writable，直接赋值即可）
try { canvas.parentNode = _doc.body; } catch(e) {
  Object.defineProperty(canvas, 'parentNode', { configurable: true, writable: true, value: _doc.body });
}
try { canvas.parentElement = _doc.body; } catch(e) {
  Object.defineProperty(canvas, 'parentElement', { configurable: true, writable: true, value: _doc.body });
}

// createElement
safeSet(_doc, 'createElement', function(tagName) {
  tagName = (tagName || '').toLowerCase();
  if (tagName === 'canvas') {
    var c = wx.createCanvas();
    c.style = {};
    c.addEventListener = function() {};
    c.removeEventListener = function() {};
    c.classList = { add: function(){}, remove: function(){} };
    return c;
  }
  if (tagName === 'img' || tagName === 'image') {
    return wx.createImage();
  }
  // 通用虚拟 DOM 节点
  return {
    tagName: tagName.toUpperCase(), style: {},
    appendChild: function(c) { return c; }, removeChild: function(c) { return c; },
    insertBefore: function(n) { return n; },
    addEventListener: function() {}, removeEventListener: function() {},
    setAttribute: function() {}, getAttribute: function() { return null; },
    classList: { add: function(){}, remove: function(){} },
    childNodes: [], children: [], parentNode: null,
    innerHTML: '', innerText: '', textContent: ''
  };
});

safeSet(_doc, 'createElementNS', function(ns, tag) { return _doc.createElement(tag); });

safeSet(_doc, 'getElementById', function(id) {
  if (id === 'game-container') {
    return {
      style: {}, appendChild: function() {}, removeChild: function() {},
      insertBefore: function() {},
      addEventListener: function() {}, removeEventListener: function() {},
      setAttribute: function() {}, getAttribute: function() { return null; },
      classList: { add: function(){}, remove: function(){} },
      childNodes: [], children: [], parentNode: null,
      clientWidth: screenWidth, clientHeight: screenHeight,
      getBoundingClientRect: function() {
        return { x: 0, y: 0, top: 0, left: 0, width: screenWidth, height: screenHeight, right: screenWidth, bottom: screenHeight };
      }
    };
  }
  return null;
});

safeSet(_doc, 'getElementsByTagName', function(tag) {
  if (tag === 'canvas') return [canvas];
  if (tag === 'head') return [_doc.head];
  if (tag === 'body') return [_doc.body];
  return [];
});

safeSet(_doc, 'querySelector', function(sel) {
  if (sel === 'canvas' || sel === '#game-container canvas') return canvas;
  if (sel === '#game-container') return _doc.getElementById('game-container');
  return null;
});

safeSet(_doc, 'querySelectorAll', function(sel) {
  if (sel === 'canvas') return [canvas];
  return [];
});

if (!_doc.addEventListener) safeSet(_doc, 'addEventListener', function() {});
if (!_doc.removeEventListener) safeSet(_doc, 'removeEventListener', function() {});

// elementFromPoint — Phaser InputManager.onTouchMove 中使用
// 必须返回与 Phaser game.canvas 相同的对象
safeSet(_doc, 'elementFromPoint', function() { return canvas; });

if (needNewDoc) safeSet(_window, 'document', _doc);

// ============================================================
// 11. HTML 元素构造函数
// ============================================================
if (!_window.HTMLCanvasElement) safeSet(_window, 'HTMLCanvasElement', function() {});
if (!_window.HTMLElement) safeSet(_window, 'HTMLElement', function() {});
if (!_window.HTMLVideoElement) safeSet(_window, 'HTMLVideoElement', function() {});
if (!_window.Element) safeSet(_window, 'Element', function() {});
if (!_window.Node) safeSet(_window, 'Node', function() {});

// ============================================================
// 12. URL / Blob
// ============================================================
if (!_window.URL) safeSet(_window, 'URL', { createObjectURL: function() { return ''; }, revokeObjectURL: function() {} });
if (!_window.Blob) safeSet(_window, 'Blob', function() {});

// ============================================================
// 13. XMLHttpRequest
// ============================================================
if (!_window.XMLHttpRequest) {
  safeSet(_window, 'XMLHttpRequest', function() {
    var _url = '', _method = 'GET', _headers = {}, _responseType = '';
    return {
      readyState: 0, status: 0, statusText: '',
      response: null, responseText: '', responseType: _responseType,
      onreadystatechange: null, onload: null, onerror: null,
      ontimeout: null, onprogress: null,
      open: function(method, url) { _method = method; _url = url; this.readyState = 1; },
      setRequestHeader: function(k, v) { _headers[k] = v; },
      send: function(data) {
        var self = this;
        wx.request({
          url: _url, method: _method, header: _headers, data: data,
          responseType: _responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
          success: function(res) {
            self.readyState = 4; self.status = res.statusCode;
            self.response = res.data;
            self.responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            if (self.onreadystatechange) self.onreadystatechange();
            if (self.onload) self.onload();
          },
          fail: function(err) {
            self.readyState = 4; self.status = 0;
            if (self.onreadystatechange) self.onreadystatechange();
            if (self.onerror) self.onerror(err);
          }
        });
      },
      abort: function() {},
      getAllResponseHeaders: function() { return ''; },
      getResponseHeader: function() { return null; }
    };
  });
}

// ============================================================
// 14. Image / Audio
// ============================================================
if (!_window.Image) safeSet(_window, 'Image', function() { return wx.createImage(); });
if (!_window.Audio) {
  safeSet(_window, 'Audio', function(src) {
    var a = wx.createInnerAudioContext();
    if (src) a.src = src;
    return a;
  });
}

// ============================================================
// 15. location / screen / focus
// ============================================================
if (!_window.location) {
  safeSet(_window, 'location', {
    href: 'game.js', protocol: 'https:', host: 'minigame',
    hostname: 'minigame', port: '', pathname: '/game.js', search: '', hash: ''
  });
}
if (!_window.screen) {
  safeSet(_window, 'screen', {
    width: systemInfo.screenWidth, height: systemInfo.screenHeight,
    availWidth: screenWidth, availHeight: screenHeight,
    orientation: { type: 'portrait-primary' }
  });
}
if (!_window.focus) safeSet(_window, 'focus', function() {});

// ============================================================
// 16. Event / CustomEvent / ResizeObserver / MutationObserver / getComputedStyle
// ============================================================
if (!_window.CustomEvent) {
  safeSet(_window, 'CustomEvent', function(type, params) {
    this.type = type; this.detail = params ? params.detail : null;
  });
}
if (!_window.Event) {
  safeSet(_window, 'Event', function(type) { this.type = type; });
}
if (!_window.ResizeObserver) {
  safeSet(_window, 'ResizeObserver', function() {
    return { observe: function(){}, unobserve: function(){}, disconnect: function(){} };
  });
}
if (!_window.MutationObserver) {
  safeSet(_window, 'MutationObserver', function() {
    return { observe: function(){}, disconnect: function(){}, takeRecords: function() { return []; } };
  });
}
if (!_window.getComputedStyle) {
  safeSet(_window, 'getComputedStyle', function() {
    return { getPropertyValue: function() { return ''; } };
  });
}

// ============================================================
// 17. 触摸事件桥接（核心）
// ============================================================
// Phaser TouchManager.startListeners() 在 canvas 上注册 touchstart/move/end/cancel
// 同时在 window.top（= window）上注册 touchStartWindow（要求 target !== canvas）
//
// 我们的策略：
// - wx.onTouchXxx 只派发到 canvas（因为 Phaser 在 canvas 上注册了主监听器）
// - 不再派发到 window，避免 onTouchStartWindow 的 target !== canvas 检查问题
// - event.target 设为 canvas，与 Phaser 内部检查一致

(function() {
  function convertTouches(wxTouches) {
    var result = [];
    if (!wxTouches) return result;
    for (var i = 0; i < wxTouches.length; i++) {
      var t = wxTouches[i];
      result.push({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        pageX: t.clientX,
        pageY: t.clientY,
        screenX: t.clientX,
        screenY: t.clientY,
        target: canvas,
        radiusX: 0, radiusY: 0, rotationAngle: 0, force: 1
      });
    }
    return result;
  }

  function createTouchEvent(type, wxEvent) {
    var touches = convertTouches(wxEvent.touches);
    var changedTouches = convertTouches(wxEvent.changedTouches);
    return {
      type: type,
      target: canvas,
      currentTarget: canvas,
      srcElement: canvas,
      touches: touches,
      targetTouches: touches,
      changedTouches: changedTouches,
      timeStamp: Date.now(),
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      preventDefault: function() { this.defaultPrevented = true; },
      stopPropagation: function() {},
      stopImmediatePropagation: function() {}
    };
  }

  var _touchCount = 0;

  wx.onTouchStart(function(e) {
    _touchCount++;
    var event = createTouchEvent('touchstart', e);
    // 只派发到 canvas —— Phaser 的主触摸监听器在这里
    dispatchEvent(canvas, event);
    if (_touchCount <= 3) {
      console.log('[adapter] touchstart #' + _touchCount,
        'xy:', e.touches[0].clientX.toFixed(0) + ',' + e.touches[0].clientY.toFixed(0),
        'listeners:', (getListenerMap(canvas)['touchstart'] || []).length);
    }
  });

  wx.onTouchMove(function(e) {
    var event = createTouchEvent('touchmove', e);
    dispatchEvent(canvas, event);
  });

  wx.onTouchEnd(function(e) {
    var event = createTouchEvent('touchend', e);
    dispatchEvent(canvas, event);
  });

  wx.onTouchCancel(function(e) {
    var event = createTouchEvent('touchcancel', e);
    dispatchEvent(canvas, event);
  });
})();

// ============================================================
// 18. 完成
// ============================================================
console.log('[adapter] 加载完成');
console.log('[adapter] 屏幕:', screenWidth, 'x', screenHeight, '@ DPR', dpr);
console.log('[adapter] canvas:', canvas.width, 'x', canvas.height);
