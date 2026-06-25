/**
 * costume_art.js — コスチュームごとのSVGイラスト定義
 * getSlimeSVG(costumeId, size) → SVG文字列を返す
 */

// ベーススライム描画ヘルパー
function _slimeSVG({ id, body, shadow, eyes, mouth, extras = "", badge = "", size = 80 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg_${id}" cx="50%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </radialGradient>
    <radialGradient id="body_${id}" cx="38%" cy="32%" r="60%">
      <stop offset="0%" stop-color="${body.light}"/>
      <stop offset="60%" stop-color="${body.mid}"/>
      <stop offset="100%" stop-color="${body.dark}"/>
    </radialGradient>
    <radialGradient id="shine_${id}" cx="35%" cy="28%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.7)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="glow_${id}">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 影 -->
  <ellipse cx="50" cy="90" rx="28" ry="6" fill="${shadow}" opacity="0.35"/>

  <!-- ボディ -->
  <ellipse cx="50" cy="58" rx="34" ry="30" fill="url(#body_${id})"/>
  <!-- ぷるぷる感の上部 -->
  <path d="M 28 50 Q 35 24 50 22 Q 65 24 72 50" fill="url(#body_${id})" opacity="0.8"/>
  <!-- ハイライト -->
  <ellipse cx="50" cy="52" rx="34" ry="30" fill="url(#shine_${id})" opacity="0.5"/>

  ${extras}

  <!-- 目 -->
  ${eyes}

  <!-- 口 -->
  ${mouth}

  <!-- バッジ（星など） -->
  ${badge}
</svg>`;
}

// 目パーツヘルパー
function _eyes(lx, ly, rx, ry, r = 7, pupilColor = "#1a0a2e") {
  return `
  <ellipse cx="${lx}" cy="${ly}" rx="${r}" ry="${r * 1.1}" fill="white"/>
  <ellipse cx="${rx}" cy="${ry}" rx="${r}" ry="${r * 1.1}" fill="white"/>
  <circle cx="${lx + 1}" cy="${ly + 1}" r="${r * 0.55}" fill="${pupilColor}"/>
  <circle cx="${rx + 1}" cy="${ry + 1}" r="${r * 0.55}" fill="${pupilColor}"/>
  <circle cx="${lx - 2}" cy="${ly - 2}" r="${r * 0.18}" fill="white"/>
  <circle cx="${rx - 2}" cy="${ry - 2}" r="${r * 0.18}" fill="white"/>`;
}

// 口パーツヘルパー（笑顔）
function _smile(x, y, w = 14, color = "#2d0a3e") {
  return `<path d="M ${x - w/2} ${y} Q ${x} ${y + 7} ${x + w/2} ${y}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
}

// 星バッジヘルパー
function _stars(count, color = "#ffd700") {
  const starPositions = [
    [[50, 10]],
    [[42, 10], [58, 10]],
    [[35, 10], [50, 6], [65, 10]],
  ];
  const positions = starPositions[count - 1] || starPositions[0];
  return positions.map(([x, y]) =>
    `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="10" fill="${color}" filter="url(#glow_tmp)">${"★"}</text>`
  ).join("");
}

// ============================================================
// 各コスチュームのSVG定義
// ============================================================

const COSTUME_SVG = {

  // ── 星1 ──────────────────────────────────────────────────

  c01: (size) => _slimeSVG({ id: "c01", size,
    body:   { light: "#a7f3d0", mid: "#6ee7b7", dark: "#34d399" },
    shadow: "#34d399",
    eyes:   _eyes(38, 50, 62, 50),
    mouth:  _smile(50, 62),
    badge:  _stars(1, "#aaa"),
  }),

  c02: (size) => _slimeSVG({ id: "c02", size,
    body:   { light: "#86efac", mid: "#5adb5a", dark: "#22c55e" },
    shadow: "#16a34a",
    eyes:   _eyes(38, 50, 62, 50),
    mouth:  _smile(50, 62),
    extras: `<ellipse cx="50" cy="26" rx="6" ry="8" fill="#4ade80" opacity="0.7"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  c03: (size) => _slimeSVG({ id: "c03", size,
    body:   { light: "#fef08a", mid: "#ffe066", dark: "#eab308" },
    shadow: "#ca8a04",
    eyes:   _eyes(38, 50, 62, 50, 7, "#3b2200"),
    mouth:  _smile(50, 62, 16),
    extras: `
      <!-- ほっぺ -->
      <ellipse cx="32" cy="60" rx="6" ry="4" fill="#f97316" opacity="0.4"/>
      <ellipse cx="68" cy="60" rx="6" ry="4" fill="#f97316" opacity="0.4"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  c04: (size) => _slimeSVG({ id: "c04", size,
    body:   { light: "#fca5a5", mid: "#ff6b6b", dark: "#ef4444" },
    shadow: "#dc2626",
    eyes:   _eyes(37, 48, 63, 48, 8, "#1a0000"),
    mouth:  `<path d="M 36 63 Q 50 75 64 63" stroke="#7f1d1d" stroke-width="2.5" fill="#fca5a5" stroke-linecap="round"/>`,
    extras: `
      <!-- 怒りマーク -->
      <line x1="32" y1="42" x2="42" y2="38" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
      <line x1="68" y1="42" x2="58" y2="38" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  // ── 星2 ──────────────────────────────────────────────────

  c11: (size) => _slimeSVG({ id: "c11", size,
    body:   { light: "#e9d5ff", mid: "#c084fc", dark: "#a855f7" },
    shadow: "#7e22ce",
    eyes:   _eyes(38, 49, 62, 49, 7, "#2e1065"),
    mouth:  _smile(50, 62),
    extras: `
      <!-- 魔法使い帽子 -->
      <polygon points="50,4 38,30 62,30" fill="#581c87" stroke="#c084fc" stroke-width="1.5"/>
      <rect x="34" y="28" width="32" height="5" rx="2" fill="#7e22ce" stroke="#c084fc" stroke-width="1"/>
      <!-- 星のエフェクト -->
      <text x="72" y="35" font-size="9" fill="#ffd700">✦</text>
      <text x="22" y="42" font-size="7" fill="#a78bfa">✦</text>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  c12: (size) => _slimeSVG({ id: "c12", size,
    body:   { light: "#cbd5e1", mid: "#94a3b8", dark: "#64748b" },
    shadow: "#475569",
    eyes:   _eyes(38, 50, 62, 50, 7, "#0f172a"),
    mouth:  `<path d="M 40 63 L 60 63" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>`,
    extras: `
      <!-- 兜 -->
      <path d="M 22 46 Q 24 20 50 18 Q 76 20 78 46" fill="#475569" stroke="#94a3b8" stroke-width="1.5"/>
      <path d="M 22 46 Q 24 28 50 26 Q 76 28 78 46" fill="#64748b"/>
      <!-- バイザー -->
      <rect x="34" y="38" width="32" height="8" rx="3" fill="#0f172a" opacity="0.7"/>
      <!-- 剣（右に持ってる感じ） -->
      <rect x="76" y="30" width="4" height="30" rx="1" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
      <rect x="70" y="46" width="16" height="3" rx="1" fill="#fbbf24"/>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  c13: (size) => _slimeSVG({ id: "c13", size,
    body:   { light: "#bbf7d0", mid: "#4ade80", dark: "#22c55e" },
    shadow: "#15803d",
    eyes:   _eyes(38, 50, 62, 50, 7, "#14532d"),
    mouth:  _smile(50, 63, 14, "#14532d"),
    extras: `
      <!-- 葉っぱの冠 -->
      <ellipse cx="35" cy="26" rx="10" ry="6" fill="#16a34a" transform="rotate(-30 35 26)"/>
      <ellipse cx="50" cy="20" rx="10" ry="6" fill="#22c55e" transform="rotate(0 50 20)"/>
      <ellipse cx="65" cy="26" rx="10" ry="6" fill="#16a34a" transform="rotate(30 65 26)"/>
      <!-- 花 -->
      <circle cx="50" cy="20" r="4" fill="#fde047"/>
      <!-- きのこ -->
      <ellipse cx="25" cy="68" rx="7" ry="4" fill="#f97316" opacity="0.7"/>
      <rect x="23" y="67" width="4" height="7" rx="1" fill="#fef3c7" opacity="0.8"/>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  // ── 星3 ──────────────────────────────────────────────────

  c21: (size) => {
    const svg = _slimeSVG({ id: "c21", size,
      body:   { light: "#bae6fd", mid: "#38bdf8", dark: "#0284c7" },
      shadow: "#0369a1",
      eyes:   _eyes(37, 48, 63, 48, 8, "#082f49"),
      mouth:  _smile(50, 63, 18, "#082f49"),
      extras: `
        <!-- 王冠 -->
        <polygon points="28,36 35,20 50,30 65,20 72,36 28,36" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
        <circle cx="50" cy="20" r="4" fill="#ef4444"/>
        <circle cx="35" cy="22" r="3" fill="#a855f7"/>
        <circle cx="65" cy="22" r="3" fill="#22c55e"/>
        <!-- オーラ -->
        <circle cx="50" cy="54" r="36" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.4" stroke-dasharray="4,3"/>
        <circle cx="50" cy="54" r="40" fill="none" stroke="#7dd3fc" stroke-width="1" opacity="0.25" stroke-dasharray="3,4"/>
        <!-- 波エフェクト -->
        <path d="M 14 78 Q 22 72 30 78 Q 38 84 46 78 Q 54 72 62 78 Q 70 84 78 78 Q 86 72 90 75" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.5" stroke-linecap="round"/>`,
      badge:  _stars(3, "#ffd700"),
    });
    return svg;
  },

  c22: (size) => _slimeSVG({ id: "c22", size,
    body:   { light: "#e0f9fe", mid: "#a5f3fc", dark: "#22d3ee" },
    shadow: "#0891b2",
    eyes:   _eyes(37, 48, 63, 48, 8, "#083344"),
    mouth:  _smile(50, 63, 14, "#083344"),
    extras: `
      <!-- 氷の結晶装飾 -->
      <line x1="50" y1="8" x2="50" y2="22" stroke="#bae6fd" stroke-width="2"/>
      <line x1="44" y1="12" x2="56" y2="18" stroke="#bae6fd" stroke-width="2"/>
      <line x1="56" y1="12" x2="44" y2="18" stroke="#bae6fd" stroke-width="2"/>
      <!-- 右の氷 -->
      <line x1="76" y1="38" x2="76" y2="52" stroke="#a5f3fc" stroke-width="1.5" opacity="0.7"/>
      <line x1="70" y1="42" x2="82" y2="48" stroke="#a5f3fc" stroke-width="1.5" opacity="0.7"/>
      <line x1="82" y1="42" x2="70" y2="48" stroke="#a5f3fc" stroke-width="1.5" opacity="0.7"/>
      <!-- 左の氷 -->
      <line x1="24" y1="45" x2="24" y2="57" stroke="#a5f3fc" stroke-width="1.5" opacity="0.5"/>
      <!-- 吹雪エフェクト -->
      <circle cx="20" cy="65" r="2" fill="#e0f9fe" opacity="0.6"/>
      <circle cx="78" cy="62" r="1.5" fill="#e0f9fe" opacity="0.5"/>
      <circle cx="30" cy="80" r="2.5" fill="#bae6fd" opacity="0.4"/>
      <!-- 氷のオーラ -->
      <circle cx="50" cy="54" r="36" fill="none" stroke="#a5f3fc" stroke-width="1.5" opacity="0.35" stroke-dasharray="2,5"/>`,
    badge:  _stars(3, "#ffd700"),
  }),

  c23: (size) => _slimeSVG({ id: "c23", size,
    body:   { light: "#fef9c3", mid: "#fde047", dark: "#ca8a04" },
    shadow: "#a16207",
    eyes:   _eyes(37, 47, 63, 47, 8, "#1c0a00"),
    mouth:  `<path d="M 36 62 Q 50 75 64 62" stroke="#7c2d12" stroke-width="2.5" fill="#fde047" stroke-linecap="round"/>`,
    extras: `
      <!-- 雷のオーラ -->
      <path d="M 20 30 L 26 45 L 20 45 L 30 70" stroke="#fbbf24" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      <path d="M 80 28 L 72 50 L 78 50 L 68 72" stroke="#fcd34d" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
      <!-- 電気スパーク -->
      <circle cx="22" cy="35" r="3" fill="#fef08a" opacity="0.8"/>
      <circle cx="78" cy="33" r="2.5" fill="#fef08a" opacity="0.7"/>
      <circle cx="50" cy="10" r="4" fill="#fcd34d" opacity="0.6"/>
      <!-- 雷マーク -->
      <path d="M 48 4 L 42 16 L 48 16 L 42 26" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- 全体オーラ -->
      <circle cx="50" cy="54" r="36" fill="none" stroke="#fde047" stroke-width="2" opacity="0.3" stroke-dasharray="1,6"/>`,
    badge:  _stars(3, "#ffd700"),
  }),

  c24: (size) => _slimeSVG({ id: "c24", size,
    body:   { light: "#c7d2fe", mid: "#818cf8", dark: "#4f46e5" },
    shadow: "#3730a3",
    eyes:   _eyes(37, 49, 63, 49, 7, "#1e1b4b"),
    mouth:  `<path d="M 40 63 L 60 63" stroke="#312e81" stroke-width="2.5" stroke-linecap="round"/>`,
    extras: `
      <!-- 槍 -->
      <rect x="78" y="18" width="5" height="52" rx="2" fill="#818cf8" stroke="#6366f1" stroke-width="0.5"/>
      <polygon points="80.5,12 76,24 85,24" fill="#c7d2fe" stroke="#a5b4fc" stroke-width="1"/>
      <rect x="74" y="52" width="13" height="4" rx="1" fill="#fbbf24"/>
      <!-- 魔法陣オーラ -->
      <circle cx="50" cy="54" r="36" fill="none" stroke="#818cf8" stroke-width="1.5" opacity="0.4"/>
      <circle cx="50" cy="54" r="28" fill="none" stroke="#a5b4fc" stroke-width="1" opacity="0.3" stroke-dasharray="3,3"/>
      <!-- ルーン文字っぽい -->
      <text x="20" y="42" font-size="10" fill="#818cf8" opacity="0.6">ᚱ</text>
      <text x="72" y="68" font-size="9" fill="#6366f1" opacity="0.5">ᚠ</text>`,
    badge:  _stars(3, "#ffd700"),
  }),
};

/**
 * コスチュームIDからSVG文字列を取得する
 * @param {string} costumeId - COSTUMESのid
 * @param {number} size - px
 * @returns {string} SVG文字列
 */
function getSlimeSVG(costumeId, size = 80) {
  const fn = COSTUME_SVG[costumeId];
  if (!fn) {
    // フォールバック：グレーのスライム
    return _slimeSVG({ id: "fallback", size,
      body: { light: "#aaa", mid: "#888", dark: "#555" },
      shadow: "#333",
      eyes: _eyes(38, 50, 62, 50),
      mouth: _smile(50, 62),
    });
  }
  return fn(size);
}
