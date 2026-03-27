/**
 * 物品视图 - 在格子中显示物品图标和等级
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { TextureCache } from '@/utils/TextureCache';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  bringToolEnergyToFront,
  createToolEnergySprite,
} from '@/utils/ToolEnergyBadge';
import { ToolSparkleLayer } from '@/utils/ToolSparkleLayer';

/** 格子内物品最大边长占格子的比例（其余为边距） */
const ITEM_CELL_FILL = 0.72;
/** 花束线资源留白多，在格子里单独放大，边距更小 */
const BOUQUET_CELL_FILL = 0.9;

export class ItemView extends PIXI.Container {
  private _iconBg: PIXI.Graphics;
  private _iconSprite: PIXI.Sprite | null = null;
  private _nameText: PIXI.Text;
  private _levelText: PIXI.Text;
  private _levelBg: PIXI.Graphics;
  private _cdOverlay: PIXI.Graphics;
  private _cdText: PIXI.Text;
  private _usesText: PIXI.Text;
  /** Lv2/Lv3 工具：本 CD 周期内剩余可产出次数（非 CD 时显示） */
  private _chargeText: PIXI.Text;
  private _lockBorder: PIXI.Graphics;
  /** 工具右下角体力标 */
  private _toolEnergySprite: PIXI.Sprite | null = null;
  /** 工具格白色星闪层（盖在图标上、体力标下） */
  private _toolSparkle: ToolSparkleLayer | null = null;
  /** 客人订单锁定：右下角完成角标（图） */
  private _orderBadge: PIXI.Sprite | null = null;
  /** 半解锁(PEEK) 丝带：必须在体力标等之上，放本容器内并始终置顶 */
  private _peekRibbon: PIXI.Sprite | null = null;

  private _itemId: string = '';

