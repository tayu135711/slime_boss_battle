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
  document.getElementById("bossHpBar")?.setAttribute("aria-valuenow", Math.round(hpPct));
  // 必殺技ゲージ
  dom.gaugeInner.style.width = state.specialGauge + "%";
  dom.gaugeLabel.textContent = `必殺技ゲージ: ${state.specialGauge}%`;
  dom.specialBtn.classList.toggle("visible", state.specialGauge >= 100);
  document.getElementById("gaugeBar")?.setAttribute("aria-valuenow", state.specialGauge);
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
  document.getElementById("playerHpBar")?.setAttribute("aria-valuenow", Math.round(pct));
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
  setTimeout(async () => {
    dom.titleScreen.classList.remove("visible");
    dom.titleScreen.style.transition = "";
    dom.titleScreen.style.opacity    = "";
    // 誤操作で開いていた場合の強制リセット
    dom.stageStartScreen?.classList.remove("visible");
    dom.stageSelectScreen?.classList.remove("visible");

    // ★ 広場を先に表示してからロードする（awaitで固まるのを防ぐ）
    showHomePlaza();

    // ★ バックグラウンドでロードし、完了したらUIを更新する
    try {
      const loaded = await loadFromServer();
      if (loaded) {
        dom.statusLine.textContent = "📂 セーブデータを読み込みました！";
        setTimeout(() => dom.statusLine.textContent = "", 2500);
        // ロードでstateが変わったのでUIを再反映
        refreshUi();
      }
    } catch (e) {
      console.warn("ロード失敗（続行）:", e);
    }
  }, 500);
}

function showMenu() { dom.menuScreen.classList.add("visible"); }
function hideMenu() { dom.menuScreen.classList.remove("visible"); }

function showHomePlaza() {
  // 全画面を非表示
  dom.menuScreen.classList.remove("visible");
  dom.stageSelectScreen.classList.remove("visible");
  dom.gachaScreen.classList.remove("visible");
  // バトル用HUD要素を隠す（広場中は不要）
  dom.bossHpArea?.classList.add("hud-hidden");
  dom.gaugeArea?.classList.add("hud-hidden");
  dom.statsArea?.classList.add("hud-hidden");
  dom.playerHpArea?.classList.add("hud-hidden");
  dom.controllerPanel?.classList.add("plaza-mode");
  // ★ バトル3Dオブジェクトを明示的に非表示（ステージ選択から戻ったときの残像防止）
  if (typeof setBattleObjectsVisible === "function") setBattleObjectsVisible(false);
  // 広場を表示
  dom.homePlazaScreen.classList.add("visible");
  // 広場を初期化
  if (typeof initHomePlaza === "function") initHomePlaza();
  // セーブ
  saveToServer();
}

function showComingSoon(name) {
  dom.statusLine.textContent = `🚧 ${name}は準備中です！`;
  setTimeout(() => { dom.statusLine.textContent = ""; }, 2000);
}

// ステージ選択の呼び元（"menu" or "plaza"）を記憶して戻り先を切り替える
let _stageSelectCaller = "plaza";

function showStageSelect(caller) {
  _stageSelectCaller = caller || "plaza";
  hideMenu();
  dom.stageSelectScreen.classList.add("visible");
  buildStageList();
}

function backFromStageSelect() {
  dom.stageSelectScreen.classList.remove("visible");
  if (_stageSelectCaller === "menu") {
    showMenu();
  } else {
    showHomePlaza();
  }
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
  // ★ 広場が表示中の場合は非表示にする（直接呼ばれるケース対策）
  if (dom.homePlazaScreen.classList.contains("visible")) {
    if (typeof exitHomePlaza === "function") exitHomePlaza();
  }
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

  // ★ 広場が表示中の場合は正しく終了させる（固まりバグの修正）
  if (dom.homePlazaScreen.classList.contains("visible")) {
    if (typeof exitHomePlaza === "function") exitHomePlaza();
  }

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

  // ★ 最終ボス（古王スライム・ガガントス = stageIndex 5）討伐フラグ
  if (state.stageIndex >= 5) {
    state.quests.king_slime_defeated = true;
  }

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
  state.keys = { up: false, down: false, left: false, right: false, action: false };
  state.joystickVec = { x: 0, y: 0 };
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
  state.player.vx              = 0;   // ★ 慣性速度リセット
  state.player.vz              = 0;

  // ★ nextAttackAt を Infinity に戻す（startStage() で正式に設定する）
  state.bossAI = { phase: 1, nextAttackAt: Infinity, mode: "wander", chargeTarget: null };

  // UI
  dom.gameOverScreen.classList.remove("visible");
  dom.resultScreen.classList.remove("visible");   // ★ リセット時にリザルトも閉じる
  dom.nextStageBtn.style.display = "";            // ★ コスチューム選択後に表示状態をリセット
  dom.statusLine.textContent = "";
  dom.attackBtn.disabled     = false;
  dom.attackBtn.classList.remove("disabled-look");

  // ★ 広場系UIが残っていたら念のためクリア
  const fishUI = document.getElementById("fishingUI");
  if (fishUI) fishUI.style.display = "none";
  const cookUI = document.getElementById("cookingUI");
  if (cookUI) cookUI.style.display = "none";
  const flUI = document.getElementById("flowerUI");
  if (flUI) flUI.style.display = "none";

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
      if (!costume) return;
      // 既に装備中のコスチュームは着替え画面を開かない
      if (state.equippedCostume?.id === costume.id) return;
      showDressingRoom(costume);
    });
  });
}

