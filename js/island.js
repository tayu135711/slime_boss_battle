/* =========================================================
   island.js — 島シーン・ガチャ・パーティ編成 UI
   依存: THREE, config.js, models.js, party.js
   読み込み順: config.js → models.js → maze.js → party.js → island.js
========================================================= */

/* ---------------------------------------------------------
   通貨
--------------------------------------------------------- */
var diamonds = 20;
var coins    = 50;

function updateCurrencyUI() {
  document.getElementById('diamond-count').textContent = diamonds;
  document.getElementById('coin-count').textContent    = coins;
}

/* ---------------------------------------------------------
   島シーン (Three.js)
--------------------------------------------------------- */
const islandCanvas   = document.getElementById('island-canvas');
const islandScene    = new THREE.Scene();
const islandCamera   = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
const islandRenderer = new THREE.WebGLRenderer({ canvas: islandCanvas, antialias: true, alpha: true });

islandScene.add(new THREE.HemisphereLight(0xeaf6ff, 0x2f6fae, 0.8));
const islandSun = new THREE.DirectionalLight(0xfff3d0, 0.5);
islandSun.position.set(5, 8, 4);
islandScene.add(islandSun);

// 水面 (広場の外周を囲む)
const water = new THREE.Mesh(
  new THREE.CircleGeometry(20, 32),
  new THREE.MeshStandardMaterial({ color: 0x3fa8e0, roughness: 1 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.08;
islandScene.add(water);

// 砂浜
const sand = new THREE.Mesh(
  new THREE.CylinderGeometry(9.2, 9.5, 0.3, 32),
  new THREE.MeshStandardMaterial({ color: 0xf0d89a, roughness: 1 })
);
sand.position.y = -0.16; // 表面がy=0になる高さ
islandScene.add(sand);

// 草地
const islandGrass = new THREE.Mesh(
  new THREE.CylinderGeometry(8.4, 8.7, 0.28, 32),
  new THREE.MeshStandardMaterial({ color: 0x6bc96b, roughness: 1 })
);
islandGrass.position.y = -0.11; // 砂浜よりわずかに高くZファイティング回避
islandScene.add(islandGrass);

// 広場 (石畳。ガチャ/パーティの建物と噴水を囲む中央エリア)
// ※ 以前は草地の表面(y=0.03)とぴったり同じ高さでZファイティング(ちらつき)していたため、
//    明確に浮かせて重なりを解消 (2026/07/25 修正)
const islandPlaza = new THREE.Mesh(
  new THREE.CylinderGeometry(4.6, 4.7, 0.06, 28),
  new THREE.MeshStandardMaterial({ color: 0xdcd0b4, roughness: 0.95 })
);
islandPlaza.position.y = 0.02;
islandScene.add(islandPlaza);

// 噴水 (広場中央)
islandScene.add(buildIslandFountain());

// ガチャの建物 (向かって左。2026/07/27 修正: 大きすぎたので縮小)
const islandShop = buildShopBuilding();
islandShop.scale.set(0.72, 0.72, 0.72);
islandShop.position.set(-4.3, 0, -1.6);
islandShop.rotation.y = 0.35;
islandScene.add(islandShop);

// アイテムショップの建物 (向かって右。2026/07/25 修正: 以前は使われていない
// 「パーティの建物」だったが、実際の入店はステージ2クリアで解放される
// どうぐや(きずぐすり販売)として使うことにした。2026/07/27 修正: こちらも縮小)
const islandHouse = buildHouseBuilding();
islandHouse.scale.set(0.72, 0.72, 0.72);
islandHouse.position.set(4.3, 0, -1.6);
islandHouse.rotation.y = -0.35;
islandScene.add(islandHouse);
// ロック演出用に元のマテリアル色を保持しておく
const islandHouseOriginalColors = [];
islandHouse.traverse(child => {
  if (child.material && child.material.color) {
    islandHouseOriginalColors.push({ mat: child.material, hex: child.material.color.getHex() });
  }
});

/** ステージ2をクリア済みか (どうぐやの解放条件) */
function isItemShopUnlocked() {
  const st = STAGES.find(s => s.no === 2);
  return !!(st && st.unlocked);
}

/** どうぐやの見た目を解放状況に合わせて更新する (未解放時は灰色にくすませる) */
function refreshItemShopLockVisual() {
  const unlocked = isItemShopUnlocked();
  islandHouseOriginalColors.forEach(({ mat, hex }) => {
    mat.color.setHex(unlocked ? hex : 0x8a8378);
  });
}
refreshItemShopLockVisual();

// 街灯 (広場の四隅)
[[-2.6, 2.2], [2.6, 2.2], [-2.6, -3.4], [2.6, -3.4]].forEach(([x, z]) => {
  const lamp = buildLamppost();
  lamp.position.set(x, 0, z);
  islandScene.add(lamp);
});

// ベンチ
[[-1.8, 3.0, 0.15], [1.8, 3.0, -0.15]].forEach(([x, z, rot]) => {
  const bench = buildBench();
  bench.position.set(x, 0, z);
  bench.rotation.y = rot;
  islandScene.add(bench);
});

// ヤシの木 (草地の外周に散らす)
const islandTreeSpots = [
  [5.6, 2.4], [-5.9, 2.0], [6.4, -2.8], [-6.6, -2.4],
  [3.4, 5.4], [-3.6, 5.6], [0.4, 6.6], [-1.4, -6.4], [2.6, -6.0],
];
islandTreeSpots.forEach(([x, z]) => {
  islandScene.add(buildPalmTree(x, z, 0.9 + Math.random() * 0.3));
});

// 島プレイヤー (広場を向いてスタート)
const islandPlayer = buildTrainerModel();
islandPlayer.scale.set(0.42, 0.42, 0.42);
islandPlayer.position.set(0, 0, 3.6);
islandPlayer.rotation.y = Math.PI;
islandScene.add(islandPlayer);

/* ---------------------------------------------------------
   タケオさん (島の案内役NPC。2026/07/26 追加。将来ボスになる予定)
--------------------------------------------------------- */
const takeoNPC = buildTakeoNPC();
takeoNPC.scale.set(0.42, 0.42, 0.42);
const TAKEO_POS = { x: -2.2, z: 4.8 };
takeoNPC.position.set(TAKEO_POS.x, 0, TAKEO_POS.z);
takeoNPC.rotation.y = Math.PI * 0.3;
islandScene.add(takeoNPC);

let takeoIdleTime = 0;
/** タケオさんの待機アニメ (ゆらゆら+たまに会釈するような動き) */
function updateTakeoIdle(dt) {
  if (typeof storyFlags !== 'undefined' && storyFlags.seenTakeoCurseAftermath) return; // 出かけていて島にいない
  takeoIdleTime += dt;
  takeoNPC.position.y = Math.max(0, Math.sin(takeoIdleTime * 1.6)) * 0.05;
  takeoNPC.rotation.y = Math.PI * 0.3 + Math.sin(takeoIdleTime * 0.5) * 0.06;
  if (takeoNPC.userData.armR) {
    takeoNPC.userData.armR.rotation.x = Math.sin(takeoIdleTime * 1.6) * 0.08;
  }
}

let takeoCooldownUntil = 0;
let takeoInteractKeyWasDown = false;
const takeoTalkHintEl = document.getElementById('takeo-talk-hint');

/**
 * 近づいたら「Z / Enter / Space で話す」ヒントを表示し、キーを押した瞬間だけ話しかける。
 * (2026/07/27 修正: 以前は近づくだけで自動的に話しかけてしまい、通り過ぎるだけで
 *  何度も会話が始まってしまっていたため、決定キー入力式に変更した。
 *  さらに、押しっぱなしで連続発火しないようエッジ検出にし、ヒントもトースト連打ではなく
 *  常設のヒント表示に変更した)
 */
function updateTakeoProximity() {
  if (typeof storyFlags !== 'undefined' && storyFlags.seenTakeoCurseAftermath) {
    if (takeoTalkHintEl) takeoTalkHintEl.style.display = 'none';
    return; // 出かけていて島にいない
  }
  const dist = Math.hypot(
    islandPlayer.position.x - TAKEO_POS.x,
    islandPlayer.position.z - TAKEO_POS.z
  );
  const near = dist <= 1.7;
  // スマホの「はなす」ボタンは data-key="z" を送るので、z/Enter/Spaceのどれでも反応するようにする
  const keyDown = !!(keys['z'] || keys['enter'] || keys[' ']);

  if (typeof dialogueOpen !== 'undefined' && dialogueOpen) {
    if (takeoTalkHintEl) takeoTalkHintEl.style.display = 'none';
    takeoInteractKeyWasDown = keyDown; // 会話中の入力は「押しっぱなし」として無視する
    return;
  }

  if (takeoTalkHintEl) takeoTalkHintEl.style.display = near ? 'block' : 'none';

  const justPressed = keyDown && !takeoInteractKeyWasDown;
  takeoInteractKeyWasDown = keyDown;

  if (!near || !justPressed) return;
  if (performance.now() < takeoCooldownUntil) return;
  takeoCooldownUntil = performance.now() + 800;

  if (typeof getTakeoLines === 'function' && typeof showDialogue === 'function') {
    showDialogue(getTakeoLines());
  }
}

/* ---------------------------------------------------------
   島のリサイズ対応
--------------------------------------------------------- */
function resizeIslandCanvas() {
  const w = islandCanvas.clientWidth  || 400;
  const h = islandCanvas.clientHeight || 400;
  islandRenderer.setSize(w, h, false);
  islandCamera.aspect = w / h;
  islandCamera.updateProjectionMatrix();
}

// 噴水・建物との簡易当たり判定 (2026/07/25 追加。円形の障害物として扱う)
const islandObstacles = [
  { x: 0,    z: 0,    r: 2.05 }, // 噴水
  { x: -4.3, z: -1.6, r: 1.15 }, // ガチャの建物 (2026/07/27: 建物を0.72倍に縮小したのに合わせて調整)
  { x: 4.3,  z: -1.6, r: 1.15 }, // どうぐやの建物
  { x: TAKEO_POS.x, z: TAKEO_POS.z, r: 0.6 }, // タケオさん
];
function collidesWithIslandObstacles(x, z, margin = 0.42) {
  return islandObstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + margin);
}

/* ---------------------------------------------------------
   島プレイヤー移動 (毎フレーム)
--------------------------------------------------------- */
function updateIslandPlayer(dt) {
  let dx = 0, dz = 0;
  if (keys['w'] || keys['arrowup'])    dz -= 1;
  if (keys['s'] || keys['arrowdown'])  dz += 1;
  if (keys['a'] || keys['arrowleft'])  dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    let nx = islandPlayer.position.x + dx * ISLAND_PLAYER_SPEED * dt;
    let nz = islandPlayer.position.z + dz * ISLAND_PLAYER_SPEED * dt;
    const dist = Math.hypot(nx, nz);
    if (dist > ISLAND_RADIUS) {
      nx *= ISLAND_RADIUS / dist;
      nz *= ISLAND_RADIUS / dist;
    }
    if (!collidesWithIslandObstacles(nx, nz)) {
      islandPlayer.position.x = nx;
      islandPlayer.position.z = nz;
    }
    islandPlayer.rotation.y = Math.atan2(dx, dz);
  }
  updateWalkAnimation(islandPlayer, dt, dx !== 0 || dz !== 0);
  updateItemShopProximity();
  updateTakeoIdle(dt);
  updateTakeoProximity();

  // カメラ追従 (広場全体を見渡せるよう少し高め・遠めに)
  const targetPos = islandPlayer.position.clone().add(new THREE.Vector3(0, 3.3, 4.3));
  islandCamera.position.lerp(targetPos, 0.1);
  islandCamera.lookAt(islandPlayer.position.clone().add(new THREE.Vector3(0, 0.35, 0)));
}
// 他のクラシックスクリプトからも島シーンを確実に参照できるよう公開する。
window.updateIslandPlayer = updateIslandPlayer;
window.islandRenderer = islandRenderer;
window.islandScene = islandScene;
window.islandCamera = islandCamera;

/* ---------------------------------------------------------
   島オーバーレイの開閉
--------------------------------------------------------- */
let islandOverlayOpen = true;

const islandOverlayEl = document.getElementById('island-overlay');
const hudEl           = document.getElementById('hud');
const partyPanelEl    = document.getElementById('party-panel');

/* ---------------------------------------------------------
   スタミナ制度 (2026/07/26 追加)
   戦闘のたびに1消費し、0になると新しい戦闘に挑めなくなる。
   島にもどると全回復するほか、時間経過でも少しずつ回復する。
--------------------------------------------------------- */
let stamina         = MAX_STAMINA;
let lastStaminaTick = Date.now();

/** 経過時間ぶんスタミナを回復させる (呼ぶたびに計算するだけなのでどこからでも安全に呼べる) */
function regenStamina() {
  if (stamina >= MAX_STAMINA) { lastStaminaTick = Date.now(); return; }
  const now     = Date.now();
  const elapsed = now - lastStaminaTick;
  const gained  = Math.floor(elapsed / STAMINA_REGEN_MS);
  if (gained > 0) {
    stamina = Math.min(MAX_STAMINA, stamina + gained);
    lastStaminaTick += gained * STAMINA_REGEN_MS;
    updateStaminaUI();
  }
}

/** スタミナを消費する (戦闘開始時に呼ぶ) */
function consumeStamina(amount) {
  stamina = Math.max(0, stamina - amount);
  updateStaminaUI();
}

/** 島で休んで全回復する */
function restoreStaminaFully() {
  stamina = MAX_STAMINA;
  lastStaminaTick = Date.now();
  updateStaminaUI();
}

/** スタミナ表示を更新する (フィールドHUD・島画面の両方) */
function updateStaminaUI() {
  const text = `${stamina}/${MAX_STAMINA}`;
  const fieldEl  = document.getElementById('stamina-count');
  const islandEl = document.getElementById('stamina-count-island');
  if (fieldEl)  fieldEl.textContent  = text;
  if (islandEl) islandEl.textContent = text;
  const badge = document.getElementById('stamina-badge');
  if (badge) badge.classList.toggle('low', stamina <= 3);
}
updateStaminaUI();

// 他のファイルからも参照できるよう公開
window.regenStamina        = regenStamina;
window.consumeStamina      = consumeStamina;
window.restoreStaminaFully = restoreStaminaFully;

function openIslandOverlay() {
  islandOverlayOpen = true;
  islandOverlayEl.style.display = 'flex';
  hudEl.style.display       = 'none';
  document.getElementById('stamina-badge').style.display = 'none';
  const mc1 = document.getElementById('mobile-controls'); if (mc1) mc1.style.display = 'none';
  partyPanelEl.style.display = 'none';
  document.getElementById('minimap-wrap').style.display = 'none';
  document.getElementById('minimap-zoom-overlay').style.display = 'none';
  minimapZoomOpen = false;
  resizeIslandCanvas();
  // 修正: 以前は (0,0,1.6) が噴水の当たり判定(半径2.05+余白0.42)の内側だったため、
  // ステージクリアで島に戻るたびに噴水にめり込んで動けなくなっていた。
  // 初期スポーン地点と同じ (0,0,3.6) に統一して解消する (2026/07/25 修正)
  islandPlayer.position.set(0, 0, 3.6);
  islandPlayer.rotation.y = Math.PI;
  resetFieldAtmosphere();
  refreshItemShopLockVisual();
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.island);
  const healed = healPartyFully();
  if (typeof regenStamina === 'function') regenStamina();
  if (healed) showToast('しまで やすんで、なかまが ぜんかいふくした！');
  takeoNPC.visible = !(typeof storyFlags !== 'undefined' && storyFlags.seenTakeoCurseAftermath);
  checkStage4AftermathEvent();
}

