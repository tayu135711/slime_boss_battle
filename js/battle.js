/* =========================================================
   battle.js — バトルシーン・バトルシステム・コマンド処理
   依存: THREE, config.js, models.js, party.js, island.js
   読み込み順: config.js → models.js → maze.js → party.js → island.js → battle.js
========================================================= */

/* ---------------------------------------------------------
   バトル用ミニ3Dシーン (敵が正面奥、味方が手前)
--------------------------------------------------------- */
const battleCanvas   = document.getElementById('battle-canvas');
const battleScene    = new THREE.Scene();
const battleCamera   = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
const battleCameraBase = new THREE.Vector3(0, 2.5, 4.6);
const battleCameraLookAt = new THREE.Vector3(0, 1.0, -1.2);
battleCamera.position.copy(battleCameraBase);
battleCamera.lookAt(battleCameraLookAt);
const battleRenderer = new THREE.WebGLRenderer({ canvas: battleCanvas, antialias: true, alpha: true });
// クリックで敵をロックオンできるようにする（3D上から直感的にターゲット選択）
function projectToCanvasPos(vec3) {
  const v = vec3.clone();
  v.project(battleCamera);
  const w = battleCanvas.clientWidth || battleCanvas.width;
  const h = battleCanvas.clientHeight || battleCanvas.height;
  return { x: (v.x * 0.5 + 0.5) * w, y: ( -v.y * 0.5 + 0.5) * h };
}

function pickEnemyAtCanvas(px, py) {
  if (!battleState || !enemyBattleModels) return null;
  let best = null;
  let bestDist = Infinity;
  enemyBattleModels.forEach((m, i) => {
    if (!m || !battleState.enemies[i] || battleState.enemies[i].hp <= 0) return;
    const p = projectToCanvasPos(m.position);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  // クリックは近ければターゲット、閾値はキャンバスの最小辺の6%程度
  const minSide = Math.min(battleCanvas.clientWidth || battleCanvas.width, battleCanvas.clientHeight || battleCanvas.height);
  if (best !== null && bestDist < Math.max(24, minSide * 0.06)) return best;
  return null;
}

if (battleCanvas) {
  battleCanvas.addEventListener('click', (ev) => {
    const rect = battleCanvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const idx = pickEnemyAtCanvas(x, y);
    if (idx !== null && battleState && battleState.enemies[idx] && battleState.enemies[idx].hp > 0) {
      battleState.targetIdx = idx;
      updateHpBar();
      // 小さなフィードバック音
      if (typeof SFX !== 'undefined') SFX.menu();
    }
  });
}

// ライティング
battleScene.add(new THREE.HemisphereLight(0xffffff, 0xffd9ec, 1.0));
const battleSun = new THREE.DirectionalLight(0xffffff, 0.8);
battleSun.position.set(3, 5, 4);
battleScene.add(battleSun);

// バトルフロア(半透明)
const battleFloor = new THREE.Mesh(
  new THREE.CircleGeometry(3.6, 24),
  new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
);
battleFloor.rotation.x = -Math.PI / 2;
battleFloor.position.z = -0.5;
battleScene.add(battleFloor);

/* ---------------------------------------------------------
   戦闘背景の動的生成 (ステージに応じた背景)
--------------------------------------------------------- */
let battleBgGroup = null;
let battleState = null; // 背景初期化より前に参照されるため先に宣言
// バトル開始直後のフラグ: 最初のコマンド選択時だけカメラを引いて全体を見せるために使う
let battleJustStarted = false;

function updateBattleBackground() {
  if (battleBgGroup) {
    battleScene.remove(battleBgGroup);
  }
  battleBgGroup = new THREE.Group();
  battleScene.add(battleBgGroup);

  // 2026/07/25 修正: 背景の岩・壁・丘・雲などの3Dオブジェクトは全廃し、
  // 単色背景のみにしてキャラクターとエフェクトが際立つようにした(臨場感重視)
  const islandVisible = document.getElementById('island-overlay')?.style.display !== 'none';
  if (battleState && !islandVisible) {
    // ダンジョン内: 濃い紫がかった単色
    battleScene.background = new THREE.Color(0x241a2e);
    battleScene.fog = new THREE.Fog(0x241a2e, 6, 14);
    battleFloor.material.color.setHex(0x3a2d3a);
    battleFloor.material.opacity = 0.85;
  } else {
    // 屋外: 明るい単色の空
    battleScene.background = new THREE.Color(0x8fd0e8);
    battleScene.fog = new THREE.Fog(0x8fd0e8, 7, 15);
    battleFloor.material.color.setHex(0xffffff);
    battleFloor.material.opacity = 0.35;
  }
}
updateBattleBackground();


/* ---------------------------------------------------------
   バトルキャンバスのリサイズ
--------------------------------------------------------- */
function resizeBattleCanvas() {
  const w = battleCanvas.clientWidth  || 460;
  const h = battleCanvas.clientHeight || 210;
  battleRenderer.setSize(w, h, false);
  battleCamera.aspect = w / h;
  battleCamera.updateProjectionMatrix();
}

/* ---------------------------------------------------------
   バトル状態
--------------------------------------------------------- */
let allyModels        = [];   // 各要素.userData.fighter で対応するfighterを参照
let enemyBattleModels = [];   // battleState.enemies と同じ並び順(複数体対応。2026/07/25 追加)

/** 現在ターゲット中の敵を返す (battleState.enemies[targetIdx]) */
function currentEnemy() {
  if (!battleState || !battleState.enemies) return null;
  return battleState.enemies[battleState.targetIdx] || battleState.enemies[0] || null;
}

/** 敵1体に対応する3Dモデルを返す */
function enemyMeshFor(e) {
  if (!battleState) return null;
  const idx = battleState.enemies.indexOf(e);
  return idx !== -1 ? enemyBattleModels[idx] : null;
}

/**
 * 素早さを返す(専用のステータス値は持たず、こうげき力から簡易的に算出する。
 * トレーナーは常にやや速め。同速のばらつきを出すため若干の乱数を加える)
 * 2026/07/25 追加: 「全員のコマンドを選んでから素早さ順に一斉行動」用
 */
function getSpeed(entity) {
  if (!entity) return 10;
  if (entity.isTrainer) return 14 + Math.random() * 2;
  const atk = typeof entity.atk === 'number'
    ? entity.atk
    : ((entity.type && entity.type.atk) || (entity.typeRef && entity.typeRef.atk) || 5);
  return 6 + atk * 0.9 + Math.random() * 2;
}

/** 敵の人数に応じた配置(2026/07/25 追加: モンスターを奥に下げて複数体並べられるように) */
function getEnemyLayout(count) {
  if (count <= 1) return [{ x: 0, z: -2.2 }];
  if (count === 2) return [{ x: -1.3, z: -2.4 }, { x: 1.3, z: -2.4 }];
  return [{ x: -1.9, z: -2.3 }, { x: 0, z: -2.9 }, { x: 1.9, z: -2.3 }];
}

/**
 * 遭遇時に一緒に出す敵グループを作る。ボスは単体のまま。
 * ボス以外は一定確率で2〜3体の群れで出現する(2026/07/25 追加)。
 * フィールド上に実体を持たない「増援」はmesh:nullとして扱う。
 */
function buildEncounterGroup(seedEnemy) {
  if (seedEnemy.isBoss) return [seedEnemy];
  const roll = Math.random();
  const extraCount = roll < 0.45 ? 0 : (roll < 0.8 ? 1 : 2); // 45%単体 / 35%2体 / 20%3体
  const group = [seedEnemy];
  for (let i = 0; i < extraCount; i++) {
    const type = Math.random() < 0.6
      ? seedEnemy.type
      : ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    group.push({
      type, hp: type.baseHp, maxHp: type.baseHp,
      alive: true, isBoss: false, mesh: null,
      atkDebuffMult: 1, atkDebuffTurns: 0, bound: false,
    });
  }
  return group;
}

/* ---------------------------------------------------------
   バトルモデル配置
--------------------------------------------------------- */
/**
 * バトル用の3Dモデルをシーンから取り除く。
 * (2026/07/27 修正: 以前はscene.removeするだけでジオメトリ/マテリアルを
 *  disposeしておらず、戦闘のたびにGPUメモリが解放されずに増え続けていた。
 *  長時間プレイすると徐々に重くなる/クラッシュする原因になり得るため修正)
 */
function disposeModel(m) {
  if (!m) return;
  m.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
}

function clearBattleModels() {
  allyModels.forEach(m => { battleScene.remove(m); disposeModel(m); });
  allyModels = [];
  enemyBattleModels.forEach(m => { if (m) { battleScene.remove(m); disposeModel(m); } });
  enemyBattleModels = [];
}

function ensureModelArmNodes(m) {
  if (!m) return;
  if (!m.userData) m.userData = {};
  try {
    if (!m.userData.armL) {
      const aL = new THREE.Object3D(); aL.name = 'armL'; aL.position.set(0, 0.5, 0);
      m.add(aL); m.userData.armL = aL;
    }
    if (!m.userData.armR) {
      const aR = new THREE.Object3D(); aR.name = 'armR'; aR.position.set(0, 0.5, 0);
      m.add(aR); m.userData.armR = aR;
    }
  } catch (e) { /* noop */ }
}

function placeBattleModels() {
  clearBattleModels();
  const fighters = getAllFighters();
  const n        = fighters.length;
  const spacing  = Math.min(1.05, 4.6 / Math.max(n, 1));
  const scale    = 0.6;

  fighters.forEach((f, i) => {
    const m = f.isTrainer
      ? buildTrainerModel()
      : (f.evolved && f.typeRef.evolvedBuild ? f.typeRef.evolvedBuild() : f.typeRef.build());
    m.scale.set(scale, scale, scale);
    const px = (i - (n - 1) / 2) * spacing;
    const pz = 1.4;
    m.position.set(px, 0, pz);
    m.rotation.y        = Math.PI; // 敵の方向を向く
    m.userData.fighter   = f;
    m.userData.baseScale = scale;
    m.userData.baseX     = px;
    m.userData.baseZ     = pz;
    m.visible            = true; // 2026/07/27 変更: 常に全員表示。行動中の子は showAllyModel() で強調表示する
    ensureModelArmNodes(m);
    battleScene.add(m);
    allyModels.push(m);
  });

  // 敵モデル (2026/07/25 修正: 複数体を奥に下げて並べて表示できるようにした)
  const layout     = getEnemyLayout(battleState.enemies.length);
  const groupScale = battleState.enemies.length > 1 ? 0.86 : 1;
  battleState.enemies.forEach((e, i) => {
    const pos = layout[i] || { x: 0, z: -2.2 };
    const m = e.type.build();
    m.position.set(pos.x, 0, pos.z);
    m.rotation.y = 0;
    const bScale = (e.type.battleScale || 1) * groupScale;
    m.scale.set(bScale, bScale, bScale);
    m.userData.baseScale = bScale;
    m.userData.baseX     = pos.x;
    m.userData.baseZ     = pos.z;
    ensureModelArmNodes(m);
    battleScene.add(m);
    enemyBattleModels.push(m);
  });
}

/* ---------------------------------------------------------
   ロックオン演出 (2026/07/28 追加)
   狙っている敵の頭上に、くるくる回る照準ブラケットを表示して
   「今ここを狙っている」感をわかりやすくする。
   (今までは敵チップの色が変わる+モデルが少し大きくなるだけで、
    3D画面上でパッと見て「どれを狙っているか」が分かりづらかった)
--------------------------------------------------------- */
let lockOnReticle = null;

function buildLockOnReticleSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64, cy = 64, r = 46, bracket = 22;

  // 4隅の「かぎかっこ」ブラケット (カメラのフォーカス枠のイメージ)
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    const bx = cx + sx * r, by = cy + sy * r;
    ctx.beginPath();
    ctx.moveTo(bx - sx * bracket, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by - sy * bracket);
    ctx.stroke();
  });

  // 中心の小さな照準ひし形
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 10, cy);
  ctx.closePath();
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.85, 0.85, 0.85);
  sprite.renderOrder = 999;
  return sprite;
}

/** 現在ターゲット中の敵の頭上にロックオン枠を表示・追従・回転させる */
function updateLockOnReticle() {
  const targetMesh = battleState ? enemyBattleModels[battleState.targetIdx] : null;
  if (!targetMesh) {
    if (lockOnReticle) lockOnReticle.visible = false;
    return;
  }
  if (!lockOnReticle) {
    lockOnReticle = buildLockOnReticleSprite();
    battleScene.add(lockOnReticle);
  }
  lockOnReticle.visible = true;
  const headY = 1.5 * (targetMesh.userData.baseScale || 1) + 0.3;
  lockOnReticle.position.set(targetMesh.position.x, targetMesh.position.y + headY, targetMesh.position.z);

  const t = performance.now() / 1000;
  lockOnReticle.material.rotation = t * 1.6; // くるくる回転してロックオン感を出す
  const pulse = 1 + Math.sin(t * 4) * 0.07;
  lockOnReticle.scale.set(0.85 * pulse, 0.85 * pulse, 0.85 * pulse);
}

/* ---------------------------------------------------------
   演出: ダメージポップアップ
--------------------------------------------------------- */
const damagePopupContainer = document.getElementById('damage-popup-container');

