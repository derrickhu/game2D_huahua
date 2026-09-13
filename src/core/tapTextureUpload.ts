/**
 * 对齐 xiaochu2：假 canvas 不能走 texImage2D 的 DOM 重载，必须走 9 参像素通道。
 */

export function isSyntheticCanvas(source: any): boolean {
  return !!source && (source.__tapTextWrap === true || source.__huahuaMeasure === true);
}

export function canReadPixels(source: any): boolean {
  if (!source || typeof source.getContext !== 'function') return false;
  try {
    const ctx = source.getContext('2d');
    return !!ctx && typeof ctx.getImageData === 'function';
  } catch {
    return false;
  }
}

function toUint8(data: any): Uint8Array | null {
  if (!data) return null;
  if (data instanceof Uint8Array) return data;
  if (data.buffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || undefined);
  if (typeof data.length === 'number') return new Uint8Array(data as ArrayLike<number>);
  return null;
}

export function uploadCanvasPixels(
  renderer: any,
  baseTexture: any,
  glTexture: any,
  source: any,
): boolean {
  try {
    const gl = renderer?.gl;
    if (!gl || !canReadPixels(source)) return false;

    const w = Math.max(1, Number(source.width) | 0);
    const h = Math.max(1, Number(source.height) | 0);
    const ctx = source.getContext('2d');
    const pixels = toUint8(ctx.getImageData(0, 0, w, h)?.data);
    if (!pixels || pixels.length < w * h * 4) return false;

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, baseTexture?.alphaMode > 0 ? 1 : 0);
    glTexture.width = w;
    glTexture.height = h;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      glTexture.internalFormat,
      w,
      h,
      0,
      baseTexture.format,
      glTexture.type,
      pixels,
    );
    return true;
  } catch {
    return false;
  }
}