/**
 * ステージ4クリア後、島に戻ってきた時に一度だけ再生される演出 (2026/07/28 追加)。
 * タケオが姿を消し、その後 残影のカニロードに惨敗、スイートポテトが海の精霊を提案するまでの一連の流れ。
 * ステージ5(次のステージ)が解放済み = ステージ4クリア済みの目印として使う。
 */
function checkStage4AftermathEvent() {
  const stage5 = (typeof STAGES !== 'undefined') ? STAGES.find(s => s.no === 5) : null;
  if (!stage5 || !stage5.unlocked) return;
  if (typeof showDialogueOnce !== 'function' || typeof STORY === 'undefined') return;
  showDialogueOnce('seenTakeoCurseAftermath', STORY.takeoCurseAftermath, () => {
    takeoNPC.visible = false;
  });
}

function closeIslandOverlay() {
  islandOverlayOpen = false;
  islandOverlayEl.style.display = 'none';
  hudEl.style.display       = 'block';
  document.getElementById('stamina-badge').style.display = 'flex';
  const mc2 = document.getElementById('mobile-controls'); if (mc2) mc2.style.removeProperty('display');
  partyPanelEl.style.display = 'block';
}

/* ---------------------------------------------------------
   ステージドット UI
--------------------------------------------------------- */
const stageDotsEl = document.getElementById('stage-dots');
const stageCardEl = document.getElementById('stage-card');
const btnDepart   = document.getElementById('btn-depart');
let selectedStage = null;

