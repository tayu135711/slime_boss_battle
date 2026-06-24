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
  nextStageBtn:        document.getElementById("nextStageBtn"),
  endingScreen:        document.getElementById("endingScreen"),
  endingRetryBtn:      document.getElementById("endingRetryBtn"),
  gachaScreen:         document.getElementById("gachaScreen"),
  gachaPullBtn:        document.getElementById("gachaPullBtn"),
  gachaPull10Btn:      document.getElementById("gachaPull10Btn"),
  gachaResult:         document.getElementById("gachaResult"),
  gachaCollection:     document.getElementById("gachaCollection"),
  gachaCurrentCostume: document.getElementById("gachaCurrentCostume"),
  gachaBackBtn:        document.getElementById("gachaBackBtn"),
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
  keys: { up: false, down: false, left: false, right: false },
  player: {
    x: CONFIG.player.startX, z: CONFIG.player.startZ,
    hp: CONFIG.player.maxHp,
    invincibleUntil: 0,
  },
  boss:       { x: 0, z: -2.5 },
  bossTarget: { x: 0, z: -2.5 },
  bossAI: {
    phase: 1,
    nextAttackAt: Infinity, // ★ バトル開始前は絶対に攻撃しない
    mode: "wander",
    chargeTarget: null,
  },
  equippedCostume: COSTUMES[0],
  ownedCostumes:   [COSTUMES[0]],
};

// Three.jsオブジェクト群
const three = {};

// ── コスチューム適用 ──────────────────────────────────────────
function applyCostume(costume) {
  state.equippedCostume = costume;
  const body = three.playerGroup?.children[0];
  if (body?.material) body.material.color.set(costume.color);
  if (three.swordPivot) three.swordPivot.visible = (costume.weapon === "sword");
  if (three.spearPivot) three.spearPivot.visible = (costume.weapon === "spear");
}

// ── 攻撃モーション振り分け ────────────────────────────────────
function startAttackMotion() {
  const w = state.equippedCostume?.weapon || "none";
  if      (w === "sword") startSwordSwing();
  else if (w === "spear") startSpearThrust();
  else                    startDashAttack();
}

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
  // Dパッド
  document.querySelectorAll(".dpad-btn[data-dir]").forEach(btn => {
    const dir     = btn.dataset.dir;
    const press   = e => { e.preventDefault(); state.keys[dir] = true;  btn.classList.add("pressed"); };
    const release = e => { e.preventDefault(); state.keys[dir] = false; btn.classList.remove("pressed"); };
    btn.addEventListener("touchstart",  press,   { passive: false });
    btn.addEventListener("touchend",    release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown",   press);
    btn.addEventListener("mouseup",     release);
    btn.addEventListener("mouseleave",  release);
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

  // ★ resetBtn: 開いている可能性のある画面をすべて閉じてからリセット
  dom.resetBtn.addEventListener("click", () => {
    dom.resultScreen.classList.remove("visible");
    dom.stageStartScreen.classList.remove("visible");
    dom.gameOverScreen.classList.remove("visible");
    resetBattle();
    showStageStart();
  });
  // ★ retryBtn: ゲームオーバー画面は resetBattle() 内で閉じる
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
  dom.gachaPullBtn.addEventListener("click",   () => doPull(1));
  dom.gachaPull10Btn.addEventListener("click", () => doPull(10));

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

// ── ガチャ ────────────────────────────────────────────────────
function showGacha() {
  hideMenu();
  dom.gachaResult.innerHTML = ""; // ★ 前回の結果をクリア
  dom.gachaScreen.classList.add("visible");
  renderGachaCollection();
  renderCurrentCostume();
}

function renderCurrentCostume() {
  const c = state.equippedCostume;
  dom.gachaCurrentCostume.innerHTML = `
    <div class="gacha-equipped-label">現在の装備</div>
    <div class="gacha-equipped-card">
      <span class="gacha-card-stars">${"⭐".repeat(c.stars)}</span>
      <span class="gacha-card-name">${c.name}</span>
      <span class="gacha-card-weapon">${weaponLabel(c.weapon)}</span>
    </div>`;
}

function weaponLabel(w) {
  return w === "sword" ? "🗡️ 剣" : w === "spear" ? "🔱 槍" : "👊 素手";
}

function drawOne() {
  const pool = getGachaPool();
  const r    = Math.random();
  let acc    = 0;
  for (const item of pool) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return pool[pool.length - 1];
}

function doPull(count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const got = drawOne();
    results.push(got);
    if (!state.ownedCostumes.find(c => c.id === got.id)) {
      state.ownedCostumes.push(got);
    }
  }

  // 結果HTML
  const stars3 = results.filter(c => c.stars === 3);
  let html = `<div class="gacha-result-title">${count === 1 ? "結果" : "まとめ結果"}</div>
    <div class="gacha-result-cards">`;
  results.forEach(c => {
    const cls = c.stars === 3 ? "gacha-card-r3" : c.stars === 2 ? "gacha-card-r2" : "gacha-card-r1";
    html += `<div class="gacha-card ${cls}">
      <div class="gacha-card-stars">${"⭐".repeat(c.stars)}</div>
      <div class="gacha-card-name">${c.name}</div>
      <div class="gacha-card-weapon">${weaponLabel(c.weapon)}</div>
    </div>`;
  });
  html += "</div>";
  if (stars3.length > 0) {
    html += `<div class="gacha-jackpot">🎉 星3が出た！ ${stars3.map(c => c.name).join("、")}</div>`;
  }
  dom.gachaResult.innerHTML = html;

  // ★ コピーしてからsort（元配列を破壊しない）
  const best = [...results].sort((a, b) => b.stars - a.stars)[0];
  if (best.stars >= state.equippedCostume.stars) {
    equipCostume(best);
  } else {
    renderGachaCollection();
    renderCurrentCostume();
  }
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
    html += `<div class="gacha-coll-card ${cls}" data-id="${c.id}" data-owned="${owned}">
      <div class="gacha-coll-stars">${"⭐".repeat(c.stars)}</div>
      <div class="gacha-coll-name">${owned ? c.name : "????"}</div>
      ${equipped ? '<div class="gacha-coll-equipped">装備中</div>' : ""}
      ${owned && !equipped ? '<div class="gacha-coll-equip-btn">装備する</div>' : ""}
    </div>`;
  });
  dom.gachaCollection.innerHTML = html;

  // ★ innerHTML書き換え後に一度だけリスナー登録（重複なし）
  dom.gachaCollection.querySelectorAll(".gacha-coll-card[data-owned='true']").forEach(card => {
    card.addEventListener("click", () => {
      const costume = COSTUMES.find(c => c.id === card.dataset.id);
      if (costume) equipCostume(costume);
    });
  });
}

// ── メインループ ──────────────────────────────────────────────
function animate() {
  updatePlayerMovement();
  updateBossMovement();
  updateCameraFollow();
  updateAttackButtonState();
  updateSwordSwing();
  updateDashAttack();
  updateSpearThrust();
  three.renderer.render(three.scene, three.camera);
  requestAnimationFrame(animate);
}

// ── 初期化 ────────────────────────────────────────────────────
function init() {
  initScene();
  applyCostume(state.equippedCostume);
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();
