/**
 * Tap 没有 createOffscreenCanvas，再调 createCanvas 会多开一块屏幕把主屏弄黑。
 * 文字改由包内 HuahuaUI.ttf 在这里光栅，像素走原来的 getImageData 上传。
 */
declare const GameGlobal: any;

interface FontPoint { x: number; y: number; on: boolean }
interface SoftFont {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  glyphId: (code: number) => number;
  advance: (gid: number) => number;
  outline: (gid: number) => FontPoint[][];
}

interface Rgba { r: number; g: number; b: number; a: number }

const _glyphCache = new Map<string, { alpha: Uint8Array; w: number; h: number; ox: number; oy: number }>();

function u16(view: DataView, p: number): number {
  return view.getUint16(p);
}
function i16(view: DataView, p: number): number {
  return view.getInt16(p);
}

function findTables(view: DataView): Record<string, { off: number; len: number }> | null {
  if (view.byteLength < 12 || view.getUint32(0) !== 0x00010000) return null;
  const n = u16(view, 4);
  const tables: Record<string, { off: number; len: number }> = {};
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16;
    if (p + 16 > view.byteLength) break;
    const tag = String.fromCharCode(view.getUint8(p), view.getUint8(p + 1), view.getUint8(p + 2), view.getUint8(p + 3));
    tables[tag] = { off: view.getUint32(p + 8), len: view.getUint32(p + 12) };
  }
  if (!tables.cmap || !tables.glyf || !tables.loca || !tables.head || !tables.hhea || !tables.hmtx) return null;
  return tables;
}

function parseCmap4(view: DataView, tableOff: number): ((code: number) => number) | null {
  const nTables = u16(view, tableOff + 2);
  let sub = 0;
  for (let i = 0; i < nTables; i++) {
    const p = tableOff + 4 + i * 8;
    const platform = u16(view, p);
    const enc = u16(view, p + 2);
    const off = view.getUint32(p + 4);
    if ((platform === 3 && enc === 1) || platform === 0) sub = tableOff + off;
    if (platform === 3 && enc === 1) break;
  }
  if (!sub || u16(view, sub) !== 4) return null;
  const segCount = u16(view, sub + 6) >> 1;
  let p = sub + 14;
  const endCode = new Uint16Array(segCount);
  for (let i = 0; i < segCount; i++, p += 2) endCode[i] = u16(view, p);
  p += 2;
  const startCode = new Uint16Array(segCount);
  for (let i = 0; i < segCount; i++, p += 2) startCode[i] = u16(view, p);
  const idDelta = new Int16Array(segCount);
  for (let i = 0; i < segCount; i++, p += 2) idDelta[i] = i16(view, p);
  const idRangeOff = p;
  const idRange = new Uint16Array(segCount);
  for (let i = 0; i < segCount; i++, p += 2) idRange[i] = u16(view, p);
  return (code: number): number => {
    if (code < 0 || code > 0xffff) return 0;
    let lo = 0;
    let hi = segCount - 1;
    let i = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (endCode[mid] < code) lo = mid + 1;
      else { i = mid; hi = mid - 1; }
    }
    if (i < 0 || startCode[i] > code) return 0;
    if (idRange[i] === 0) return (code + idDelta[i]) & 0xffff;
    const pos = idRangeOff + i * 2 + idRange[i] + (code - startCode[i]) * 2;
    const gid = u16(view, pos);
    if (!gid) return 0;
    return (gid + idDelta[i]) & 0xffff;
  };
}

