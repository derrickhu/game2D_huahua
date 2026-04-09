/**
 * 底部导航栏 - 5个tab
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

interface NavTab {
  name: string;
  label: string;
}

const TABS: NavTab[] = [
  { name: 'main', label: '合成' },
  { name: 'decoration', label: '装修' },
  { name: 'dressup', label: '换装' },
  { name: 'collection', label: '图鉴' },
  { name: 'social', label: '社交' },
];

export class BottomNav extends PIXI.Container {
  private _bg: PIXI.Graphics;
  private _tabContainers: PIXI.Container[] = [];
  private _activeIndex = 0;

  constructor() {
    super();

    // 背景
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0xFFFFFF, 0.95);
    this._bg.drawRoundedRect(0, 0, DESIGN_WIDTH, 90, 0);
    this._bg.endFill();
    this._bg.beginFill(0x000000, 0.05);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, 2);
    this._bg.endFill();
    this.addChild(this._bg);

    const tabWidth = DESIGN_WIDTH / TABS.length;

    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      const container = new PIXI.Container();
      container.position.set(i * tabWidth, 0);

      // 无 emoji：仅用文案，竖向居中
      const label = new PIXI.Text(tab.label, {
        fontSize: 15,
        fill: i === 0 ? COLORS.BUTTON_PRIMARY : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(tabWidth / 2, 45);
      label.name = 'label';
      container.addChild(label);

      // 交互
      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.hitArea = new PIXI.Rectangle(0, 0, tabWidth, 90);
      container.on('pointerdown', () => this._onTabClick(i));

      this.addChild(container);
      this._tabContainers.push(container);
    }
  }

  private _onTabClick(index: number): void {
    if (index === this._activeIndex) return;
    this._activeIndex = index;

    // 更新选中样式
    for (let i = 0; i < this._tabContainers.length; i++) {
      const label = this._tabContainers[i].getChildByName('label') as PIXI.Text;
      if (label) {
        label.style.fill = i === index ? COLORS.BUTTON_PRIMARY : COLORS.TEXT_LIGHT;
      }
    }

    EventBus.emit('nav:tabChanged', TABS[index].name);
  }
}
