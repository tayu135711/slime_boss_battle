const HOME_NPCS = [
  {
    id: 1, startX: 5, startZ: -5, costumeId: "c12",
    lines: [
      "今日は剣の素振りをしてたんだ〜",
      "えへへ、実は昨日のごはんがおいしすぎてつい寝坊したよ",
      "強くなるより、まずおいしいものを食べることが大事！",
      "今日の雲、なんかクマみたいじゃない？",
    ],
    conditionalLines: [
      { condition: () => state.unlockedStages >= 3, line: "もうそんなに進んだの！？すごいね〜！！" }
    ],
    moveSpeed: 0.022, moveRadius: 2.5, pauseTime: 2200, questId: null
  },
  {
    id: 2, startX: -6, startZ: -3, costumeId: "c04",
    lines: [
      "池のそばにいるの、好きなんだよね〜",
      "釣りって、ぼーっとできていいよね",
      "今日は何が釣れるかな〜。石かな？カメかな？",
      "水面キラキラしてて、見てるだけで癒される",
    ],
    conditionalLines: [
      { condition: () => state.equippedCostume?.id === "c04", line: "あっ！おそろいの色だ！なかよしだね🎉" }
    ],
    moveSpeed: 0.018, moveRadius: 2.0, pauseTime: 3000, questId: "fish_delivery"
  },
  {
    id: 3, startX: 8, startZ: 4, costumeId: "c01",
    lines: [
      "ふわ〜〜〜、いい天気だ〜",
      "芝生の上でごろごろするの、最高すぎる",
      "昼ご飯のあとの昼寝、最高の幸せだと思う",
      "ここの噴水の音、ずっと聞いてられるな〜",
      "今日も特に何もないけど、なんかいい日だな",
    ],
    conditionalLines: [],
    moveSpeed: 0.012, moveRadius: 3.0, pauseTime: 3500, questId: null
  },
  {
    id: 4, startX: -4, startZ: 7, costumeId: "c11",
    lines: [
      "お花って、見てるだけで元気もらえるよね",
      "白い花って清らかだよねえ",
      "花畑でお昼寝したことあるんだけど、最高だったよ！",
      "こっそり花かんむり作ってみたの。似合う？🌼",
    ],
    conditionalLines: [
      { condition: () => state.unlockedStages >= 5, line: "ねえ！ステージ5まで行ったって本当？すごすぎ！！" }
    ],
    moveSpeed: 0.020, moveRadius: 2.5, pauseTime: 2000, questId: "flower_beginner"
  },
  {
    id: 5, startX: 3, startZ: 8, costumeId: "c03",
    lines: [
      "食堂のマスターのスープ、絶品なんだよね〜",
      "今日のおすすめ料理、何かな〜♪",
      "ごはんのことを考えながら歩くの、好き",
      "水草って、料理にも使えるんだって！採ってきてほしいな〜",
      "食後に広場で昼寝したいな〜",
    ],
    conditionalLines: [],
    moveSpeed: 0.016, moveRadius: 2.8, pauseTime: 2500, questId: "seaweed_collect"
  },
  {
    id: 6, startX: -9, startZ: 2, costumeId: "c21",
    lines: [
      "キング様だが……今日は気分がほのぼのじゃ",
      "のう、石ってじっと見てると愛着わかない？",
      "噴水の音、落ち着くのう……",
      "ふふ。ここの広場、余のお気に入りじゃよ",
    ],
    conditionalLines: [
      { condition: () => state.quests?.king_slime_defeated, line: "先日はお見事だったぞ。なかなかやる！" }
    ],
    moveSpeed: 0.018, moveRadius: 2.0, pauseTime: 3200, questId: "stone_collect"
  },
  {
    id: 7, startX: 6, startZ: -9, costumeId: "c13",
    lines: [
      "葉っぱの冠、自分で作ったんだ〜どう？",
      "風がきもちいいね〜！最高の天気！",
      "木の実を拾ったんだけど……食べていいのかな",
      "遠くから来たけど、この広場が一番好きかも",
      "鳥の声、聞こえる？あれ、なんの鳥かな",
    ],
    conditionalLines: [],
    moveSpeed: 0.020, moveRadius: 3.5, pauseTime: 2000, questId: null
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
