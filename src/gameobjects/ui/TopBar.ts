/**
 * 顶部信息栏 - 显示等级、体力、金币、花愿、花露、钻石
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

interface CurrencyDisplay {
  icon: PIXI.Text;
  value: PIXI.Text;
}

export class TopBar extends PIXI.Container {
  private _bg: PIXI.Graphics;
  private _levelText: PIXI.Text;
  private _displays: Map<string, CurrencyDisplay> = new Map();

  constructor() {
    super();

    // 背景
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0xFFFFFF, 0.9);
    this._bg.drawRoundedRect(0, 0, DESIGN_WIDTH, 80, 0);
    this._bg.endFill();
    // 底部阴影线
    this._bg.beginFill(0x000000, 0.05);
    this._bg.drawRect(0, 78, DESIGN_WIDTH, 2);
    this._bg.endFill();
    this.addChild(this._bg);

    // 等级
    this._levelText = new PIXI.Text('Lv.1', {
      fontSize: 18,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.position.set(16, 30);
    this.addChild(this._levelText);

    // 货币显示
    const items: [string, string, number][] = [
      ['stamina', '⚡', 140],
      ['gold', '💰', 260],
      ['huayuan', '🌸', 380],
      ['hualu', '💧', 500],
      ['diamond', '💎', 620],
    ];

    for (const [key, emoji, x] of items) {
      const icon = new PIXI.Text(emoji, { fontSize: 20 });
      icon.position.set(x, 26);
      this.addChild(icon);

      const value = new PIXI.Text('0', {
        fontSize: 16,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
      });
      value.position.set(x + 28, 30);
      this.addChild(value);

      this._displays.set(key, { icon, value });
    }

    this._bindEvents();
    this._updateAll();
  }

  private _bindEvents(): void {
    EventBus.on('currency:changed', () => this._updateAll());
    EventBus.on('currency:loaded', () => this._updateAll());
  }

  private _updateAll(): void {
    const state = CurrencyManager.state;
    this._levelText.text = `Lv.${state.level}`;
    this._setDisplay('stamina', `${state.stamina}`);
    this._setDisplay('gold', this._formatNum(state.gold));
    this._setDisplay('huayuan', this._formatNum(state.huayuan));
    this._setDisplay('hualu', this._formatNum(state.hualu));
    this._setDisplay('diamond', this._formatNum(state.diamond));
  }

  private _setDisplay(key: string, text: string): void {
    const display = this._displays.get(key);
    if (display) display.value.text = text;
  }

  private _formatNum(n: number): string {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }
}
