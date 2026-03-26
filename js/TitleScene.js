class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  preload() {
    this.load.audio('sfx-button', 'sfx/sfx-button.mp3');
    this.load.bitmapFont('pixel', 'font/FreePixel-16.png', 'font/FreePixel-16.xml?v1');
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const cx = W / 2, cy = H / 2 - 100;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x080c08, 1);
    bg.fillRect(0, 0, W, H);
    bg.lineStyle(1, 0x111811, 1);
    for (let x = 0; x < W; x += 32) bg.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 32) bg.lineBetween(0, y, W, y);

    // Title
    this.add.bitmapText(cx, cy - 120, 'pixel', 'reSources', 64).setTint(0x55cc55).setOrigin(0.5);

    // Tagline
    this.add.bitmapText(cx, cy - 50, 'pixel', t('tagline'), 32).setTint(0x557755).setOrigin(0.5);

    // Story
    this.add.bitmapText(cx, cy + 80, 'pixel', t('story'), 32).setMaxWidth(800).setOrigin(0.5);

    // ── Play button ──────────────────────────────────────────────────────────
    const btnW = 500, btnH = 52;
    const btnX = cx - btnW / 2, btnY = cy + 230;

    const btnBg = this.add.graphics();
    const drawPlay = (hover) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? 0x3d9e3d : 0x2d6e2d, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnBg.lineStyle(2, hover ? 0x88ff88 : 0x55cc55, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    drawPlay(false);

    this.add.bitmapText(cx, btnY + btnH / 2, 'pixel', t('play_btn'), 32).setOrigin(0.5);

    const playZone = this.add.zone(btnX, btnY, btnW, btnH)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    playZone.on('pointerover',  () => drawPlay(true));
    playZone.on('pointerout',   () => drawPlay(false));
    playZone.on('pointerdown',  () => {
      this.sound.play('sfx-button');
      this.scale.startFullscreen();
      playZone.removeInteractive();
      const fade = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setAlpha(0).setDepth(10);
      this.tweens.add({
        targets: fade, alpha: 1, duration: 1000,
        onComplete: () => this.scene.start('GameScene'),
      });
    });

    // ── Language link (plain text, bottom of screen) ─────────────────────────
    const langTxt = this.add.bitmapText(cx, H - 100, 'pixel', t('lang_btn'), 32).setTint(0x555555).setOrigin(0.5).setInteractive({ useHandCursor: true });
    langTxt.on('pointerover',  () => langTxt.setTint(0xaaaaaa));
    langTxt.on('pointerout',   () => langTxt.setTint(0x555555));
    langTxt.on('pointerdown',  () => {
      this.sound.play('sfx-button');
      window._gameLang = window._gameLang === 'fr' ? 'en' : 'fr';
      this.scene.restart();
    });
  }
}
