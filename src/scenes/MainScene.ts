/**
 * 主场景 - 合成经营主界面
 */
import * as PIXI from 'pixi.js';
import { Scene } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { BoardManager } from '@/managers/BoardManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { SaveManager } from '@/managers/SaveManager';
import { BoardView } from '@/gameobjects/board/BoardView';
import { TopBar } from '@/gameobjects/ui/TopBar';
import { BottomNav } from '@/gameobjects/ui/BottomNav';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

export class MainScene implements Scene {
  readonly name = 'main';
  readonly container: PIXI.Container;

  private _boardView!: BoardView;
  private _topBar!: TopBar;
  private _bottomNav!: BottomNav;
  private _shopArea!: PIXI.Container;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    this._buildUI();
    this._boardView.refresh();

    // 注册 ticker 更新
    Game.ticker.add(this._update, this);
  }

  onExit(): void {
    Game.ticker.remove(this._update, this);
  }

  private _buildUI(): void {
    // 顶部信息栏
    this._topBar = new TopBar();
    this._topBar.position.set(0, 0);
    this.container.addChild(this._topBar);

    // 店铺区域（简化版：店主 + 柜台）
    this._shopArea = new PIXI.Container();
    this._shopArea.position.set(0, 90);
    this._buildShopArea();
    this.container.addChild(this._shopArea);

    // 棋盘
    this._boardView = new BoardView();
    this.container.addChild(this._boardView);

    // 底部导航栏
    const navY = Game.logicHeight - 90;
    this._bottomNav = new BottomNav();
    this._bottomNav.position.set(0, navY);
    this.container.addChild(this._bottomNav);
  }

  private _buildShopArea(): void {
    // 店铺背景（紧凑版）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF0E0, 0.6);
    bg.drawRoundedRect(20, 0, DESIGN_WIDTH - 40, 260, 16);
    bg.endFill();
    this._shopArea.addChild(bg);

    // 花店招牌
    const title = new PIXI.Text('🌸 花语小筑 🌸', {
      fontSize: 24,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_WIDTH / 2, 10);
    this._shopArea.addChild(title);

    // 店主（Q版占位，缩小）
    const owner = new PIXI.Graphics();
    owner.beginFill(0xFFDDB8);
    owner.drawCircle(DESIGN_WIDTH / 2, 100, 40);
    owner.endFill();
    owner.beginFill(0x4A3728);
    owner.drawCircle(DESIGN_WIDTH / 2 - 12, 92, 4);
    owner.drawCircle(DESIGN_WIDTH / 2 + 12, 92, 4);
    owner.endFill();
    owner.lineStyle(2, 0x4A3728);
    owner.arc(DESIGN_WIDTH / 2, 105, 12, 0, Math.PI);
    this._shopArea.addChild(owner);

    const ownerLabel = new PIXI.Text('店主', {
      fontSize: 13,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    ownerLabel.anchor.set(0.5, 0);
    ownerLabel.position.set(DESIGN_WIDTH / 2, 148);
    this._shopArea.addChild(ownerLabel);

    // 柜台
    const counter = new PIXI.Graphics();
    counter.beginFill(0xD2B48C);
    counter.drawRoundedRect(60, 175, DESIGN_WIDTH - 120, 45, 8);
    counter.endFill();
    counter.beginFill(0xC4A882);
    counter.drawRoundedRect(60, 198, DESIGN_WIDTH - 120, 22, 8);
    counter.endFill();
    this._shopArea.addChild(counter);

    // 客人等候区提示
    const waitText = new PIXI.Text('— 客人等候区 —', {
      fontSize: 13,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    waitText.anchor.set(0.5, 0);
    waitText.position.set(DESIGN_WIDTH / 2, 230);
    this._shopArea.addChild(waitText);
  }

  private _update(): void {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    SaveManager.update(dt);
  }
}
