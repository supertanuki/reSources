class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
  }

  preload() {
    this.load.audio('sfx-button',       'sfx/sfx-button.mp3');
    this.load.audio('sfx-notification', 'sfx/sfx-notification.mp3');
    this.load.audio('sfx-warning',      'sfx/sfx-warning.mp3');
  }

  create() {
    this.sfxButton       = this.sound.add('sfx-button');
    this.sfxNotification = this.sound.add('sfx-notification');
    this.sfxWarning      = this.sound.add('sfx-warning');
    this.alertLandTriggered = false;
    this.alertWaterTriggered = false;
    this.alertWaterCriticalTriggered = false;
    this.alertWaterCriticalLastTime = -Infinity;
    this.gameOver = false;
    this.overlayOpen = false;
    this.alertHistory = [];
    this.journalOpen = false;
    this._journalEntries = [];
    this._journalTimer = null;

    this._buildHUD();
    this._buildAlertPopup();
    this._buildJournalOverlay();
    this._buildGameOverPopup();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────

  _buildHUD() {
    const W = GAME_WIDTH,
      H = UI_HEIGHT;

    // Background bar
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0a, 0.88);
    bg.fillRect(0, 0, W, H);
    bg.lineStyle(1, 0x333333, 1);
    bg.lineBetween(0, H - 1, W, H - 1);

    // Title
    this.add
      .text(14, H / 2, "reSources", {
        fontSize: "15px",
        fontStyle: "bold",
        fill: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);

    // Resource bars: [label, stateKey, x, color]
    const barDefs = [
      { label: "Land health", key: "land_health", x: 140, color: 0x55cc55 },
      { label: "Water", key: "water", x: 340, color: 0x4499ff },
      { label: "Community", key: "community", x: 540, color: 0xffaa33 },
    ];

    this._barFills = [];

    for (const def of barDefs) {
      this.add.text(def.x, 10, def.label, {
        fontSize: "11px",
        fill: "#aaaaaa",
        fontFamily: "monospace",
      });

      // Track bg
      const trackBg = this.add.graphics();
      trackBg.fillStyle(0x2a2a2a, 1);
      trackBg.fillRoundedRect(def.x, 26, 160, 14, 3);

      // Fill (dynamic)
      const fill = this.add.graphics();
      this._barFills.push({ fill, def });

      // Value text
      const valText = this.add.text(def.x + 164, 26, "100", {
        fontSize: "11px",
        fill: "#888888",
        fontFamily: "monospace",
      });
      this._barFills[this._barFills.length - 1].valText = valText;
    }

    // Buttons
    this._btnBuild    = this._makeButton(910,  12, 150, 'BUILD\n0/5 wood',     () => this._setAction(GameState.ACTION_BUILD));
    this._btnFarm     = this._makeButton(1075, 12, 120, 'FARM\n0/1 wood',       () => this._setAction(GameState.ACTION_FARM));
    this._btnReforest = this._makeButton(1210, 12, 150, 'PLANT TREE\n0/1 wood', () => this._setAction(GameState.ACTION_REFOREST));
    this._btnJournal  = this._makeButton(1800, 12, 108, 'JOURNAL',              () => this._openJournal());

    this.farmUnlocked     = false;
    this.reforestUnlocked = false;
    this._setBtnVisible(this._btnFarm,     false);
    this._setBtnVisible(this._btnReforest, false);

    this._refreshButtons();
  }

  _makeButton(x, y, w, label, cb) {
    const h = 46;
    const bg = this.add.graphics();
    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontSize: "13px",
        fontStyle: "bold",
        fill: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(x, y, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const btn = { bg, txt, zone, x, y, w, h, disabled: false, active: false, hovered: false };
    zone.on("pointerdown",  () => { if (!btn.disabled) { this.sfxButton.play(); cb(); } });
    zone.on("pointerover",  () => { if (!btn.disabled) { btn.hovered = true;  this._drawButton(btn, btn.active, btn.disabled); } });
    zone.on("pointerout",   () => {                       btn.hovered = false; this._drawButton(btn, btn.active, btn.disabled); });
    return btn;
  }

  _setBtnVisible(btn, visible) {
    btn.bg.setVisible(visible);
    btn.txt.setVisible(visible);
    if (visible) btn.zone.setInteractive({ useHandCursor: true });
    else btn.zone.removeInteractive();
  }

  _drawButton(btn, active, disabled) {
    btn.disabled = disabled;
    btn.active = active;
    btn.bg.clear();
    let color, border;
    if (disabled) {
      color = 0x2a2a2a; border = 0x555555;
    } else if (active) {
      color = btn.hovered ? 0x3d8e3d : 0x2d6e2d; border = 0x55cc55;
    } else {
      color = btn.hovered ? 0x555555 : 0x3a3a3a;
      border = btn.hovered ? 0xaaaaaa : 0x888888;
    }
    btn.bg.lineStyle(1, border, 1);
    btn.bg.fillStyle(color, 1);
    btn.bg.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);
    btn.bg.strokeRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);
    btn.txt.setAlpha(disabled ? 0.5 : 1);
    btn.zone.setInteractive({ useHandCursor: true });
  }

  _setAction(action) {
    GameState.current_action = action;
    this._refreshButtons();
  }

  _refreshButtons() {
    const gameScene   = this.scene.get('GameScene');
    const buildings   = gameScene ? gameScene.buildingCells.length : 0;
    const gardens     = gameScene ? gameScene.gardens.length : 0;
    const withinLimit = buildings === 0 || buildings < gardens;
    const canBuild    = GameState.wood >= GameState.BUILDING_WOOD_COST &&
                        (!GameState.shelterBuilt || GameState.gardenPlaced) &&
                        withinLimit;
    const canReforest = GameState.wood >= 1;
    const hasReplantable = gameScene && gameScene.gardens.some(g => g.stage === 3 || g.stage === 4);
    const canFarm     = GameState.wood >= 1 || hasReplantable;
    this._btnBuild.txt.setText(`BUILD\n${GameState.wood}/${GameState.BUILDING_WOOD_COST} wood`);
    this._drawButton(this._btnBuild, GameState.current_action === GameState.ACTION_BUILD, !canBuild);
    if (this.farmUnlocked) {
      this._btnFarm.txt.setText(`FARM\n${GameState.wood}/1 wood`);
      this._drawButton(this._btnFarm, GameState.current_action === GameState.ACTION_FARM, !canFarm);
    }
    if (this.reforestUnlocked) {
      this._btnReforest.txt.setText(`PLANT TREE\n${GameState.wood}/1 wood`);
      this._drawButton(this._btnReforest, GameState.current_action === GameState.ACTION_REFOREST, !canReforest);
    }
  }

  // ── Alert banner (full-width, bottom of screen) ──────────────────────────────

  _buildAlertPopup() {
    const W = GAME_WIDTH;
    const H = 100;
    const py = GAME_HEIGHT - H;

    // Gradient overlay: transparent → black 50%, above the alert banner
    this._alertGradient = this.add.graphics().setDepth(99).setVisible(false);
    this._alertGradient.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5);
    this._alertGradient.fillRect(0, UI_HEIGHT, W, GAME_HEIGHT - UI_HEIGHT - H);

    this.alertPopup = this.add
      .container(0, py)
      .setVisible(false)
      .setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x111111, 0.97);
    bg.fillRect(0, 0, W, H);
    bg.lineStyle(2, 0xffaa00, 1);
    bg.lineBetween(0, 0, W, 0);

    this.alertLabel = this.add
      .text(W / 2, H / 2 - 12, "", {
        fontSize: "18px",
        fill: "#ffcc44",
        fontFamily: "monospace",
        align: "center",
        wordWrap: { width: W - 200 },
      })
      .setOrigin(0.5, 0.5);

    this._okBg = this.add.graphics();
    this._drawOkBtn(false);

    this._okTxt = this.add
      .text(W - 70, H / 2, "OK", {
        fontSize: "15px",
        fill: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const okZone = this.add
      .zone(W - 120, H / 2 - 17, 100, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    okZone.on("pointerover",  () => this._drawOkBtn(true));
    okZone.on("pointerout",   () => this._drawOkBtn(false));
    okZone.on("pointerdown", () => {
      this.sfxButton.play();
      this.tweens.killTweensOf([this._okBg, this._okTxt]);
      this._okBg.setAlpha(1);
      this._okTxt.setAlpha(1);
      this._alertGradient.setVisible(false);
      this.alertPopup.setVisible(false);
      this.overlayOpen = false;
      this.scene.resume("GameScene");
    });

    this.alertPopup.add([bg, this.alertLabel, this._okBg, this._okTxt, okZone]);
  }

  // ── Journal ──────────────────────────────────────────────────────────────────

  _buildJournalOverlay() {
    const W = GAME_WIDTH, headerH = 60, sepY = UI_HEIGHT + headerH;

    this._journalBg = this.add.graphics().setDepth(200).setVisible(false);
    this._journalBg.fillStyle(0x000000, 0.88);
    this._journalBg.fillRect(0, UI_HEIGHT, W, GAME_HEIGHT - UI_HEIGHT);
    this._journalBg.lineStyle(1, 0x333333, 1);
    this._journalBg.lineBetween(0, sepY, W, sepY);

    this._journalTitle = this.add.text(W / 2, UI_HEIGHT + headerH / 2, 'JOURNAL', {
      fontSize: '20px', fontStyle: 'bold', fontFamily: 'monospace', fill: '#ffcc44',
    }).setOrigin(0.5).setDepth(201).setVisible(false);

    // Close button
    this._journalCloseBg = this.add.graphics().setDepth(201).setVisible(false);
    this._journalCloseTxt = this.add.text(W - 50, UI_HEIGHT + headerH / 2, 'CLOSE', {
      fontSize: '13px', fontStyle: 'bold', fontFamily: 'monospace', fill: '#ffffff',
    }).setOrigin(0.5).setDepth(202).setVisible(false);
    this._drawJournalCloseBtn(false);

    const closeZone = this.add.zone(W - 80, UI_HEIGHT + 10, 60, 40)
      .setOrigin(0).setDepth(202).setInteractive({ useHandCursor: true }).setVisible(false);
    this._journalCloseZone = closeZone;
    closeZone.on('pointerover',  () => this._drawJournalCloseBtn(true));
    closeZone.on('pointerout',   () => this._drawJournalCloseBtn(false));
    closeZone.on('pointerdown',  () => this._closeJournal());
  }

  _drawJournalCloseBtn(hovered) {
    const W = GAME_WIDTH, headerH = 60;
    this._journalCloseBg.clear();
    this._journalCloseBg.fillStyle(hovered ? 0x666666 : 0x333333, 1);
    this._journalCloseBg.fillRoundedRect(W - 80, UI_HEIGHT + 10, 60, 40, 4);
  }

  _openJournal() {
    if (this.overlayOpen) return;
    this.journalOpen = true;
    this.overlayOpen = true;
    this._journalBg.setVisible(true);
    this._journalTitle.setVisible(true);
    this._journalCloseBg.setVisible(true);
    this._journalCloseTxt.setVisible(true);
    this._journalCloseZone.setVisible(true).setInteractive({ useHandCursor: true });
    this._drawButton(this._btnJournal, false, true);
    this.scene.pause('GameScene');
    this._refreshJournalEntries();
  }

  _closeJournal() {
    this.sfxButton.play();
    this.journalOpen = false;
    this.overlayOpen = false;
    this._journalBg.setVisible(false);
    this._journalTitle.setVisible(false);
    this._journalCloseBg.setVisible(false);
    this._journalCloseTxt.setVisible(false);
    this._journalCloseZone.setVisible(false).removeInteractive();
    this._drawButton(this._btnJournal, false, false);
    this._clearJournalEntries();
    this.scene.resume('GameScene');
  }

  _clearJournalEntries() {
    for (const t of this._journalEntries) t.destroy();
    this._journalEntries = [];
  }

  _refreshJournalEntries() {
    this._clearJournalEntries();
    const now = this.time.now;
    const lineH   = 20; // height per text line (px)
    const entryGap = 8; // extra spacing between entries
    let currentY = UI_HEIGHT + 68;

    if (this.alertHistory.length === 0) {
      const t = this.add.text(GAME_WIDTH / 2, currentY + 20, 'No events yet.', {
        fontSize: '15px', fontFamily: 'monospace', fill: '#555555',
      }).setOrigin(0.5, 0).setDepth(202);
      this._journalEntries.push(t);
      return;
    }

    for (let i = 0; i < this.alertHistory.length; i++) {
      if (currentY >= GAME_HEIGHT - 20) break;
      const e = this.alertHistory[i];
      const elapsed = Math.floor((now - e.time) / 1000);
      const timeStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
      const text = `[${timeStr}]  ${e.text}`;
      const t = this.add.text(40, currentY, text, {
        fontSize: '15px', fontFamily: 'monospace', fill: i === 0 ? '#ffffff' : '#888888',
      }).setDepth(202);
      this._journalEntries.push(t);
      const linesCount = e.text.split('\n').length;
      currentY += linesCount * lineH + entryGap;
    }
  }

  _drawOkBtn(hovered) {
    const W = GAME_WIDTH, H = 100;
    this._okBg.clear();
    this._okBg.fillStyle(hovered ? 0x666666 : 0x444444, 1);
    this._okBg.fillRoundedRect(W - 120, H / 2 - 17, 100, 34, 4);
  }

  showAlert(text, warning = false) {
    if (this.overlayOpen) return;
    this.alertHistory.unshift({ text, time: this.time.now });
    this.alertLabel.setText(text);
    this.alertPopup.setVisible(true);
    this.overlayOpen = true;
    this.scene.pause("GameScene");
    if (warning) this.sfxWarning.play();
    else         this.sfxNotification.play();
    this.tweens.killTweensOf([this._okBg, this._okTxt]);
    this._okBg.setAlpha(1);
    this._okTxt.setAlpha(1);
    this._alertGradient.setVisible(true);
    this.tweens.add({ targets: [this._okBg, this._okTxt], alpha: 0.15, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── Game Over popup ──────────────────────────────────────────────────────────

  _buildGameOverPopup() {
    const W = 500,
      H = 220;
    const px = (GAME_WIDTH - W) / 2;
    const py = (GAME_HEIGHT - H) / 2;

    this.gameOverPopup = this.add
      .container(px, py)
      .setVisible(false)
      .setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d0d, 0.98);
    bg.fillRoundedRect(0, 0, W, H, 8);
    bg.lineStyle(2, 0xff4444, 1);
    bg.strokeRoundedRect(0, 0, W, H, 8);

    this.gameOverLabel = this.add
      .text(W / 2, 70, "", {
        fontSize: "19px",
        fill: "#ff5555",
        fontFamily: "monospace",
        align: "center",
        wordWrap: { width: W - 40 },
      })
      .setOrigin(0.5);

    const replayBg = this.add.graphics();
    replayBg.fillStyle(0x2d6e2d, 1);
    replayBg.fillRoundedRect(W / 2 - 80, H - 60, 160, 38, 4);
    replayBg.lineStyle(1, 0x55cc55, 1);
    replayBg.strokeRoundedRect(W / 2 - 80, H - 60, 160, 38, 4);

    const replayTxt = this.add
      .text(W / 2, H - 41, "REPLAY", {
        fontSize: "15px",
        fontStyle: "bold",
        fill: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const replayZone = this.add
      .zone(W / 2 - 80, H - 60, 160, 38)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    replayZone.on("pointerdown", () => {
      this.sfxButton.play();
      this.gameOver = false;
      this.overlayOpen = false;
      this.alertLandTriggered = false;
      this.alertWaterTriggered = false;
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
      this.scene.start("UIScene");
    });

    this.gameOverPopup.add([
      bg,
      this.gameOverLabel,
      replayBg,
      replayTxt,
      replayZone,
    ]);
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update() {
    this._updateBars();
    this._refreshButtons();

    if (this.gameOver) return;

    // Game Over
    const gameScene = this.scene.get("GameScene");
    const noWaterTiles = gameScene && gameScene.waterCrisisTriggered;
    if (GameState.land_health === 0 || noWaterTiles) {
      this.gameOver = true;
      this.overlayOpen = true;
      if (gameScene) {
        // Fadeout via UIScene tweens (GameScene sera pausé, ses tweens s'arrêteraient)
        const snds = [gameScene.sndWind, gameScene.sndRain, gameScene.sndMusic]
          .filter(s => s && s.isPlaying);
        for (const s of snds) {
          this.tweens.add({ targets: s, volume: 0, duration: 2000, onComplete: () => s.stop() });
        }
        if (gameScene._musicLoopTimer) {
          gameScene._musicLoopTimer.remove();
          gameScene._musicLoopTimer = null;
        }
      }
      this.gameOverLabel.setText(
        GameState.land_health === 0
          ? "Game Over!\nThe land health has collapsed."
          : "Game Over!\nThe region is experiencing\na water crisis.",
      );
      this.sfxWarning.play();
      this.gameOverPopup.setVisible(true);
      this.scene.pause("GameScene");
      return;
    }

    // Unlock buttons
    if (!this.farmUnlocked && GameState.shelterBuilt) {
      this.farmUnlocked = true;
      this._setBtnVisible(this._btnFarm, true);
    }

    // Alerts
    if (!this.overlayOpen) {
      if (GameState.land_health < 20 && !this.alertLandTriggered) {
        this.alertLandTriggered = true;
        this.showAlert("Alert! Land health is critical (< 20%).", true);
      } else if (GameState.water < 20 && !this.alertWaterTriggered) {
        this.alertWaterTriggered = true;
        if (!this.reforestUnlocked) {
          this.reforestUnlocked = true;
          this._setBtnVisible(this._btnReforest, true);
        }
        this.showAlert("Alert! Water level is critical (< 20%). Try planting trees.", true);
      } else if (GameState.water < 10 && !this.alertWaterCriticalTriggered &&
                 this.time.now - this.alertWaterCriticalLastTime > 300000) {
        this.alertWaterCriticalTriggered = true;
        this.alertWaterCriticalLastTime = this.time.now;
        this.showAlert("Warning: your community is facing a serious ecological crisis.\nIt is urgent to regenerate the forest and preserve water resources.", true);
      }
    }

    if (GameState.land_health >= 20) this.alertLandTriggered = false;
    if (GameState.water >= 20) this.alertWaterTriggered = false;
    if (GameState.water >= 10) this.alertWaterCriticalTriggered = false;
  }

  _updateBars() {
    for (const item of this._barFills) {
      const value = GameState[item.def.key];
      item.fill.clear();
      // Color shifts red when low
      const color =
        value < 20
          ? 0xff3333
          : value < 40
            ? Phaser.Display.Color.GetColor(
                Math.round(
                  Phaser.Math.Linear(
                    255,
                    (item.def.color >> 16) & 0xff,
                    (value - 20) / 20,
                  ),
                ),
                Math.round(
                  Phaser.Math.Linear(
                    51,
                    (item.def.color >> 8) & 0xff,
                    (value - 20) / 20,
                  ),
                ),
                Math.round(
                  Phaser.Math.Linear(
                    51,
                    item.def.color & 0xff,
                    (value - 20) / 20,
                  ),
                ),
              )
            : item.def.color;
      item.fill.fillStyle(color, 1);
      item.fill.fillRoundedRect(
        item.def.x,
        26,
        Math.max(0, (160 * value) / 100),
        14,
        3,
      );
      item.valText.setText(String(Math.round(value)));
    }
  }
}
