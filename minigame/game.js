/**
 * 花语小筑 - 微信小游戏入口
 */

// 加载适配器（模拟 BOM/DOM 环境）
require('./weapp-adapter.js');

// 加载游戏代码（Vite 构建输出的 IIFE bundle）
require('./game-bundle.js');

console.log('[花语小筑] 游戏启动完成');
