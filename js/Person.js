class Person {
  constructor(scene, x, y) {
    this.scene = scene;
    this.speed = 20.0;
    this.x = x;
    this.y = y;
    this._path = [];   // waypoints [{x, y}] in world coordinates
    this.stuckTime = 0;
    this._lastDist = 0;
    this._onWater = false;
    this._pauseTimer    = 0;
    this._pauseOnArrival = 0;

    this.sprite = scene.add.graphics();
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(10);
    this._drawNormal();

    this._pickNewTarget();
  }

  _drawNormal() {
    this.sprite.clear();
    this.sprite.fillStyle(0x000000);
    this.sprite.fillRect(-1, -3, 3, 6);
  }

  _drawBoat() {
    this.sprite.clear();
    this.sprite.fillStyle(0x000000);
    // mast (3px wide, going up)
    this.sprite.fillRect(-1, -4, 3, 4);
    // hull (2px tall, 8px wide)
    this.sprite.fillRect(-4, 0, 8, 2);
    // tip pixels at top of each end (pointe du bateau)
    this.sprite.fillRect(-5, 0, 1, 1);
    this.sprite.fillRect(4, 0, 1, 1);
  }

  update(delta) {
    const dt = delta / 1000;

    // Intentional pause (e.g. arrived at building entrance)
    if (this._pauseTimer > 0) {
      this._pauseTimer -= dt;
      return;
    }

    // No path → wait briefly then pick a new one
    if (this._path.length === 0) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.5) { this._pickNewTarget(); this.stuckTime = 0; }
      return;
    }

    const wp = this._path[0];
    const dx = wp.x - this.x;
    const dy = wp.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Reached waypoint → advance to the next one
    const arrivalThreshold = (this._path.length === 1 && this._pauseOnArrival > 0) ? 1.5 : 4;
    if (dist < arrivalThreshold) {
      this._path.shift();
      if (this._path.length === 0) {
        if (this._pauseOnArrival > 0) {
          this._pauseTimer    = this._pauseOnArrival;
          this._pauseOnArrival = 0;
        } else {
          this._pickNewTarget();
        }
      }
      this.stuckTime = 0;
      this._lastDist = 0;
      return;
    }

    // Move toward waypoint with a slight jitter for organic feel
    const dirX = dx / dist;
    const dirY = dy / dist;
    const jx = (Math.random() - 0.5) * 0.3;
    const jy = (Math.random() - 0.5) * 0.3;
    const ml = Math.sqrt((dirX + jx) ** 2 + (dirY + jy) ** 2) || 1;

    const nextX = this.x + ((dirX + jx) / ml) * this.speed * dt;
    const nextY = this.y + ((dirY + jy) / ml) * this.speed * dt;

    const onPassable = !this.scene.isPassableWorldPosition ||
                        this.scene.isPassableWorldPosition(this.x, this.y);
    const nextPassable = !this.scene.isPassableWorldPosition ||
                          this.scene.isPassableWorldPosition(nextX, nextY);

    if (onPassable && !nextPassable && !this._pathAllowsWater) {
      // Would enter an obstacle — clear path so A* recomputes a detour
      this._path = [];
      return;
    }

    this.x = nextX;
    this.y = nextY;
    this.sprite.setPosition(this.x, this.y);

    // Anti-stuck: if not getting closer over time, clear path and repick
    if (dist > this._lastDist - 0.1 && this._lastDist > 0) {
      this.stuckTime += dt;
      if (this.stuckTime > 1.5) { this._path = []; this.stuckTime = 0; }
    } else {
      this.stuckTime = 0;
    }
    this._lastDist = dist;

    // Water / boat visual (also triggers on basin tiles)
    const onWater = (this.scene.isWaterWorldPosition && this.scene.isWaterWorldPosition(this.x, this.y)) ||
                    (this.scene.isBasinWorldPosition  && this.scene.isBasinWorldPosition(this.x, this.y));
    if (onWater !== this._onWater) {
      this._onWater = onWater;
      if (onWater) this._drawBoat(); else this._drawNormal();
    }
  }

  _pickNewTarget() {
    if (this.scene.findPath) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const dest = this.scene.getRandomDestinationPosition
          ? this.scene.getRandomDestinationPosition()
          : { x: this.x, y: this.y };
        const path = this.scene.findPath({ x: this.x, y: this.y }, dest);
        if (path && path.length > 0) {
          this._path = this._jitterPath(path, dest.pause > 0 ? dest : null);
          this._pathAllowsWater = false;
          this._pauseOnArrival = dest.pause || 0;
          return;
        }
      }
      // No reachable destination — retry allowing water to escape
      const dest = this.scene.getRandomDestinationPosition
        ? this.scene.getRandomDestinationPosition()
        : { x: this.x, y: this.y };
      const path = this.scene.findPath({ x: this.x, y: this.y }, dest, true);
      if (path && path.length > 0) {
        this._path = this._jitterPath(path); this._pathAllowsWater = true; return;
      }
      // Still nothing — leave path empty, stuck timer will retry
    }

    // Fallback without pathfinding
    const dest = this.scene.getRandomDestinationPosition
      ? this.scene.getRandomDestinationPosition()
      : { x: this.x, y: this.y };
    this._path = [{
      x: dest.x + (Math.random() * 16 - 8),
      y: dest.y + (Math.random() * 16 - 8),
    }];
  }

  _jitterPath(path, exactEnd = null) {
    let prevX = this.x, prevY = this.y;
    return path.map((wp, i) => {
      const isLast = i === path.length - 1;
      // Keep the final waypoint exact when the person must stop precisely there
      if (isLast && exactEnd) { prevX = wp.x; prevY = wp.y; return { x: exactEnd.x, y: exactEnd.y }; }
      const dx = wp.x - prevX;
      const dy = wp.y - prevY;
      const offset = (Math.random() * 20) - 10;
      const jx = Math.abs(dy) > Math.abs(dx) ? offset : 0;
      const jy = Math.abs(dx) > Math.abs(dy) ? offset : 0;
      prevX = wp.x; prevY = wp.y;
      return { x: wp.x + jx, y: wp.y + jy };
    });
  }

  destroy() { this.sprite.destroy(); }
}
