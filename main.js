/**
 * main.js
 * state・DOM参照・入力・メインループ・init・ガチャ
 * 依存: scene.js, battle.js, ui.js, config.js
 */

// ============================================================
// DOM参照
// ============================================================
const dom = {
  hpBarInner:        document.getElementById("hpBarInner"),
  hpText:            document.getElementById("hpText"),
  statusLine:        document.getElementById("statusLine"),
  attackBtn:         document.getElementById("attackBtn"),
  specialBtn:        document.getElementById("specialBtn"),
  gaugeInner:        document.getElementById("gaugeInner"),
  gaugeLabel:        document.getElementById("gaugeLabel"),
  totalDamageEl:     document.getElementById("totalDamage"),
  attackCountEl:     document.getElementById("attackCount"),
  resetBtn:          document.getElementById("resetBtn"),
  retryBtn:          document.getElementById("retryBtn"),
  sceneContainer:    document.getElementById("sceneContainer"),
  playerHpBarInner:  document.getElementById("playerHpBarInner"),
  playerHpText:      document.getElementById("playerHpText"),
  damageFlash:       document.getElementById("damageFlash"),
  gameOverScreen:    document.getElementById("gameOverScreen"),
  titleScreen:       document.getElementById("titleScreen"),
  menuScreen:        document.getElementById("menuScreen"),
  menuStageBtn:      document.getElementById("menuStageBtn"),
  menuGachaBtn:      document.getElementById("menuGachaBtn"),
  menuOtherBtn:      document.getElementById("menuOtherBtn"),
  stageSelectScreen: document.getElementById("stageSelectScreen"),
  stageList:         document.getElementById("stageList"),
  stageSelectBackBtn:document.getElementById("stageSelectBackBtn"),
  stageStartScreen:  document.getElementById("stageStartScreen"),
  stageStartBtn:     document.getElementById("stageStartBtn"),
  stageChapter:      document.getElementById("stageChapter"),
  stageNo:           document.getElementById("stageNo"),
  stageBossName:     document.getElementById("stageBossName"),
  resultScreen:      document.getElementById("resultScreen"),
  resultTitle:       document.getElementById("resultTitle"),
  resultStats:       document.getElementById("resultStats"),
  nextStageBtn:      document.getElementById("nextStageBtn"),
  endingScreen:      document.getElementById("endingScreen"),
  endingRetryBtn:    document.getElementById("endingRetryBtn"),
  // ガチャ画面
  gachaScreen:       document.getElementById("gachaScreen"),
  gachaPullBtn:      document.getElementById("gachaPullBtn"),
  gachaPull10Btn:    document.getElementById("gachaPull10Btn"),
  gachaResult:       document.getElementById("gachaResult"),
  gachaCollection:   document.getElementById("gachaCollection"),
  gachaCurrentCostume: document.getElementById("gachaCurrentCostume"),
  gachaBackBtn:      document.getElementById("gachaBackBtn"),
};

// ============================================================
// ゲーム状態
// ============================================================
const state = {
  currentHp:    STAGES[0].maxHp,
  totalDamage:  0,
  attackCount:  0,
  cleared:      false,
  stageIndex:   0,
  stageStartAt: 0,
  battleStarted: false,
  titleShown:    true,
  unlockedStages: 1,
  gameOver:      false,
  lastAttackAt:  0,
  specialGauge:  0,
  keys: { up: false, down: false, left: false, right: false },
  player: {
    x: CONFIG.player.startX, z: CONFIG.player.startZ,
    hp: CONFIG.player.maxHp,
    invincibleUntil: 0,
  },
  boss:       { x: 0, z: -2.5 },
  bossTarget: { x: 0, z: -2.5 },
  bossAI: {
    phase: 1, nextAttackAt: 0,
    mode: "wander", chargeTarget: null,
  },
  // コスチューム
  equippedCostume: COSTUMES[0],   // デフォルト: ノーマルスライム
  ownedCostumes:   [COSTUMES[0]], // 最初はノーマルのみ所持
};

// Three.js オブジェクト群
const three = {};

// ============================================================
// コスチューム適用
// ============================================================
function applyCostume(costume) {
  state.equippedCostume = costume;

  // プレイヤー体色を変更
  const body = three.playerGroup?.children[0];
  if (body && body.material) {
    body.material.color.set(costume.color);
  }

  // 武器表示切り替え
  if (three.swordPivot) three.swordPivot.visible = (costume.weapon === "sword");
  if (three.spearPivot) three.spearPivot.visible = (costume.weapon === "spear");
}

// ============================================================
// 攻撃モーション振り分け（コスチューム依存）
// ============================================================
function startAttackMotion() {
  const weapon = state.equippedCostume?.weapon || "none";
  if (weapon === "sword") {
    startSwordSwing();
  } else if (weapon === "spear") {
    startSpearThrust();
  } else {
    startDashAttack();
  }
}

// ============================================================
// 移動・ボス徘徊
// ============================================================
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

