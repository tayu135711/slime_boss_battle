// ============================================================
// STAGES: ここに追加するだけでステージが増える構造
// ============================================================
const STAGES = [
  {
    stageNo: 1, chapter: 1, name: "ぷちスライム・ポヨ",
    color: 0x88dd44, hitColor: 0xff2244,
    maxHp: 600, radius: 0.7, floatHeight: 0.08, floatSpeedMs: 600,
    moveSpeed: 0.018, wanderRadius: 3.5,
    attackIntervalMs: 4500, chargeDamage: 30, shockwaveDamage: 0,
    chargeSpeed: 0.14, shockwaveRadius: 0,
    phase2At: 0.5, phase3At: 0.25, hasShockwave: false,
    bgColor: 0x87ceeb, groundColor: 0x3a7d2a, fogDensity: 0.012,
  },
  {
    stageNo: 2, chapter: 1, name: "ぬめスライム・ジュル",
    color: 0x44bbaa, hitColor: 0xff2244,
    maxHp: 1000, radius: 0.85, floatHeight: 0.10, floatSpeedMs: 550,
    moveSpeed: 0.020, wanderRadius: 3.8,
    attackIntervalMs: 4000, chargeDamage: 45, shockwaveDamage: 0,
    chargeSpeed: 0.16, shockwaveRadius: 0,
    phase2At: 0.55, phase3At: 0.28, hasShockwave: false,
    bgColor: 0x7ab8d4, groundColor: 0x336e55, fogDensity: 0.014,
  },
  {
    stageNo: 3, chapter: 1, name: "くさスライム・モサ",
    color: 0x336622, hitColor: 0xff4400,
    maxHp: 1600, radius: 0.95, floatHeight: 0.12, floatSpeedMs: 500,
    moveSpeed: 0.022, wanderRadius: 4.0,
    attackIntervalMs: 3800, chargeDamage: 55, shockwaveDamage: 35,
    chargeSpeed: 0.17, shockwaveRadius: 3.2,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x6aad70, groundColor: 0x2a6020, fogDensity: 0.016,
  },
  {
    stageNo: 4, chapter: 1, name: "どろスライム・ドロン",
    color: 0x886644, hitColor: 0xff2200,
    maxHp: 2400, radius: 1.0, floatHeight: 0.12, floatSpeedMs: 480,
    moveSpeed: 0.023, wanderRadius: 4.2,
    attackIntervalMs: 3500, chargeDamage: 65, shockwaveDamage: 45,
    chargeSpeed: 0.18, shockwaveRadius: 3.4,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0xc4a96a, groundColor: 0x5a4020, fogDensity: 0.018,
  },
  {
    stageNo: 5, chapter: 1, name: "きのこスライム・ポコ",
    color: 0xcc6699, hitColor: 0xff0044,
    maxHp: 3500, radius: 1.05, floatHeight: 0.14, floatSpeedMs: 430,
    moveSpeed: 0.024, wanderRadius: 4.4,
    attackIntervalMs: 3200, chargeDamage: 72, shockwaveDamage: 52,
    chargeSpeed: 0.20, shockwaveRadius: 3.6,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0xd4a0c8, groundColor: 0x441050, fogDensity: 0.020,
  },
  {
    stageNo: 6, chapter: 1, name: "古王スライム・ガガントス",
    color: 0x9b5de5, hitColor: 0xff2244,
    maxHp: 5000, radius: 1.1, floatHeight: 0.15, floatSpeedMs: 400,
    moveSpeed: 0.025, wanderRadius: 4.5,
    attackIntervalMs: 3000, chargeDamage: 80, shockwaveDamage: 60,
    chargeSpeed: 0.22, shockwaveRadius: 3.8,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x8870cc, groundColor: 0x202050, fogDensity: 0.018,
  },
  // ★修正: Chapter2のステージ定義が丸ごと存在しなかったため、
  //         Stage6（古王スライム）を倒した瞬間に「STAGES.length-1」に必ず一致して
  //         エンディング画面が出てしまい、第二chapterへ絶対に進めないバグになっていた。
  //         boss_models.js側にはChapter2の異形モンスター5体（buildMonsterGolem〜Gaganthos）が
  //         用意済みだったので、それに対応するステージデータをここに追加する。
  //         monsterIndex: CHAPTER2_MONSTERS配列（boss_models.js）内の対応するビルダーの添字。
  {
    stageNo: 7, chapter: 2, monsterIndex: 0, name: "ぬめゴーレム",
    color: 0x556677, hitColor: 0xffaa22,
    maxHp: 6800, radius: 1.15, floatHeight: 0.10, floatSpeedMs: 700,
    moveSpeed: 0.026, wanderRadius: 4.6,
    attackIntervalMs: 2850, chargeDamage: 90, shockwaveDamage: 65,
    chargeSpeed: 0.23, shockwaveRadius: 3.9,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x445566, groundColor: 0x1c1c2a, fogDensity: 0.020,
  },
  {
    stageNo: 8, chapter: 2, monsterIndex: 1, name: "くさモンスター",
    color: 0x2f7a3a, hitColor: 0xccff33,
    maxHp: 8200, radius: 1.2, floatHeight: 0.10, floatSpeedMs: 680,
    moveSpeed: 0.027, wanderRadius: 4.8,
    attackIntervalMs: 2700, chargeDamage: 98, shockwaveDamage: 72,
    chargeSpeed: 0.24, shockwaveRadius: 4.0,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x3d6b3a, groundColor: 0x1a2e14, fogDensity: 0.022,
  },
  {
    stageNo: 9, chapter: 2, monsterIndex: 2, name: "どろベヒモス",
    color: 0x6a4a30, hitColor: 0xff5500,
    maxHp: 9800, radius: 1.3, floatHeight: 0.10, floatSpeedMs: 660,
    moveSpeed: 0.028, wanderRadius: 5.0,
    attackIntervalMs: 2550, chargeDamage: 108, shockwaveDamage: 80,
    chargeSpeed: 0.25, shockwaveRadius: 4.2,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x5a4028, groundColor: 0x2a1c10, fogDensity: 0.024,
  },
  {
    stageNo: 10, chapter: 2, monsterIndex: 3, name: "きのこ魔人",
    color: 0xaa3377, hitColor: 0xff33cc,
    maxHp: 11500, radius: 1.35, floatHeight: 0.10, floatSpeedMs: 640,
    moveSpeed: 0.029, wanderRadius: 5.2,
    attackIntervalMs: 2400, chargeDamage: 118, shockwaveDamage: 88,
    chargeSpeed: 0.26, shockwaveRadius: 4.4,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x552255, groundColor: 0x200a20, fogDensity: 0.026,
  },
  {
    stageNo: 11, chapter: 2, monsterIndex: 4, name: "古王ガガントス",
    color: 0x9b5de5, hitColor: 0xffffff,
    maxHp: 14000, radius: 1.4, floatHeight: 0.10, floatSpeedMs: 620,
    moveSpeed: 0.030, wanderRadius: 5.5,
    attackIntervalMs: 2250, chargeDamage: 130, shockwaveDamage: 100,
    chargeSpeed: 0.27, shockwaveRadius: 4.6,
    phase2At: 0.6, phase3At: 0.3, hasShockwave: true,
    bgColor: 0x2a1040, groundColor: 0x120522, fogDensity: 0.028,
  },
];

