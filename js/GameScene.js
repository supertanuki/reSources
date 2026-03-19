class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  preload() {
    this.load.spritesheet('tiles', 'art/tiles.png', { frameWidth: 32, frameHeight: 32 });
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
  }

  // ── World generation ────────────────────────────────────────────────────────

  _generateWorld() {
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
    if (inUI) return;

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
      preview = GameState.toPhaserId(GameState.TILE_BUILDING);
    } else if (act === GameState.ACTION_REFOREST &&
               td.biome === GameState.TILE_DESERT && !td.building &&
               GameState.wood >= 1) {
      preview = GameState.toPhaserId(GameState.TILE_FOREST);
    }

    if (preview !== -1) {
      this.previewLayer.putTileAt(preview, c.x, c.y);
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
    GameState.addWood(1);
    GameState.changeLandHealth(-1);
    GameState.changeWater(-1);
  }

  _reforest(c, td) {
    if (GameState.wood < 1) return;
    GameState.wood -= 1;
    td.biome = GameState.TILE_FOREST;
    td.has_tree = true;
    this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_FOREST), c.x, c.y);
    GameState.changeLandHealth(1);
    GameState.changeWater(1);
  }

  _tryBuild(c, td) {
    if (GameState.wood < GameState.BUILDING_WOOD_COST) return;
    GameState.wood -= GameState.BUILDING_WOOD_COST;
    td.building = 'hut';
    td.biome = GameState.TILE_BUILDING;
    this.biomeLayer.putTileAt(GameState.toPhaserId(GameState.TILE_BUILDING), c.x, c.y);
    GameState.changeCommunity(2);
    GameState.changeKnowledge(1);
    GameState.changeWater(-1);
    this._registerBuilding(c);
    this._spawnPeople(c);
  }

  _registerBuilding(c) {
    if (!this.buildingCells.find(b => b.x === c.x && b.y === c.y))
      this.buildingCells.push({ x: c.x, y: c.y });
  }

  _spawnPeople(c) {
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
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

  isDesertWorldPosition(wx, wy) {
    const c = this._toCell(wx, wy);
    if (!this._valid(c)) return false;
    return GameState.tiles[c.y][c.x].biome === GameState.TILE_DESERT;
  }

  // ── Water drain ─────────────────────────────────────────────────────────────

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
        }
      }
    }

    for (const p of this.persons) p.update(delta);
  }
}
