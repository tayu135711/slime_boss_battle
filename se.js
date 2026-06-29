/**
 * se.js — サウンドエフェクトエンジン（Web Audio API）
 * 伝説のスーパーサイヤ人音楽家による全SE実装
 */

const SE = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;
  let initialized = false;

  // ── AudioContext初期化（ユーザー操作後に呼ぶ） ────────────
  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(ctx.destination);
      initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // ── 基本波形ユーティリティ ────────────────────────────────

  function createOsc(type, freq, startTime, duration, gainVal = 0.4, dest = masterGain) {
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    return { osc, gain };
  }

  function createNoise(startTime, duration, gainVal = 0.3, filterFreq = 2000, dest = masterGain) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // ── 個別SE ───────────────────────────────────────────────

  /**
   * 通常攻撃: パンチ/斬撃感のある「ズバッ」
   */
  function playAttack() {
    if (!ctx || !enabled) return;
    const t = now();

    // 短い金属的なシュッ
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(320, t);
    osc1.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    g1.gain.setValueAtTime(0.35, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc1.connect(g1); g1.connect(masterGain);
    osc1.start(t); osc1.stop(t + 0.15);

    // ノイズで「シュッ」感
    createNoise(t, 0.08, 0.18, 3500);
  }

  /**
   * クリティカルヒット: 派手な「ジャキン！」
   */
  function playAttackCritical() {
    if (!ctx || !enabled) return;
    const t = now();

    // 高めのメタリック音
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.25);

    // 追加の「キン！」
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1760, t + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    g2.gain.setValueAtTime(0.3, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(t + 0.02); osc2.stop(t + 0.20);

    // ノイズ
    createNoise(t, 0.1, 0.25, 4500);
  }

  /**
   * 必殺技（デフォルト/光): 「ズッシャアアア！」スーパーサイヤ人的爆発
   */
  function playSpecialDefault() {
    if (!ctx || !enabled) return;
    const t = now();

    // 低音爆発
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(60, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    g1.gain.setValueAtTime(0.6, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc1.connect(g1); g1.connect(masterGain);
    osc1.start(t); osc1.stop(t + 0.6);

    // 中音アタック「バン」
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(440, t);
    osc2.frequency.exponentialRampToValueAtTime(110, t + 0.3);
    g2.gain.setValueAtTime(0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(t); osc2.stop(t + 0.4);

    // 高音きらめき
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const dt = i * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760 + i * 440, t + dt);
      osc.frequency.exponentialRampToValueAtTime(880, t + dt + 0.3);
      g.gain.setValueAtTime(0.2, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.35);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + 0.4);
    }

    // ロングノイズ爆発
    createNoise(t, 0.5, 0.4, 1200);
  }

  /**
   * 必殺技Wave（衝撃波）: 「ドォォン！」海の大波
   */
  function playSpecialWave() {
    if (!ctx || !enabled) return;
    const t = now();

    // ドン！低音衝撃
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    g1.gain.setValueAtTime(0.7, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc1.connect(g1); g1.connect(masterGain);
    osc1.start(t); osc1.stop(t + 0.55);

    // 波のうねり（LFOで揺らす）
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(220, t);
    lfo.type = "sine"; lfo.frequency.value = 8;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain); lfoGain.connect(osc2.frequency);
    g2.gain.setValueAtTime(0.3, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(t); lfo.start(t); osc2.stop(t + 0.85); lfo.stop(t + 0.85);

    // 水しぶきノイズ
    createNoise(t, 0.6, 0.3, 800);
    createNoise(t + 0.1, 0.5, 0.2, 2500);
  }

  /**
   * 必殺技Ice（氷柱）: 「シャキーン！」クリスタル乱撃
   */
  function playSpecialIce() {
    if (!ctx || !enabled) return;
    const t = now();

    // 氷のクリスタル音（高音連続）
    const notes = [1047, 1319, 1568, 2093, 1760, 2637];
    notes.forEach((freq, i) => {
      const dt = i * 0.06;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + dt);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dt + 0.2);
      g.gain.setValueAtTime(0.25, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.25);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + 0.28);
    });

    // 低音ズズン
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.45);

    // 凍結ノイズ（高周波）
    createNoise(t, 0.5, 0.15, 5000);
  }

  /**
   * 必殺技Thunder（落雷）: 「バリバリバリッ！」天罰の雷
   */
  function playSpecialThunder() {
    if (!ctx || !enabled) return;
    const t = now();

    // ジジジッ（放電プレ音）
    createNoise(t, 0.08, 0.3, 4000);

    // バン！（雷撃アタック）
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.35);
    g.gain.setValueAtTime(0.8, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g); g.connect(masterGain);
    osc.start(t + 0.06); osc.stop(t + 0.5);

    // バリバリ（雷の爆発ノイズ）
    createNoise(t + 0.06, 0.4, 0.6, 1800);

    // 余韻のビリビリ
    for (let i = 0; i < 3; i++) {
      createNoise(t + 0.1 + i * 0.08, 0.06, 0.2, 3500 + i * 500);
    }
  }

  /**
   * ボス被ダメージ: スライムらしい「ぷにっ」
   */
  function playBossHit() {
    if (!ctx || !enabled) return;
    const t = now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.18);
  }

  /**
   * プレイヤー被弾: 「ダッ！」衝撃
   */
  function playPlayerHit() {
    if (!ctx || !enabled) return;
    const t = now();

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);

    createNoise(t, 0.12, 0.35, 1000);
  }

  /**
   * ボスチャージ開始: 「ガウッ」唸り
   */
  function playBossCharge() {
    if (!ctx || !enabled) return;
    const t = now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.6);
  }

  /**
   * ボス衝撃波: 「ドォォン！」地を這う波
   */
  function playBossShockwave() {
    if (!ctx || !enabled) return;
    const t = now();

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.75);

    createNoise(t, 0.5, 0.2, 600);
  }

  /**
   * フェーズ変化: 「ゴォォォ！！」ボスが激怒
   */
  function playPhaseChange() {
    if (!ctx || !enabled) return;
    const t = now();

    // 唸り上がる
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.linearRampToValueAtTime(220, t + 0.8);
    osc.frequency.exponentialRampToValueAtTime(40, t + 1.5);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 1.7);

    // 高音の叫び
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(330, t + 0.3);
    osc2.frequency.linearRampToValueAtTime(660, t + 0.9);
    osc2.frequency.exponentialRampToValueAtTime(220, t + 1.4);
    g2.gain.setValueAtTime(0.0, t + 0.3);
    g2.gain.linearRampToValueAtTime(0.3, t + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(t + 0.3); osc2.stop(t + 1.6);

    createNoise(t + 0.2, 1.0, 0.25, 700);
  }

  /**
   * ボス撃破ファンファーレ: 「ジャジャジャジャーン！」勝利
   */
  function playVictory() {
    if (!ctx || !enabled) return;
    const t = now();

    // ファンファーレ（上昇メロディ）
    const melody = [
      { freq: 523, dt: 0.0,  dur: 0.15 },  // ド
      { freq: 659, dt: 0.15, dur: 0.15 },  // ミ
      { freq: 784, dt: 0.30, dur: 0.15 },  // ソ
      { freq: 1047,dt: 0.45, dur: 0.5  },  // ド(高)
    ];
    melody.forEach(({ freq, dt, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.35, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + dur);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + dur + 0.05);
    });

    // 低音サポート
    const bass = [
      { freq: 130, dt: 0.0  },
      { freq: 164, dt: 0.15 },
      { freq: 196, dt: 0.30 },
      { freq: 261, dt: 0.45 },
    ];
    bass.forEach(({ freq, dt }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.25, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + 0.25);
    });

    // 爆発ノイズ
    createNoise(t + 0.45, 0.8, 0.3, 1500);

    // きらめき（高音連打）
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const dt = 0.5 + i * 0.12;
      osc.type = "sine";
      osc.frequency.value = 2093 + i * 200;
      g.gain.setValueAtTime(0.15, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + 0.25);
    }
  }

  /**
   * ゲームオーバー: 「ズゥゥゥン…」絶望
   */
  function playGameOver() {
    if (!ctx || !enabled) return;
    const t = now();

    // 下降する不吉な音
    const melody = [
      { freq: 440, dt: 0.0,  dur: 0.3 },
      { freq: 370, dt: 0.3,  dur: 0.3 },
      { freq: 311, dt: 0.6,  dur: 0.3 },
      { freq: 261, dt: 0.9,  dur: 0.8 },
    ];
    melody.forEach(({ freq, dt, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.3, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + dur);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + dur + 0.05);
    });

    // 重低音うなり
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 1.8);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 2.1);
  }

  /**
   * バトル開始: 「ジャン！」緊張感
   */
  function playBattleStart() {
    if (!ctx || !enabled) return;
    const t = now();

    const notes = [261, 329, 392];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.3, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.45);
    });

    createNoise(t + 0.24, 0.3, 0.2, 2000);
  }

  /**
   * ボタン/UI操作: 「ぽん」軽いクリック音
   */
  function playButton() {
    if (!ctx || !enabled) return;
    const t = now();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.12);
  }

  /**
   * タイトル開始: 「キラキラーン」ゲーム開幕
   */
  function playTitleStart() {
    if (!ctx || !enabled) return;
    const t = now();

    // ライザーシュー！
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.5);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.65);

    // ファンファーレ
    setTimeout(() => playVictory(), 500);
  }

  /**
   * ガチャ演出: 「ドドドドン！」期待感
   */
  function playGacha() {
    if (!ctx || !enabled) return;
    const t = now();

    // ドラム連打
    for (let i = 0; i < 5; i++) {
      const dt = i * 0.1;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120 + i * 20, t + dt);
      osc.frequency.exponentialRampToValueAtTime(40, t + dt + 0.08);
      g.gain.setValueAtTime(0.4, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.1);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + dt); osc.stop(t + dt + 0.12);

      createNoise(t + dt, 0.08, 0.3, 1500);
    }

    // フィナーレ「ドン！」
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t + 0.55);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.0);
    g.gain.setValueAtTime(0.6, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(g); g.connect(masterGain);
    osc.start(t + 0.55); osc.stop(t + 1.2);
    createNoise(t + 0.55, 0.6, 0.4, 1000);
  }

  /**
   * ゲージMAX: 「ピキーン！」必殺技発動可能
   */
  function playGaugeFull() {
    if (!ctx || !enabled) return;
    const t = now();
    const notes = [880, 1047, 1319, 1760];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.2, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.25);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.3);
    });
  }

  /**
   * 報酬獲得: 「チリーン✨」アイテムゲット
   */
  function playReward() {
    if (!ctx || !enabled) return;
    const t = now();
    const freqs = [1047, 1319, 1568, 2093, 1760];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.22, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.4);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.45);
    });
  }

  // ── 公開API ──────────────────────────────────────────────

  return {
    init,
    resume,
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },

    // 攻撃系
    attack:         playAttack,
    attackCritical: playAttackCritical,
    specialDefault: playSpecialDefault,
    specialWave:    playSpecialWave,
    specialIce:     playSpecialIce,
    specialThunder: playSpecialThunder,

    // 被弾系
    bossHit:        playBossHit,
    playerHit:      playPlayerHit,

    // ボスAI
    bossCharge:     playBossCharge,
    bossShockwave:  playBossShockwave,
    phaseChange:    playPhaseChange,

    // ゲームフロー
    victory:        playVictory,
    gameOver:       playGameOver,
    battleStart:    playBattleStart,
    titleStart:     playTitleStart,
    button:         playButton,
    gacha:          playGacha,
    gaugeFull:      playGaugeFull,
    reward:         playReward,

    // ── 広場専用SE（IIFEスコープ内でctx等にアクセスできるよう移動） ──

    /** 広場に入る: 「ほわーん」のどかなチャイム */
    plazaEnter() {
      if (!ctx || !enabled) return;
      const t = now();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0, t + i * 0.15);
        g.gain.linearRampToValueAtTime(0.18, t + i * 0.15 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.7);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.15); osc.stop(t + i * 0.15 + 0.8);
      });
    },

    /** NPCに話しかける: 「ぽろん」 */
    npcTalk() {
      if (!ctx || !enabled) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.12);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.2);
    },

    /** ダイアログ次へ: 「ぽっ」 */
    dialogNext() {
      if (!ctx || !enabled) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.12);
    },

    /** ダイアログ閉じる: 「ぱたん」 */
    dialogClose() {
      if (!ctx || !enabled) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(330, t + 0.1);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.16);
    },

    /** 釣り開始: 「ポチャン」 */
    fishingCast() {
      if (!ctx || !enabled) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.22);
      createNoise(t, 0.12, 0.15, 1200);
    },

    /** 釣りアタリ: 「ピピッ！」 */
    fishingBite() {
      if (!ctx || !enabled) return;
      const t = now();
      [1047, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.25, t + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.1);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.12);
      });
    },

    /** 釣り成功: 「ジャバン！チリーン✨」 */
    fishingSuccess() {
      if (!ctx || !enabled) return;
      const t = now();
      createNoise(t, 0.25, 0.4, 900);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.4);
      [1047, 1319, 1568].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const gg = ctx.createGain();
        const dt = 0.3 + i * 0.07;
        o.type = "triangle";
        o.frequency.value = freq;
        gg.gain.setValueAtTime(0.2, t + dt);
        gg.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.3);
        o.connect(gg); gg.connect(masterGain);
        o.start(t + dt); o.stop(t + dt + 0.35);
      });
    },

    /** 釣り失敗: 「ぽちゃん…」 */
    fishingMiss() {
      if (!ctx || !enabled) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.3);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.4);
      createNoise(t, 0.15, 0.1, 800);
    },

    /** 花を摘む: 「ふわっ」 */
    flowerPick() {
      if (!ctx || !enabled) return;
      const t = now();
      [784, 1047, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0, t + i * 0.06);
        g.gain.linearRampToValueAtTime(0.17, t + i * 0.06 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.4);
      });
    },

    /** クエスト受注: 「ジャン！」 */
    questAccept() {
      if (!ctx || !enabled) return;
      const t = now();
      [392, 523, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.2, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.35);
      });
    },

    /** クエスト達成: 「チャラーン！」 */
    questComplete() {
      if (!ctx || !enabled) return;
      const t = now();
      const melody = [523, 659, 784, 1047];
      melody.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.28, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.45);
      });
      createNoise(t + 0.35, 0.4, 0.15, 2000);
    },

    /** アイテム獲得: 「キラン」 */
    itemGet() {
      if (!ctx || !enabled) return;
      const t = now();
      [1319, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.18, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.3);
        osc.connect(g); g.connect(masterGain);
        osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.35);
      });
    },
  };
})();
