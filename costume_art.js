/**
 * costume_art.js — コスチュームごとのSVGイラスト定義
 * getSlimeSVG(costumeId, size) → SVG文字列を返す
 */

// ベーススライム描画ヘルパー
// ★修正: グラデーション/フィルターのIDが costume.id（例: "body_c01"）だけで
//         生成されており、呼び出しごとの一意性が無かった。10連ガチャで同じ
//         コスチュームが複数回排出された場合など、同じidのSVGが同じ画面に
//         複数枚並ぶと、DOM内でグラデーションIDが重複してしまう。HTML/SVG仕様上
//         IDは文書全体で一意であるべきで、重複するとブラウザ（特にSafari）が
//         どの定義を参照するか不定になり、本体の塗りが白飛びしたり黒く潰れたり
//         する表示崩れの原因になっていた。呼び出しごとに必ずユニークな
//         サフィックスを付与する。
let _slimeSvgIdCounter = 0;
function _slimeSVG({ id, body, shadow, eyes, mouth, extras = "", badge = "", size = 80 }) {
  const uid = `${id}_${(_slimeSvgIdCounter++).toString(36)}`;
  badge = badge.replace(/glow_tmp/g, `glow_${uid}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <radialGradient id="body_${uid}" cx="38%" cy="32%" r="60%">
      <stop offset="0%" stop-color="${body.light}"/>
      <stop offset="60%" stop-color="${body.mid}"/>
      <stop offset="100%" stop-color="${body.dark}"/>
    </radialGradient>
    <radialGradient id="shine_${uid}" cx="35%" cy="28%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.38)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="glow_${uid}">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 影 -->
  <ellipse cx="50" cy="90" rx="28" ry="6" fill="${shadow}" opacity="0.35"/>

  <!-- ボディ -->
  <ellipse cx="50" cy="58" rx="34" ry="30" fill="url(#body_${uid})"/>
  <!-- ぷるぷる感の上部 -->
  <path d="M 28 50 Q 35 24 50 22 Q 65 24 72 50" fill="url(#body_${uid})" opacity="0.8"/>
  <!-- ハイライト -->
  <ellipse cx="50" cy="52" rx="34" ry="30" fill="url(#shine_${uid})" opacity="0.5"/>

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
// ★修正: グラデーションIDが座標(lx,ly,rx,ry)だけから生成されていたため、
//         目の位置が同じコスチューム同士（多くのコスチュームで共通）を
//         同じ画面に並べて表示すると（ステージ報酬の3択カード、図鑑の一覧、
//         きせかえ画面の「現在→変更後」比較など）、SVGの<defs>内のグラデーション
//         idがDOM内で重複してしまっていた。HTML/SVG仕様上IDは文書全体で一意で
//         あるべきで、重複するとブラウザ（特にSafari）によってどのグラデーションが
//         参照されるか不定になり、目の周りが白飛びして見えるなど表示が崩れる原因に
//         なっていた。呼び出しごとに必ずユニークなIDが振られるようにする。
let _eyesIdCounter = 0;
function _eyes(lx, ly, rx, ry, r = 7, pupilColor = "#1a0a2e") {
  const pr  = r * 0.58;
  const hl1 = r * 0.22;
  const hl2 = r * 0.12;
  const uid = `${Date.now().toString(36)}_${(_eyesIdCounter++).toString(36)}`;
  return `
  <defs>
    <radialGradient id="eyeWhite_L_${uid}" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dde8f0"/>
    </radialGradient>
    <radialGradient id="eyeWhite_R_${uid}" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dde8f0"/>
    </radialGradient>
  </defs>
  <ellipse cx="${lx}" cy="${ly}" rx="${r}" ry="${r * 1.15}" fill="url(#eyeWhite_L_${uid})" stroke="rgba(0,0,0,0.08)" stroke-width="0.5"/>
  <ellipse cx="${rx}" cy="${ry}" rx="${r}" ry="${r * 1.15}" fill="url(#eyeWhite_R_${uid})" stroke="rgba(0,0,0,0.08)" stroke-width="0.5"/>
  <circle cx="${lx}" cy="${ly + r * 0.08}" r="${pr}" fill="${pupilColor}"/>
  <circle cx="${rx}" cy="${ry + r * 0.08}" r="${pr}" fill="${pupilColor}"/>
  <circle cx="${lx - r * 0.28}" cy="${ly - r * 0.28}" r="${hl1}" fill="white" opacity="0.95"/>
  <circle cx="${rx - r * 0.28}" cy="${ry - r * 0.28}" r="${hl1}" fill="white" opacity="0.95"/>
  <circle cx="${lx + r * 0.18}" cy="${ly + r * 0.22}" r="${hl2}" fill="white" opacity="0.6"/>
  <circle cx="${rx + r * 0.18}" cy="${ry + r * 0.22}" r="${hl2}" fill="white" opacity="0.6"/>`;
}

function _smile(x, y, w = 14, color = "#2d0a3e") {
  return `<path d="M ${x - w/2} ${y} Q ${x} ${y + 7} ${x + w/2} ${y}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
}

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

  // c01: ノーマル（ミントグリーン）- リボン付き
  c01: (size) => _slimeSVG({ id: "c01", size,
    body:   { light: "#6ee7b7", mid: "#34d399", dark: "#059669" },
    shadow: "#047857",
    eyes:   _eyes(38, 50, 62, 50),
    mouth:  _smile(50, 62),
    extras: `
      <!-- シンプルなリボン（胸元） -->
      <path d="M 38 70 Q 42 66 50 68 Q 58 66 62 70 Q 58 74 50 72 Q 42 74 38 70Z" fill="#f0fdf4" opacity="0.6"/>
      <circle cx="50" cy="70" r="3" fill="#6ee7b7" stroke="#34d399" stroke-width="1"/>
      <!-- ほっぺ -->
      <ellipse cx="31" cy="58" rx="5" ry="3.5" fill="#a7f3d0" opacity="0.5"/>
      <ellipse cx="69" cy="58" rx="5" ry="3.5" fill="#a7f3d0" opacity="0.5"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  // c02: 葉っぱ帽子（緑）- 葉っぱマント
  c02: (size) => _slimeSVG({ id: "c02", size,
    body:   { light: "#86efac", mid: "#5adb5a", dark: "#22c55e" },
    shadow: "#16a34a",
    eyes:   _eyes(38, 50, 62, 50),
    mouth:  _smile(50, 62),
    extras: `
      <!-- 葉っぱ帽子 -->
      <ellipse cx="50" cy="26" rx="6" ry="8" fill="#4ade80" opacity="0.9"/>
      <ellipse cx="44" cy="24" rx="5" ry="4" fill="#22c55e" transform="rotate(-20 44 24)"/>
      <ellipse cx="56" cy="24" rx="5" ry="4" fill="#22c55e" transform="rotate(20 56 24)"/>
      <!-- マント（両サイドから垂れ下がる葉） -->
      <path d="M 20 62 Q 16 72 22 82 Q 28 78 30 68 Q 26 64 20 62Z" fill="#16a34a" opacity="0.85"/>
      <path d="M 80 62 Q 84 72 78 82 Q 72 78 70 68 Q 74 64 80 62Z" fill="#16a34a" opacity="0.85"/>
      <!-- 葉っぱの葉脈 -->
      <line x1="21" y1="65" x2="24" y2="78" stroke="#4ade80" stroke-width="1" opacity="0.6"/>
      <line x1="79" y1="65" x2="76" y2="78" stroke="#4ade80" stroke-width="1" opacity="0.6"/>
      <!-- 胸の葉っぱブローチ -->
      <ellipse cx="50" cy="70" rx="7" ry="4" fill="#15803d" opacity="0.8"/>
      <line x1="50" y1="67" x2="50" y2="73" stroke="#4ade80" stroke-width="1" opacity="0.7"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  // c03: おひさまコスチューム（黄）- ひまわりカラー
  c03: (size) => _slimeSVG({ id: "c03", size,
    body:   { light: "#fde047", mid: "#facc15", dark: "#ca8a04" },
    shadow: "#92400e",
    eyes:   _eyes(38, 50, 62, 50, 7, "#3b2200"),
    mouth:  _smile(50, 62, 16),
    extras: `
      <!-- 太陽の光線（背景） -->
      <line x1="50" y1="4" x2="50" y2="14" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
      <line x1="72" y1="12" x2="65" y2="20" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
      <line x1="28" y1="12" x2="35" y2="20" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
      <!-- ひまわりの花びらエリ -->
      <ellipse cx="32" cy="65" rx="7" ry="4" fill="#f97316" transform="rotate(-40 32 65)" opacity="0.9"/>
      <ellipse cx="38" cy="74" rx="7" ry="4" fill="#fb923c" transform="rotate(-15 38 74)" opacity="0.9"/>
      <ellipse cx="50" cy="77" rx="7" ry="4" fill="#f97316" opacity="0.9"/>
      <ellipse cx="62" cy="74" rx="7" ry="4" fill="#fb923c" transform="rotate(15 62 74)" opacity="0.9"/>
      <ellipse cx="68" cy="65" rx="7" ry="4" fill="#f97316" transform="rotate(40 68 65)" opacity="0.9"/>
      <!-- 中心（茶色の種） -->
      <circle cx="50" cy="70" r="6" fill="#7c3f00"/>
      <circle cx="48" cy="69" r="1.5" fill="#fef08a" opacity="0.5"/>
      <circle cx="52" cy="71" r="1.5" fill="#fef08a" opacity="0.5"/>
      <!-- ほっぺ -->
      <ellipse cx="31" cy="58" rx="6" ry="4" fill="#f97316" opacity="0.35"/>
      <ellipse cx="69" cy="58" rx="6" ry="4" fill="#f97316" opacity="0.35"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  // c04: デビルコスチューム（赤）- 角＋悪魔ローブ
  c04: (size) => _slimeSVG({ id: "c04", size,
    body:   { light: "#fca5a5", mid: "#ff6b6b", dark: "#ef4444" },
    shadow: "#dc2626",
    eyes:   _eyes(37, 48, 63, 48, 8, "#1a0000"),
    mouth:  `<path d="M 36 63 Q 50 75 64 63" stroke="#7f1d1d" stroke-width="2.5" fill="#fca5a5" stroke-linecap="round"/>`,
    extras: `
      <!-- 悪魔の角 -->
      <path d="M 34 30 L 28 10 L 40 22Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
      <path d="M 66 30 L 72 10 L 60 22Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
      <!-- 怒りマーク -->
      <line x1="32" y1="42" x2="42" y2="38" stroke="#7f1d1d" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="68" y1="42" x2="58" y2="38" stroke="#7f1d1d" stroke-width="2.5" stroke-linecap="round"/>
      <!-- 悪魔ローブ（えり＋前身ごろ） -->
      <path d="M 24 62 Q 30 58 38 60 Q 50 56 62 60 Q 70 58 76 62 Q 72 82 60 86 Q 50 88 40 86 Q 28 82 24 62Z" fill="#7f1d1d" opacity="0.75"/>
      <!-- ローブの模様 -->
      <path d="M 50 60 L 50 86" stroke="#dc2626" stroke-width="1.5" opacity="0.6"/>
      <path d="M 38 62 Q 44 72 50 72 Q 56 72 62 62" stroke="#dc2626" stroke-width="1" fill="none" opacity="0.5"/>
      <!-- 翼（小さく両サイド） -->
      <path d="M 18 60 Q 10 50 14 42 Q 20 50 22 60Z" fill="#991b1b" opacity="0.8"/>
      <path d="M 82 60 Q 90 50 86 42 Q 80 50 78 60Z" fill="#991b1b" opacity="0.8"/>
      <!-- 翼の筋 -->
      <line x1="14" y1="46" x2="20" y2="58" stroke="#fca5a5" stroke-width="0.8" opacity="0.5"/>
      <line x1="86" y1="46" x2="80" y2="58" stroke="#fca5a5" stroke-width="0.8" opacity="0.5"/>`,
    badge:  _stars(1, "#aaa"),
  }),

  // ── 星2 ──────────────────────────────────────────────────

  // c11: 魔法使い（紫）- 帽子＋ローブ＋マント
  c11: (size) => _slimeSVG({ id: "c11", size,
    body:   { light: "#c084fc", mid: "#9333ea", dark: "#7e22ce" },
    shadow: "#6b21a8",
    eyes:   _eyes(38, 49, 62, 49, 7, "#2e1065"),
    mouth:  _smile(50, 62),
    extras: `
      <!-- 魔法使い帽子 -->
      <polygon points="50,2 36,30 64,30" fill="#3b0764" stroke="#c084fc" stroke-width="1.5"/>
      <rect x="32" y="28" width="36" height="6" rx="3" fill="#581c87" stroke="#c084fc" stroke-width="1"/>
      <!-- 帽子の星飾り -->
      <text x="50" y="20" text-anchor="middle" font-size="8" fill="#fbbf24">★</text>
      <!-- マント（背面イメージ両サイド） -->
      <path d="M 16 58 Q 12 70 16 84 Q 24 80 26 68 Q 22 62 16 58Z" fill="#4c1d95" opacity="0.9"/>
      <path d="M 84 58 Q 88 70 84 84 Q 76 80 74 68 Q 78 62 84 58Z" fill="#4c1d95" opacity="0.9"/>
      <!-- マントの縁飾り -->
      <path d="M 16 60 Q 14 72 16 82" stroke="#c084fc" stroke-width="1" fill="none" opacity="0.6"/>
      <path d="M 84 60 Q 86 72 84 82" stroke="#c084fc" stroke-width="1" fill="none" opacity="0.6"/>
      <!-- ローブ前身ごろ -->
      <path d="M 26 64 Q 32 60 40 62 Q 50 58 60 62 Q 68 60 74 64 Q 70 84 58 88 Q 50 90 42 88 Q 30 84 26 64Z" fill="#3b0764" opacity="0.8"/>
      <!-- ローブの星紋様 -->
      <text x="50" y="78" text-anchor="middle" font-size="10" fill="#c084fc" opacity="0.7">✦</text>
      <text x="40" y="72" text-anchor="middle" font-size="7" fill="#a78bfa" opacity="0.5">✦</text>
      <text x="60" y="72" text-anchor="middle" font-size="7" fill="#a78bfa" opacity="0.5">✦</text>
      <!-- 魔法のエフェクト -->
      <text x="76" y="38" font-size="10" fill="#ffd700" opacity="0.8">✦</text>
      <text x="18" y="46" font-size="8" fill="#a78bfa" opacity="0.7">✦</text>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  // c12: ナイト（グレー）- 全身鎧＋盾＋剣
  c12: (size) => _slimeSVG({ id: "c12", size,
    body:   { light: "#94a3b8", mid: "#64748b", dark: "#475569" },
    shadow: "#334155",
    eyes:   _eyes(38, 50, 62, 50, 7, "#0f172a"),
    mouth:  `<path d="M 40 63 L 60 63" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>`,
    extras: `
      <!-- 鎧の胴体 -->
      <path d="M 22 60 Q 28 55 38 57 Q 50 53 62 57 Q 72 55 78 60 Q 75 84 60 88 Q 50 90 40 88 Q 25 84 22 60Z" fill="#334155" opacity="0.9"/>
      <!-- 胸当てのライン -->
      <path d="M 36 58 Q 50 54 64 58 Q 64 72 50 74 Q 36 72 36 58Z" fill="#475569" stroke="#94a3b8" stroke-width="1" opacity="0.9"/>
      <!-- 中央の紋章ライン -->
      <line x1="50" y1="58" x2="50" y2="74" stroke="#94a3b8" stroke-width="1.5" opacity="0.7"/>
      <line x1="38" y1="66" x2="62" y2="66" stroke="#94a3b8" stroke-width="1" opacity="0.6"/>
      <!-- 肩当て -->
      <ellipse cx="28" cy="60" rx="8" ry="5" fill="#475569" stroke="#94a3b8" stroke-width="1" transform="rotate(-15 28 60)"/>
      <ellipse cx="72" cy="60" rx="8" ry="5" fill="#475569" stroke="#94a3b8" stroke-width="1" transform="rotate(15 72 60)"/>
      <!-- 兜 -->
      <path d="M 22 48 Q 24 20 50 18 Q 76 20 78 48" fill="#475569" stroke="#94a3b8" stroke-width="1.5"/>
      <path d="M 26 48 Q 28 28 50 26 Q 72 28 74 48" fill="#64748b"/>
      <!-- バイザー -->
      <rect x="33" y="38" width="34" height="9" rx="3" fill="#0f172a" opacity="0.75"/>
      <!-- バイザーの横スリット -->
      <line x1="34" y1="41" x2="66" y2="41" stroke="#475569" stroke-width="0.8" opacity="0.5"/>
      <line x1="34" y1="44" x2="66" y2="44" stroke="#475569" stroke-width="0.8" opacity="0.5"/>
      <!-- 盾（左） -->
      <path d="M 8 54 Q 8 44 16 42 Q 22 44 22 54 Q 22 66 16 70 Q 10 66 8 54Z" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>
      <path d="M 11 52 Q 16 46 21 52 Q 21 62 16 66 Q 11 62 11 52Z" fill="#1d4ed8" opacity="0.6"/>
      <line x1="16" y1="46" x2="16" y2="66" stroke="#93c5fd" stroke-width="1" opacity="0.5"/>
      <line x1="11" y1="56" x2="21" y2="56" stroke="#93c5fd" stroke-width="1" opacity="0.5"/>
      <!-- 剣（右） -->
      <rect x="78" y="24" width="4" height="36" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
      <rect x="72" y="46" width="16" height="3.5" rx="1.5" fill="#fbbf24"/>
      <polygon points="80,20 78,30 82,30" fill="#e2e8f0"/>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  // c13: 森の精霊（緑）- 葉ローブ＋蔦マント
  c13: (size) => _slimeSVG({ id: "c13", size,
    body:   { light: "#4ade80", mid: "#22c55e", dark: "#15803d" },
    shadow: "#14532d",
    eyes:   _eyes(38, 50, 62, 50, 7, "#14532d"),
    mouth:  _smile(50, 63, 14, "#14532d"),
    extras: `
      <!-- 蔦マント（両サイド） -->
      <path d="M 16 56 Q 10 68 12 82 Q 20 80 24 70 Q 22 62 16 56Z" fill="#14532d" opacity="0.9"/>
      <path d="M 84 56 Q 90 68 88 82 Q 80 80 76 70 Q 78 62 84 56Z" fill="#14532d" opacity="0.9"/>
      <!-- 蔦の模様 -->
      <path d="M 16 60 Q 14 68 16 78" stroke="#4ade80" stroke-width="1.5" fill="none" opacity="0.6"/>
      <path d="M 84 60 Q 86 68 84 78" stroke="#4ade80" stroke-width="1.5" fill="none" opacity="0.6"/>
      <!-- マントの葉っぱ -->
      <ellipse cx="14" cy="66" rx="5" ry="3" fill="#16a34a" transform="rotate(-20 14 66)" opacity="0.8"/>
      <ellipse cx="86" cy="66" rx="5" ry="3" fill="#16a34a" transform="rotate(20 86 66)" opacity="0.8"/>
      <ellipse cx="13" cy="76" rx="5" ry="3" fill="#22c55e" transform="rotate(10 13 76)" opacity="0.8"/>
      <ellipse cx="87" cy="76" rx="5" ry="3" fill="#22c55e" transform="rotate(-10 87 76)" opacity="0.8"/>
      <!-- 葉っぱの冠 -->
      <ellipse cx="34" cy="26" rx="10" ry="5.5" fill="#15803d" transform="rotate(-30 34 26)"/>
      <ellipse cx="50" cy="19" rx="10" ry="5.5" fill="#16a34a"/>
      <ellipse cx="66" cy="26" rx="10" ry="5.5" fill="#15803d" transform="rotate(30 66 26)"/>
      <circle cx="50" cy="19" r="4" fill="#fde047"/>
      <!-- ローブ前身ごろ（葉模様） -->
      <path d="M 26 62 Q 32 58 40 60 Q 50 56 60 60 Q 68 58 74 62 Q 72 84 58 88 Q 50 90 42 88 Q 28 84 26 62Z" fill="#14532d" opacity="0.75"/>
      <!-- ローブの葉っぱ紋様 -->
      <ellipse cx="43" cy="72" rx="6" ry="4" fill="#16a34a" transform="rotate(-20 43 72)" opacity="0.7"/>
      <ellipse cx="57" cy="72" rx="6" ry="4" fill="#16a34a" transform="rotate(20 57 72)" opacity="0.7"/>
      <ellipse cx="50" cy="80" rx="6" ry="4" fill="#22c55e" opacity="0.7"/>
      <!-- きのこ（アクセント） -->
      <ellipse cx="22" cy="72" rx="6" ry="3.5" fill="#f97316" opacity="0.8"/>
      <rect x="20" y="71" width="4" height="6" rx="1" fill="#fef3c7" opacity="0.85"/>`,
    badge:  _stars(2, "#a78bfa"),
  }),

  // ── 星3 ──────────────────────────────────────────────────

  // c21: 海王（青）- 王冠＋波ローブ＋三叉槍
  c21: (size) => {
    const svg = _slimeSVG({ id: "c21", size,
      body:   { light: "#38bdf8", mid: "#0ea5e9", dark: "#0369a1" },
      shadow: "#075985",
      eyes:   _eyes(37, 48, 63, 48, 8, "#082f49"),
      mouth:  _smile(50, 63, 18, "#082f49"),
      extras: `
        <!-- 波ローブ（両サイド） -->
        <path d="M 14 56 Q 8 68 12 84 Q 18 86 22 76 Q 20 64 14 56Z" fill="#0369a1" opacity="0.85"/>
        <path d="M 86 56 Q 92 68 88 84 Q 82 86 78 76 Q 80 64 86 56Z" fill="#0369a1" opacity="0.85"/>
        <!-- 波の模様 -->
        <path d="M 10 68 Q 14 64 18 68 Q 16 76 12 80" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.6"/>
        <path d="M 90 68 Q 86 64 82 68 Q 84 76 88 80" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.6"/>
        <!-- 胴ローブ（海の紋様） -->
        <path d="M 22 60 Q 28 56 38 58 Q 50 54 62 58 Q 72 56 78 60 Q 76 84 62 88 Q 50 90 38 88 Q 24 84 22 60Z" fill="#075985" opacity="0.82"/>
        <!-- 波模様（ローブ） -->
        <path d="M 28 68 Q 34 64 40 68 Q 46 72 52 68 Q 58 64 64 68 Q 70 72 74 68" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.5"/>
        <path d="M 30 76 Q 36 72 42 76 Q 48 80 54 76 Q 60 72 66 76 Q 70 80 72 76" stroke="#7dd3fc" stroke-width="1" fill="none" opacity="0.45"/>
        <!-- 三叉槍（右） -->
        <rect x="79" y="36" width="4" height="40" rx="1.5" fill="#fbbf24" stroke="#f59e0b" stroke-width="0.5"/>
        <line x1="81" y1="32" x2="81" y2="42" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
        <line x1="76" y1="33" x2="76" y2="41" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="86" y1="33" x2="86" y2="41" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>
        <!-- 王冠 -->
        <polygon points="28,38 35,22 50,32 65,22 72,38 28,38" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
        <circle cx="50" cy="22" r="4" fill="#ef4444"/>
        <circle cx="35" cy="24" r="3" fill="#a855f7"/>
        <circle cx="65" cy="24" r="3" fill="#22c55e"/>
        <!-- オーラ -->
        <circle cx="50" cy="54" r="38" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.3" stroke-dasharray="4,3"/>`,
      badge:  _stars(3, "#ffd700"),
    });
    return svg;
  },

  // c22: 氷の女王（水色）- 氷の鎧＋結晶マント
  c22: (size) => _slimeSVG({ id: "c22", size,
    body:   { light: "#67e8f9", mid: "#22d3ee", dark: "#0891b2" },
    shadow: "#0e7490",
    eyes:   _eyes(37, 48, 63, 48, 8, "#083344"),
    mouth:  _smile(50, 63, 14, "#083344"),
    extras: `
      <!-- 氷の結晶マント（両サイド） -->
      <path d="M 12 54 Q 6 66 10 82 Q 18 84 22 72 Q 20 62 12 54Z" fill="#0e7490" opacity="0.8"/>
      <path d="M 88 54 Q 94 66 90 82 Q 82 84 78 72 Q 80 62 88 54Z" fill="#0e7490" opacity="0.8"/>
      <!-- マントの結晶模様 -->
      <line x1="16" y1="58" x2="16" y2="72" stroke="#a5f3fc" stroke-width="1.5" opacity="0.7"/>
      <line x1="13" y1="63" x2="19" y2="67" stroke="#a5f3fc" stroke-width="1" opacity="0.6"/>
      <line x1="84" y1="58" x2="84" y2="72" stroke="#a5f3fc" stroke-width="1.5" opacity="0.7"/>
      <line x1="87" y1="63" x2="81" y2="67" stroke="#a5f3fc" stroke-width="1" opacity="0.6"/>
      <!-- 氷の鎧（胴体） -->
      <path d="M 24 60 Q 30 55 40 57 Q 50 53 60 57 Q 70 55 76 60 Q 74 84 60 88 Q 50 90 40 88 Q 26 84 24 60Z" fill="#0c4a6e" opacity="0.85"/>
      <!-- 鎧の氷結晶模様 -->
      <path d="M 50 58 L 50 74" stroke="#a5f3fc" stroke-width="1.5" opacity="0.6"/>
      <path d="M 44 61 L 56 61" stroke="#a5f3fc" stroke-width="1" opacity="0.5"/>
      <path d="M 42 68 L 58 68" stroke="#a5f3fc" stroke-width="1" opacity="0.5"/>
      <path d="M 44 75 L 56 75" stroke="#a5f3fc" stroke-width="1" opacity="0.45"/>
      <!-- 肩の氷トゲ -->
      <polygon points="28,57 24,48 34,54" fill="#e0f9fe" opacity="0.8"/>
      <polygon points="72,57 76,48 66,54" fill="#e0f9fe" opacity="0.8"/>
      <!-- 氷の王冠 -->
      <path d="M 30 32 L 34 18 L 40 28 L 50 14 L 60 28 L 66 18 L 70 32Z" fill="#e0f9fe" stroke="#a5f3fc" stroke-width="1"/>
      <rect x="28" y="30" width="44" height="6" rx="2" fill="#bae6fd" stroke="#a5f3fc" stroke-width="1"/>
      <!-- 王冠の宝石 -->
      <circle cx="50" cy="16" r="4" fill="#38bdf8"/>
      <circle cx="36" cy="22" r="3" fill="#7dd3fc"/>
      <circle cx="64" cy="22" r="3" fill="#7dd3fc"/>
      <!-- 氷の結晶装飾（上） -->
      <line x1="50" y1="6" x2="50" y2="14" stroke="#e0f9fe" stroke-width="2"/>
      <line x1="46" y1="9" x2="54" y2="11" stroke="#e0f9fe" stroke-width="1.5"/>
      <line x1="54" y1="9" x2="46" y2="11" stroke="#e0f9fe" stroke-width="1.5"/>
      <!-- 吹雪エフェクト -->
      <circle cx="14" cy="68" r="2" fill="#e0f9fe" opacity="0.7"/>
      <circle cx="86" cy="70" r="1.5" fill="#bae6fd" opacity="0.6"/>
      <circle cx="20" cy="80" r="2" fill="#a5f3fc" opacity="0.5"/>`,
    badge:  _stars(3, "#ffd700"),
  }),

  // c23: 雷神（黄）- 雷神衣装＋雷槌
  c23: (size) => _slimeSVG({ id: "c23", size,
    body:   { light: "#fde047", mid: "#eab308", dark: "#a16207" },
    shadow: "#7c3e00",
    eyes:   _eyes(37, 47, 63, 47, 8, "#1c0a00"),
    mouth:  `<path d="M 36 62 Q 50 75 64 62" stroke="#7c2d12" stroke-width="2.5" fill="#fde047" stroke-linecap="round"/>`,
    extras: `
      <!-- 雷神ローブ（胴体） -->
      <path d="M 20 60 Q 26 55 36 57 Q 50 53 64 57 Q 74 55 80 60 Q 78 84 64 88 Q 50 90 36 88 Q 22 84 20 60Z" fill="#78350f" opacity="0.85"/>
      <!-- ローブの雷紋 -->
      <path d="M 38 62 L 34 72 L 40 72 L 34 84" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.8" stroke-linecap="round"/>
      <path d="M 62 62 L 66 72 L 60 72 L 66 84" stroke="#fcd34d" stroke-width="1.5" fill="none" opacity="0.7" stroke-linecap="round"/>
      <!-- 帯（腰） -->
      <rect x="28" y="74" width="44" height="5" rx="2" fill="#92400e" stroke="#fbbf24" stroke-width="1"/>
      <circle cx="50" cy="76.5" r="3" fill="#fbbf24"/>
      <!-- 鬼の角 -->
      <path d="M 34 28 L 28 8 L 42 22Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
      <path d="M 66 28 L 72 8 L 58 22Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>
      <!-- 雷槌（右） -->
      <rect x="77" y="46" width="5" height="26" rx="2" fill="#92400e" stroke="#78350f" stroke-width="0.5"/>
      <rect x="72" y="40" width="15" height="10" rx="2" fill="#78350f" stroke="#fbbf24" stroke-width="1"/>
      <rect x="73" y="41" width="13" height="8" rx="1" fill="#92400e"/>
      <!-- 槌の雷文 -->
      <path d="M 77 43 L 75 47 L 78 47 L 76 49" stroke="#fbbf24" stroke-width="1" fill="none"/>
      <!-- 雷のオーラ -->
      <path d="M 16 32 L 22 48 L 16 48 L 26 72" stroke="#fbbf24" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
      <!-- 電気スパーク -->
      <circle cx="18" cy="36" r="3" fill="#fef08a" opacity="0.9"/>
      <circle cx="24" cy="52" r="2" fill="#fef08a" opacity="0.7"/>
      <!-- 全体オーラ -->
      <circle cx="50" cy="54" r="38" fill="none" stroke="#fde047" stroke-width="2" opacity="0.25" stroke-dasharray="1,6"/>`,
    badge:  _stars(3, "#ffd700"),
  }),

  // c24: 魔法剣士（インディゴ）- 魔法ローブ＋魔法陣＋槍
  c24: (size) => _slimeSVG({ id: "c24", size,
    body:   { light: "#818cf8", mid: "#6366f1", dark: "#4338ca" },
    shadow: "#3730a3",
    eyes:   _eyes(37, 49, 63, 49, 7, "#1e1b4b"),
    mouth:  `<path d="M 40 63 L 60 63" stroke="#312e81" stroke-width="2.5" stroke-linecap="round"/>`,
    extras: `
      <!-- 魔法ローブ（両サイドマント） -->
      <path d="M 14 56 Q 8 68 12 84 Q 20 82 24 70 Q 22 62 14 56Z" fill="#1e1b4b" opacity="0.9"/>
      <path d="M 86 56 Q 92 68 88 84 Q 80 82 76 70 Q 78 62 86 56Z" fill="#1e1b4b" opacity="0.9"/>
      <!-- マントの魔法陣模様 -->
      <circle cx="18" cy="70" r="8" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.5"/>
      <circle cx="18" cy="70" r="5" fill="none" stroke="#a5b4fc" stroke-width="0.8" opacity="0.4" stroke-dasharray="2,2"/>
      <circle cx="82" cy="70" r="8" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.5"/>
      <circle cx="82" cy="70" r="5" fill="none" stroke="#a5b4fc" stroke-width="0.8" opacity="0.4" stroke-dasharray="2,2"/>
      <!-- 胴体ローブ -->
      <path d="M 24 60 Q 30 56 40 58 Q 50 54 60 58 Q 70 56 76 60 Q 74 84 60 88 Q 50 90 40 88 Q 26 84 24 60Z" fill="#1e1b4b" opacity="0.87"/>
      <!-- ローブの魔法陣 -->
      <circle cx="50" cy="72" r="10" fill="none" stroke="#6366f1" stroke-width="1.5" opacity="0.7"/>
      <circle cx="50" cy="72" r="6" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.5"/>
      <polygon points="50,63 53.5,70 61,70 55,75 57.5,83 50,78 42.5,83 45,75 39,70 46.5,70" fill="none" stroke="#a5b4fc" stroke-width="0.8" opacity="0.5"/>
      <!-- えり -->
      <path d="M 36 58 Q 50 54 64 58 Q 60 64 50 66 Q 40 64 36 58Z" fill="#312e81" opacity="0.8"/>
      <!-- 槍（右） -->
      <rect x="79" y="22" width="4.5" height="44" rx="2" fill="#818cf8" stroke="#6366f1" stroke-width="0.5"/>
      <polygon points="81.25,14 77,26 85.5,26" fill="#c7d2fe" stroke="#a5b4fc" stroke-width="1"/>
      <rect x="74" y="50" width="13" height="4" rx="1.5" fill="#fbbf24"/>
      <!-- 槍の魔法輝き -->
      <circle cx="81" cy="16" r="3" fill="#e0e7ff" opacity="0.8"/>
      <!-- 魔法陣オーラ -->
      <circle cx="50" cy="54" r="38" fill="none" stroke="#818cf8" stroke-width="1.5" opacity="0.3"/>
      <!-- ルーン文字 -->
      <text x="18" y="46" font-size="10" fill="#818cf8" opacity="0.55">ᚱ</text>
      <text x="74" y="84" font-size="9" fill="#6366f1" opacity="0.5">ᚠ</text>`,
    badge:  _stars(3, "#ffd700"),
  }),
};

/**
 * コスチュームIDからSVG文字列を取得する
 */
function getSlimeSVG(costumeId, size = 80) {
  const fn = COSTUME_SVG[costumeId];
  if (!fn) {
    return _slimeSVG({ id: "fallback", size,
      body: { light: "#aaa", mid: "#888", dark: "#555" },
      shadow: "#333",
      eyes: _eyes(38, 50, 62, 50),
      mouth: _smile(50, 62),
    });
  }
  return fn(size);
}
