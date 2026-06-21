/**
 * game.js
 * ------------------------------------------------------------
 * スライム討伐戦・疑似3Dデモのメインロジック。
 *
 * 構成:
 *   1. DOM要素の取得
 *   2. ゲーム状態(state)
 *   3. Three.jsのシーン構築
 *   4. 入力(キーボード・タッチ十字ボタン)
 *   5. 更新処理(移動・ボスAI・カメラ・攻撃判定)
 *   6. UI更新
 *   7. メインループ
 *
 * 値の調整は基本的にすべて config.js の CONFIG オブジェクトで行う。
 * サーバーと繋ぐ場合は attackBoss() のダメージ計算部分を
 * WebSocket送信に差し替えるだけで良いように分離してある。
 * ------------------------------------------------------------
 */

// ============================================================
// 1. DOM要素の取得
// ============================================================
const dom = {
  hpBarInner:        document.getElementById("hpBarInner"),
  hpText:            document.getElementById("hpText"),
  playerHpBarInner:  document.getElementById("playerHpBarInner"),
  playerHpText:      document.getElementById("playerHpText"),
  statusLine:        document.getElementById("statusLine"),
  attackBtn:         document.getElementById("attackBtn"),
  totalDamageEl:     document.getElementById("totalDamage"),
  attackCountEl:     document.getElementById("attackCount"),
  resetBtn:          document.getElementById("resetBtn"),
  sceneContainer:    document.getElementById("sceneContainer"),
  overlayWin:        document.getElementById("overlayWin"),
  overlayLose:       document.getElementById("overlayLose"),
  winSub:            document.getElementById("winSub"),
  winStats:          document.getElementById("winStats"),
  loseStats:         document.getElementById("loseStats"),
  overlayWinBtn:     document.getElementById("overlayWinBtn"),
  overlayLoseBtn:    document.getElementById("overlayLoseBtn"),
};

// ============================================================
// 2. ゲーム状態
// ============================================================
const state = {
  // ボスHP
  currentHp:      CONFIG.boss.maxHp,
  totalDamage:    0,
  attackCount:    0,
  cleared:        false,
  gameOver:       false,
  lastAttackAt:   0,
  battleStartAt:  null, // 開始時刻(討伐タイム計測用)

  // キー入力
  keys: { up: false, down: false, left: false, right: false },

  // プレイヤー
  player: {
    x: CONFIG.player.startX,
    z: CONFIG.player.startZ,
    hp: CONFIG.player.maxHp,
  },

  // ボス
  boss: {
    x: 0,
    z: CONFIG.boss.homeZ,
    isCharging: false,       // 突進中フラグ
    chargeTarget: null,      // 突進先座標
    lastChargeAt: 0,         // 最後に突進した時刻
  },
  bossTarget: { x: 0, z: CONFIG.boss.homeZ },
};

// ============================================================
// 3. Three.js シーン構築
// ============================================================
const three = {};

