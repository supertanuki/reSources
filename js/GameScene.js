class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  preload() {
    this.load.spritesheet('tiles', 'art/tiles.png?v4', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    GameState.reset();

    this.waterCells      = [];
    this.buildingCells   = [];
    this.initialWaterCount = 0;
    this.waterDrainTimer = 0;
    this.waterRegenTimer = 0;
    this.persons         = [];
    this.mouseHeld       = false;
    this.lastPreviewCell = null;
    this.woodAlertShown        = false;
    this.treesCut              = 0;
    this.growingTrees          = [];
    this.gardens               = [];
    this.gardenReadyAlertShown   = false;
    this.gardenHarvestAlertShown = false;
    this.farmLimitAlertShown     = false;
    this.gardenBlinkTimer        = 0;
    this.gardenBlinkOn           = true;
    this.waterCrisisTimer        = 0;
    this.waterCrisisTriggered    = false;

    // Rain
    this.rain = { state: 'idle', phaseTimer: 0, duration: 0, nextTimer: 0, drops: [], started: false, lightningTimer: 0, lightningDelay: 0 };
    this.rainGraphics = this.add.graphics().setDepth(5);
    this.rainOverlay  = this.add.rectangle(
      0, UI_HEIGHT,
      GameState.MAP_WIDTH * 32, GameState.MAP_HEIGHT * 32,
      0x111833, 1
    ).setOrigin(0, 0).setDepth(4).setAlpha(0);
    this.lightningOverlay = this.add.rectangle(
      0, 0,
      GameState.MAP_WIDTH * 32, GameState.MAP_HEIGHT * 32 + UI_HEIGHT,
      0xeeeeff, 1
    ).setOrigin(0, 0).setDepth(6).setAlpha(0);

    // Tilemap
    this.map = this.make.tilemap({
      width: GameState.MAP_WIDTH, height: GameState.MAP_HEIGHT,
      tileWidth: 32, tileHeight: 32
    });
    // gid=1 so tile IDs match biome+1
    this.tileset = this.map.addTilesetImage('tiles', 'tiles', 32, 32, 0, 0, 1);

    this.biomeLayer   = this.map.createBlankLayer('biome',   this.tileset, 0, UI_HEIGHT);
    this.previewLayer = this.map.createBlankLayer('preview', this.tileset, 0, UI_HEIGHT);
    this.previewLayer.setAlpha(0.5);

    this._generateWorld();
    this._setupInput();

    this.scene.launch('UIScene');

    this.time.delayedCall(5000, () => {
      if (this.buildingCells.length > 0) return;
      const ui = this.scene.get('UIScene');
      if (ui) ui.showAlert(
        'To build a shelter, cut at least 5 trees.\n' +
        'You can click and hold to cut multiple trees at once.'
      );
    });
  }

  // ── World generation ────────────────────────────────────────────────────────

  _generateWorld() {
    const MIN_WATER = 20;

    do {
      this.waterCells = [];
      GameState.initTiles();

      const noise = new SimpleNoise(Math.random() * 0xffffff | 0);

      for (let y = 0; y < GameState.MAP_HEIGHT; y++) {
        for (let x = 0; x < GameState.MAP_WIDTH; x++) {
          const n = noise.octave(x, y, 3, 32.0, 0.6);
          const td = GameState.tiles[y][x];

          if      (n < -0.3) { td.biome = GameState.TILE_WATER; }
          else if (n <  0.0) { td.biome = GameState.TILE_FOREST; td.has_tree = true; }
          else               { td.biome = GameState.TILE_DESERT; }

          this.biomeLayer.putTileAt(GameState.toPhaserId(td.biome), x, y);

          if (td.biome === GameState.TILE_WATER) this.waterCells.push({ x, y });
        }
      }
    } while (this.waterCells.length < MIN_WATER);

    this.initialWaterCount = this.waterCells.length;
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  _setupInput() {
    this.input.on('pointerdown', (p) => {
      if (p.y < UI_HEIGHT) return;
      if (p.leftButtonDown()) {
        this.mouseHeld = true;
        this._handleClick(this._toCell(p.worldX, p.worldY));
      }
    });

    this.input.on('pointerup', () => { this.mouseHeld = false; });

    this.input.on('pointermove', (p) => {
      this._updatePreview(p.worldX, p.worldY, p.y < UI_HEIGHT);
      if (this.mouseHeld && p.leftButtonDown() && p.y >= UI_HEIGHT) {
        this._handleDrag(this._toCell(p.worldX, p.worldY));
      }
    });
  }

  _toCell(wx, wy) {
    return { x: Math.floor(wx / 32), y: Math.floor((wy - UI_HEIGHT) / 32) };
  }

  _valid(c) {
    return c.x >= 0 && c.y >= 0 && c.x < GameState.MAP_WIDTH && c.y < GameState.MAP_HEIGHT;
  }

  _updatePreview(wx, wy, inUI) {
    if (this.lastPreviewCell) {
      this.previewLayer.removeTileAt(this.lastPreviewCell.x, this.lastPreviewCell.y);
      this.lastPreviewCell = null;
    }
    if (inUI) { this.input.setDefaultCursor('default'); return; }

    const c = this._toCell(wx, wy);
    if (!this._valid(c)) return;

    const td  = GameState.tiles[c.y][c.x];
    const act = GameState.current_action;
    let preview = -1;

    if (td.biome === GameState.TILE_FOREST && td.has_tree && !td.building) {
      preview = GameState.toPhaserId(GameState.TILE_DESERT);
    } else if (act === GameState.ACTION_BUILD &&
               td.biome === GameState.TILE_DESERT && !td.building &&
               GameState.wood >= GameState.BUILDING_WOOD_COST) {
      if (!this._pendingBuild) this._pendingBuild = { gid: Math.random() < 0.5 ? 4 : 5, flipX: Math.random() < 0.5 };
      preview = this._pendingBuild.gid;
    } else if (act === GameState.ACTION_REFOREST &&
               td.biome === GameState.TILE_DESERT && !td.building &&
               GameState.wood >= 1) {
      preview = 6; // gid 6 = sapling stage 1
    } else if (act === GameState.ACTION_FARM &&
               td.biome === GameState.TILE_DESERT && !td.building &&
               this.gardens.length < this.persons.length &&
               GameState.wood >= 1) {
      preview = 11; // gid 11 = garden stage 1
    } else if (td.biome === GameState.TILE_FARM) {
      const g = this._getGarden(c.x, c.y);
      if (act === GameState.ACTION_BUILD) {
        preview = GameState.toPhaserId(GameState.TILE_DESERT);
      } else if (act === GameState.ACTION_FARM) {
        if (g && g.stage === 2)                        preview = 14;
        else if (g && (g.stage === 3 || g.stage === 4)) preview = 11;
      }
    }

    // Pointer cursor when hovering a harvestable garden (any mode) or any actionable tile
    const hoverHarvestable = td.biome === GameState.TILE_FARM && (() => {
      const g = this._getGarden(c.x, c.y);
      return g && g.stage === 2;
    })();
    this.input.setDefaultCursor(preview !== -1 || hoverHarvestable ? 'pointer' : 'default');

    if (preview !== -1) {
      const t = this.previewLayer.putTileAt(preview, c.x, c.y);
      if (this._pendingBuild && t) t.flipX = this._pendingBuild.flipX;
      this.lastPreviewCell = { x: c.x, y: c.y };
    }
  }

  _handleClick(c) {
    if (!this._valid(c)) return;
    const td  = GameState.tiles[c.y][c.x];
    const act = GameState.current_action;

    if (td.biome === GameState.TILE_FOREST && td.has_tree && !td.building) {
      this._harvestTree(c, td);
    } else if (act === GameState.ACTION_BUILD && td.biome === GameState.TILE_DESERT && !td.building) {
      this._tryBuild(c, td);
    } else if (act === GameState.ACTION_REFOREST && td.biome === GameState.TILE_DESERT && !td.building) {
      this._reforest(c, td);
    } else if (act === GameState.ACTION_FARM && td.biome === GameState.TILE_DESERT && !td.building) {
      this._placeFarm(c, td);
    } else if (td.biome === GameState.TILE_FARM) {
      const g = this._getGarden(c.x, c.y);
      if (g && g.stage === 2) {
        this._harvestGarden(c, g);
      } else if (act === GameState.ACTION_BUILD) {
        this._removeGarden(c, td, g);
      } else if (act === GameState.ACTION_FARM) {
        if (g && (g.stage === 3 || g.stage === 4)) this._replantGarden(c, g);
      }
    }
  }

  _handleDrag(c) {
    if (!this._valid(c)) return;
    const td = GameState.tiles[c.y][c.x];
    if (td.biome === GameState.TILE_FOREST && td.has_tree && !td.building) {
      this._harvestTree(c, td);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  _harvestTree(c, td) {
    td.has_tree = false;
    td.biome = GameState.TILE_DESERT;
    this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_DESERT), c.x, c.y);
    this.growingTrees = this.growingTrees.filter(t => !(t.x === c.x && t.y === c.y));
    GameState.addWood(1);
    GameState.changeLandHealth(-1);
    GameState.changeWater(-1);

    this.treesCut++;
    if (!this.rain.started && GameState.water < 50) this._startRain();

    if (!this.woodAlertShown && GameState.wood >= 5 && this.buildingCells.length === 0) {
      this.woodAlertShown = true;
      const ui = this.scene.get('UIScene');
      if (ui) ui.showAlert(
        'Now that you have 5 pieces of wood, you can build your shelter.\n' +
        'Click where you want to place your shelter.'
      );
    }
  }

  _reforest(c, td) {
    if (GameState.wood < 1) return;
    GameState.wood -= 1;
    td.biome = GameState.TILE_FOREST;
    td.has_tree = true;
    this.biomeLayer.putTileAt(6, c.x, c.y); // gid 6 = sapling stage 1
    this.growingTrees.push({ x: c.x, y: c.y, stage: 0, timer: 0 });
    GameState.changeLandHealth(1);
  }

  _placeFarm(c, td) {
    if (this.gardens.length >= this.persons.length) {
      if (!this.farmLimitAlertShown) {
        this.farmLimitAlertShown = true;
        const ui = this.scene.get('UIScene');
        if (ui) ui.showAlert('The number of farmland depends on your community size. Build more shelters to welcome more people.');
      }
      return;
    }
    this.farmLimitAlertShown = false;
    if (GameState.wood < 1) return;
    GameState.wood -= 1;
    GameState.changeWater(-2);
    td.biome = GameState.TILE_FARM;
    this.biomeLayer.putTileAt(11, c.x, c.y); // gid 11 = garden stage 1
    this.gardens.push({ x: c.x, y: c.y, stage: 0, timer: 0 });
    GameState.gardenPlaced = true;
  }

  _tryBuild(c, td) {
    if (GameState.wood < GameState.BUILDING_WOOD_COST) return;
    GameState.wood -= GameState.BUILDING_WOOD_COST;
    td.building = 'hut';
    td.biome = GameState.TILE_BUILDING;
    const pending = this._pendingBuild || { gid: Math.random() < 0.5 ? 4 : 5, flipX: Math.random() < 0.5 };
    const buildTile = this.biomeLayer.putTileAt(pending.gid, c.x, c.y);
    if (buildTile) buildTile.flipX = pending.flipX;
    this._pendingBuild = null;
    GameState.changeCommunity(2);
    GameState.changeWater(-1);
    const firstBuilding = this.buildingCells.length === 0;
    if (firstBuilding) GameState.shelterBuilt = true;
    this.woodAlertShown = true;
    this._registerBuilding(c);
    this._spawnPeople(c);

    if (firstBuilding) {
      const ui = this.scene.get('UIScene');
      if (ui) ui.showAlert(
        'Now that you have a shelter, you need to grow food so that your community can eat.\n' +
        'Click on the Farm button then place a farmland wherever you want.'
      );
    }
  }

  _registerBuilding(c) {
    if (!this.buildingCells.find(b => b.x === c.x && b.y === c.y))
      this.buildingCells.push({ x: c.x, y: c.y });
  }

  _spawnPeople(c) {
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
      if (this.persons.length >= this.buildingCells.length * 4) break;
      const pos = this._randomDesertNear(c);
      this.persons.push(new Person(this, pos.x, pos.y));
      GameState.changeWater(-1);
    }
  }

  _randomDesertNear(center) {
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = center.x + dx, cy = center.y + dy;
        if (cx < 0 || cy < 0 || cx >= GameState.MAP_WIDTH || cy >= GameState.MAP_HEIGHT) continue;
        if (GameState.tiles[cy][cx].biome === GameState.TILE_DESERT) candidates.push({ x: cx, y: cy });
      }
    }
    const t = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : center;
    return { x: t.x * 32 + 16, y: t.y * 32 + 16 + UI_HEIGHT };
  }

  // Called by Person
  getRandomBuildingPosition() {
    if (!this.buildingCells.length) return { x: 960, y: 512 + UI_HEIGHT };
    const c = this.buildingCells[Math.floor(Math.random() * this.buildingCells.length)];
    return { x: c.x * 32 + 16, y: c.y * 32 + 16 + UI_HEIGHT };
  }

  getRandomDestinationPosition() {
    const all = [
      ...this.buildingCells,
      ...this.gardens.map(g => ({ x: g.x, y: g.y })),
    ];
    if (!all.length) return this.getRandomBuildingPosition();
    const c = all[Math.floor(Math.random() * all.length)];
    return { x: c.x * 32 + 16, y: c.y * 32 + 16 + UI_HEIGHT };
  }

  isDesertWorldPosition(wx, wy) {
    const c = this._toCell(wx, wy);
    if (!this._valid(c)) return false;
    return GameState.tiles[c.y][c.x].biome === GameState.TILE_DESERT;
  }

  // ── Water drain ─────────────────────────────────────────────────────────────

  _desertTileAdjacentToWater() {
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    const candidates = [];

    for (const cell of this.waterCells) {
      for (const d of dirs) {
        const nx = cell.x + d.x, ny = cell.y + d.y;
        if (nx < 0 || ny < 0 || nx >= GameState.MAP_WIDTH || ny >= GameState.MAP_HEIGHT) continue;
        const td = GameState.tiles[ny][nx];
        if (td.biome === GameState.TILE_DESERT && !td.building) {
          candidates.push({ x: nx, y: ny });
        }
      }
    }

    if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];

    // Fallback: any desert tile
    const fallback = [];
    for (let y = 0; y < GameState.MAP_HEIGHT; y++) {
      for (let x = 0; x < GameState.MAP_WIDTH; x++) {
        const td = GameState.tiles[y][x];
        if (td.biome === GameState.TILE_DESERT && !td.building) fallback.push({ x, y });
      }
    }
    return fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : null;
  }

  _leastConnectedWaterTile() {
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    let minN = 5, candidates = [];

    for (const cell of this.waterCells) {
      let n = 0;
      for (const d of dirs) {
        const nx = cell.x + d.x, ny = cell.y + d.y;
        if (nx < 0 || ny < 0 || nx >= GameState.MAP_WIDTH || ny >= GameState.MAP_HEIGHT) continue;
        if (GameState.tiles[ny][nx].biome === GameState.TILE_WATER) n++;
      }
      if (n < minN)      { minN = n; candidates = [cell]; }
      else if (n === minN) { candidates.push(cell); }
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  // ── Garden growth ────────────────────────────────────────────────────────────

  _getGarden(x, y) {
    return this.gardens.find(g => g.x === x && g.y === y) || null;
  }

  _updateGardens(dt) {
    // Blink timer for stage-2 gardens
    this.gardenBlinkTimer += dt;
    if (this.gardenBlinkTimer >= 0.4) {
      this.gardenBlinkTimer = 0;
      this.gardenBlinkOn = !this.gardenBlinkOn;
    }

    for (const g of this.gardens) {
      if (g.stage === 3 || g.stage === 4) continue; // withered or harvested, waiting for player action

      // Apply blink alpha to stage-2 tiles only in the last 5s before withering
      if (g.stage === 2) {
        const tile = this.biomeLayer.getTileAt(g.x, g.y);
        if (tile) tile.alpha = g.timer >= 5 && this.gardenBlinkOn ? 0.35 : 1;
      }

      g.timer += dt;
      if (g.stage < 2 && g.timer >= 20) {
        g.timer -= 20;
        g.stage++;
        this.biomeLayer.putTileAt(11 + g.stage, g.x, g.y); // gid 12 then 13
        if (g.stage === 2) {
          GameState.changeLandHealth(1);
          if (!this.gardenReadyAlertShown) {
            this.gardenReadyAlertShown = true;
            const ui = this.scene.get('UIScene');
            if (ui) ui.showAlert('Your first garden is ready!\nClick quickly to harvest before the produce goes off.');
          }
        }
      } else if (g.stage === 2 && g.timer >= 10) {
        const t2 = this.biomeLayer.getTileAt(g.x, g.y);
        if (t2) t2.alpha = 1;
        g.stage = 3;
        g.timer = 0;
        this.biomeLayer.putTileAt(15, g.x, g.y); // gid 15 = withered
      }
    }
  }

  _harvestGarden(c, g) {
    const th = this.biomeLayer.getTileAt(c.x, c.y);
    if (th) th.alpha = 1;
    g.stage = 4;
    g.timer = 0;
    this.biomeLayer.putTileAt(14, c.x, c.y); // gid 14 = harvested
    this.previewLayer.removeTileAt(c.x, c.y);
    this.lastPreviewCell = null;
    GameState.changeCommunity(1);
    GameState.wood += 1;
    if (this.persons.length < this.buildingCells.length * 4) {
      const spawnPos = this._randomDesertNear(c);
      this.persons.push(new Person(this, spawnPos.x, spawnPos.y));
    }
    if (!this.gardenHarvestAlertShown) {
      this.gardenHarvestAlertShown = true;
      const ui = this.scene.get('UIScene');
      if (ui) ui.showAlert(
        'Farming give food and wood. Now, you can expand your community by building other shelters.\n' +
        'You can replant in the same place where you harvested.\n' +
        'Pay attention to the damage you cause on the land health and on the water level.'
      );
    }
  }

  _removeGarden(c, td, g) {
    td.biome = GameState.TILE_DESERT;
    this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_DESERT), c.x, c.y);
    this.gardens = this.gardens.filter(gg => gg !== g);
  }

  _replantGarden(c, g) {
    g.stage = 0;
    g.timer = 0;
    this.biomeLayer.putTileAt(11, c.x, c.y);
    GameState.changeWater(-2);
  }

  // ── Tree growth ──────────────────────────────────────────────────────────────

  _updateGrowingTrees(dt) {
    this.growingTrees = this.growingTrees.filter(t => {
      t.timer += dt;
      if (t.timer >= 30 && t.stage < 2) {
        t.timer -= 30;
        t.stage++;
        this.biomeLayer.putTileAt(6 + t.stage, t.x, t.y); // gid 7 then 8
        if (t.stage === 2) GameState.changeWater(1);
      }
      return t.stage < 2; // remove once fully grown (stage 2 stays as gid 8)
    });
  }

  // ── Rain ─────────────────────────────────────────────────────────────────────

  _startRain() {
    this.rain.duration      = 20 + Math.random() * 20; // 20 to 40 s
    this.rain.state         = 'fadein';
    this.rain.phaseTimer    = 0;
    this.rain.drops         = [];
    this.rain.started       = true;
    this.rain.lightningTimer = 0;
    this.rain.lightningDelay = 3 + Math.random() * 5; // first strike 3–8 s into active
  }

  _triggerLightning() {
    const count = Math.random() < 0.4 ? 3 : 2;
    let delay = 0;
    for (let i = 0; i < count; i++) {
      const alpha   = Math.max(0.15, 0.65 - i * 0.15);
      const onDur   = 40  + Math.random() * 40;
      const offDur  = 60  + Math.random() * 80;
      this.tweens.add({ targets: this.lightningOverlay, alpha,  duration: 15, delay });
      this.tweens.add({ targets: this.lightningOverlay, alpha: 0, duration: 25, delay: delay + onDur });
      delay += onDur + offDur;
    }
  }

  _updateRain(dt) {
    const r = this.rain;

    if (r.state === 'idle') {
      if (r.started) {
        r.nextTimer -= dt;
        if (r.nextTimer <= 0) this._startRain();
      }
      return;
    }

    const FADE = 10;
    r.phaseTimer += dt;
    let intensity = 0;

    if (r.state === 'fadein') {
      intensity = Math.min(r.phaseTimer / FADE, 1);
      if (r.phaseTimer >= FADE) { r.state = 'active'; r.phaseTimer = 0; }

    } else if (r.state === 'active') {
      intensity = 1;
      r.lightningTimer += dt;
      if (r.lightningTimer >= r.lightningDelay) {
        r.lightningTimer  = 0;
        r.lightningDelay  = 5 + Math.random() * 8;
        this._triggerLightning();
      }
      if (r.phaseTimer >= r.duration) { r.state = 'fadeout'; r.phaseTimer = 0; }

    } else if (r.state === 'fadeout') {
      intensity = Math.max(1 - r.phaseTimer / FADE, 0);
      if (r.phaseTimer >= FADE) {
        r.state      = 'idle';
        r.phaseTimer = 0;
        r.drops      = [];
        this.rainGraphics.clear();
        this.rainOverlay.setAlpha(0);
        const gain = Math.round(5 + ((r.duration - 30) / 30) * 5); // 5–10 pts
        GameState.changeWater(gain);
        r.nextTimer = 120 + Math.random() * 180; // 120–300 s
        return;
      }
    }

    this.rainOverlay.setAlpha(intensity * 0.45);
    this._drawRain(dt, intensity);
  }

  _drawRain(dt, intensity) {
    const SPEED = 420;
    const ANGLE = Math.PI / 6;            // 30° from vertical
    const VX    = SPEED * Math.sin(ANGLE); // ≈ 210 px/s
    const VY    = SPEED * Math.cos(ANGLE); // ≈ 364 px/s
    const LDX   = 14 * Math.sin(ANGLE);
    const LDY   = 14 * Math.cos(ANGLE);
    const W     = GameState.MAP_WIDTH  * 32;
    const H     = GameState.MAP_HEIGHT * 32 + UI_HEIGHT;

    // Spawn drops proportional to intensity
    const toSpawn = Math.floor(intensity * 220 * dt + Math.random());
    for (let i = 0; i < toSpawn; i++) {
      this.rain.drops.push({ x: Math.random() * (W + 300) - 300, y: UI_HEIGHT });
    }

    // Move & cull
    this.rain.drops = this.rain.drops.filter(d => {
      d.x += VX * dt;
      d.y += VY * dt;
      return d.y < H && d.x < W + 50;
    });

    // Draw — shadow pass then colour pass
    this.rainGraphics.clear();
    const SX = 1, SY = 1; // shadow offset
    this.rainGraphics.lineStyle(1.5, 0x111122, 0.45);
    for (const d of this.rain.drops) {
      this.rainGraphics.beginPath();
      this.rainGraphics.moveTo(d.x + SX, d.y + SY);
      this.rainGraphics.lineTo(d.x + LDX + SX, d.y + LDY + SY);
      this.rainGraphics.strokePath();
    }
    this.rainGraphics.lineStyle(1.5, 0xaaddff, 0.75);
    for (const d of this.rain.drops) {
      this.rainGraphics.beginPath();
      this.rainGraphics.moveTo(d.x, d.y);
      this.rainGraphics.lineTo(d.x + LDX, d.y + LDY);
      this.rainGraphics.strokePath();
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(_, delta) {
    const dt = delta / 1000;

    // Water regen (+1 every 30s)
    this.waterRegenTimer += dt;
    if (this.waterRegenTimer >= 30) {
      this.waterRegenTimer = 0;
      GameState.changeWater(1);
    }

    // Water drain (1 tile every 2s)
    if (this.initialWaterCount > 0) {
      this.waterDrainTimer += dt;
      if (this.waterDrainTimer >= 2) {
        this.waterDrainTimer = 0;
        const target = Math.round((GameState.water / 100) * this.initialWaterCount);
        if (this.waterCells.length > target) {
          const tile = this._leastConnectedWaterTile();
          if (tile) {
            GameState.tiles[tile.y][tile.x].biome = GameState.TILE_DESERT;
            this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_DESERT), tile.x, tile.y);
            this.waterCells = this.waterCells.filter(c => !(c.x === tile.x && c.y === tile.y));
          }
        } else if (this.waterCells.length < target) {
          const tile = this._desertTileAdjacentToWater();
          if (tile) {
            GameState.tiles[tile.y][tile.x].biome = GameState.TILE_WATER;
            this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_WATER), tile.x, tile.y);
            this.waterCells.push({ x: tile.x, y: tile.y });
          }
        }
      }
    }

    // Water crisis: game over only after 10s with no water tiles
    if (this.waterCells.length === 0) {
      this.waterCrisisTimer += dt;
      if (this.waterCrisisTimer >= 10) this.waterCrisisTriggered = true;
    } else {
      this.waterCrisisTimer = 0;
      this.waterCrisisTriggered = false;
    }

    this._updateRain(dt);
    this._updateGrowingTrees(dt);
    this._updateGardens(dt);

    for (const p of this.persons) p.update(delta);
  }
}
