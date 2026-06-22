const CONFIG = {
  boss: {
    name: "古龍スライム・ギガンテス",
    maxHp: 5000,
    color: 0x9b5de5,
    hitColor: 0xff2244,
    radius: 1.1,
    homeZ: -2.5,
    wanderRadius: 3.5,
    moveSpeed: 0.025,
    wanderIntervalMs: 3500,
    floatHeight: 0.15,
    floatSpeedMs: 400,
  },
  player: {
    color: 0x6ee7b7,
    radius: 0.55,
    moveSpeed: 0.12,
    startX: 0,
    startZ: 2.5,
  },
  battle: {
    attackRange: 3.2,
    attackCooldownMs: 300,
    minDamage: 80,
    maxDamage: 150,
    criticalThreshold: 135,
    specialGaugePerHit: 18,
    specialMultiplier: 1.8,
    specialMinDamage: 400,
    specialMaxDamage: 600,
  },
  ELEMENT_WEAKNESS: {
    dark: "light",
  },
  field: {
    halfSize: 8,          // 広いフィールドに合わせて拡張
  },
  camera: {
    fov: 60,              // 少し広角に
    offsetY: 4.5,
    offsetZ: 7.0,
    lookAtY: 0.5,
    lookAtZAhead: -2.5,
    shakeMs: 180,
  },
  // screenは JS側で window.innerWidth/innerHeight から動的に決める
};
