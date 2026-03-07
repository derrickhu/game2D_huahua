/**
 * 全局游戏单例 - 持有 PIXI.Application 和核心引用
 */
import * as PIXI from 'pixi.js';
import { ShaderSystem } from '@pixi/core';
import { TweenManager } from './TweenManager';

/* ---- @pixi/unsafe-eval 内联 patch (防止 tree-shaking 移除) ---- */

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

// 直接 patch ShaderSystem 原型 —— 必须在 new PIXI.Application() 之前
Object.assign(ShaderSystem.prototype, {
  systemCheck() { /* 禁用 eval 检测 */ },
  syncUniforms(group: any, glProgram: any) {
    const self = this as any;
    patchedSyncUniforms(group, self.shader.program.uniformData, glProgram.uniformData, group.uniforms, self.renderer);
  },
});

/* ---- end unsafe-eval patch ---- */

class GameClass {
  app!: PIXI.Application;
  stage!: PIXI.Container;

  /** 设计分辨率 */
  designWidth = 750;
  designHeight = 1334;

  /** 实际屏幕尺寸（逻辑像素） */
  screenWidth = 375;
  screenHeight = 667;

  /** 缩放比 */
  scale = 1;

  /** 像素密度 */
  dpr = 1;

  private _initialized = false;

  init(canvas: any): void {
    if (this._initialized) return;

    // 获取屏幕信息
    const sysInfo = (typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null)
      ?.getSystemInfoSync?.();

    if (sysInfo) {
      this.screenWidth = sysInfo.screenWidth;
      this.screenHeight = sysInfo.screenHeight;
      this.dpr = sysInfo.pixelRatio || 2;
    }

    // 计算缩放：以宽度为基准适配
    this.scale = this.screenWidth / this.designWidth * this.dpr;

    const realWidth = this.screenWidth * this.dpr;
    const realHeight = this.screenHeight * this.dpr;

    canvas.width = realWidth;
    canvas.height = realHeight;

    this.app = new PIXI.Application({
      view: canvas,
      width: realWidth,
      height: realHeight,
      backgroundColor: 0xFFF5EE,
      resolution: 1,
      antialias: true,
    });

    this.stage = this.app.stage;

    if (!this.stage) {
      throw new Error(`[Game] PIXI.Application 创建失败: stage=${this.stage}, app=${!!this.app}`);
    }

    // 整体缩放到设计分辨率
    this.stage.scale.set(this.scale, this.scale);

    // 注册 ticker 更新 TweenManager
    this.app.ticker.add(() => {
      const dt = this.app.ticker.deltaMS / 1000;
      TweenManager.update(dt);
    });

    this._initialized = true;
    console.log(`[Game] 初始化完成: ${realWidth}x${realHeight}, scale=${this.scale.toFixed(2)}, dpr=${this.dpr}`);
  }

  /** 设计坐标转实际像素 */
  toReal(v: number): number {
    return v * this.scale;
  }

  /** 获取设计分辨率下的逻辑宽度 */
  get logicWidth(): number {
    return this.designWidth;
  }

  /** 获取设计分辨率下的逻辑高度 */
  get logicHeight(): number {
    return this.screenHeight / this.screenWidth * this.designWidth;
  }
}

export const Game = new GameClass();
