import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  WORKSHOP_MATERIAL_ICON,
  WORKSHOP_DYE_PINK_ICON,
  WORKSHOP_HUAYUAN_ICON,
  resolveWorkshopMaterialIconKey,
  WORKSHOP_BLUEPRINT_MAP,
  getWorkshopCraftDisplayName,
  getDefaultWorkshopColorOption,
  getWorkshopColorChipLabel,
  isDefaultWorkshopColorOption,
  type WorkshopBlueprintDef,
} from '@/config/FurnitureWorkshopConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TextureCache } from '@/utils/TextureCache';
import { appendWorkshopBlueprintFeatureTags, appendWorkshopStarValueBadge } from '@/utils/WorkshopBlueprintDisplay';

const POP_W = 520;
const POP_H = 640;
const PREVIEW_FRAME_W = 268;
const PREVIEW_FRAME_H = 200;
const PREVIEW_CENTER_Y = 174;
const PREVIEW_NAME_GAP = 12;
const PREVIEW_COLOR_GAP = 88;
const PREVIEW_IMAGE_FIT = 172;

function textStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return { fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK, ...base } as PIXI.ITextStyle;
}

export class FurnitureWorkshopCraftPopup extends PIXI.Container {
  private _blueprintId = '';
  private _selectedColorId = '';
  private _previewSprite!: PIXI.Sprite;
  private _starBadgeWrap!: PIXI.Container;
  private _featureTagWrap!: PIXI.Container;
  private _nameText!: PIXI.Text;
  private _costMaterialText!: PIXI.Text;
  private _costDyeRow!: PIXI.Container;
  private _costDyeText!: PIXI.Text;
  private _costDyeIcon!: PIXI.Sprite;
  private _costHuayuanText!: PIXI.Text;
  private _colorRow!: PIXI.Container;
  private _craftBtnLabel!: PIXI.Text;
  private _craftBtnBg!: PIXI.Graphics;
  private _onClose: (() => void) | null = null;
  private _onCrafted: ((decoId: string, flyGlobal: PIXI.Point) => void) | null = null;
  private _textureUnsub: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this._build();
  }

  open(blueprintId: string, onClose: () => void, onCrafted?: (decoId: string, flyGlobal: PIXI.Point) => void): void {
    const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
    if (!def || def.colorOptions.length === 0) return;
    this._blueprintId = blueprintId;
    this._onClose = onClose;
    this._onCrafted = onCrafted ?? null;
    this.eventMode = 'static';
    const defaultOpt = getDefaultWorkshopColorOption(def)!;
    this._selectedColorId = !FurnitureWorkshopManager.hasCraftedColor(blueprintId, defaultOpt.id)
      ? defaultOpt.id
      : (def.colorOptions.find(c => !FurnitureWorkshopManager.hasCraftedColor(blueprintId, c.id))?.id
        ?? def.colorOptions[0]!.id);
    this.visible = true;
    this._bindTextureRefresh(blueprintId);
    void TextureCache.preloadKeys(this._collectTextureKeys(blueprintId)).finally(() => {
      if (this.visible && this._blueprintId === blueprintId) this._refresh();
    });
    this._refresh();
  }

  close(): void {
    this.visible = false;
    this.eventMode = 'none';
    this._textureUnsub?.();
    this._textureUnsub = null;
    this._onClose?.();
    this._onClose = null;
    this._onCrafted = null;
  }

  refresh(): void {
    if (this.visible) this._refresh();
  }

  private _collectTextureKeys(blueprintId: string): string[] {
    const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
    if (!def) return [];
    const keys = new Set<string>([
      WORKSHOP_MATERIAL_ICON,
      WORKSHOP_HUAYUAN_ICON,
      WORKSHOP_DYE_PINK_ICON,
      'icon_star',
    ]);
    for (const opt of def.colorOptions) {
      const deco = DECO_MAP.get(opt.outputDecoId);
      if (deco?.icon) keys.add(deco.icon);
      if (opt.dyeMaterialId) keys.add(resolveWorkshopMaterialIconKey(opt.dyeMaterialId));
    }
    return [...keys];
  }

  private _bindTextureRefresh(blueprintId: string): void {
    this._textureUnsub?.();
    this._textureUnsub = TextureCache.observeTextureDependencies(
      { keys: this._collectTextureKeys(blueprintId) },
      () => this._refresh(),
    );
  }

  private _build(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.35);
    overlay.drawRect(-400, -400, 1200, 1600);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    const card = new PIXI.Container();
    card.eventMode = 'static';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(card);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xd9c3ff, 1);
    bg.drawRoundedRect(0, 0, POP_W, POP_H, 28);
    bg.endFill();
    bg.beginFill(0xfff8ec, 1);
    bg.drawRoundedRect(16, 56, POP_W - 32, POP_H - 72, 22);
    bg.endFill();
    card.addChild(bg);

    const title = new PIXI.Text('制作家具', textStyle({
      fontSize: 32,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x9b6bd3,
      strokeThickness: 4,
    }));
    title.anchor.set(0.5, 0);
    title.position.set(POP_W / 2, 14);
    card.addChild(title);

    const closeBtn = this._makeButton('×', 0xe85d75, 48, 48, () => this.close());
    closeBtn.position.set(POP_W - 36, 36);
    card.addChild(closeBtn);

    const previewBox = new PIXI.Container();
    previewBox.position.set(POP_W / 2, PREVIEW_CENTER_Y);
    card.addChild(previewBox);

    const halfW = PREVIEW_FRAME_W / 2;
    const halfH = PREVIEW_FRAME_H / 2;
    const previewFrame = new PIXI.Graphics();
    previewFrame.beginFill(0xffffff, 0.95);
    previewFrame.drawRoundedRect(-halfW, -halfH, PREVIEW_FRAME_W, PREVIEW_FRAME_H, 18);
    previewFrame.endFill();
    previewFrame.lineStyle(2, 0xe8d4b8, 1);
    previewFrame.drawRoundedRect(-halfW + 1, -halfH + 1, PREVIEW_FRAME_W - 2, PREVIEW_FRAME_H - 2, 17);
    previewBox.addChild(previewFrame);

    this._previewSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this._previewSprite.anchor.set(0.5);
    previewBox.addChild(this._previewSprite);

    this._starBadgeWrap = new PIXI.Container();
    this._starBadgeWrap.position.set(-halfW + 8, -halfH + 8);
    previewBox.addChild(this._starBadgeWrap);

    this._featureTagWrap = new PIXI.Container();
    this._featureTagWrap.position.set(halfW - 8, halfH - 8);
    previewBox.addChild(this._featureTagWrap);

    this._nameText = new PIXI.Text('', textStyle({ fontSize: 26, fontWeight: '900', fill: 0x6a4b7f }));
    this._nameText.anchor.set(0.5, 0);
    this._nameText.position.set(POP_W / 2, PREVIEW_CENTER_Y + halfH + PREVIEW_NAME_GAP);
    card.addChild(this._nameText);

    this._colorRow = new PIXI.Container();
    this._colorRow.position.set(POP_W / 2, PREVIEW_CENTER_Y + halfH + PREVIEW_COLOR_GAP);
    card.addChild(this._colorRow);

    this._costMaterialText = this._addResourceRow(card, 410, WORKSHOP_MATERIAL_ICON);

    this._costDyeRow = new PIXI.Container();
    card.addChild(this._costDyeRow);
    this._costDyeIcon = new PIXI.Sprite(TextureCache.get(WORKSHOP_DYE_PINK_ICON) ?? PIXI.Texture.EMPTY);
    this._costDyeIcon.anchor.set(0.5);
    if (this._costDyeIcon.texture.width) {
      this._costDyeIcon.scale.set(28 / Math.max(this._costDyeIcon.texture.width, this._costDyeIcon.texture.height));
    }
    this._costDyeIcon.position.set(52, 466);
    this._costDyeRow.addChild(this._costDyeIcon);
    this._costDyeText = new PIXI.Text('', textStyle({ fontSize: 22, fill: 0x5c4938, fontWeight: '900' }));
    this._costDyeText.position.set(88, 452);
    this._costDyeRow.addChild(this._costDyeText);

    this._costHuayuanText = this._addResourceRow(card, 494, WORKSHOP_HUAYUAN_ICON);

    const cancelBtn = this._makeButton('取消', 0xf08a9a, 168, 52, () => this.close());
    cancelBtn.position.set(POP_W / 2 - 98, POP_H - 58);
    card.addChild(cancelBtn);

    const craftBtn = this._makeButton('立即制作', 0x7eb8ff, 168, 52, () => this._onCraftTap());
    craftBtn.position.set(POP_W / 2 + 98, POP_H - 58);
    this._craftBtnBg = craftBtn.children[0] as PIXI.Graphics;
    this._craftBtnLabel = craftBtn.children[1] as PIXI.Text;
    card.addChild(craftBtn);

    this.pivot.set(POP_W / 2, POP_H / 2);
  }

  /** 消耗行：仅图标 +「需要/已有」 */
  private _addResourceRow(
    parent: PIXI.Container,
    y: number,
    iconKey: string,
    tint?: number,
  ): PIXI.Text {
    const icon = new PIXI.Sprite(TextureCache.get(iconKey) ?? PIXI.Texture.EMPTY);
    icon.anchor.set(0.5);
    if (icon.texture.width) {
      icon.scale.set(28 / Math.max(icon.texture.width, icon.texture.height));
    }
    icon.position.set(52, y + 14);
    if (tint != null) icon.tint = tint;
    parent.addChild(icon);

    const txt = new PIXI.Text('', textStyle({ fontSize: 22, fill: 0x5c4938, fontWeight: '900' }));
    txt.position.set(88, y);
    parent.addChild(txt);
    return txt;
  }

  private _setCostFraction(text: PIXI.Text, need: number, have: number): void {
    text.text = `${need}/${have}`;
    text.style.fill = have >= need ? 0x58934b : 0xd15b4d;
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

  private _refresh(): void {
    const def = WORKSHOP_BLUEPRINT_MAP.get(this._blueprintId);
    if (!def) return;
    const option = def.colorOptions.find(c => c.id === this._selectedColorId) ?? def.colorOptions[0]!;
    const deco = DECO_MAP.get(option.outputDecoId);

    const tex = TextureCache.get(deco?.icon ?? '');
    this._previewSprite.texture = tex ?? PIXI.Texture.EMPTY;
    if (tex?.width) {
      this._previewSprite.scale.set(Math.min(PREVIEW_IMAGE_FIT / tex.width, PREVIEW_IMAGE_FIT / tex.height));
    } else {
      this._previewSprite.scale.set(1);
    }

    this._nameText.text = getWorkshopCraftDisplayName(def, option);
    this._updateStarBadge(deco?.starValue ?? 0);
    this._updateFeatureTags(def);
    this._rebuildColorRow(def);

    const haveMat = FurnitureWorkshopManager.getWorkshopMaterialCount();
    this._setCostFraction(this._costMaterialText, option.materialCost, haveMat);

    this._costDyeRow.visible = option.dyeCost > 0 && !!option.dyeMaterialId;
    if (this._costDyeRow.visible && option.dyeMaterialId) {
      const dyeIconKey = resolveWorkshopMaterialIconKey(option.dyeMaterialId);
      this._costDyeIcon.texture = TextureCache.get(dyeIconKey) ?? PIXI.Texture.EMPTY;
      this._costDyeIcon.tint = 0xffffff;
      const haveDye = FurnitureWorkshopManager.getResourceCount(option.dyeMaterialId);
      this._setCostFraction(this._costDyeText, option.dyeCost, haveDye);
    }

    const haveHy = CurrencyManager.state.huayuan;
    this._setCostFraction(this._costHuayuanText, option.huayuanCost, haveHy);

    const check = FurnitureWorkshopManager.canCraftColor(this._blueprintId, option.id);
    const crafted = FurnitureWorkshopManager.hasCraftedColor(this._blueprintId, option.id);
    this._craftBtnLabel.text = crafted ? '已制作' : (check.ok ? '立即制作' : '未满足');
    this._craftBtnBg.clear();
    const btnColor = crafted ? 0xb9aaa4 : (check.ok ? 0x7eb8ff : 0xb9aaa4);
    this._craftBtnBg.beginFill(btnColor, 1);
    this._craftBtnBg.drawRoundedRect(-84, -26, 168, 52, 26);
    this._craftBtnBg.endFill();
    this._craftBtnBg.lineStyle(2, 0xffffff, 0.85);
    this._craftBtnBg.drawRoundedRect(-82, -24, 164, 48, 24);
  }

  private _updateFeatureTags(def: WorkshopBlueprintDef): void {
    this._featureTagWrap.removeChildren();
    appendWorkshopBlueprintFeatureTags(this._featureTagWrap, def, 0, 0, {
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

  private _rebuildColorRow(def: WorkshopBlueprintDef): void {
    this._colorRow.removeChildren();
    if (def.colorOptions.length <= 1) return;

    const chipR = 22;
    const gap = 16;
    const totalW = def.colorOptions.length * chipR * 2 + (def.colorOptions.length - 1) * gap;
    let x = -totalW / 2 + chipR;

    for (const opt of def.colorOptions) {
      const crafted = FurnitureWorkshopManager.hasCraftedColor(def.id, opt.id);
      const selected = opt.id === this._selectedColorId;
      const chip = new PIXI.Container();
      chip.position.set(x, 0);
      chip.eventMode = 'static';
      chip.cursor = crafted ? 'default' : 'pointer';

      const circle = new PIXI.Graphics();
      if (isDefaultWorkshopColorOption(def, opt)) {
        this._drawDefaultColorChip(circle, chipR, selected, crafted);
      } else {
        circle.beginFill(this._colorSwatch(opt.id), crafted ? 0.45 : 1);
        circle.drawCircle(0, 0, chipR);
        circle.endFill();
        if (selected) {
          circle.lineStyle(3, 0x7b4b18, 1);
          circle.drawCircle(0, 0, chipR + 2);
        } else {
          circle.lineStyle(2, 0xffffff, 0.9);
          circle.drawCircle(0, 0, chipR);
        }
      }
      chip.addChild(circle);

      const label = new PIXI.Text(getWorkshopColorChipLabel(def, opt), textStyle({
        fontSize: 14,
        fill: crafted ? 0xb0a5a0 : 0x735f52,
        fontWeight: '900',
      }));
      label.anchor.set(0.5, 0);
      label.y = chipR + 6;
      chip.addChild(label);

      if (crafted) {
        const mark = new PIXI.Text('✓', textStyle({ fontSize: 18, fill: 0xffffff, fontWeight: '900' }));
        mark.anchor.set(0.5);
        chip.addChild(mark);
      }

      chip.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (crafted) {
          ToastMessage.show('这个颜色已经制作过了');
          return;
        }
        this._selectedColorId = opt.id;
        this._refresh();
      });

      this._colorRow.addChild(chip);
      x += chipR * 2 + gap;
    }
  }

  private _drawDefaultColorChip(
    g: PIXI.Graphics,
    chipR: number,
    selected: boolean,
    crafted: boolean,
  ): void {
    g.beginFill(0xffffff, crafted ? 0.55 : 1);
    g.drawCircle(0, 0, chipR);
    g.endFill();
    g.lineStyle(selected ? 3 : 2, selected ? 0x7b4b18 : 0xd0c8c0, crafted ? 0.7 : 1);
    g.drawCircle(0, 0, chipR);
    const slash = chipR * 0.62;
    g.lineStyle(2.5, crafted ? 0xc8c0b8 : 0xb0a8a0, crafted ? 0.65 : 0.95);
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

  private _onCraftTap(): void {
    const option = WORKSHOP_BLUEPRINT_MAP.get(this._blueprintId)?.colorOptions.find(c => c.id === this._selectedColorId);
    if (!option) return;
    if (FurnitureWorkshopManager.hasCraftedColor(this._blueprintId, option.id)) {
      ToastMessage.show('这个颜色已经制作过了');
      return;
    }

    const result = FurnitureWorkshopManager.craftColor(this._blueprintId, option.id);
    if (result.ok) {
      const flyGlobal = this._previewSprite.toGlobal(new PIXI.Point(0, 0));
      this._onCrafted?.(option.outputDecoId, flyGlobal);
      this.close();
      return;
    }
    ToastMessage.show(this.craftReasonText(result.reason));
  }

  craftReasonText(reason: string | undefined): string {
    switch (reason) {
      case 'missing_blueprint': return '还没有这张图纸';
      case 'already_crafted': return '这个颜色已经制作过了';
      case 'locked': return '制作条件未满足';
      case 'missing_material': return '工坊材料不足';
      case 'missing_dye': return '染料不足';
      case 'not_enough_huayuan': return '花愿不足';
      default: return '暂时无法制作';
    }
  }
}
