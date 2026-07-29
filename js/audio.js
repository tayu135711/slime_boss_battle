/* =========================================================
   audio.js — 効果音 & BGM (2026/07/26 追加)
   依存: なし (どのファイルよりも先に読み込んでOK)

   効果音はWeb Audio APIでその場で合成する簡易チップチューン風SEにしている。
   外部の音声ファイルを用意しなくても鳴らせるので、素材探しに依存しない。

   BGMは別途ユーザーが用意する音源ファイルを鳴らすための土台。
   audio/ フォルダなどにmp3等を置いて、playBgm('audio/island.mp3') のように呼べば良い。
========================================================= */

let audioCtx   = null;
let sfxVolume  = 0.5;
let bgmVolume  = 0.4;
let audioMuted = false;

function ensureAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// 初回のユーザー操作でAudioContextを起動する (iOS Safariなどはユーザー操作なしで音を鳴らせないため)
['click', 'touchstart', 'keydown'].forEach(evt => {
  window.addEventListener(evt, () => { ensureAudioCtx(); }, { once: true, passive: true });
});

/**
 * 単発の音を鳴らす
 * @param {number} freq     周波数(Hz)
 * @param {number} duration 長さ(秒)
 * @param {string} type     波形 'sine'|'square'|'triangle'|'sawtooth'
 * @param {number} startGain 音量(0〜1程度)
 * @param {number} delay    再生開始までの遅延(秒)
 */
function beep(freq, duration, type = 'square', startGain = 0.2, delay = 0) {
  if (audioMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t0   = ctx.currentTime + delay;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, startGain * sfxVolume), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** 周波数がなめらかに変化する音 (「にげる」等のスイープ音に使う) */
function sweep(freqFrom, freqTo, duration, type = 'square', startGain = 0.2, delay = 0) {
  if (audioMuted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t0   = ctx.currentTime + delay;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, startGain * sfxVolume), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/** 効果音まとめ。SFX.hit() のように呼ぶ */
const SFX = {
  cursor()      { beep(440, 0.035, 'square', 0.09); },
  menu()        { beep(600, 0.05,  'square', 0.14); },
  cancel()      { beep(320, 0.06,  'square', 0.12); },

  hit()         { beep(150, 0.09, 'square', 0.22); },
  hitBig()      { sweep(280, 90, 0.18, 'square', 0.28); },
  defend()      { beep(220, 0.1, 'triangle', 0.18); },
  heal()        { [523, 659, 784].forEach((f, i) => beep(f, 0.14, 'sine', 0.16, i * 0.07)); },

  captureThrow(){ sweep(260, 700, 0.25, 'sine', 0.15); },
  captureSuccess() { [392, 494, 659, 784].forEach((f, i) => beep(f, 0.12, 'triangle', 0.2, i * 0.09)); },
  captureFail() { sweep(320, 120, 0.28, 'sawtooth', 0.2); },

  levelUp()     { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.13, 'square', 0.2, i * 0.08)); },
  skillReady()  { sweep(220, 880, 0.32, 'sawtooth', 0.16); },
  evolve()      { [330, 415, 523, 659, 880].forEach((f, i) => beep(f, 0.15, 'triangle', 0.2, i * 0.09)); },

  coin()        { beep(988, 0.06, 'square', 0.16); beep(1318, 0.08, 'square', 0.14, 0.05); },
  chest()       { [523, 784, 1047].forEach((f, i) => beep(f, 0.12, 'triangle', 0.18, i * 0.08)); },
  gacha()       { [300, 500, 700, 900, 1200].forEach((f, i) => beep(f, 0.08, 'square', 0.13, i * 0.05)); },
  save()        { beep(700, 0.05, 'sine', 0.14); beep(900, 0.08, 'sine', 0.14, 0.06); },

  bossAppear()  { [110, 110, 146, 110].forEach((f, i) => beep(f, 0.22, 'sawtooth', 0.24, i * 0.24)); },
  victory()     { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.16, 'square', 0.18, i * 0.1)); },
  wipe()        { [400, 340, 280, 220].forEach((f, i) => beep(f, 0.22, 'sawtooth', 0.18, i * 0.18)); },
  flee()        { sweep(440, 900, 0.2, 'sine', 0.14); },
};

/* ---------------------------------------------------------
   BGM (音源ファイルはユーザー側で用意する想定)
--------------------------------------------------------- */
function getBgmEl() {
  return document.getElementById('bgm-player');
}

/**
 * BGMを再生する。
 * @param {string} src   - 音源ファイルのパス (例: 'audio/island.mp3')。省略時は現在の曲を再開するだけ。
 * @param {boolean} loop - ループ再生するか (既定true。ステージクリア曲など1回だけ鳴らす場合はfalseを渡す)
 */
function playBgm(src, loop = true) {
  const el = getBgmEl();
  if (!el) return;
  if (src && el.getAttribute('data-src') !== src) {
    el.src = src;
    el.setAttribute('data-src', src);
  }
  el.loop = loop;
  el.volume = audioMuted ? 0 : bgmVolume;
  el.currentTime = 0;
  el.play().catch(() => { /* ユーザー操作前は再生をブロックされることがあるので無視 */ });
}

function stopBgm() {
  const el = getBgmEl();
  if (el) el.pause();
}

/** ミュート状態を切り替える。効果音・BGM両方に反映される */
function setAudioMuted(v) {
  audioMuted = v;
  const el = getBgmEl();
  if (el) el.volume = audioMuted ? 0 : bgmVolume;
}

/* ミュートボタン */
const btnMuteToggle = document.getElementById('btn-mute-toggle');
if (btnMuteToggle) {
  btnMuteToggle.addEventListener('click', () => {
    setAudioMuted(!audioMuted);
    btnMuteToggle.textContent = audioMuted ? '🔇' : '🔊';
    if (!audioMuted) SFX.cursor();
  });
}