  constructor() {
    super();
    const cs = BoardMetrics.cellSize;

    // 图标占位背景（无纹理时的 fallback）
    this._iconBg = new PIXI.Graphics();
    this.addChild(this._iconBg);

    // 物品名字（fallback 时显示）
    this._nameText = new PIXI.Text('', {
      fontSize: 11,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: cs - 8,
      align: 'center',
    });
    this._nameText.anchor.set(0.5, 1);
    this._nameText.position.set(cs / 2, cs - 2);
    this.addChild(this._nameText);

    // 等级徽章背景
    this._levelBg = new PIXI.Graphics();
    this.addChild(this._levelBg);

    // 等级文字
    this._levelText = new PIXI.Text('', {
      fontSize: 10,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0.5, 0.5);
    this.addChild(this._levelText);

    // CD 冷却遮罩
    this._cdOverlay = new PIXI.Graphics();
    this._cdOverlay.visible = false;
    this.addChild(this._cdOverlay);

    // CD 倒计时文字
    this._cdText = new PIXI.Text('', {
      fontSize: 14,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this._cdText.anchor.set(0.5, 0.5);
    this._cdText.position.set(cs / 2, cs / 2);
    this._cdText.visible = false;
    this.addChild(this._cdText);

    // 客人锁定边框
    this._lockBorder = new PIXI.Graphics();
    this._lockBorder.visible = false;
    this.addChild(this._lockBorder);

    // 消耗型剩余次数（左下角）
    this._usesText = new PIXI.Text('', {
      fontSize: 10,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this._usesText.anchor.set(0, 1);
    this._usesText.position.set(4, cs - 2);
    this._usesText.visible = false;
    this.addChild(this._usesText);

    this._chargeText = new PIXI.Text('', {
      fontSize: 11,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 3,
    });
    this._chargeText.anchor.set(0.5, 0);
    this._chargeText.position.set(cs / 2, 3);
    this._chargeText.visible = false;
    this.addChild(this._chargeText);
  }

  setItem(itemId: string | null): void {
    if (!itemId) {
      this.setPeekRibbon(false);
      this.visible = false;
      this._itemId = '';
      this._chargeText.visible = false;
      this._hideToolEnergy();
      this._hideToolSparkle();
      this._hideOrderBadge();
      return;
    }

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this.setPeekRibbon(false);
      this.visible = false;
      this._chargeText.visible = false;
      this._hideToolEnergy();
      this._hideToolSparkle();
      this._hideOrderBadge();
      return;
    }

    this._itemId = itemId;
    this.visible = true;
    const cs = BoardMetrics.cellSize;

    const lineColor = this._getLineColor(def.line);

    // 清理旧 sprite
    if (this._iconSprite) {
      this.removeChild(this._iconSprite);
      this._iconSprite.destroy();
      this._iconSprite = null;
    }

    const texture = TextureCache.get(def.icon);
    if (texture) {
      // 有纹理：显示图片
      this._iconBg.clear();
      this._nameText.visible = false;

      this._iconSprite = new PIXI.Sprite(texture);
      const fill =
        (def.line === FlowerLine.BOUQUET || def.line === FlowerLine.WRAP) ? BOUQUET_CELL_FILL : ITEM_CELL_FILL;
      const maxSize = cs * fill;
      const scaleX = maxSize / texture.width;
      const scaleY = maxSize / texture.height;
      const s = Math.min(scaleX, scaleY);
      this._iconSprite.scale.set(s);
      this._iconSprite.anchor.set(0.5, 0.5);
      this._iconSprite.position.set(cs / 2, cs / 2);
      this.addChildAt(this._iconSprite, 1);
    } else {
      // 无纹理 fallback：柔和的图标占位
      this._iconBg.clear();

      // 柔和的圆形背景
      const iconColor = this._getIconColor(def.category, def.line);
      const cx = cs / 2;
      const cy = cs / 2 - 4;
      const radius = cs * 0.28;

      this._iconBg.beginFill(iconColor, 0.15);
      this._iconBg.drawRoundedRect(4, 4, cs - 8, cs - 8, 8);
      this._iconBg.endFill();
      this._iconBg.beginFill(iconColor, 0.3);
      this._iconBg.drawCircle(cx, cy, radius);
      this._iconBg.endFill();

      // 品类 emoji
      const emoji = this._getCategoryEmoji(def.category);
      this._nameText.visible = true;
      this._nameText.text = emoji + (def.name.length > 3 ? def.name.substring(0, 3) : def.name);
    }

    this._syncToolSparkle(def.category);
    this._syncToolEnergy(def.category);

    this._levelBg.clear();
    this._levelBg.visible = false;
    this._levelText.text = '';
    this._levelText.visible = false;
  }

  get itemId(): string {
    return this._itemId;
  }

  /**
   * 客人订单已锁定该格：仅显示右下角对钩与格子的淡绿遮罩（CellView），
   * 不再绘制程序金边，避免与选中黄框混淆。
   */
  setLocked(locked: boolean): void {
    this._lockBorder.clear();
    this._lockBorder.visible = false;
    this._syncOrderBadge(locked);
    this._bringToolEnergyThenPeekOnTop();
  }

  private _hideOrderBadge(): void {
    if (this._orderBadge) {
      this.removeChild(this._orderBadge);
      this._orderBadge.destroy();
      this._orderBadge = null;
    }
  }

  /** 订单已匹配：右下角绿色对钩角标 */
  private _syncOrderBadge(locked: boolean): void {
    this._hideOrderBadge();
    if (!locked || !this.visible) return;

    const tex = TextureCache.get('ui_order_check_badge');
    if (!tex) return;

    const cs = BoardMetrics.cellSize;
    const sp = new PIXI.Sprite(tex);
    /** 右下角贴格内边，锚点右下避免画出格子 */
    const pad = Math.max(4, Math.round(cs * 0.055));
    const maxSide = cs * 0.42;
    const s = maxSide / Math.max(tex.width, tex.height);
    sp.scale.set(s);
    sp.anchor.set(1, 1);
    sp.position.set(cs - pad, cs - pad);
    this.addChild(sp);
    this._orderBadge = sp;
    this._bringToolEnergyThenPeekOnTop();
  }

  /** 显示/隐藏消耗型剩余次数 */
  setUsesLeft(uses: number): void {
    if (uses <= 0) {
      this._usesText.visible = false;
      return;
    }
    this._usesText.text = `×${uses}`;
    this._usesText.visible = true;
    this._bringToolEnergyThenPeekOnTop();
  }

  /** 显示/隐藏 CD 冷却遮罩 */
  setCooldown(remaining: number, total: number): void {
    const cs = BoardMetrics.cellSize;
    if (remaining <= 0) {
      this._cdOverlay.visible = false;
      this._cdText.visible = false;
      return;
    }

    this._chargeText.visible = false;

    this._cdOverlay.visible = true;
    this._cdText.visible = true;

    this._cdOverlay.clear();
    this._cdOverlay.beginFill(0x000000, 0.4);
    this._cdOverlay.drawRoundedRect(0, 0, cs, cs, 8);
    this._cdOverlay.endFill();

    // 进度条（底部）
    const progress = 1 - remaining / total;
    const barHeight = 4;
    this._cdOverlay.beginFill(0x4CAF50, 0.8);
    this._cdOverlay.drawRoundedRect(4, cs - barHeight - 2, (cs - 8) * progress, barHeight, 2);
    this._cdOverlay.endFill();

    this._cdText.text = `${Math.ceil(remaining)}s`;
    this._bringToolEnergyThenPeekOnTop();
  }

  /** 本周期内剩余产出次数（Lv2/Lv3，非 CD 时）；max<=0 时隐藏 */
  setProduceCharges(left: number, max: number): void {
    if (max <= 0 || left <= 0) {
      this._chargeText.visible = false;
      return;
    }
    this._chargeText.text = `×${left}`;
    this._chargeText.visible = true;
    this._bringToolEnergyThenPeekOnTop();
  }

  private _hideToolEnergy(): void {
    if (this._toolEnergySprite) {
      this.removeChild(this._toolEnergySprite);
      this._toolEnergySprite.destroy();
      this._toolEnergySprite = null;
    }
  }

  private _hideToolSparkle(): void {
    if (this._toolSparkle) {
      this.removeChild(this._toolSparkle);
      this._toolSparkle.destroy();
      this._toolSparkle = null;
    }
  }

  private _syncToolSparkle(category: Category): void {
    this._hideToolSparkle();
    const td = findBoardProducerDef(this._itemId);
    if (!td?.canProduce) return;
    const cs = BoardMetrics.cellSize;
    const layer = new ToolSparkleLayer(cs, cs);
    layer.position.set(0, 0);
    const insertAt = this._iconSprite
      ? this.getChildIndex(this._iconSprite) + 1
      : Math.min(1, this.children.length);
    this.addChildAt(layer, Math.min(insertAt, this.children.length));
    this._toolSparkle = layer;
  }

  private _syncToolEnergy(category: Category): void {
    this._hideToolEnergy();
    const td = findBoardProducerDef(this._itemId);
    if (!td?.canProduce) return;
    const sp = createToolEnergySprite(BoardMetrics.cellSize, BoardMetrics.cellSize);
    if (!sp) return;
    this._toolEnergySprite = sp;
    this.addChild(sp);
    this._bringToolEnergyThenPeekOnTop();
  }

  /**
   * 半解锁格丝带（原在 BoardView 上易被体力标 sibling 顺序影响；放入本视图并强制最上层）
   */
  setPeekRibbon(show: boolean, opts?: { intro?: boolean }): void {
    if (!show) {
      if (this._peekRibbon) {
        this.removeChild(this._peekRibbon);
        this._peekRibbon.destroy();
        this._peekRibbon = null;
      }
      return;
    }

    const peekTex = TextureCache.get('cell_peek');
    if (!peekTex) return;

    const cs = BoardMetrics.cellSize;
    const fitSize = cs * 1.0;
    const rScale = Math.min(fitSize / peekTex.width, fitSize / peekTex.height);

    if (!this._peekRibbon) {
      const ribbon = new PIXI.Sprite(peekTex);
      ribbon.anchor.set(0.5, 0.5);
      ribbon.position.set(cs / 2, cs / 2);
      this.addChild(ribbon);
      this._peekRibbon = ribbon;
    }

    const ribbon = this._peekRibbon!;
    ribbon.position.set(cs / 2, cs / 2);

    // intro 仅用于尚未显示过的丝带（避免 merge 已 refresh 后再播一遍缩放把角标盖住逻辑打乱）
    const needIntro = !!opts?.intro && ribbon.alpha < 0.05;
    if (needIntro) {
      ribbon.scale.set(0);
      ribbon.alpha = 0;
      TweenManager.to({
        target: ribbon,
        props: { alpha: 1 },
        duration: 0.3,
      });
      TweenManager.to({
        target: ribbon.scale,
        props: { x: rScale, y: rScale },
        duration: 0.4,
        ease: Ease.easeOutBack,
        onComplete: () => this._ensurePeekRibbonOnTop(),
      });
    } else {
      ribbon.alpha = 1;
      ribbon.scale.set(rScale, rScale);
    }

    this._ensurePeekRibbonOnTop();
  }

  /** 体力标置顶后仍要保证丝带盖住角标（每帧 CD 等会反复顶体力） */
  private _bringToolEnergyThenPeekOnTop(): void {
    bringToolEnergyToFront(this, this._toolEnergySprite);
    this._ensurePeekRibbonOnTop();
  }

  private _ensurePeekRibbonOnTop(): void {
    if (this._peekRibbon && this._peekRibbon.parent === this && !this._peekRibbon.destroyed) {
      this.setChildIndex(this._peekRibbon, this.children.length - 1);
    }
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
  }

  private _getIconColor(category: Category, line: string): number {
    switch (category) {
      case Category.FLOWER: return this._getLineColor(line);
      case Category.DRINK: return this._getLineColor(line);
      case Category.BUILDING: return 0x8B4513;
      case Category.CHEST: return 0xDAA520;
      default: return 0xCCCCCC;
    }
  }

  private _getLineColor(line: string): number {
    switch (line) {
      case FlowerLine.FRESH: return COLORS.FLOWER_FRESH;
      case FlowerLine.BOUQUET: return COLORS.FLOWER_BOUQUET;
      case FlowerLine.WRAP: return COLORS.FLOWER_WRAP;
      case FlowerLine.GREEN: return COLORS.FLOWER_GREEN;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }

  /**
   * 对齐棋盘格布局：清除 pivot/缩放补间残留（合成弹出、被选中反馈打断时否则会错位）
   */
  snapToCellLayout(): void {
    TweenManager.cancelTarget(this.scale);
    this.pivot.set(0, 0);
    this.scale.set(1, 1);
    this.alpha = 1;
  }

  /** 点击选中时的轻量反馈：仅轻微放大回弹（由 BoardView 仅在 OPEN 格调用） */
  playTapFeedback(): void {
    if (!this.visible || !this._itemId) return;
    this.snapToCellLayout();

    const peak = 1.035;
    TweenManager.to({
      target: this.scale,
      props: { x: peak, y: peak },
      duration: 0.06,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: this.scale,
          props: { x: 1, y: 1 },
          duration: 0.11,
          ease: Ease.easeOutBack,
        });
      },
    });
  }

  /**
   * 合成成功：新物品从格子中心弹出（与 BoardView 合成特效配合）
   * 使用 pivot 绕格心缩放，结束后恢复左上角锚点，避免影响布局与拖拽命中
   * @param onComplete 动画正常结束并复位后调用（用于延后选中反馈，避免 playTapFeedback 取消 scale 补间导致不执行 finish）
   */
  playMergeSpawnIn(onComplete?: () => void): void {
    if (!this.visible || !this._itemId) {
      onComplete?.();
      return;
    }
    const cs = BoardMetrics.cellSize;
    this.snapToCellLayout();

    const ox = this.x;
    const oy = this.y;
    this.pivot.set(cs / 2, cs / 2);
    this.position.set(ox + cs / 2, oy + cs / 2);
    this.scale.set(0.08, 0.08);
    this.alpha = 0.92;

    const finish = (): void => {
      this.pivot.set(0, 0);
      this.position.set(ox, oy);
      this.scale.set(1, 1);
      this.alpha = 1;
      onComplete?.();
    };

    TweenManager.to({
      target: this.scale,
      props: { x: 1, y: 1 },
      duration: 0.4,
      ease: Ease.easeOutBack,
      onComplete: finish,
    });
  }
}