function initScene() {
  const { width: W, height: H } = CONFIG.screen;

  three.scene = new THREE.Scene();
  three.scene.background = new THREE.Color(0x0f3d2e);

  three.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, W / H, 0.1, 100);

  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setSize(W, H);
  dom.sceneContainer.appendChild(three.renderer.domElement);

  // ライト
  three.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 5);
  three.scene.add(dirLight);

  // 地面
  const fieldSize = CONFIG.field.halfSize * 2 + 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldSize, fieldSize),
    new THREE.MeshStandardMaterial({ color: 0x123d2e })
  );
  ground.rotation.x = -Math.PI / 2;
  three.scene.add(ground);

  // 攻撃範囲リング(プレイヤーの足元に追従)
  const range = CONFIG.battle.attackRange;
  three.rangeRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  three.rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(range - 0.05, range, 48),
    three.rangeRingMat
  );
  three.rangeRing.rotation.x = -Math.PI / 2;
  three.rangeRing.position.y = 0.02;
  three.scene.add(three.rangeRing);

  // ボス（禍々しいスライム: 本体＋目玉×2＋トゲ×6）
  three.bossMesh = new THREE.Group();

  // 本体（少し縦につぶれたスライム）
  const bossBody = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.boss.radius, 24, 18),
    new THREE.MeshStandardMaterial({ color: CONFIG.boss.color })
  );
  bossBody.scale.y = 0.82;
  bossBody.position.y = CONFIG.boss.radius * 0.82;
  three.bossMesh.add(bossBody);

  // 目玉（黄色・光る感じ）
  const eyeGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffaa00, emissiveIntensity: 0.6 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.38, CONFIG.boss.radius * 0.82 + 0.28, CONFIG.boss.radius * 0.78);
  three.bossMesh.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
  eyeR.position.set( 0.38, CONFIG.boss.radius * 0.82 + 0.28, CONFIG.boss.radius * 0.78);
  three.bossMesh.add(eyeR);

  // 瞳（黒）
  const pupilGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-0.38, CONFIG.boss.radius * 0.82 + 0.28, CONFIG.boss.radius * 0.78 + 0.16);
  three.bossMesh.add(pupilL);
  const pupilR = new THREE.Mesh(pupilGeo, pupilMat.clone());
  pupilR.position.set( 0.38, CONFIG.boss.radius * 0.82 + 0.28, CONFIG.boss.radius * 0.78 + 0.16);
  three.bossMesh.add(pupilR);

  // トゲ（ConeGeometry × 6、ランダム配置っぽく）
  const spikePositions = [
    { x:  0,    y: 2.05, z:  0,    rx: 0,    rz: 0 },
    { x:  0.8,  y: 1.75, z:  0.3,  rx: 0.4,  rz: -0.5 },
    { x: -0.8,  y: 1.75, z:  0.3,  rx: 0.4,  rz:  0.5 },
    { x:  0.5,  y: 1.75, z: -0.7,  rx: -0.5, rz: -0.3 },
    { x: -0.5,  y: 1.75, z: -0.7,  rx: -0.5, rz:  0.3 },
    { x:  0,    y: 1.6,  z: -0.95, rx: -0.7, rz: 0 },
  ];
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x5500aa });
  spikePositions.forEach(({ x, y, z, rx, rz }) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 7), spikeMat.clone());
    spike.position.set(x, y, z);
    spike.rotation.x = rx;
    spike.rotation.z = rz;
    three.bossMesh.add(spike);
  });

  three.bossMesh.position.set(state.boss.x, 0, state.boss.z);
  three.scene.add(three.bossMesh);

  // プレイヤー（小さいスライム: 本体＋目玉）
  three.playerGroup = new THREE.Group();

  // 本体（少し縦につぶれたスライム）
  const playerBody = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.player.radius, 18, 14),
    new THREE.MeshStandardMaterial({ color: CONFIG.player.color })
  );
  playerBody.scale.y = 0.85;
  playerBody.position.y = CONFIG.player.radius * 0.85;
  three.playerGroup.add(playerBody);

  // 目玉（黒）
  const pEyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const pEyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const pEyeL = new THREE.Mesh(pEyeGeo, pEyeMat);
  pEyeL.position.set(-0.16, CONFIG.player.radius * 0.85 + 0.1, CONFIG.player.radius * 0.82);
  three.playerGroup.add(pEyeL);
  const pEyeR = new THREE.Mesh(pEyeGeo, pEyeMat.clone());
  pEyeR.position.set( 0.16, CONFIG.player.radius * 0.85 + 0.1, CONFIG.player.radius * 0.82);
  three.playerGroup.add(pEyeR);

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.scene.add(three.playerGroup);
}

