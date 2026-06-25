// ============================================================
// STAGES: ここに追加するだけでステージが増える構造
// 各フィールドの意味はStage1のコメントを参照。
// ============================================================
const STAGES = [
  {
    // --- Chapter 1 Stage 1 ---
    stageNo: 1, chapter: 1,
    name:    "ぷちスライム・ポヨ",
    color:   0x88dd44,        // 黄緑
    hitColor: 0xff2244,
    maxHp:   600,
    radius:  0.7,             // 小さい
    floatHeight: 0.08, floatSpeedMs: 600,
    moveSpeed: 0.018, wanderRadius: 3.5,
    attackIntervalMs: 4500,
    chargeDamage: 30, shockwaveDamage: 0,   // 衝撃波なし
    chargeSpeed: 0.14, shockwaveRadius: 0,
    phase2At: 0.5, phase3At: 0.25,
    hasShockwave: false,      // falseなら衝撃波を使わない
    bgColor: 0x87ceeb,        // ★ 昼の青空
    groundColor: 0x3a7d2a,
    fogDensity: 0.012,        // ★ フォグを薄くして遠くまで見える
  },
  {
    // --- Chapter 1 Stage 2 ---
    stageNo: 2, chapter: 1,
    name:    "ぬめスライム・ジュル",
    color:   0x44bbaa,        // 青緑
    hitColor: 0xff2244,
    maxHp:   1000,
    radius:  0.85,
    floatHeight: 0.10, floatSpeedMs: 550,
    moveSpeed: 0.020, wanderRadius: 3.8,
    attackIntervalMs: 4000,
    chargeDamage: 45, shockwaveDamage: 0,
    chargeSpeed: 0.16, shockwaveRadius: 0,
    phase2At: 0.55, phase3At: 0.28,
    hasShockwave: false,
    bgColor: 0x7ab8d4, groundColor: 0x336e55, fogDensity: 0.014,
  },
  {
    // --- Chapter 1 Stage 3 ---
    stageNo: 3, chapter: 1,
    name:    "くさスライム・モサ",
    color:   0x336622,        // 濃い緑
    hitColor: 0xff4400,
    maxHp:   1600,
    radius:  0.95,
    floatHeight: 0.12, floatSpeedMs: 500,
    moveSpeed: 0.022, wanderRadius: 4.0,
    attackIntervalMs: 3800,
    chargeDamage: 55, shockwaveDamage: 35,
    chargeSpeed: 0.17, shockwaveRadius: 3.2,
    phase2At: 0.6, phase3At: 0.3,
    hasShockwave: true,       // ここから衝撃波解禁
    bgColor: 0x6aad70, groundColor: 0x2a6020, fogDensity: 0.016,
  },
  {
    // --- Chapter 1 Stage 4 ---
    stageNo: 4, chapter: 1,
    name:    "どろスライム・ドロン",
    color:   0x886644,        // 茶色
    hitColor: 0xff2200,
    maxHp:   2400,
    radius:  1.0,
    floatHeight: 0.12, floatSpeedMs: 480,
    moveSpeed: 0.023, wanderRadius: 4.2,
    attackIntervalMs: 3500,
    chargeDamage: 65, shockwaveDamage: 45,
    chargeSpeed: 0.18, shockwaveRadius: 3.4,
    phase2At: 0.6, phase3At: 0.3,
    hasShockwave: true,
    bgColor: 0xc4a96a, groundColor: 0x5a4020, fogDensity: 0.018,
  },
  {
    // --- Chapter 1 Stage 5 ---
    stageNo: 5, chapter: 1,
    name:    "きのこスライム・ポコ",
    color:   0xcc6699,        // 紫ピンク
    hitColor: 0xff0044,
    maxHp:   3500,
    radius:  1.05,
    floatHeight: 0.14, floatSpeedMs: 430,
    moveSpeed: 0.024, wanderRadius: 4.4,
    attackIntervalMs: 3200,
    chargeDamage: 72, shockwaveDamage: 52,
    chargeSpeed: 0.20, shockwaveRadius: 3.6,
    phase2At: 0.6, phase3At: 0.3,
    hasShockwave: true,
    bgColor: 0xd4a0c8, groundColor: 0x441050, fogDensity: 0.020,
  },
  {
    // --- Chapter 1 Stage 6（ラスボス） ---
    stageNo: 6, chapter: 1,
    name:    "古王スライム・ガガントス",
    color:   0x9b5de5,        // 紫
    hitColor: 0xff2244,
    maxHp:   5000,
    radius:  1.1,
    floatHeight: 0.15, floatSpeedMs: 400,
    moveSpeed: 0.025, wanderRadius: 4.5,
    attackIntervalMs: 3000,
    chargeDamage: 80, shockwaveDamage: 60,
    chargeSpeed: 0.22, shockwaveRadius: 3.8,
    phase2At: 0.6, phase3At: 0.3,
    hasShockwave: true,
    bgColor: 0x8870cc, groundColor: 0x202050, fogDensity: 0.018,
  },
];

