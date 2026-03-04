import Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT, COLORS, BOARD, IDLE, AUTO_SAVE_INTERVAL } from '../config/Constants';
import { Board } from '../gameobjects/board/Board';
import { BoardItem } from '../gameobjects/board/BoardItem';
import { Cell } from '../gameobjects/board/Cell';
import { CustomerManager } from '../managers/CustomerManager';
import { CurrencyManager } from '../managers/CurrencyManager';
import { SaveManager, SaveData } from '../managers/SaveManager';
import { EventManager, GameEvents } from '../managers/EventManager';
import { getNextLevelId, getItemInfo } from '../data/ItemData';
import { getBuildingConfig } from '../data/BuildingData';

export class MainScene extends Phaser.Scene {
  private board!: Board;
  private customerManager!: CustomerManager;
  private dragStartCell: Cell | null = null;
  private idleTimers: Phaser.Time.TimerEvent[] = [];
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

    // === 离线收益 ===
    this.processOfflineRewards();

    // === 自动存档 ===
    this.startAutoSave();
  }

  private createShopArea(): void {
    const shopBg = this.add.graphics();
    shopBg.fillGradientStyle(0xFFF0E0, 0xFFF0E0, 0xFFE4CC, 0xFFE4CC, 1);
    shopBg.fillRect(0, LAYOUT.TOP_BAR_HEIGHT, GAME_WIDTH, LAYOUT.SHOP_AREA_HEIGHT);

    const counter = this.add.graphics();
    counter.fillStyle(0xA1887F, 1);
    counter.fillRoundedRect(100, LAYOUT.SHOP_AREA_Y + 160, 550, 30, 6);
    counter.fillStyle(0xBCAAA4, 1);
    counter.fillRoundedRect(95, LAYOUT.SHOP_AREA_Y + 152, 560, 12, 4);

    this.createShopOwner();

    this.add.text(GAME_WIDTH / 2, LAYOUT.SHOP_AREA_Y + 20, '🌸 花语小筑 🌸', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#E91E63',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const divider = this.add.graphics();
    divider.fillStyle(0xE8D5C0, 0.5);
    divider.fillRect(0, LAYOUT.BOARD_AREA_Y - 2, GAME_WIDTH, 4);
  }

  private createShopOwner(): void {
    const ownerX = GAME_WIDTH / 2;
    const ownerY = LAYOUT.SHOP_AREA_Y + 110;

    const owner = this.add.graphics();
    owner.fillStyle(0xFFB6C1, 0.9);
    owner.fillEllipse(ownerX, ownerY + 20, 60, 70);
    owner.fillStyle(0xFFFFFF, 0.8);
    owner.fillEllipse(ownerX, ownerY + 25, 50, 55);
    owner.fillStyle(0xFFE0BD, 1);
    owner.fillCircle(ownerX, ownerY - 25, 28);
    owner.fillStyle(0x8D6E63, 1);
    owner.fillEllipse(ownerX, ownerY - 40, 56, 28);
    owner.fillEllipse(ownerX - 20, ownerY - 25, 16, 30);
    owner.fillEllipse(ownerX + 20, ownerY - 25, 16, 30);
    owner.fillStyle(0x333333, 1);
    owner.fillCircle(ownerX - 9, ownerY - 25, 4);
    owner.fillCircle(ownerX + 9, ownerY - 25, 4);
    owner.fillStyle(0xFFFFFF, 1);
    owner.fillCircle(ownerX - 7, ownerY - 27, 2);
    owner.fillCircle(ownerX + 11, ownerY - 27, 2);
    owner.fillStyle(0xFF9999, 0.3);
    owner.fillCircle(ownerX - 18, ownerY - 18, 6);
    owner.fillCircle(ownerX + 18, ownerY - 18, 6);
    owner.lineStyle(2, 0xE88888, 1);
    owner.beginPath();
    owner.arc(ownerX, ownerY - 17, 8, 0.2, Math.PI - 0.2);
    owner.strokePath();
    owner.fillStyle(0xFF69B4, 1);
    owner.fillCircle(ownerX + 22, ownerY - 42, 6);
    owner.fillStyle(0xFFFFFF, 1);
    owner.fillCircle(ownerX + 22, ownerY - 42, 3);
  }

  private createBoardArea(): void {
    const boardBg = this.add.graphics();
    boardBg.fillStyle(COLORS.BOARD_BG, 0.6);
    boardBg.fillRoundedRect(
      4,
      LAYOUT.BOARD_AREA_Y + 1,
      GAME_WIDTH - 8,
      LAYOUT.NAV_BAR_Y - LAYOUT.BOARD_AREA_Y - 2,
      12,
    );
    this.board = new Board(this, BOARD.INIT_ROWS, BOARD.INIT_COLS);
  }

  private setupInitialBoard(): void {
    const emptyCells = this.board.getEmptyCells();
    if (emptyCells.length >= 7) {
      this.board.placeItem(emptyCells[0], 'daily_1');
      this.board.placeItem(emptyCells[1], 'daily_1');
      this.board.placeItem(emptyCells[2], 'daily_1');
      this.board.placeItem(emptyCells[3], 'daily_2');
      this.board.placeItem(emptyCells[4], 'romantic_1');
      this.board.placeItem(emptyCells[5], 'romantic_1');
      this.board.placeBuilding(emptyCells[6], 'workbench');
    }
  }

  private setupDragAndDrop(): void {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (!(gameObject instanceof BoardItem)) return;
      const item = gameObject as BoardItem;

      // 策划案：锁定物品仍可拖拽！（不阻止交互）
      const cell = this.board.getCellAt(item.row, item.col);
      this.dragStartCell = cell;

      const worldMatrix = item.getWorldTransformMatrix();
      const worldX = worldMatrix.tx;
      const worldY = worldMatrix.ty;

      if (cell) {
        cell.removeItem();
      }
      this.add.existing(item);
      item.setPosition(worldX, worldY);
      item.setScale(1.15);
      item.setDepth(1000);
    });

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, _dragX: number, _dragY: number) => {
      if (!(gameObject instanceof BoardItem)) return;
      const item = gameObject as BoardItem;

      item.setPosition(_pointer.x, _pointer.y);

      this.clearHighlights();
      const targetCell = this.board.getCellAtWorldPosition(_pointer.x, _pointer.y);
      if (targetCell) {
        if (targetCell.isEmpty()) {
          targetCell.setHighlight(true, true);
        } else if (targetCell.hasItem() && targetCell.item) {
          const canMerge = this.canMerge(item, targetCell.item);
          targetCell.setHighlight(true, canMerge);
        }
      }
    });

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (!(gameObject instanceof BoardItem)) return;
      const item = gameObject as BoardItem;
      item.setScale(1);
      item.setDepth(0);
      this.clearHighlights();

      const worldX = pointer.x;
      const worldY = pointer.y;

      // 情况1：拖到棋盘格子
      const targetCell = this.board.getCellAtWorldPosition(worldX, worldY);
      if (targetCell) {
        // 1a：合成
        if (targetCell.hasItem() && targetCell.item) {
          if (this.canMerge(item, targetCell.item)) {
            this.doMerge(item, targetCell.item, targetCell);
            this.dragStartCell = null;
            return;
          }
        }

        // 1b：移动到空格
        if (targetCell.isEmpty()) {
          targetCell.placeItem(item);
          this.dragStartCell = null;
          EventManager.emit(GameEvents.ITEM_PLACED, { itemId: item.itemId });
          EventManager.emit(GameEvents.FLOWER_PLACED, { flowerId: item.itemId });
          return;
        }
      }

      // 情况2：无效位置 → 归位
      this.returnToOrigin(item);
    });
  }

  /**
   * 合成判断 — 策划案核心改动：
   * 锁定物品（isReserved）仍可合成！
   * 只需同品类+同线+同等级+未满级
   */
  private canMerge(a: BoardItem, b: BoardItem): boolean {
    return a.category === b.category
      && a.line === b.line
      && a.level === b.level
      && a.level < (getItemInfo(a.itemId)?.maxLevel ?? 99)
      && a !== b;
  }

  private doMerge(source: BoardItem, target: BoardItem, targetCell: Cell): void {
    const nextId = getNextLevelId(source.itemId);
    if (!nextId) {
      this.returnToOrigin(source);
      return;
    }

    // 如果被合成的物品是锁定的，通知客人系统解锁对应槽位
    if (source.isReserved) {
      EventManager.emit(GameEvents.ITEM_CONSUMED, { item: source });
    }
    if (target.isReserved) {
      EventManager.emit(GameEvents.ITEM_CONSUMED, { item: target });
    }

    // 移除目标物品
    targetCell.removeItem();
    target.destroy();

    // 合成特效
    this.playMergeEffect(targetCell.x, targetCell.y);

    // 源物品销毁
    source.destroy();

    // 放置新物品
    const newItem = this.board.placeItem(targetCell, nextId);
    newItem.playNewGlow();

    EventManager.emit(GameEvents.ITEM_MERGED, { itemId: nextId });
    EventManager.emit(GameEvents.FLOWER_MERGED, { flowerId: nextId });
  }

  private playMergeEffect(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.graphics();
      particle.fillStyle(0xFFD700, 1);
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

  private returnToOrigin(item: BoardItem): void {
    if (this.dragStartCell) {
      this.dragStartCell.placeItem(item);
    } else {
      const empty = this.board.getEmptyCells();
      if (empty.length > 0) {
        empty[0].placeItem(item);
      } else {
        item.destroy();
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

  /**
   * 挂机产出 — 双品类
   * 遍历棋盘上所有建筑，每个建筑按配置间隔自动产出
   */
  private startIdleProduction(): void {
    const timer = this.time.addEvent({
      delay: IDLE.PRODUCE_INTERVAL,
      callback: () => {
        if (this.board.isFull()) return;

        // 遍历所有建筑，每个建筑产出一个物品
        const buildings = this.board.getAllBuildings();
        for (const { building } of buildings) {
          if (this.board.isFull()) break;
          const config = getBuildingConfig(building.buildingId);
          if (!config) continue;
          // 挂机自动产出：选择第一个可用线（初级建筑只有一个线）
          const line = config.selectableLines[0];
          building.produce(line);
        }
      },
      loop: true,
    });
    this.idleTimers.push(timer);
  }

  /**
   * 离线收益计算
   */
  private processOfflineRewards(): void {
    const saveData = SaveManager.load();
    if (!saveData || !saveData.idle) return;

    const lastActive = saveData.idle.lastActiveTime;
    const now = Date.now();
    const offlineMs = Math.min(now - lastActive, IDLE.MAX_OFFLINE_MS);

    if (offlineMs < 60000) return; // 不到1分钟不计算

    const offlineMinutes = Math.floor(offlineMs / 60000);

    // 每分钟按建筑数量给离线金币奖励
    const buildings = this.board.getAllBuildings();
    const buildingCount = Math.max(buildings.length, 1);
    const goldPerMinute = buildingCount * 2;
    const totalGold = offlineMinutes * goldPerMinute;

    // 离线产出物品（每5分钟产出一个）
    const offlineItems = Math.min(Math.floor(offlineMinutes / 5), 10); // 最多10个
    let placedItems = 0;

    for (let i = 0; i < offlineItems; i++) {
      if (this.board.isFull()) break;
      // 随机从已有建筑产出
      if (buildings.length > 0) {
        const { building } = Phaser.Utils.Array.GetRandom(buildings);
        const config = getBuildingConfig(building.buildingId);
        if (config) {
          const line = config.selectableLines[0];
          building.produce(line);
          placedItems++;
        }
      } else {
        this.board.placeItemAnywhere('daily_1');
        placedItems++;
      }
    }

    if (totalGold > 0) {
      CurrencyManager.addGold(totalGold);
    }

    // 显示离线收益弹窗
    if (totalGold > 0 || placedItems > 0) {
      this.showOfflineRewardPopup(offlineMinutes, totalGold, placedItems);
    }
  }

  private showOfflineRewardPopup(minutes: number, gold: number, items: number): void {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;

    const parts: string[] = [`离线 ${timeStr}`];
    if (gold > 0) parts.push(`获得 ${gold} 💰`);
    if (items > 0) parts.push(`产出 ${items} 个物品`);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.4);
    overlay.fillRect(0, 0, GAME_WIDTH, this.scale.height);
    overlay.setDepth(2000);

    const popupBg = this.add.graphics();
    popupBg.fillStyle(0xFFFFFF, 0.95);
    popupBg.fillRoundedRect(GAME_WIDTH / 2 - 160, this.scale.height / 2 - 80, 320, 160, 16);
    popupBg.setDepth(2001);

    const title = this.add.text(GAME_WIDTH / 2, this.scale.height / 2 - 50, '欢迎回来！', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#E91E63',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2002);

    const content = this.add.text(GAME_WIDTH / 2, this.scale.height / 2, parts.join('\n'), {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5).setDepth(2002);

    // 2秒后自动关闭
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [overlay, popupBg, title, content],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          overlay.destroy();
          popupBg.destroy();
          title.destroy();
          content.destroy();
        },
      });
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
    // 暂无每帧更新逻辑
  }
}
