/**
 * 触摸事件适配
 * 将小游戏触摸事件转换为 PixiJS 所需的标准 DOM 事件格式
 */

const platform = require('./platform');
const { canvas } = require('./canvas');

class TouchEvent {
  constructor(type, touches) {
    this.type = type;
    this.target = canvas;
    this.currentTarget = canvas;
    this.touches = touches || [];
    this.changedTouches = touches || [];
    this.targetTouches = touches || [];
    this.timeStamp = Date.now();
    this.bubbles = true;
    this.cancelable = true;
    this.defaultPrevented = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
}

// 将小游戏触摸坐标转换为 canvas 坐标
function convertTouches(rawTouches) {
  if (!rawTouches) return [];
  return Array.prototype.map.call(rawTouches, (touch) => ({
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    target: canvas,
  }));
}

// 注册触摸事件监听桥接
function registerTouchEvents() {
  const _listeners = {};

  // 给 canvas 挂上 addEventListener / removeEventListener
  canvas.addEventListener = function(type, handler, options) {
    if (!_listeners[type]) _listeners[type] = [];
    _listeners[type].push(handler);
  };

  canvas.removeEventListener = function(type, handler) {
    if (!_listeners[type]) return;
    const idx = _listeners[type].indexOf(handler);
    if (idx !== -1) _listeners[type].splice(idx, 1);
  };

  // 分发事件到 canvas 上的监听器
  function dispatch(type, rawEvent) {
    const touches = convertTouches(rawEvent.touches || rawEvent.changedTouches);
    const event = new TouchEvent(type, touches);
    event.changedTouches = convertTouches(rawEvent.changedTouches);

    const queue = _listeners[type];
    if (queue) {
      queue.forEach(handler => {
        try { handler(event); } catch (e) { console.error('[TouchEvent]', type, e); }
      });
    }
  }

  // pointer 事件映射（PixiJS 7 优先使用 pointer 事件）
  function dispatchPointer(pointerType, rawEvent) {
    const touches = rawEvent.changedTouches || rawEvent.touches || [];
    if (!touches.length) return;
    const touch = touches[0];

    const pointerEvent = {
      type: pointerType,
      pointerId: touch.identifier || 0,
      pointerType: 'touch',
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.clientX,
      pageY: touch.clientY,
      screenX: touch.clientX,
      screenY: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
      offsetX: touch.clientX,
      offsetY: touch.clientY,
      width: 1,
      height: 1,
      pressure: pointerType === 'pointerup' ? 0 : 0.5,
      button: 0,
      buttons: pointerType === 'pointerup' ? 0 : 1,
      isPrimary: true,
      target: canvas,
      currentTarget: canvas,
      timeStamp: Date.now(),
      bubbles: true,
      cancelable: true,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {},
    };

    const queue = _listeners[pointerType];
    if (queue) {
      queue.forEach(handler => {
        try { handler(pointerEvent); } catch (e) { console.error('[PointerEvent]', pointerType, e); }
      });
    }
  }

  platform.onTouchStart((e) => {
    dispatch('touchstart', e);
    dispatchPointer('pointerdown', e);
  });

  platform.onTouchMove((e) => {
    dispatch('touchmove', e);
    dispatchPointer('pointermove', e);
  });

  platform.onTouchEnd((e) => {
    dispatch('touchend', e);
    dispatchPointer('pointerup', e);
  });

  platform.onTouchCancel((e) => {
    dispatch('touchcancel', e);
    dispatchPointer('pointercancel', e);
  });

  // canvas.getBoundingClientRect - PixiJS 用来计算事件坐标
  try {
    canvas.getBoundingClientRect = function() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: canvas.width,
        height: canvas.height,
        right: canvas.width,
        bottom: canvas.height,
      };
    };
  } catch (e) {}

  // PixiJS 会检查 canvas.style（微信 canvas 部分属性可能只读）
  try {
    if (!canvas.style) canvas.style = {};
    canvas.style.touchAction = '';
    canvas.style.msTouchAction = '';
    canvas.style.cursor = '';
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  } catch (e) {}

  // PixiJS 检查 focus
  if (!canvas.focus) canvas.focus = function() {};

  // PixiJS 会检查 parentElement（微信 canvas 的部分属性是只读的）
  try { canvas.parentElement = null; } catch (e) {}
  try { canvas.parentNode = null; } catch (e) {}
}

module.exports = { TouchEvent, registerTouchEvents };
