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

  window.addEventListener("resize", () => {
    const { w, h } = getSize();
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });
}

// バトル更新
function updatePlayerMovement() {
  if (state.gameOver || !state.battleStarted) return;
  let dx = 0, dz = 0;
  if (state.keys.up)    dz -= 1;
  if (state.keys.down)  dz += 1;
  if (state.keys.left)  dx -= 1;
  if (state.keys.right) dx += 1;

  const half    = CONFIG.field.halfSize;
  const topSpeed = CONFIG.player.moveSpeed * 1.8;
  const accel    = 0.12;
  const friction = 0.82;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    state.player.vx = (state.player.vx || 0) + (dx / len * topSpeed - (state.player.vx || 0)) * accel;
    state.player.vz = (state.player.vz || 0) + (dz / len * topSpeed - (state.player.vz || 0)) * accel;
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  } else {
    state.player.vx = (state.player.vx || 0) * friction;
    state.player.vz = (state.player.vz || 0) * friction;
  }

  state.player.x = clamp(state.player.x + (state.player.vx || 0), -half, half);
  state.player.z = clamp(state.player.z + (state.player.vz || 0), -half, half);

  if (Math.abs(state.player.x) >= half) state.player.vx = 0;
  if (Math.abs(state.player.z) >= half) state.player.vz = 0;

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
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
    // 釣り中でも広場ループは継続（NPCや噴水の更新が止まらないように）
    if (!fishingActive) updateHomePlazaLoop();
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