/**
 * バトル3D画面上にダメージ数値を浮かぶ
 * @param {number} dmg   - ダメージ数値
 * @param {boolean} big  - こうかはばつぐん時に大きく
 * @param {boolean} heal - 回復なら緑色
 * @param {string} side  - 'enemy'|’ally'
 */
function showDamagePopup(dmg, big = false, heal = false, side = 'enemy') {
  if (!damagePopupContainer) return;
  const el = document.createElement('div');
  el.className = 'damage-popup' + (big ? ' big' : '') + (heal ? ' heal' : '');
  // 攻撃側によって左右を分ける
  const x = side === 'enemy'
    ? 35 + Math.random() * 30
    : 60 + Math.random() * 30;
  const y = side === 'enemy' ? 20 + Math.random() * 20 : 45 + Math.random() * 20;
  el.style.left = x + '%';
  el.style.top  = y + '%';
  el.textContent = heal ? '+' + dmg : dmg;
  damagePopupContainer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** コンボヒットパーティクル (敢を倒した時のきらきら) */
function spawnVictoryParticles() {
  const container = damagePopupContainer;
  if (!container) return;
  const colors = ['#ffd700','#ff6b6b','#6bffb8','#6bb8ff','#ff6bff'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'battle-particle';
    const size = 6 + Math.random() * 10;
    p.style.width  = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = (20 + Math.random() * 60) + '%';
    p.style.top  = (30 + Math.random() * 30) + '%';
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    container.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
}

/* ---------------------------------------------------------
   演出: 衰撃波 (のしかかり専用)
--------------------------------------------------------- */
const shockwaveEl = document.getElementById('battle-shockwave');

function triggerShockwave() {
  if (!shockwaveEl) return;
  shockwaveEl.style.animation = 'none';
  // reflow
  void shockwaveEl.offsetWidth;
  shockwaveEl.style.animation = 'shockwave-burst 0.55s ease-out forwards';
}

/* ---------------------------------------------------------
   演出: とくぎ技名バナー (2026/07/28 追加)
--------------------------------------------------------- */
const skillBannerEl     = document.getElementById('skill-banner');
const skillBannerTextEl = document.getElementById('skill-banner-text');
const skillBurstEl      = document.getElementById('skill-burst');

/** カメラがキャラ単独クローズアップにカットする瞬間の光条バースト (2026/07/28 追加) */
function triggerSkillBurst(element) {
  if (!skillBurstEl) return;
  const color = '#' + (ELEMENT_EFFECT_COLORS[element] || 0xffe066).toString(16).padStart(6, '0');
  skillBurstEl.style.setProperty('--skill-color', color);
  skillBurstEl.classList.remove('show');
  void skillBurstEl.offsetWidth; // reflow
  skillBurstEl.classList.add('show');
}

function showSkillBanner(name, element) {
  if (!skillBannerEl || !skillBannerTextEl) return;
  const color = '#' + (ELEMENT_EFFECT_COLORS[element] || 0xffe066).toString(16).padStart(6, '0');
  skillBannerEl.style.setProperty('--skill-color', color);
  skillBannerTextEl.textContent = name;
  skillBannerEl.classList.remove('show');
  void skillBannerEl.offsetWidth; // reflow でアニメーションを再スタートさせる
  skillBannerEl.classList.add('show');
  if (typeof SFX !== 'undefined') SFX.skillReady();
}

/* ---------------------------------------------------------
   演出: カメラシェイク & 画面フラッシュ
--------------------------------------------------------- */
const battleFlashEl = document.getElementById('battle-flash');
/* ---------------------------------------------------------
   バトルカメラ: 「敵に注目」モードと「行動を映す」モードを行き来する
   コマンド選択中は敵だけがアップで映り、誰かが行動する瞬間だけ
   カメラが引いて味方も画面に入ってくる。
--------------------------------------------------------- */
const BATTLE_CAM_IDLE_POS    = new THREE.Vector3(0, 1.75, 0.6);
const BATTLE_CAM_IDLE_LOOK   = new THREE.Vector3(0, 1.05, -1.6);
const BATTLE_CAM_ACTION_POS  = battleCameraBase.clone();
const BATTLE_CAM_ACTION_LOOK = battleCameraLookAt.clone();
// 追加: 技ごとに異なる行動用カメラポジション（wide/close/medium）
const BATTLE_CAM_ACTION_POS_WIDE  = battleCameraBase.clone().add(new THREE.Vector3(0, 0, 2.4));
const BATTLE_CAM_ACTION_LOOK_WIDE = battleCameraLookAt.clone().add(new THREE.Vector3(0, 0, 0.2));
const BATTLE_CAM_ACTION_POS_CLOSE = battleCameraBase.clone().add(new THREE.Vector3(0, -0.2, -1.6));
const BATTLE_CAM_ACTION_LOOK_CLOSE= battleCameraLookAt.clone().add(new THREE.Vector3(0, 0, 0.9));
const BATTLE_CAM_ACTION_POS_MED   = battleCameraBase.clone().add(new THREE.Vector3(0, 0.1, 0.6));
const BATTLE_CAM_ACTION_LOOK_MED  = battleCameraLookAt.clone().add(new THREE.Vector3(0, 0, 0.1));
let battleActionVariant = 'default'; // 'default' | 'wide' | 'close' | 'medium' | 'skillFocus' — 更新時に参照される
// とくぎ発動時、キャラ単独にカメラを寄せる「技演出カメラ」用 (2026/07/28 追加)
// 常に画面全体が映っていた旧演出と違い、使い手だけにカメラを寄せて演出にメリハリを付ける
let skillFocusCasterModel   = null;
const BATTLE_CAM_SKILLFOCUS_POS  = new THREE.Vector3();
const BATTLE_CAM_SKILLFOCUS_LOOK = new THREE.Vector3();

/** skillFocusCasterModel の現在位置から、単独クローズアップ用のカメラ目標を計算する */
function updateSkillFocusCameraTarget() {
  if (!skillFocusCasterModel) return;
  const p = skillFocusCasterModel.position;
  BATTLE_CAM_SKILLFOCUS_POS.set(p.x + 0.55, 1.35, p.z + 0.85);
  BATTLE_CAM_SKILLFOCUS_LOOK.set(p.x - 0.05, 1.05, p.z - 0.15);
}

/**
 * とくぎ発動の瞬間、キャラ単独クローズアップへ「スナップカット」する。
 * (2026/07/28 追加: 参考動画のような、じわっと寄るのではなく
 *  一瞬でパッと切り替わる小気味よいカット演出にするため)
 */
function snapCameraToSkillFocus(fighter) {
  const model = findModelFor(fighter);
  if (!model) return;
  skillFocusCasterModel = model;
  battleActionVariant   = 'skillFocus';
  updateSkillFocusCameraTarget();
  battleCameraCurrentPos.copy(BATTLE_CAM_SKILLFOCUS_POS);
  battleCameraCurrentLook.copy(BATTLE_CAM_SKILLFOCUS_LOOK);
}

/**
 * モーションタイプからカメラバリアントを決めるユーティリティ
 * @param {string} motionType - 'normal'|'spin'|'jump'|'bodyslam' など
 */
function variantForMotion(motionType) {
  switch (motionType) {
    case 'spin': return 'wide';
    case 'bodyslam': return 'close';
    case 'jump': return 'medium';
    default: return 'default';
  }
}

/**
 * 敵の人数に応じてIDLEカメラの位置を調整する (2026/07/26 修正)
 * 以前は敵が1体のときの近距離(z:0.6)のまま固定されていたため、
 * 2〜3体並んだときに画面の端が切れるほど近すぎる問題があった。
 * (2026/07/27 修正: ボスなど battleScale が大きい敵は、1体でも
 *  近距離カメラだと画面からはみ出るほど大きく映ってしまっていたため、
 *  敵の大きさ分だけ追加でカメラを引くようにした)
 */
function updateIdleCameraForEnemyCount(enemyCount, allyCount = null, maxEnemyScale = 1) {
  // allyCount を省略した場合は現在のパーティから取得
  if (allyCount === null) allyCount = (typeof getAllFighters === 'function') ? getAllFighters().length : 1;

  // 両側に表示する必要がある幅を見積もる (おおよその基準)
  const totalSpread = Math.max(enemyCount, allyCount);

  // 敵の大きさ(battleScale)による追加の引き量。等倍(1.0)なら0、ボス(1.4)なら+0.8前後、
  // それ以上の巨大な敵にも比例して対応できるようにしておく。
  const sizePullback = Math.max(0, maxEnemyScale - 1) * 2.0;

  // 敵・味方の数に応じてZを後退させ、Yを少し高めにする
  if (totalSpread >= 3) {
    BATTLE_CAM_IDLE_POS.set(0, 2.4 + sizePullback * 0.3, 3.2 + sizePullback);
    BATTLE_CAM_IDLE_LOOK.set(0, 1.15, -2.6);
  } else if (totalSpread === 2) {
    BATTLE_CAM_IDLE_POS.set(0, 2.15 + sizePullback * 0.3, 2.1 + sizePullback);
    BATTLE_CAM_IDLE_LOOK.set(0, 1.1, -2.3);
  } else {
    BATTLE_CAM_IDLE_POS.set(0, 1.75 + sizePullback * 0.4, 0.6 + sizePullback);
    BATTLE_CAM_IDLE_LOOK.set(0, 1.05 + sizePullback * 0.15, -1.6 - sizePullback * 0.3);
  }
}

let battleCameraMode = 'idle'; // 'idle' | 'action'
const battleCameraCurrentPos  = BATTLE_CAM_IDLE_POS.clone();
const battleCameraCurrentLook = BATTLE_CAM_IDLE_LOOK.clone();

function setBattleCameraMode(mode) {
  battleCameraMode = mode;
}

/**
 * 味方は常時表示のまま、指定したキャラだけ手前に踏み出して強調表示する。
 * それ以外は待機ポーズ(定位置・等身大)に戻す。
 * (2026/07/27 変更: 以前は行動中の子だけ表示/他は非表示だったが、
 *  常にパーティ全員が見えるようにしてほしいという要望を受けて変更)
 * @param {object}  fighter
 * @param {boolean} show - falseの場合は誰も強調せず全員を待機ポーズに戻す
 */
function showAllyModel(fighter, show = true) {
  resetAllAllyPoses();
  if (!show || !fighter) return;
  const m = findModelFor(fighter);
  if (!m) return;
  const base = m.userData.baseScale || 0.6;
  const highlightScale = base * 1.18;
  m.scale.set(highlightScale, highlightScale, highlightScale);
  m.position.z = (m.userData.baseZ ?? 1.4) + 0.55; // 手前に踏み出す
  m.userData.highlighted = true;
}

/** 全員を待機ポーズ(等身大・定位置)に戻す。表示状態そのものは変えない(常時表示) */
function resetAllAllyPoses() {
  allyModels.forEach(m => {
    const s = m.userData.baseScale || 0.6;
    m.scale.set(s, s, s);
    if (m.userData.baseX !== undefined) m.position.x = m.userData.baseX;
    if (m.userData.baseZ !== undefined) m.position.z = m.userData.baseZ;
    m.visible = true;
    m.userData.highlighted = false;
  });
}
function hideAllAllyModels() {
  resetAllAllyPoses();
}

let camShakeUntil = 0;
let camShakeMag   = 0;
const CAM_SHAKE_DURATION = 220;

function triggerCameraShake(mag = 0.10) {
  camShakeMag   = mag;
  camShakeUntil = performance.now() + CAM_SHAKE_DURATION;
}

function updateCameraShake() {
  // カメラターゲットはモードとアクションのバリアントで切り替える
  let targetPos, targetLook;
  if (battleCameraMode === 'action') {
    if (battleActionVariant === 'skillFocus') {
      updateSkillFocusCameraTarget();
      targetPos = BATTLE_CAM_SKILLFOCUS_POS;
      targetLook = BATTLE_CAM_SKILLFOCUS_LOOK;
    } else if (battleActionVariant === 'wide') {
      targetPos = BATTLE_CAM_ACTION_POS_WIDE;
      targetLook = BATTLE_CAM_ACTION_LOOK_WIDE;
    } else if (battleActionVariant === 'close') {
      targetPos = BATTLE_CAM_ACTION_POS_CLOSE;
      targetLook = BATTLE_CAM_ACTION_LOOK_CLOSE;
    } else if (battleActionVariant === 'medium') {
      targetPos = BATTLE_CAM_ACTION_POS_MED;
      targetLook = BATTLE_CAM_ACTION_LOOK_MED;
    } else {
      targetPos = BATTLE_CAM_ACTION_POS;
      targetLook = BATTLE_CAM_ACTION_LOOK;
    }
  } else {
    targetPos = BATTLE_CAM_IDLE_POS;
    targetLook = BATTLE_CAM_IDLE_LOOK;
  }

  battleCameraCurrentPos.lerp(targetPos, 0.09);
  battleCameraCurrentLook.lerp(targetLook, 0.09);

  const now = performance.now();
  if (now < camShakeUntil) {
    const t   = (camShakeUntil - now) / CAM_SHAKE_DURATION;
    const mag = camShakeMag * t;
    battleCamera.position.set(
      battleCameraCurrentPos.x + (Math.random() - 0.5) * mag,
      battleCameraCurrentPos.y + (Math.random() - 0.5) * mag,
      battleCameraCurrentPos.z + (Math.random() - 0.5) * mag * 0.5
    );
  } else {
    battleCamera.position.copy(battleCameraCurrentPos);
  }
  battleCamera.lookAt(battleCameraCurrentLook);
}

/** 被弾フラッシュ (白=通常ヒット、金=こうかばつぐん) */
function triggerBattleFlash(color = '#ffffff', peak = 0.45) {
  if (!battleFlashEl) return;
  battleFlashEl.style.transition = 'none';
  battleFlashEl.style.background = color;
  battleFlashEl.style.opacity    = String(peak);
  requestAnimationFrame(() => {
    battleFlashEl.style.transition = 'opacity 0.32s ease-out';
    battleFlashEl.style.opacity    = '0';
  });
}

/* ---------------------------------------------------------
   属性エフェクト (2026/07/25 追加)
   炎=火柱状のコーン、水=水しぶきの球、自然=舞う葉っぱ、
   闇=紫の結晶、光=金色の粒子。命中したモデルの位置に一瞬だけ噴き出す。
--------------------------------------------------------- */
const ELEMENT_EFFECT_COLORS = {
  fire: 0xff5522, water: 0x3fa8ff, nature: 0x4fae4f, dark: 0x8a3fe0, light: 0xffe066,
};

function spawnElementEffect(targetMesh, element, opts = {}) {
  if (!targetMesh || !element) return;
  const color = ELEMENT_EFFECT_COLORS[element] || 0xffffff;
  const group = new THREE.Group();
  const skillBoost = opts.skill ? 1.8 : 1.0;
  const count = opts.skill ? (element === 'nature' ? 18 : element === 'water' ? 22 : 18)
                          : (element === 'nature' ? 9 : element === 'water' ? 12 : 10);

  for (let i = 0; i < count; i++) {
    let geo;
    if (element === 'fire')        geo = new THREE.ConeGeometry((0.05 + Math.random() * 0.04) * skillBoost, (0.2 + Math.random() * 0.14) * skillBoost, 6);
    else if (element === 'water')  geo = new THREE.SphereGeometry((0.045 + Math.random() * 0.035) * skillBoost, 6, 6);
    else if (element === 'nature') geo = new THREE.BoxGeometry(0.09 * skillBoost, 0.09 * skillBoost, 0.015 * skillBoost);
    else if (element === 'dark')   geo = new THREE.OctahedronGeometry(0.07 * skillBoost);
    else                           geo = new THREE.SphereGeometry(0.045 * skillBoost, 6, 6); // light

    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const p = new THREE.Mesh(geo, mat);
    const angle  = Math.random() * Math.PI * 2;
    const radius = Math.random() * (0.45 * skillBoost);
    p.position.set(Math.cos(angle) * radius, Math.random() * (0.4 * skillBoost), Math.sin(angle) * radius * 0.4);
    p.userData.vel = {
      x: Math.cos(angle) * (0.3 + Math.random() * 0.3) * (0.9 + 0.4 * skillBoost),
      y: (1.1 + Math.random() * 0.9) * (0.9 + 0.4 * skillBoost),
      z: Math.sin(angle) * (0.2 + Math.random() * 0.2) * (0.9 + 0.4 * skillBoost),
    };
    group.add(p);
  }

  group.position.copy(targetMesh.position);
  group.position.y += opts.offsetY || 0.15;
  battleScene.add(group);

  // スキル演出用の追加エフェクト: 火なら火球の余韻、海なら波のリング
  if (opts.skill) {
    if (element === 'fire') {
      const ringGeo = new THREE.RingGeometry(0.2, 0.4, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(targetMesh.position);
      ring.position.y += 0.06;
      battleScene.add(ring);
      // ringアニメ
      const ringStart = performance.now();
      (function animateRing() {
        const rt = (performance.now() - ringStart) / 420;
        if (rt >= 1) { try { battleScene.remove(ring); } catch (e) {} ; return; }
        ring.scale.set(1 + rt * 1.6, 1 + rt * 1.6, 1);
        ring.material.opacity = 0.45 * (1 - rt);
        requestAnimationFrame(animateRing);
      })();
    } else if (element === 'water') {
      const rippleGeo = new THREE.RingGeometry(0.08, 0.2, 32);
      const rippleMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
      const ripple = new THREE.Mesh(rippleGeo, rippleMat);
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.copy(targetMesh.position);
      ripple.position.y += 0.02;
      battleScene.add(ripple);
      const rStart = performance.now();
      (function animateRipple() {
        const rt = (performance.now() - rStart) / 520;
        if (rt >= 1) { try { battleScene.remove(ripple); } catch (e) {} ; return; }
        ripple.scale.set(1 + rt * 2.4, 1 + rt * 2.4, 1);
        ripple.material.opacity = 0.42 * (1 - rt);
        requestAnimationFrame(animateRipple);
      })();
    } else if (element === 'nature') {
      // 自然: 2本のツタの輪が逆回転しながら締め付けるように回る
      const vineGroup = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const ringGeo = new THREE.TorusGeometry(0.28, 0.018, 6, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + (i === 0 ? 0.35 : -0.35);
        vineGroup.add(ring);
      }
      vineGroup.position.copy(targetMesh.position);
      vineGroup.position.y += 0.35;
      battleScene.add(vineGroup);
      const vStart = performance.now();
      (function animateVine() {
        const vt = (performance.now() - vStart) / 620;
        if (vt >= 1) { try { battleScene.remove(vineGroup); } catch (e) {} ; return; }
        vineGroup.children[0].rotation.z += 0.22;
        vineGroup.children[1].rotation.z -= 0.22;
        vineGroup.scale.setScalar(1 + vt * 0.5);
        vineGroup.children.forEach(r => { r.material.opacity = 0.75 * (1 - vt); });
        requestAnimationFrame(animateVine);
      })();
    } else if (element === 'dark') {
      // 闇: 中心に収縮していく紫の"のみこむ"球体オーラ
      const voidGeo = new THREE.SphereGeometry(0.5, 12, 12);
      const voidMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, wireframe: true });
      const voidOrb = new THREE.Mesh(voidGeo, voidMat);
      voidOrb.position.copy(targetMesh.position);
      voidOrb.position.y += 0.3;
      battleScene.add(voidOrb);
      const dStart = performance.now();
      (function animateVoid() {
        const dt = (performance.now() - dStart) / 560;
        if (dt >= 1) { try { battleScene.remove(voidOrb); } catch (e) {} ; return; }
        const s = 1.4 - dt * 1.1; // だんだん縮んで吸い込まれる
        voidOrb.scale.setScalar(Math.max(0.05, s));
        voidOrb.rotation.y += 0.25;
        voidOrb.material.opacity = 0.32 * (1 - dt);
        requestAnimationFrame(animateVoid);
      })();
    } else if (element === 'light') {
      // 光: 十字に伸びる光の筋 + 拡大する輪
      const rayGroup = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const rayGeo = new THREE.PlaneGeometry(0.06, 0.9);
        const rayMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const ray = new THREE.Mesh(rayGeo, rayMat);
        ray.rotation.z = (Math.PI / 4) * i;
        rayGroup.add(ray);
      }
      rayGroup.position.copy(targetMesh.position);
      rayGroup.position.y += 0.3;
      battleScene.add(rayGroup);
      const lStart = performance.now();
      (function animateRay() {
        const lt = (performance.now() - lStart) / 460;
        if (lt >= 1) { try { battleScene.remove(rayGroup); } catch (e) {} ; return; }
        rayGroup.rotation.z += 0.05;
        rayGroup.scale.setScalar(1 + lt * 0.8);
        rayGroup.children.forEach(r => { r.material.opacity = 0.55 * (1 - lt); });
        requestAnimationFrame(animateRay);
      })();
    }
  }

  const start    = performance.now();
  const duration = opts.skill ? 720 : 550;
  (function animateEffect() {
    const t = (performance.now() - start) / duration;
    if (t >= 1) { try { battleScene.remove(group); } catch (e) {} ; return; }
    group.children.forEach(p => {
      p.position.x += p.userData.vel.x * 0.016;
      p.position.y += p.userData.vel.y * 0.016;
      p.position.z += p.userData.vel.z * 0.016;
      p.userData.vel.y -= 0.05; // 重力
      p.rotation.x += 0.2; p.rotation.y += 0.15;
      p.material.opacity = 0.95 * (1 - t);
    });
    requestAnimationFrame(animateEffect);
  })();
}