STAGES.forEach(st => {
  const dot = document.createElement('div');
  dot.className = 'stage-dot' + (st.unlocked ? '' : ' locked');
  dot.textContent = st.no;
  dot.addEventListener('click', () => selectStage(st, dot));
  stageDotsEl.appendChild(dot);
});

function selectStage(st, dotEl) {
  document.querySelectorAll('.stage-dot').forEach(d => d.classList.remove('selected'));
  dotEl.classList.add('selected');
  selectedStage = st;
  document.getElementById('stage-card-icon').textContent = st.letter;
  document.getElementById('stage-card-name').textContent = `ステージ${st.no}: ${st.name}`;
  document.getElementById('stage-card-desc').textContent = st.desc;
  btnDepart.textContent = st.unlocked ? '出発する' : 'じゅんびちゅう';
  btnDepart.disabled    = !st.unlocked;
  stageCardEl.style.display = 'block';
}

btnDepart.addEventListener('click', () => {
  if (!selectedStage || !selectedStage.unlocked) return;
  if (typeof regenStamina === 'function') regenStamina();
  if (typeof stamina !== 'undefined' && stamina <= 0) {
    showToast('スタミナが たりない…1時間で1回復するよ');
    if (typeof SFX !== 'undefined') SFX.cancel();
    return;
  }
  if (typeof consumeStamina === 'function') consumeStamina(STAMINA_COST_STAGE);
  closeIslandOverlay();
  if (selectedStage.no === 1) setupStage1();
  else if (selectedStage.no === 2) setupStage2();
  else if (selectedStage.no === 3) setupStage3();
  else if (selectedStage.no === 4) setupStage4();
});

