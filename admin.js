/**
 * admin.js — 管理者パネル
 *
 * 開き方: HUD左上の隠しエリアを1.5秒長押し（または長タッチ）
 * 機能:
 *   - ステージ即時ジャンプ
 *   - ボスHP・プレイヤーHP リアルタイム変更
 *   - ボス攻撃力・攻撃間隔・移動速度スライダー
 *   - 自分HP全回復 / ボスHP1にする
 */

(function () {

  // ── パネルのHTML ──────────────────────────────────────────
  const PANEL_HTML = `
<div id="adminPanel">
  <div id="adminHeader">
    <span>🛠️ 管理者パネル</span>
    <button id="adminCloseBtn">✕</button>
  </div>

  <div class="admin-section">
    <div class="admin-label">⚡ ステージ即時ジャンプ</div>
    <div id="adminStageBtns"></div>
  </div>

  <div class="admin-section">
    <div class="admin-label">👹 ボスHP</div>
    <input type="range" id="adminBossHp" min="1" max="5000" step="1">
    <span class="admin-val" id="adminBossHpVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">🧡 プレイヤーHP</div>
    <input type="range" id="adminPlayerHp" min="1" max="500" step="1">
    <span class="admin-val" id="adminPlayerHpVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">🗡️ ボス攻撃力 (突進)</div>
    <input type="range" id="adminChargeDmg" min="1" max="200" step="1">
    <span class="admin-val" id="adminChargeDmgVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">💥 ボス攻撃力 (衝撃波)</div>
    <input type="range" id="adminShockDmg" min="0" max="200" step="1">
    <span class="admin-val" id="adminShockDmgVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">⏱ ボス攻撃間隔 (ms)</div>
    <input type="range" id="adminAtkInterval" min="500" max="8000" step="100">
    <span class="admin-val" id="adminAtkIntervalVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">🏃 ボス移動速度</div>
    <input type="range" id="adminMoveSpeed" min="0.001" max="0.08" step="0.001">
    <span class="admin-val" id="adminMoveSpeedVal">-</span>
  </div>

  <div class="admin-section">
    <div class="admin-label">⚔️ プレイヤー攻撃力</div>
    <input type="range" id="adminPlayerMin" min="1" max="500" step="1">
    <span class="admin-val" id="adminPlayerMinVal">-</span>
    <span style="color:#888"> ～ </span>
    <input type="range" id="adminPlayerMax" min="1" max="500" step="1">
    <span class="admin-val" id="adminPlayerMaxVal">-</span>
  </div>

  <div class="admin-actions">
    <button class="admin-action-btn" id="adminHealBtn">💚 自分HP全回復</button>
    <button class="admin-action-btn danger" id="adminKillBossBtn">💀 ボスHP→1</button>
    <button class="admin-action-btn" id="adminMaxGaugeBtn">✨ 必殺技ゲージMAX</button>
    <button class="admin-action-btn danger" id="adminUnlockAllBtn">🔓 全ステージ解放</button>
  </div>
</div>`;

  // ── スタイル ──────────────────────────────────────────────
  const PANEL_CSS = `
#adminTrigger {
  position: fixed;
  top: 0; left: 0;
  width: 60px; height: 60px;
  z-index: 9000;
  cursor: default;
  -webkit-user-select: none;
  user-select: none;
}
#adminPanel {
  display: none;
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(400px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  background: rgba(10,5,25,0.97);
  border: 1.5px solid #9b5de5;
  border-radius: 14px;
  z-index: 9999;
  padding: 0 0 14px;
  box-shadow: 0 0 40px rgba(155,93,229,0.5);
  font-family: 'Segoe UI', sans-serif;
}
#adminPanel.visible { display: block; }
#adminHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(90deg, #3a0070, #1a0040);
  border-radius: 13px 13px 0 0;
  font-size: 15px;
  font-weight: bold;
  color: #cc88ff;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #6600aa;
}
#adminCloseBtn {
  background: none; border: none; color: #cc88ff;
  font-size: 18px; cursor: pointer; line-height: 1;
}
.admin-section {
  padding: 8px 16px 4px;
  border-bottom: 1px solid #2a1040;
}
.admin-label {
  font-size: 11px; color: #aa88cc; margin-bottom: 4px; letter-spacing: 0.3px;
}
.admin-section input[type=range] {
  width: calc(50% - 30px);
  accent-color: #9b5de5;
  vertical-align: middle;
}
.admin-val {
  font-size: 12px; color: #e8ccff;
  min-width: 48px; display: inline-block;
  text-align: right; vertical-align: middle;
}
#adminStageBtns {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0;
}
.admin-stage-btn {
  padding: 5px 12px; border-radius: 8px; border: 1px solid #6600aa;
  background: #200040; color: #cc88ff; font-size: 12px;
  cursor: pointer; font-weight: bold;
  transition: background 0.15s;
}
.admin-stage-btn:hover { background: #3a0070; }
.admin-stage-btn.current { background: #6600aa; color: #fff; border-color: #cc88ff; }
.admin-actions {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 12px 16px 4px;
}
.admin-action-btn {
  flex: 1; min-width: 44%; padding: 8px 6px;
  border-radius: 8px; border: 1px solid #6600aa;
  background: #200040; color: #cc88ff;
  font-size: 12px; cursor: pointer; font-weight: bold;
  transition: background 0.15s;
}
.admin-action-btn:hover { background: #3a0070; }
.admin-action-btn.danger { border-color: #cc2244; color: #ff8899; }
.admin-action-btn.danger:hover { background: #3a0018; }
#adminToast {
  position: fixed; bottom: 80px; left: 50%;
  transform: translateX(-50%);
  background: rgba(155,93,229,0.9);
  color: #fff; padding: 8px 20px;
  border-radius: 20px; font-size: 13px;
  z-index: 10000; pointer-events: none;
  opacity: 0; transition: opacity 0.3s;
}
#adminToast.show { opacity: 1; }
`;

  // ── DOM挿入 ──────────────────────────────────────────────
  function mount() {
    // スタイル
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);

    // トリガーエリア（透明）
    const trigger = document.createElement('div');
    trigger.id = 'adminTrigger';
    document.body.appendChild(trigger);

    // パネル本体
    const wrapper = document.createElement('div');
    wrapper.innerHTML = PANEL_HTML;
    document.body.appendChild(wrapper.firstElementChild);

    // トースト
    const toast = document.createElement('div');
    toast.id = 'adminToast';
    document.body.appendChild(toast);

    setupTrigger(trigger);
    setupPanel();
  }

  // ── 長押しトリガー ────────────────────────────────────────
  function setupTrigger(el) {
    let timer = null;
    let pressing = false;

    function startPress() {
      pressing = true;
      timer = setTimeout(() => {
        if (pressing) openPanel();
      }, 1500);
    }
    function cancelPress() {
      pressing = false;
      clearTimeout(timer);
    }

    el.addEventListener('mousedown',   startPress);
    el.addEventListener('mouseup',     cancelPress);
    el.addEventListener('mouseleave',  cancelPress);
    el.addEventListener('touchstart',  startPress,  { passive: true });
    el.addEventListener('touchend',    cancelPress);
    el.addEventListener('touchcancel', cancelPress);
  }

  // ── パネル操作 ────────────────────────────────────────────
  function openPanel() {
    document.getElementById('menuScreen')?.classList.remove('visible');
    syncPanel();
    document.getElementById('adminPanel').classList.add('visible');
  }
  function closePanel() {
    document.getElementById('adminPanel').classList.remove('visible');
  }

  function showToast(msg) {
    const t = document.getElementById('adminToast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  function setupPanel() {
    document.getElementById('adminCloseBtn').addEventListener('click', closePanel);

    // ステージジャンプボタンを動的生成
    const stageBtns = document.getElementById('adminStageBtns');
    STAGES.forEach((stg, idx) => {
      const btn = document.createElement('button');
      btn.className = 'admin-stage-btn';
      btn.textContent = `S${stg.stageNo}`;
      btn.dataset.idx = idx;
      btn.addEventListener('click', () => {
        // バトル中でなければステージを切り替え
        if (state.battleStarted && !state.cleared && !state.gameOver) {
          // バトル中は強制リセット
          state.cleared  = true;
          state.gameOver = false;
        }
        state.stageIndex = idx;
        state.unlockedStages = Math.max(state.unlockedStages, idx + 1);
        dom.resultScreen.classList.remove('visible');
        dom.gameOverScreen.classList.remove('visible');
        dom.stageStartScreen.classList.remove('visible');
        resetBattle();
        showStageStart();
        syncPanel();
        closePanel();
        showToast(`Stage ${stg.stageNo} にジャンプ！`);
      });
      stageBtns.appendChild(btn);
    });

    // ボスHP
    setupSlider('adminBossHp', 'adminBossHpVal',
      () => state.currentHp,
      () => getCurrentStage(state.stageIndex).maxHp,
      v => {
        state.currentHp = v;
        refreshUi();
        if (state.currentHp <= 0 && state.battleStarted && !state.cleared) handleBossDefeated();
      }
    );

    // プレイヤーHP
    setupSlider('adminPlayerHp', 'adminPlayerHpVal',
      () => state.player.hp,
      () => CONFIG.player.maxHp,
      v => { state.player.hp = v; refreshUi(); }
    );

    // ボス突進ダメージ（ステージのliveオーバーライド）
    setupSlider('adminChargeDmg', 'adminChargeDmgVal',
      () => getCurrentStage(state.stageIndex).chargeDamage,
      () => 200,
      v => { STAGES[state.stageIndex].chargeDamage = v; }
    );

    // ボス衝撃波ダメージ
    setupSlider('adminShockDmg', 'adminShockDmgVal',
      () => getCurrentStage(state.stageIndex).shockwaveDamage,
      () => 200,
      v => { STAGES[state.stageIndex].shockwaveDamage = v; }
    );

    // 攻撃間隔
    const atkEl  = document.getElementById('adminAtkInterval');
    const atkVal = document.getElementById('adminAtkIntervalVal');
    atkEl.addEventListener('input', () => {
      STAGES[state.stageIndex].attackIntervalMs = +atkEl.value;
      atkVal.textContent = atkEl.value + 'ms';
    });

    // 移動速度
    const spEl  = document.getElementById('adminMoveSpeed');
    const spVal = document.getElementById('adminMoveSpeedVal');
    spEl.addEventListener('input', () => {
      STAGES[state.stageIndex].moveSpeed = +spEl.value;
      spVal.textContent = (+spEl.value).toFixed(3);
    });

    // プレイヤー攻撃力（min/max）
    const pMinEl  = document.getElementById('adminPlayerMin');
    const pMinVal = document.getElementById('adminPlayerMinVal');
    const pMaxEl  = document.getElementById('adminPlayerMax');
    const pMaxVal = document.getElementById('adminPlayerMaxVal');
    pMinEl.addEventListener('input', () => {
      CONFIG.battle.minDamage = +pMinEl.value;
      pMinVal.textContent = pMinEl.value;
    });
    pMaxEl.addEventListener('input', () => {
      CONFIG.battle.maxDamage = +pMaxEl.value;
      pMaxVal.textContent = pMaxEl.value;
    });

    // アクションボタン
    document.getElementById('adminHealBtn').addEventListener('click', () => {
      state.player.hp = CONFIG.player.maxHp;
      refreshUi();
      showToast('💚 HP全回復！');
    });
    document.getElementById('adminKillBossBtn').addEventListener('click', () => {
      if (!state.battleStarted || state.cleared || state.gameOver) return;
      state.currentHp = 1;
      refreshUi();
      showToast('💀 ボスHP→1');
    });
    document.getElementById('adminMaxGaugeBtn').addEventListener('click', () => {
      state.specialGauge = 100;
      refreshUi();
      showToast('✨ ゲージMAX！');
    });
    document.getElementById('adminUnlockAllBtn').addEventListener('click', () => {
      state.unlockedStages = STAGES.length;
      syncPanel();
      showToast('🔓 全ステージ解放！');
    });
  }

  function setupSlider(sliderId, valId, getVal, getMax, setter) {
    const el  = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    el.addEventListener('input', () => {
      setter(+el.value);
      val.textContent = el.value;
    });
  }

  // パネルを開いたとき現在値に同期
  function syncPanel() {
    const s = getCurrentStage(state.stageIndex);

    // ステージボタンのcurrent表示
    document.querySelectorAll('.admin-stage-btn').forEach(btn => {
      btn.classList.toggle('current', +btn.dataset.idx === state.stageIndex);
    });

    const sync = (id, valId, val, max) => {
      const el = document.getElementById(id);
      const vl = document.getElementById(valId);
      el.max = max; el.value = val;
      vl.textContent = typeof val === 'number' && val % 1 !== 0 ? val.toFixed(3) : val;
    };

    sync('adminBossHp',      'adminBossHpVal',      state.currentHp,            s.maxHp);
    sync('adminPlayerHp',    'adminPlayerHpVal',    state.player.hp,            CONFIG.player.maxHp);
    sync('adminChargeDmg',   'adminChargeDmgVal',   s.chargeDamage,             200);
    sync('adminShockDmg',    'adminShockDmgVal',    s.shockwaveDamage,          200);
    sync('adminAtkInterval', 'adminAtkIntervalVal', s.attackIntervalMs,         8000);
    document.getElementById('adminAtkIntervalVal').textContent = s.attackIntervalMs + 'ms';
    sync('adminMoveSpeed',   'adminMoveSpeedVal',   s.moveSpeed,                0.08);
    document.getElementById('adminMoveSpeedVal').textContent = s.moveSpeed.toFixed(3);
    sync('adminPlayerMin',   'adminPlayerMinVal',   CONFIG.battle.minDamage,    500);
    sync('adminPlayerMax',   'adminPlayerMaxVal',   CONFIG.battle.maxDamage,    500);
  }

  // DOMContentLoaded後にマウント
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  // その他ボタンからも開けるようにグローバル公開
  window.__adminOpenPanel = openPanel;

})();
