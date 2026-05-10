/**
 * 构建期由 vite `define` 注入的全局常量。
 * 跑 `npm run build` 会被替换成 package.json.version 字面量，开发模式下也是同一份字符串。
 */
declare const __APP_VERSION__: string;