/**
 * とくぎ発動前の「ため」演出: 使い手の足元から属性色の粒子が
 * 渦を巻きながら立ちのぼる。攻撃が飛んでいく前の一瞬に再生する。
 * (2026/07/28 追加)
 */
function spawnSkillChargeEffect(model, element) {
  if (!model) return;
  const color = ELEMENT_EFFECT_COLORS[element] || 0xffe066;
  const count = 16;
  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.035 + Math.random() * 0.025, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const p = new THREE.Mesh(geo, mat);
    const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const radius = 0.35 + Math.random() * 0.15;
    p.userData.angle  = angle;
    p.userData.radius = radius;
    p.userData.speed  = 4.2 + Math.random() * 2.2;
    p.userData.riseY  = 0.02 + Math.random() * 0.02;
    p.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    group.add(p);
  }

  group.position.copy(model.position);
  battleScene.add(group);

  const start    = performance.now();
  const duration = 560;
  (function animateCharge() {
    const t = (performance.now() - start) / duration;
    if (t >= 1 || !battleScene.children.includes(group)) {
      try { battleScene.remove(group); } catch (e) {}
      return;
    }
    group.children.forEach(p => {
      p.userData.angle  += p.userData.speed * 0.016;
      p.userData.radius *= 0.965; // だんだん中心に寄っていく
      p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
      p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
      p.position.y += p.userData.riseY;
      p.material.opacity = 0.9 * (1 - t);
    });
    requestAnimationFrame(animateCharge);
  })();
}

/* ---------------------------------------------------------
   演出: 入場ズームイン (バトル開始時に敵が飛び込んでくる演出)
--------------------------------------------------------- */
function triggerEnemyEnterAnimation() {
  enemyBattleModels.forEach(m => {
    if (!m) return;
    const startScale = m.userData.baseScale || 1;
    m.scale.set(startScale * 3.5, startScale * 3.5, startScale * 3.5);
    m.userData.enterAnim = {
      start: performance.now(), duration: 650,
      from: startScale * 3.5, to: startScale,
    };
  });
}

/* ---------------------------------------------------------
   アタックモーション
--------------------------------------------------------- */
function triggerAttackMotion(mesh, dir, type = 'normal', meta = {}) {
  if (!mesh) return;
  const bx = mesh.userData.baseX !== undefined ? mesh.userData.baseX : mesh.position.x;
  const bz = mesh.userData.baseZ !== undefined ? mesh.userData.baseZ : mesh.position.z;
  const duration = type === 'bodyslam' ? 1800 : type === 'spin' ? 1450 : type === 'jump' ? 1350 : 1150;
  mesh.userData.atkAnim = {
    start:    performance.now(),
    duration,
    dir,
    type,
    baseX: bx,
    baseZ: bz,
    baseY: mesh.position.y,
    meta: meta || {},
  };

  // モーションに合わせてカメラバリアントを変更（演出用）
  battleActionVariant = variantForMotion(type);
  // 他のアニメが終わるまで action モードを維持（呼び出し側で setBattleCameraMode('action') すること）
}

function triggerHitReaction(mesh, opts) {
  if (!mesh) return;
  mesh.userData.hitAnim = { start: performance.now(), duration: 400 };
  const big = opts && opts.big;
  triggerCameraShake(big ? 0.28 : 0.13);
  const flashColor = opts && opts.element
    ? ({
        fire: '#ff6b30', water: '#30a8ff', nature: '#50d050',
        dark: '#a050ff', light: '#ffe050',
      }[opts.element] || '#ffffff')
    : (big ? '#ffe36b' : '#ffffff');
  triggerBattleFlash(flashColor, big ? 0.7 : 0.42);
  if (typeof SFX !== 'undefined') (big ? SFX.hitBig() : SFX.hit());
}

function triggerDefendMotion(mesh) {
  if (!mesh) return;
  mesh.userData.defendAnim = { start: performance.now(), duration: 700 };
}

