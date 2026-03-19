class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    this.alertLandTriggered = false;
    this.alertWaterTriggered = false;
    this.gameOver = false;
    this.overlayOpen = false;

    this._buildHUD();
    this._buildAlertPopup();
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

    // Wood counter
    this.woodText = this.add
      .text(745, H / 2, "Wood: 0 / 5", {
        fontSize: "14px",
        fill: "#ddbb55",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);

    // Buttons
    this._btnBuild = this._makeButton(910, 12, 120, "BUILD", () =>
      this._setAction(GameState.ACTION_BUILD),
    );
    this._btnReforest = this._makeButton(1045, 12, 130, "PLANT TREE", () =>
      this._setAction(GameState.ACTION_REFOREST),
    );
    this._btnFarm = this._makeButton(1190, 12, 100, "FARM", () =>
      this._setAction(GameState.ACTION_FARM),
    );

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
    zone.on("pointerdown", cb);

    return { bg, txt, zone, x, y, w, h, disabled: false, active: false };
  }

  _drawButton(btn, active, disabled) {
    btn.disabled = disabled;
    btn.active = active;
    btn.bg.clear();
    const color = disabled ? 0x2a2a2a : active ? 0x2d6e2d : 0x3a3a3a;
    const border = disabled ? 0x555555 : active ? 0x55cc55 : 0x888888;
    btn.bg.lineStyle(1, border, 1);
    btn.bg.fillStyle(color, 1);
    btn.bg.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);
    btn.bg.strokeRoundedRect(btn.x, btn.y, btn.w, btn.h, 4);
    btn.txt.setAlpha(disabled ? 0.5 : 1);
    if (disabled) btn.zone.removeInteractive();
    else btn.zone.setInteractive({ useHandCursor: true });
  }

  _setAction(action) {
    GameState.current_action = action;
    this._refreshButtons();
  }

  _refreshButtons() {
    const canBuild = GameState.wood >= GameState.BUILDING_WOOD_COST;
    const canReforest = GameState.wood >= 1;
    const canFarm = GameState.wood >= 1;
    this._drawButton(
      this._btnBuild,
      GameState.current_action === GameState.ACTION_BUILD,
      !canBuild,
    );
    this._drawButton(
      this._btnReforest,
      GameState.current_action === GameState.ACTION_REFOREST,
      !canReforest,
    );
    this._drawButton(
      this._btnFarm,
      GameState.current_action === GameState.ACTION_FARM,
      !canFarm,
    );
  }

  // ── Alert popup ─────────────────────────────────────────────────────────────

  _buildAlertPopup() {
    const W = 480,
      H = 210;
    const px = (GAME_WIDTH - W) / 2;
    const py = (GAME_HEIGHT - H) / 2;

    this.alertPopup = this.add
      .container(px, py)
      .setVisible(false)
      .setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x111111, 0.97);
    bg.fillRoundedRect(0, 0, W, H, 8);
    bg.lineStyle(2, 0xffaa00, 1);
    bg.strokeRoundedRect(0, 0, W, H, 8);

    this.alertLabel = this.add
      .text(W / 2, H / 2 - 28, "", {
        fontSize: "20px",
        fill: "#ffcc44",
        fontFamily: "monospace",
        align: "left",
        wordWrap: { width: W - 48 },
      })
      .setOrigin(0.5);

    const okBg = this.add.graphics();
    okBg.fillStyle(0x444444, 1);
    okBg.fillRoundedRect(W / 2 - 50, H - 52, 100, 34, 4);

    const okTxt = this.add
      .text(W / 2, H - 35, "OK", {
        fontSize: "15px",
        fill: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const okZone = this.add
      .zone(W / 2 - 50, H - 52, 100, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    okZone.on("pointerdown", () => {
      this.alertPopup.setVisible(false);
      this.overlayOpen = false;
      this.scene.resume("GameScene");
    });

    this.alertPopup.add([bg, this.alertLabel, okBg, okTxt, okZone]);
  }

  showAlert(text) {
    if (this.overlayOpen) return;
    this.alertLabel.setText(text);
    this.alertPopup.setVisible(true);
    this.overlayOpen = true;
    this.scene.pause("GameScene");
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
    this.woodText.setText(
      `Wood: ${GameState.wood} / ${GameState.BUILDING_WOOD_COST}`,
    );

    if (this.gameOver) return;

    // Game Over
    const gameScene = this.scene.get("GameScene");
    const noWaterTiles =
      gameScene && gameScene.waterCells && gameScene.waterCells.length === 0;
    if (GameState.land_health === 0 || noWaterTiles) {
      this.gameOver = true;
      this.overlayOpen = true;
      this.gameOverLabel.setText(
        GameState.land_health === 0
          ? "Game Over!\nThe land health has collapsed."
          : "Game Over!\nThe region is experiencing\na water crisis.",
      );
      this.gameOverPopup.setVisible(true);
      this.scene.pause("GameScene");
      return;
    }

    // Alerts
    if (!this.overlayOpen) {
      if (GameState.land_health < 20 && !this.alertLandTriggered) {
        this.alertLandTriggered = true;
        this.alertLabel.setText("Alert!\nLand health is critical (< 20%).");
        this.alertPopup.setVisible(true);
        this.overlayOpen = true;
        this.scene.pause("GameScene");
      } else if (GameState.water < 20 && !this.alertWaterTriggered) {
        this.alertWaterTriggered = true;
        this.alertLabel.setText(
          "Alert!\nWater level is critical (< 20%).\nTry planting trees.",
        );
        this.alertPopup.setVisible(true);
        this.overlayOpen = true;
        this.scene.pause("GameScene");
      }
    }

    if (GameState.land_health >= 20) this.alertLandTriggered = false;
    if (GameState.water >= 20) this.alertWaterTriggered = false;
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
      item.valText.setText(String(value));
    }
  }
}
