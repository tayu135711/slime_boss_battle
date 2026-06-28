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
  const wasNotFull = !dom.specialBtn.classList.contains("visible");
  dom.specialBtn.classList.toggle("visible", state.specialGauge >= 100);
  if (wasNotFull && state.specialGauge >= 100) SE.gaugeFull();
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
  SE.resume();
  SE.plazaEnter();
  // マップボタンを表示
  if (typeof updateMapBtnVisibility === "function") updateMapBtnVisibility();
  // 広場を初期化
  if (typeof initHomePlaza === "function") initHomePlaza();
  // セーブ
  saveToServer();
}

function showComingSoon(name) {
  dom.statusLine.textContent = `🚧 ${name}は準備中です！`;
  setTimeout(() => { dom.statusLine.textContent = ""; }, 2000);
}

// ──────────────────────────────────────────────────────────────
// 🛍 商　店 UI
// ──────────────────────────────────────────────────────────────
function showShop() {
  const existing = document.getElementById("shopScreen");
  if (existing) { existing.style.display = "flex"; _renderShop(); return; }

  // ─── DOM生成 ───
  const screen = document.createElement("div");
  screen.id = "shopScreen";
  screen.style.cssText = [
    "position:fixed","inset:0","z-index:400",
    "display:flex","align-items:center","justify-content:center",
    "background:rgba(10,20,40,0.72)","backdrop-filter:blur(4px)",
  ].join(";");

  screen.innerHTML = `
  <div id="shopBox" style="
    background:linear-gradient(160deg,#1a2a4a 0%,#0f1a30 100%);
    border:2px solid #4a6aaa; border-radius:20px;
    padding:0 0 24px 0; width:min(96vw,680px); max-height:92vh;
    overflow-y:auto; box-shadow:0 8px 40px rgba(0,60,160,0.5);
    font-family:'Hiragino Sans','Yu Gothic',sans-serif; color:#e8eeff;
  ">
    <!-- ヘッダー -->
    <div style="
      background:linear-gradient(90deg,#1a3a7a,#2a5aaa,#1a3a7a);
      border-radius:18px 18px 0 0; padding:16px 20px 12px;
      text-align:center; position:relative;
    ">
      <div style="font-size:22px;font-weight:900;letter-spacing:0.1em;">🛍 商　店</div>
      <div style="font-size:11px;color:#9ab0e0;margin-top:2px;">きがえ・クエスト・コレクション</div>
      <button id="shopCloseBtn" style="
        position:absolute;right:14px;top:12px;
        background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);
        color:#fff;border-radius:50%;width:32px;height:32px;
        font-size:16px;cursor:pointer;line-height:1;
      ">✕</button>
    </div>

    <!-- タブ -->
    <div id="shopTabs" style="display:flex;gap:0;border-bottom:2px solid #2a3a6a;">
      <button class="shop-tab-btn active" data-tab="wardrobe" style="
        flex:1;padding:10px 4px;font-size:13px;font-weight:700;
        background:none;border:none;color:#88aaff;cursor:pointer;
        border-bottom:3px solid #4a8aff;letter-spacing:0.05em;
      ">👗 きがえる</button>
      <button class="shop-tab-btn" data-tab="quests" style="
        flex:1;padding:10px 4px;font-size:13px;font-weight:700;
        background:none;border:none;color:#6688cc;cursor:pointer;
        border-bottom:3px solid transparent;letter-spacing:0.05em;
      ">📋 クエスト</button>
      <button class="shop-tab-btn" data-tab="collection" style="
        flex:1;padding:10px 4px;font-size:13px;font-weight:700;
        background:none;border:none;color:#6688cc;cursor:pointer;
        border-bottom:3px solid transparent;letter-spacing:0.05em;
      ">📖 図　鑑</button>
    </div>

    <!-- コンテンツ -->
    <div id="shopContent" style="padding:16px 14px 0;"></div>
  </div>`;

  document.body.appendChild(screen);
  // ※ display:flex はインラインスタイルで設定済み。closeShop()はdisplay:noneで隠す。

  // タブ切り替え
  screen.querySelectorAll(".shop-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      screen.querySelectorAll(".shop-tab-btn").forEach(b => {
        b.style.color = "#6688cc";
        b.style.borderBottom = "3px solid transparent";
      });
      btn.style.color = "#88aaff";
      btn.style.borderBottom = "3px solid #4a8aff";
      _renderShopTab(btn.dataset.tab);
    });
  });
  document.getElementById("shopCloseBtn").addEventListener("click", closeShop);
  // 外側クリックで閉じる
  screen.addEventListener("click", e => { if (e.target === screen) closeShop(); });

  _renderShop();
}

function _renderShop() { _renderShopTab("wardrobe"); }