/** 毎フレーム呼び出してバトルモデルのアニメを更新 */
function updateAttackMotions() {
  const all = [...allyModels, ...enemyBattleModels.filter(Boolean)];
  all.forEach(mesh => {
    if (!mesh) return;
    const baseScale = mesh.userData.baseScale || 1;
    const bx = mesh.userData.baseX !== undefined ? mesh.userData.baseX : mesh.position.x;
    const bz = mesh.userData.baseZ !== undefined ? mesh.userData.baseZ : mesh.position.z;

    // Entrance animation
    if (mesh.userData.enterAnim) {
      const ea = mesh.userData.enterAnim;
      const t  = Math.min(1, (performance.now() - ea.start) / ea.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const s = ea.from + (ea.to - ea.from) * ease;
      mesh.scale.set(s, s, s);
      if (t >= 1) {
        mesh.scale.set(ea.to, ea.to, ea.to);
        delete mesh.userData.enterAnim;
      }
      return;
    }

    if (mesh.userData.atkAnim) {
      const a = mesh.userData.atkAnim;
      const t = Math.min(1, (performance.now() - a.start) / a.duration);

      // 手足があるモデルなら腕の演出も少し入れる（振りかぶる・振り下ろすなど）
      if (mesh.userData.armL) {
        try {
          // 基本的なスイング量
          const swing = Math.sin(t * Math.PI);
          if (a.type === 'spin') {
            mesh.userData.armL.rotation.x = -swing * 1.1;
            mesh.userData.armR.rotation.x =  swing * 1.1;
          } else if (a.type === 'jump') {
            mesh.userData.armR.rotation.x = -swing * 1.0;
            mesh.userData.armL.rotation.x = -swing * 0.5;
          } else if (a.type === 'bodyslam') {
            // のしかかりは両腕を突き出すように
            const phase = Math.min(1, t / 0.35);
            mesh.userData.armL.rotation.x = -0.6 * phase;
            mesh.userData.armR.rotation.x = -0.6 * phase;
            // 少し外側にも広げる
            mesh.userData.armL.rotation.z = -0.25 * phase;
            mesh.userData.armR.rotation.z =  0.25 * phase;
          } else {
            // normal / default: 新しい「溜め→リリース」のタイミングに合わせて
            // 振りかぶってから一気に振り下ろす動きにする (2026/07/27 修正)
            const windupEnd  = 0.28;
            const releaseEnd = 0.55;
            let armSwing;
            if (t < windupEnd) {
              armSwing = -(t / windupEnd) * 0.5; // 振りかぶる(後ろに引く)
            } else if (t < releaseEnd) {
              const tp = (t - windupEnd) / (releaseEnd - windupEnd);
              armSwing = -0.5 + (1 - Math.pow(1 - tp, 2)) * 1.4; // 一気に振り下ろす
            } else {
              const tp = (t - releaseEnd) / (1 - releaseEnd);
              armSwing = 0.9 * (1 - tp); // ゆっくり戻す
            }
            mesh.userData.armR.rotation.x = -armSwing * 0.9;
            mesh.userData.armL.rotation.x = -armSwing * 0.45;
          }

          // 属性ごとの追加ポーズ (例: 火はより大きく振りかぶる、水はためて跳ぶ)
          if (a.meta && a.meta.element) {
            const el = a.meta.element;
            if (el === 'fire') {
              // 火属性は腕をより大きく振りかぶらせる
              mesh.userData.armR.rotation.x *= 1.25;
              mesh.userData.armL.rotation.x *= 1.15;
            } else if (el === 'water') {
              // 水属性は両腕を抱えるようにためてから跳ぶ
              mesh.userData.armL.rotation.x -= Math.sin(t * Math.PI) * 0.12;
              mesh.userData.armR.rotation.x -= Math.sin(t * Math.PI) * 0.12;
            } else if (el === 'nature') {
              mesh.userData.armL.rotation.z += Math.sin(t * Math.PI) * 0.06;
              mesh.userData.armR.rotation.z -= Math.sin(t * Math.PI) * 0.06;
            }
          }
        } catch (e) {
          // 何かのモデルでarmノードが違う構成でも落ちないよう防御
        }
      }

      // 攻撃の演出エフェクトを攻撃者の身体で発生させる(一度だけ)。
      // (2026/07/27 修正: 今まで属性つきの技にしか出ていなかったが、
      //  無属性の通常攻撃も「技を出してる感」が薄かったので、控えめな白い衝撃波を追加した)
      try {
        if (a.meta && a.meta.element && !a.elementFxTriggered && t > 0.32) {
          a.elementFxTriggered = true;
          spawnElementEffect(mesh, a.meta.element, { skill: true, offsetY: 0.25 });
        } else if ((!a.meta || !a.meta.element) && !a.elementFxTriggered && t > 0.32) {
          a.elementFxTriggered = true;
          spawnElementEffect(mesh, 'light', { offsetY: 0.25 });
        }
      } catch (e) { /* noop */ }

      if (a.type === 'bodyslam') {
        const phase1End = 0.35;
        const phase2End = 0.70;
        if (t < phase1End) {
          const tp = t / phase1End;
          const s = baseScale * (1 + tp * 0.45);
          mesh.scale.set(s, s * (1 + tp * 0.25), s);
          mesh.position.z = a.baseZ - tp * 0.8;
          mesh.rotation.x = tp * 0.3;
          mesh.position.x = a.baseX;
        } else if (t < phase2End) {
          const tp = (t - phase1End) / (phase2End - phase1End);
          const squash = 1 - tp * 0.55;
          const s = baseScale * 1.45;
          mesh.scale.set(s * (1 + tp * 0.4), s * squash, s * (1 + tp * 0.4));
          mesh.position.z = a.baseZ - 0.8 + tp * 3.5;
          mesh.position.y = -tp * 0.25;
          mesh.rotation.x = 0.3 - tp * 0.6;
          mesh.position.x = a.baseX;
          if (tp > 0.85 && !a.shockwaveTriggered) {
            a.shockwaveTriggered = true;
            triggerShockwave();
            triggerCameraShake(0.35);
            triggerBattleFlash('#ff8830', 0.7);
          }
        } else {
          const tp = (t - phase2End) / (1 - phase2End);
          const bounce = Math.sin(tp * Math.PI) * 0.15;
          mesh.scale.set(baseScale * (1 + bounce * 0.1), baseScale * (1 - bounce * 0.05), baseScale * (1 + bounce * 0.1));
          mesh.position.z = a.baseZ + (1 - tp) * 2.7;
          mesh.position.y = Math.sin(tp * Math.PI) * 0.08;
          mesh.rotation.x = -(1 - tp) * 0.3;
          mesh.position.x = a.baseX;
        }
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          mesh.rotation.x = 0;
          delete mesh.userData.atkAnim;
        }

      } else if (a.type === 'spin') {
        // 2026/07/28 修正: 溜め→加速する回転→着地、の3段階にしてメリハリを出す。
        // ピーク(回転が最速になる瞬間)で軽いカメラシェイク+フラッシュを追加し、
        // 「技が当たった」感を出す(今までは単調なsinカーブの往復回転だけだった)
        const windupEnd = 0.2;
        if (t < windupEnd) {
          const tp = t / windupEnd;
          const s = baseScale * (1 - tp * 0.08); // 少し縮んで溜める
          mesh.scale.set(s, s, s);
          mesh.rotation.y = -tp * 0.5; // 逆方向に少しひねって溜める
          mesh.position.x = a.baseX;
          mesh.position.z = a.baseZ;
        } else {
          const tp = (t - windupEnd) / (1 - windupEnd);
          const lunge = Math.sin(tp * Math.PI) * 0.85;
          mesh.position.z = a.baseZ + a.dir.z * lunge;
          mesh.position.x = a.baseX + a.dir.x * lunge;
          mesh.rotation.y = -0.5 + tp * Math.PI * 4.5; // 勢いよく回転
          const s = baseScale * (1 + Math.sin(tp * Math.PI) * 0.2);
          mesh.scale.set(s, s, s);
          if (tp > 0.45 && tp < 0.6 && !a.shockwaveTriggered) {
            a.shockwaveTriggered = true;
            triggerCameraShake(0.16);
            triggerBattleFlash('#ffffff', 0.35);
          }
        }
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          mesh.rotation.y = enemyBattleModels.includes(mesh) ? 0 : Math.PI;
          delete mesh.userData.atkAnim;
        }

      } else if (a.type === 'jump') {
        // 2026/07/28 修正: ジャンプ前にしゃがむ溜めと、着地の瞬間の軽い衝撃を追加。
        // 今までは滑らかなsinカーブの放物線だけで「跳んで戻る」だけに見えがちだった。
        const crouchEnd = 0.16;
        if (t < crouchEnd) {
          const tp = t / crouchEnd;
          const s = baseScale * (1 - tp * 0.12);
          mesh.scale.set(s * 1.08, s * 0.85, s * 1.08); // 少し潰れてしゃがむ
          mesh.position.x = a.baseX;
          mesh.position.z = a.baseZ;
          mesh.position.y = 0;
        } else {
          const tp     = (t - crouchEnd) / (1 - crouchEnd);
          const lunge  = Math.sin(tp * Math.PI) * 0.7;
          const height = Math.sin(tp * Math.PI) * 0.85;
          mesh.position.x = a.baseX + a.dir.x * lunge;
          mesh.position.z = a.baseZ + a.dir.z * lunge;
          mesh.position.y = height;
          // 空中では少し縦に伸びる、着地直前は潰れる
          const airStretch = height > 0.15 ? 1 + height * 0.12 : 1;
          const landSquash = tp > 0.85 ? 1 - (tp - 0.85) * 1.2 : 1;
          const s = baseScale * airStretch * landSquash;
          mesh.scale.set(s * (2 - airStretch), s * airStretch, s * (2 - airStretch));
          if (tp > 0.82 && !a.shockwaveTriggered) {
            a.shockwaveTriggered = true;
            triggerCameraShake(0.14);
          }
        }
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          delete mesh.userData.atkAnim;
        }

      } else {
        // 通常攻撃: 溜め(振りかぶり)→ 一気に繰り出す → 戻る、の3段階モーションに変更
        // (2026/07/27 修正: 以前は単調な往復の突進(sinカーブ1本)だけで、
        //  「前に出て突進してるだけ」に見えがちだったため、技を繰り出している
        //  感じが出るよう、溜めと加速感のあるリリースを追加した)
        const windupEnd  = 0.28;
        const releaseEnd = 0.55;
        if (t < windupEnd) {
          const tp   = t / windupEnd;
          const pull = Math.sin(tp * Math.PI * 0.5) * 0.18; // ほんの少し後ろに溜める
          mesh.position.x = a.baseX - a.dir.x * pull;
          mesh.position.z = a.baseZ - a.dir.z * pull;
          const s = baseScale * (1 - tp * 0.06); // わずかに縮んで「溜め」を表現
          mesh.scale.set(s, s, s);
          mesh.rotation.x = -tp * 0.12;
        } else if (t < releaseEnd) {
          const tp    = (t - windupEnd) / (releaseEnd - windupEnd);
          const eased = 1 - Math.pow(1 - tp, 2); // 一気に加速して繰り出す
          const lunge = -0.18 + eased * 0.98;
          mesh.position.x = a.baseX + a.dir.x * lunge;
          mesh.position.z = a.baseZ + a.dir.z * lunge;
          const s = baseScale * (0.94 + eased * 0.22); // 繰り出す瞬間に少し膨らむ
          mesh.scale.set(s, s, s);
          mesh.rotation.x = -0.12 + eased * 0.22;
        } else {
          const tp        = (t - releaseEnd) / (1 - releaseEnd);
          const easedBack = 1 - Math.pow(1 - tp, 3);
          const lunge      = 0.8 * (1 - easedBack);
          mesh.position.x = a.baseX + a.dir.x * lunge;
          mesh.position.z = a.baseZ + a.dir.z * lunge;
          const s = baseScale * (1.16 - easedBack * 0.16);
          mesh.scale.set(s, s, s);
          mesh.rotation.x = 0.1 * (1 - easedBack);
        }
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          mesh.rotation.x = 0;
          delete mesh.userData.atkAnim;
        }
      }
    } else if (mesh.userData.hitAnim) {
      const h = mesh.userData.hitAnim;
      const t = Math.min(1, (performance.now() - h.start) / h.duration);
      const s = baseScale * (1 - Math.sin(t * Math.PI) * 0.15);
      mesh.scale.set(s, s, s);
      const shake = Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
      mesh.position.x = bx + shake;
      mesh.position.z = bz;
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        mesh.position.set(bx, 0, bz);
        delete mesh.userData.hitAnim;
      }
    } else if (mesh.userData.defendAnim) {
      const d = mesh.userData.defendAnim;
      const t = Math.min(1, (performance.now() - d.start) / d.duration);
      const dip = Math.sin(t * Math.PI) * 0.14;
      const s   = baseScale * (1 + dip * 0.4);
      mesh.scale.set(s, s * (1 - dip * 0.5), s);
      mesh.position.y = -dip * 0.5;
      mesh.position.x = bx;
      mesh.position.z = bz;
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        mesh.position.set(bx, 0, bz);
        delete mesh.userData.defendAnim;
      }
    } else {
      // 待機中のブレスアニメーション (弦波ブリング)
      const breathPhase = performance.now() / 1000;
      mesh.position.y = Math.sin(breathPhase * 1.4 + mesh.id) * 0.04
                      + Math.sin(breathPhase * 2.3 + mesh.id * 0.5) * 0.02;
      const breathScale = 1 + Math.sin(breathPhase * 1.2 + mesh.id) * 0.015;
      mesh.scale.set(baseScale * breathScale, baseScale / breathScale, baseScale * breathScale);

      // 腕があれば徐々にニュートラルに戻す（攻撃モーション後の戻り）
      if (mesh.userData.armL) {
        mesh.userData.armL.rotation.x *= 0.78;
        mesh.userData.armR.rotation.x *= 0.78;
        mesh.userData.armL.rotation.z *= 0.78;
        mesh.userData.armR.rotation.z *= 0.78;
      }
    }
  });

  // 全メッシュの更新が終わったあと、攻撃アニメがまだ残っているか調べる
  const anyAtkLeft = [...allyModels, ...enemyBattleModels.filter(Boolean)].some(m => m && m.userData && m.userData.atkAnim);
  if (!anyAtkLeft) {
    // すべての攻撃アニメが終わったらカメラのアクションバリアントをリセット
    battleActionVariant = 'default';
  }
  updateCameraShake();
}

