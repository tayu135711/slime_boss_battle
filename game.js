/**
 * game.js
 * アニメーションループ・init・入力処理
 * ※ dom / state / three は main.js で定義済み
 */






// 入力（キーボード・タッチ）
function setupInput() {
  document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
    const dir = btn.dataset.dir;
    const press   = (e) => { e.preventDefault(); state.keys[dir] = true;  btn.classList.add("pressed"); };
    const release = (e) => { e.preventDefault(); state.keys[dir] = false; btn.classList.remove("pressed"); };
    btn.addEventListener("touchstart",  press,   { passive: false });
    btn.addEventListener("touchend",    release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown",   press);
    btn.addEventListener("mouseup",     release);
    btn.addEventListener("mouseleave",  release);
  });

  // ── バーチャルジョイスティック ──────────────────────────
  const jBase  = document.getElementById("joystickBase");
  const jKnob  = document.getElementById("joystickKnob");
  const J_RADIUS   = 52;   // ベース半径
  const J_DEAD     = 0.20; // デッドゾーン（中央付近は入力なし）
  const J_DIAG_TH  = 0.45; // 斜め判定の閾値

  let jActive = false;
  let jCx = 0, jCy = 0; // タッチ開始位置（ベース中心）

  function jReset() {
    jActive = false;
    jKnob.style.transform = "translate(-50%, -50%)";
    state.keys.up = state.keys.down = state.keys.left = state.keys.right = false;
    state.joystickVec = { x: 0, y: 0 };
  }

  function jUpdate(clientX, clientY) {
    const dx = clientX - jCx;
    const dy = clientY - jCy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, J_RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    // ノブ移動
    jKnob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;

    // アナログ値（移動速度に使う）
    const strength = Math.min(dist / J_RADIUS, 1.0);
    state.joystickVec = { x: nx * strength, y: ny * strength };

    // デジタルキー（デッドゾーン外でセット）
    if (strength > J_DEAD) {
      state.keys.up    = ny < -J_DIAG_TH;
      state.keys.down  = ny >  J_DIAG_TH;
      state.keys.left  = nx < -J_DIAG_TH;
      state.keys.right = nx >  J_DIAG_TH;
    } else {
      state.keys.up = state.keys.down = state.keys.left = state.keys.right = false;
    }
  }

  jBase.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = jBase.getBoundingClientRect();
    jCx = r.left + r.width  / 2;
    jCy = r.top  + r.height / 2;
    jActive = true;
    jUpdate(t.clientX, t.clientY);
  }, { passive: false });

  jBase.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!jActive) return;
    jUpdate(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: false });

  jBase.addEventListener("touchend",   (e) => { e.preventDefault(); jReset(); }, { passive: false });
  jBase.addEventListener("touchcancel",(e) => { e.preventDefault(); jReset(); }, { passive: false });

  // マウス対応（PCデバッグ用）
  jBase.addEventListener("mousedown", (e) => {
    const r = jBase.getBoundingClientRect();
    jCx = r.left + r.width  / 2;
    jCy = r.top  + r.height / 2;
    jActive = true;
    jUpdate(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    if (!jActive) return;
    jUpdate(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => { if (jActive) jReset(); });

  // ── キーボード ───────────────────────────────────────────
  const keyMap = { arrowup:"up",w:"up", arrowdown:"down",s:"down", arrowleft:"left",a:"left", arrowright:"right",d:"right" };
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = true;
    if (k === " " || k === "enter") {
      e.preventDefault();
      if (state.titleShown) return; // タイトル表示中は何もしない
      if (fishingActive) fishingAction();
      else if (dom.homePlazaScreen.classList.contains("visible")) handlePlazaAction();
      else attackBoss();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = false;
  });

  dom.attackBtn.addEventListener("click", () => {
    if (state.titleShown) return; // タイトル表示中は何もしない
    if (fishingActive) fishingAction();
    else if (dom.homePlazaScreen.classList.contains("visible")) handlePlazaAction();
    else attackBoss();
  });
  dom.specialBtn.addEventListener("click", useSpecialMove);
  dom.resetBtn.addEventListener("click", () => {
    if (dom.homePlazaScreen.classList.contains("visible")) return;
    resetBattle();
    showStageStart();
  });
  dom.retryBtn.addEventListener("click", () => { resetBattle(); showStageStart(); });
  document.getElementById("gameOverBackToPlazaBtn")?.addEventListener("click", () => {
    dom.gameOverScreen.classList.remove("visible");
    resetBattle();
    showHomePlaza();
  });
  dom.stageStartBtn.addEventListener("click", startStage);
  dom.titleStartBtn.addEventListener("click", dismissTitle);
  dom.titleStartBtn.addEventListener("touchend", e => { e.preventDefault(); dismissTitle(); }, { passive: false });
  dom.menuStageBtn.addEventListener("click", () => showStageSelect("menu"));
  dom.menuGachaBtn.addEventListener("click", showGacha);
  dom.menuOtherBtn.addEventListener("click", () => window.__adminOpenPanel?.());
  dom.stageSelectBackBtn.addEventListener("click", backFromStageSelect);
  dom.nextStageBtn.addEventListener("click", goNextStage);
  dom.backToPlazaBtn.addEventListener("click", () => {
    dom.resultScreen.classList.remove("visible");
    resetBattle();
    showHomePlaza();
  });
  dom.endingRetryBtn.addEventListener("click", () => { state.stageIndex = 0; dom.endingScreen.classList.remove("visible"); resetBattle(); showMenu(); });
  dom.gachaBackBtn.addEventListener("click", () => { dom.gachaScreen.classList.remove("visible"); dom.menuScreen.classList.add("visible"); });

  // ── 着替え画面ボタン ──────────────────────────────────────────
  document.getElementById("dressingConfirmBtn")?.addEventListener("click", confirmDressing);
  document.getElementById("dressingCancelBtn")?.addEventListener("click", closeDressingRoom);

  window.addEventListener("resize", () => {
    const { w, h } = getSize();
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });
}

// バトル更新
// ── バトル用歩きアニメ状態 ──────────────────────────────────────
const battleWalk = {
  phase:     0,
  wasMoving: false,
  landTimer: 0,
};

function updatePlayerMovement() {
  if (state.gameOver || !state.battleStarted) return;
  let dx = 0, dz = 0;

  // アナログジョイスティック優先
  const jv = state.joystickVec;
  if (jv && (Math.abs(jv.x) > 0.05 || Math.abs(jv.y) > 0.05)) {
    dx = jv.x;
    dz = jv.y;
  } else {
    if (state.keys.up)    dz -= 1;
    if (state.keys.down)  dz += 1;
    if (state.keys.left)  dx -= 1;
    if (state.keys.right) dx += 1;
  }

  const half    = CONFIG.field.halfSize;
  const topSpeed = CONFIG.player.moveSpeed * 1.8;
  const accel    = 0.12;
  const friction = 0.82;

  const isMoving = (dx !== 0 || dz !== 0);

  if (isMoving) {
    const len = Math.hypot(dx, dz);
    // ジョイスティックのアナログ強度をそのまま速度に反映
    const strength = (jv && len > 0) ? Math.min(len, 1.0) : 1.0;
    const targetVx = (dx / len) * topSpeed * strength;
    const targetVz = (dz / len) * topSpeed * strength;
    state.player.vx = (state.player.vx || 0) + (targetVx - (state.player.vx || 0)) * accel;
    state.player.vz = (state.player.vz || 0) + (targetVz - (state.player.vz || 0)) * accel;
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
    battleWalk.phase += 0.20;
  } else {
    state.player.vx = (state.player.vx || 0) * friction;
    state.player.vz = (state.player.vz || 0) * friction;
  }

  state.player.x = clamp(state.player.x + (state.player.vx || 0), -half, half);
  state.player.z = clamp(state.player.z + (state.player.vz || 0), -half, half);

  if (Math.abs(state.player.x) >= half) state.player.vx = 0;
  if (Math.abs(state.player.z) >= half) state.player.vz = 0;

  // ── ぽよんぽよんホップ（攻撃アニメ中は上書きしない） ──
  const attackBusy = three.dashAttack?.active || three.swordSwing?.active || three.spearThrust?.active;

  // 着地検出
  if (battleWalk.wasMoving && !isMoving) battleWalk.landTimer = 120;
  battleWalk.wasMoving = isMoving;
  if (battleWalk.landTimer > 0) battleWalk.landTimer -= 16;

  let posY = 0;
  let hopScaleX = 1, hopScaleY = 1;

  if (!attackBusy) {
    if (isMoving) {
      const hop = Math.max(0, Math.sin(battleWalk.phase));
      posY = hop * 0.22;
      const sq = 1.0 - hop;
      hopScaleX = 1 + sq * 0.10;
      hopScaleY = 1 - sq * 0.09;
    } else if (battleWalk.landTimer > 0) {
      const t = battleWalk.landTimer / 120;
      const s = Math.sin(t * Math.PI);
      hopScaleX = 1 + s * 0.20;
      hopScaleY = 1 - s * 0.17;
    } else {
      // 待機：呼吸アニメ
      const b = Math.sin(Date.now() * 0.0014) * 0.020;
      posY = b + 0.020;
      hopScaleX = 1 + b * 0.4;
      hopScaleY = 1 - b * 0.35;
    }
    three.playerGroup.position.set(state.player.x, posY, state.player.z);
    three.playerGroup.scale.set(hopScaleX, hopScaleY, hopScaleX);
  } else {
    // 攻撃アニメ中はXZ位置だけ更新（Y・スケールはアニメ側が制御）
    three.playerGroup.position.x = state.player.x;
    three.playerGroup.position.z = state.player.z;
  }

  three.rangeRing.position.set(state.player.x, 0.03, state.player.z);
}

function pickNewBossTarget() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * getCurrentStage(state.stageIndex).wanderRadius;
  state.bossTarget = { x: Math.cos(angle) * radius, z: -2.5 + Math.sin(angle) * radius };
}


function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function animate() {
  if (dom.homePlazaScreen.classList.contains("visible")) {
    // 釣り中もNPC・噴水・ドラゴンフライの更新は継続する
    // updateHomePlazaLoop内でプレイヤー移動はuiOpenフラグでスキップ済み
    updateHomePlazaLoop();
    three.renderer.render(three.scene, three.camera);
    requestAnimationFrame(animate);
    return;
  }
  if (fishingActive) {
    three.renderer.render(three.scene, three.camera);
    requestAnimationFrame(animate);
    return;
  }
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

function init() {
  initScene();
  applyCostume(state.equippedCostume);
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();