function _renderShopTab(tab) {
  const content = document.getElementById("shopContent");
  if (!content) return;

  if (tab === "wardrobe") {
    // ── 着替えエリア ──
    const equipped = state.equippedCostume;
    let html = `
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:#9ab0e0;margin-bottom:8px;">▼ 現在の装備</div>
        <div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:10px 14px;
          display:flex;align-items:center;gap:12px;">
          <div style="width:76px;height:76px;flex-shrink:0;">${getSlimeSVG(equipped.id, 76)}</div>
          <div>
            <div style="font-weight:800;font-size:15px;">${equipped.name}</div>
            <div style="font-size:13px;color:#ffd060;">${"⭐".repeat(equipped.stars)}</div>
            <div style="font-size:11px;color:#9ab0e0;margin-top:2px;">武器: ${_weaponLabel(equipped.weapon)}</div>
          </div>
        </div>
      </div>
      <div style="font-size:12px;color:#9ab0e0;margin-bottom:8px;">▼ 所持コスチューム（タップで着替え）</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">`;

    COSTUMES.forEach(c => {
      const owned    = !!state.ownedCostumes.find(o => o.id === c.id);
      const isEquip  = equipped?.id === c.id;
      const starBg   = c.stars === 3 ? "linear-gradient(135deg,#2a1a50,#4a2a80)" :
                       c.stars === 2 ? "linear-gradient(135deg,#1a2a50,#2a4070)" :
                                       "linear-gradient(135deg,#1a2020,#2a3040)";
      const border   = isEquip ? "2px solid #ffd060" : owned ? "1px solid #3a5090" : "1px solid #2a3050";
      html += `
        <div class="shop-costume-card" data-id="${c.id}" data-owned="${owned}" style="
          background:${starBg};border:${border};border-radius:12px;
          padding:10px 6px 8px;text-align:center;cursor:${owned && !isEquip ? "pointer" : "default"};
          opacity:${owned ? 1 : 0.45};transition:transform 0.15s,box-shadow 0.15s;
          position:relative;
        ">
          ${isEquip ? '<div style="position:absolute;top:4px;right:6px;font-size:9px;color:#ffd060;font-weight:700;">装備中</div>' : ""}
          <div style="width:68px;height:68px;margin:0 auto 4px;">
            ${owned ? getSlimeSVG(c.id, 68) : '<div style="width:68px;height:68px;line-height:68px;font-size:30px;text-align:center;color:#4a5080;">？</div>'}
          </div>
          <div style="font-size:10px;color:#ffd060;">${"⭐".repeat(c.stars)}</div>
          <div style="font-size:11px;font-weight:700;margin-top:2px;line-height:1.2;">${owned ? c.name : "?????"}</div>
          <div style="font-size:9px;color:#6888aa;margin-top:2px;">${c.no}</div>
        </div>`;
    });
    html += `</div><div style="height:16px;"></div>`;
    content.innerHTML = html;

    // 着替えクリック
    content.querySelectorAll(".shop-costume-card[data-owned='true']").forEach(card => {
      card.addEventListener("mouseenter", () => {
        if (card.dataset.id !== state.equippedCostume?.id) card.style.transform = "scale(1.04)";
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
      card.addEventListener("click", () => {
        const costume = COSTUMES.find(c => c.id === card.dataset.id);
        if (!costume || costume.id === state.equippedCostume?.id) return;
        showDressingRoom(costume);
        // 着替え後に商店も更新
        const orig = window._dressingConfirmHook;
        window._dressingConfirmHook = () => {
          setTimeout(() => _renderShopTab("wardrobe"), 400);
          if (orig) orig();
        };
      });
    });

  } else if (tab === "quests") {
    // ── クエスト掲示板 ──
    let html = `<div style="font-size:13px;color:#9ab0e0;margin-bottom:10px;">📋 クエスト一覧</div>`;

    Object.entries(QUESTS).forEach(([qid, def]) => {
      const qs = state.quests[qid];
      const isAccepted  = !!qs;
      const isCompleted = qs?.completed;
      const collected   = qs?.collected || 0;
      const goal        = def.goal;

      const barPct  = isAccepted && !isCompleted ? Math.min(100, Math.round(collected / goal * 100)) : (isCompleted ? 100 : 0);
      const barCol  = isCompleted ? "#44cc88" : "#4a8aff";
      const badgeText = isCompleted ? "✅ 達成" : isAccepted ? "🔵 進行中" : "⬜ 未受注";
      const badgeBg   = isCompleted ? "rgba(50,160,80,0.25)" : isAccepted ? "rgba(40,80,180,0.25)" : "rgba(60,60,80,0.25)";

      html += `
        <div style="background:rgba(255,255,255,0.05);border:1px solid #2a3a6a;border-radius:12px;
          padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-weight:700;font-size:13px;">${def.name}</div>
            <div style="font-size:10px;background:${badgeBg};padding:2px 8px;border-radius:20px;">${badgeText}</div>
          </div>
          <div style="font-size:11px;color:#9ab0e0;margin-bottom:8px;">${def.description}</div>
          ${isAccepted ? `
            <div style="background:#1a2a50;border-radius:6px;height:8px;margin-bottom:6px;overflow:hidden;">
              <div style="height:100%;width:${barPct}%;background:${barCol};border-radius:6px;transition:width 0.5s;"></div>
            </div>
            <div style="font-size:10px;color:#7a9acc;">進捗: ${isCompleted ? goal : collected} / ${goal}</div>
          ` : ""}
          <div style="font-size:10px;color:#c0a040;margin-top:4px;">🎁 報酬: ${def.rewardText}</div>
          <div style="font-size:10px;color:#6a8aaa;margin-top:2px;">依頼人: ${def.giver}</div>
          ${!isAccepted ? `
            <button class="shop-quest-accept" data-qid="${qid}" style="
              margin-top:8px;padding:6px 16px;font-size:11px;font-weight:700;
              background:linear-gradient(90deg,#2a4aaa,#3a6acc);border:1px solid #4a7aee;
              color:#fff;border-radius:20px;cursor:pointer;
            ">✋ クエストを受ける</button>
          ` : ""}
        </div>`;
    });

    content.innerHTML = html;
    content.querySelectorAll(".shop-quest-accept").forEach(btn => {
      btn.addEventListener("click", () => {
        const qid = btn.dataset.qid;
        if (acceptQuest(qid)) {
          btn.textContent = "受注した！";
          btn.disabled = true;
          btn.style.opacity = "0.6";
          dom.statusLine.textContent = `📋 クエスト「${QUESTS[qid].name}」を受けた！`;
          setTimeout(() => { dom.statusLine.textContent = ""; }, 2500);
          setTimeout(() => _renderShopTab("quests"), 500);
        }
      });
    });

  } else if (tab === "collection") {
    // ── 図鑑 ──
    const total  = COSTUMES.length;
    const owned  = COSTUMES.filter(c => state.ownedCostumes.find(o => o.id === c.id)).length;
    let html = `
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:22px;font-weight:900;color:#ffd060;">${owned}<span style="font-size:14px;color:#9ab0e0;"> / ${total}</span></div>
        <div style="font-size:11px;color:#9ab0e0;">コスチューム収集率</div>
        <div style="background:#1a2a50;border-radius:6px;height:10px;margin:8px auto;max-width:200px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(owned/total*100)}%;background:linear-gradient(90deg,#4a8aff,#a060ff);border-radius:6px;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">`;

    COSTUMES.forEach(c => {
      const isOwned = !!state.ownedCostumes.find(o => o.id === c.id);
      const starBg  = c.stars === 3 ? "#4a2a80" : c.stars === 2 ? "#1a3060" : "#1e2830";
      html += `
        <div style="background:${starBg};border-radius:10px;padding:8px 4px;text-align:center;opacity:${isOwned?1:0.4};">
          <div style="width:58px;height:58px;margin:0 auto 3px;">
            ${isOwned ? getSlimeSVG(c.id,58) : '<div style="width:58px;height:58px;line-height:58px;font-size:26px;text-align:center;color:#4a5080;">？</div>'}
          </div>
          <div style="font-size:9px;color:#ffd060;">${"⭐".repeat(c.stars)}</div>
          <div style="font-size:9px;font-weight:700;line-height:1.2;margin-top:1px;">${isOwned ? c.name : "?????"}</div>
        </div>`;
    });
    html += `</div><div style="height:16px;"></div>`;
    content.innerHTML = html;
  }
}

function _weaponLabel(w) {
  return w === "sword" ? "⚔️ 剣" : w === "spear" ? "🔱 槍" : "👊 なし";
}

function closeShop() {
  const s = document.getElementById("shopScreen");
  if (s) s.style.display = "none";
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
  SE.resume();
  SE.battleStart();

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
  SE.victory();
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
  // ボディ・触角の色変更（emissiveも連動させて色をはっきり出す）
  if (three.slimeParts?.bodyMat) {
    three.slimeParts.bodyMat.color.set(costume.color);
    three.slimeParts.bodyMat.emissive.set(costume.color);
    three.slimeParts.bodyMat.emissiveIntensity = 0.12;
  }
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
        // MeshPhysicalMaterialにはemissiveも更新
        if (child.material.emissive) {
          child.material.emissive.set(costume.color);
          child.material.emissiveIntensity = 0.12;
        }
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

  // 商店から開かれていた場合は商店UIを更新
  if (typeof window._dressingConfirmHook === "function") {
    window._dressingConfirmHook();
    window._dressingConfirmHook = null;
  }
}

// ── お弁当 ───────────────────────────────────────────────────
// お弁当はベンチ・ピクニックなど広場での使用のみ（home_scene.js）
// バトル中の使用は想定しない
function updateBentoBtn() {
  // 将来の拡張用（現在は広場UIで管理）
}

