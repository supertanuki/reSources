class Person {
  constructor(scene, x, y) {
    this.scene = scene;
    this.speed = 20.0;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.stuckTime = 0;
    this.lastDist = 0;
    this._onWater = false;

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
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2.0) {
      this._pickNewTarget();
      this.stuckTime = 0;
      return;
    }

    const len = dist;
    let dirX = dx / len;
    let dirY = dy / len;

    const jx = (Math.random() - 0.5);
    const jy = (Math.random() - 0.5);
    const jl = Math.sqrt(jx * jx + jy * jy) || 1;
    const moveX = dirX + (jx / jl) * 0.5;
    const moveY = dirY + (jy / jl) * 0.5;
    const ml = Math.sqrt(moveX * moveX + moveY * moveY) || 1;

    const nextX = this.x + (moveX / ml) * this.speed * dt;
    const nextY = this.y + (moveY / ml) * this.speed * dt;

    const onDesert = !this.scene.isDesertWorldPosition ||
                     this.scene.isDesertWorldPosition(this.x, this.y);
    const onBuilding = this.scene.isBuildingWorldPosition &&
                       this.scene.isBuildingWorldPosition(this.x, this.y);
    const nextIsBuilding = this.scene.isBuildingWorldPosition &&
                           this.scene.isBuildingWorldPosition(nextX, nextY);
    const blocked = (!onBuilding && nextIsBuilding) ||
                    (onDesert &&
                     this.scene.isDesertWorldPosition &&
                     !this.scene.isDesertWorldPosition(nextX, nextY));

    if (blocked) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.5) { this._pickNewTarget(); this.stuckTime = 0; }
    } else {
      this.x = nextX;
      this.y = nextY;
      this.sprite.setPosition(this.x, this.y);

      if (dist > this.lastDist - 0.1) {
        this.stuckTime += dt;
        if (this.stuckTime > 1.0) { this._pickNewTarget(); this.stuckTime = 0; }
      } else {
        this.stuckTime = 0;
      }
    }

    this.lastDist = dist;

    const onWater = this.scene.isWaterWorldPosition
      ? this.scene.isWaterWorldPosition(this.x, this.y)
      : false;
    if (onWater !== this._onWater) {
      this._onWater = onWater;
      if (onWater) this._drawBoat(); else this._drawNormal();
    }
  }

  _pickNewTarget() {
    const pos = this.scene.getRandomDestinationPosition
      ? this.scene.getRandomDestinationPosition()
      : { x: this.x, y: this.y };
    this.targetX = pos.x + (Math.random() * 16 - 8);
    this.targetY = pos.y + (Math.random() * 16 - 8);
  }

  destroy() { this.sprite.destroy(); }
}
