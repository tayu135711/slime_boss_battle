/**
 * ui.js — HUD更新・画面遷移・ステージ管理
 */

// ── HUD ──────────────────────────────────────────────────────
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
  const pct = Math.max(0, (state.player.hp / CONFIG.player.maxHp) * 100);
  dom.playerHpBarInner.style.width = pct + "%";
  dom.playerHpText.textContent = `勇者　HP ${state.player.hp} / ${CONFIG.player.maxHp}`;
  if      (pct < 25) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#cc0000,#ff4444)";
  else if (pct < 50) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#ff8c00,#ffcc00)";
  else               dom.playerHpBarInner.style.background = "linear-gradient(90deg,#44cc88,#88ffcc)";
}

function updateAttackButtonState() {
  // ★ バトル中でないとき・クリア後・ゲームオーバー後は何もしない
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("disabled-look", !inRange);
  three.rangeRingMat.color.set(inRange ? 0x4466cc : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.35 : 0.12;
}

// ── タイトル・メニュー ────────────────────────────────────────
function dismissTitle() {
  if (!state.titleShown) return;
  state.titleShown = false;
  dom.titleScreen.style.transition = "opacity 0.5s ease";
  dom.titleScreen.style.opacity    = "0";
  setTimeout(() => {
    dom.titleScreen.classList.remove("visible");
    dom.titleScreen.style.transition = "";
    dom.titleScreen.style.opacity    = "";
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
    const card   = document.createElement("div");
    card.className = "stage-card" + (locked ? " locked" : "");
    card.innerHTML = `
      <div class="stage-card-no">Stage<b>${stg.stageNo}</b></div>
      <div class="stage-card-info">
        <div class="stage-card-name">${stg.name}</div>
        <div class="stage-card-hp">HP ${stg.maxHp.toLocaleString()}</div>
      </div>
      <div class="stage-card-lock">${locked ? "🔒" : "▶"}</div>`;
    if (!locked) {
      card.addEventListener("click", () => {
        state.stageIndex = idx;
        dom.stageSelectScreen.classList.remove("visible");
        resetBattle();
        showStageStart();
      });
    }
    dom.stageList.appendChild(card);
  });
}

// ── ステージ管理 ──────────────────────────────────────────────
function showStageStart() {
  const stg = getCurrentStage(state.stageIndex);
  dom.stageChapter.textContent  = `Chapter ${stg.chapter}`;
  dom.stageNo.textContent       = `Stage ${stg.stageNo}`;
  dom.stageBossName.textContent = stg.name;
  dom.stageStartScreen.classList.add("visible");
}

function startStage() {
  // ★ 連打されてもbossGroupが増殖しないようにガード
  if (state.battleStarted) return;

  dom.stageStartScreen.classList.remove("visible");
  state.stageStartAt  = Date.now();
  state.battleStarted = true;

  // ★ バトル開始時に初回攻撃を2秒後に設定
  state.bossAI.nextAttackAt = Date.now() + 2000;

  const stg = getCurrentStage(state.stageIndex);
  three.scene.fog        = new THREE.FogExp2(stg.bgColor, stg.fogDensity);
  three.scene.background = new THREE.Color(stg.bgColor);

  // ボスを再構築（ステージサイズに合わせる）
  three.scene.remove(three.bossGroup);
  buildBoss();

  // ★ 再構築後にコスチュームを再適用（武器・色を引き継ぐ）
  applyCostume(state.equippedCostume);
}

function goNextStage() {
  // ★ stageIndexが上限を超えないよう境界チェック
  if (state.stageIndex >= STAGES.length - 1) return;
  dom.resultScreen.classList.remove("visible");
  state.stageIndex++;
  resetBattle();
  showStageStart();
}

// ── クリア・ゲームオーバー ─────────────────────────────────────
function handleBossDefeated() {
  state.cleared = true;
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.add("disabled-look");
  dom.specialBtn.classList.remove("visible");
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity     = 0.3;

  // ★ 次ステージを正しく解放（現在+1 を unlockedStages に反映）
  const nextIdx = state.stageIndex + 1;
  if (nextIdx < STAGES.length && nextIdx >= state.unlockedStages) {
    state.unlockedStages = nextIdx + 1;
  }

  const elapsed = Math.floor((Date.now() - state.stageStartAt) / 1000);
  const mm      = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss      = String(elapsed % 60).padStart(2, "0");
  const stg     = getCurrentStage(state.stageIndex);

  // ★ タイムアウト時点のステージ番号をキャプチャして保持
  const clearedStageIndex = state.stageIndex;
  setTimeout(() => {
    // ★ リセットや別ステージへの遷移が起きていたら何もしない
    if (!state.cleared || state.stageIndex !== clearedStageIndex) return;
    if (state.stageIndex >= STAGES.length - 1) {
      dom.endingScreen.classList.add("visible");
    } else {
      dom.resultTitle.textContent = `✨ Stage ${stg.stageNo} CLEAR! ✨`;
      dom.resultStats.innerHTML   = `
        <div>🏆 討伐: <b>${stg.name}</b></div>
        <div>⏱ クリアタイム: <b>${mm}:${ss}</b></div>
        <div>⚔️ 与ダメージ: <b>${state.totalDamage}</b></div>
        <div>🔢 攻撃回数: <b>${state.attackCount}</b>回</div>`;

      // ─ コスチューム3択報酬 ─
      renderRewardChoices(stg.stageNo);

      dom.nextStageBtn.style.display = "none";  // 選択後に表示する
      dom.resultScreen.classList.add("visible");
    }
  }, 800);
}

/** ステージ番号に対応した3択コスチューム選択UIを描画 */
function renderRewardChoices(stageNo) {
  const pool = getStageRewardPool(stageNo);
  let html = "";
  pool.forEach(c => {
    const rareCls  = c.stars === 3 ? "reward-card-r3" : c.stars === 2 ? "reward-card-r2" : "reward-card-r1";
    const owned    = !!state.ownedCostumes.find(o => o.id === c.id);
    const equipped = state.equippedCostume?.id === c.id;
    html += `<div class="reward-card ${rareCls}" data-id="${c.id}">
      <div class="reward-card-art">${getSlimeSVG(c.id, 72)}</div>
      <div class="reward-card-stars">${"⭐".repeat(c.stars)}</div>
      <div class="reward-card-name">${c.name}</div>
      <div class="reward-card-weapon">${weaponLabel(c.weapon)}</div>
      ${owned    ? '<div class="reward-card-badge owned">所持済み</div>' : ""}
      ${equipped ? '<div class="reward-card-badge equip">装備中</div>'  : ""}
    </div>`;
  });
  dom.rewardCards.innerHTML = html;

  // カードクリックで取得 & 装備
  dom.rewardCards.querySelectorAll(".reward-card").forEach(card => {
    card.addEventListener("click", () => {
      const costume = COSTUMES.find(c => c.id === card.dataset.id);
      if (!costume) return;

      // 所持リストに追加
      if (!state.ownedCostumes.find(o => o.id === costume.id)) {
        state.ownedCostumes.push(costume);
      }
      // 装備
      equipCostume(costume);

      // 選択済みスタイル
      dom.rewardCards.querySelectorAll(".reward-card").forEach(c => c.classList.remove("reward-selected"));
      card.classList.add("reward-selected");

      // 次のステージへボタンを出す
      dom.nextStageBtn.style.display = "";
    });
  });
}

// ── リセット ──────────────────────────────────────────────────
function resetBattle() {
  state.currentHp     = getCurrentStage(state.stageIndex).maxHp;
  state.totalDamage   = 0;
  state.attackCount   = 0;
  state.cleared       = false;
  state.gameOver      = false;
  state.battleStarted = false;
  state.lastAttackAt  = 0;
  state.specialGauge  = 0;

  // ★ Dパッドの押下状態をリセット（キーが押しっぱなしにならないように）
  state.keys = { up: false, down: false, left: false, right: false };
  document.querySelectorAll(".dpad-btn").forEach(b => b.classList.remove("pressed"));

  // モーションをすべてリセット
  if (three.swordPivot) three.swordPivot.rotation.z = 0;
  if (three.swordSwing)  three.swordSwing  = { active: false, progress: 0 };
  if (three.dashAttack) {
    three.dashAttack = { active: false, progress: 0 };
    three.playerGroup?.scale.set(1, 1, 1);
  }
  if (three.spearThrust) {
    three.spearThrust = { active: false, progress: 0 };
    if (three.spearPivot) { three.spearPivot.position.set(0, 0, 0); }
  }
  if (three.playerGroup) {
    three.playerGroup.rotation.x = 0;
    three.playerGroup.rotation.z = 0;
  }

  // 魔法陣をすべてキャンセル
  three.magicCircles.forEach(g => { g.userData.cancelled = true; three.scene.remove(g); });
  three.magicCircles = [];

  state.player.hp              = CONFIG.player.maxHp;
  state.player.invincibleUntil = 0;

  // ★ nextAttackAt を Infinity に戻す（startStage() で正式に設定する）
  state.bossAI = { phase: 1, nextAttackAt: Infinity, mode: "wander", chargeTarget: null };

  // UI
  dom.gameOverScreen.classList.remove("visible");
  dom.resultScreen.classList.remove("visible");   // ★ リセット時にリザルトも閉じる
  dom.statusLine.textContent = "";
  dom.attackBtn.disabled     = false;
  dom.attackBtn.classList.remove("disabled-look");

  // 座標リセット
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
  three.bossMesh.material.opacity     = 1;
  three.bossMat.color.set(getCurrentStage(state.stageIndex).color);

  pickNewBossTarget();
  // ★ コスチューム再適用（リセット後も装備状態を維持）
  if (three.playerGroup) applyCostume(state.equippedCostume);
  refreshUi();
}