const CONFIG = {
  player: {
    color: 0x6ee7b7,
    radius: 0.55,
    moveSpeed: 0.12,
    startX: 0, startZ: 2.5,
    maxHp: 500,
    invincibleMs: 1000,
  },
  battle: {
    attackRange: 3.2,
    attackCooldownMs: 300,
    minDamage: 80, maxDamage: 150,
    criticalThreshold: 135,
    specialGaugePerHit: 18,
    specialMultiplier: 1.8,
    specialMinDamage: 400, specialMaxDamage: 600,
  },
  field: { halfSize: 14 },
  camera: {
    fov: 70, offsetY: 3.8, offsetZ: 9.5,
    lookAtY: 0.0, lookAtZAhead: -4.0, shakeMs: 180,
  },
};

function getCurrentStage(stageIndex) {
  return STAGES[stageIndex] || STAGES[STAGES.length - 1];
}

const COSTUMES = [
  { id:"c01", no:"No.01", name:"ノーマルスライム",     stars:1, color:0x6ee7b7, weapon:"none",  hat:null,      skillId:null,      rarity:0.22 },
  { id:"c02", no:"No.02", name:"みどりスライム",       stars:1, color:0x5adb5a, weapon:"none",  hat:null,      skillId:null,      rarity:0.18 },
  { id:"c03", no:"No.03", name:"きいろスライム",       stars:1, color:0xffe066, weapon:"none",  hat:null,      skillId:null,      rarity:0.14 },
  { id:"c04", no:"No.04", name:"あかスライム",         stars:1, color:0xff6b6b, weapon:"none",  hat:null,      skillId:null,      rarity:0.10 },
  { id:"c11", no:"No.11", name:"まほうつかいスライム", stars:2, color:0xc084fc, weapon:"none",  hat:"witch",   skillId:null,      rarity:0.08 },
  { id:"c12", no:"No.12", name:"ナイトスライム",       stars:2, color:0x94a3b8, weapon:"sword", hat:"knight",  skillId:null,      rarity:0.08 },
  { id:"c13", no:"No.13", name:"もりのスライム",       stars:2, color:0x4ade80, weapon:"none",  hat:"leaf",    skillId:null,      rarity:0.08 },
  { id:"c21", no:"No.21", name:"キングスライム",       stars:3, color:0x38bdf8, weapon:"none",  hat:"crown",   skillId:"wave",    rarity:0.03 },
  { id:"c22", no:"No.22", name:"ライリンスライム",     stars:3, color:0xa5f3fc, weapon:"none",  hat:"ice",     skillId:"ice",     rarity:0.03 },
  { id:"c23", no:"No.23", name:"イカズチスライム",     stars:3, color:0xfde047, weapon:"none",  hat:"thunder", skillId:"thunder", rarity:0.03 },
  { id:"c24", no:"No.24", name:"スライムスピア",       stars:3, color:0x818cf8, weapon:"spear", hat:null,      skillId:null,      rarity:0.03 },
];

