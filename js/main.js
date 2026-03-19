// Global layout constants (available to all scenes)
const UI_HEIGHT  = 70;
const GAME_WIDTH  = 1920;
const GAME_HEIGHT = UI_HEIGHT + 32 * 32; // 70 + 1024 = 1094

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [GameScene, UIScene],
};

new Phaser.Game(config);
