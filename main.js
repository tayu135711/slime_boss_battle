/**
 * main.js
 * state・DOM参照・入力・メインループ・init
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
};

// Three.js オブジェクト群
const three = {};

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
  dom.menuGachaBtn.addEventListener("click", () => showComingSoon("コスチュームガチャ"));
  dom.menuOtherBtn.addEventListener("click", () => showComingSoon("その他"));
  dom.stageSelectBackBtn.addEventListener("click", () => {
    dom.stageSelectScreen.classList.remove("visible");
    dom.menuScreen.classList.add("visible");
  });

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
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();
