class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const cx = W / 2, cy = H / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x080c08, 1);
    bg.fillRect(0, 0, W, H);

    // Subtle grid pattern
    bg.lineStyle(1, 0x111811, 1);
    for (let x = 0; x < W; x += 32) bg.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 32) bg.lineBetween(0, y, W, y);

    // Title
    this.add.text(cx, cy - 80, 'reSources', {
      fontSize: '72px', fontStyle: 'bold', fontFamily: 'monospace',
      fill: '#55cc55',
    }).setOrigin(0.5);

    // Tagline
    this.add.text(cx, cy + 10, 'Rise your community, regenerate resources', {
      fontSize: '20px', fontFamily: 'monospace', fill: '#557755',
    }).setOrigin(0.5);

    // Play button
    const btnW = 180, btnH = 52;
    const btnX = cx - btnW / 2, btnY = cy + 70;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x2d6e2d, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(2, 0x55cc55, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    this.add.text(cx, btnY + btnH / 2, 'PLAY', {
      fontSize: '22px', fontStyle: 'bold', fontFamily: 'monospace', fill: '#ffffff',
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX, btnY, btnW, btnH)
      .setOrigin(0).setInteractive({ useHandCursor: true });

    // Hover effect
    zone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x3d9e3d, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnBg.lineStyle(2, 0x88ff88, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });
    zone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2d6e2d, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnBg.lineStyle(2, 0x55cc55, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    });
    zone.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
