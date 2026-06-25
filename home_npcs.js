const HOME_NPCS = [
  {
    id: 1, startX: 5, startZ: -5, costumeId: "c12",
    lines: ["今日も修行してるよ！", "剣の腕なら負けない！", "明日はボスに挑戦だ"],
    conditionalLines: [
      { condition: () => state.unlockedStages >= 3, line: "もうそんなに進んだのか！" }
    ],
    moveSpeed: 0.025, moveRadius: 2.5, pauseTime: 2000, questId: null
  },
  {
    id: 2, startX: -6, startZ: -3, costumeId: "c04",
    lines: ["ボス討伐がんばれ！", "怪我には気をつけてね", "回復アイテムを持っていくといいよ"],
    conditionalLines: [
      { condition: () => state.equippedCostume?.id === "c04", line: "おそろいの色だね！" }
    ],
    moveSpeed: 0.02, moveRadius: 2.0, pauseTime: 3000, questId: "tutorial_defeat"
  },
  {
    id: 3, startX: 8, startZ: 4, costumeId: "c01",
    lines: ["いい天気だね〜", "昼寝したいな", "ここは平和だね"],
    conditionalLines: [],
    moveSpeed: 0.015, moveRadius: 3.0, pauseTime: 2500, questId: null
  },
  {
    id: 4, startX: -4, startZ: 7, costumeId: "c11",
    lines: ["魔法の修行中です！", "杖の調子がいいんだ", "魔法で花を咲かせられるよ"],
    conditionalLines: [
      { condition: () => state.unlockedStages >= 5, line: "ついにここまで来たんだね！" }
    ],
    moveSpeed: 0.028, moveRadius: 2.2, pauseTime: 1800, questId: null
  },
  {
    id: 5, startX: 3, startZ: 8, costumeId: "c03",
    lines: ["お腹すいたな〜", "食堂に行きたい", "今日のオススメは何かな"],
    conditionalLines: [],
    moveSpeed: 0.018, moveRadius: 2.8, pauseTime: 2200, questId: "restaurant_intro"
  },
  {
    id: 6, startX: -9, startZ: 2, costumeId: "c21",
    lines: ["キング様のお通りだ！", "我が名はキングスライム！", "ひざまずくがよい"],
    conditionalLines: [
      { condition: () => state.quests?.king_slime_defeated, line: "先日はお見事だったぞ" }
    ],
    moveSpeed: 0.022, moveRadius: 2.0, pauseTime: 3000, questId: "king_slime"
  },
  {
    id: 7, startX: 6, startZ: -9, costumeId: "c13",
    lines: ["森からきたよ〜", "葉っぱの冠、似合う？", "自然がいちばん！"],
    conditionalLines: [],
    moveSpeed: 0.02, moveRadius: 3.5, pauseTime: 2000, questId: null
  },
];

const npcState = HOME_NPCS.map(n => ({
  ...n,
  x: n.startX,
  z: n.startZ,
  mesh: null,
  targetX: n.startX,
  targetZ: n.startZ,
  moveState: "idle",
  waitUntil: 0,
  lastLine: null,
  lastLineTime: 0,
}));