import * as PIXI from 'pixi.js';

const FRAG = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 inputPixel;
uniform vec4 inputClamp;
uniform vec3 uOutlineRgb;
uniform float uThicknessPx;

void main(void) {
    vec2 uv = vTextureCoord;
    vec2 d = inputPixel.zw * uThicknessPx;

    vec4 col = texture2D(uSampler, clamp(uv, inputClamp.xy, inputClamp.zw));
    float a = col.a;

    float ax = d.x;
    float ay = d.y;
    float amax = a;
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(ax, 0.0), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv - vec2(ax, 0.0), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(0.0, ay), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv - vec2(0.0, ay), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(ax, ay), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(-ax, ay), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(ax, -ay), inputClamp.xy, inputClamp.zw)).a);
    amax = max(amax, texture2D(uSampler, clamp(uv + vec2(-ax, -ay), inputClamp.xy, inputClamp.zw)).a);

    float outer = smoothstep(0.03, 0.12, amax) * (1.0 - smoothstep(0.06, 0.38, a));

    if (outer > 0.35) {
        float oa = max(a, outer);
        gl_FragColor = vec4(uOutlineRgb * oa, oa);
    } else {
        gl_FragColor = col;
    }
}
`;

/**
 * 沿纹理 alpha 外缘的细亮描边（无 Blur 晕光），用于家具选中 / 新拖入预览。
 * 依赖 Pixi Filter 全局 uniform：inputPixel、inputClamp。
 */
export function createFurnitureAlphaOutlineFilter(): PIXI.Filter {
  const f = new PIXI.Filter(undefined, FRAG, {
    uOutlineRgb: new Float32Array([1.0, 0.96, 0.18]),
    uThicknessPx: 1.05,
  });
  f.padding = 4;
  return f;
}