/* ---------------------------------------------------------
   ガチャモーダル & 装備インベントリ
--------------------------------------------------------- */
const gachaModal    = document.getElementById('gacha-modal');
const gachaResultEl = document.getElementById('gacha-result');

/** プレイヤーの所持装備リスト */
const playerEquipInventory = [];
let currentGachaTab = 'equip';

// 装備の形容詞マッピング
const EQUIP_PREFIXES = {
  1: ['ボロい', 'ふつうの', 'みならいの'],
  2: ['がんじょうな', 'てつの', 'ブロンズ'],
  3: ['かがやく', 'ぎんの', 'シルバー'],
  4: ['まほうの', 'きんの', 'ゴールド'],
  5: ['でんせつの', 'しんぴの', 'プラチナ'],
};

/**
 * 指定レア度の装備アイテムをランダムに1つ生成して返す(所持リストへの追加は呼び出し側で行う)
 * @param {number} rarity - 1〜5
 * @returns {object} 装備アイテム
 */
function createEquipItem(rarity) {
  const part = EQUIP_PARTS[Math.floor(Math.random() * EQUIP_PARTS.length)];
  const prefixes = EQUIP_PREFIXES[rarity];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const partNameMap = { '頭': 'ヘッドギア', '服': 'ウェア', '足': 'ブーツ' };
  const equipName = `${prefix}${partNameMap[part]}`;
  const bonus = EQUIP_STAT_BY_RARITY[rarity];

  return {
    id: performance.now() + Math.random(),
    name: equipName,
    part: part,
    rarity: rarity,
    hpBonus: bonus.hp,
    atkBonus: bonus.atk,
    equippedTo: null, // 誰にも装備されていない
  };
}

