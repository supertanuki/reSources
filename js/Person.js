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

    this.sprite = scene.add.rectangle(x, y, 4, 8, 0x000000);
    this.sprite.setDepth(10);

    this._pickNewTarget();
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

    const blocked = this.scene.isDesertWorldPosition &&
                    !this.scene.isDesertWorldPosition(nextX, nextY);

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
  }

  _pickNewTarget() {
    const pos = this.scene.getRandomBuildingPosition
      ? this.scene.getRandomBuildingPosition()
      : { x: this.x, y: this.y };
    this.targetX = pos.x + (Math.random() * 16 - 8);
    this.targetY = pos.y + (Math.random() * 16 - 8);
  }

  destroy() { this.sprite.destroy(); }
}
