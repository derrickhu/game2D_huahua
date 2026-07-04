import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { setPendingPlaceDeco } from '@/core/DecoPlaceIntent';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { getDecoDisplayName } from '@/config/FurnitureWorkshopConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { TextureCache } from '@/utils/TextureCache';
import { createTutorialStyleModalFrame } from '@/gameobjects/ui/TutorialStyleModalFrame';

const CELEBRATE_Z = 12000;

let listenersReady = false;
let celebrateHost: PIXI.Container | null = null;
let pendingStarFlyDeco: DecoDef | null = null;
let pendingNewDecoAfterLevelUp: DecoDef | null = null;
let unlockOverlay: PIXI.Container | null = null;

function ensureCelebrateListeners(): void {
  if (listenersReady) return;
  listenersReady = true;
  EventBus.on('decoration:shopStarFlyComplete', onCelebrateStarFlyComplete);
  EventBus.on('levelUpPopup:closed', onCelebrateLevelUpClosed);
}

function onCelebrateStarFlyComplete(): void {
  const deco = pendingStarFlyDeco;
  if (!deco || !celebrateHost) return;
  pendingStarFlyDeco = null;

  if (deco.starValue > 0) {
    const oldLv = CurrencyManager.state.level;
    CurrencyManager.addStar(deco.starValue);
    if (CurrencyManager.state.level > oldLv) {
      pendingNewDecoAfterLevelUp = deco;
      return;
    }
  }
  showDecoObtainPopup(celebrateHost, deco);
}

function onCelebrateLevelUpClosed(): void {
  const deco = pendingNewDecoAfterLevelUp;
  if (!deco || !celebrateHost) return;
  pendingNewDecoAfterLevelUp = null;
  showDecoObtainPopup(celebrateHost, deco);
}

function dismissDecoObtainOverlay(host: PIXI.Container): void {
  if (unlockOverlay?.parent === host) {
    host.removeChild(unlockOverlay);
    unlockOverlay.destroy({ children: true });
  }
  unlockOverlay = null;
}

function addPastelModalButton(
  parent: PIXI.Container,
  label: string,
  cx: number,
  topY: number,
  btnW: number,
  btnH: number,
  variant: 'primary' | 'secondary',
  onTap: () => void,
): void {
  const hit = new PIXI.Container();
  hit.position.set(cx, topY);
  hit.eventMode = 'static';
  hit.cursor = 'pointer';
  hit.hitArea = new PIXI.Rectangle(-btnW / 2, 0, btnW, btnH);

  const g = new PIXI.Graphics();
  const r = btnH / 2;
  if (variant === 'primary') {
    g.beginFill(COLORS.BUTTON_PRIMARY);
    g.drawRoundedRect(-btnW / 2, 0, btnW, btnH, r);
    g.endFill();
    g.lineStyle(2, 0xffffff, 0.58);
    g.drawRoundedRect(-btnW / 2 + 3, 3, btnW - 6, btnH - 6, r - 3);
  } else {
    g.beginFill(0xe8dff7, 0.98);
    g.drawRoundedRect(-btnW / 2, 0, btnW, btnH, r);
    g.endFill();
    g.lineStyle(2.5, 0xffffff, 0.85);
    g.drawRoundedRect(-btnW / 2 + 2.5, 2.5, btnW - 5, btnH - 5, Math.max(8, r - 4));
  }
  hit.addChild(g);

  const t = new PIXI.Text(label, {
    fontSize: 19,
    fill: variant === 'primary' ? 0xffffff : 0x6a4a2f,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: variant === 'primary' ? 0x8b4513 : 0xfffcf5,
    strokeThickness: variant === 'primary' ? 2 : 1.5,
  });
  t.anchor.set(0.5, 0.5);
  t.position.set(0, btnH / 2);
  hit.addChild(t);
  hit.on('pointertap', e => {
    e.stopPropagation();
    onTap();
  });
  parent.addChild(hit);
}

function showDecoObtainPopup(host: PIXI.Container, deco: DecoDef): void {
  dismissDecoObtainOverlay(host);

  const W = DESIGN_WIDTH;
  const H = Game.logicHeight;
  const root = new PIXI.Container();
  root.zIndex = CELEBRATE_Z;
  unlockOverlay = root;
  host.addChild(root);
  host.sortChildren();

  const mask = new PIXI.Graphics();
  mask.beginFill(0x000000, 0.55);
  mask.drawRect(0, 0, W, H);
  mask.endFill();
  mask.eventMode = 'static';
  root.addChild(mask);

  const BTN_W = 148;
  const BTN_H = 54;
  const BTN_GAP = 14;
  const ICON_MAX = 116;
  const contentW = BTN_W * 2 + BTN_GAP;
  const contentH = 30 + ICON_MAX + 20 + BTN_H;

  const frame = createTutorialStyleModalFrame({
    viewW: W,
    viewH: H,
    title: '获得新家具',
    contentWidth: contentW,
    contentHeight: contentH,
    onCloseTap: () => dismissDecoObtainCelebrate(host),
  });
  root.addChild(frame.root);

  const mount = frame.contentMount;
  const cx = contentW / 2;
  let y = 0;

  const sub = new PIXI.Text(`「${getDecoDisplayName(deco.id)}」`, {
    fontSize: 19,
    fill: 0x5c4a3d,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0xfffcf5,
    strokeThickness: 2,
  });
  sub.anchor.set(0.5, 0);
  sub.position.set(cx, y);
  mount.addChild(sub);
  y += sub.height + 14;

  const tex = TextureCache.get(deco.icon);
  if (tex?.width) {
    const sp = new PIXI.Sprite(tex);
    const ms = Math.min(ICON_MAX / tex.width, ICON_MAX / tex.height);
    sp.scale.set(ms);
    sp.anchor.set(0.5, 0);
    sp.position.set(cx, y);
    mount.addChild(sp);
  }
  y += ICON_MAX + 18;

  addPastelModalButton(
    mount,
    '稍后',
    BTN_W / 2,
    y,
    BTN_W,
    BTN_H,
    'secondary',
    () => dismissDecoObtainCelebrate(host),
  );
  addPastelModalButton(
    mount,
    '放入房间',
    BTN_W + BTN_GAP + BTN_W / 2,
    y,
    BTN_W,
    BTN_H,
    'primary',
    () => {
      dismissDecoObtainCelebrate(host);
      setPendingPlaceDeco(deco.id);
      EventBus.emit('panel:closeFurnitureWorkshop');
      EventBus.emit('scene:switchToShop');
    },
  );
}

/** 关闭庆祝弹层并清理待处理状态 */
export function dismissDecoObtainCelebrate(host: PIXI.Container): void {
  if (celebrateHost === host) {
    celebrateHost = null;
    pendingStarFlyDeco = null;
    pendingNewDecoAfterLevelUp = null;
  }
  dismissDecoObtainOverlay(host);
}

/**
 * 家具获得庆祝：先飞星（若有），再弹「获得新家具 / 放入房间」。
 * 与装修商店购买后体验一致。
 */
export function celebrateDecoObtain(
  host: PIXI.Container,
  deco: DecoDef,
  flyGlobal: PIXI.Point,
): void {
  ensureCelebrateListeners();
  dismissDecoObtainCelebrate(host);
  celebrateHost = host;

  if (deco.starValue > 0) {
    pendingStarFlyDeco = deco;
    EventBus.emit('decoration:shopStarFly', {
      globalX: flyGlobal.x,
      globalY: flyGlobal.y,
      amount: deco.starValue,
    });
    return;
  }
  showDecoObtainPopup(host, deco);
}