function parseSimpleOutline(view: DataView, offset: number, nContours: number): FontPoint[][] {
  let p = offset;
  const ends: number[] = [];
  for (let i = 0; i < nContours; i++, p += 2) ends.push(u16(view, p));
  const nPts = ends[nContours - 1] + 1;
  const instr = u16(view, p);
  p += 2 + instr;
  const flags = new Uint8Array(nPts);
  for (let i = 0; i < nPts; i++) {
    const f = view.getUint8(p);
    p += 1;
    flags[i] = f;
    if (f & 8) {
      let rep = view.getUint8(p);
      p += 1;
      while (rep-- > 0 && i + 1 < nPts) flags[++i] = f;
    }
  }
  const xs = new Int16Array(nPts);
  let x = 0;
  for (let i = 0; i < nPts; i++) {
    const f = flags[i];
    if (f & 2) {
      const dx = view.getUint8(p);
      p += 1;
      x += (f & 16) ? dx : -dx;
    } else if (!(f & 16)) {
      x += i16(view, p);
      p += 2;
    }
    xs[i] = x;
  }
  const ys = new Int16Array(nPts);
  let y = 0;
  for (let i = 0; i < nPts; i++) {
    const f = flags[i];
    if (f & 4) {
      const dy = view.getUint8(p);
      p += 1;
      y += (f & 32) ? dy : -dy;
    } else if (!(f & 32)) {
      y += i16(view, p);
      p += 2;
    }
    ys[i] = y;
  }
  const contours: FontPoint[][] = [];
  let start = 0;
  for (let c = 0; c < nContours; c++) {
    const end = ends[c];
    const pts: FontPoint[] = [];
    for (let i = start; i <= end; i++) pts.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) !== 0 });
    contours.push(pts);
    start = end + 1;
  }
  return contours;
}

export function parseSoftFont(src: ArrayBuffer | ArrayBufferView): SoftFont | null {
  const view = src instanceof ArrayBuffer
    ? new DataView(src)
    : ArrayBuffer.isView(src)
      ? new DataView(src.buffer, src.byteOffset, src.byteLength)
      : null;
  if (!view) return null;
  const tables = findTables(view);
  if (!tables) return null;
  const head = tables.head.off;
  const unitsPerEm = u16(view, head + 18) || 1000;
  const locaFormat = i16(view, head + 50);
  const hhea = tables.hhea.off;
  const ascent = i16(view, hhea + 4);
  const descent = i16(view, hhea + 6);
  const nMetrics = u16(view, hhea + 34);
  const glyphId = parseCmap4(view, tables.cmap.off);
  if (!glyphId) return null;
  const glyfOff = tables.glyf.off;
  const locaOff = tables.loca.off;
  const hmtxOff = tables.hmtx.off;
  const numGlyphs = tables.maxp ? u16(view, tables.maxp.off + 4) : nMetrics;
  const loca = (gid: number): number => (
    locaFormat === 0
      ? u16(view, locaOff + gid * 2) * 2
      : view.getUint32(locaOff + gid * 4)
  );
  const outlines = new Map<number, FontPoint[][]>();
  return {
    unitsPerEm,
    ascent,
    descent,
    glyphId,
    advance(gid: number): number {
      const i = gid < nMetrics ? gid : nMetrics - 1;
      if (i < 0) return unitsPerEm;
      return u16(view, hmtxOff + i * 4);
    },
    outline(gid: number): FontPoint[][] {
      const hit = outlines.get(gid);
      if (hit) return hit;
      let pts: FontPoint[][] = [];
      try {
        if (gid > 0 && gid < numGlyphs) {
          const a = loca(gid);
          const b = loca(gid + 1);
          if (b > a + 8) {
            const at = glyfOff + a;
            const n = i16(view, at);
            if (n > 0) pts = parseSimpleOutline(view, at + 10, n);
          }
        }
      } catch { pts = []; }
      outlines.set(gid, pts);
      return pts;
    },
  };
}

function normalizeContour(pts: FontPoint[]): FontPoint[] {
  const n = pts.length;
  if (!n) return [];
  const out: FontPoint[] = [];
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    out.push(cur);
    if (!cur.on && !next.on) {
      out.push({ x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2, on: true });
    }
  }
  const s = out.findIndex((pt) => pt.on);
  if (s < 0) return [];
  return s === 0 ? out : out.slice(s).concat(out.slice(0, s));
}