/* ---------------------------------------------------------
   バトルUI ヘルパー
--------------------------------------------------------- */
const overlay        = document.getElementById('battle-overlay');
const battleLog       = document.getElementById('battle-log');
const btnNormalAtk    = document.getElementById('btn-normal-atk');
const btnElementAtk   = document.getElementById('btn-element-atk');
const btnSkill        = document.getElementById('btn-skill');
const btnCapture      = document.getElementById('btn-capture');
const btnDefend       = document.getElementById('btn-defend');
const btnRun          = document.getElementById('btn-run');
const btnItem         = document.getElementById('btn-item');
const itemPanel       = document.getElementById('item-panel');
const itemPanelList   = document.getElementById('item-panel-list');
const btnItemClose    = document.getElementById('btn-item-close');
const queueListEl     = document.getElementById('battle-queue-list');
const activeActorLabel = document.getElementById('active-actor-label');
const btnCmdBack      = document.getElementById('btn-cmd-back');

/** このラウンドでまだ行動していないメンバー(行動中のキャラは含まない) */
let turnQueue     = [];
/** 現在コマンド選択中のキャラ */
let activeFighter = null;
let bossReturnScheduled = false;

let battleLogHideTimer = null;
function log(msg) {
  battleLog.innerHTML = msg;
  battleLog.classList.add('visible');
  clearTimeout(battleLogHideTimer);
  battleLogHideTimer = setTimeout(() => {
    battleLog.classList.remove('visible');
  }, 2200);
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function setActionButtons(enabled) {
  btnNormalAtk.disabled  = !enabled;
  btnElementAtk.disabled = !enabled;
  btnSkill.disabled      = !enabled;
  // つかまえるは全体の有効/無効に加えて、残り回数が尽きていたら常にグレーアウト(2026/07/28 追加)
  btnCapture.disabled    = !enabled || captureUsesLeft <= 0;
  btnDefend.disabled     = !enabled;
  btnRun.disabled        = !enabled;
  btnItem.disabled       = !enabled;
  if (btnCmdBack) btnCmdBack.disabled = !enabled || queuedFighters.length === 0;
}

/** 行動中キャラのコマンドボタン・行動キュー表示を更新する */
function updateCommandUI() {
  if (!activeFighter) return;

  activeActorLabel.textContent = `▶ ${activeFighter.name} の ばん`;
  // 戻るボタンは現在の状態で有効かどうか（既に何かをキューに入れている場合に有効）
  if (btnCmdBack) btnCmdBack.disabled = queuedFighters.length === 0;

  const isTrainer = !!activeFighter.isTrainer;

  // 通常こうげきは誰でも共通
  btnNormalAtk.style.display = 'flex';
  // ぼうぎょも誰でも共通で選べる
  btnDefend.style.display = 'flex';

  if (isTrainer) {
    // プレイヤー: 通常こうげき + つかまえる (+ Lv.10でとくぎ)
    btnElementAtk.style.display = 'none';
    btnCapture.style.display    = 'flex';
    // 残り回数をボタンに表示(2026/07/28 追加: 0になったらグレーアウトはsetActionButtons側で処理)
    const captureTextEl = document.getElementById('capture-text');
    if (captureTextEl) captureTextEl.textContent = `つかまえる×${captureUsesLeft}`;
    btnCapture.classList.toggle('mp-short', captureUsesLeft <= 0);
  } else {
    // 仲間: 通常こうげき + 固有属性こうげき (+ Lv.10でとくぎ)
    btnCapture.style.display    = 'none';
    btnElementAtk.style.display = 'flex';
    btnElementAtk.className = 'btn cmd ' + activeFighter.element + '-btn';
    // 2026/07/25 修正: 「闇こうげき」のような属性名そのままの表示から、
    // モンスターごとの固有名(例: チョコおばけ→ダークボール)に変更
    const moveName = (activeFighter.typeRef && activeFighter.typeRef.moveName)
      || `${ELEMENT_NAMES[activeFighter.element]}こうげき`;
    document.getElementById('element-atk-text').textContent = moveName;
  }

  // とくぎ (全キャラ共通レベルで解放。2026/07/27 修正: MPコスト表示とMP不足時のグレーアウトを追加)
  if ((activeFighter.level || 1) >= SKILL_UNLOCK_LEVEL) {
    const skill = ELEMENT_SKILLS[activeFighter.element];
    const mpCost = (skill && skill.mpCost) || 0;
    const notEnoughMp = (activeFighter.mp || 0) < mpCost;
    btnSkill.style.display = 'flex';
    btnSkill.className = 'btn cmd ' + activeFighter.element + '-btn' + (notEnoughMp ? ' mp-short' : '');
    document.getElementById('skill-text').textContent = `${skill.name} (MP${mpCost})`;
  } else {
    btnSkill.style.display = 'none';
  }

  // キューリストの更新 (行動中キャラ → これから行動するキャラの順)
  queueListEl.innerHTML = '';
  const upcoming = [activeFighter, ...turnQueue];
  upcoming.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    if (i === 0) item.classList.add('active');
    item.textContent = f.name.substring(0, 1);
    item.style.backgroundColor = '#' + f.color.toString(16).padStart(6, '0');
    queueListEl.appendChild(item);
  });
  // queuedFighters を視覚的に示す（小さいスタック表示）
  const queuedStackEl = document.getElementById('queued-stack');
  if (queuedStackEl) {
    queuedStackEl.innerHTML = queuedFighters.map(f => `<div class="queued-chips">${f.name.substring(0,1)}</div>`).join('');
  }
}

function updateHpBar() {
  const e = currentEnemy();
  if (!e) return;
  const pct = Math.max(0, e.hp / e.maxHp);
  const bar = document.getElementById('enemy-hpbar');
  bar.style.width = (pct * 100) + '%';
  bar.className   = 'hpbar-inner' + (pct < 0.25 ? ' critical' : pct < 0.5 ? ' low' : '');
  document.getElementById('enemy-hp-text').textContent =
    `${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`;
  document.getElementById('enemy-name').textContent =
    e.type.name + (e.isBoss ? '(ボス)' : '');
  updateEnemyTargetRow();

  // 敵モデルのターゲット表示が残っている場合、HPが尽きたら解除する
  enemyBattleModels.forEach((m, i) => {
    if (!m) return;
    if (battleState && battleState.enemies[i]) return;
    // その敵がいなくなったらリセット
    m.userData.isTargeted = false;
    m.scale.set(m.userData.baseScale || 1, m.userData.baseScale || 1, m.userData.baseScale || 1);
  });
}