document.getElementById('btn-open-gacha').addEventListener('click', () => {
  currentGachaTab = 'equip';
  gachaResultEl.textContent = 'そうびガチャ: コインを30消費して、装備を1つひくよ';
  gachaModal.style.display = 'flex';
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.gachaBox);
});

/* ---------------------------------------------------------
   アイテムショップ (どうぐや) — 2026/07/25 追加
   ステージ2クリアで解放。歩いて近づくと自動で入店する。
   (2026/07/27 変更: モーダルポップアップから専用の画面遷移に変更。
    新キャラ「スイートポテト」が売り子として立つ)
--------------------------------------------------------- */
const ITEM_SHOP_POS  = { x: 4.3, z: -1.6 };
const POTION_PRICE   = 15;
const REVIVE_PRICE   = 40; // ふっかつのくすり(2026/07/28 追加: 戦闘中に仲間が倒れても復活できる手段が無いという要望から)
let itemShopCooldownUntil = 0;
let shopConfirmOpen     = false;
let shopPromptAnswered  = false; // 一度「いいえ」を選んだら、離れるまで再度たずねない
const shopConfirmPanel  = document.getElementById('shop-confirm-panel');
const btnShopYes = document.getElementById('btn-shop-yes');
const btnShopNo  = document.getElementById('btn-shop-no');
const itemShopListEl = document.getElementById('item-shop-list');

/* --- どうぐや専用の3Dシーン (カウンターとスイートポテトNPC) --- */
const shopCanvas   = document.getElementById('shop-canvas');
const shopScene    = new THREE.Scene();
const shopCamera   = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
const shopRenderer = new THREE.WebGLRenderer({ canvas: shopCanvas, antialias: true, alpha: true });

shopScene.add(new THREE.HemisphereLight(0xfff3d8, 0x8a5a3a, 0.9));
const shopSun = new THREE.DirectionalLight(0xfff0c8, 0.55);
shopSun.position.set(3, 6, 4);
shopScene.add(shopSun);

// 床
const shopFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(4.2, 4.2, 0.2, 24),
  new THREE.MeshStandardMaterial({ color: 0xd8b478, roughness: 1 })
);
shopFloor.position.y = -0.1;
shopScene.add(shopFloor);

// 奥の壁
const shopBackWall = new THREE.Mesh(
  new THREE.BoxGeometry(9, 4, 0.3),
  new THREE.MeshStandardMaterial({ color: 0xf0dcae, roughness: 1 })
);
shopBackWall.position.set(0, 1.9, -2.6);
shopScene.add(shopBackWall);

// 棚に並んだ商品風の箱 (雰囲気づくり)
[[-3.0, -2.35, 0xe89858], [3.0, -2.35, 0x8ac06a], [-3.4, -2.4, 0xd85a5a]].forEach(([x, z, hex]) => {
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9 })
  );
  crate.position.set(x, 0.25, z);
  shopScene.add(crate);
});

// カウンター (2026/07/27 修正: スイートポテトをちびキャラ化したのに合わせて低めにし、
// 顔がしっかり見えるようにした)
const shopCounter = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.55, 0.7),
  new THREE.MeshStandardMaterial({ color: 0xb98452, roughness: 0.9 })
);
shopCounter.position.set(0, 0.275, -1.1);
shopScene.add(shopCounter);

// スイートポテト (売り子NPC。カウンターの奥に立つ)
const sweetPotatoNPC = buildSweetPotatoNPC();
sweetPotatoNPC.scale.set(0.85, 0.85, 0.85);
sweetPotatoNPC.position.set(0, 0, -1.75);
shopScene.add(sweetPotatoNPC);

shopCamera.position.set(0, 1.15, 2.2);
shopCamera.lookAt(0, 0.78, -1.3);

let sweetPotatoIdleTime = 0;
/** スイートポテトの待機アニメ (ゆらゆら+たまに手を振るような動き) */
function updateSweetPotatoIdle(dt) {
  sweetPotatoIdleTime += dt;
  sweetPotatoNPC.position.y = Math.max(0, Math.sin(sweetPotatoIdleTime * 1.4)) * 0.04;
  if (sweetPotatoNPC.userData.armR) {
    sweetPotatoNPC.userData.armR.rotation.x = Math.sin(sweetPotatoIdleTime * 1.1) * 0.12;
  }
}

function resizeShopCanvas() {
  const w = shopCanvas.clientWidth  || 400;
  const h = shopCanvas.clientHeight || 400;
  shopRenderer.setSize(w, h, false);
  shopCamera.aspect = w / h;
  shopCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeShopCanvas);

const shopScreenEl   = document.getElementById('shop-screen');
const shopDialogueEl = document.getElementById('shop-dialogue');
const SWEET_POTATO_LINES = [
  'いらっしゃい！ここは なんでも屋の スイートポテトの お店だよ！',
  'きずぐすり、いる？たびの おともに どうぞ！',
  'また きてね〜！',
];

function showShopConfirm() {
  shopConfirmOpen = true;
  if (shopConfirmPanel) shopConfirmPanel.style.display = 'block';
}

function hideShopConfirm() {
  shopConfirmOpen = false;
  if (shopConfirmPanel) shopConfirmPanel.style.display = 'none';
}

