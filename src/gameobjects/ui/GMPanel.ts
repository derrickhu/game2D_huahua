/**
 * GM 调试面板 - 游戏内 GM 工具
 *
 * 类似魔兽世界 GM 命令面板，提供各种调试功能按钮。
 * 激活方式：连按店铺招牌 5 次
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { GMManager, GMCommand } from '@/managers/GMManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

/** 按钮行高 */
const BTN_H = 44;
/** 按钮间距 */
const BTN_GAP = 6;
/** 面板内边距 */
const PAD = 16;

export class GMPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _resultText!: PIXI.Text;
  private _isOpen = false;
  private _scrollY = 0;
  private _maxScrollY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 9000; // 最高层级，覆盖一切
    this._build();
    this._bindEvents();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._scrollY = 0;
    this._refresh();

    this.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.25, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _bindEvents(): void {
    EventBus.on('gm:open', () => this.open());
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // 半透明遮罩
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.6);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    // 内容容器
    this._content = new PIXI.Container();
    this._content.pivot.set(w / 2, h / 2);
    this._content.position.set(w / 2, h / 2);
    this.addChild(this._content);
  }

  private _refresh(): void {
    // 清除旧内容
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    const cx = DESIGN_WIDTH / 2;
    const panelW = 660;
    const panelH = Math.min(Game.logicHeight - 80, 900);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 16);
    bg.endFill();
    bg.lineStyle(2, 0x00FF88, 0.6);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 16);
    bg.eventMode = 'static'; // 阻止穿透
    this._content.addChild(bg);

    // 标题栏
    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0x16213e);
    titleBg.drawRoundedRect(panelX, panelY, panelW, 50, 16);
    titleBg.endFill();
    // 补一个矩形遮住下方圆角
    titleBg.beginFill(0x16213e);
    titleBg.drawRect(panelX, panelY + 34, panelW, 16);
    titleBg.endFill();
    this._content.addChild(titleBg);

    const title = new PIXI.Text('🛠️ GM 调试面板', {
      fontSize: 22,
      fill: 0x00FF88,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(cx, panelY + 25);
    this._content.addChild(title);

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 24, fill: 0xFF6666, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 28, panelY + 25);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 结果反馈文本
    this._resultText = new PIXI.Text('', {
      fontSize: 13,
      fill: 0x00FF88,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: panelW - PAD * 4,
    });
    this._resultText.position.set(panelX + PAD, panelY + panelH - 36);
    this._content.addChild(this._resultText);

    // 可滚动区域（裁剪区域）
    const scrollAreaY = panelY + 56;
    const scrollAreaH = panelH - 56 - 44; // 留出底部结果区

    // 创建遮罩
    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(panelX, scrollAreaY, panelW, scrollAreaH);
    mask.endFill();
    this._content.addChild(mask);

    // 滚动容器
    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    // 构建按钮列表
    let curY = scrollAreaY + 8;
    const btnW = panelW - PAD * 2;
    const groups = GMManager.groups;

    for (const group of groups) {
      // 分组标题
      const groupTitle = new PIXI.Text(group, {
        fontSize: 15,
        fill: 0xFFD700,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      groupTitle.position.set(panelX + PAD, curY);
      this._scrollContainer.addChild(groupTitle);
      curY += 24;

      // 该分组下的指令
      const commands = GMManager.getCommandsByGroup(group);

      // 每行放2个按钮
      const colW = (btnW - BTN_GAP) / 2;
      for (let i = 0; i < commands.length; i += 2) {
        for (let j = 0; j < 2 && i + j < commands.length; j++) {
          const cmd = commands[i + j];
          const btnX = panelX + PAD + j * (colW + BTN_GAP);
          this._createButton(cmd, btnX, curY, colW, BTN_H);
        }
        curY += BTN_H + BTN_GAP;
      }

      curY += 8; // 分组间距
    }

    // 计算最大滚动范围
    const totalContentH = curY - scrollAreaY;
    this._maxScrollY = Math.max(0, totalContentH - scrollAreaH);

    // 滚动交互：直接绑定到面板背景 bg 上（bg 在 _scrollContainer 下方，不会遮挡按钮）
    let lastTouchY = 0;
    let isDragging = false;

    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localY = e.globalY / Game.scale;
      // 只在滚动区域内启动拖拽
      if (localY >= scrollAreaY && localY <= scrollAreaY + scrollAreaH) {
        lastTouchY = localY;
        isDragging = true;
      }
    });
    bg.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const curTouchY = e.globalY / Game.scale;
      const delta = lastTouchY - curTouchY;
      lastTouchY = curTouchY;
      this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + delta));
      this._scrollContainer.y = -this._scrollY;
    });
    bg.on('pointerup', () => { isDragging = false; });
    bg.on('pointerupoutside', () => { isDragging = false; });
  }

  /** 创建单个指令按钮 */
  private _createButton(cmd: GMCommand, x: number, y: number, w: number, h: number): void {
    // 按钮背景
    const btn = new PIXI.Graphics();
    btn.beginFill(0x0f3460);
    btn.drawRoundedRect(x, y, w, h, 8);
    btn.endFill();
    btn.lineStyle(1, 0x00FF88, 0.3);
    btn.drawRoundedRect(x, y, w, h, 8);
    this._scrollContainer.addChild(btn);

    // 按钮名称
    const nameText = new PIXI.Text(cmd.name, {
      fontSize: 13,
      fill: 0xEEEEEE,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    nameText.position.set(x + 8, y + 6);
    this._scrollContainer.addChild(nameText);

    // 按钮描述
    const descText = new PIXI.Text(cmd.desc, {
      fontSize: 10,
      fill: 0x888888,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: w - 16,
    });
    descText.position.set(x + 8, y + 24);
    this._scrollContainer.addChild(descText);

    // 点击区域
    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Rectangle(x, y, w, h);
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      // 按钮点击反馈（闪烁）
      btn.tint = 0x00FF88;
      setTimeout(() => { btn.tint = 0xFFFFFF; }, 150);

      const result = GMManager.executeCommand(cmd.id);
      this._showResult(result);
    });
    this._scrollContainer.addChild(hitArea);
  }

  /** 显示执行结果 */
  private _showResult(text: string): void {
    this._resultText.text = `> ${text}`;
    this._resultText.alpha = 1;
    // 3秒后淡出
    TweenManager.cancelTarget(this._resultText);
    TweenManager.to({
      target: this._resultText,
      props: { alpha: 0 },
      duration: 0.5,
      delay: 3,
    });
  }
}
