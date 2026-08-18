import * as PIXI from 'pixi.js';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import {
  MID_AUTUMN_CURRENCY_NAME,
  MID_AUTUMN_EVENT_NAME,
  MID_AUTUMN_SEASON_ID,
  MID_AUTUMN_SPIN_COST,
  MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID,
  MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID,
  MID_AUTUMN_MOON_WINDOW_DECO_ID,
  MID_AUTUMN_WHEEL_ROUND_COUNT,
  MID_AUTUMN_WHEEL_SLICE_COUNT,
  midAutumnPrizeQuantityLabel,
  midAutumnWheelPrizesForRound,
  type MidAutumnGrant,
} from '@/config/events/MidAutumnEventConfig';
import { MidAutumnEventManager } from '@/managers/MidAutumnEventManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { ItemObtainOverlay, type ItemObtainEntry } from '@/gameobjects/ui/ItemObtainOverlay';

const SHELL_KEY = 'mid_autumn_event_panel_shell_nb2';
const DISC_KEY = 'mid_autumn_wheel_disc_nb2';
const POINTER_KEY = 'mid_autumn_wheel_pointer_nb2';
const HUB_KEY = 'mid_autumn_wheel_hub_nb2';
const STAND_KEY = 'mid_autumn_wheel_stand_nb2';
const SPIN_BTN_KEY = 'mid_autumn_wheel_spin_btn_nb2';
const PRELOAD_KEYS = [SHELL_KEY, DISC_KEY, POINTER_KEY, HUB_KEY, STAND_KEY, SPIN_BTN_KEY] as const;
const Z = 11250;
const FALLBACK_SHELL_W = 680;
const FALLBACK_SHELL_H = 1138;
const CLOSE_NX = 0.905;
const CLOSE_NY = 0.084;
const CLOSE_R = 56;
const WHEEL_R = 220;
const SLICE_COUNT = MID_AUTUMN_WHEEL_SLICE_COUNT;
const SLICE_ANGLE = (Math.PI * 2) / SLICE_COUNT;
/** 盘面金线在整点方向，格子中心比轴线偏半格。 */
const SLICE_CENTER_OFFSET = SLICE_ANGLE / 2;
/** 奖品落在木格中圈，避开金边装饰带，避免探出盘沿。 */
const PRIZE_ICON_R = WHEEL_R * 0.56;
const PRIZE_LABEL_R = WHEEL_R * 0.40;
const PRIZE_ICON_SIZE = 52;
const PRIZE_ICON_SIZE_DECO = 56;

