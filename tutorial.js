/**
 * tutorial.js — ハンズオン・チュートリアル
 * ------------------------------------------------------------
 * 文章で説明するだけでなく、実際にStage1のバトルを操作させながら
 * 「移動 → 攻撃 → 回避 → スキル(所持時) → 必殺技 → ボスを倒す」を
 * 順番に体験してもらうための仕組み。
 *
 * 既存のゲームロジック(battle.js / game.js / ui.js等)は一切変更せず、
 * state を一定間隔でポーリングして進行状況を判定する「観察者」として
 * 独立して動作する（他コードへの影響・破壊リスクを避けるため）。
 */

const Tutorial = {
  SEEN_KEY: "slime_tutorial_seen_v1",

  active: false,
  stepIdx: 0,
  steps: [],
  _baseline: {},
  _stepStartedAt: 0,
  _pollTimer: null,
  _restarting: false,
  _cardEl: null,
  _highlightEl: null,
  _toastTimer: null,

  // ── 初期化：広場表示中だけボタンを出す／初回は誘導トーストを出す ──
  init() {
    const bindBtn = () => {
      const btn = document.getElementById("tutorialBtn");
      if (btn && !btn._bound) {
        btn._bound = true;
        btn.addEventListener("click", () => {
          document.getElementById("tutorialToast")?.remove();
          this.start();
        });
      }
    };
    bindBtn();

    let toastShown = false;
    this._watchTimer = setInterval(() => {
      bindBtn();
      const btn = document.getElementById("tutorialBtn");
      if (typeof dom === "undefined" || !dom.homePlazaScreen) return;
      const plazaVisible = dom.homePlazaScreen.classList.contains("visible");
      if (btn) btn.style.display = plazaVisible && !this.active ? "flex" : "none";

      if (
        plazaVisible && !this.active && !toastShown &&
        !localStorage.getItem(this.SEEN_KEY) &&
        !dom.npcDialog?.classList.contains("visible")
      ) {
        toastShown = true;
        this._showFirstTimeToast();
      }
    }, 400);
  },

  _showFirstTimeToast() {
    if (document.getElementById("tutorialToast")) return;
    const toast = document.createElement("div");
    toast.id = "tutorialToast";
    toast.innerHTML = `
      <div class="tt-body">
        <div class="tt-icon">🎓</div>
        <div class="tt-text">はじめての方はチュートリアルがおすすめ！<br>実際に操作しながら遊び方を覚えよう。</div>
      </div>
      <div class="tt-btns">
        <button id="tutorialToastStart">はじめる</button>
        <button id="tutorialToastLater">あとで</button>
      </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    document.getElementById("tutorialToastStart").addEventListener("click", () => {
      toast.remove();
      this.start();
    });
    document.getElementById("tutorialToastLater").addEventListener("click", () => {
      localStorage.setItem(this.SEEN_KEY, "1");
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    });
  },

  // ── チュートリアル開始 ──────────────────────────────────────
  start() {
    if (this.active) return;
    if (typeof dom === "undefined" || !dom.homePlazaScreen) return;
    localStorage.setItem(this.SEEN_KEY, "1");

    this.active = true;
    this._restarting = false;

    const hasSkill = !!(state.equippedCostume && state.equippedCostume.skillId);

    // mode: "action"(既定) = state を監視し、実際に操作するまで進まない
    //       "info"          = 解説のみ。「つぎへ」ボタンで自分のペースで進む
    this.steps = [
      {
        key: "intro", mode: "info",
        title: "画面の見方",
        text: "上の赤いバーが【ボスのHP】、左下の緑のバーが【キミ(スライム)のHP】だよ。\nボスのHPを0にすれば勝利！ キミのHPが0になるとやられてしまうから気をつけてね。",
        highlight: () => dom.bossHpArea,
      },
      {
        key: "move",
        title: "うごいてみよう",
        text: "画面左下の十字キー／ジョイスティック（PCならWASDキー）でスライムを動かそう！\n移動しながら戦うと、ボスの攻撃をかわしやすくなるよ。",
        highlight: () => document.getElementById("joystickBase") || document.querySelector(".dpad") || dom.controllerPanel,
        onEnter: () => { this._baseline.pos = { x: state.player.x, z: state.player.z }; },
        check: () => {
          const p = this._baseline.pos;
          return !!p && Math.hypot(state.player.x - p.x, state.player.z - p.z) > 1.0;
        },
      },
      {
        key: "attack",
        title: "こうげきしよう",
        text: "ボスに近づいて「こうげき」ボタン（またはSpace／Enterキー）で攻撃してみよう！\nたまに出る⚡クリティカルは通常より大きなダメージになるよ。",
        highlight: () => dom.attackBtn,
        onEnter: () => { this._baseline.attackCount = state.attackCount; },
        check: () => state.attackCount > (this._baseline.attackCount ?? 0),
      },
      {
        key: "break", mode: "info",
        title: "ブレイクゲージって？",
        text: "こうげきを当てると、ボスの下にある黄色い「ブレイクゲージ」も減っていくよ。\nこのゲージが0になるとボスがひるんで、大ダメージを狙えるチャンスタイムになるんだ！",
        highlight: () => document.getElementById("bossBreakBar") || dom.hpBarInner,
      },
      {
        key: "telegraph", mode: "info",
        title: "ボスの攻撃予兆に注目！",
        text: "ボスは攻撃の前に体の色を変えて教えてくれるよ。\n色が変わったら要注意のサイン。突進・防御・地雷・弾幕・衝撃波など、いろんな攻撃パターンがあるから、画面上部のメッセージもよく見てみてね。",
        highlight: () => dom.statusLine,
      },
      {
        key: "dodge",
        title: "かいひしよう",
        text: "「かいひ」ボタン（Shift／Eキー）を押すと、一瞬だけ無敵になって攻撃をすり抜けられるよ。\nボスの色が変わって予兆が出たタイミングで使うのがコツ！（練習なので今すぐ押してもOK）",
        highlight: () => dom.dodgeBtn,
        onEnter: () => { this._baseline.dodgeAt = this._stepStartedAt; },
        check: () => state.dodge.lastUsedAt >= (this._baseline.dodgeAt ?? Infinity),
      },
      hasSkill ? {
        key: "skill",
        title: "スキルをつかおう",
        text: "コスチューム専用の「スキル」ボタン（またはQキー）を押してみよう！\nクールダウンが短めで、連発しやすい技だよ。",
        highlight: () => dom.specialBtn,
        onEnter: () => { this._baseline.skillAt = this._stepStartedAt; },
        check: () => state.lastSkillAt >= (this._baseline.skillAt ?? Infinity),
      } : {
        key: "skill_info", mode: "info",
        title: "スキルについて",
        text: "★3のコスチュームを手に入れると、専用の「スキル」ボタンが使えるようになるよ。\n広場の🎰ガチャ処でコスチュームを手に入れたら、ぜひ試してみてね！",
        highlight: () => null,
      },
      {
        key: "ultimate",
        title: "ひっさつわざをつかおう",
        text: "「ひっさつわざ」ボタン（またはFキー）で大技を発動！\nクールダウンは30秒と長めだけど、その分ダメージは抜群。ボスが防御中でもしっかりダメージが通るよ。",
        highlight: () => dom.ultimateBtn,
        onEnter: () => { this._baseline.ultimateAt = this._stepStartedAt; },
        check: () => state.lastUltimateAt >= (this._baseline.ultimateAt ?? Infinity),
      },
      {
        key: "hp_warning", mode: "info",
        title: "HPと『やられた』について",
        text: "キミのHPが0になると『やられた』状態になるよ。チュートリアル中はすぐにやり直せるから安心してね。\n回避のタイミングをうまく使って、なるべくダメージを受けないようにしよう！",
        highlight: () => dom.playerHpArea,
      },
      {
        key: "phase", mode: "info",
        title: "フェーズが上がると激しくなる！",
        text: "ボスはHPが減るほど『フェーズ』が上がり、攻撃の頻度や激しさが増していくよ。\nHPバーの減り具合を見ながら、気を引き締めて挑もう！",
        highlight: () => dom.hpBarInner,
      },
      {
        key: "finish",
        title: "ボスをたおそう！",
        text: "ここまで覚えた操作を組み合わせて、このままボスを倒しきってみよう！\nやられても自動でリトライできるから、思いきってチャレンジしてね。",
        highlight: () => null,
        check: () => state.cleared === true,
      },
    ].filter(Boolean);

    // 表示用の連番を付与（"STEP n/合計"）
    this.steps.forEach((s, i) => {
      s.displayTitle = `STEP ${i + 1}/${this.steps.length}　${s.title}`;
    });

    this._launchBattle();
  },

  _launchBattle() {
    state.stageIndex = 0;
    resetBattle();
    startStage();
    this._enterStep(0);
    this._startPolling();
  },

  _enterStep(idx) {
    this.stepIdx = idx;
    this._stepStartedAt = Date.now();
    const step = this.steps[idx];
    if (!step) return;
    step.onEnter?.();
    this._render();
  },

  _startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this._tick(), 150);
  },

  _stopPolling() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  _tick() {
    if (!this.active) return;

    // やられた場合は少し待って同じステップからリトライ
    if (state.gameOver && !this._restarting) {
      this._restarting = true;
      this._toast("やられてしまった…もう一度チャレンジしよう！");
      const stepAtFail = this.stepIdx;
      setTimeout(() => {
        if (!this.active) return;
        resetBattle();
        startStage();
        this._enterStep(stepAtFail);
        this._restarting = false;
      }, 1600);
      return;
    }

    // 広場に戻る・リセットされる等でバトルを離脱したら中断
    if (!this._restarting && !state.battleStarted && !state.cleared) {
      this.cancel();
      return;
    }

    const step = this.steps[this.stepIdx];
    if (!step) return;
    // info(解説のみ)ステップは「つぎへ」ボタンで自分から進めるので、ここでは待機する
    if (step.mode === "info") return;
    if (step.check && step.check()) this._completeStep(true);
  },

  // ステップ完了処理（action成功時／infoの「つぎへ」共通）
  _completeStep(showToast) {
    if (showToast) this._toast("✅ できた！");
    if (this.stepIdx >= this.steps.length - 1) {
      this._finish();
    } else {
      const nextIdx = this.stepIdx + 1;
      setTimeout(() => { if (this.active) this._enterStep(nextIdx); }, showToast ? 700 : 120);
    }
  },

  _finish() {
    this.active = false;
    this._stopPolling();
    this._removeHighlight();
    this._toast("🎉 チュートリアル修了！お疲れさま！");
    setTimeout(() => this._removeCard(), 1200);
    // これ以降は通常のクリア処理(handleBossDefeated → 結果画面)がそのまま進む
  },

  cancel() {
    if (!this.active) return;
    this.active = false;
    this._stopPolling();
    this._removeHighlight();
    this._removeCard();
  },

  skip() {
    const wasActive = this.active;
    this.cancel();
    if (wasActive && !state.cleared) {
      resetBattle();
      showHomePlaza();
    }
  },

  // ── 表示まわり ───────────────────────────────────────────
  _render() {
    const step = this.steps[this.stepIdx];
    if (!step) return;
    if (!this._cardEl) {
      this._cardEl = document.createElement("div");
      this._cardEl.id = "tutorialCard";
      document.body.appendChild(this._cardEl);
    }
    const dots = this.steps.map((s, i) =>
      `<span class="tt-dot ${i < this.stepIdx ? "done" : i === this.stepIdx ? "cur" : ""}"></span>`
    ).join("");
    const isInfo = step.mode === "info";
    this._cardEl.innerHTML = `
      <div class="tc-dots">${dots}</div>
      <div class="tc-title">${step.displayTitle || step.title}</div>
      <div class="tc-text">${step.text.replace(/\n/g, "<br>")}</div>
      <div class="tc-btnrow">
        ${isInfo ? `<button id="tutorialNextBtn" class="tc-next">つぎへ ▶</button>` : ``}
        <button id="tutorialSkipBtn" class="tc-skip">チュートリアルを終了</button>
      </div>
    `;
    requestAnimationFrame(() => this._cardEl.classList.add("show"));
    const skipBtn = document.getElementById("tutorialSkipBtn");
    if (skipBtn) skipBtn.onclick = () => this.skip();
    const nextBtn = document.getElementById("tutorialNextBtn");
    if (nextBtn) nextBtn.onclick = () => this._completeStep(false);

    this._removeHighlight();
    const target = step.highlight?.();
    if (target) {
      target.classList.add("tutorial-glow");
      this._highlightEl = target;
    }
  },

  _removeCard() {
    if (this._cardEl) { this._cardEl.remove(); this._cardEl = null; }
  },

  _removeHighlight() {
    if (this._highlightEl) { this._highlightEl.classList.remove("tutorial-glow"); this._highlightEl = null; }
  },

  _toast(msg) {
    let el = document.getElementById("tutorialStepToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "tutorialStepToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove("show");
    void el.offsetWidth; // reflow して再アニメーションさせる
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Tutorial.init());
} else {
  Tutorial.init();
}
