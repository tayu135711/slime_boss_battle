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
  // お弁当
  bentoBtn:            document.getElementById("bentoBtn"),
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

// ※ startAttackMotion / applyCostume / rebuildHat / _build系 は game.js に統一

// ── 移動 ──────────────────────────────────────────────────────
function updatePlayerMovement() {
  if (state.gameOver || !state.battleStarted) return;
  let dx = 0, dz = 0;
  if (state.keys.up)    dz -= 1;
  if (state.keys.down)  dz += 1;
  if (state.keys.left)  dx -= 1;
  if (state.keys.right) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len  = Math.hypot(dx, dz);
    const half = CONFIG.field.halfSize;
    state.player.x = Math.max(-half, Math.min(half, state.player.x + (dx / len) * CONFIG.player.moveSpeed));
    state.player.z = Math.max(-half, Math.min(half, state.player.z + (dz / len) * CONFIG.player.moveSpeed));
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  }
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.rangeRing.position.set(state.player.x, 0.03, state.player.z);
}

function pickNewBossTarget() {
  const angle  = Math.random() * Math.PI * 2;
  const radius = Math.random() * getCurrentStage(state.stageIndex).wanderRadius;
  state.bossTarget = { x: Math.cos(angle) * radius, z: -2.5 + Math.sin(angle) * radius };
}

function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
}

// ── 入力 ──────────────────────────────────────────────────────
function setupInput() {
  // Dパッド：タッチ＋マウス両対応
  // mouseupをwindowでもキャッチしてボタン外でマウスを離しても止まるようにする
  const pressedDirs = new Set();

  document.querySelectorAll(".dpad-btn[data-dir]").forEach(btn => {
    const dir = btn.dataset.dir;
    const press = e => {
      e.preventDefault();
      state.keys[dir] = true;
      btn.classList.add("pressed");
      pressedDirs.add(dir);
    };
    const release = e => {
      e.preventDefault();
      state.keys[dir] = false;
      btn.classList.remove("pressed");
      pressedDirs.delete(dir);
    };
    btn.addEventListener("touchstart",  press,   { passive: false });
    btn.addEventListener("touchend",    release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown",   press);
    btn.addEventListener("mouseleave",  release); // ボタンから外れたら止める
  });

  // ウィンドウ全体でmouseupをキャッチ → どこで離してもDパッドが止まる
  window.addEventListener("mouseup", () => {
    pressedDirs.forEach(dir => {
      state.keys[dir] = false;
      document.querySelectorAll(`.dpad-btn[data-dir="${dir}"]`)
        .forEach(b => b.classList.remove("pressed"));
    });
    pressedDirs.clear();
  });

  // キーボード
  const keyMap = {
    arrowup: "up", w: "up", arrowdown: "down", s: "down",
    arrowleft: "left", a: "left", arrowright: "right", d: "right",
  };
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = true;
    if (k === " ") { e.preventDefault(); attackBoss(); }
  });
  window.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = false;
  });

  // ゲームボタン
  dom.attackBtn.addEventListener("click", attackBoss);
  dom.specialBtn.addEventListener("click", useSpecialMove);

  // リセット
  dom.resetBtn.addEventListener("click", () => {
    resetBattle();
    showStageStart();
  });
  // リトライ（ゲームオーバー画面から）
  dom.retryBtn.addEventListener("click", () => {
    resetBattle();
    showStageStart();
  });

  dom.stageStartBtn.addEventListener("click", startStage);
  dom.nextStageBtn.addEventListener("click", goNextStage);

  // タイトル
  dom.titleScreen.addEventListener("click", dismissTitle);
  dom.titleScreen.addEventListener("touchend", e => { e.preventDefault(); dismissTitle(); }, { passive: false });

  // メニュー
  dom.menuStageBtn.addEventListener("click", showStageSelect);
  dom.menuGachaBtn.addEventListener("click", showGacha);
  dom.menuOtherBtn.addEventListener("click", () => showComingSoon("その他"));
  dom.stageSelectBackBtn.addEventListener("click", () => {
    dom.stageSelectScreen.classList.remove("visible");
    dom.menuScreen.classList.add("visible");
  });

  // ガチャ
  dom.gachaBackBtn.addEventListener("click", () => {
    dom.gachaScreen.classList.remove("visible");
    dom.menuScreen.classList.add("visible");
  });

  // エンディング→タイトルへ
  dom.endingRetryBtn.addEventListener("click", () => {
    state.stageIndex = 0;
    dom.endingScreen.classList.remove("visible");
    resetBattle();
    state.titleShown = true;
    dom.titleScreen.classList.add("visible");
  });

  // リサイズ
  window.addEventListener("resize", () => {
    const { w, h } = getSize();
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });
}