// skillId → 表示用の名前・説明（着替え画面で使用）
const SKILL_INFO = {
  wave:    { name: "キングウェーブ",   desc: "青い衝撃波リングで大海嘯！" },
  ice:     { name: "アイスニードル",   desc: "氷柱を乱立させ極寒乱撃！" },
  thunder: { name: "サンダーボルト",   desc: "天からの雷撃で天罰一撃！" },
};

function getGachaPool() {
  const total = COSTUMES.reduce((s, c) => s + c.rarity, 0);
  return COSTUMES.map(c => ({ ...c, weight: c.rarity / total }));
}

const STAGE_REWARD_POOLS = {
  1: ["c01", "c02", "c03"],
  2: ["c01", "c02", "c11"],
  3: ["c03", "c04", "c12"],
  4: ["c11", "c12", "c13"],
  5: ["c12", "c13", "c21"],
  6: ["c21", "c22", "c23"],
  // ★修正: ★3スキル持ちコスチューム（wave/ice/thunder）はrarity 0.03と非常に低く、
  //         ガチャ運が悪いとスキルが一切解放されないまま詰みかねなかった。
  //         Chapter2の各ステージ報酬にも繰り返し★3を混ぜることで、
  //         周回すればいずれ全スキルを確実に入手できるようにする。
  7:  ["c21", "c22", "c23"],
  8:  ["c21", "c22", "c24"],
  9:  ["c21", "c23", "c24"],
  10: ["c22", "c23", "c24"],
  11: ["c21", "c22", "c23"],
};

function getStageRewardPool(stageNo) {
  const ids = STAGE_REWARD_POOLS[stageNo];
  if (!ids) {
    const star1 = COSTUMES.filter(c => c.stars === 1);
    return star1.sort(() => Math.random() - 0.5).slice(0, 3);
  }
  return ids.map(id => COSTUMES.find(c => c.id === id)).filter(Boolean);
}

// 釣りテーブル
const FISH_TABLE = [
  { id: "funa",   name: "小魚（フナ）", rarity: 0.50, icon: "🐟", desc: "小さな銀色の魚。おだやかな池の住人。" },
  { id: "stone",  name: "きれいな石",   rarity: 0.25, icon: "💎", desc: "水面でキラキラ光る、まるで宝石みたい。" },
  { id: "weed",   name: "水草",         rarity: 0.20, icon: "🌿", desc: "ゆらゆら揺れる緑。花束にできる。" },
  { id: "turtle", name: "小さなカメ",   rarity: 0.05, icon: "🐢", desc: "のんびり屋さんの小さなカメ。飼えるかも。" },
];

// 料理レシピ
const RECIPES = [
  {
    id: "grilled_fish", name: "やさしい焼き魚", icon: "🐟",
    effectDesc: "ほっとする味。HPが少し回復する。",
    ingredients: { funa: 1 },
    buff: { hpRecover: 30 }
  },
  {
    id: "stone_soup", name: "きらきら石のスープ", icon: "🍲",
    effectDesc: "体がぽかぽか。攻撃がほんの少し上がる。",
    ingredients: { stone: 1 },
    buff: { attackUp: 1.1 }
  },
  {
    id: "seaweed_salad", name: "水草のサラダ", icon: "🥗",
    effectDesc: "さっぱり気分。移動速度がちょっとだけアップ。",
    ingredients: { weed: 2 },
    buff: { speedUp: 1.15 }
  },
  {
    id: "fluffy_omelette", name: "ふわふわオムレツ", icon: "🍳",
    effectDesc: "元気が出る。必殺技ゲージが始めから少し溜まる。",
    ingredients: { funa: 1, weed: 1 },
    buff: { specialStart: 20 }
  },
  {
    id: "turtle_release", name: "カメの恩返し", icon: "🐢",
    effectDesc: "食べずに逃がす。幸運が訪れるかも？",
    ingredients: { turtle: 1 },
    buff: { critUp: 1.2 }
  },
  {
    id: "master_plate", name: "名人の一皿", icon: "🍽️",
    effectDesc: "特別なごちそう。HP・攻撃・防御すべて少しアップ。",
    ingredients: { funa: 1, stone: 1, weed: 1 },
    buff: { hpRecover: 50, attackUp: 1.1, defenseUp: 1.1 }
  },
  {
    id: "flower_basket", name: "花かごサラダ", icon: "🌸",
    effectDesc: "色とりどりの花で作ったサラダ。気分が上がって会心率アップ。",
    ingredients: { red_flower: 1, blue_flower: 1 },
    buff: { critUp: 1.3 }
  }
];