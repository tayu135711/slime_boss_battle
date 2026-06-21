/**
 * config.js
 * ------------------------------------------------------------
 * ゲームバランス・演出周りの調整値をまとめた設定ファイル。
 * 数値をいじるだけで挙動を変えられるように、ロジック側(game.js)
 * からは極力ここの定数だけを参照する構成にしている。
 * ------------------------------------------------------------
 */

const CONFIG = {
  // --- ボスのステータス ---
  boss: {
    name: "古龍スライム・ギガンテス",
    maxHp: 5000,
    color: 0x9b5de5,
    radius: 1.1,
    homeZ: -2.5,        // ボスの定位置(z座標)
    wanderRadius: 3.5,  // 定位置を中心にどれだけ徘徊するか
    moveSpeed: 0.025,
    wanderIntervalMs: 3500, // 何msごとに目的地を変えるか
    floatHeight: 0.15,      // 浮遊演出の振れ幅
    floatSpeedMs: 400,      // 浮遊の周期
    // --- ボス攻撃 ---
    attackRangeZ: 2.0,      // この距離以内でボスが突進攻撃してくる
    chargeCooldownMs: 2500, // 突進の最低間隔
    chargeDamage: 300,      // 突進ヒット時のダメージ
    chargeSpeed: 0.18,      // 突進速度
  },

  // --- プレイヤー ---
  player: {
    color: 0x6ee7b7,
    radius: 0.55,
    moveSpeed: 0.12,
    startX: 0,
    startZ: 2.5,
    maxHp: 1000,  // プレイヤーHP追加
  },

  // --- 戦闘バランス ---
  battle: {
    attackRange: 3.2,
    attackCooldownMs: 300,
    minDamage: 80,
    maxDamage: 150,
  },

  // --- フィールド ---
  field: {
    halfSize: 6, // プレイヤーの可動範囲(中心から±)
  },

  // --- カメラ(TPS風・低め視点) ---
  camera: {
    fov: 55,
    offsetY: 3.2,
    offsetZ: 5.5,
    lookAtY: 0.8,
    lookAtZAhead: -2, // プレイヤーから見てどれだけ先を見るか
  },

  // --- 画面サイズ ---
  screen: {
    width: 320,
    height: 280,
  },
};
