import Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT, COLORS } from '../config/Constants';
import { CurrencyManager, CurrencyState } from '../managers/CurrencyManager';
import { EventManager, GameEvents } from '../managers/EventManager';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private wishText!: Phaser.GameObjects.Text;
  private dewText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // === 顶部信息栏 ===
    this.createTopBar();

    // === 底部导航栏 ===
    this.createNavBar();

    // 监听货币变化
    EventManager.on(GameEvents.CURRENCY_CHANGED, this.updateCurrencyDisplay, this);

    // 初始显示
    this.updateCurrencyDisplay(CurrencyManager.getState());
  }

  private createTopBar(): void {
    // 半透明背景
    const topBg = this.add.graphics();
    topBg.fillStyle(0xFFFFFF, 0.85);
    topBg.fillRoundedRect(0, 0, GAME_WIDTH, LAYOUT.TOP_BAR_HEIGHT, { tl: 0, tr: 0, bl: 16, br: 16 });

    // 金币
    this.add.text(40, 40, '💰', { fontSize: '24px' }).setOrigin(0.5);
    this.goldText = this.add.text(80, 40, '0', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#DAA520',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // 花愿
    this.add.text(230, 40, '🌸', { fontSize: '24px' }).setOrigin(0.5);
    this.wishText = this.add.text(260, 40, '0', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#C89EFF',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // 花露
    this.add.text(420, 40, '💧', { fontSize: '24px' }).setOrigin(0.5);
    this.dewText = this.add.text(450, 40, '0', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#7EC8E3',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // 设置按钮
    const settingsBtn = this.add.text(GAME_WIDTH - 40, 40, '⚙️', {
      fontSize: '28px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => {
      console.log('Settings clicked');
    });
  }

  private createNavBar(): void {
    const navBg = this.add.graphics();
    navBg.fillStyle(0xFFFFFF, 0.9);
    navBg.fillRoundedRect(0, LAYOUT.NAV_BAR_Y, GAME_WIDTH, LAYOUT.NAV_BAR_HEIGHT, { tl: 16, tr: 16, bl: 0, br: 0 });

    // 导航线
    navBg.lineStyle(1, 0xE0D5C8, 0.5);
    navBg.strokeRoundedRect(0, LAYOUT.NAV_BAR_Y, GAME_WIDTH, LAYOUT.NAV_BAR_HEIGHT, { tl: 16, tr: 16, bl: 0, br: 0 });

    const navItems = [
      { icon: '🏠', label: '花店', key: 'MainScene' },
      { icon: '🎨', label: '装修', key: 'DecorationScene' },
      { icon: '👗', label: '换装', key: 'DressUpScene' },
      { icon: '📖', label: '图鉴', key: 'AlbumScene' },
      { icon: '👥', label: '社交', key: 'SocialScene' },
    ];

    const spacing = GAME_WIDTH / navItems.length;
    navItems.forEach((item, index) => {
      const x = spacing * index + spacing / 2;
      const y = LAYOUT.NAV_BAR_Y + LAYOUT.NAV_BAR_HEIGHT / 2;

      const icon = this.add.text(x, y - 12, item.icon, {
        fontSize: '28px',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.add.text(x, y + 22, item.label, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: index === 0 ? '#E91E63' : '#8A7A6A',
      }).setOrigin(0.5);

      icon.on('pointerdown', () => {
        if (index === 0) return; // 已在主页
        // 后续阶段实现页面切换
        console.log(`Navigate to: ${item.key} (阶段1暂未实现)`);
      });
    });
  }

  private updateCurrencyDisplay(state: CurrencyState): void {
    if (this.goldText) this.goldText.setText(`${state.gold}`);
    if (this.wishText) this.wishText.setText(`${state.wish}`);
    if (this.dewText) this.dewText.setText(`${state.dew}`);
  }
}
