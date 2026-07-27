/**
 * bgm.js — BGM（背景音楽）マネージャー
 * se.js（効果音）とは別に、シーンごとのループBGM・ジングルを管理する。
 * SEがWeb Audio APIでのリアルタイム合成なのに対し、BGMは実音源ファイル(mp3)を
 * <audio>要素で再生する方式（曲そのものは合成が難しいため）。
 */
const BGM = (() => {
  // key: シーン名 → 音源ファイルとループ有無
  const TRACKS = {
    title:            { src: "audio/bgm/title.mp3",            loop: true  },
    plaza:            { src: "audio/bgm/plaza.mp3",            loop: true  },
    battle:           { src: "audio/bgm/battle.mp3",           loop: true  },
    battle_finalboss: { src: "audio/bgm/battle_finalboss.mp3", loop: true  }, // ★古王スライム系の最終ボス専用
    ocean:            { src: "audio/bgm/ocean.mp3",            loop: true  }, // ★釣り場(海)専用
    victory:          { src: "audio/bgm/victory.mp3",          loop: false }, // ジングル（1回きり）
    gacha:            { src: "audio/bgm/gacha.mp3",            loop: false }, // ジングル（1回きり）
  };

  const MASTER_VOLUME = 0.5;
  const FADE_MS = 700;

  let enabled = true;
  let current = null;    // 現在再生中（にすべき）ループBGMのキー
  let currentEl = null;  // 現在再生中のループBGM<audio>要素
  const pool = {};       // key → <audio>要素のキャッシュ（毎回newしない）
  let fadeTimer = null;

  function getEl(key) {
    if (pool[key]) return pool[key];
    const t = TRACKS[key];
    if (!t) return null;
    const el = new Audio(t.src);
    el.loop = t.loop;
    el.preload = "auto";
    el.volume = 0;
    pool[key] = el;
    return el;
  }

  function fadeTo(el, targetVol, ms, onDone) {
    if (!el) { if (onDone) onDone(); return; }
    const steps = 16;
    const stepMs = Math.max(16, ms / steps);
    const startVol = el.volume;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * (i / steps)));
      if (i >= steps) {
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, stepMs);
  }

  // ── ループBGMを再生する（同じ曲がすでに鳴っていれば何もしない） ──
  function play(key) {
    if (!TRACKS[key]) return;
    current = key; // ミュート中でも「次に鳴らすべき曲」として覚えておく
    if (!enabled) return;
    if (currentEl && pool[key] === currentEl && !currentEl.paused) return;

    const nextEl = getEl(key);
    if (!nextEl) return;
    const prevEl = currentEl;
    currentEl = nextEl;

    if (prevEl && prevEl !== nextEl) {
      fadeTo(prevEl, 0, FADE_MS, () => { prevEl.pause(); prevEl.currentTime = 0; });
    }
    if (nextEl.paused) {
      nextEl.currentTime = 0;
      nextEl.volume = 0;
      nextEl.play().catch(() => {}); // 自動再生ブロック等は無視（次のユーザー操作で再試行される）
    }
    fadeTo(nextEl, MASTER_VOLUME, FADE_MS);
  }

  // ── 現在のループBGMをフェードアウトして止める ──
  function stop() {
    if (currentEl) {
      const el = currentEl;
      fadeTo(el, 0, FADE_MS, () => { el.pause(); el.currentTime = 0; });
    }
    current = null;
    currentEl = null;
  }

  // ── ジングル（勝利・ガチャ等、1回きりの曲）を再生する ──
  // 再生中はループBGMの音量を一時的に下げ（ダッキング）、終わったら元に戻す。
  function playJingle(key) {
    if (!enabled || !TRACKS[key]) return;
    const el = getEl(key);
    if (!el) return;
    el.currentTime = 0;
    el.volume = MASTER_VOLUME;
    el.play().catch(() => {});

    const loopEl = currentEl;
    if (loopEl) fadeTo(loopEl, MASTER_VOLUME * 0.15, 250);
    el.addEventListener("ended", () => {
      if (loopEl) fadeTo(loopEl, MASTER_VOLUME, 400);
    }, { once: true });
  }

  function setEnabled(v) {
    enabled = v;
    if (!enabled) {
      Object.values(pool).forEach(el => el.pause());
    } else if (current) {
      play(current); // ミュート解除時、鳴らすべきだった曲を再開
    }
  }
  function isEnabled() { return enabled; }

  return { play, stop, playJingle, setEnabled, isEnabled };
})();