if (btnShopYes) {
  btnShopYes.addEventListener('click', () => {
    hideShopConfirm();
    openItemShop();
  });
}
if (btnShopNo) {
  btnShopNo.addEventListener('click', () => {
    shopPromptAnswered = true; // 離れるまでは再度たずねない
    hideShopConfirm();
  });
}

function updateItemShopProximity() {
  if (shopScreenEl.style.display === 'block') return;
  if (performance.now() < itemShopCooldownUntil) return;
  const dist = Math.hypot(
    islandPlayer.position.x - ITEM_SHOP_POS.x,
    islandPlayer.position.z - ITEM_SHOP_POS.z
  );
  if (dist > 1.9) {
    shopPromptAnswered = false; // 離れたら次にまた近づいた時にたずね直す
    if (shopConfirmOpen) hideShopConfirm();
    return;
  }

  if (isItemShopUnlocked()) {
    if (!shopConfirmOpen && !shopPromptAnswered) showShopConfirm();
  } else {
    itemShopCooldownUntil = performance.now() + 4000;
    showToast('どうぐやは ステージ2をクリアすると 開放されるよ！');
  }
}

function renderItemShopList() {
  const potionCount = (typeof consumables !== 'undefined') ? consumables.potion : 0;
  const reviveCount = (typeof consumables !== 'undefined') ? consumables.revive : 0;
  itemShopListEl.innerHTML = `
    <div class="shop-item-row">
      <div>
        <div class="shop-item-name">きずぐすり</div>
        <div class="shop-item-desc">HP+${typeof POTION_HEAL !== 'undefined' ? POTION_HEAL : 40} かいふく (のこり ${potionCount}こ)</div>
      </div>
      <button class="btn" id="btn-buy-potion" style="font-size:12px; padding:8px 14px;">${POTION_PRICE}コインで買う</button>
    </div>
    <div class="shop-item-row">
      <div>
        <div class="shop-item-name">ふっかつのくすり</div>
        <div class="shop-item-desc">たおれた なかまが HP${Math.round((typeof REVIVE_HEAL_PCT !== 'undefined' ? REVIVE_HEAL_PCT : 0.5) * 100)}%で ふっかつ (のこり ${reviveCount}こ)</div>
      </div>
      <button class="btn" id="btn-buy-revive" style="font-size:12px; padding:8px 14px;">${REVIVE_PRICE}コインで買う</button>
    </div>`;
  const buyBtn = document.getElementById('btn-buy-potion');
  if (buyBtn) buyBtn.addEventListener('click', buyPotion);
  const reviveBtn = document.getElementById('btn-buy-revive');
  if (reviveBtn) reviveBtn.addEventListener('click', buyRevive);
}

function buyPotion() {
  if (coins < POTION_PRICE) {
    showToast('コインが たりないよ！');
    if (shopDialogueEl) shopDialogueEl.textContent = 'あちゃー、コインが たりないみたいだね…';
    return;
  }
  coins -= POTION_PRICE;
  if (typeof consumables !== 'undefined') consumables.potion++;
  updateCurrencyUI();
  showToast('きずぐすりを 買った！');
  if (shopDialogueEl) shopDialogueEl.textContent = 'まいど！だいじに つかってね！';
  renderItemShopList();
}

function buyRevive() {
  if (coins < REVIVE_PRICE) {
    showToast('コインが たりないよ！');
    if (shopDialogueEl) shopDialogueEl.textContent = 'あちゃー、コインが たりないみたいだね…';
    return;
  }
  coins -= REVIVE_PRICE;
  if (typeof consumables !== 'undefined') consumables.revive++;
  updateCurrencyUI();
  showToast('ふっかつのくすりを 買った！');
  if (shopDialogueEl) shopDialogueEl.textContent = 'いざという時のお守りだよ。持っておいて損はないさ！';
  renderItemShopList();
}

function openItemShop() {
  document.getElementById('island-overlay').style.display = 'none';
  shopScreenEl.style.display = 'block';
  resizeShopCanvas();
  renderItemShopList();
  shopDialogueEl.textContent = SWEET_POTATO_LINES[Math.floor(Math.random() * SWEET_POTATO_LINES.length)];
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.shop);
}

function closeItemShop() {
  shopScreenEl.style.display = 'none';
  document.getElementById('island-overlay').style.display = 'block';
  itemShopCooldownUntil = performance.now() + 1500; // 閉じた直後に再入店しないように
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.island);
}
document.getElementById('btn-shop-exit').addEventListener('click', closeItemShop);

window.shopRenderer = shopRenderer;
window.shopScene    = shopScene;
window.shopCamera   = shopCamera;
window.updateSweetPotatoIdle = updateSweetPotatoIdle;

document.getElementById('btn-gacha-close').addEventListener('click', () => {
  gachaModal.style.display = 'none';
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.island);
});

document.getElementById('tab-equip').addEventListener('click', () => {
  currentGachaTab = 'equip';
  gachaResultEl.textContent = 'そうびガチャ: コインを30消費して、装備を1つひくよ';
});

document.getElementById('tab-premium').addEventListener('click', () => {
  currentGachaTab = 'premium';
  gachaResultEl.textContent =
    `プレミアムそうびガチャ: ダイヤを${GACHA_COST_PREMIUM_EQUIP}消費して、星${PREMIUM_GACHA_MIN_RARITY}以上確定の装備を1つひくよ`;
});

