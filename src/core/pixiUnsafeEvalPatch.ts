/**
 * @pixi/unsafe-eval 内联 patch + PIXI.settings.ADAPTER 配置
 * 必须在 new PIXI.Application() 之前执行
 * 单独文件，避免 Game.ts 因副作用代码被 bundler 打包多份
 */
import { AccessibilityManager } from '@pixi/accessibility';
import { ShaderSystem, BaseImageResource, Texture, BaseTexture, extensions } from '@pixi/core';
import { settings } from '@pixi/settings';
import { Platform } from '@/core/PlatformService';
import { getNativePlatformApi } from './platformDetect';
import { installTapTextRaster, shouldInstallTapTextRaster } from './tapTextRaster';
import { isSyntheticCanvas, uploadCanvasPixels } from './tapTextureUpload';

declare const GameGlobal: any;
declare const qg: any;
declare const qa: any;

try {
  // 小游戏无 DOM button，无障碍插件会在 Application/Renderer 初始化时再 createCanvas
  extensions.remove(AccessibilityManager);
} catch { /* 已移除或环境不支持 */ }

// ======== 配置 PIXI.settings.ADAPTER ========
// 微信/抖音：走 createOffscreenCanvas / createCanvas。
// Tap / 华为：ADAPTER 只能给假画布/文字包装，WebGL 用主屏那一块。
const _api: any = getNativePlatformApi();
if (_api || Platform.isCanvasHostGuarded) {
  try {
    let _useOffscreen = false;
    try {
      if (!Platform.isCanvasHostGuarded && typeof _api?.createOffscreenCanvas === 'function') {
        const _test = _api.createOffscreenCanvas({ type: '2d', width: 1, height: 1 });
        const _testCtx = _test.getContext('2d');
        if (_testCtx) _useOffscreen = true;
      }
    } catch (_) { /* */ }

    const _isMainCanvas = (c: any): boolean => {
      try {
        return !!(c && typeof GameGlobal !== 'undefined' && (
          (GameGlobal.canvas && c === GameGlobal.canvas)
          || (GameGlobal.__hostCanvas && c === GameGlobal.__hostCanvas)
        ));
      } catch {
        return false;
      }
    };

    const _measureCanvas = (w?: number, h?: number): any => {
      const width = w || 1;
      const height = h || 1;
      const ctx: any = {
        fillStyle: '',
        font: '16px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        measureText: (s: string) => ({ width: String(s || '').length * 10 }),
        fillRect() {},
        clearRect() {},
        fillText() {},
        strokeText() {},
        drawImage() {},
        getImageData: (_x: number, _y: number, iw: number, ih: number) => ({
          data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih,
        }),
        putImageData() {},
        save() {},
        restore() {},
        scale() {},
        translate() {},
        setTransform() {},
        beginPath() {},
        closePath() {},
        createLinearGradient() { return { addColorStop() {} }; },
      };
      const canvas: any = {
        __huahuaMeasure: true,
        width,
        height,
        style: {},
        getContext(type: string) {
          if (type === '2d') return ctx;
          return null;
        },
        addEventListener() {},
        removeEventListener() {},
      };
      ctx.canvas = canvas;
      return canvas;
    };

    const _tryHost2d = (api: any): { canvas: any; ctx: any } | null => {
      if (!api) return null;
      try {
        if (typeof api.createOffscreenCanvas === 'function') {
          const c = api.createOffscreenCanvas({ type: '2d', width: 64, height: 64 });
          const ctx = c?.getContext?.('2d');
          if (ctx && typeof ctx.fillText === 'function') return { canvas: c, ctx };
        }
      } catch { /* */ }
      // Tap 的主屏已经在 adapter 里 createCanvas 过一次。这里再调会开出第二块 SurfaceView，
      // 主屏不再提交缓冲（OPPO 日志里的 InstantGameActivity#1，拆掉后窗口纯黑）。
      if (Platform.isTaptap) return null;
      try {
        if (typeof api.createCanvas === 'function') {
          const c = api.createCanvas();
          if (c && !_isMainCanvas(c) && !c.__huahuaMeasure && !c.__tapTextWrap) {
            const ctx = c.getContext?.('2d');
            if (ctx && typeof ctx.fillText === 'function') return { canvas: c, ctx };
          }
        }
      } catch { /* */ }
      return null;
    };

    const _tryHuawei2d = (): { canvas: any; ctx: any } | null => {
      const fromApi = _tryHost2d(typeof qg !== 'undefined' ? qg : typeof qa !== 'undefined' ? qa : null);
      if (fromApi) return fromApi;
      try {
        const runtime = typeof GameGlobal !== 'undefined' ? GameGlobal.__huahuaRuntime : null;
        const c = (typeof runtime?.createHuaweiOffscreenCanvas === 'function'
          ? runtime.createHuaweiOffscreenCanvas()
          : null)
          || (typeof GameGlobal !== 'undefined' && GameGlobal.__hostDocument
            ? GameGlobal.__hostDocument.createElement('canvas')
            : null);
        if (c && !_isMainCanvas(c)) {
          const ctx = c.getContext?.('2d');
          if (ctx && typeof ctx.fillText === 'function') return { canvas: c, ctx };
        }
      } catch { /* */ }
      return null;
    };

    const _createTapTextCanvas = shouldInstallTapTextRaster()
      ? installTapTextRaster(() => {
        if (Platform.isHuawei) return _tryHuawei2d();
        return _tryHost2d(_api);
      })
      : null;

    const _safeApiCanvas = (api: any, w?: number, h?: number): any => {
      if (!api) return null;
      try {
        if (typeof api.createOffscreenCanvas === 'function') {
          const c = api.createOffscreenCanvas({ type: '2d', width: w || 1, height: h || 1 });
          if (c && typeof c.getContext === 'function') return c;
        }
      } catch { /* */ }
      try {
        if (typeof api.createCanvas === 'function') {
          const c = api.createCanvas();
          if (c && typeof c.getContext === 'function') return c;
        }
      } catch { /* */ }
      return null;
    };

    const _create2DCanvas = (w?: number, h?: number): any => {
      try {
        if (Platform.isCanvasHostGuarded) {
          // 只开一块真实 2D，每个 Text 拿独立包装。禁止每字一块 createCanvas
          return _createTapTextCanvas ? _createTapTextCanvas(w, h) : _measureCanvas(w, h);
        }
        let c: any = null;
        if (_useOffscreen) {
          try {
            c = _api.createOffscreenCanvas({ type: '2d', width: w || 1, height: h || 1 });
          } catch (_) {
            c = _safeApiCanvas(_api, w, h);
          }
        } else {
          c = _safeApiCanvas(_api, w, h);
        }
        if (!c || typeof c.getContext !== 'function') return _measureCanvas(w, h);
        if (w !== undefined) c.width = w;
        if (h !== undefined) c.height = h;
        return c;
      } catch {
        return _measureCanvas(w, h);
      }
    };

    settings.ADAPTER = {
      createCanvas: _create2DCanvas,
      getCanvasRenderingContext2D: (): any => {
        if (Platform.isCanvasHostGuarded) {
          return (typeof GameGlobal !== 'undefined' && GameGlobal.CanvasRenderingContext2D) || Object;
        }
        try {
          const c = _create2DCanvas(1, 1);
          const ctx = c.getContext('2d');
          return ctx ? ctx.constructor : Object;
        } catch { return Object; }
      },
      getWebGLRenderingContext: (): any => {
        // 探测阶段禁止 createCanvas+getContext('webgl')
        return (typeof GameGlobal !== 'undefined' && GameGlobal.WebGLRenderingContext) || Object;
      },
      getNavigator: (): any => ({
        userAgent: 'wxgame',
        gpu: null,
      }),
      getBaseUrl: (): string => '',
      getFontFaceSet: (): any => null,
      fetch: ((_url: any, _opts?: any): any => {
        return Promise.reject(new Error('fetch not available in mini game'));
      }) as any,
      parseXML: ((_xml: string): any => null) as any,
    };
  } catch (e) {
    console.warn('[pixiPatch] ADAPTER 配置失败:', e);
  }
}