/** 敵が複数いるときに、狙う相手を選べる小さなターゲット行を表示する (2026/07/25 追加) */
function updateEnemyTargetRow() {
  const row = document.getElementById('enemy-target-row');
  if (!row || !battleState) return;
  if (battleState.enemies.length <= 1) {
    row.style.display = 'none';
    row.innerHTML = '';
    return;
  }
  row.style.display = 'flex';
  row.innerHTML = battleState.enemies.map((e, i) => {
    const pct = Math.max(0, e.hp / e.maxHp) * 100;
    return `
      <div class="enemy-target-chip${i === battleState.targetIdx ? ' active' : ''}" data-idx="${i}">
        <div class="enemy-target-name">${e.type.name}</div>
        <div class="hpbar-outer mini"><div class="hpbar-inner" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
  row.querySelectorAll('.enemy-target-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.dataset.idx, 10);
      if (battleState.enemies[idx] && battleState.enemies[idx].hp > 0) {
        battleState.targetIdx = idx;
        updateHpBar();
        // 強調用のターゲットリング（もしモデルがあれば）
        enemyBattleModels.forEach((m, mi) => {
          if (!m) return;
          if (mi === idx) {
            m.userData.isTargeted = true;
            // 小さなスケール強調
            m.scale.set((m.userData.baseScale || 1) * 1.06, (m.userData.baseScale || 1) * 1.06, (m.userData.baseScale || 1) * 1.06);
          } else {
            m.userData.isTargeted = false;
            m.scale.set(m.userData.baseScale || 1, m.userData.baseScale || 1, m.userData.baseScale || 1);
          }
        });
      }
    });
  });
}

function updateAllyHpList() {
  const el = document.getElementById('ally-hp-list');
  const fighters = getAllFighters();
  el.innerHTML = fighters.map(f => {
    const pct = Math.max(0, f.hp / f.maxHp);
    const hpPct = Math.round(pct * 100);
    const hpNum = Math.max(0, Math.ceil(f.hp));
    // 2026/07/27 修正: 元々「AP」というプレースホルダー表示だったが、
    // とくぎ用のMP制を追加したのでそのまま流用する形にした
    const apVal = (typeof f.mp === 'number') ? f.mp : ((typeof f.ap === 'number') ? f.ap : ((typeof f.sp === 'number') ? f.sp : 0));
    // Detect MP max from data if available (maxMp/apMax/maxAp), otherwise fallback to 10
    const apMax = (typeof f.maxMp === 'number') ? f.maxMp : ((typeof f.apMax === 'number') ? f.apMax : ((typeof f.maxAp === 'number') ? f.maxAp : 10));
    const apPct = Math.min(100, Math.round((apMax > 0 ? (apVal / apMax) : 0) * 100));
    const faintedCls = f.hp <= 0 ? ' fainted' : '';
    const activeCls = (activeFighter && activeFighter === f) ? ' active' : '';
    const levelHtml = f.level ? `<div class="ally-card-level">Lv.${f.level}</div>` : '';
    return `
      <div class="ally-card${faintedCls}${activeCls}" data-name="${escapeHtml(f.name)}">
        <div class="ally-card-left">
          <div class="ally-card-icon-wrap"><img class="ally-card-icon" src="${getFighterIconUrl(f)}" alt="${escapeHtml(f.name)}"></div>
          ${levelHtml}
        </div>
        <div class="ally-card-body">
          <div class="ally-card-name">${escapeHtml(f.name)}</div>
          <div class="hp-row">
            <div class="hpbar-outer small"><div class="hpbar-inner ${hpPct < 25 ? 'critical' : hpPct < 50 ? 'low' : ''}" style="width:${hpPct}%"></div></div>
            <div class="hp-num">${hpNum}</div>
          </div>
          <div class="ap-row">
            <div class="ap-label">MP</div>
            <div class="ap-bar-outer"><div class="ap-inner" style="width:${apPct}%"></div></div>
            <div class="ap-val">${Math.floor(apVal)}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function updateBattleHeader() {
  const topBonus = document.getElementById('battle-top-bonus');
  if (!topBonus) return;
  const stage = (typeof STAGES !== 'undefined' && typeof currentStageNo === 'number')
    ? STAGES.find(s => s.no === currentStageNo)
    : null;
  const stageName = stage ? stage.name : 'ステージ';
  const chips = [
    `${stageName}`,
    'けいけんち +0%',
    'ゴールド +0%',
    'ドロップ +0%'
  ];
  topBonus.innerHTML = chips.map(text => `<div class="battle-bonus-chip">${escapeHtml(text)}</div>`).join('');
}

// small helper: escape simple HTML in names
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }


function findModelFor(fighter) {
  return allyModels.find(m => m.userData.fighter === fighter);
}

/* ---------------------------------------------------------
   バトル開始・終了
--------------------------------------------------------- */
function startBattle(enemy) {
  // ボス戦は開始前に一言、会話を挟む (初回のみ。2026/07/26 追加)
  if (enemy.isBoss && typeof getBossIntroLines === 'function') {
    const lines = getBossIntroLines(currentStageNo);
    if (lines && typeof showDialogueOnce === 'function') {
      showDialogueOnce(`seenBossIntro_stage${currentStageNo}`, lines, () => actuallyStartBattle(enemy));
      return;
    }
  }
  actuallyStartBattle(enemy);
}

function actuallyStartBattle(enemy) {
  // ステージ4のボス戦だけ、タケオが一時的にゲスト参戦する (2026/07/28 追加)
  if (enemy.isBoss && currentStageNo === 4 && typeof buildTakeoGuestFighter === 'function') {
    takeoGuestActive = true;
    takeoFighter = buildTakeoGuestFighter();
  } else {
    takeoGuestActive = false;
  }
  const group = buildEncounterGroup(enemy);
  battleState = { enemies: group, targetIdx: 0 };
  pendingActions = [];
  bossReturnScheduled = false;
  // 状態異常のリセット (前回のバトルの束縛・攻撃力低下を持ち越さない)
  getAllFighters().forEach(f => { f.atkDebuffMult = 1; f.atkDebuffTurns = 0; f.bound = false; });
  group.forEach(e => { e.atkDebuffMult = 1; e.atkDebuffTurns = 0; e.bound = false; });

  document.getElementById('battle-title').textContent = enemy.isBoss
    ? `ボスが たちふさがった！ ${enemy.type.name}`
    : (group.length > 1
        ? `やせいの ${enemy.type.name} たちが ${group.length}ひき あらわれた！`
        : `やせいの ${enemy.type.name} があらわれた！`);
  document.getElementById('enemy-name').textContent =
    enemy.type.name + (enemy.isBoss ? '(ボス)' : '');
  log('戦闘開始！');
  if (typeof SFX !== 'undefined') (enemy.isBoss ? SFX.bossAppear() : SFX.menu());
  // 通常戦闘は専用BGMに切り替える(ボス戦は既にボスの間でボスBGMが鳴っているのでそのまま)
  if (!enemy.isBoss && typeof playBgm === 'function') playBgm(BGM_PATHS.battle);
  overlay.style.display = 'flex';
  resizeBattleCanvas();
  // 2026/07/28 修正(重大バグ): フィールド探索用の「パーティ早見パネル」(#party-panel)が
  // 戦闘開始時に隠されておらず、バトル画面の右側にずっと重なって表示され続けていた。
  const fieldPartyPanel = document.getElementById('party-panel');
  if (fieldPartyPanel) fieldPartyPanel.style.display = 'none';
  
  // 背景更新
  updateBattleBackground();
  
  const maxEnemyScale = Math.max(1, ...battleState.enemies.map(e => e.type.battleScale || 1));
  updateIdleCameraForEnemyCount(battleState.enemies.length, getAllFighters().length, maxEnemyScale);
  placeBattleModels();
  // 最初のコマンド選択時は全員が映るようにカメラを引いて表示する
  battleJustStarted = true;
  setBattleCameraMode('action');
  // 入場ズームイン演出
  triggerEnemyEnterAnimation();
  updateHpBar();
  updateAllyHpList();
  updateBattleHeader();
  startRound();
}

/** このラウンドで全員が選んだ行動 (実行はまだ) — 2026/07/25 追加: 全員選択後に素早さ順で一斉実行するため */
let pendingActions = [];
let queuedFighters = []; // プレイヤーがコマンドを選んだ順に積むスタック（戻る操作で使う）;

/**
 * コマンドを1つキューに積んで、次のなかまのコマンド選択に進む。
 * 全員選び終わったら resolveRound() が呼ばれて一斉に実行される。
 */
function queueAction(fighter, run) {
  setActionButtons(false);
  // pendingActions に行動を保存する際に fighter 参照も保持しておく
  pendingActions.push({ fighter, speed: getSpeed(fighter), run });
  queuedFighters.push(fighter);
  nextActor();
}

/** 直前にキューに入れた行動を取り消して、前のキャラへ戻す (UIの「もどる」ボタン用) */
function undoLastQueuedAction() {
  if (queuedFighters.length === 0) return;
  // pendingActionsは同順で積まれているはずなので末尾を取り除く
  const lastAction = pendingActions.pop();
  const lastFighter = queuedFighters.pop();

  // 2026/07/28 修正(重大バグ): 今まではここで lastFighter を turnQueue の先頭に
  // 戻した上で activeFighter にも設定していたため、その後 queueAction() → nextActor()
  // で turnQueue からもう一度 lastFighter が取り出されてしまい、同じキャラが
  // 2回連続で行動できてしまっていた。さらに、「もどる」を押した時点で選択中だった
  // (まだ行動を確定していない)キャラが turnQueue のどこにも戻されず、
  // そのラウンドから完全に消えてしまう問題もあった。
  //
  // 正しくは: 選択中だったキャラ(あれば)を turnQueue の先頭に戻し、
  // 直前に確定したキャラ(lastFighter)は turnQueue には入れず activeFighter にだけ
  // 設定して再選択させる(再選択後は queueAction() が改めて次のキャラへ進めてくれる)。
  if (activeFighter && activeFighter !== lastFighter) {
    turnQueue.unshift(activeFighter);
  }
  activeFighter = lastFighter;

  hideAllAllyModels();
  showAllyModel(activeFighter, true);
  setBattleCameraMode('action');
  setActionButtons(true);
  updateCommandUI();
}

if (btnCmdBack) {
  btnCmdBack.addEventListener('click', () => {
    undoLastQueuedAction();
  });
}

/** 新しいラウンドを開始する (パーティ全員の行動キューを組み直す) */
function startRound() {
  if (!battleState) return;
  // 前ラウンドで発動した「ぼうぎょ」の効果はここでリセットする
  // (敵の反撃 → finishEnemyTurn → startRound の順で呼ばれるため、
  //  防御の効果が実際に使われた"後"にリセットされる)
  getAllFighters().forEach(f => { f.defending = false; });
  turnQueue = getAllFighters().filter(f => f.hp > 0);
  // ラウンド開始時は queuedFighters をクリアしておく
  queuedFighters = [];
  nextActor();
}

/** キューから次のキャラを取り出してコマンド選択を促す。全員選び終わったら resolveRound() へ */
function nextActor() {
  if (!battleState) return;
  if (turnQueue.length === 0) {
    resolveRound();
    return;
  }
  const f = turnQueue.shift();
  if (f.bound) {
    log(`${f.name} は からみつかれて うごけない！`);
    f.bound = false;
    nextActor();
    return;
  }
  activeFighter = f;
  hideAllAllyModels();

  // タケオ(ゲストNPC)は操作させず、自動で通常こうげきを行う (2026/07/28 追加)
  if (f.isGuestNPC) {
    setBattleCameraMode('idle');
    itemPanel.style.display = 'none';
    setActionButtons(false);
    queueAction(f, () => executeSingleAttack(f, null));
    return;
  }

  // バトル開始直後の最初の選択ではカメラを引いたままにする
  if (battleJustStarted) {
    setBattleCameraMode('action');
    battleJustStarted = false;
  } else {
    setBattleCameraMode('idle');
  }
  itemPanel.style.display = 'none';
  updateCommandUI();
  setActionButtons(true);
}

function endBattle() {
  overlay.style.display = 'none';
  itemPanel.style.display = 'none';
  clearBattleModels();
  battleState = null;
  takeoGuestActive = false; // タケオはボス戦限定のゲストなので、戦闘が終わったら外れる (2026/07/28 追加)
  updatePartyPanel();
  // 2026/07/28 修正: 戦闘開始時に隠したparty-panelをフィールドに戻すタイミングで再表示する。
  // ただし島にいる場合(通常は無いが念のため)は表示しない。
  const fieldPartyPanel = document.getElementById('party-panel');
  const islandOpen = document.getElementById('island-overlay')?.style.display !== 'none';
  if (fieldPartyPanel && !islandOpen) fieldPartyPanel.style.display = 'block';
  // 戦闘終了直後にすぐ再エンカウントしないよう猶予を設ける
  encounterGraceUntil = performance.now() + ENCOUNTER_GRACE_MS;
  resumeExplorationBgm();
}

/** 戦闘が終わったとき、探索していた場所のBGMに戻す (2026/07/26 追加) */
function resumeExplorationBgm() {
  if (typeof playBgm !== 'function') return;
  if (currentMapMode === 'bossArena') {
    playBgm(getBossBgm(currentStageNo));
  } else {
    playBgm(getStageBgm(currentStageNo));
  }
}

let bossReturnTimeoutId = null;

/**
 * ボス撃破後、しばらくしてから島へ戻る。
 * ※ このタイマーは「島へ戻る」処理のみを行う。戦闘画面を閉じてボスの間を
 *   歩けるようにする処理(endBattle)は呼び出し側で別途すぐに行うこと。
 *   (2026/07/25 修正: 以前はendBattleもこのタイマー任せだったため、
 *    金の宝箱を取りに行く前にボスの間へすら出られないバグがあった)
 * 金の宝箱を開けると短い遅延で上書き予約されるので、
 * 通常は「宝箱を取ってからすぐ戻る」形になる。
 * 宝箱を無視して放置した場合の保険として、既定では長めの猶予(15秒)を確保する。
 * @param {number} delayMs
 */
function scheduleBossReturn(delayMs = 15000) {
  bossReturnScheduled = true;
  if (bossReturnTimeoutId) clearTimeout(bossReturnTimeoutId);
  bossReturnTimeoutId = setTimeout(() => {
    try { openIslandOverlay(); } catch (err) {
      const island = document.getElementById('island-overlay');
      if (island) island.style.display = 'flex';
    }
    showToast('しまに戻ってきた！');
  }, delayMs);
}

/* ---------------------------------------------------------
   敵の反撃
--------------------------------------------------------- */
/**
 * このラウンドの行動をすべて集め、素早さ順に一斉実行する。
 * (2026/07/25 追加: 以前は1人選ぶ→即実行の繰り返しだったが、
 *  全員のコマンドを選び終えてから一斉に行動する方式に変更)
 */
async function resolveRound() {
  if (!battleState) return;
  itemPanel.style.display = 'none';
  activeFighter = null;
  activeActorLabel.textContent = '';
  queueListEl.innerHTML = '';

  const enemyActions = buildEnemyActions();
  const allActions = [...pendingActions, ...enemyActions].sort((a, b) => b.speed - a.speed);
  pendingActions = [];
  // 戻る操作のための queuedFighters スタックをリセットする（ラウンド実行後は不要）
  queuedFighters = [];

  for (const action of allActions) {
    if (!battleState) return;
    const enemiesLeft = battleState.enemies.some(e => e.hp > 0);
    const alliesLeft  = getPlayerFighters().some(f => f.hp > 0);
    if (!enemiesLeft || !alliesLeft) break;
    await action.run();
    await wait(500);
  }
  if (!battleState) return;
  finishRoundBookkeeping();
}

/** 生きている敵それぞれの行動を1つずつ組み立てる */
function buildEnemyActions() {
  if (!battleState) return [];
  return battleState.enemies
    .filter(e => e.hp > 0)
    .map(e => ({ speed: getSpeed(e), run: () => performEnemyAction(e) }));
}

/** 敵1体分の行動を実行する (旧enemyCounterattackを複数体対応にしたもの) */
async function performEnemyAction(e) {
  if (!battleState || e.hp <= 0) return;

  // 束縛されていたら反撃できない (からみつくツタ の効果)
  if (e.bound) {
    e.bound = false;
    log(`${e.type.name} は からみつかれて うごけない！`);
    await wait(500);
    return;
  }

  const alive = getAllFighters().filter(f => f.hp > 0);
  if (alive.length === 0) return;

  const target      = alive[Math.floor(Math.random() * alive.length)];
  const targetModel = findModelFor(target);
  const mesh         = enemyMeshFor(e);
  showAllyModel(target, true);
  setBattleCameraMode('action');
  await wait(400); // 敵の行動も一拍おいてから繰り出す(のちのち「近づいてくる」モーションを挟む余地を作っておく)
  if (!battleState) return;
  triggerAttackMotion(mesh, { x: 0, z: 1 }, 'normal', { element: e.type ? e.type.element : null });

  // 一定確率で敵も固有属性のとくぎを使ってくる(捕獲後どんな技を使えるかのプレビューにもなる)
  const skill = Math.random() < 0.3 ? ELEMENT_SKILLS[e.type.element] : null;

  await wait(280);
  if (!battleState) return;

  if (skill && skill.healPct) {
    // 水: 攻撃せず自己回復
    const healAmt = Math.round(e.maxHp * skill.healPct);
    e.hp = Math.min(e.maxHp, e.hp + healAmt);
    spawnElementEffect(mesh, e.type.element, { skill: true });
    showDamagePopup(healAmt, false, true, 'enemy');
    updateHpBar();
    await wait(400);
    return;
  }

  let dmg = Math.max(1, Math.round((e.type.atk || 5) * (0.8 + Math.random() * 0.4)));
  if (e.atkDebuffTurns > 0) dmg = Math.round(dmg * e.atkDebuffMult);
  if (skill) dmg = Math.round(dmg * skill.dmgMult);

  // のしかかり専用モーション (bodySlamフラグがある敵タイプの時)
  const useBodySlam = e.type.bodySlam && Math.random() < 0.45;
  if (useBodySlam) {
    triggerAttackMotion(mesh, { x: 0, z: 1 }, 'bodyslam', { element: e.type ? e.type.element : null });
    dmg = Math.round(dmg * 1.4); // のしかかりは強力
  } else {
    // ランダムにモーションを切り替え
    const motionType = Math.random() < 0.35 ? 'spin'
                      : Math.random() < 0.5  ? 'jump'
                      : 'normal';
    triggerAttackMotion(mesh, { x: 0, z: 1 }, motionType, { element: e.type ? e.type.element : null });
  }

  let defended = false;
  if (target.defending) {
    dmg = Math.max(1, Math.round(dmg * DEFEND_DAMAGE_REDUCTION));
    defended = true;
  }

  target.hp = Math.max(0, target.hp - dmg);
  if (defended) log(`<span style="color:var(--defend);">${target.name} は ぼうぎょして ダメージを おさえた！</span>`);
  triggerHitReaction(targetModel, { element: e.type.element });
  if (skill) spawnElementEffect(targetModel, e.type.element, { skill: true });
  showDamagePopup(dmg, useBodySlam, false, 'ally');
  updateAllyHpList();

  if (target.hp <= 0) log(`${target.name} は たおれた！`);

  if (skill && skill.bindTarget && target.hp > 0) {
    target.bound = true;
    log(`${target.name} は からみつかれて うごけなくなった！`);
  }
  if (skill && skill.atkDebuffMult && target.hp > 0) {
    target.atkDebuffMult = skill.atkDebuffMult;
    target.atkDebuffTurns = skill.debuffTurns;
    log(`${target.name} の こうげきりょくが さがった！`);
  }
  if (skill && skill.cleanseSelf) {
    e.atkDebuffTurns = 0; e.atkDebuffMult = 1; e.bound = false;
    log(`${e.type.name} は ちからを とりもどした！`);
  }

  await wait(useBodySlam ? 1300 : 450);
}

/** ラウンド終了後の共通後処理 (勝敗判定・デバフのターン経過・次ラウンドへ) */
function finishRoundBookkeeping() {
  if (!battleState) return;
  const stillAlive = getPlayerFighters().some(f => f.hp > 0);
  if (!stillAlive) {
    if (typeof SFX !== 'undefined') SFX.wipe();
    const lostCoins = Math.min(coins, Math.round(coins * WIPE_PENALTY_COIN_RATIO));
    coins -= lostCoins;
    updateCurrencyUI();
    log(lostCoins > 0
      ? `みんな たおれてしまった…しまに はこばれた…(コイン-${lostCoins})`
      : 'みんな たおれてしまった…しまに はこばれた…');
    setActionButtons(false);
    setTimeout(() => {
      endBattle();
      openIslandOverlay();
      showToast(lostCoins > 0 ? `しまに はこばれた…コインを ${lostCoins} おとしてしまった` : 'しまに はこばれた…');
    }, 1600);
    return;
  }

  // 味方にかかった攻撃力低下のターン経過
  getAllFighters().forEach(f => {
    if (f.atkDebuffTurns > 0) {
      f.atkDebuffTurns--;
      if (f.atkDebuffTurns <= 0) f.atkDebuffMult = 1;
    }
  });
  // 敵にかかった攻撃力低下のターン経過
  battleState.enemies.forEach(e => {
    if (e.atkDebuffTurns > 0) {
      e.atkDebuffTurns--;
      if (e.atkDebuffTurns <= 0) e.atkDebuffMult = 1;
    }
  });

  // 2026/07/26 修正: ラウンドの途中(まだ全員の行動が終わる前)に敵を全滅させていた場合、
  // handleEnemyDefeated側で既に勝利処理(endBattle/scheduleBossReturnの予約)が
  // 走っているので、ここで新しいラウンドを始めてはいけない。
  // これを怠ると、勝利アニメーションを待っている間に無意味な「おまけラウンド」の
  // コマンド選択が始まってしまい、何を押しても反応が無いように見える(フリーズしたように見える)
  // バグがあった。
  const enemiesStillAlive = battleState.enemies.some(e => e.hp > 0);
  if (!enemiesStillAlive) return;

  startRound();
}

/* ---------------------------------------------------------
   コマンドの実行 (通常こうげき / 属性こうげき / つかまえる)
--------------------------------------------------------- */
btnNormalAtk.addEventListener('click', () => {
  if (!battleState || btnNormalAtk.disabled || !activeFighter) return;
  // 2026/07/26 修正: activeFighterは後で(ラウンド実行時に)別のキャラや
  // nullに変わってしまう共有変数なので、クロージャの中でそのまま参照すると
  // 実行タイミングによってはnullを読んでクラッシュする。ローカル変数に
  // 値を退避してから使うことで、選んだ瞬間のキャラを確実に保持する。
  const fighter = activeFighter;
  queueAction(fighter, () => executeSingleAttack(fighter, null));
});

btnElementAtk.addEventListener('click', () => {
  if (!battleState || btnElementAtk.disabled || !activeFighter || activeFighter.isTrainer) return;
  const fighter = activeFighter;
  queueAction(fighter, () => executeSingleAttack(fighter, fighter.element));
});

btnCapture.addEventListener('click', () => {
  if (!battleState || btnCapture.disabled || !activeFighter || !activeFighter.isTrainer) return;
  queueAction(activeFighter, () => executeCapture());
});

btnDefend.addEventListener('click', () => {
  if (!battleState || btnDefend.disabled || !activeFighter) return;
  const fighter = activeFighter;
  queueAction(fighter, () => executeDefend(fighter));
});

/** ぼうぎょの実行 (誰でも選べる。このラウンドの敵の攻撃で狙われた際の被ダメージを軽減する) */
async function executeDefend(fighter) {
  const model = findModelFor(fighter);
  showAllyModel(fighter, true);
  setBattleCameraMode('action');
  triggerDefendMotion(model);
  fighter.defending = true;
  updateAllyHpList();
  if (typeof SFX !== 'undefined') SFX.defend();
  await wait(320);
}

btnSkill.addEventListener('click', () => {
  if (!battleState || btnSkill.disabled || !activeFighter) return;
  if ((activeFighter.level || 1) < SKILL_UNLOCK_LEVEL) return;
  const fighter = activeFighter;
  const skill = ELEMENT_SKILLS[fighter.element];
  const mpCost = (skill && skill.mpCost) || 0;
  if ((fighter.mp || 0) < mpCost) {
    log(`<span style="color:var(--red);">MPが たりない！ (のこり${Math.floor(fighter.mp || 0)}/ひつよう${mpCost})</span>`);
    return;
  }
  queueAction(fighter, () => executeSkillAttack(fighter));
});

/** とくぎの実行 (Lv.10で解放。属性ごとに固有の追加効果を持つ) */
async function executeSkillAttack(fighter) {
  const skill = ELEMENT_SKILLS[fighter.element];
  const e = currentEnemy();
  if (!e) return;
  // MP消費 (2026/07/27 追加)
  fighter.mp = Math.max(0, (fighter.mp || 0) - ((skill && skill.mpCost) || 0));
  updateAllyHpList();
  const enemyElement = e.type.element;
  const affinity = ELEMENT_AFFINITY[fighter.element]?.[enemyElement] || 1.0;

  const model = findModelFor(fighter);
  const targetMesh = enemyMeshFor(e);
  showAllyModel(fighter, true);

  // とくぎは「使い手だけを大きく映す」演出に統一(2026/07/28 変更:
  // 以前は wide/close/medium いずれも画面全体が映ってしまっていたため)
  const SKILL_MOTION_MAP = { fire: 'spin', water: 'jump', nature: 'jump', dark: 'spin', light: 'spin' };
  setBattleCameraMode('action');
  snapCameraToSkillFocus(fighter); // じわっと寄るのではなく一瞬でパッと切り替える
  triggerSkillBurst(fighter.element);
  showSkillBanner(skill.name, fighter.element);
  spawnSkillChargeEffect(model, fighter.element);
  await wait(400); // とくぎは通常こうげきより長めの「ため」で演出にメリハリを出す
  if (!battleState) { battleActionVariant = 'default'; return; }
  const motionType = SKILL_MOTION_MAP[fighter.element] || 'normal';
  // 技は属性情報を meta として渡して、モーション側で要素別の追加表現ができるようにする
  triggerAttackMotion(model, { x: 0, z: -1 }, motionType, { element: fighter.element });
  await wait(220);
  if (!battleState) { battleActionVariant = 'default'; return; }

  // 着弾の瞬間だけ敵側のクローズアップにスナップカットして「当たった」感を出す
  battleActionVariant = 'close';
  battleCameraCurrentPos.copy(BATTLE_CAM_ACTION_POS_CLOSE);
  battleCameraCurrentLook.copy(BATTLE_CAM_ACTION_LOOK_CLOSE);

  let dmg = Math.max(1, Math.round(fighter.atk + Math.random() * 5));
  if (fighter.atkDebuffTurns > 0) dmg = Math.round(dmg * fighter.atkDebuffMult);
  dmg = Math.round(dmg * affinity * skill.dmgMult);

  e.hp -= dmg;
  if (affinity > 1.0) {
    log('<span style="color:var(--red);">こうかは ばつぐんだ！</span>');
  } else if (affinity < 1.0) {
    log('<span style="color:var(--gold);">こうかは いまひとつ のようだ…</span>');
  }
  triggerHitReaction(targetMesh, { big: true });
  spawnElementEffect(targetMesh, fighter.element, { skill: true });
  showDamagePopup(dmg, true, false, 'enemy');
  updateHpBar();

  if (skill.healPct) {
    let healedAny = false;
    getAllFighters().forEach(f => {
      if (f.hp > 0 && f.hp < f.maxHp) {
        f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * skill.healPct));
        healedAny = true;
      }
    });
    if (healedAny) { log('なかま全員が すこし かいふくした！'); updateAllyHpList(); }
  }

  if (e.hp <= 0) {
    handleEnemyDefeated(e);
    await wait(200);
    battleActionVariant = 'default';
    return;
  }

  if (skill.bindTarget) {
    e.bound = true;
    log(`${e.type.name} は からみつかれて うごけなくなった！`);
  }
  if (skill.atkDebuffMult) {
    e.atkDebuffMult = skill.atkDebuffMult;
    e.atkDebuffTurns = skill.debuffTurns;
    log(`${e.type.name} の こうげきりょくが さがった！`);
  }
  if (skill.cleanseSelf) {
    getAllFighters().forEach(f => { f.atkDebuffTurns = 0; f.atkDebuffMult = 1; f.bound = false; });
    log('なかま全員の からだの へんかが もとにもどった！');
  }

  await wait(180);
  battleActionVariant = 'default';
}

