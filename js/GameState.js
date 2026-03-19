const GameState = {
  // Biome IDs (also Phaser tile IDs with gid=1 → add 1)
  TILE_DESERT:   0,
  TILE_FOREST:   1,
  TILE_WATER:    2,
  TILE_BUILDING: 3,

  BUILDING_WOOD_COST: 5,

  ACTION_BUILD:    0,
  ACTION_REFOREST: 1,

  MAP_WIDTH:  60,
  MAP_HEIGHT: 32,

  wood:              0,
  land_health:       100,
  community:         0,
  cultural_knowledge: 0,
  water:             100,
  current_action:    0,

  tiles: [],

  initTiles() {
    this.tiles = [];
    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        this.tiles[y][x] = { biome: this.TILE_DESERT, has_tree: false, building: null };
      }
    }
  },

  // Biome ID → Phaser tile index (tileset gid=1)
  toPhaserId(biome) { return biome + 1; },

  addWood(amount)           { this.wood += amount; },
  changeLandHealth(delta)   { this.land_health        = Math.max(0, Math.min(100, this.land_health        + delta)); },
  changeCommunity(delta)    { this.community          = Math.max(0, Math.min(100, this.community          + delta)); },
  changeKnowledge(delta)    { this.cultural_knowledge = Math.max(0, Math.min(100, this.cultural_knowledge + delta)); },
  changeWater(delta)        { this.water              = Math.max(0, Math.min(100, this.water              + delta)); },

  reset() {
    this.wood = 0;
    this.land_health = 100;
    this.community = 0;
    this.cultural_knowledge = 0;
    this.water = 100;
    this.current_action = this.ACTION_BUILD;
    this.initTiles();
  }
};