// ── コレクション図鑑 ──────────────────────────────────────────
function showGacha() {
  hideMenu();
  dom.gachaScreen.classList.add("visible");
  renderGachaCollection();
  renderCurrentCostume();
}

function renderCurrentCostume() {
  const c = state.equippedCostume;
  const rareCls = c.stars === 3 ? "gacha-card-r3" : c.stars === 2 ? "gacha-card-r2" : "gacha-card-r1";
  dom.gachaCurrentCostume.innerHTML = `
    <div class="gacha-equipped-label">── 現在の装備 ──</div>
    <div class="gacha-equipped-card ${rareCls}">
      <div class="gacha-equipped-art">${getSlimeSVG(c.id, 72)}</div>
      <div class="gacha-equipped-info">
        <div class="gacha-equipped-no">${c.no}</div>
        <div class="gacha-equipped-name">${c.name}</div>
        <div class="gacha-equipped-stars">${"⭐".repeat(c.stars)}</div>
        <div class="gacha-equipped-weapon">${weaponLabel(c.weapon)}</div>
      </div>
    </div>`;
}

function weaponLabel(w) {
  return w === "sword" ? "🗡️ 剣" : w === "spear" ? "🔱 槍" : "👊 素手";
}


function equipCostume(costume) {
  state.equippedCostume = costume;
  if (three.playerGroup) applyCostume(costume);
  renderCurrentCostume();
  renderGachaCollection();
}

function renderGachaCollection() {
  let html = "";
  COSTUMES.forEach(c => {
    const owned    = !!state.ownedCostumes.find(o => o.id === c.id);
    const equipped = state.equippedCostume?.id === c.id;
    const rareCls  = c.stars === 3 ? "gacha-coll-r3" : c.stars === 2 ? "gacha-coll-r2" : "gacha-coll-r1";
    const cls      = owned ? rareCls : "gacha-coll-locked";
    const art      = owned ? getSlimeSVG(c.id, 64) : `<div class="gacha-coll-mystery">？</div>`;
    html += `<div class="gacha-coll-card ${cls}" data-id="${c.id}" data-owned="${owned}">
      <div class="gacha-coll-art">${art}</div>
      <div class="gacha-coll-stars">${"⭐".repeat(c.stars)}</div>
      <div class="gacha-coll-no">${c.no}</div>
      <div class="gacha-coll-name">${owned ? c.name : "????"}</div>
      ${equipped ? '<div class="gacha-coll-equipped">装備中</div>' : ""}
      ${owned && !equipped ? '<div class="gacha-coll-equip-btn">装備する</div>' : ""}
    </div>`;
  });
  dom.gachaCollection.innerHTML = html;

  dom.gachaCollection.querySelectorAll(".gacha-coll-card[data-owned='true']").forEach(card => {
    card.addEventListener("click", () => {
      const costume = COSTUMES.find(c => c.id === card.dataset.id);
      if (costume) equipCostume(costume);
    });
  });
}

// ※ animate() / init() / init() 呼び出しは game.js に統一