// ============================================================
// 入力
// ============================================================
function setupInput() {
  // 十字ボタン
  document.querySelectorAll(".dpad-btn[data-dir]").forEach(btn => {
    const dir = btn.dataset.dir;
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
  const keyMap = { arrowup:"up",w:"up", arrowdown:"down",s:"down", arrowleft:"left",a:"left", arrowright:"right",d:"right" };
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = true;
    if (k === " ") { e.preventDefault(); attackBoss(); }
  });
  window.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = false;
  });

  // ボタン
  dom.attackBtn.addEventListener("click", attackBoss);
  dom.specialBtn.addEventListener("click", useSpecialMove);
  dom.resetBtn.addEventListener("click", () => { resetBattle(); showStageStart(); });
  dom.retryBtn.addEventListener("click", () => { resetBattle(); showStageStart(); });
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
  dom.gachaPullBtn.addEventListener("click", () => doPull(1));
  dom.gachaPull10Btn.addEventListener("click", () => doPull(10));

  // エンディング
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

// ============================================================
// ガチャロジック
// ============================================================
function showGacha() {
  hideMenu();
  dom.gachaScreen.classList.add("visible");
  renderGachaCollection();
  renderCurrentCostume();
}

function renderCurrentCostume() {
  const c = state.equippedCostume;
  const stars = "⭐".repeat(c.stars);
  dom.gachaCurrentCostume.innerHTML = `
    <div class="gacha-equipped-label">現在の装備</div>
    <div class="gacha-equipped-card">
      <span class="gacha-card-stars">${stars}</span>
      <span class="gacha-card-name">${c.name}</span>
      <span class="gacha-card-weapon">${weaponLabel(c.weapon)}</span>
    </div>
  `;
}

function weaponLabel(w) {
  return w === "sword" ? "🗡️ 剣" : w === "spear" ? "🔱 槍" : "👊 素手";
}

function drawOne() {
  const pool = getGachaPool();
  const r = Math.random();
  let acc = 0;
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

  // 結果表示
  const stars3 = results.filter(c => c.stars === 3);
  const stars2 = results.filter(c => c.stars === 2);
  let html = `<div class="gacha-result-title">${count === 1 ? "結果" : "まとめ結果"}</div><div class="gacha-result-cards">`;
  results.forEach(c => {
    const cls = c.stars === 3 ? "gacha-card-r3" : c.stars === 2 ? "gacha-card-r2" : "gacha-card-r1";
    html += `<div class="gacha-card ${cls}">
      <div class="gacha-card-stars">${"⭐".repeat(c.stars)}</div>
      <div class="gacha-card-name">${c.name}</div>
      <div class="gacha-card-weapon">${weaponLabel(c.weapon)}</div>
    </div>`;
  });
  html += "</div>";
  if (stars3.length > 0) html += `<div class="gacha-jackpot">🎉 星3が出た！ ${stars3.map(c=>c.name).join("、")}</div>`;
  dom.gachaResult.innerHTML = html;

  // 最高レアリティを自動装備
  const best = results.sort((a,b) => b.stars - a.stars)[0];
  if (best.stars >= state.equippedCostume.stars) {
    equipCostume(best);
  }

  renderGachaCollection();
  renderCurrentCostume();
}

function equipCostume(costume) {
  state.equippedCostume = costume;
  // 3Dシーンが起動中なら即反映
  if (three.playerGroup) applyCostume(costume);
  renderCurrentCostume();
  renderGachaCollection();
}

function renderGachaCollection() {
  let html = "";
  COSTUMES.forEach(c => {
    const owned = state.ownedCostumes.find(o => o.id === c.id);
    const equipped = state.equippedCostume?.id === c.id;
    const cls = owned
      ? (c.stars === 3 ? "gacha-coll-r3" : c.stars === 2 ? "gacha-coll-r2" : "gacha-coll-r1")
      : "gacha-coll-locked";
    html += `<div class="gacha-coll-card ${cls}" data-id="${c.id}">
      <div class="gacha-coll-stars">${"⭐".repeat(c.stars)}</div>
      <div class="gacha-coll-name">${owned ? c.name : "????"}</div>
      ${equipped ? '<div class="gacha-coll-equipped">装備中</div>' : ""}
      ${owned && !equipped ? `<div class="gacha-coll-equip-btn">装備する</div>` : ""}
    </div>`;
  });
  dom.gachaCollection.innerHTML = html;

  // 「装備する」ボタンのクリック
  dom.gachaCollection.querySelectorAll(".gacha-coll-card[data-id]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const costume = COSTUMES.find(c => c.id === id);
      if (costume && state.ownedCostumes.find(o => o.id === id)) {
        equipCostume(costume);
      }
    });
  });
}

// ============================================================
// メインループ
// ============================================================
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

// ============================================================
// 初期化
// ============================================================
function init() {
  initScene();
  // シーン構築後にコスチューム適用（初期装備をノーマルに）
  applyCostume(state.equippedCostume);
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();