function flattenContour(pts: FontPoint[], map: (x: number, y: number) => [number, number], edges: number[]) {
  const ring = normalizeContour(pts);
  const n = ring.length;
  if (n < 2) return;
  const pushLine = (p: FontPoint, q: FontPoint) => {
    const [x0, y0] = map(p.x, p.y);
    const [x1, y1] = map(q.x, q.y);
    if (y0 !== y1) edges.push(x0, y0, x1, y1);
  };
  const pushQuad = (p0: FontPoint, p1: FontPoint, p2: FontPoint) => {
    const flat = (a: FontPoint, b: FontPoint, c: FontPoint, depth: number) => {
      const [ax, ay] = map(a.x, a.y);
      const [bx, by] = map(b.x, b.y);
      const [cx, cy] = map(c.x, c.y);
      const dx = cx - ax;
      const dy = cy - ay;
      const dist = Math.abs((bx - ax) * dy - (by - ay) * dx);
      const len = Math.hypot(dx, dy) + 1e-6;
      if (depth >= 8 || dist / len <= 0.35) {
        if (ay !== cy) edges.push(ax, ay, cx, cy);
        return;
      }
      const ab: FontPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: false };
      const bc: FontPoint = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2, on: false };
      const mid: FontPoint = { x: (ab.x + bc.x) / 2, y: (ab.y + bc.y) / 2, on: true };
      flat(a, ab, mid, depth + 1);
      flat(mid, bc, c, depth + 1);
    };
    flat(p0, p1, p2, 0);
  };
  for (let i = 0; i < n;) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % n];
    if (p1.on) {
      pushLine(p0, p1);
      i += 1;
    } else {
      const p2 = ring[(i + 2) % n];
      pushQuad(p0, p1, p2.on ? p2 : p0);
      i += 2;
    }
  }
}

function rasterOutline(contours: FontPoint[][], scale: number): { alpha: Uint8Array; w: number; h: number; ox: number; oy: number } {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      if (p.x < xMin) xMin = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.x > xMax) xMax = p.x;
      if (p.y > yMax) yMax = p.y;
    }
  }
  if (!Number.isFinite(xMin)) return { alpha: new Uint8Array(0), w: 0, h: 0, ox: 0, oy: 0 };
  const pad = 1;
  const x0 = Math.floor(xMin * scale) - pad;
  const yTop = Math.ceil(yMax * scale) + pad;
  const x1 = Math.ceil(xMax * scale) + pad;
  const yBot = Math.floor(yMin * scale) - pad;
  const w = Math.max(1, Math.min(512, x1 - x0));
  const h = Math.max(1, Math.min(512, yTop - yBot));
  const SS = 2;
  const hw = w * SS;
  const hh = h * SS;
  const edges: number[] = [];
  const map = (x: number, y: number): [number, number] => [
    (x * scale - x0) * SS,
    (yTop - y * scale) * SS,
  ];
  for (const c of contours) flattenContour(c, map, edges);
  const hi = new Uint8Array(hw * hh);
  const hits: { x: number; dir: number }[] = [];
  for (let row = 0; row < hh; row++) {
    const y = row + 0.5;
    hits.length = 0;
    for (let e = 0; e < edges.length; e += 4) {
      const y0 = edges[e + 1];
      const y1 = edges[e + 3];
      const ymin = y0 < y1 ? y0 : y1;
      const ymax = y0 < y1 ? y1 : y0;
      if (y < ymin || y >= ymax) continue;
      const t = (y - y0) / (y1 - y0);
      hits.push({ x: edges[e] + t * (edges[e + 2] - edges[e]), dir: y1 > y0 ? 1 : -1 });
    }
    if (hits.length < 2) continue;
    hits.sort((a, b) => a.x - b.x);
    let wind = 0;
    let prev = 0;
    for (let k = 0; k < hits.length; k++) {
      const x = hits[k].x;
      if (wind !== 0) {
        let a = prev;
        let b = x;
        if (b < a) { const t = a; a = b; b = t; }
        let ia = a | 0;
        let ib = Math.ceil(b);
        if (ia < 0) ia = 0;
        if (ib > hw) ib = hw;
        const rowOff = row * hw;
        for (let px = ia; px < ib; px++) hi[rowOff + px] = 1;
      }
      wind += hits[k].dir;
      prev = x;
    }
  }
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = 0;
      const ox = x * SS;
      const oy = y * SS;
      c += hi[oy * hw + ox];
      c += hi[oy * hw + ox + 1];
      c += hi[(oy + 1) * hw + ox];
      c += hi[(oy + 1) * hw + ox + 1];
      if (c) alpha[y * w + x] = c * 64 - (c === 4 ? 1 : 0);
    }
  }
  return { alpha, w, h, ox: x0, oy: -yTop };
}

