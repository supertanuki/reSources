// Simple seeded 2D Perlin noise
class SimpleNoise {
  constructor(seed) {
    const p = new Uint8Array(256);
    let s = (seed | 0) >>> 0;
    for (let i = 0; i < 256; i++) {
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      p[i] = ((s >>> 24) ^ i) & 0xff;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }

  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  perlin2(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const a  = this.perm[X]     + Y;
    const b  = this.perm[X + 1] + Y;
    return this.lerp(v,
      this.lerp(u, this.grad(this.perm[a],     x,     y),
                   this.grad(this.perm[b],     x - 1, y)),
      this.lerp(u, this.grad(this.perm[a + 1], x,     y - 1),
                   this.grad(this.perm[b + 1], x - 1, y - 1))
    );
  }

  octave(x, y, octaves, period, persistence) {
    let value = 0, amplitude = 1, total = 0, p = period;
    for (let i = 0; i < octaves; i++) {
      value += this.perlin2(x / p, y / p) * amplitude;
      total += amplitude;
      amplitude *= persistence;
      p /= 2;
    }
    return value / total;
  }
}