// でんぱガチャは廃止(仕様書5-5)。仲間の入手はバトル内の捕獲のみ。
// ダイヤの使い道はプレミアムそうびガチャ(レア度保証)に一本化(仕様書5-13)
document.getElementById('btn-gacha-pull').addEventListener('click', () => {
  const isPremium = currentGachaTab === 'premium';

  if (isPremium) {
    if (diamonds < GACHA_COST_PREMIUM_EQUIP) {
      gachaResultEl.textContent = 'ダイヤが たりない…';
      return;
    }
  } else {
    if (coins < GACHA_COST_EQUIP) {
      gachaResultEl.textContent = 'コインが たりない…';
      return;
    }
  }

  if (isPremium) diamonds -= GACHA_COST_PREMIUM_EQUIP;
  else coins -= GACHA_COST_EQUIP;
  updateCurrencyUI();
  if (typeof SFX !== 'undefined') SFX.gacha();
  const rolledRarity = isPremium ? rollRarityWithFloor(PREMIUM_GACHA_MIN_RARITY) : rollRarity();
  const newEquip = createEquipItem(rolledRarity);
  playerEquipInventory.push(newEquip);
  const stars = '★'.repeat(rolledRarity) + '☆'.repeat(5 - rolledRarity);
  gachaResultEl.innerHTML = `<span style="color:var(--green);">${newEquip.name}</span> をてにいれた！<br><span style="color:#e0a83a;">${stars}</span><br>HP+${newEquip.hpBonus} / ATK+${newEquip.atkBonus}`;
  showToast(`${newEquip.name} を てにいれた！`);
});

/* ---------------------------------------------------------
   パーティ編成モーダル & 装備変更UI
--------------------------------------------------------- */
const partyModal = document.getElementById('party-modal');