function glyphBitmap(font: SoftFont, gid: number, devSize: number) {
  const key = `${gid}@${Math.round(devSize * 4)}`;
  const hit = _glyphCache.get(key);
  if (hit) return hit;
  const scale = devSize / font.unitsPerEm;
  const bmp = rasterOutline(font.outline(gid), scale);
  _glyphCache.set(key, bmp);
  return bmp;
}

function dilate(src: Uint8Array, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(6, Math.ceil(radius)));
  if (!r || !w || !h) return { alpha: src, w, h, shift: 0 };
  const w2 = w + r * 2;
  const h2 = h + r * 2;
  const dst = new Uint8Array(w2 * h2);
  const r2 = r * r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = src[y * w + x];
      if (!a) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const i = (y + r + dy) * w2 + (x + r + dx);
          if (a > dst[i]) dst[i] = a;
        }
      }
    }
  }
  return { alpha: dst, w: w2, h: h2, shift: r };
}

function parseColor(input: unknown): Rgba {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const n = input >>> 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
  }
  const s = String(input ?? '').trim().toLowerCase();
  if (s === 'black' || s === '#000' || s === '#000000') return { r: 0, g: 0, b: 0, a: 255 };
  if (s === 'white' || s === '#fff' || s === '#ffffff') return { r: 255, g: 255, b: 255, a: 255 };
  if (s === 'red' || s === '#f00' || s === '#ff0000') return { r: 255, g: 0, b: 0, a: 255 };
  const hex = s.startsWith('#') ? s.slice(1) : '';
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : 255;
    return { r, g, b, a };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
    };
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    return {
      r: Number(m[1]) | 0,
      g: Number(m[2]) | 0,
      b: Number(m[3]) | 0,
      a: m[4] == null ? 255 : Math.round(Number(m[4]) * 255),
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

function fontPx(font: string): number {
  const m = String(font || '').match(/([\d.]+)px/);
  const n = m ? Number(m[1]) : 16;
  return n > 0 ? n : 16;
}

function letterGap(value: string, scale: number): number {
  const m = String(value || '').match(/(-?[\d.]+)px/);
  return m ? Number(m[1]) * scale : 0;
}

function asFontSource(src: unknown): ArrayBuffer | ArrayBufferView | null {
  if (!src) return null;
  if (src instanceof ArrayBuffer || ArrayBuffer.isView(src as ArrayBufferView)) return src as ArrayBuffer | ArrayBufferView;
  const data = (src as { data?: unknown }).data;
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data as ArrayBufferView)) return data as ArrayBuffer | ArrayBufferView;
  return null;
}

