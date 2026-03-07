/**
 * pixi-adapter 统一入口
 * 根据运行环境（真机/模拟器）将 DOM 模拟对象挂载到全局
 * 参考 finscn/weapp-adapter + 掘金社区文章的成熟模式
 */

const platform = require('./platform');
const { noop } = require('./util');
const Image = require('./Image');
const { canvas } = require('./canvas');
const location = require('./location');
const document = require('./document');
const navigator = require('./navigator');
const localStorage = require('./localStorage');
const XMLHttpRequest = require('./XMLHttpRequest');
const { registerTouchEvents } = require('./TouchEvent');
const {
  Element,
  HTMLCanvasElement,
  HTMLImageElement,
  HTMLVideoElement,
} = require('./element');

// 获取系统信息
const sysInfo = platform.getSystemInfoSync();
const isDevtools = sysInfo.platform === 'devtools';

// 禁用 OffscreenCanvas（微信的实现不完整，会导致 PixiJS 走入错误分支）
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.OffscreenCanvas = undefined;
}

// 构造 WebGLRenderingContext 全局引用（PixiJS 可能会检查）
let _WebGLRenderingContext = {};
try {
  const _tmpCanvas = platform.createCanvas();
  const _tmpGl = _tmpCanvas.getContext('webgl');
  if (_tmpGl) {
    _WebGLRenderingContext = _tmpGl.constructor || {};
  }
} catch (e) {
  // 忽略
}

// CanvasRenderingContext2D 全局引用
let _CanvasRenderingContext2D = {};
try {
  const _tmpCanvas2 = platform.createCanvas();
  const _tmpCtx = _tmpCanvas2.getContext('2d');
  if (_tmpCtx) {
    _CanvasRenderingContext2D = _tmpCtx.constructor || {};
  }
} catch (e) {
  // 忽略
}

// 空 DOMParser 实现
class DOMParser {
  parseFromString() {
    return { documentElement: new Element() };
  }
}

// performance 对象（小游戏环境通常已有，但保险起见）
const _performance = typeof performance !== 'undefined' ? performance : {
  now: Date.now.bind(Date),
};

if (isDevtools) {
  // 模拟器环境：window 已存在，用 defineProperty 覆盖/补充
  const _win = typeof window !== 'undefined' ? window : GameGlobal;

  const defines = {
    Image: { value: Image, configurable: true },
    Element: { value: Element, configurable: true },
    HTMLCanvasElement: { value: HTMLCanvasElement, configurable: true },
    HTMLImageElement: { value: HTMLImageElement, configurable: true },
    HTMLVideoElement: { value: HTMLVideoElement, configurable: true },
    WebGLRenderingContext: { value: _WebGLRenderingContext, configurable: true },
    CanvasRenderingContext2D: { value: _CanvasRenderingContext2D, configurable: true },
    XMLHttpRequest: { value: XMLHttpRequest, configurable: true },
    DOMParser: { value: DOMParser, configurable: true },
    localStorage: { value: localStorage, configurable: true },
    ontouchstart: { value: noop, configurable: true },
    addEventListener: { value: noop, configurable: true },
    removeEventListener: { value: noop, configurable: true },
  };

  for (const key in defines) {
    try {
      const desc = Object.getOwnPropertyDescriptor(_win, key);
      if (!desc || desc.configurable) {
        Object.defineProperty(_win, key, defines[key]);
      }
    } catch (e) {
      // 某些属性不可修改，忽略
    }
  }

  // document 上的属性补充
  try {
    for (const key in document) {
      const desc = Object.getOwnPropertyDescriptor(_win.document, key);
      if (!desc || desc.configurable) {
        Object.defineProperty(_win.document, key, { value: document[key], configurable: true });
      }
    }
  } catch (e) {
    // 忽略
  }
} else {
  // 真机环境：直接挂载到 GameGlobal
  GameGlobal.window = GameGlobal;
  GameGlobal.document = document;
  GameGlobal.navigator = navigator;
  GameGlobal.location = location;
  GameGlobal.Image = Image;
  GameGlobal.Element = Element;
  GameGlobal.HTMLCanvasElement = HTMLCanvasElement;
  GameGlobal.HTMLImageElement = HTMLImageElement;
  GameGlobal.HTMLVideoElement = HTMLVideoElement;
  GameGlobal.WebGLRenderingContext = _WebGLRenderingContext;
  GameGlobal.CanvasRenderingContext2D = _CanvasRenderingContext2D;
  GameGlobal.XMLHttpRequest = XMLHttpRequest;
  GameGlobal.DOMParser = DOMParser;
  GameGlobal.localStorage = localStorage;
  GameGlobal.performance = _performance;
  GameGlobal.ontouchstart = noop;
  GameGlobal.addEventListener = noop;
  GameGlobal.removeEventListener = noop;
  GameGlobal.self = GameGlobal;
}

// 全局 canvas 暴露
GameGlobal.canvas = canvas;

// navigator.userAgent 赋值（只读属性，需 try-catch）
try {
  if (typeof window !== 'undefined' && window.navigator) {
    window.navigator.userAgent = navigator.userAgent;
  }
} catch (e) {
  // 只读属性，忽略
}

// PixiJS 7 EventSystem 需要 PointerEvent
if (typeof GameGlobal !== 'undefined' && !GameGlobal.PointerEvent) {
  GameGlobal.PointerEvent = function PointerEvent(type, opts) {
    this.type = type;
    Object.assign(this, opts || {});
  };
}

// PixiJS 可能检查 TouchEvent 构造函数
if (typeof GameGlobal !== 'undefined' && !GameGlobal.TouchEvent) {
  GameGlobal.TouchEvent = function TouchEvent(type, opts) {
    this.type = type;
    Object.assign(this, opts || {});
  };
}

// PixiJS 可能检查 MouseEvent 构造函数
if (typeof GameGlobal !== 'undefined' && !GameGlobal.MouseEvent) {
  GameGlobal.MouseEvent = function MouseEvent(type, opts) {
    this.type = type;
    Object.assign(this, opts || {});
  };
}

// PixiJS 在某些场景检查 URL / Blob
if (typeof GameGlobal !== 'undefined') {
  if (!GameGlobal.URL) {
    GameGlobal.URL = {
      createObjectURL: function() { return ''; },
      revokeObjectURL: function() {},
    };
  }
  if (!GameGlobal.Blob) {
    GameGlobal.Blob = function Blob() {};
  }
}

// 注册触摸事件桥接
registerTouchEvents();

console.log('[pixi-adapter] 初始化完成, 平台:', platform.name, ', 环境:', isDevtools ? '模拟器' : '真机');