function renderPartyRoster() {
  const el = document.getElementById('party-roster');
  el.innerHTML = getAllFighters().map((f, index) => {
    const headText = f.equips?.頭 ? f.equips.頭.name : 'なし';
    const bodyText = f.equips?.服 ? f.equips.服.name : 'なし';
    const legText = f.equips?.足 ? f.equips.足.name : 'なし';
    const stars = p => p.rarity ? '★'.repeat(p.rarity) + '☆'.repeat(5 - p.rarity) : '';
    
    return `
      <div class="roster-row" style="flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 6px;">
        <div style="display:flex; align-items:center; width:100%; justify-content:space-between; gap:4px;">
          <div style="display:flex; align-items:center; gap:6px; min-width: 0; flex: 1;">
            <img class="roster-icon" src="${getFighterIconUrl(f)}" alt="${f.name}">
            <div style="min-width: 0; flex: 1; text-align: left;">
              <div class="roster-name" style="width:100%; font-weight:800; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.name}</div>
              <div style="font-size:10px; color:var(--red); font-weight:800;">Lv.${f.level || 1}</div>
            </div>
            ${f.element ? `<span style="background:${ELEMENT_COLORS[f.element]}; color:#fff; font-size:8px; padding:1px 2px; border:1.5px solid var(--ink); font-weight:800; border-radius:2px; flex-shrink:0;">${ELEMENT_NAMES[f.element]}</span>` : ''}
          </div>
          <div style="display:flex; gap:4px; flex-shrink:0;">
            ${!f.isTrainer ? `<button class="btn" style="font-size:9px; padding:4px 6px; background:var(--red); box-shadow:1px 1px 0 var(--ink); white-space:nowrap; width:auto;" onclick="actionSendToBox(${index})">ボックスへ</button>` : ''}
            <button class="btn" style="font-size:9px; padding:4px 6px; background:var(--plum); box-shadow:1px 1px 0 var(--ink); white-space:nowrap; width:auto;" onclick="openEquipManager(${index})">そうび変更</button>
          </div>
        </div>
        <div class="roster-stats" style="width: 100%; text-align: left;">
          <div style="color:#e0a83a; font-weight:800; font-size:10px; margin-bottom:2px;">${stars(f)}</div>
          HP: ${Math.max(0, Math.ceil(f.hp))}/${f.maxHp} ・ ATK: ${f.atk}<br>
          <span style="font-size:9px; opacity:0.8; font-weight:700;">頭: ${headText} | 服: ${bodyText} | 足: ${legText}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.renderPartyRoster = renderPartyRoster;

/* ---------------------------------------------------------
   ボックス UI (4列ハウス風グリッド仕様)
--------------------------------------------------------- */
function renderBoxRoster() {
  const el = document.getElementById('party-roster');
  
  const rooms = box.length > 0 ? box.map((f, index) => {
    const stars = f.rarity ? '★'.repeat(f.rarity) : '';
    return `
      <div class="box-room" onclick="actionCallFromBox(${index})">
        <img class="roster-icon" src="${getFighterIconUrl(f)}" alt="${f.name}">
        <div class="box-room-name">${f.name}</div>
        <div class="box-room-lvl">Lv.${f.level}</div>
        <div style="font-size:7px; color:#e0a83a; line-height:1; transform:scale(0.9);">${stars}</div>
      </div>
    `;
  }).join('') : '';

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:13px; color:var(--plum);">🏠 なかまのおうち (${box.length}体)</span>
        <button class="btn" style="font-size:10px; padding:4px 8px; box-shadow:1.5px 1.5px 0 var(--ink);" onclick="renderPartyRoster()">もどる</button>
      </div>
      <div class="box-house-grid">
        ${rooms || '<div style="grid-column: span 5; text-align:center; padding:35px 0; font-size:11px; opacity:0.6; font-weight:700; color:#5a3c20;">だれも いないよ</div>'}
      </div>
    </div>
  `;
}
window.renderBoxRoster = renderBoxRoster;

window.actionCallFromBox = function(index) {
  const fighter = box[index];
  if (!fighter) return;
  if (party.length >= MAX_PARTY) {
    showToast('パーティがいっぱいです！だれかをボックスへ预けてください');
    return;
  }
  moveToParty(fighter);
  renderBoxRoster();
};

window.actionSendToBox = function(fighterIdx) {
  const fighter = getAllFighters()[fighterIdx];
  if (!fighter || fighter.isTrainer) return;
  moveToBox(fighter);
  renderPartyRoster();
};

window.openEquipManager = function(fighterIdx) {
  const fighter = getAllFighters()[fighterIdx];
  const el = document.getElementById('party-roster');
  
  const parts = ['頭', '服', '足'];
  const slotsHtml = parts.map(part => {
    const item = fighter.equips?.[part];
    const itemInfo = item ? `<span style="color:var(--green);">${item.name}</span> (HP+${item.hpBonus} / ATK+${item.atkBonus})` : '<span style="opacity:0.6;">未そうび</span>';
    const actionBtn = item 
      ? `<button class="btn" style="font-size:10px; padding:4px 8px; background:var(--red); box-shadow:1px 1px 0 var(--ink);" onclick="actionUnequip(${fighterIdx}, '${part}')">はずす</button>`
      : `<button class="btn" style="font-size:10px; padding:4px 8px; background:var(--green); box-shadow:1px 1px 0 var(--ink);" onclick="showEquipOptions(${fighterIdx}, '${part}')">そうび</button>`;
      
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px dashed var(--ink); padding:8px 0;">
        <span style="font-weight:800; font-size:12px;">${part}: ${itemInfo}</span>
        ${actionBtn}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:14px; color:var(--plum);">${fighter.name} のそうび</span>
        <button class="btn" style="font-size:11px; padding:4px 8px; box-shadow:1px 1px 0 var(--ink);" onclick="renderPartyRoster()">もどる</button>
      </div>
      <div>
        ${slotsHtml}
      </div>
    </div>
  `;
};

window.actionUnequip = function(fighterIdx, part) {
  const fighter = getAllFighters()[fighterIdx];
  unequipItem(fighter, part);
  openEquipManager(fighterIdx);
};

window.showEquipOptions = function(fighterIdx, part) {
  const fighter = getAllFighters()[fighterIdx];
  const el = document.getElementById('party-roster');
  
  // 未装備の装備アイテムのうち、該当部位のものを探す
  const options = playerEquipInventory.filter(item => item.part === part && !item.equippedTo);
  
  const optionsHtml = options.length > 0 
    ? options.map(item => `
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px dashed var(--ink); padding:8px 0;">
          <div style="display:flex; flex-direction:column; text-align:left; gap:2px;">
            <span style="font-weight:800; font-size:12px; color:var(--green);">${item.name}</span>
            <span style="font-size:9px; font-weight:700; opacity:0.8;">HP+${item.hpBonus} / ATK+${item.atkBonus} (${'★'.repeat(item.rarity)}${'☆'.repeat(5 - item.rarity)})</span>
          </div>
          <button class="btn" style="font-size:10px; padding:4px 8px; background:var(--green); box-shadow:1px 1px 0 var(--ink);" onclick="actionEquip(${fighterIdx}, ${item.id})">そうび</button>
        </div>
      `).join('')
    : '<div style="padding:15px 0; text-align:center; font-size:12px; opacity:0.6; font-weight:700;">そうびできるアイテムがありません</div>';

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:13px; color:var(--plum);">${part}にそうびする</span>
        <button class="btn" style="font-size:11px; padding:4px 8px; box-shadow:1px 1px 0 var(--ink);" onclick="openEquipManager(${fighterIdx})">もどる</button>
      </div>
      <div style="max-height:200px; overflow-y:auto;">
        ${optionsHtml}
      </div>
    </div>
  `;
};

window.actionEquip = function(fighterIdx, itemId) {
  const fighter = getAllFighters()[fighterIdx];
  const item = playerEquipInventory.find(eq => eq.id === itemId);
  if (item) {
    equipItem(fighter, item);
  }
  openEquipManager(fighterIdx);
};

document.getElementById('btn-open-party').addEventListener('click', () => {
  renderPartyRoster();
  partyModal.style.display = 'flex';
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.gachaBox);
});

document.getElementById('btn-party-close').addEventListener('click', () => {
  partyModal.style.display = 'none';
  if (typeof playBgm === 'function') playBgm(BGM_PATHS.island);
});

/* ---------------------------------------------------------
   初期化
--------------------------------------------------------- */
updateCurrencyUI();
resizeIslandCanvas();
