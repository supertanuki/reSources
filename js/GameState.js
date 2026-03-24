const GameState = {
  // Biome IDs (also Phaser tile IDs with gid=1 → add 1)
  TILE_DESERT: 0,
  TILE_FOREST: 1,
  TILE_WATER: 2,
  TILE_BUILDING: 3,
  TILE_FARM: 4,
  TILE_BASIN: 5,

  BUILDING_WOOD_COST: 5,
  BASIN_WOOD_COST: 20,

  ACTION_BUILD: 0,
  ACTION_REFOREST: 1,
  ACTION_FARM: 2,
  ACTION_BASIN: 3,

  MAP_WIDTH: 60,
  MAP_HEIGHT: 32,

  wood: 0,
  land_health: 100,
  community: 0,
  water: 100,
  waterHidden: 100,
  current_action: 0,
  shelterBuilt: false,
  gardenPlaced: false,

  // UI state persisted across UIScene restarts (e.g. language change)
  alertHistory: [],
  uiFarmUnlocked: false,
  uiReforestUnlocked: false,
  uiBasinUnlocked: false,

  tiles: [],

  initTiles() {
    this.tiles = [];
    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        this.tiles[y][x] = {
          biome: this.TILE_DESERT,
          has_tree: false,
          building: null,
        };
      }
    }
  },

  // Biome ID → Phaser tile index (tileset gid=1)
  toPhaserId(biome) {
    return biome + 1;
  },

  addWood(amount) {
    this.wood += amount;
  },
  changeLandHealth(delta) {
    this.land_health = Math.max(0, Math.min(100, this.land_health + delta));
  },
  changeCommunity(delta) {
    this.community = Math.max(0, Math.min(100, this.community + delta));
  },
  changeWater(delta) {
    this.water = Math.max(0, Math.min(100, this.water + delta));
  },
  changeWaterHidden(delta) {
    this.waterHidden = Math.max(0, Math.min(100, this.waterHidden + delta));
  },

  reset() {
    this.wood = 0;
    this.land_health = 100;
    this.community = 0;
    this.water = 100;
    this.waterHidden = 100;
    this.current_action = this.ACTION_BUILD;
    this.shelterBuilt = false;
    this.gardenPlaced = false;
    this.alertHistory = [];
    this.uiFarmUnlocked = false;
    this.uiReforestUnlocked = false;
    this.uiBasinUnlocked = false;
    this.initTiles();
  },
};
