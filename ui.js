/**
 * ui.js
 * HUD更新・画面遷移・ステージ管理・メニュー
 * 依存: state, dom, three, CONFIG, STAGES, getCurrentStage
 */

// ============================================================
// HUD更新
// ============================================================
function refreshUi() {
  const cs = getCurrentStage(state.stageIndex);
  // ボスHP
  const hpPct = Math.max(0, (state.currentHp / cs.maxHp) * 100);
  dom.hpBarInner.style.width = hpPct + "%";
  dom.hpText.textContent = `${cs.name}　HP ${state.currentHp} / ${cs.maxHp}`;
  if      (hpPct < 20) dom.hpBarInner.style.background = "linear-gradient(90deg,#7c0a02,#ff4d4d)";
  else if (hpPct < 50) dom.hpBarInner.style.background = "linear-gradient(90deg,#ff4d4d,#ff8c42)";
  else                 dom.hpBarInner.style.background = "linear-gradient(90deg,#ffb347,#ffd166)";
  // 必殺技ゲージ
  dom.gaugeInner.style.width = state.specialGauge + "%";
  dom.gaugeLabel.textContent = `必殺技ゲージ: ${state.specialGauge}%`;
  dom.specialBtn.classList.toggle("visible", state.specialGauge >= 100);
  // 統計
  dom.totalDamageEl.textContent = state.totalDamage;
  dom.attackCountEl.textContent = state.attackCount;
  // プレイヤーHP
  const playerHpPct = Math.max(0, (state.player.hp / CONFIG.player.maxHp) * 100);
  dom.playerHpBarInner.style.width = playerHpPct + "%";
  dom.playerHpText.textContent = `勇者　HP ${state.player.hp} / ${CONFIG.player.maxHp}`;
  if      (playerHpPct < 25) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#cc0000,#ff4444)";
  else if (playerHpPct < 50) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#ff8c00,#ffcc00)";
  else                        dom.playerHpBarInner.style.background = "linear-gradient(90deg,#44cc88,#88ffcc)";
}