export function createSoftTextCanvas(src: unknown): { canvas: any; ctx: any } | null {
  const bytes = asFontSource(src);
  if (!bytes) return null;
  const font = parseSoftFont(bytes);
  if (!font) return null;
  let w = 1;
  let h = 1;
  let pixels = new Uint8ClampedArray(4);
  const canvas: any = {
    __huahuaSoft: true,
    style: {},
    get width() { return w; },
    set width(v: number) { resize(v, h); },
    get height() { return h; },
    set height(v: number) { resize(w, v); },
    getContext(type: string) { return type === '2d' ? ctx : null; },
    addEventListener() {},
    removeEventListener() {},
  };
  const ctx: any = {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    letterSpacing: '0px',
    textLetterSpacing: '0px',
    shadowColor: 'black',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    _stack: [] as any[],
    save() {
      ctx._stack.push({
        fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle, font: ctx.font,
        textAlign: ctx.textAlign, textBaseline: ctx.textBaseline, lineWidth: ctx.lineWidth,
        globalAlpha: ctx.globalAlpha, letterSpacing: ctx.letterSpacing,
        shadowColor: ctx.shadowColor, shadowBlur: ctx.shadowBlur,
        shadowOffsetX: ctx.shadowOffsetX, shadowOffsetY: ctx.shadowOffsetY,
        a: ctx.a, b: ctx.b, c: ctx.c, d: ctx.d, e: ctx.e, f: ctx.f,
      });
    },
    restore() {
      const s = ctx._stack.pop();
      if (!s) return;
      Object.assign(ctx, s);
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      ctx.a = a; ctx.b = b; ctx.c = c; ctx.d = d; ctx.e = e; ctx.f = f;
    },
    scale(x: number, y: number) {
      ctx.a *= x; ctx.b *= x; ctx.c *= y; ctx.d *= y;
    },
    translate(x: number, y: number) {
      ctx.e += ctx.a * x + ctx.c * y;
      ctx.f += ctx.b * x + ctx.d * y;
    },
    beginPath() {},
    closePath() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text: string) {
      const size = fontPx(ctx.font);
      const gap = letterGap(ctx.letterSpacing, 1);
      let width = 0;
      let n = 0;
      for (let i = 0; i < String(text || '').length; i++) {
        const cp = String(text).codePointAt(i) || 0;
        if (cp > 0xffff) i++;
        width += font.advance(font.glyphId(cp)) * size / font.unitsPerEm;
        n++;
      }
      if (n > 1 && gap) width += gap * (n - 1);
      return { width };
    },
    clearRect(x: number, y: number, cw: number, ch: number) {
      fillRectMapped(x, y, cw, ch, { r: 0, g: 0, b: 0, a: 0 }, true);
    },
    fillRect(x: number, y: number, cw: number, ch: number) {
      fillRectMapped(x, y, cw, ch, parseColor(ctx.fillStyle), false);
    },
    fillText(text: string, x: number, y: number) {
      drawText(text, x, y, 'fill');
    },
    strokeText(text: string, x: number, y: number) {
      drawText(text, x, y, 'stroke');
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      const rw = Math.max(1, sw | 0);
      const rh = Math.max(1, sh | 0);
      const data = new Uint8ClampedArray(rw * rh * 4);
      for (let row = 0; row < rh; row++) {
        const yy = (sy | 0) + row;
        if (yy < 0 || yy >= h) continue;
        for (let col = 0; col < rw; col++) {
          const xx = (sx | 0) + col;
          if (xx < 0 || xx >= w) continue;
          const di = (row * rw + col) * 4;
          const si = (yy * w + xx) * 4;
          data[di] = pixels[si];
          data[di + 1] = pixels[si + 1];
          data[di + 2] = pixels[si + 2];
          data[di + 3] = pixels[si + 3];
        }
      }
      return { data, width: rw, height: rh };
    },
    putImageData(img: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
      if (!img?.data) return;
      const sw = img.width | 0;
      const sh = (img.data.length / 4 / Math.max(1, sw)) | 0;
      for (let row = 0; row < sh; row++) {
        const yy = (y | 0) + row;
        if (yy < 0 || yy >= h) continue;
        for (let col = 0; col < sw; col++) {
          const xx = (x | 0) + col;
          if (xx < 0 || xx >= w) continue;
          const si = (row * sw + col) * 4;
          const di = (yy * w + xx) * 4;
          pixels[di] = img.data[si];
          pixels[di + 1] = img.data[si + 1];
          pixels[di + 2] = img.data[si + 2];
          pixels[di + 3] = img.data[si + 3];
        }
      }
    },
  };

  function resize(nw: number, nh: number) {
    w = Math.max(1, Math.min(4096, nw | 0));
    h = Math.max(1, Math.min(4096, nh | 0));
    if (w * h > 4096 * 1024) {
      h = Math.max(1, Math.floor((4096 * 1024) / w));
    }
    pixels = new Uint8ClampedArray(w * h * 4);
    ctx.a = 1; ctx.b = 0; ctx.c = 0; ctx.d = 1; ctx.e = 0; ctx.f = 0;
  }

  function mapPoint(x: number, y: number): [number, number] {
    return [ctx.a * x + ctx.c * y + ctx.e, ctx.b * x + ctx.d * y + ctx.f];
  }

  function fillRectMapped(x: number, y: number, cw: number, ch: number, color: Rgba, replace: boolean) {
    const [x1, y1] = mapPoint(x, y);
    const [x2, y2] = mapPoint(x + cw, y + ch);
    let left = Math.floor(Math.min(x1, x2));
    let top = Math.floor(Math.min(y1, y2));
    let right = Math.ceil(Math.max(x1, x2));
    let bottom = Math.ceil(Math.max(y1, y2));
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (right > w) right = w;
    if (bottom > h) bottom = h;
    const a = replace ? color.a : Math.round(color.a * (Number(ctx.globalAlpha) || 0));
    for (let yy = top; yy < bottom; yy++) {
      for (let xx = left; xx < right; xx++) {
        const i = (yy * w + xx) * 4;
        if (replace) {
          pixels[i] = color.r;
          pixels[i + 1] = color.g;
          pixels[i + 2] = color.b;
          pixels[i + 3] = a;
        } else {
          blendAt(i, color.r, color.g, color.b, a);
        }
      }
    }
  }

  function blendAt(i: number, r: number, g: number, b: number, a: number) {
    if (a <= 0) return;
    if (a >= 255) {
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      return;
    }
    const dstA = pixels[i + 3];
    const inv = 255 - a;
    const outA = a + ((dstA * inv + 127) / 255 | 0);
    if (outA <= 0) return;
    pixels[i] = (r * a + pixels[i] * ((dstA * inv + 127) / 255 | 0)) / outA;
    pixels[i + 1] = (g * a + pixels[i + 1] * ((dstA * inv + 127) / 255 | 0)) / outA;
    pixels[i + 2] = (b * a + pixels[i + 2] * ((dstA * inv + 127) / 255 | 0)) / outA;
    pixels[i + 3] = outA;
  }

  function blit(alpha: Uint8Array, bw: number, bh: number, dx: number, dy: number, color: Rgba) {
    const alphaScale = Math.max(0, Math.min(1, Number(ctx.globalAlpha) || 0)) * (color.a / 255);
    for (let y = 0; y < bh; y++) {
      const yy = dy + y;
      if (yy < 0 || yy >= h) continue;
      for (let x = 0; x < bw; x++) {
        const xx = dx + x;
        if (xx < 0 || xx >= w) continue;
        const cov = alpha[y * bw + x];
        if (!cov) continue;
        blendAt((yy * w + xx) * 4, color.r, color.g, color.b, Math.round(cov * alphaScale));
      }
    }
  }

  function drawText(text: string, x: number, y: number, mode: 'fill' | 'stroke') {
    const raw = String(text ?? '');
    if (!raw) return;
    const scale = Math.hypot(ctx.a, ctx.b) || 1;
    const size = fontPx(ctx.font) * scale;
    const gap = letterGap(ctx.letterSpacing || ctx.textLetterSpacing, scale);
    let width = 0;
    const glyphs: { gid: number; adv: number }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const cp = raw.codePointAt(i) || 0;
      if (cp > 0xffff) i++;
      const gid = font.glyphId(cp);
      const adv = font.advance(gid) * size / font.unitsPerEm;
      glyphs.push({ gid, adv });
      width += adv;
    }
    if (glyphs.length > 1 && gap) width += gap * (glyphs.length - 1);
    const align = String(ctx.textAlign || 'left');
    let penX = x;
    if (align === 'center') penX -= width / scale / 2;
    else if (align === 'right' || align === 'end') penX -= width / scale;
    const [ox, oy] = mapPoint(penX, y);
    let baseShift = 0;
    const base = String(ctx.textBaseline || 'alphabetic');
    const up = size / font.unitsPerEm;
    if (base === 'top' || base === 'hanging') baseShift = font.ascent * up;
    else if (base === 'bottom' || base === 'ideographic') baseShift = font.descent * up;
    else if (base === 'middle') baseShift = (font.ascent + font.descent) / 2 * up;
    const baseY = oy + baseShift;
    const color = parseColor(mode === 'stroke' ? ctx.strokeStyle : ctx.fillStyle);
    const radius = mode === 'stroke' ? Math.abs(Number(ctx.lineWidth) || 0) * scale / 2 : 0;
    const shX = Number(ctx.shadowOffsetX) || 0;
    const shY = Number(ctx.shadowOffsetY) || 0;
    const shBlur = Number(ctx.shadowBlur) || 0;
    const drawShadow = shX !== 0 || shY !== 0 || shBlur > 0;
    const shadow = parseColor(ctx.shadowColor);
    let pen = ox;
    for (let i = 0; i < glyphs.length; i++) {
      const bmp = glyphBitmap(font, glyphs[i].gid, size);
      const gx = Math.round(pen + bmp.ox);
      const gy = Math.round(baseY + bmp.oy);
      if (drawShadow) {
        const blur = shBlur > 0.5 ? Math.min(3, shBlur / 2) : 0;
        const stamp = dilate(bmp.alpha, bmp.w, bmp.h, Math.max(radius, blur));
        blit(stamp.alpha, stamp.w, stamp.h, gx - stamp.shift + Math.round(shX), gy - stamp.shift + Math.round(shY), shadow);
      }
      if (mode === 'stroke') {
        if (radius > 0.2) {
          const stamp = dilate(bmp.alpha, bmp.w, bmp.h, radius);
          blit(stamp.alpha, stamp.w, stamp.h, gx - stamp.shift, gy - stamp.shift, color);
        }
      } else {
        blit(bmp.alpha, bmp.w, bmp.h, gx, gy, color);
      }
      pen += glyphs[i].adv + (i < glyphs.length - 1 ? gap : 0);
    }
  }

  ctx.canvas = canvas;
  return { canvas, ctx };
}

