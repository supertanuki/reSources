class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
  }

  preload() {
    this.load.audio('sfx-button',       'sfx/sfx-button.mp3');
    this.load.audio('sfx-notification', 'sfx/sfx-notification.mp3');
    this.load.audio('sfx-warning',      'sfx/sfx-warning.mp3');
    this.load.audio('sfx-congrats',     'sfx/sfx-congrats.mp3');
    this.load.bitmapFont('pixel', 'font/FreePixel-16.png', 'font/FreePixel-16.xml?v1');
  }

  create() {
    this.sfxButton       = this.sound.add('sfx-button');
    this.sfxNotification = this.sound.add('sfx-notification');
    this.sfxWarning      = this.sound.add('sfx-warning');
    this.sfxCongrats     = this.sound.add('sfx-congrats');
    this.alertLandTriggered = false;
    this.alertReforestTriggered = false;
    this.alertWaterTriggered = false;
    this.alertAllFullTriggered = false;
    this.alertWaterCriticalTriggered = false;
    this.alertWaterCriticalLastTime = -Infinity;
    this.gameOver = false;
    this.overlayOpen = false;
    this.alertHistory = GameState.alertHistory; // shared reference, persists across restarts
    this.journalOpen = false;
    this._journalEntries = [];
    this._journalTimer = null;
    this.musicEnabled   = window._musicEnabled   !== false;
    this.sfxEnabled     = window._sfxEnabled     !== false;
    this.alertsEnabled  = window._alertsEnabled  !== false;

    this._buildHUD();
    this._buildAlertPopup();
    this._buildJournalOverlay();
    this._buildSettingsOverlay();
    this._buildGameOverPopup();
    this._applyAudioSettings();
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
      .bitmapText(24, H / 2, "pixel", "reSources", 32).setTint(0xcccccc)
      .setOrigin(0, 0.5);

    // Resource bars: [label, stateKey, x, color]
    const barDefs = [
      { label: t('hud_land'),      key: "land_health", x: 210, color: 0x55cc55 },
      { label: t('hud_water'),     key: "water",       x: 420, color: 0x4499ff },
      { label: t('hud_community'), key: "community",   x: 630, color: 0xffaa33 },
    ];

    this._barFills = [];

    for (const def of barDefs) {
      this.add.bitmapText(def.x, 14, "pixel", def.label, 16).setTint(0xaaaaaa);

      // Track bg
      const trackBg = this.add.graphics();
      trackBg.fillStyle(0x2a2a2a, 1);
      trackBg.fillRoundedRect(def.x, 32, 160, 14, 3);

      // Fill (dynamic)
      const fill = this.add.graphics();
      this._barFills.push({ fill, def });

      // Value text
      const valText = this.add.bitmapText(def.x + 164, 39, "pixel", "100", 16).setTint(0x888888).setOrigin(0, 0.5);
      this._barFills[this._barFills.length - 1].valText = valText;
    }

    // Buttons
    this._btnBuild    = this._makeButton(890,  12, 140, t('btn_build'),   () => this._setAction(GameState.ACTION_BUILD));
    this._btnFarm     = this._makeButton(1045, 12, 140, t('btn_farm'),    () => this._setAction(GameState.ACTION_FARM),    false);
    this._btnReforest = this._makeButton(1200, 12, 140, t('btn_plant'),   () => this._setAction(GameState.ACTION_REFOREST), false);
    this._btnBasin    = this._makeButton(1355, 12, 150, t('btn_basin'),   () => this._setAction(GameState.ACTION_BASIN), false);
    this._btnJournal  = this._makeButton(1520, 12, 112, t('btn_journal'), () => this._openJournal(),  true, true);
    this._btnSettings = this._makeButton(1630, 12, 112, t('btn_settings'),() => this._openSettings(), true, true);

    // Alert count badge — placed right of "JOURNAL" text, vertically aligned
    const _jTxt = this._btnJournal.txt;
    const _badgeR = 10;
    const _badgeX = _jTxt.x + _jTxt.width / 2 + 2 + _badgeR + 5;
    const _badgeY = _jTxt.y;
    this._journalBadgeX   = _badgeX;
    this._journalBadgeY   = _badgeY;
    this._journalBadgeR   = _badgeR;
    this._journalBadgeBg  = this.add.graphics().setDepth(10);
    this._journalBadgeTxt = this.add.bitmapText(_badgeX, _badgeY, 'pixel', '0', 16).setTint(0x000000).setOrigin(0.5).setDepth(11);
    this._updateJournalBadge();
    this._btnPicture  = this._makeButton(1753, 12, 130, t('btn_picture'), () => this._takePicture(),  true, true);

    this.farmUnlocked     = GameState.uiFarmUnlocked;
    this.reforestUnlocked = GameState.uiReforestUnlocked;
    this.basinUnlocked    = GameState.uiBasinUnlocked;
    if (this.farmUnlocked)     this._setBtnVisible(this._btnFarm,     true);
    if (this.reforestUnlocked) this._setBtnVisible(this._btnReforest, true);
    if (this.basinUnlocked)    this._setBtnVisible(this._btnBasin,    true);

    this._refreshButtons();
  }

  _makeButton(x, y, w, label, cb, initialVisible = true, textOnly = false) {
    const h = 46;
    const bg = this.add.graphics().setVisible(textOnly ? false : initialVisible);
    const txt = this.add
      .bitmapText(x + w / 2, y + h / 2, "pixel", label, 16)
      .setTint(textOnly ? 0xaaaaaa : 0xffffff)
      .setOrigin(0.5)
      .setVisible(initialVisible);

    const zone = this.add.zone(x, y, w, h).setOrigin(0);
    if (initialVisible) zone.setInteractive({ useHandCursor: true });
    const btn = { bg, txt, zone, x, y, w, h, disabled: false, active: false, hovered: false, textOnly };
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
    if (btn.textOnly) {
      if (disabled) {
        btn.txt.setTint(0x555555);
      } else if (btn.hovered) {
        btn.txt.setTint(0xffffff);
      } else {
        btn.txt.setTint(0xaaaaaa);
      }
      btn.zone.setInteractive({ useHandCursor: true });
      return;
    }
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
    const wu = t('wood_unit');
    this._btnBuild.txt.setText(`${t('btn_build')}\n${GameState.wood}/${GameState.BUILDING_WOOD_COST} ${wu}`);
    this._drawButton(this._btnBuild, GameState.current_action === GameState.ACTION_BUILD, !canBuild);
    if (this.farmUnlocked) {
      this._btnFarm.txt.setText(`${t('btn_farm')}\n${GameState.wood}/1 ${wu}`);
      this._drawButton(this._btnFarm, GameState.current_action === GameState.ACTION_FARM, !canFarm);
    }
    if (this.reforestUnlocked) {
      this._btnReforest.txt.setText(`${t('btn_plant')}\n${GameState.wood}/1 ${wu}`);
      this._drawButton(this._btnReforest, GameState.current_action === GameState.ACTION_REFOREST, !canReforest);
    }
    if (this.basinUnlocked) {
      const canBasin = GameState.wood >= GameState.BASIN_WOOD_COST;
      this._btnBasin.txt.setText(`${t('btn_basin')}\n${GameState.wood}/${GameState.BASIN_WOOD_COST} ${wu}`);
      this._drawButton(this._btnBasin, GameState.current_action === GameState.ACTION_BASIN, !canBasin);
    }
  }

  // ── Alert banner (full-width, bottom of screen) ──────────────────────────────

  _buildAlertPopup() {
    const W = GAME_WIDTH;
    const H = 220;
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
      .bitmapText(W / 2, H / 2 - 12, "pixel", "", 32).setTint(0xffcc44).setMaxWidth(W - 200)
      .setOrigin(0.5, 0.5);
    this.alertLabel.align = 1;

    this._okBg = this.add.graphics();
    this._drawOkBtn(false);

    this._okTxt = this.add
      .bitmapText(W - 110, H / 2, "pixel", t('ok'), 32)
      .setOrigin(0.5);

    const okZone = this.add
      .zone(W - 190, H / 2 - 50, 160, 100)
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

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.alertPopup.visible) {
        this.sfxButton.play();
        this.tweens.killTweensOf([this._okBg, this._okTxt]);
        this._okBg.setAlpha(1);
        this._okTxt.setAlpha(1);
        this._alertGradient.setVisible(false);
        this.alertPopup.setVisible(false);
        this.overlayOpen = false;
        this.scene.resume("GameScene");
      }
    });
  }

  // ── Journal ──────────────────────────────────────────────────────────────────

  _buildJournalOverlay() {
    const W = GAME_WIDTH, headerH = 60, sepY = UI_HEIGHT + headerH;
    const statsPanelX = W - 360;

    this._journalBg = this.add.graphics().setDepth(200).setVisible(false);
    this._journalBg.fillStyle(0x000000, 0.88);
    this._journalBg.fillRect(0, UI_HEIGHT, W, GAME_HEIGHT - UI_HEIGHT);
    this._journalBg.lineStyle(1, 0x333333, 1);
    this._journalBg.lineBetween(0, sepY, W, sepY);

    this._journalTitle = this.add.bitmapText(W / 2, UI_HEIGHT + headerH / 2, 'pixel', t('journal_title'), 32).setTint(0xffcc44).setOrigin(0.5).setDepth(201).setVisible(false);

    // Close button
    this._journalCloseBg = this.add.graphics().setDepth(201).setVisible(false);
    this._journalCloseTxt = this.add.bitmapText(W - 80, UI_HEIGHT + headerH / 2, 'pixel', t('journal_close'), 16).setOrigin(0.5).setDepth(202).setVisible(false);
    this._drawJournalCloseBtn(false);

    const closeZone = this.add.zone(W - 140, UI_HEIGHT + 10, 120, 40)
      .setOrigin(0).setDepth(202).setInteractive({ useHandCursor: true }).setVisible(false);
    this._journalCloseZone = closeZone;
    closeZone.on('pointerover',  () => this._drawJournalCloseBtn(true));
    closeZone.on('pointerout',   () => this._drawJournalCloseBtn(false));
    closeZone.on('pointerdown',  () => this._closeJournal());

    // Scrollable container for entries (masked to left of stats panel)
    this._journalContentY = UI_HEIGHT + 68;
    this._journalScrollY  = 0;
    this._journalContentH = 0;
    this._journalContainer = this.add.container(0, this._journalContentY).setDepth(202).setVisible(false);
    const maskShape = this.add.graphics();
    maskShape.fillRect(0, this._journalContentY, statsPanelX - 20, GAME_HEIGHT - this._journalContentY);
    this._journalContainer.setMask(maskShape.createGeometryMask());

    // Stats panel separator + content
    this._journalStatsSep = this.add.graphics().setDepth(201).setVisible(false);
    this._journalStatsSep.lineStyle(1, 0x444444, 1);
    this._journalStatsSep.lineBetween(statsPanelX - 20, UI_HEIGHT + headerH, statsPanelX - 20, GAME_HEIGHT);

    const statsStartY = UI_HEIGHT + headerH + 40;
    const lineH = 48;
    const labelX = statsPanelX;
    const stats = [
      t('stats_trees'),
      t('stats_trees_cut'),
      t('stats_trees_planted'),
      t('stats_population'),
      t('stats_deaths'),
      t('stats_houses'),
      t('stats_gardens'),
      t('stats_harvests'),
      t('stats_lost_harvests'),
    ];
    this._journalStatsLabels = [];
    this._journalStatsValues = [];
    for (let i = 0; i < stats.length; i++) {
      const y = statsStartY + i * lineH;
      const lbl = this.add.bitmapText(labelX, y, 'pixel', stats[i], 32).setTint(0xaaaaaa).setDepth(202).setVisible(false);
      const val = this.add.bitmapText(W - 24, y, 'pixel', '0', 32).setTint(0xffffff).setOrigin(1, 0).setDepth(202).setVisible(false);
      this._journalStatsLabels.push(lbl);
      this._journalStatsValues.push(val);
    }
  }

  _refreshJournalStats() {
    const gs = this.scene.get('GameScene');
    if (!gs) return;
    let currentTrees = 0;
    for (let y = 0; y < GameState.MAP_HEIGHT; y++)
      for (let x = 0; x < GameState.MAP_WIDTH; x++)
        if (GameState.tiles[y][x].biome === GameState.TILE_FOREST) currentTrees++;
    const values = [
      currentTrees,
      gs.treesCut,
      gs.treesPlanted,
      gs.persons.length,
      gs.totalDeaths,
      gs.buildingCells.length,
      gs.gardens.length,
      gs.totalHarvests,
      gs.lostHarvests,
    ];
    values.forEach((v, i) => this._journalStatsValues[i].setText(String(v)));
  }

  _drawJournalCloseBtn(hovered) {
    const W = GAME_WIDTH, headerH = 60;
    this._journalCloseBg.clear();
    this._journalCloseBg.fillStyle(hovered ? 0x666666 : 0x333333, 1);
    this._journalCloseBg.fillRoundedRect(W - 140, UI_HEIGHT + 10, 120, 40, 4);
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
    this._journalContainer.setVisible(true);
    this._journalStatsSep.setVisible(true);
    this._journalStatsLabels.forEach(l => l.setVisible(true));
    this._journalStatsValues.forEach(v => v.setVisible(true));
    this._refreshJournalStats();
    this._drawButton(this._btnJournal, false, true);
    this.scene.pause('GameScene');
    this._refreshJournalEntries();
    this._journalWheelHandler = (_pointer, _gameObjects, _deltaX, deltaY) => {
      const visH = GAME_HEIGHT - this._journalContentY;
      const maxScroll = Math.max(0, this._journalContentH - visH);
      this._journalScrollY = Phaser.Math.Clamp(this._journalScrollY + deltaY * 0.5, 0, maxScroll);
      this._journalContainer.y = this._journalContentY - this._journalScrollY;
    };
    this.input.on('wheel', this._journalWheelHandler);
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
    this._journalContainer.setVisible(false);
    this._journalStatsSep.setVisible(false);
    this._journalStatsLabels.forEach(l => l.setVisible(false));
    this._journalStatsValues.forEach(v => v.setVisible(false));
    this.input.off('wheel', this._journalWheelHandler);
    this._drawButton(this._btnJournal, false, false);
    this._clearJournalEntries();
    this.scene.resume('GameScene');
  }

  _clearJournalEntries() {
    this._journalContainer.removeAll(true);
    this._journalEntries = [];
  }

  _refreshJournalEntries() {
    this._clearJournalEntries();
    this._journalScrollY = 0;
    this._journalContainer.y = this._journalContentY;
    const now = this.time.now;
    const lineH    = 40;
    const entryGap = 16;
    let currentY = 20;

    if (this.alertHistory.length === 0) {
      const emptyTxt = this.add.bitmapText(GAME_WIDTH / 2, currentY, 'pixel', t('journal_empty'), 32).setTint(0x555555).setOrigin(0.5, 0);
      this._journalContainer.add(emptyTxt);
      this._journalEntries.push(emptyTxt);
      this._journalContentH = currentY + lineH;
      return;
    }

    for (let i = 0; i < this.alertHistory.length; i++) {
      const e = this.alertHistory[i];
      const elapsed = Math.floor((now - e.time) / 1000);
      const timeStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
      const text = `[${timeStr}]  ${e.text}`;
      const entry = this.add.bitmapText(40, currentY, 'pixel', text, 32)
        .setTint(i === 0 ? 0xffffff : 0x888888);
      this._journalContainer.add(entry);
      this._journalEntries.push(entry);
      const linesCount = e.text.split('\n').length;
      currentY += linesCount * lineH + entryGap;
    }
    this._journalContentH = currentY;
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  _buildSettingsOverlay() {
    const PW = 460, PH = 345;
    const px = (GAME_WIDTH - PW) / 2, py = (GAME_HEIGHT - PH) / 2;

    this._settingsPanel = this.add.container(px, py).setVisible(false).setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d0d, 0.97);
    bg.fillRoundedRect(0, 0, PW, PH, 8);
    bg.lineStyle(1, 0x444444, 1);
    bg.strokeRoundedRect(0, 0, PW, PH, 8);

    const title = this.add.bitmapText(PW / 2, 28, 'pixel', t('settings_title'), 32).setTint(0xcccccc).setOrigin(0.5);

    this._settingsBtnMusic  = this._makeSettingsToggle(PW, 75,  t('settings_music'),  () => this._toggleMusic());
    this._settingsBtnSfx    = this._makeSettingsToggle(PW, 130, t('settings_sfx'),    () => this._toggleSfx());
    this._settingsBtnAlerts = this._makeSettingsToggle(PW, 185, t('settings_alerts'), () => this._toggleAlerts());

    // Language toggle row
    const langLbl = this.add.bitmapText(40, 240, 'pixel', t('settings_lang'), 32).setTint(0xaaaaaa).setOrigin(0, 0.5);
    this._settingsLangBg = this.add.graphics();
    this._settingsLangTxt = this.add.bitmapText(PW - 100, 240, 'pixel', t('settings_lang_toggle'), 16).setOrigin(0.5);
    this._drawSettingsLangBtn(false);
    const langZone = this.add.zone(PW - 140, 222, 80, 36)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    langZone.on('pointerover',  () => this._drawSettingsLangBtn(true));
    langZone.on('pointerout',   () => this._drawSettingsLangBtn(false));
    langZone.on('pointerdown',  () => {
      this.sfxButton.play();
      window._gameLang = window._gameLang === 'fr' ? 'en' : 'fr';
      this._closeSettings();
      this.scene.restart();
    });

    // Close button (grey with hover)
    this._settingsCloseBg = this.add.graphics();
    this._drawSettingsCloseBtn(false);
    const closeTxt = this.add.bitmapText(PW / 2, PH - 37, 'pixel', t('settings_close'), 16).setOrigin(0.5);
    const closeZone = this.add.zone(PW / 2 - 60, PH - 55, 120, 36)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    closeZone.on('pointerover',  () => this._drawSettingsCloseBtn(true));
    closeZone.on('pointerout',   () => this._drawSettingsCloseBtn(false));
    closeZone.on('pointerdown',  () => { this.sfxButton.play(); this._closeSettings(); });

    this._settingsPanel.add([bg, title,
      ...this._settingsBtnMusic.objects,
      ...this._settingsBtnSfx.objects,
      ...this._settingsBtnAlerts.objects,
      langLbl, this._settingsLangBg, this._settingsLangTxt, langZone,
      this._settingsCloseBg, closeTxt, closeZone,
    ]);
  }

  _drawSettingsCloseBtn(hovered) {
    const PW = 460, PH = 345;
    this._settingsCloseBg.clear();
    this._settingsCloseBg.fillStyle(hovered ? 0x666666 : 0x333333, 1);
    this._settingsCloseBg.fillRoundedRect(PW / 2 - 60, PH - 55, 120, 36, 4);
  }

  _drawSettingsLangBtn(hovered) {
    const PW = 460;
    this._settingsLangBg.clear();
    this._settingsLangBg.fillStyle(hovered ? 0x555555 : 0x2a2a2a, 1);
    this._settingsLangBg.fillRoundedRect(PW - 140, 222, 80, 36, 4);
    this._settingsLangBg.lineStyle(1, hovered ? 0x888888 : 0x555555, 1);
    this._settingsLangBg.strokeRoundedRect(PW - 140, 222, 80, 36, 4);
  }

  _makeSettingsToggle(PW, y, label, onToggle) {
    const lbl = this.add.bitmapText(40, y, 'pixel', label, 32).setTint(0xaaaaaa).setOrigin(0, 0.5);

    const btnBg = this.add.graphics();
    const btnTxt = this.add.bitmapText(PW - 100, y, 'pixel', '', 16).setOrigin(0.5);
    const zone = this.add.zone(PW - 140, y - 18, 80, 36)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onToggle);

    return { objects: [lbl, btnBg, btnTxt, zone], bg: btnBg, txt: btnTxt, y, PW };
  }

  _drawSettingsToggle(toggle, enabled) {
    const { bg, txt, y, PW } = toggle;
    bg.clear();
    bg.fillStyle(enabled ? 0x2d6e2d : 0x6e2d2d, 1);
    bg.fillRoundedRect(PW - 140, y - 18, 80, 36, 4);
    txt.setText(enabled ? t('settings_on') : t('settings_off'));
  }

  _openSettings() {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    this._drawButton(this._btnSettings, false, true);
    this._drawSettingsToggle(this._settingsBtnMusic,  this.musicEnabled);
    this._drawSettingsToggle(this._settingsBtnSfx,    this.sfxEnabled);
    this._drawSettingsToggle(this._settingsBtnAlerts, this.alertsEnabled);
    this._settingsPanel.setVisible(true);
    this.scene.pause('GameScene');
  }

  _closeSettings() {
    this.overlayOpen = false;
    this._drawButton(this._btnSettings, false, false);
    this._settingsPanel.setVisible(false);
    this.scene.resume('GameScene');
  }

  _toggleMusic() {
    this.sfxButton.play();
    this.musicEnabled = !this.musicEnabled;
    window._musicEnabled = this.musicEnabled;
    this._drawSettingsToggle(this._settingsBtnMusic, this.musicEnabled);
    this._applyAudioSettings();
  }

  _toggleSfx() {
    this.sfxButton.play();
    this.sfxEnabled = !this.sfxEnabled;
    window._sfxEnabled = this.sfxEnabled;
    this._drawSettingsToggle(this._settingsBtnSfx, this.sfxEnabled);
    this._applyAudioSettings();
  }

  _toggleAlerts() {
    this.sfxButton.play();
    this.alertsEnabled = !this.alertsEnabled;
    window._alertsEnabled = this.alertsEnabled;
    this._drawSettingsToggle(this._settingsBtnAlerts, this.alertsEnabled);
    if (this._goAlertsBg) this._drawGameOverAlertsToggle();
  }

  _updateJournalBadge() {
    const count = this.alertHistory.length;
    this._journalBadgeBg.clear();
    this._journalBadgeBg.fillStyle(0xffffff, 1);
    this._journalBadgeBg.fillCircle(this._journalBadgeX, this._journalBadgeY, this._journalBadgeR);
    this._journalBadgeTxt.setText(String(count));
  }

  _blinkJournalBadge() {
    if (this._badgeBlinkTween) {
      this._badgeBlinkTween.stop();
      this._badgeBlinkTween = null;
    }
    this._journalBadgeBg.setAlpha(1);
    this._journalBadgeTxt.setAlpha(1);
    this._badgeBlinkTween = this.tweens.add({
      targets: [this._journalBadgeBg, this._journalBadgeTxt],
      alpha: 0,
      duration: 250,
      yoyo: true,
      repeat: -1,
    });
    this.time.delayedCall(3000, () => {
      if (this._badgeBlinkTween) {
        this._badgeBlinkTween.stop();
        this._badgeBlinkTween = null;
        this._journalBadgeBg.setAlpha(1);
        this._journalBadgeTxt.setAlpha(1);
      }
    });
  }

  _applyAudioSettings() {
    const gs = this.scene.get('GameScene');
    if (gs) {
      for (const s of [gs.sndWind, gs.sndRain, gs.sndMusic, gs.sndMusicDesert]) {
        if (s) s.setMute(!this.musicEnabled);
      }
      for (const s of [gs.sndBuild, gs.sndCuttingTree, gs.sndPlaceTile, gs.sndHarvest, gs.sndThunder]) {
        if (s) s.setMute(!this.sfxEnabled);
      }
    }
    for (const s of [this.sfxButton, this.sfxNotification, this.sfxWarning]) {
      if (s) s.setMute(!this.sfxEnabled);
    }
  }

  // ── Picture export ───────────────────────────────────────────────────────────

  _setPictureMode(on) {
    if (on) {
      this._setPictureHideOverlays();
      // Remember which buttons were actually visible
      const btns = [this._btnBuild, this._btnFarm, this._btnReforest, this._btnBasin, this._btnJournal, this._btnSettings, this._btnPicture];
      this._pictureHiddenBtns = btns.filter(btn => btn.txt.visible);
      for (const btn of this._pictureHiddenBtns) {
        if (!btn.textOnly) btn.bg.setVisible(false);
        btn.txt.setVisible(false);
      }
      this._journalBadgeBg.setVisible(false);
      this._journalBadgeTxt.setVisible(false);
    } else {
      for (const btn of (this._pictureHiddenBtns || [])) {
        if (!btn.textOnly) btn.bg.setVisible(true);
        btn.txt.setVisible(true);
      }
      this._pictureHiddenBtns = [];
      this._journalBadgeBg.setVisible(true);
      this._journalBadgeTxt.setVisible(true);
    }
  }

  _takePicture() {
    this._setPictureMode(true);
    this.time.delayedCall(50, () => {
      this.game.renderer.snapshot((image) => {
        const link = document.createElement('a');
        link.download = 'reSources.png';
        link.href = image.src;
        link.click();
        this._setPictureMode(false);
        // Re-show any overlay that was hidden
        if (this._journalWasOpen) {
          this._journalBg.setVisible(true);
          this._journalTitle.setVisible(true);
          this._journalCloseBg.setVisible(true);
          this._journalCloseTxt.setVisible(true);
          this._journalCloseZone.setVisible(true);
          this._journalContainer.setVisible(true);
          this._journalWasOpen = false;
        }
        if (this._settingsWasOpen) {
          this._settingsPanel.setVisible(true);
          this._settingsWasOpen = false;
        }
        if (this._alertWasOpen) {
          this.alertPopup.setVisible(true);
          this._alertGradient.setVisible(true);
          this._alertWasOpen = false;
        }
        if (this._gameOverWasOpen) {
          this.gameOverPopup.setVisible(true);
          this._gameOverWasOpen = false;
        }
        this.showAlert(t('alert_picture_saved'));
      });
    });
  }

  _setPictureHideOverlays() {
    this._journalWasOpen = false;
    this._settingsWasOpen = false;
    this._alertWasOpen = false;
    this._gameOverWasOpen = false;
    if (this._journalBg.visible) {
      this._journalWasOpen = true;
      this._journalBg.setVisible(false);
      this._journalTitle.setVisible(false);
      this._journalCloseBg.setVisible(false);
      this._journalCloseTxt.setVisible(false);
      this._journalCloseZone.setVisible(false);
      this._journalContainer.setVisible(false);
    }
    if (this._settingsPanel.visible) {
      this._settingsWasOpen = true;
      this._settingsPanel.setVisible(false);
    }
    if (this.alertPopup.visible) {
      this._alertWasOpen = true;
      this.alertPopup.setVisible(false);
      this._alertGradient.setVisible(false);
    }
    if (this.gameOverPopup.visible) {
      this._gameOverWasOpen = true;
      this.gameOverPopup.setVisible(false);
    }
  }

  _drawOkBtn(hovered) {
    const W = GAME_WIDTH, H = 220;
    this._okBg.clear();
    this._okBg.fillStyle(hovered ? 0x666666 : 0x444444, 1);
    this._okBg.fillRoundedRect(W - 190, H / 2 - 50, 160, 100, 6);
  }

  showAlert(text, warning = false) {
    // Always record in journal/history
    if (this.alertHistory.length > 0 && this.alertHistory[0].text === text) {
      this.alertHistory[0].time = this.time.now;
    } else {
      this.alertHistory.unshift({ text, time: this.time.now });
      if (this._journalBadgeBg) {
        this._updateJournalBadge();
        this._blinkJournalBadge();
      }
    }
    // Skip popup display if alerts are disabled
    if (!this.alertsEnabled) return;
    if (this.overlayOpen) return;
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
    const W = 500, H = 320;
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
      .bitmapText(W / 2, 65, "pixel", "", 32).setTint(0xff5555).setMaxWidth(W - 40)
      .setOrigin(0.5);
    this.gameOverLabel.align = 1;

    // Alerts toggle: label centered, toggle button centered below
    const alertsLbl = this.add.bitmapText(W / 2, 148, 'pixel', t('settings_alerts'), 16).setTint(0xaaaaaa).setOrigin(0.5);
    this._goAlertsBg  = this.add.graphics();
    this._goAlertsTxt = this.add.bitmapText(W / 2, 186, 'pixel', '', 16).setOrigin(0.5);
    this._drawGameOverAlertsToggle();
    const alertsZone = this.add.zone(W / 2 - 50, 168, 100, 36)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    alertsZone.on('pointerdown', () => {
      this.alertsEnabled = !this.alertsEnabled;
      window._alertsEnabled = this.alertsEnabled;
      this._drawGameOverAlertsToggle();
      if (this._settingsBtnAlerts) this._drawSettingsToggle(this._settingsBtnAlerts, this.alertsEnabled);
    });

    // Replay button (32px text, with hover)
    this._replayBg = this.add.graphics();
    this._drawGameOverReplayBtn(false);

    const replayTxt = this.add
      .bitmapText(W / 2, 258, "pixel", t('replay'), 32)
      .setOrigin(0.5);

    const replayZone = this.add
      .zone(W / 2 - 90, 232, 180, 52)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    replayZone.on('pointerover',  () => this._drawGameOverReplayBtn(true));
    replayZone.on('pointerout',   () => this._drawGameOverReplayBtn(false));
    replayZone.on("pointerdown", () => {
      this.sfxButton.play();
      // Stop all sounds and music
      const gs = this.scene.get('GameScene');
      if (gs) {
        for (const s of [gs.sndWind, gs.sndRain, gs.sndMusic, gs.sndMusicDesert,
                         gs.sndBuild, gs.sndCuttingTree, gs.sndPlaceTile, gs.sndHarvest, gs.sndThunder]) {
          if (s) s.stop();
        }
      }
      this.sound.stopAll();
      this.gameOver = false;
      this.overlayOpen = false;
      this.alertLandTriggered = false;
      this.alertReforestTriggered = false;
      this.alertWaterTriggered = false;
      this.alertAllFullTriggered = false;
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
      this.scene.start("UIScene");
    });

    this.gameOverPopup.add([
      bg,
      this.gameOverLabel,
      alertsLbl, this._goAlertsBg, this._goAlertsTxt, alertsZone,
      this._replayBg, replayTxt, replayZone,
    ]);
  }

  _drawGameOverReplayBtn(hovered) {
    const W = 500;
    this._replayBg.clear();
    this._replayBg.fillStyle(hovered ? 0x3d8e3d : 0x2d6e2d, 1);
    this._replayBg.fillRoundedRect(W / 2 - 90, 232, 180, 52, 4);
    this._replayBg.lineStyle(1, hovered ? 0x88ff88 : 0x55cc55, 1);
    this._replayBg.strokeRoundedRect(W / 2 - 90, 232, 180, 52, 4);
  }

  _drawGameOverAlertsToggle() {
    const W = 500;
    this._goAlertsBg.clear();
    this._goAlertsBg.fillStyle(this.alertsEnabled ? 0x2d6e2d : 0x6e2d2d, 1);
    this._goAlertsBg.fillRoundedRect(W / 2 - 50, 168, 100, 36, 4);
    this._goAlertsTxt.setText(this.alertsEnabled ? t('settings_on') : t('settings_off'));
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update() {
    this._updateBars();
    this._refreshButtons();

    if (this.gameOver) return;

    // Game Over
    const gameScene = this.scene.get("GameScene");
    const noWaterTiles = gameScene && gameScene.waterCrisisTriggered;
    const communityCollapsed = GameState.shelterBuilt && GameState.community <= 0;
    if (GameState.land_health === 0 || noWaterTiles || communityCollapsed) {
      this.gameOver = true;
      this.overlayOpen = true;
      if (gameScene) {
        // Fadeout via UIScene tweens (GameScene sera pausé, ses tweens s'arrêteraient)
        const snds = [gameScene.sndWind, gameScene.sndRain, gameScene.sndMusic, gameScene.sndMusicDesert]
          .filter(s => s && s.isPlaying);
        for (const s of snds) {
          this.tweens.add({ targets: s, volume: 0, duration: 2000, onComplete: () => s.stop() });
        }
        if (gameScene._musicLoopTimer)  { gameScene._musicLoopTimer.remove();  gameScene._musicLoopTimer  = null; }
        if (gameScene._desertLoopTimer) { gameScene._desertLoopTimer.remove(); gameScene._desertLoopTimer = null; }
      }
      this.gameOverLabel.setText(
        GameState.land_health === 0
          ? t('game_over_land')
          : communityCollapsed
            ? t('game_over_community')
            : t('game_over_water'),
      );
      this.sfxWarning.play();
      this.gameOverPopup.setVisible(true);
      this.scene.pause("GameScene");
      return;
    }

    // Unlock buttons
    if (!this.farmUnlocked && GameState.shelterBuilt) {
      this.farmUnlocked = true;
      GameState.uiFarmUnlocked = true;
      this._setBtnVisible(this._btnFarm, true);
    }
    if (!this.basinUnlocked && GameState.water < 25) {
      this.basinUnlocked = true;
      GameState.uiBasinUnlocked = true;
      this._setBtnVisible(this._btnBasin, true);
      this.showAlert(t('alert_basin_unlock'), true);
    }

    // Alerts
    if (!this.overlayOpen) {
      if (GameState.land_health >= 100 && GameState.water >= 100 && GameState.community >= 100 && !this.alertAllFullTriggered) {
        this.alertAllFullTriggered = true;
        this.sfxCongrats.play();
        this.showAlert(t('alert_all_full'));
      } else if (GameState.land_health < 20 && !this.alertLandTriggered) {
        this.alertLandTriggered = true;
        this.showAlert(t('alert_land_critical'), true);
      } else if (GameState.water < 50 && !this.alertReforestTriggered) {
        this.alertReforestTriggered = true;
        if (!this.reforestUnlocked) {
          this.reforestUnlocked = true;
          GameState.uiReforestUnlocked = true;
          this._setBtnVisible(this._btnReforest, true);
        }
        this.showAlert(t('alert_water_reforest'), true);
      } else if (GameState.water < 20 && !this.alertWaterTriggered) {
        this.alertWaterTriggered = true;
        this.showAlert(t('alert_water_low'), true);
      } else if (GameState.water < 10 && !this.alertWaterCriticalTriggered &&
                 this.time.now - this.alertWaterCriticalLastTime > 300000) {
        this.alertWaterCriticalTriggered = true;
        this.alertWaterCriticalLastTime = this.time.now;
        this.showAlert(t('alert_water_crisis'), true);
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
      const fillW = Math.max(0, (160 * value) / 100);
      if (fillW > 0) {
        item.fill.fillStyle(color, 1);
        item.fill.fillRoundedRect(item.def.x, 32, fillW, 14, 3);
      }
      item.valText.setText(String(Math.round(value)));
    }
  }
}