// ============================================================
// 4. 入力
// ============================================================
function setupInput() {
  // 十字ボタン(タッチ/マウス両対応)
  document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
    const dir = btn.dataset.dir;
    const press   = (e) => { e.preventDefault(); state.keys[dir] = true;  btn.classList.add("pressed"); };
    const release = (e) => { e.preventDefault(); state.keys[dir] = false; btn.classList.remove("pressed"); };

    btn.addEventListener("touchstart",  press,   { passive: false });
    btn.addEventListener("touchend",    release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown",   press);
    btn.addEventListener("mouseup",     release);
    btn.addEventListener("mouseleave",  release);
  });

  // PCキーボード(矢印キー / WASD / スペースで攻撃)
  const keyMap = {
    arrowup: "up",    w: "up",
    arrowdown: "down", s: "down",
    arrowleft: "left", a: "left",
    arrowright: "right", d: "right",
  };

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = true;
    if (k === " ") { e.preventDefault(); attackBoss(); }
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = false;
  });

  dom.attackBtn.addEventListener("click", attackBoss);
  dom.resetBtn.addEventListener("click", resetBattle);
  dom.overlayWinBtn.addEventListener("click",  resetBattle);
  dom.overlayLoseBtn.addEventListener("click", resetBattle);
}

// ============================================================
// 5. 更新処理
// ============================================================

function updatePlayerMovement() {
  if (state.cleared || state.gameOver) return;

  let dx = 0, dz = 0;
  if (state.keys.up)    dz -= 1;
  if (state.keys.down)  dz += 1;
  if (state.keys.left)  dx -= 1;
  if (state.keys.right) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len  = Math.hypot(dx, dz);
    const speed = CONFIG.player.moveSpeed;
    const half  = CONFIG.field.halfSize;

    state.player.x = clamp(state.player.x + (dx / len) * speed, -half, half);
    state.player.z = clamp(state.player.z + (dz / len) * speed, -half, half);

    // 向いている方向にキャラを回転(見た目の演出)
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  }

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.rangeRing.position.set(state.player.x, 0.02, state.player.z);
}

function pickNewBossTarget() {
  const angle  = Math.random() * Math.PI * 2;
  const radius = Math.random() * CONFIG.boss.wanderRadius;
  state.bossTarget = {
    x: Math.cos(angle) * radius,
    z: CONFIG.boss.homeZ + Math.sin(angle) * radius,
  };
}

/**
 * ボスの移動 & 突進攻撃AI
 *
 * 突進ロジック:
 *   1. プレイヤーが attackRangeZ 以内に入ると突進フラグON
 *   2. 突進中はプレイヤーの位置に向かって高速移動
 *   3. プレイヤーに衝突したらダメージ → 突進終了・クールダウン開始
 *   4. フィールド端に到達しても突進終了
 */
function updateBossMovement() {
  if (state.cleared || state.gameOver) return;

  const now = Date.now();

  // --- 突進判定 ---
  const distToPlayer = Math.hypot(
    state.player.x - state.boss.x,
    state.player.z - state.boss.z
  );

  if (
    !state.boss.isCharging &&
    distToPlayer <= CONFIG.boss.attackRangeZ &&
    now - state.boss.lastChargeAt > CONFIG.boss.chargeCooldownMs
  ) {
    // 突進開始: プレイヤー座標をターゲットに固定
    state.boss.isCharging   = true;
    state.boss.chargeTarget = { x: state.player.x, z: state.player.z };

    // 突進前に一瞬大きくなって威圧
    three.bossMesh.scale.set(1.3, 1.3, 1.3);
    setTimeout(() => {
      if (state.boss.isCharging) three.bossMesh.scale.set(1, 1, 1);
    }, 180);
  }

  // --- 突進中の移動 ---
  if (state.boss.isCharging && state.boss.chargeTarget) {
    const cdx  = state.boss.chargeTarget.x - state.boss.x;
    const cdz  = state.boss.chargeTarget.z - state.boss.z;
    const cdist = Math.hypot(cdx, cdz);

    if (cdist > 0.15) {
      const spd = CONFIG.boss.chargeSpeed;
      state.boss.x += (cdx / cdist) * spd;
      state.boss.z += (cdz / cdist) * spd;

      // プレイヤーとの衝突判定
      const hitDist = Math.hypot(
        state.player.x - state.boss.x,
        state.player.z - state.boss.z
      );
      if (hitDist < CONFIG.boss.radius + CONFIG.player.radius + 0.2) {
        bossDamagePlayer();
        endCharge();
      }
    } else {
      // 目標地点到達 → 突進終了
      endCharge();
    }
  } else {
    // --- 通常徘徊 ---
    const dx   = state.bossTarget.x - state.boss.x;
    const dz   = state.bossTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.1) {
      const speed = CONFIG.boss.moveSpeed;
      state.boss.x += (dx / dist) * speed;
      state.boss.z += (dz / dist) * speed;
    } else {
      pickNewBossTarget();
    }
  }

  // 浮遊演出（Groupごと上下させる）
  const floatY = Math.sin(Date.now() / CONFIG.boss.floatSpeedMs) * CONFIG.boss.floatHeight;
  three.bossMesh.position.set(state.boss.x, floatY, state.boss.z);
}