if (!(ShaderSystem.prototype as any).__patched) {

const GLSL_TO_SINGLE_SETTERS: Record<string, (gl: any, loc: any, cv: any, v: any) => void> = {
  vec3(gl, loc, cv, v) { (cv[0]!==v[0]||cv[1]!==v[1]||cv[2]!==v[2])&&(cv[0]=v[0],cv[1]=v[1],cv[2]=v[2],gl.uniform3f(loc,v[0],v[1],v[2])); },
  int(gl, loc, _c, v) { gl.uniform1i(loc, v); },
  ivec2(gl, loc, _c, v) { gl.uniform2i(loc, v[0], v[1]); },
  ivec3(gl, loc, _c, v) { gl.uniform3i(loc, v[0], v[1], v[2]); },
  ivec4(gl, loc, _c, v) { gl.uniform4i(loc, v[0], v[1], v[2], v[3]); },
  uint(gl, loc, _c, v) { gl.uniform1ui(loc, v); },
  uvec2(gl, loc, _c, v) { gl.uniform2ui(loc, v[0], v[1]); },
  uvec3(gl, loc, _c, v) { gl.uniform3ui(loc, v[0], v[1], v[2]); },
  uvec4(gl, loc, _c, v) { gl.uniform4ui(loc, v[0], v[1], v[2], v[3]); },
  bvec2(gl, loc, _c, v) { gl.uniform2i(loc, v[0], v[1]); },
  bvec3(gl, loc, _c, v) { gl.uniform3i(loc, v[0], v[1], v[2]); },
  bvec4(gl, loc, _c, v) { gl.uniform4i(loc, v[0], v[1], v[2], v[3]); },
  mat2(gl, loc, _c, v) { gl.uniformMatrix2fv(loc, false, v); },
  mat4(gl, loc, _c, v) { gl.uniformMatrix4fv(loc, false, v); },
};
const GLSL_TO_ARRAY_SETTERS: Record<string, (gl: any, loc: any, cv: any, v: any) => void> = {
  float(gl, loc, _c, v) { gl.uniform1fv(loc, v); },
  vec2(gl, loc, _c, v) { gl.uniform2fv(loc, v); },
  vec3(gl, loc, _c, v) { gl.uniform3fv(loc, v); },
  vec4(gl, loc, _c, v) { gl.uniform4fv(loc, v); },
  int(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  ivec2(gl, loc, _c, v) { gl.uniform2iv(loc, v); },
  ivec3(gl, loc, _c, v) { gl.uniform3iv(loc, v); },
  ivec4(gl, loc, _c, v) { gl.uniform4iv(loc, v); },
  uint(gl, loc, _c, v) { gl.uniform1uiv(loc, v); },
  uvec2(gl, loc, _c, v) { gl.uniform2uiv(loc, v); },
  uvec3(gl, loc, _c, v) { gl.uniform3uiv(loc, v); },
  uvec4(gl, loc, _c, v) { gl.uniform4uiv(loc, v); },
  bool(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  bvec2(gl, loc, _c, v) { gl.uniform2iv(loc, v); },
  bvec3(gl, loc, _c, v) { gl.uniform3iv(loc, v); },
  bvec4(gl, loc, _c, v) { gl.uniform4iv(loc, v); },
  sampler2D(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  samplerCube(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
  sampler2DArray(gl, loc, _c, v) { gl.uniform1iv(loc, v); },
};

function patchedSyncUniforms(group: any, uniformData: any, ud: any, uv: any, renderer: any): void {
  let textureCount = 0, v: any = null, cv: any = null;
  const gl = renderer.gl;
  for (const i in group.uniforms) {
    const data = uniformData[i], uvi = uv[i], udi = ud[i], gu = group.uniforms[i];
    if (!data) { if (gu.group === true) renderer.shader.syncUniformGroup(uvi); continue; }
    if (data.type==='float'&&data.size===1&&!data.isArray) { if(uvi!==udi.value){udi.value=uvi;gl.uniform1f(udi.location,uvi);} }
    else if (data.type==='bool'&&data.size===1&&!data.isArray) { if(uvi!==udi.value){udi.value=uvi;gl.uniform1i(udi.location,Number(uvi));} }
    else if ((data.type==='sampler2D'||data.type==='samplerCube'||data.type==='sampler2DArray')&&data.size===1&&!data.isArray) {
      renderer.texture.bind(uvi,textureCount); if(udi.value!==textureCount){udi.value=textureCount;gl.uniform1i(udi.location,textureCount);} textureCount++;
    } else if (data.type==='mat3'&&data.size===1&&!data.isArray) {
      gu.a!==void 0?gl.uniformMatrix3fv(udi.location,false,uvi.toArray(true)):gl.uniformMatrix3fv(udi.location,false,uvi);
    } else if (data.type==='vec2'&&data.size===1&&!data.isArray) {
      if(gu.x!==void 0){cv=udi.value;v=uvi;(cv[0]!==v.x||cv[1]!==v.y)&&(cv[0]=v.x,cv[1]=v.y,gl.uniform2f(udi.location,v.x,v.y));}
      else{cv=udi.value;v=uvi;(cv[0]!==v[0]||cv[1]!==v[1])&&(cv[0]=v[0],cv[1]=v[1],gl.uniform2f(udi.location,v[0],v[1]));}
    } else if (data.type==='vec4'&&data.size===1&&!data.isArray) {
      if(gu.width!==void 0){cv=udi.value;v=uvi;(cv[0]!==v.x||cv[1]!==v.y||cv[2]!==v.width||cv[3]!==v.height)&&(cv[0]=v.x,cv[1]=v.y,cv[2]=v.width,cv[3]=v.height,gl.uniform4f(udi.location,v.x,v.y,v.width,v.height));}
      else{cv=udi.value;v=uvi;(cv[0]!==v[0]||cv[1]!==v[1]||cv[2]!==v[2]||cv[3]!==v[3])&&(cv[0]=v[0],cv[1]=v[1],cv[2]=v[2],cv[3]=v[3],gl.uniform4f(udi.location,v[0],v[1],v[2],v[3]));}
    } else { (data.size===1&&!data.isArray?GLSL_TO_SINGLE_SETTERS:GLSL_TO_ARRAY_SETTERS)[data.type].call(null,gl,udi.location,udi.value,uvi); }
  }
}

Object.assign(ShaderSystem.prototype, {
  __patched: true,
  systemCheck() { /* 禁用 eval 检测 */ },
  syncUniforms(group: any, glProgram: any) {
    const self = this as any;
    patchedSyncUniforms(group, self.shader.program.uniformData, glProgram.uniformData, group.uniforms, self.renderer);
  },
});

// ======== 真机 Canvas 纹理 patch ========
// 微信小游戏真机 gl.texImage2D(canvas) 静默失败，getImageData 返回全黑。
// 策略：
// 1) Texture.WHITE → 直接用 fromBuffer 纯白像素，完全绕过 Canvas
// 2) PIXI.Text canvas → 用 toDataURL 转 Image 再上传（Image 上传真机可用）
const _isRealDevice = (() => {
  try {
    if (!_api) return false;
    const info = _api.getSystemInfoSync();
    return info.platform !== 'devtools';
  } catch { return false; }
})();

if (_isRealDevice) {
  // ---- 1) 强制用纯像素数据创建 Texture.WHITE ----
  const whitePixels = new Uint8Array(16 * 16 * 4);
  whitePixels.fill(255);
  const whiteBT = BaseTexture.fromBuffer(whitePixels, 16, 16);
  const whiteTex = new Texture(whiteBT);
  (whiteTex as any).destroy = () => {};
  // WHITE 是 getter 只读属性，必须用 defineProperty 覆盖
  try { Object.defineProperty(Texture, '_WHITE', { value: whiteTex, writable: true, configurable: true }); } catch (_e) { /* */ }
  try { Object.defineProperty(Texture, 'WHITE', { get: () => whiteTex, configurable: true }); } catch (_e) { /* */ }

  // ---- 2) 真机 Canvas 纹理上传修复 ----
  // 策略：永远先调用原始 upload（确保所有 GL 状态正确、Image 源正常工作），
  // 然后仅对 Canvas 源用 getImageData 读取像素并同步覆盖 GL 纹理。
  // 关键安全措施：
  // - 不调用 renderer.texture.bind()，避免触发递归 upload
  // - 用 toTempFilePathSync 存在性判断 Canvas（Image 无此方法）
  // - 加重入保护防止无限递归
  const _origUpload = BaseImageResource.prototype.upload;
  let _uploadLog = 0;
  let _inUpload = false;

  // 预检测 getImageData 是否返回有效像素
  let _canReadPixels = false;
  try {
    const tc = settings.ADAPTER.createCanvas(4, 4);
    const tctx = tc.getContext('2d');
    if (tctx) {
      tctx.fillStyle = '#FF0000';
      tctx.fillRect(0, 0, 4, 4);
      const td = tctx.getImageData(0, 0, 1, 1).data;
      _canReadPixels = td[0] > 200 && td[3] > 200;
    }
  } catch (_) { /* */ }

  BaseImageResource.prototype.upload = function (
    renderer: any, baseTexture: any, glTexture: any, source?: any,
  ): boolean {
    // 重入保护：如果已在 upload 中，直接走原始路径
    if (_inUpload) {
      return _origUpload.call(this, renderer, baseTexture, glTexture, source);
    }
    _inUpload = true;

    try {
      source = source || this.source;

      if (Platform.isCanvasHostGuarded && isSyntheticCanvas(source)) {
        return uploadCanvasPixels(renderer, baseTexture, glTexture, source);
      }

      let result = false;
      try {
        result = _origUpload.call(this, renderer, baseTexture, glTexture, source);
      } catch (e) {
        if (uploadCanvasPixels(renderer, baseTexture, glTexture, source)) return true;
        if (_uploadLog < 10) {
          console.warn('[pixiPatch] 纹理上传失败:', e);
          _uploadLog++;
        }
        return false;
      }

      // 2) 仅对 Canvas 源做像素补救
      // Canvas 独有 toTempFilePathSync，Image 对象没有
      if (_canReadPixels
          && source
          && source.width > 0 && source.height > 0
          && typeof source.getContext === 'function'
          && typeof source.toTempFilePathSync === 'function') {
        try {
          const ctx = source.getContext('2d');
          if (ctx && typeof ctx.getImageData === 'function') {
            const w = source.width;
            const h = source.height;
            const imageData = ctx.getImageData(0, 0, w, h);
            const pixels = new Uint8Array(imageData.data.buffer);

            // 原始 upload 已绑定纹理，直接用 GL 覆盖像素
            const gl = renderer.gl;
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
              baseTexture.alphaMode > 0 ? 1 : 0);
            gl.texImage2D(gl.TEXTURE_2D, 0, glTexture.internalFormat,
              w, h, 0, baseTexture.format, glTexture.type, pixels);
          }
        } catch (e) {
          if (_uploadLog < 10) {
            console.warn('[pixiPatch] canvas buffer 覆盖失败:', e);
            _uploadLog++;
          }
        }
      }

      return result;
    } finally {
      _inUpload = false;
    }
  };
}

} // end if !__patched