/**
 * 1体のキャラでこうげきを実行する。
 * @param {object} fighter - 行動するキャラ
 * @param {string|null} element - 属性こうげきなら固有属性キー、通常こうげきなら null(無属性・等倍)
 */
async function executeSingleAttack(fighter, element) {
  const e = currentEnemy();
  if (!e) return;
  updateAllyHpList();
  const enemyElement = e.type.element;
  const affinity = element ? (ELEMENT_AFFINITY[element]?.[enemyElement] || 1.0) : 1.0;

  const model = findModelFor(fighter);
  const targetMesh = enemyMeshFor(e);
  showAllyModel(fighter, true);
  // 通常攻撃でも属性がある場合は少しだけカメラバリアントを変える（属性に合わせた見せ方）
  const SKILL_CAMERA_VARIANT = { fire: 'wide', water: 'close', nature: 'medium', dark: 'close', light: 'wide' };
  const SKILL_MOTION_MAP = { fire: 'spin', water: 'jump', nature: 'jump', dark: 'spin', light: 'spin' };
  if (element) battleActionVariant = SKILL_CAMERA_VARIANT[element] || 'default';

  setBattleCameraMode('action');
  if (element) {
    const moveName = (fighter.typeRef && fighter.typeRef.moveName) || `${ELEMENT_NAMES[element]}こうげき`;
    log(`${fighter.name}の 「${moveName}」！`);
  }
  await wait(350); // カメラが切り替わってから一拍おいて攻撃を始める(「間」を持たせる)
  if (!battleState) { battleActionVariant = 'default'; return; }
  const motionType = element ? (SKILL_MOTION_MAP[element] || 'normal') : 'normal';
  triggerAttackMotion(model, { x: 0, z: -1 }, motionType, { element: element });
  await wait(200);
  if (!battleState) { battleActionVariant = 'default'; return; }

  let dmg = Math.max(1, Math.round(fighter.atk + Math.random() * 5));
  if (fighter.atkDebuffTurns > 0) dmg = Math.round(dmg * fighter.atkDebuffMult);
  // 属性こうげきには自属性ボーナス(STAB)がかかる。通常こうげきは常に等倍のまま
  dmg = Math.round(dmg * affinity * (element ? ELEMENT_ATK_STAB : 1));

  if (affinity > 1.0) {
    log('<span style="color:var(--red);">こうかは ばつぐんだ！</span>');
  } else if (affinity < 1.0) {
    log('<span style="color:var(--gold);">こうかは いまひとつ のようだ…</span>');
  }

  e.hp -= dmg;
  triggerHitReaction(targetMesh, { big: affinity > 1.0 });
  if (element) spawnElementEffect(targetMesh, element); // 通常の属性攻撃は skill:false のまま
  showDamagePopup(dmg, affinity > 1.0, false, 'enemy');
  updateHpBar();

  if (e.hp <= 0) {
    handleEnemyDefeated(e);
    await wait(200);
    battleActionVariant = 'default';
    return;
  }

  await wait(180);
  battleActionVariant = 'default';
}

/** ステージクリア共通処理 (次ステージ解放 + オートセーブ)。撃破・捕獲どちらからも呼ばれる */
function unlockNextStageAndSave() {
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stageClear, false);
  const nextStage = STAGES.find(st => st.no === currentStageNo + 1);
  if (nextStage && !nextStage.unlocked) {
    nextStage.unlocked = true;
    const dots = document.querySelectorAll('.stage-dot');
    const dot  = dots[nextStage.no - 1];
    if (dot) dot.classList.remove('locked');
  }
  if (typeof saveGame === 'function') saveGame(false);
}

/**
 * 敵を1体、戦闘から取り除く共通処理 (倒された/捕獲された 両方から呼ばれる)。
 * まだ他の敵が生きていれば戦闘継続(false)、全滅していれば戦闘終了(true)を返す。
 * 2026/07/25 追加: 複数体バトル対応
 */