function endCharge() {
  state.boss.isCharging    = false;
  state.boss.chargeTarget  = null;
  state.boss.lastChargeAt  = Date.now();
  pickNewBossTarget();
}

/** ボスの突進がヒット → プレイヤーにダメージ */
function bossDamagePlayer() {
  if (state.cleared || state.gameOver) return;

  state.player.hp = Math.max(0, state.player.hp - CONFIG.boss.chargeDamage);
  dom.statusLine.textContent = `⚡ 突進！ ${CONFIG.boss.chargeDamage} ダメージを受けた！`;
  dom.statusLine.style.color = "#ef476f";

  // 被弾フラッシュ(ボーダー赤く光る)
  dom.sceneContainer.classList.add("hit-flash");
  setTimeout(() => dom.sceneContainer.classList.remove("hit-flash"), 300);

  // プレイヤー本体（index 0）を一瞬赤く
  const playerBodyMat = three.playerGroup.children[0].material;
  playerBodyMat.color.set(0xff4444);
  setTimeout(() => playerBodyMat.color.set(CONFIG.player.color), 300);

  refreshUi();

  if (state.player.hp <= 0) {
    handlePlayerDefeated();
  }
}

function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
}

function isInAttackRange() {
  const dist = Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z);
  return dist <= CONFIG.battle.attackRange;
}