export class MidAutumnEventPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _spinning = false;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _art!: PIXI.Sprite;
  private _content!: PIXI.Container;
  private _closeHit!: PIXI.Container;
  private _wheel!: PIXI.Container;
  private _prizeLayer: PIXI.Container | null = null;
  private _prizeNodes: PIXI.Container[] = [];
  private _currencyText: PIXI.Text | null = null;
  private _countdownText: PIXI.Text | null = null;
  private _spinBtn: PIXI.Container | null = null;
  private _spinLabel: PIXI.Text | null = null;
  private _leftArrow: PIXI.Container | null = null;
  private _rightArrow: PIXI.Container | null = null;
  private _previewRound = 1;
  private _playableRound = 1;
  private _displayedCleared = false;
  private _displayedWonCount = -1;
  private _shellW = 0;
  private _shellH = 0;
  private _closeDesignX = 0;
  private _closeDesignY = 0;
  private _closeDesignR = CLOSE_R;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openMidAutumnEvent', () => this.open());
    EventBus.on('midAutumnEvent:changed', () => {
      if (this._isOpen && !this._spinning) this._refreshHud();
    });
    EventBus.on('midAutumnEvent:periodChanged', () => {
      if (!this._isOpen) return;
      if (!MidAutumnEventManager.isActive()) {
        ToastMessage.show('月满中秋活动已结束');
        this.close();
      } else {
        this._refreshHud();
      }
    });
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!MidAutumnEventManager.isActive()) {
      ToastMessage.show('月满中秋暂未开放');
      return;
    }
    this._opening = true;
    void Promise.all([
      TextureCache.preloadEventKeys(MID_AUTUMN_SEASON_ID, PRELOAD_KEYS),
      TextureCache.preloadKeys([
        'icon_energy',
        'icon_huayuan',
        'icon_gem',
        'icon_workshop_material',
        'icon_coin',
        'icon_mid_autumn_lantern',
        MID_AUTUMN_MOONCAKE_GIFT_BOX_DECO_ID,
        MID_AUTUMN_REUNION_DINING_TABLE_DECO_ID,
        MID_AUTUMN_MOON_WINDOW_DECO_ID,
        'workshop_moon_sheer_window_sheet',
        'workshop_blueprint_generic',
      ]),
    ]).finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen || this._spinning) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.16,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
      },
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this.alpha = 0;
    this._layout();
    this._refreshHud();
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  private _build(): void {
    this._bg = new PIXI.Graphics();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.eventMode = 'static';
    this._root.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._root);

    this._art = new PIXI.Sprite();
    this._art.anchor.set(0.5, 0);
    this._art.eventMode = 'none';
    this._root.addChild(this._art);

    this._content = new PIXI.Container();
    this._root.addChild(this._content);

    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 200;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onClose = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      this.close();
    };
    this._closeHit.on('pointerdown', onClose);
    this._closeHit.on('pointertap', onClose);
    this.addChild(this._closeHit);
  }

  private _layout(): void {
    const logicH = Game.logicHeight;
    this._bg.clear();
    this._bg.beginFill(0x1a1020, 0.55);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, logicH);
    this._bg.endFill();
    this._bg.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, logicH);

    const tex = TextureCache.get(SHELL_KEY);
    if (tex && tex.width > 1) {
      this._art.texture = tex;
      this._art.visible = true;
      const scale = Math.min(
        (DESIGN_WIDTH * 0.96) / tex.width,
        (logicH * 0.92) / tex.height,
      );
      this._art.scale.set(scale);
      this._shellW = tex.width * scale;
      this._shellH = tex.height * scale;
    } else {
      this._art.visible = false;
      this._shellW = Math.min(FALLBACK_SHELL_W, DESIGN_WIDTH * 0.9);
      this._shellH = Math.min(FALLBACK_SHELL_H, logicH * 0.9);
    }

    this._root.position.set(DESIGN_WIDTH / 2, (logicH - this._shellH) / 2);
    this._art.position.set(0, 0);
    this._root.hitArea = new PIXI.Rectangle(
      -this._shellW / 2,
      0,
      this._shellW,
      this._shellH,
    );

    this._closeDesignX = DESIGN_WIDTH / 2 + (CLOSE_NX - 0.5) * this._shellW;
    this._closeDesignY = (logicH - this._shellH) / 2 + CLOSE_NY * this._shellH;
    this._closeDesignR = CLOSE_R;
    this._closeHit.position.set(this._closeDesignX, this._closeDesignY);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, this._closeDesignR);

    this._rebuildContent();
  }

  private _rebuildContent(): void {
    this._content.removeChildren();
    const w = this._shellW;
    const h = this._shellH;

    if (!this._art.visible) {
      const g = new PIXI.Graphics();
      g.beginFill(0xF7E8C6);
      g.lineStyle(10, 0xC9893A);
      g.drawRoundedRect(-w / 2, 0, w, h, 42);
      g.endFill();
      g.beginFill(0xF2C14E);
      g.drawRoundedRect(-w * 0.28, h * 0.06, w * 0.56, 58, 22);
      g.endFill();
      this._content.addChild(g);
      const title = new PIXI.Text(MID_AUTUMN_EVENT_NAME, {
        fontFamily: FONT_FAMILY,
        fontSize: 36,
        fontWeight: '700',
        fill: 0x6B3A12,
      });
      title.anchor.set(0.5);
      title.position.set(0, h * 0.118);
      this._content.addChild(title);
    }

    const currencyRow = new PIXI.Container();
    currencyRow.position.set(0, h * 0.198);
    const pill = new PIXI.Graphics();
    pill.beginFill(0xFFF6DE, 0.95);
    pill.lineStyle(3, 0xE0A84A);
    pill.drawRoundedRect(-118, -22, 236, 44, 22);
    pill.endFill();
    currencyRow.addChild(pill);
    const lantern = this._makeIcon('icon_mid_autumn_lantern', 32);
    lantern.position.set(-78, 0);
    currencyRow.addChild(lantern);
    this._currencyText = new PIXI.Text('', {
      fontFamily: FONT_FAMILY,
      fontSize: 24,
      fontWeight: '700',
      fill: 0x6B3A12,
    });
    this._currencyText.anchor.set(0, 0.5);
    this._currencyText.position.set(-56, 0);
    currencyRow.addChild(this._currencyText);
    this._content.addChild(currencyRow);

    this._countdownText = new PIXI.Text('', {
      fontFamily: FONT_FAMILY,
      fontSize: 18,
      fill: 0x8A5A28,
    });
    this._countdownText.anchor.set(0.5);
    this._countdownText.position.set(0, h * 0.238);
    this._content.addChild(this._countdownText);

    this._previewRound = this._playablePreviewRound();
    this._playableRound = MidAutumnEventManager.wheelRound;
    this._displayedCleared = MidAutumnEventManager.wheelCleared;
    const wheelY = h * 0.508;
    const stand = this._trySprite(STAND_KEY);
    if (stand) {
      const standW = WHEEL_R * 1.88;
      stand.scale.set(standW / stand.texture.width);
      stand.anchor.set(0.5, 0.12);
      stand.position.set(0, wheelY + WHEEL_R * 0.78);
      this._content.addChild(stand);
    }

    this._wheel = this._buildWheel();
    this._wheel.position.set(0, wheelY);
    this._content.addChild(this._wheel);

    this._leftArrow = this._makePageArrow(-1);
    this._leftArrow.position.set(-WHEEL_R - 36, wheelY);
    this._content.addChild(this._leftArrow);
    this._rightArrow = this._makePageArrow(1);
    this._rightArrow.position.set(WHEEL_R + 36, wheelY);
    this._content.addChild(this._rightArrow);

    const pointer = this._trySprite(POINTER_KEY);
    if (pointer) {
      pointer.anchor.set(0.5, 0.96);
      const pointerH = WHEEL_R * 0.72;
      pointer.scale.set(pointerH / pointer.texture.height);
      pointer.position.set(0, wheelY - WHEEL_R * 0.78);
      this._content.addChild(pointer);
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xE8B84A);
      fallback.lineStyle(3, 0xFFF3C4);
      fallback.moveTo(0, -WHEEL_R + 8);
      fallback.lineTo(-28, -WHEEL_R - 56);
      fallback.lineTo(28, -WHEEL_R - 56);
      fallback.closePath();
      fallback.endFill();
      fallback.position.set(0, wheelY);
      this._content.addChild(fallback);
    }

    const hub = this._trySprite(HUB_KEY);
    if (hub) {
      const hubD = WHEEL_R * 0.58;
      hub.scale.set(hubD / Math.max(hub.texture.width, hub.texture.height));
      hub.position.set(0, wheelY);
      this._content.addChild(hub);
    }

    const spinBtn = new PIXI.Container();
    this._spinBtn = spinBtn;
    spinBtn.position.set(0, h * 0.805);
    spinBtn.eventMode = 'static';
    spinBtn.cursor = 'pointer';
    const btnArt = this._trySprite(SPIN_BTN_KEY);
    if (btnArt) {
      const btnW = Math.min(w * 0.58, 320);
      btnArt.scale.set(btnW / btnArt.texture.width);
      spinBtn.addChild(btnArt);
      spinBtn.hitArea = new PIXI.Rectangle(
        -btnArt.width / 2,
        -btnArt.height / 2,
        btnArt.width,
        btnArt.height,
      );
    } else {
      const btnG = new PIXI.Graphics();
      btnG.beginFill(0x2FA37A);
      btnG.lineStyle(4, 0xE8C15A);
      btnG.drawRoundedRect(-130, -32, 260, 64, 32);
      btnG.endFill();
      spinBtn.addChild(btnG);
      spinBtn.hitArea = new PIXI.Rectangle(-130, -32, 260, 64);
    }
    this._spinLabel = new PIXI.Text('', {
      fontFamily: FONT_FAMILY,
      fontSize: 26,
      fontWeight: '700',
      fill: 0xFFFFFF,
    });
    this._spinLabel.anchor.set(0.5);
    spinBtn.addChild(this._spinLabel);
    spinBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._onSpin();
    });
    this._content.addChild(spinBtn);
  }

  private _buildWheel(): PIXI.Container {
    const root = new PIXI.Container();
    const discArt = this._trySprite(DISC_KEY);
    if (discArt) {
      discArt.scale.set((WHEEL_R * 2) / Math.max(discArt.texture.width, discArt.texture.height));
      root.addChild(discArt);
    } else {
      const disc = new PIXI.Graphics();
      disc.beginFill(0xE8C37A);
      disc.drawCircle(0, 0, WHEEL_R + 10);
      disc.endFill();
      root.addChild(disc);
      const prizes = midAutumnWheelPrizesForRound(this._previewRound);
      for (let i = 0; i < SLICE_COUNT; i++) {
        const prize = prizes[i]!;
        const start = -Math.PI / 2 + i * SLICE_ANGLE;
        const end = start + SLICE_ANGLE;
        const slice = new PIXI.Graphics();
        slice.beginFill(prize.color);
        slice.moveTo(0, 0);
        slice.arc(0, 0, WHEEL_R, start, end);
        slice.lineTo(0, 0);
        slice.endFill();
        root.addChild(slice);
      }
    }

    this._prizeLayer = new PIXI.Container();
    root.addChild(this._prizeLayer);
    this._fillPrizeLayer();
    return root;
  }

  private _fillPrizeLayer(): void {
    const layer = this._prizeLayer;
    if (!layer) return;
    layer.removeChildren();
    this._prizeNodes = [];
    const prizes = midAutumnWheelPrizesForRound(this._previewRound);
    const playable = MidAutumnEventManager.wheelRound;
    const cleared = MidAutumnEventManager.wheelCleared;
    for (let i = 0; i < SLICE_COUNT; i++) {
      const prize = prizes[i]!;
      const mid = -Math.PI / 2 + SLICE_CENTER_OFFSET + i * SLICE_ANGLE;
      const cx = Math.cos(mid);
      const cy = Math.sin(mid);
      const wrap = new PIXI.Container();
      const qty = midAutumnPrizeQuantityLabel(prize);
      const icon = this._makeIcon(prize.iconKey, qty ? PRIZE_ICON_SIZE : PRIZE_ICON_SIZE_DECO);
      icon.position.set(cx * PRIZE_ICON_R, cy * PRIZE_ICON_R);
      wrap.addChild(icon);
      if (qty) {
        const amount = new PIXI.Text(qty, {
          fontFamily: FONT_FAMILY,
          fontSize: 16,
          fontWeight: '700',
          fill: 0x6B3A12,
          stroke: 0xFFF8E6,
          strokeThickness: 3,
        });
        amount.anchor.set(0.5);
        amount.position.set(cx * PRIZE_LABEL_R, cy * PRIZE_LABEL_R);
        wrap.addChild(amount);
      }
      const grayAll = cleared || this._previewRound < playable;
      if (grayAll || (this._previewRound === playable && MidAutumnEventManager.isPrizeWon(prize.id))) {
        this._grayNode(wrap);
      }
      layer.addChild(wrap);
      this._prizeNodes.push(wrap);
    }
    this._displayedWonCount = this._previewRound === playable && !cleared
      ? prizes.filter(prize => MidAutumnEventManager.isPrizeWon(prize.id)).length
      : -1;
    this._syncPageArrows();
  }

  private _playablePreviewRound(): number {
    return MidAutumnEventManager.wheelCleared
      ? MID_AUTUMN_WHEEL_ROUND_COUNT
      : MidAutumnEventManager.wheelRound;
  }

  private _isPreviewPlayable(): boolean {
    return !MidAutumnEventManager.wheelCleared
      && this._previewRound === MidAutumnEventManager.wheelRound;
  }

  private _makePageArrow(dir: 1 | -1): PIXI.Container {
    const btn = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.beginFill(0xF2C14E);
    g.lineStyle(3, 0xFFF6DE);
    if (dir > 0) {
      g.moveTo(-8, -20);
      g.lineTo(18, 0);
      g.lineTo(-8, 20);
    } else {
      g.moveTo(8, -20);
      g.lineTo(-18, 0);
      g.lineTo(8, 20);
    }
    g.closePath();
    g.endFill();
    btn.addChild(g);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, 28);
    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._turnPage(dir);
    });
    return btn;
  }

  private _turnPage(dir: 1 | -1): void {
    if (this._spinning) return;
    const next = this._previewRound + dir;
    if (next < 1 || next > MID_AUTUMN_WHEEL_ROUND_COUNT) return;
    this._previewRound = next;
    this._wheel.rotation = 0;
    this._fillPrizeLayer();
    this._refreshHud();
    AudioManager.play('button_click');
  }

  private _syncPageArrows(): void {
    if (this._leftArrow) this._leftArrow.visible = this._previewRound > 1 && !this._spinning;
    if (this._rightArrow) {
      this._rightArrow.visible = this._previewRound < MID_AUTUMN_WHEEL_ROUND_COUNT && !this._spinning;
    }
  }

  private _grayNode(node: PIXI.Container): void {
    const filter = new PIXI.ColorMatrixFilter();
    filter.desaturate();
    filter.brightness(0.7, false);
    node.filters = [filter];
    node.alpha = 0.72;
  }

  private _grayPrizeAt(index: number): void {
    const node = this._prizeNodes[index];
    if (node) this._grayNode(node);
  }

  private _trySprite(key: string): PIXI.Sprite | null {
    const tex = TextureCache.get(key);
    if (!tex || tex.width <= 1) return null;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    return sp;
  }

  private _makeIcon(key: string, size: number): PIXI.Container {
    const wrap = new PIXI.Container();
    const tex = TextureCache.get(key);
    if (tex?.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(Math.min(size / tex.width, size / tex.height));
      wrap.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xFFFFFF, 0.9);
      g.drawCircle(0, 0, size / 2);
      g.endFill();
      wrap.addChild(g);
    }
    return wrap;
  }

  private _refreshHud(): void {
    if (this._currencyText) {
      this._currencyText.text = `${MID_AUTUMN_CURRENCY_NAME}  ${MidAutumnEventManager.currency}`;
    }
    if (this._countdownText) {
      const label = MidAutumnEventManager.countdownLabel();
      this._countdownText.text = label ? `剩余 ${label}` : '';
    }
    if (!this._spinning && this._prizeLayer) {
      const playable = MidAutumnEventManager.wheelRound;
      const cleared = MidAutumnEventManager.wheelCleared;
      const playableChanged = this._playableRound !== playable || this._displayedCleared !== cleared;
      if (playableChanged) {
        this._playableRound = playable;
        this._displayedCleared = cleared;
        this._previewRound = this._playablePreviewRound();
        this._fillPrizeLayer();
        this._wheel.rotation = 0;
      } else if (this._previewRound === playable && !cleared) {
        const wonCount = MidAutumnEventManager.currentPrizes.filter(
          prize => MidAutumnEventManager.isPrizeWon(prize.id),
        ).length;
        if (wonCount !== this._displayedWonCount) this._fillPrizeLayer();
      }
    }
    this._syncPageArrows();
    const kind = this._previewButtonKind();
    if (this._spinBtn) {
      this._spinBtn.alpha = this._spinning || kind === 'spin' ? 1 : 0.55;
    }
    if (this._spinLabel) {
      this._spinLabel.text = this._spinning
        ? '转动中…'
        : kind === 'cleared'
          ? '已抽完'
          : kind === 'locked'
            ? '未解锁'
            : `抽奖  ${MID_AUTUMN_SPIN_COST}玉兔灯`;
    }
  }

  private _previewButtonKind(): 'spin' | 'locked' | 'cleared' {
    if (MidAutumnEventManager.wheelCleared || this._previewRound < MidAutumnEventManager.wheelRound) {
      return 'cleared';
    }
    if (this._previewRound > MidAutumnEventManager.wheelRound) return 'locked';
    return 'spin';
  }

  private _onSpin(): void {
    if (this._spinning) return;
    if (!this._isPreviewPlayable()) {
      if (this._previewButtonKind() === 'cleared') {
        ToastMessage.show(
          MidAutumnEventManager.wheelCleared ? '三轮奖品已全部抽完' : '本轮奖品已抽完',
        );
      } else {
        ToastMessage.show(`完成第${MidAutumnEventManager.wheelRound}轮转盘后解锁`);
      }
      return;
    }
    this._spinning = true;
    const result = MidAutumnEventManager.spin();
    if (!result.ok) {
      this._spinning = false;
      if (result.reason === 'not_enough_currency') {
        ToastMessage.show(`玉兔灯不足，交付月饼订单可获得`);
      } else if (result.reason === 'not_active') {
        ToastMessage.show('月满中秋暂未开放');
      } else if (result.reason === 'all_cleared') {
        ToastMessage.show('三轮奖品已全部抽完');
      } else {
        ToastMessage.show('抽奖失败，请稍后再试');
      }
      this._refreshHud();
      return;
    }

    this._refreshHud();
    AudioManager.play('button_click');

    const current = ((this._wheel.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const land = -(result.prizeIndex * SLICE_ANGLE + SLICE_CENTER_OFFSET);
    let delta = land - current;
    while (delta <= 0) delta += Math.PI * 2;
    const target = this._wheel.rotation + delta + Math.PI * 2 * 5;

    TweenManager.to({
      target: this._wheel,
      props: { rotation: target },
      duration: 2.6,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        const settled = MidAutumnEventManager.settlePendingSpin();
        this._grayPrizeAt(result.prizeIndex);
        ItemObtainOverlay.show(
          [this._toObtainEntry(result.prize.grant, result.prize.name)],
          () => {
            this._spinning = false;
            if (settled?.advancedToRound) {
              ToastMessage.show(`第${settled.fromRound}轮已抽完，开启第${settled.advancedToRound}轮更丰厚奖品`);
              this._previewRound = settled.advancedToRound;
              this._playableRound = settled.advancedToRound;
              this._fillPrizeLayer();
              this._wheel.rotation = 0;
            } else if (settled?.allCleared) {
              ToastMessage.show('三轮奖品已全部抽完');
              this._previewRound = MID_AUTUMN_WHEEL_ROUND_COUNT;
              this._displayedCleared = true;
              this._fillPrizeLayer();
            }
            this._refreshHud();
          },
        );
      },
    });
  }

  private _toObtainEntry(
    grant: MidAutumnGrant,
    fallbackName: string,
  ): ItemObtainEntry {
    switch (grant.kind) {
      case 'stamina':
        return { kind: 'direct_currency', currency: 'stamina', amount: grant.amount };
      case 'huayuan':
        return { kind: 'direct_currency', currency: 'huayuan', amount: grant.amount };
      case 'diamond':
        return { kind: 'direct_currency', currency: 'diamond', amount: grant.amount };
      case 'workshopMaterial':
        return {
          kind: 'workshop_material',
          materialId: grant.materialId,
          count: grant.amount,
          label: fallbackName,
        };
      case 'rewardBoxItem':
        return { kind: 'board_item', itemId: grant.itemId, count: grant.amount };
      case 'deco':
        return { kind: 'deco', decoId: grant.decoId, label: fallbackName };
      case 'blueprint':
        return { kind: 'unlock_icon', iconKey: 'workshop_blueprint_generic', label: fallbackName };
    }
  }
}
