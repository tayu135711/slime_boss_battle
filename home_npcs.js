/**
 * home_npcs.js
 * ホーム広場のNPC定義と状態管理
 */

const HOME_NPCS = [
  { id: 1, startX:  5, startZ: -5,  costumeId: "c12", line: "今日も修行してるよ！" },
  { id: 2, startX: -6, startZ: -3,  costumeId: "c04", line: "ボス討伐がんばれ！" },
  { id: 3, startX:  8, startZ:  4,  costumeId: "c01", line: "いい天気だね〜" },
  { id: 4, startX: -4, startZ:  7,  costumeId: "c11", line: "魔法の修行中です！" },
  { id: 5, startX:  3, startZ:  8,  costumeId: "c03", line: "お腹すいたな〜" },
  { id: 6, startX: -9, startZ:  2,  costumeId: "c21", line: "キング様のお通りだ！" },
  { id: 7, startX:  6, startZ: -9,  costumeId: "c13", line: "森からきたよ〜" },
];

// 実行時の NPC 状態（Three.js メッシュと現在位置を保持）
const npcState = HOME_NPCS.map(n => ({
  ...n,
  x: n.startX,
  z: n.startZ,
  mesh: null,
  wanderOffset: Math.random() * Math.PI * 2,  // ランダムウォークの位相
}));