function updateAttackButtonState() {
  if (state.cleared || state.gameOver) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("in-range", inRange);
  three.rangeRingMat.color.set(inRange ? 0xef476f : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.35 : 0.15;
}

// ============================================================
// 6. 戦闘ロジック(将来サーバー連携する場合はここを差し替える)
// ============================================================

function attackBoss() {
  if (state.cleared || state.gameOver || !isInAttackRange()) return;

  const now = Date.now();
  if (now - state.lastAttackAt < CONFIG.battle.attackCooldownMs) return;
  state.lastAttackAt = now;

  // バトル開始時刻を記録(初回攻撃のタイミングで開始)
  if (!state.battleStartAt) state.battleStartAt = now;

  // --- ここから先がサーバー側で行うべき計算(現状はローカルで代用) ---
  const { minDamage, maxDamage } = CONFIG.battle;
  const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;

  state.currentHp   = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  // --- ここまで ---

  dom.statusLine.textContent  = `${damage} ダメージ！`;
  dom.statusLine.style.color  = "#6ee7b7";
  refreshUi();

  // ヒット演出(ボスを一瞬縮ませる)
  three.bossMesh.scale.set(0.85, 0.85, 0.85);
  setTimeout(() => three.bossMesh.scale.set(1, 1, 1), 100);

  if (state.currentHp === 0) {
    handleBossDefeated();
  }
}

/** ボスを倒した → 勝利 */
function handleBossDefeated() {
  state.cleared = true;
  const elapsed = state.battleStartAt
    ? Math.floor((Date.now() - state.battleStartAt) / 1000)
    : 0;

  // ボスを消す演出
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity     = 0.3;
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.remove("in-range");

  // 勝利オーバーレイ表示
  const m = elapsed % 60;
  const s = Math.floor(elapsed / 60);
  dom.winSub.textContent   = `討伐タイム: ${s}分${m}秒`;
  dom.winStats.innerHTML   =
    `与ダメージ合計: ${state.totalDamage}<br>攻撃回数: ${state.attackCount}`;
  dom.overlayWin.classList.add("show");
}

/** プレイヤーがやられた → 敗北 */
function handlePlayerDefeated() {
  state.gameOver = true;
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.remove("in-range");

  // ボスが勝利の演出(大きくなる)
  three.bossMesh.scale.set(1.4, 1.4, 1.4);

  // 敗北オーバーレイ表示
  dom.loseStats.innerHTML =
    `与ダメージ合計: ${state.totalDamage}<br>攻撃回数: ${state.attackCount}`;
  dom.overlayLose.classList.add("show");
}

function resetBattle() {
  // オーバーレイを閉じる
  dom.overlayWin.classList.remove("show");
  dom.overlayLose.classList.remove("show");

  // ボスHP
  state.currentHp     = CONFIG.boss.maxHp;
  state.totalDamage   = 0;
  state.attackCount   = 0;
  state.cleared       = false;
  state.gameOver      = false;
  state.lastAttackAt  = 0;
  state.battleStartAt = null;

  // プレイヤーHP
  state.player.hp = CONFIG.player.maxHp;
  state.player.x  = CONFIG.player.startX;
  state.player.z  = CONFIG.player.startZ;
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.playerGroup.children[0].material.color.set(CONFIG.player.color); // 本体の色をリセット

  // ボス
  state.boss.x            = 0;
  state.boss.z            = CONFIG.boss.homeZ;
  state.boss.isCharging   = false;
  state.boss.chargeTarget = null;
  state.boss.lastChargeAt = 0;
  three.bossMesh.scale.set(1, 1, 1);
  pickNewBossTarget();

  // ボスメッシュ復元
  three.bossMesh.material.transparent = false;
  three.bossMesh.material.opacity     = 1;

  // UI
  dom.statusLine.textContent = "";
  dom.statusLine.style.color = "#6ee7b7";
  dom.attackBtn.disabled     = false;
  dom.sceneContainer.classList.remove("hit-flash");

  refreshUi();
}

// ============================================================
// 7. UI更新
// ============================================================
function refreshUi() {
  // ボスHP
  const hpPercent = Math.max(0, (state.currentHp / CONFIG.boss.maxHp) * 100);
  dom.hpBarInner.style.width = hpPercent + "%";
  dom.hpText.textContent = `${CONFIG.boss.name}　HP ${state.currentHp} / ${CONFIG.boss.maxHp}`;

  if (hpPercent < 20) {
    dom.hpBarInner.style.background = "linear-gradient(90deg, #7c0a02, #ff4d4d)";
  } else if (hpPercent < 50) {
    dom.hpBarInner.style.background = "linear-gradient(90deg, #ff4d4d, #ff8c42)";
  } else {
    dom.hpBarInner.style.background = "linear-gradient(90deg, #ffb347, #ffd166)";
  }

  // プレイヤーHP
  const phpPercent = Math.max(0, (state.player.hp / CONFIG.player.maxHp) * 100);
  dom.playerHpBarInner.style.width = phpPercent + "%";
  dom.playerHpText.textContent     = `${state.player.hp} / ${CONFIG.player.maxHp}`;

  if (phpPercent < 30) {
    dom.playerHpBarInner.style.background = "linear-gradient(90deg, #7c0a02, #ef476f)";
  } else if (phpPercent < 60) {
    dom.playerHpBarInner.style.background = "linear-gradient(90deg, #ff8c42, #ffd166)";
  } else {
    dom.playerHpBarInner.style.background = "linear-gradient(90deg, #06d6a0, #6ee7b7)";
  }

  dom.totalDamageEl.textContent = state.totalDamage;
  dom.attackCountEl.textContent = state.attackCount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ============================================================
// メインループ
// ============================================================
function animate() {
  updatePlayerMovement();
  updateBossMovement();
  updateCameraFollow();
  updateAttackButtonState();
  three.renderer.render(three.scene, three.camera);
  requestAnimationFrame(animate);
}

// ============================================================
// 初期化
// ============================================================
function init() {
  initScene();
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();