// ============================================================
// CONFIG: プレイヤー・バトル・カメラなどステージ共通設定
// ============================================================
const CONFIG = {
  player: {
    color: 0x6ee7b7,
    radius: 0.55,
    moveSpeed: 0.12,
    startX: 0,
    startZ: 2.5,
    maxHp: 500,
    invincibleMs: 1000,
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
  field: { halfSize: 14 },
  camera: {
    fov: 65, offsetY: 6.0, offsetZ: 9.0,
    lookAtY: 0.5, lookAtZAhead: -2.5, shakeMs: 180,
  },
};

// 現在のステージデータを取得するヘルパー（game.jsから使う）
function getCurrentStage(stageIndex) {
  return STAGES[stageIndex] || STAGES[STAGES.length - 1];
}

// ============================================================
// COSTUMES: ガチャのコスチューム定義
// stars:    1=色変化のみ 2=色+装備 3=色+装備+新スキル
// color:    プレイヤーの体の色
// weapon:   "none" | "sword" | "spear"
// skillId:  null | "wave" | "ice" | "thunder"（将来実装）
// rarity:   排出重みの合計が1.0になるよう設定
// ============================================================
const COSTUMES = [
  // ---- ⭐ 星1 (合計 0.64) ----
  { id:"c01", no:"No.01", name:"ノーマルスライム",     stars:1, color:0x6ee7b7, weapon:"none",  skillId:null,      rarity:0.22 },
  { id:"c02", no:"No.02", name:"みどりスライム",       stars:1, color:0x5adb5a, weapon:"none",  skillId:null,      rarity:0.18 },
  { id:"c03", no:"No.03", name:"きいろスライム",       stars:1, color:0xffe066, weapon:"none",  skillId:null,      rarity:0.14 },
  { id:"c04", no:"No.04", name:"あかスライム",         stars:1, color:0xff6b6b, weapon:"none",  skillId:null,      rarity:0.10 },
  // ---- ⭐⭐ 星2 (合計 0.24) ----
  { id:"c11", no:"No.11", name:"まほうつかいスライム", stars:2, color:0xc084fc, weapon:"none",  skillId:null,      rarity:0.08 },
  { id:"c12", no:"No.12", name:"ナイトスライム",       stars:2, color:0x94a3b8, weapon:"sword", skillId:null,      rarity:0.08 },
  { id:"c13", no:"No.13", name:"もりのスライム",       stars:2, color:0x4ade80, weapon:"none",  skillId:null,      rarity:0.08 },
  // ---- ⭐⭐⭐ 星3 (合計 0.12) ----
  { id:"c21", no:"No.21", name:"キングスライム",       stars:3, color:0x38bdf8, weapon:"none",  skillId:"wave",    rarity:0.03 },
  { id:"c22", no:"No.22", name:"ライリンスライム",     stars:3, color:0xa5f3fc, weapon:"none",  skillId:"ice",     rarity:0.03 },
  { id:"c23", no:"No.23", name:"イカズチスライム",     stars:3, color:0xfde047, weapon:"none",  skillId:"thunder", rarity:0.03 },
  { id:"c24", no:"No.24", name:"スライムスピア",       stars:3, color:0x818cf8, weapon:"spear", skillId:null,      rarity:0.03 },
];

// 確率テーブルの合計が1.0になるよう正規化して返す
function getGachaPool() {
  const total = COSTUMES.reduce((s, c) => s + c.rarity, 0);
  return COSTUMES.map(c => ({ ...c, weight: c.rarity / total }));
}

// ============================================================
// STAGE_REWARD_POOLS: ステージクリア時に3択で提示するコスチューム
// stageNo に対応する配列から重複なく3つ選んで表示する。
// 同じIDが複数回出ないよう getStageRewardPool() でシャッフル済み
// ============================================================
const STAGE_REWARD_POOLS = {
  1: ["c01", "c02", "c03"],              // Stage1: 星1×3
  2: ["c01", "c02", "c11"],              // Stage2: 星1×2 + 星2×1
  3: ["c03", "c04", "c12"],              // Stage3: 星1×2 + 星2×1
  4: ["c11", "c12", "c13"],             // Stage4: 星2×3
  5: ["c12", "c13", "c21"],             // Stage5: 星2×2 + 星3×1
  6: ["c21", "c22", "c23"],             // Stage6(ラスボス): 星3×3
};

/**
 * stageNo に対応するコスチューム報酬3択を返す。
 * 対応がない場合は星1からランダムに3つ返す。
 */
function getStageRewardPool(stageNo) {
  const ids = STAGE_REWARD_POOLS[stageNo];
  if (!ids) {
    // フォールバック: 星1をランダムに3つ
    const star1 = COSTUMES.filter(c => c.stars === 1);
    return star1.sort(() => Math.random() - 0.5).slice(0, 3);
  }
  return ids.map(id => COSTUMES.find(c => c.id === id)).filter(Boolean);
}