function removeEnemyFromBattle(e) {
  e.alive = false;
  if (e.mesh) { try { scene.remove(e.mesh); disposeModel(e.mesh); } catch (err) { /* noop */ } }

  const idx = battleState.enemies.indexOf(e);
  if (idx !== -1) {
    battleState.enemies.splice(idx, 1);
    const m = enemyBattleModels[idx];
    if (m) { battleScene.remove(m); disposeModel(m); }
    enemyBattleModels.splice(idx, 1);
  }
  if (battleState.targetIdx >= battleState.enemies.length) {
    battleState.targetIdx = Math.max(0, battleState.enemies.length - 1);
  }

  if (battleState.enemies.length > 0) {
    updateHpBar();
    return false;
  }
  return true;
}

/**
 * ボスを倒した/つかまえた直後の共通シーケンス。
 * 会話があれば先に見せてから、宝箱・ステージクリア処理に進む。
 * (2026/07/26 追加)
 */
function runBossVictorySequence(captured) {
  const lines = (typeof getBossVictoryLines === 'function') ? getBossVictoryLines(currentStageNo) : null;

  const proceed = () => {
    let chestSpawned = false;
    if (typeof spawnChest === 'function' && currentMapMode === 'bossArena') {
      // 2026/07/27 修正: 以前は (0, -3.8) 固定で、戦闘開始位置(プレイヤーの目の前)に
      // かなり近く、出現と同時に「あけますか？」が出てすぐ開いてしまっていた。
      // ボスがいた場所(0, -6)のさらに奥に出すことで、歩いて取りに行く距離を確保する。
      spawnChest(0, -8, true);
      chestSpawned = true;
      showToast(captured
        ? 'ボスをつかまえた！ 金の宝箱が出現した！ 取ってから しまにもどろう'
        : 'ボスを倒した！ 金の宝箱が出現した！ 取ってから しまにもどろう');
    }
    // まず戦闘画面を閉じてボスの間を歩けるようにする (これをしないと宝箱を取りに行けない)
    setTimeout(endBattle, 900);
    // 金の宝箱があるときは、開けるまで長めに猶予をとる(取り忘れ防止)。
    scheduleBossReturn(chestSpawned ? 15000 : 1800);
    log('ステージクリア！');
    unlockNextStageAndSave();
  };

  if (lines && typeof showDialogueOnce === 'function') {
    setTimeout(() => showDialogueOnce(`seenBossVictory_stage${currentStageNo}`, lines, proceed), 500);
  } else {
    proceed();
  }
}

/** 敵を倒したときの共通処理 (経験値・コイン獲得・ステージクリア判定) */
function handleEnemyDefeated(e) {
  log(`${e.type.name} をたおした！`);

  // 勝利パーティクル
  spawnVictoryParticles();

  // 経験値とコイン獲得
  const gainedExp = Math.round(e.type.baseHp * 0.5);
  const gainedCoins = Math.round(e.type.baseHp * 0.3) + 2;
  log(`なかま全員が ${gainedExp} のけいけんちをえた！`);
  log(`コイン+${gainedCoins} を手に入れた！`);
  coins += gainedCoins;
  updateCurrencyUI();

  // 全味方に経験値を分配
  getAllFighters().forEach(f => {
    if (f.hp > 0) gainExp(f, gainedExp);
  });

  const allDefeated = removeEnemyFromBattle(e);
  if (!allDefeated) return; // まだ他の敵が残っている→そのまま戦闘継続
  if (typeof SFX !== 'undefined') SFX.victory();

  if (e.isBoss) {
    runBossVictorySequence(false);
  } else {
    setTimeout(endBattle, 900);
  }
}

/** 捕獲処理 (プレイヤーの自分のターンにのみ選択可能) */
async function executeCapture() {
  const e = currentEnemy();
  if (!e) return;

  // つかまえる回数を消費 (成功・失敗にかかわらず1回分減る。2026/07/28 追加)
  captureUsesLeft = Math.max(0, captureUsesLeft - 1);
  updateCommandUI();

  const hpPct    = Math.max(0, e.hp / e.maxHp);
  const baseChance = 0.15 + (1 - hpPct) * 0.65;
  let chance = Math.min(0.95, baseChance * e.type.catchMod);
  // ボスは通常のモンスターよりずっとつかまえにくい (2026/07/25 修正:
  // 以前はボスを一切つかまえられず、必ず「たおす」しかできなかったバグを修正)
  if (e.isBoss) chance = Math.min(0.5, chance * BOSS_CATCH_PENALTY);
  log(`ボールをなげた！ (成功率 約${Math.round(chance * 100)}%)`);
  if (typeof SFX !== 'undefined') SFX.captureThrow();

  const flash = document.getElementById('catch-flash');
  flash.style.opacity = '0.6';
  await wait(150);
  flash.style.opacity = '0';
  await wait(350);
  if (!battleState) return;

  if (Math.random() < chance) {
    log(`やった！ ${e.type.name} をつかまえた！`);
    if (typeof SFX !== 'undefined') SFX.captureSuccess();

    const rolledRarity = rollRarity();
    const captured = {
      name:    e.type.name,
      color:   e.type.color,
      hp:      Math.round(e.type.baseHp * 0.8),
      maxHp:   e.type.baseHp,
      atk:     Math.round(4 + e.type.baseHp / 10),
      typeRef: e.type,
      element: e.type.element,
      level:   calcCaptureLevel(rolledRarity, e.isBoss),
      exp:     0,
      rarity:  rolledRarity,
      // MP (2026/07/27 追加: とくぎ使用に必要)
      mp:      (typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30,
      maxMp:   (typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30,
    };

    // パーティに空きがあればそのまま加入、満員ならボックスへ预ける
    if (party.length < MAX_PARTY) {
      party.push(captured);
      addFieldFollower(e.type);
      updatePartyPanel();
      showToast(`${e.type.name} が なかまになった！`);
    } else {
      box.push(captured);
      updatePartyPanel();
      showToast(`${e.type.name} が なかまになった！(パーティがいっぱいなので ボックスへ)`);
    }

    // 捕獲成功時も経験値とコイン獲得
    const gainedExp = Math.round(e.type.baseHp * 0.5);
    const gainedCoins = Math.round(e.type.baseHp * 0.3) + 2;
    log(`なかま全員が ${gainedExp} のけいけんちをえた！`);
    log(`コイン+${gainedCoins} を手に入れた！`);
    coins += gainedCoins;
    updateCurrencyUI();
    
    getAllFighters().forEach(f => {
      if (f.hp > 0) gainExp(f, gainedExp);
    });

    if (typeof saveGame === 'function') saveGame(false);

    const allDefeated = removeEnemyFromBattle(e);
    if (!allDefeated) { await wait(200); return; } // まだ他の敵が残っている→戦闘継続
    if (typeof SFX !== 'undefined') SFX.victory();

    if (e.isBoss) {
      // ボスを捕獲した場合も「たおした」場合と同様にステージクリア扱いにする
      runBossVictorySequence(true);
    } else {
      setTimeout(endBattle, 900);
    }
  } else {
    log(`あ！ボールから ${e.type.name} が でてしまった…`);
    if (typeof SFX !== 'undefined') SFX.captureFail();
    await wait(300);
  }
}

/* ---------------------------------------------------------
   アイテム (きずぐすり) — シンプルな回復アイテム。所持数はセッション内のみ保持。
--------------------------------------------------------- */
let consumables = { potion: 3, revive: 1 };
const POTION_HEAL      = 40;
const REVIVE_HEAL_PCT  = 0.5; // ふっかつのくすりで戻るHPの割合(最大HPの50%)

function renderItemPanel() {
  const canUsePotion = consumables.potion > 0 && !!battleState;
  const hasFainted   = !!battleState && getAllFighters().some(f => f.hp <= 0);
  const canUseRevive = consumables.revive > 0 && !!battleState && hasFainted;
  itemPanelList.innerHTML = `
    <div class="item-row">
      <span>きずぐすり (のこり${consumables.potion}) HP+${POTION_HEAL}</span>
      <button class="btn" id="btn-use-potion" ${canUsePotion ? '' : 'disabled'}>つかう</button>
    </div>
    <div class="item-row">
      <span>ふっかつのくすり (のこり${consumables.revive}) HP${Math.round(REVIVE_HEAL_PCT * 100)}%で復活</span>
      <button class="btn" id="btn-use-revive" ${canUseRevive ? '' : 'disabled'}>つかう</button>
    </div>`;
  const useBtn = document.getElementById('btn-use-potion');
  if (useBtn) useBtn.addEventListener('click', usePotion);
  const reviveBtn = document.getElementById('btn-use-revive');
  if (reviveBtn) reviveBtn.addEventListener('click', useRevive);
}

function usePotion() {
  if (consumables.potion <= 0 || !battleState || !activeFighter) return;
  consumables.potion--;
  itemPanel.style.display = 'none';
  queueAction(activeFighter, () => performPotionHeal());
}

/** きずぐすりの効果を実行する (対象は実行時点でいちばんHPが減っている味方) */
async function performPotionHeal() {
  const alive = getAllFighters().filter(f => f.hp > 0);
  if (alive.length === 0) return;

  const target = alive.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
  target.hp = Math.min(target.maxHp, target.hp + POTION_HEAL);

  showAllyModel(target, true);
  setBattleCameraMode('action');
  showDamagePopup(POTION_HEAL, false, true, 'ally');
  updateAllyHpList();

  await wait(500);
}

function useRevive() {
  if (consumables.revive <= 0 || !battleState || !activeFighter) return;
  if (!getAllFighters().some(f => f.hp <= 0)) return; // 倒れている仲間がいない時は使えない
  consumables.revive--;
  itemPanel.style.display = 'none';
  queueAction(activeFighter, () => performReviveHeal());
}

/** ふっかつのくすりの効果を実行する (対象は倒れている仲間のうち先頭の1人) */
async function performReviveHeal() {
  const fainted = getAllFighters().find(f => f.hp <= 0);
  if (!fainted) return;

  fainted.hp = Math.max(1, Math.round(fainted.maxHp * REVIVE_HEAL_PCT));

  showAllyModel(fainted, true);
  setBattleCameraMode('action');
  showDamagePopup(fainted.hp, false, true, 'ally');
  updateAllyHpList();

  if (typeof SFX !== 'undefined') SFX.levelUp(); // 復活の華やかさを既存のレベルアップ音で代用
  await wait(600);
}

btnItem.addEventListener('click', () => {
  if (!battleState || btnItem.disabled || !activeFighter) return;
  const showing = itemPanel.style.display === 'block';
  if (showing) {
    itemPanel.style.display = 'none';
  } else {
    renderItemPanel();
    itemPanel.style.display = 'block';
  }
});

btnItemClose.addEventListener('click', () => {
  itemPanel.style.display = 'none';
});

/* ---------------------------------------------------------
   にげる コマンド
--------------------------------------------------------- */
btnRun.addEventListener('click', async () => {
  if (!battleState || btnRun.disabled || !activeFighter) return;
  setActionButtons(false);

  const e = currentEnemy();
  if (!e) { nextActor(); return; }

  // ボスからは絶対に逃げられない
  if (e.isBoss) {
    log('ボスからは にげられない！');
    await wait(1000);
    if (!battleState) return;
    nextActor();
    return;
  }

  // にげるはパーティ全体の決断として扱う。まだ選んでいない仲間の選択はスキップし、
  // すでに選ばれていた仲間の行動もキャンセルして、1回のロールで全員の運命を決める。
  // (2026/07/27 修正: 以前は選んだ本人だけの判定になっていて、失敗しても他の
  //  仲間はそのまま行動を選び続けられ、「一人だけ勝手ににげようとした」ように
  //  見えてしまっていた)
  turnQueue      = [];
  pendingActions = [];
  queuedFighters = [];
  activeFighter  = null;

  // 逃走成功確率の計算。敵の強さ(HP/攻撃力/逃走耐性)を反映し、
  // 弱い敵は逃げやすく、強い敵はほぼ逃げられないようにする。
  const partyLevels = getAllFighters().map(f => f.level || 1);
  const maxPartyLevel = Math.max(...partyLevels);
  const enemyLevel = Math.max(1, Math.round(e.maxHp / 6 + e.type.atk / 2));
  const resistance = Math.min(0.95, e.type.fleeResistance ?? 0.35);
  let runChance = 0.82 - resistance * 0.78 + (maxPartyLevel - enemyLevel) * 0.018;
  runChance = Math.max(0.04, Math.min(0.88, runChance));

  log(`パーティ全員で にげだそうと している… (成功率: 約${Math.round(runChance * 100)}%)`);
  await wait(800);
  if (!battleState) return;

  if (Math.random() < runChance) {
    log('うまく にげきれた！');
    const fledEnemy = e;
    setTimeout(() => {
      // その場にいる敵からすぐ再エンカウントしないよう、引き離してから戦闘を終える
      if (typeof pushEnemyAway === 'function') pushEnemyAway(fledEnemy);
      endBattle();
    }, 800);
  } else {
    log('にげられなかった！ このラウンドは なにもできない…');
    await wait(1000);
    if (!battleState) return;
    // 逃走失敗: パーティの行動はすべて無駄になり、敵だけがこのラウンド行動する
    // (pendingActionsは既に空にしてあるので、resolveRound()は敵の行動だけを実行する)
    await resolveRound();
  }
});