let _host: { canvas: any; ctx: any } | null | undefined;

export function acquireSoftTextHost(): { canvas: any; ctx: any } | null {
  if (_host !== undefined) return _host;
  _host = null;
  try {
    const src = typeof GameGlobal !== 'undefined' ? GameGlobal.__huahuaFontBytes : null;
    const made = createSoftTextCanvas(src);
    if (!made) {
      if (typeof GameGlobal !== 'undefined') GameGlobal.__huahuaSoftFont = src ? 'parse-fail' : 'no-bytes';
      return null;
    }
    made.canvas.width = 64;
    made.canvas.height = 64;
    made.ctx.font = '32px HuahuaUI';
    made.ctx.textBaseline = 'alphabetic';
    made.ctx.fillStyle = '#000000';
    made.ctx.fillText('花', 2, 50);
    const data = made.ctx.getImageData(0, 0, 64, 64).data as Uint8ClampedArray;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) ink++;
    if (typeof GameGlobal !== 'undefined') {
      GameGlobal.__huahuaSoftInk = ink;
      GameGlobal.__huahuaSoftFont = ink > 0 ? 'ok' : 'empty';
    }
    if (ink <= 0) return null;
    made.canvas.width = 1;
    made.canvas.height = 1;
    _host = made;
    return made;
  } catch (e) {
    if (typeof GameGlobal !== 'undefined') GameGlobal.__huahuaSoftFont = 'err:' + e;
    _host = null;
    return null;
  }
}

export function inspectSoftGlyph(src: ArrayBuffer | ArrayBufferView, code: number): { gid: number; advance: number; first: FontPoint | null } | null {
  const font = parseSoftFont(src);
  if (!font) return null;
  const gid = font.glyphId(code);
  const outline = font.outline(gid);
  return { gid, advance: font.advance(gid), first: outline[0]?.[0] ?? null };
}
