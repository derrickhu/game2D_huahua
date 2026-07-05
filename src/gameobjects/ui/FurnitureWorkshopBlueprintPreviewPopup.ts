import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  getBlueprintDisplayName,
  getDefaultWorkshopColorOption,
  getWorkshopBlueprintInteractionHint,
  getWorkshopColorChipLabel,
  isDefaultWorkshopColorOption,
  isWorkshopBlueprintInteractive,
  shouldShowWorkshopBlueprintColorPreview,
  WORKSHOP_HUAYUAN_ICON,
  WORKSHOP_MATERIAL_ICON,
  type WorkshopBlueprintDef,
  type WorkshopColorOption,
} from '@/config/FurnitureWorkshopConfig';
import { collectFurniturePreloadKeys, resolveFurnitureTexture } from '@/config/FurnitureRenderConfig';
import { TextureCache } from '@/utils/TextureCache';
import { appendWorkshopBlueprintFeatureTags, appendWorkshopStarValueBadge } from '@/utils/WorkshopBlueprintDisplay';

const POP_W = 400;
const POP_PAD_X = 28;
const CONTENT_W = POP_W - POP_PAD_X * 2;
const PREVIEW_FRAME_W = 300;
const PREVIEW_FRAME_H = 228;
const PREVIEW_IMAGE_FIT = 196;
const FOOTER_TOP_Y = 286;
const COLOR_CHIP_R = 22;
const COLOR_CHIP_GAP = 16;
const SECTION_TITLE_GAP = 8;
const COST_ICON_SIZE = 24;
const COST_ITEM_GAP = 20;

function textStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return { fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK, ...base } as PIXI.ITextStyle;
}