function updateAttackButtonState() {
  if (state.cleared) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("disabled-look", !inRange);
  three.rangeRingMat.color.set(inRange ? 0x4466cc : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.35 : 0.12;
}

// ============================================================
// タイトル・メニュー
// ============================================================
function dismissTitle() {
  if (!state.titleShown) return;
  state.titleShown = false;
  dom.titleScreen.style.transition = "opacity 0.5s ease";
  dom.titleScreen.style.opacity = "0";
  setTimeout(() => {
    dom.titleScreen.classList.remove("visible");
    dom.titleScreen.style.transition = "";
    dom.titleScreen.style.opacity = "";
    showMenu();
  }, 500);
}

function showMenu() { dom.menuScreen.classList.add("visible"); }
function hideMenu() { dom.menuScreen.classList.remove("visible"); }

function showComingSoon(name) {
  dom.statusLine.textContent = `🚧 ${name}は準備中です！`;
  setTimeout(() => { dom.statusLine.textContent = ""; }, 2000);
}

function showStageSelect() {
  hideMenu();
  dom.stageSelectScreen.classList.add("visible");
  buildStageList();
}

function buildStageList() {
  dom.stageList.innerHTML = "";
  STAGES.forEach((stg, idx) => {
    const locked = idx >= state.unlockedStages;
    const card = document.createElement("div");
    card.className = "stage-card" + (locked ? " locked" : "");
    card.innerHTML = `
      <div class="stage-card-no">Stage<b>${stg.stageNo}</b></div>
      <div class="stage-card-info">
        <div class="stage-card-name">${stg.name}</div>
        <div class="stage-card-hp">HP ${stg.maxHp.toLocaleString()}</div>
      </div>
      <div class="stage-card-lock">${locked ? "🔒" : "▶"}</div>
    `;
    if (!locked) {
      card.addEventListener("click", () => {
        state.stageIndex = idx;
        resetBattle();
        dom.stageSelectScreen.classList.remove("visible");
        showStageStart();
      });
    }
    dom.stageList.appendChild(card);
  });
}

// ============================================================
// ステージ管理
// ============================================================
function showStageStart() {
  const stg = getCurrentStage(state.stageIndex);
  dom.stageChapter.textContent  = `Chapter ${stg.chapter}`;
  dom.stageNo.textContent       = `Stage ${stg.stageNo}`;
  dom.stageBossName.textContent = stg.name;
  dom.stageStartScreen.classList.add("visible");
}

function startStage() {
  dom.stageStartScreen.classList.remove("visible");
  state.stageStartAt  = Date.now();
  state.battleStarted = true;
  const stg = getCurrentStage(state.stageIndex);
  three.scene.fog        = new THREE.FogExp2(stg.bgColor, stg.fogDensity);
  three.scene.background = new THREE.Color(stg.bgColor);
  three.bossMat.color.set(stg.color);
  three.bossGroup.scale.set(1, 1, 1);
  // ボスのジオメトリをステージサイズに合わせて更新
  three.scene.remove(three.bossGroup);
  buildBoss();
}

function goNextStage() {
  dom.resultScreen.classList.remove("visible");
  state.stageIndex++;
  resetBattle();
  showStageStart();
}

// ============================================================
// クリア・ゲームオーバー
// ============================================================
function handleBossDefeated() {
  state.cleared = true;
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.add("disabled-look");
  dom.specialBtn.classList.remove("visible");
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity = 0.3;

  // 次のステージを解放
  if (state.stageIndex + 1 > state.unlockedStages) {
    state.unlockedStages = state.stageIndex + 1;
  }

  const elapsed = Math.floor((Date.now() - state.stageStartAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const stg = getCurrentStage(state.stageIndex);

  setTimeout(() => {
    if (state.stageIndex >= STAGES.length - 1) {
      dom.endingScreen.classList.add("visible");
    } else {
      dom.resultTitle.textContent = `✨ Stage ${stg.stageNo} CLEAR! ✨`;
      dom.resultStats.innerHTML = `
        <div>🏆 討伐: <b>${stg.name}</b></div>
        <div>⏱ クリアタイム: <b>${mm}:${ss}</b></div>
        <div>⚔️ 与ダメージ: <b>${state.totalDamage}</b></div>
        <div>🔢 攻撃回数: <b>${state.attackCount}</b>回</div>
      `;
      dom.resultScreen.classList.add("visible");
    }
  }, 800);
}

// ============================================================
// リセット
// ============================================================
function resetBattle() {
  state.currentHp    = getCurrentStage(state.stageIndex).maxHp;
  state.totalDamage  = 0;
  state.attackCount  = 0;
  state.cleared      = false;
  state.gameOver     = false;
  state.battleStarted = false;
  state.lastAttackAt = 0;
  state.specialGauge = 0;

  state.keys = { up: false, down: false, left: false, right: false };
  document.querySelectorAll(".dpad-btn").forEach(btn => btn.classList.remove("pressed"));

  if (three.swordPivot) three.swordPivot.rotation.z = 0;
  if (three.swordSwing)  three.swordSwing  = { active: false, progress: 0 };
  if (three.dashAttack)  { three.dashAttack  = { active: false, progress: 0 }; three.playerGroup?.scale.set(1,1,1); }
  if (three.spearThrust) { three.spearThrust = { active: false, progress: 0 }; three.spearPivot && (three.spearPivot.position.z = 0); }

  three.magicCircles.forEach(g => { g.userData.cancelled = true; three.scene.remove(g); });
  three.magicCircles = [];

  state.player.hp = CONFIG.player.maxHp;
  state.player.invincibleUntil = 0;
  state.bossAI = { phase: 1, nextAttackAt: Date.now() + 2000, mode: "wander", chargeTarget: null };

  dom.gameOverScreen.classList.remove("visible");
  dom.statusLine.textContent = "";
  dom.attackBtn.disabled = false;

  state.player.x = CONFIG.player.startX;
  state.player.z = CONFIG.player.startZ;
  if (three.playerGroup) three.playerGroup.position.set(state.player.x, 0, state.player.z);

  state.boss.x = 0;
  state.boss.z = -2.5;
  if (three.bossGroup) {
    three.bossGroup.position.set(0, getCurrentStage(state.stageIndex).radius, -2.5);
    three.bossGroup.scale.set(1, 1, 1);
  }
  three.bossMesh.material.transparent = false;
  three.bossMesh.material.opacity = 1;
  three.bossMat.color.set(getCurrentStage(state.stageIndex).color);

  pickNewBossTarget();
  refreshUi();
}
