import Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT, COLORS, BOARD, FlowerFamily } from '../config/Constants';
import { Board } from '../gameobjects/board/Board';
import { FlowerItem } from '../gameobjects/board/FlowerItem';
import { Cell } from '../gameobjects/board/Cell';
import { CustomerManager } from '../managers/CustomerManager';
import { CurrencyManager } from '../managers/CurrencyManager';
import { SaveManager, SaveData } from '../managers/SaveManager';
import { EventManager, GameEvents } from '../managers/EventManager';
import { getNextLevelId, getFlowerConfig } from '../data/FlowerData';
import { AUTO_SAVE_INTERVAL, IDLE } from '../config/Constants';

export class MainScene extends Phaser.Scene {
  private board!: Board;
  private customerManager!: CustomerManager;
  private dragStartCell: Cell | null = null;
  private idleTimer!: Phaser.Time.TimerEvent;
  private autoSaveTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainScene' });
  }

  create(): void {
    // === 花店场景区域B ===
    this.createShopArea();

    // === 合成棋盘区域C ===
    this.createBoardArea();

    // === 客人系统 ===
    this.customerManager = new CustomerManager(this);
    this.customerManager.setBoard(this.board);
    this.customerManager.startRefreshLoop();

    // === 拖拽交互 ===
    this.setupDragAndDrop();

    // === 初始摆放 ===
    this.setupInitialBoard();

    // === 挂机产出 ===
    this.startIdleProduction();

    // === 自动存档 ===
    this.startAutoSave();
  }

  private createShopArea(): void {
    // 花店背景（占位：渐变色块）
    const shopBg = this.add.graphics();
    // 温暖的花店背景色
    shopBg.fillGradientStyle(0xFFF0E0, 0xFFF0E0, 0xFFE4CC, 0xFFE4CC, 1);
    shopBg.fillRect(0, LAYOUT.TOP_BAR_HEIGHT, GAME_WIDTH, LAYOUT.SHOP_AREA_HEIGHT);

    // 柜台（占位：棕色矩形）
    const counter = this.add.graphics();
    counter.fillStyle(0xA1887F, 1);
    counter.fillRoundedRect(100, LAYOUT.SHOP_AREA_Y + 160, 550, 30, 6);
    // 柜台顶面
    counter.fillStyle(0xBCAAA4, 1);
    counter.fillRoundedRect(95, LAYOUT.SHOP_AREA_Y + 152, 560, 12, 4);

    // 店主（占位：简笔Q版）
    this.createShopOwner();

    // 装饰文字
    this.add.text(GAME_WIDTH / 2, LAYOUT.SHOP_AREA_Y + 20, '🌸 花语小筑 🌸', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#E91E63',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 区域分隔线
    const divider = this.add.graphics();
    divider.fillStyle(0xE8D5C0, 0.5);
    divider.fillRect(0, LAYOUT.BOARD_AREA_Y - 2, GAME_WIDTH, 4);
  }

  private createShopOwner(): void {
    const ownerX = GAME_WIDTH / 2;
    const ownerY = LAYOUT.SHOP_AREA_Y + 110;

    const owner = this.add.graphics();
    // 身体
    owner.fillStyle(0xFFB6C1, 0.9);
    owner.fillEllipse(ownerX, ownerY + 20, 60, 70);
    // 围裙
    owner.fillStyle(0xFFFFFF, 0.8);
    owner.fillEllipse(ownerX, ownerY + 25, 50, 55);
    // 头
    owner.fillStyle(0xFFE0BD, 1);
    owner.fillCircle(ownerX, ownerY - 25, 28);
    // 头发
    owner.fillStyle(0x8D6E63, 1);
    owner.fillEllipse(ownerX, ownerY - 40, 56, 28);
    owner.fillEllipse(ownerX - 20, ownerY - 25, 16, 30);
    owner.fillEllipse(ownerX + 20, ownerY - 25, 16, 30);
    // 眼睛
    owner.fillStyle(0x333333, 1);
    owner.fillCircle(ownerX - 9, ownerY - 25, 4);
    owner.fillCircle(ownerX + 9, ownerY - 25, 4);
    // 眼睛高光
    owner.fillStyle(0xFFFFFF, 1);
    owner.fillCircle(ownerX - 7, ownerY - 27, 2);
    owner.fillCircle(ownerX + 11, ownerY - 27, 2);
    // 腮红
    owner.fillStyle(0xFF9999, 0.3);
    owner.fillCircle(ownerX - 18, ownerY - 18, 6);
    owner.fillCircle(ownerX + 18, ownerY - 18, 6);
    // 微笑
    owner.lineStyle(2, 0xE88888, 1);
    owner.beginPath();
    owner.arc(ownerX, ownerY - 17, 8, 0.2, Math.PI - 0.2);
    owner.strokePath();
    // 发饰小花
    owner.fillStyle(0xFF69B4, 1);
    owner.fillCircle(ownerX + 22, ownerY - 42, 6);
    owner.fillStyle(0xFFFFFF, 1);
    owner.fillCircle(ownerX + 22, ownerY - 42, 3);
  }

  private createBoardArea(): void {
    // 棋盘区背景（铺满下半屏）
    const boardBg = this.add.graphics();
    boardBg.fillStyle(COLORS.BOARD_BG, 0.6);
    boardBg.fillRoundedRect(
      4,
      LAYOUT.BOARD_AREA_Y + 1,
      GAME_WIDTH - 8,
      LAYOUT.NAV_BAR_Y - LAYOUT.BOARD_AREA_Y - 2,
      12,
    );

    // 创建棋盘
    this.board = new Board(this, BOARD.INIT_ROWS, BOARD.INIT_COLS);
  }

  private setupInitialBoard(): void {
    const emptyCells = this.board.getEmptyCells();
    if (emptyCells.length >= 7) {
      // 日常花系
      this.board.placeFlower(emptyCells[0], 'daily_1');
      this.board.placeFlower(emptyCells[1], 'daily_1');
      this.board.placeFlower(emptyCells[2], 'daily_1');
      this.board.placeFlower(emptyCells[3], 'daily_2');
      // 浪漫花系
      this.board.placeFlower(emptyCells[4], 'romantic_1');
      this.board.placeFlower(emptyCells[5], 'romantic_1');
      // 建筑
      this.board.placeBuilding(emptyCells[6], 'workbench');
    }
  }

  private setupDragAndDrop(): void {
    // 调试：监听 pointerdown
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const sm = this.scale;
      console.log('[MainScene] pointerdown',
        'xy:', Math.round(pointer.x), Math.round(pointer.y),
        'isDown:', pointer.isDown,
        'wasTouch:', pointer.wasTouch,
        'id:', pointer.id,
        'displayScale:', sm.displayScale.x.toFixed(3), sm.displayScale.y.toFixed(3),
        'interactive:', (this.input as any)._list?.length || 0);
    });

    // 调试：监听 gameobjectdown — 只有命中交互对象时才触发
    this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      console.log('[MainScene] gameobjectdown HIT!', gameObject.constructor.name,
        'at:', Math.round((gameObject as any).x), Math.round((gameObject as any).y));
    });

    // 调试：监听 pointermove
    let moveCount = 0;
    this.input.on('pointermove', () => {
      moveCount++;
      if (moveCount <= 3) {
        console.log('[MainScene] pointermove #' + moveCount);
      }
    });

    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      console.log('[MainScene] dragstart!', gameObject.constructor.name);
      if (!(gameObject instanceof FlowerItem)) return;
      const flower = gameObject as FlowerItem;

      // 被客人锁定的花不能拖拽
      if (flower.isReserved) return;

      // 记录起始格子
      const cell = this.board.getCellAt(flower.row, flower.col);
      this.dragStartCell = cell;

      // 计算花朵当前世界坐标（嵌套 Container: Board → Cell → Flower）
      const worldMatrix = flower.getWorldTransformMatrix();
      const worldX = worldMatrix.tx;
      const worldY = worldMatrix.ty;

      // 从 cell 中移除，放到 scene 顶层
      if (cell) {
        cell.removeFlower();
      }
      this.add.existing(flower);

      // 设置为世界坐标
      flower.setPosition(worldX, worldY);

      // 放大 + 置顶
      flower.setScale(1.15);
      flower.setDepth(1000);

      console.log('[MainScene] dragstart worldPos:', Math.round(worldX), Math.round(worldY));
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, _dragX: number, _dragY: number) => {
      if (!(gameObject instanceof FlowerItem)) return;
      const flower = gameObject as FlowerItem;

      // 不使用 Phaser 提供的 dragX/dragY（因为 dragstart 中改变了坐标系，偏移量不准）
      // 直接使用 pointer 坐标
      flower.setPosition(pointer.x, pointer.y);

      // 高亮可放置的目标
      this.clearHighlights();
      const targetCell = this.board.getCellAtWorldPosition(pointer.x, pointer.y);
      if (targetCell) {
        if (targetCell.isEmpty()) {
          targetCell.setHighlight(true, true);
        } else if (targetCell.hasFlower() && targetCell.flower) {
          const canMerge = this.canMerge(flower, targetCell.flower);
          targetCell.setHighlight(true, canMerge);
        }
      }
    });

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (!(gameObject instanceof FlowerItem)) return;
      const flower = gameObject as FlowerItem;
      flower.setScale(1);
      flower.setDepth(0);
      this.clearHighlights();

      // 使用 pointer 的最终坐标
      const worldX = pointer.x;
      const worldY = pointer.y;
      console.log('[MainScene] dragend xy:', Math.round(worldX), Math.round(worldY),
        'flower:', flower.flowerId, 'family:', flower.family, 'lv:', flower.level);

      // 情况1：拖到客人区域 → 交付
      if (this.customerManager.isInCustomerArea(worldX, worldY)) {
        const delivered = this.customerManager.tryDeliver(flower, worldX, worldY);
        if (delivered) {
          console.log('[MainScene] dragend → 交付成功');
          flower.destroy();
          this.dragStartCell = null;
          return;
        }
      }

      // 情况2：拖到棋盘格子
      const targetCell = this.board.getCellAtWorldPosition(worldX, worldY);
      console.log('[MainScene] dragend → targetCell:', targetCell ? `[${targetCell.row},${targetCell.col}]` : 'null',
        'hasFlower:', targetCell?.hasFlower(),
        'targetFlower:', targetCell?.flower?.flowerId,
        'isEmpty:', targetCell?.isEmpty());
      if (targetCell) {
        // 2a：拖到有花朵的格子 → 合成
        if (targetCell.hasFlower() && targetCell.flower) {
          const canMerge = this.canMerge(flower, targetCell.flower);
          console.log('[MainScene] dragend → canMerge:', canMerge,
            'src:', flower.flowerId, flower.family, flower.level,
            'tgt:', targetCell.flower.flowerId, targetCell.flower.family, targetCell.flower.level,
            'sameRef:', flower === targetCell.flower);
          if (canMerge) {
            this.doMerge(flower, targetCell.flower, targetCell);
            this.dragStartCell = null;
            return;
          }
        }

        // 2b：拖到空格 → 移动
        if (targetCell.isEmpty()) {
          console.log('[MainScene] dragend → 移动到空格');
          targetCell.placeFlower(flower);
          this.dragStartCell = null;
          EventManager.emit(GameEvents.FLOWER_PLACED, { flowerId: flower.flowerId });
          return;
        }
      }

      // 情况3：无效位置 → 归位
      console.log('[MainScene] dragend → 归位');
      this.returnToOrigin(flower);
    });
  }

  private canMerge(a: FlowerItem, b: FlowerItem): boolean {
    return a.family === b.family
      && a.level === b.level
      && a.level < 6
      && a !== b
      && !a.isReserved
      && !b.isReserved;
  }

  private doMerge(source: FlowerItem, target: FlowerItem, targetCell: Cell): void {
    const nextId = getNextLevelId(source.flowerId);
    if (!nextId) {
      this.returnToOrigin(source);
      return;
    }

    // 移除目标花朵
    targetCell.removeFlower();
    target.destroy();

    // 合成特效：闪光
    this.playMergeEffect(targetCell.x, targetCell.y);

    // 源花朵飞向目标位置并消失
    source.destroy();

    // 放置新花朵
    const newFlower = this.board.placeFlower(targetCell, nextId);
    newFlower.playNewGlow();

    EventManager.emit(GameEvents.FLOWER_MERGED, { flowerId: nextId });
  }

  private playMergeEffect(x: number, y: number): void {
    // 闪光特效（程序生成）
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.graphics();
      particle.fillStyle(0xFFD700, 1);
      // 用小菱形代替star
      particle.fillPoints([
        new Phaser.Geom.Point(0, -6),
        new Phaser.Geom.Point(4, 0),
        new Phaser.Geom.Point(0, 6),
        new Phaser.Geom.Point(-4, 0),
      ], true);
      particle.setPosition(x, y);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }

    // 中心闪光
    const flash = this.add.graphics();
    flash.fillStyle(0xFFFFFF, 0.8);
    flash.fillCircle(x, y, 30);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  private returnToOrigin(flower: FlowerItem): void {
    if (this.dragStartCell) {
      this.dragStartCell.placeFlower(flower);
    } else {
      // 无法归位，放到任意空格
      const empty = this.board.getEmptyCells();
      if (empty.length > 0) {
        empty[0].placeFlower(flower);
      } else {
        flower.destroy();
      }
    }
    this.dragStartCell = null;
  }

  private clearHighlights(): void {
    for (let r = 0; r < this.board.getRows(); r++) {
      for (let c = 0; c < this.board.getCols(); c++) {
        const cell = this.board.getCellAt(r, c);
        if (cell) cell.setHighlight(false);
      }
    }
  }

  // 挂机产出
  private startIdleProduction(): void {
    this.idleTimer = this.time.addEvent({
      delay: IDLE.PRODUCE_INTERVAL,
      callback: () => {
        if (this.board.isFull()) return;
        // 随机产出日常花系1级花（阶段1只有日常花系）
        this.board.placeFlowerAnywhere('daily_1');
      },
      loop: true,
    });
  }

  // 自动存档
  private startAutoSave(): void {
    this.autoSaveTimer = this.time.addEvent({
      delay: AUTO_SAVE_INTERVAL,
      callback: () => this.saveGame(),
      loop: true,
    });
  }

  private saveGame(): void {
    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      currency: CurrencyManager.serialize(),
      board: this.board.serialize(),
      idle: {
        lastActiveTime: Date.now(),
      },
    };
    SaveManager.save(data);
  }

  update(_time: number, _delta: number): void {
    // 阶段1暂无需要每帧更新的逻辑
  }
}