function applyCostume(costume) {
  state.equippedCostume = costume;
  // ボディ・触角の色変更
  if (three.slimeParts?.bodyMat)  three.slimeParts.bodyMat.color.set(costume.color);
  if (three.slimeParts?.stickMat) three.slimeParts.stickMat.color.set(costume.color);
  // 武器の表示切替
  if (three.swordPivot) three.swordPivot.visible = (costume.weapon === "sword");
  if (three.spearPivot) three.spearPivot.visible = (costume.weapon === "spear");
  // 帽子差し替え
  rebuildHat(costume);
  // ── 広場プレイヤーにも色を反映 ──
  if (plaza?.playerMesh) {
    plaza.playerMesh.traverse(child => {
      if (child.isMesh && child.material?.color) {
        child.material.color.set(costume.color);
      }
    });
  }
}

// ── 着替え画面（ドレッシングルーム） ─────────────────────────────
let _dressingTargetCostume = null;

function showDressingRoom(costume) {
  if (!costume) return;
  _dressingTargetCostume = costume;
  const cur = state.equippedCostume;

  // 現在装備中
  const fromEl   = document.getElementById("dressingFromArt");
  const fromName = document.getElementById("dressingFromName");
  const fromStar = document.getElementById("dressingFromStars");
  if (fromEl)   fromEl.innerHTML   = getSlimeSVG(cur.id, 80);
  if (fromName) fromName.textContent = cur.name;
  if (fromStar) fromStar.textContent = "⭐".repeat(cur.stars);

  // 着替え先
  const toEl   = document.getElementById("dressingToArt");
  const toName = document.getElementById("dressingToName");
  const toStar = document.getElementById("dressingToStars");
  if (toEl)   toEl.innerHTML   = getSlimeSVG(costume.id, 80);
  if (toName) toName.textContent = costume.name;
  if (toStar) toStar.textContent = "⭐".repeat(costume.stars);

  // 特技・武器情報
  const infoEl = document.getElementById("dressingInfo");
  if (infoEl) {
    const wpnLabel = weaponLabel(costume.weapon);
    const skillText = costume.skill
      ? `<div class="dressing-skill">✨ 特技: ${costume.skill.name} ─ ${costume.skill.desc}</div>`
      : "";
    infoEl.innerHTML = `
      <div class="dressing-weapon">武器: ${wpnLabel}</div>
      ${skillText}
    `;
  }

  // 画面表示
  const ds = document.getElementById("dressingScreen");
  if (ds) {
    ds.classList.add("visible");
    // ぷるぷる登場アニメ
    const box = document.getElementById("dressingBox");
    if (box) {
      box.style.animation = "none";
      box.offsetHeight; // reflow
      box.style.animation = "dressingPop 0.35s cubic-bezier(0.34,1.56,0.64,1)";
    }
  }
}

function closeDressingRoom() {
  const ds = document.getElementById("dressingScreen");
  if (ds) ds.classList.remove("visible");
  _dressingTargetCostume = null;
}

function confirmDressing() {
  if (!_dressingTargetCostume) return;
  const costume = _dressingTargetCostume;

  // 着替えモーション：3Dスライムをくるっと回転
  if (three.playerGroup || plaza?.playerMesh) {
    const mesh = three.playerGroup || plaza.playerMesh;
    let spins = 0;
    const spinFn = () => {
      mesh.rotation.y += 0.35;
      spins++;
      if (spins < 18) requestAnimationFrame(spinFn); // 約1回転
    };
    spinFn();
  }

  equipCostume(costume);
  saveToServer(); // 着替え後は即セーブ
  closeDressingRoom();

  // 着替え完了フィードバック
  dom.statusLine.textContent = `✨ ${costume.name} に着替えた！`;
  setTimeout(() => dom.statusLine.textContent = "", 2500);
}

// ── お弁当 ───────────────────────────────────────────────────
// お弁当はベンチ・ピクニックなど広場での使用のみ（home_scene.js）
// バトル中の使用は想定しない
function updateBentoBtn() {
  // 将来の拡張用（現在は広場UIで管理）
}

