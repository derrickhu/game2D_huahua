/**
 * DOM 元素模拟
 * 业界已知坑：HTMLCanvasElement / HTMLImageElement 必须用 constructor 直接赋值
 * 不能用 class extends，否则 instanceof 校验会失败
 */

const platform = require('./platform');

class Element {
  constructor() {
    this.childNodes = [];
    this.style = { cursor: null };
    this.clientWidth = 0;
    this.clientHeight = 0;
  }
  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) this.childNodes.splice(idx, 1);
    return child;
  }
  addEventListener() {}
  removeEventListener() {}
  insertBefore() {}
  replaceChild() {}
  cloneNode() { return new Element(); }
  setAttribute() {}
  getAttribute() { return null; }
}

// 通过 constructor 直接赋值（非 extends），确保 instanceof 正确
const HTMLCanvasElement = platform.createCanvas().constructor;
const HTMLImageElement = platform.createImage().constructor;

class HTMLVideoElement extends Element {}

module.exports = {
  Element,
  HTMLCanvasElement,
  HTMLImageElement,
  HTMLVideoElement,
};
