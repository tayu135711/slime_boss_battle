/**
 * main.js — state / DOM / 入力 / ガチャ / メインループ / init
 */

// ── DOM参照 ──────────────────────────────────────────────────
const dom = {
  hpBarInner:          document.getElementById("hpBarInner"),
  hpText:              document.getElementById("hpText"),
  statusLine:          document.getElementById("statusLine"),
  attackBtn:           document.getElementById("attackBtn"),
  specialBtn:          document.getElementById("specialBtn"),
  gaugeInner:          document.getElementById("gaugeInner"),
  gaugeLabel:          document.getElementById("gaugeLabel"),
  totalDamageEl:       document.getElementById("totalDamage"),
  attackCountEl:       document.getElementById("attackCount"),
  resetBtn:            document.getElementById("resetBtn"),
  retryBtn:            document.getElementById("retryBtn"),
  sceneContainer:      document.getElementById("sceneContainer"),
  playerHpBarInner:    document.getElementById("playerHpBarInner"),
  playerHpText:        document.getElementById("playerHpText"),
  damageFlash:         document.getElementById("damageFlash"),
  gameOverScreen:      document.getElementById("gameOverScreen"),
  titleScreen:         document.getElementById("titleScreen"),
  menuScreen:          document.getElementById("menuScreen"),
  menuStageBtn:        document.getElementById("menuStageBtn"),
  menuGachaBtn:        document.getElementById("menuGachaBtn"),
  menuOtherBtn:        document.getElementById("menuOtherBtn"),
  stageSelectScreen:   document.getElementById("stageSelectScreen"),
  stageList:           document.getElementById("stageList"),
  stageSelectBackBtn:  document.getElementById("stageSelectBackBtn"),
  stageStartScreen:    document.getElementById("stageStartScreen"),
  stageStartBtn:       document.getElementById("stageStartBtn"),
  stageChapter:        document.getElementById("stageChapter"),
  stageNo:             document.getElementById("stageNo"),
  stageBossName:       document.getElementById("stageBossName"),
  resultScreen:        document.getElementById("resultScreen"),
  resultTitle:         document.getElementById("resultTitle"),
  resultStats:         document.getElementById("resultStats"),
  rewardCards:         document.getElementById("rewardCards"),
  nextStageBtn:        document.getElementById("nextStageBtn"),
  backToPlazaBtn:      document.getElementById("backToPlazaBtn"),
  endingScreen:        document.getElementById("endingScreen"),
  endingRetryBtn:      document.getElementById("endingRetryBtn"),
  gachaScreen:         document.getElementById("gachaScreen"),
  gachaCollection:     document.getElementById("gachaCollection"),
  gachaCurrentCostume: document.getElementById("gachaCurrentCostume"),
  gachaBackBtn:        document.getElementById("gachaBackBtn"),
  // ホーム広場
  homePlazaScreen:     document.getElementById("homePlazaScreen"),
  npcBubble:           document.getElementById("npcBubble"),
  plazaActionPrompt:   document.getElementById("plazaActionPrompt"),
  npcDialog:           document.getElementById("npcDialog"),
  npcDialogName:       document.getElementById("npcDialogName"),
  npcDialogText:       document.getElementById("npcDialogText"),
  npcDialogNext:       document.getElementById("npcDialogNext"),
  // タイトル
  titleStartBtn:       document.getElementById("titleStartBtn"),
  // 広場中に非表示にするHUD要素
  bossHpArea:          document.getElementById("bossHpArea"),
  gaugeArea:           document.getElementById("gaugeArea"),
  statsArea:           document.getElementById("statsArea"),
  playerHpArea:        document.getElementById("playerHpArea"),
  controllerPanel:     document.getElementById("controllerPanel"),
};

// ── ゲーム状態 ────────────────────────────────────────────────
const state = {
  currentHp:      STAGES[0].maxHp,
  totalDamage:    0,
  attackCount:    0,
  cleared:        false,
  stageIndex:     0,
  stageStartAt:   0,
  battleStarted:  false,
  titleShown:     true,
  unlockedStages: 1,
  gameOver:       false,
  lastAttackAt:   0,
  specialGauge:   0,
  keys: { up: false, down: false, left: false, right: false, action: false },
  joystickVec: { x: 0, y: 0 },
  player: {
    x: CONFIG.player.startX, z: CONFIG.player.startZ,
    hp: CONFIG.player.maxHp,
    invincibleUntil: 0,
  },
  boss:       { x: 0, z: -2.5 },
  bossTarget: { x: 0, z: -2.5 },
  bossAI: {
    phase: 1,
    nextAttackAt: Infinity,
    mode: "wander",
    chargeTarget: null,
  },
  equippedCostume: COSTUMES[0],
  ownedCostumes:   [COSTUMES[0]],
  // サブシステム（save.jsで保存・ロードされる）
  quests: {},
  inventory: { ingredients: {} },
  bento: [],
  maxBento: 3,
  dailyFishCount: 0,
  lastFishDate: null,
  dailyFlowerCount: 0,
  lastFlowerDate: null,
  unlockedRecipes: [],
  accessories: [],
  // 実績
  bestTimes: {},
  totalClears: 0,
};

// Three.jsオブジェクト群
const three = {};

// ※ 移動・入力・ガチャ・アニメーション関連は game.js / ui.js に一元化