export class FurnitureWorkshopBlueprintPreviewPopup extends PIXI.Container {
  private _card!: PIXI.Container;
  private _cardBg!: PIXI.Graphics;
  private _cardShadow!: PIXI.Graphics;
  private _previewSprite!: PIXI.Sprite;
  private _nameText!: PIXI.Text;
  private _descText!: PIXI.Text;
  private _craftCostSection!: PIXI.Container;
  private _colorSection!: PIXI.Container;
  private _interactionText!: PIXI.Text;
  private _starBadgeWrap!: PIXI.Container;
  private _featureTagWrap!: PIXI.Container;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 65;
    this._build();
  }

  open(blueprint: WorkshopBlueprintDef): void {
    const option = getDefaultWorkshopColorOption(blueprint);
    const decoId = option?.outputDecoId ?? blueprint.outputDecoId;
    const deco = DECO_MAP.get(decoId);
    if (!deco) return;

    this.eventMode = 'static';
    this.visible = true;
    this._refresh(blueprint, decoId, deco);

    const keys = new Set(collectFurniturePreloadKeys(decoId, deco.icon));
    keys.add(WORKSHOP_MATERIAL_ICON);
    keys.add(WORKSHOP_HUAYUAN_ICON);
    void TextureCache.preloadKeys([...keys]).finally(() => {
      if (!this.visible) return;
      const latest = DECO_MAP.get(decoId);
      if (latest) this._refresh(blueprint, decoId, latest);
    });
  }

  close(): void {
    this.visible = false;
    this.eventMode = 'none';
  }

  private _build(): void {
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.28);
    dim.drawRect(-480, -480, 960, 1600);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointerdown', () => this.close());
    this.addChild(dim);

    this._card = new PIXI.Container();
    this._card.eventMode = 'static';
    this._card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._card);

    this._cardShadow = new PIXI.Graphics();
    this._card.addChild(this._cardShadow);

    this._cardBg = new PIXI.Graphics();
    this._card.addChild(this._cardBg);

    const title = new PIXI.Text('家具预览', textStyle({
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xa87328,
      strokeThickness: 4,
    }));
    title.anchor.set(0.5, 0);
    title.position.set(POP_W / 2, 12);
    this._card.addChild(title);

    const closeBtn = this._makeButton('×', 0xe85d75, 44, 44, () => this.close());
    closeBtn.position.set(POP_W - 32, 32);
    this._card.addChild(closeBtn);

    const previewBox = new PIXI.Container();
    previewBox.position.set(POP_W / 2, 168);
    this._card.addChild(previewBox);

    const halfW = PREVIEW_FRAME_W / 2;
    const halfH = PREVIEW_FRAME_H / 2;
    const frame = new PIXI.Graphics();
    frame.beginFill(0xffffff, 0.98);
    frame.drawRoundedRect(-halfW, -halfH, PREVIEW_FRAME_W, PREVIEW_FRAME_H, 18);
    frame.endFill();
    frame.lineStyle(2, 0xe8d4b8, 1);
    frame.drawRoundedRect(-halfW + 1, -halfH + 1, PREVIEW_FRAME_W - 2, PREVIEW_FRAME_H - 2, 17);
    previewBox.addChild(frame);

    this._previewSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this._previewSprite.anchor.set(0.5);
    previewBox.addChild(this._previewSprite);

    this._starBadgeWrap = new PIXI.Container();
    this._starBadgeWrap.position.set(-halfW + 8, -halfH + 8);
    previewBox.addChild(this._starBadgeWrap);

    this._featureTagWrap = new PIXI.Container();
    this._featureTagWrap.position.set(halfW - 8, halfH - 8);
    previewBox.addChild(this._featureTagWrap);

    this._nameText = new PIXI.Text('', textStyle({
      fontSize: 26,
      fill: 0x5c4938,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: CONTENT_W,
    }));
    this._nameText.anchor.set(0.5, 0);
    this._card.addChild(this._nameText);

    this._descText = new PIXI.Text('', textStyle({
      fontSize: 16,
      fill: 0x9a8478,
      fontWeight: '700',
      align: 'left',
      wordWrap: true,
      wordWrapWidth: CONTENT_W,
      lineHeight: 24,
      breakWords: true,
    }));
    this._descText.anchor.set(0, 0);
    this._card.addChild(this._descText);

    this._craftCostSection = new PIXI.Container();
    this._card.addChild(this._craftCostSection);

    this._colorSection = new PIXI.Container();
    this._card.addChild(this._colorSection);

    this._interactionText = new PIXI.Text('', textStyle({
      fontSize: 15,
      fill: 0x6b8f71,
      fontWeight: '800',
      align: 'left',
      wordWrap: true,
      wordWrapWidth: CONTENT_W,
      lineHeight: 22,
      breakWords: true,
    }));
    this._interactionText.anchor.set(0, 0);
    this._card.addChild(this._interactionText);
  }

  private _refresh(
    blueprint: WorkshopBlueprintDef,
    decoId: string,
    deco: NonNullable<ReturnType<typeof DECO_MAP.get>>,
  ): void {
    const resolved = resolveFurnitureTexture(decoId, deco.icon, {});
    const tex = TextureCache.get(resolved.textureKey);
    this._previewSprite.texture = tex ?? PIXI.Texture.EMPTY;
    if (tex?.width) {
      const s = Math.min(PREVIEW_IMAGE_FIT / tex.width, PREVIEW_IMAGE_FIT / tex.height);
      this._previewSprite.scale.set(resolved.flipped ? -s : s, s);
    } else {
      this._previewSprite.scale.set(1);
    }

    this._nameText.text = getBlueprintDisplayName(blueprint);
    this._descText.text = deco.desc || '默认形态预览';
    this._updateStarBadge(deco.starValue ?? 0);
    this._updateFeatureTags(blueprint);
    this._updateCraftCostSection(blueprint);
    this._updateColorSection(blueprint);
    this._updateInteractionHint(blueprint);
    this._layoutCard(blueprint);
  }

  private _layoutCard(blueprint: WorkshopBlueprintDef): void {
    let y = FOOTER_TOP_Y;
    this._nameText.position.set(POP_W / 2, y);
    y += this._nameText.height + 10;

    this._descText.position.set(POP_PAD_X, y);
    y += this._descText.height + 10;

    const craftH = this._measureCraftCostSection();
    if (craftH > 0) {
      this._craftCostSection.position.set(POP_PAD_X, y);
      y += craftH + 10;
    }

    const colorH = this._measureColorSection(blueprint);
    if (colorH > 0) {
      this._colorSection.position.set(POP_PAD_X, y);
      y += colorH + 10;
    }

    const interactionHint = isWorkshopBlueprintInteractive(blueprint)
      ? getWorkshopBlueprintInteractionHint(blueprint)
      : null;
    if (interactionHint) {
      this._interactionText.visible = true;
      this._interactionText.text = `交互：${interactionHint}`;
      this._interactionText.position.set(POP_PAD_X, y);
      y += this._interactionText.height + 8;
    } else {
      this._interactionText.visible = false;
      this._interactionText.text = '';
    }

    const innerBottom = y + 18;
    const popH = Math.max(440, innerBottom);
    this._drawCardChrome(popH);
    this._card.pivot.set(POP_W / 2, popH / 2);
  }

  private _drawCardChrome(popH: number): void {
    this._cardShadow.clear();
    this._cardShadow.beginFill(0x4a3210, 0.14);
    this._cardShadow.drawRoundedRect(6, 10, POP_W, popH, 24);
    this._cardShadow.endFill();

    this._cardBg.clear();
    this._cardBg.beginFill(0xf2c56d, 1);
    this._cardBg.drawRoundedRect(0, 0, POP_W, popH, 24);
    this._cardBg.endFill();
    this._cardBg.lineStyle(3, 0xffffff, 0.55);
    this._cardBg.drawRoundedRect(2, 2, POP_W - 4, popH - 4, 22);
    this._cardBg.beginFill(0xfffbf3, 1);
    this._cardBg.drawRoundedRect(14, 52, POP_W - 28, popH - 66, 18);
    this._cardBg.endFill();
  }

  private _sectionTitleStyle(): Partial<PIXI.ITextStyle> {
    return {
      fontSize: 14,
      fill: 0x8a7568,
      fontWeight: '900',
    };
  }

  private _updateCraftCostSection(blueprint: WorkshopBlueprintDef): void {
    this._craftCostSection.removeChildren();
    const option = getDefaultWorkshopColorOption(blueprint);
    if (!option) return;

    const title = new PIXI.Text('制作消耗', textStyle(this._sectionTitleStyle()));
    this._craftCostSection.addChild(title);

    const row = new PIXI.Container();
    row.y = title.height + SECTION_TITLE_GAP;
    this._craftCostSection.addChild(row);

    let x = 0;
    x = this._appendCostItem(row, WORKSHOP_MATERIAL_ICON, option.materialCost, x);
    x += COST_ITEM_GAP;
    this._appendCostItem(row, WORKSHOP_HUAYUAN_ICON, option.huayuanCost, x);
  }

  private _appendCostItem(
    row: PIXI.Container,
    iconKey: string,
    amount: number,
    x: number,
  ): number {
    const item = new PIXI.Container();
    item.position.set(x, 0);

    const icon = new PIXI.Sprite(TextureCache.get(iconKey) ?? PIXI.Texture.EMPTY);
    icon.anchor.set(0, 0.5);
    if (icon.texture.width) {
      icon.scale.set(COST_ICON_SIZE / Math.max(icon.texture.width, icon.texture.height));
    }
    icon.position.set(0, COST_ICON_SIZE / 2);
    item.addChild(icon);

    const label = new PIXI.Text(String(amount), textStyle({
      fontSize: 18,
      fill: 0x5c4938,
      fontWeight: '900',
    }));
    label.anchor.set(0, 0.5);
    label.position.set(COST_ICON_SIZE + 6, COST_ICON_SIZE / 2);
    item.addChild(label);

    row.addChild(item);
    return x + COST_ICON_SIZE + 6 + label.width;
  }

  private _measureCraftCostSection(): number {
    if (this._craftCostSection.children.length === 0) return 0;
    const title = this._craftCostSection.children[0] as PIXI.Text;
    return title.height + SECTION_TITLE_GAP + COST_ICON_SIZE;
  }

  private _measureColorSection(blueprint: WorkshopBlueprintDef): number {
    if (!shouldShowWorkshopBlueprintColorPreview(blueprint)) return 0;
    const titleH = 18;
    const labelH = 18;
    return titleH + SECTION_TITLE_GAP + COLOR_CHIP_R * 2 + 6 + labelH;
  }

  private _updateColorSection(blueprint: WorkshopBlueprintDef): void {
    this._colorSection.removeChildren();
    if (!shouldShowWorkshopBlueprintColorPreview(blueprint)) return;

    const title = new PIXI.Text('可选配色', textStyle(this._sectionTitleStyle()));
    this._colorSection.addChild(title);

    const row = new PIXI.Container();
    row.y = title.height + SECTION_TITLE_GAP + COLOR_CHIP_R;
    this._colorSection.addChild(row);

    let x = 0;
    for (const opt of blueprint.colorOptions) {
      const chip = this._makeColorPreviewChip(blueprint, opt, COLOR_CHIP_R);
      chip.position.set(x + COLOR_CHIP_R, COLOR_CHIP_R);
      row.addChild(chip);
      x += COLOR_CHIP_R * 2 + COLOR_CHIP_GAP;
    }
  }

  private _makeColorPreviewChip(
    blueprint: WorkshopBlueprintDef,
    option: WorkshopColorOption,
    chipR: number,
  ): PIXI.Container {
    const chip = new PIXI.Container();
    const isDefault = isDefaultWorkshopColorOption(blueprint, option);
    const labelText = getWorkshopColorChipLabel(blueprint, option);

    const circle = new PIXI.Graphics();
    if (isDefault) {
      this._drawDefaultColorChip(circle, chipR);
    } else {
      circle.beginFill(this._colorSwatch(option.id), 1);
      circle.drawCircle(0, 0, chipR);
      circle.endFill();
      circle.lineStyle(2, 0xffffff, 0.9);
      circle.drawCircle(0, 0, chipR);
    }
    chip.addChild(circle);

    const label = new PIXI.Text(labelText, textStyle({
      fontSize: 14,
      fill: 0x735f52,
      fontWeight: '900',
    }));
    label.anchor.set(0.5, 0);
    label.position.set(0, chipR + 6);
    chip.addChild(label);

    return chip;
  }

  /** 与 FurnitureWorkshopCraftPopup 默认色块一致：白圆 + 斜杠 */
  private _drawDefaultColorChip(g: PIXI.Graphics, chipR: number): void {
    g.beginFill(0xffffff, 1);
    g.drawCircle(0, 0, chipR);
    g.endFill();
    g.lineStyle(2, 0xd0c8c0, 1);
    g.drawCircle(0, 0, chipR);
    const slash = chipR * 0.62;
    g.lineStyle(2.5, 0xb0a8a0, 0.95);
    g.moveTo(-slash, -slash);
    g.lineTo(slash, slash);
  }

  private _colorSwatch(colorId: string): number {
    switch (colorId) {
      case 'sakura': return 0xf5b4d4;
      case 'moon': return 0x9ec5e8;
      case 'honey': return 0xf5d76e;
      default: return 0x8fd86b;
    }
  }

  private _updateInteractionHint(blueprint: WorkshopBlueprintDef): void {
    if (!isWorkshopBlueprintInteractive(blueprint)) {
      this._interactionText.visible = false;
      this._interactionText.text = '';
    }
  }

  private _updateFeatureTags(blueprint: WorkshopBlueprintDef): void {
    this._featureTagWrap.removeChildren();
    appendWorkshopBlueprintFeatureTags(this._featureTagWrap, blueprint, 0, 0, {
      fontSize: 16,
      layout: 'vertical',
      gap: 5,
      align: 'right',
      corner: 'bottom-right',
    });
  }

  private _updateStarBadge(starValue: number): void {
    this._starBadgeWrap.removeChildren();
    appendWorkshopStarValueBadge(this._starBadgeWrap, starValue, 0, 0);
  }

  private _makeButton(label: string, color: number, w: number, h: number, onTap: () => void): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    bg.lineStyle(2, 0xffffff, 0.85);
    bg.drawRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    btn.addChild(bg);

    const txt = new PIXI.Text(label, textStyle({
      fontSize: label === '×' ? 30 : 22,
      fill: 0xffffff,
      fontWeight: '900',
    }));
    txt.anchor.set(0.5);
    txt.y = label === '×' ? -2 : 0;
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return btn;
  }
}
