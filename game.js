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
  hpBarInner: document.getElementById("hpBarInner"),
  hpText: document.getElementById("hpText"),
  statusLine: document.getElementById("statusLine"),
  attackBtn: document.getElementById("attackBtn"),
  totalDamageEl: document.getElementById("totalDamage"),
  attackCountEl: document.getElementById("attackCount"),
  resetBtn: document.getElementById("resetBtn"),
  sceneContainer: document.getElementById("sceneContainer"),
};

// ============================================================
// 2. ゲーム状態
// ============================================================
const state = {
  currentHp: CONFIG.boss.maxHp,
  totalDamage: 0,
  attackCount: 0,
  cleared: false,
  lastAttackAt: 0,
  keys: { up: false, down: false, left: false, right: false },
  player: { x: CONFIG.player.startX, z: CONFIG.player.startZ },
  boss: { x: 0, z: CONFIG.boss.homeZ },
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

  // ボス
  three.bossMesh = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.boss.radius, 24, 24),
    new THREE.MeshStandardMaterial({ color: CONFIG.boss.color })
  );
  three.bossMesh.position.set(state.boss.x, CONFIG.boss.radius, state.boss.z);
  three.scene.add(three.bossMesh);

  // プレイヤー
  three.playerGroup = new THREE.Group();
  const playerBody = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.player.radius, 20, 20),
    new THREE.MeshStandardMaterial({ color: CONFIG.player.color })
  );
  playerBody.position.y = CONFIG.player.radius;
  three.playerGroup.add(playerBody);
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
    const press = (e) => { e.preventDefault(); state.keys[dir] = true; btn.classList.add("pressed"); };
    const release = (e) => { e.preventDefault(); state.keys[dir] = false; btn.classList.remove("pressed"); };

    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release, { passive: false });
    btn.addEventListener("touchcancel", release, { passive: false });
    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
  });

  // PCキーボード(矢印キー / WASD / スペースで攻撃)
  const keyMap = {
    arrowup: "up", w: "up",
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
}

// ============================================================
// 5. 更新処理
// ============================================================

function updatePlayerMovement() {
  let dx = 0, dz = 0;
  if (state.keys.up) dz -= 1;
  if (state.keys.down) dz += 1;
  if (state.keys.left) dx -= 1;
  if (state.keys.right) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    const speed = CONFIG.player.moveSpeed;
    const half = CONFIG.field.halfSize;

    state.player.x = clamp(state.player.x + (dx / len) * speed, -half, half);
    state.player.z = clamp(state.player.z + (dz / len) * speed, -half, half);

    // 向いている方向にキャラを回転(見た目の演出)
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  }

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.rangeRing.position.set(state.player.x, 0.02, state.player.z);
}

function pickNewBossTarget() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * CONFIG.boss.wanderRadius;
  state.bossTarget = {
    x: Math.cos(angle) * radius,
    z: CONFIG.boss.homeZ + Math.sin(angle) * radius,
  };
}

function updateBossMovement() {
  if (state.cleared) return;

  const dx = state.bossTarget.x - state.boss.x;
  const dz = state.bossTarget.z - state.boss.z;
  const dist = Math.hypot(dx, dz);

  if (dist > 0.1) {
    const speed = CONFIG.boss.moveSpeed;
    state.boss.x += (dx / dist) * speed;
    state.boss.z += (dz / dist) * speed;
  } else {
    pickNewBossTarget();
  }

  // 浮遊演出
  const floatY = CONFIG.boss.radius + Math.sin(Date.now() / CONFIG.boss.floatSpeedMs) * CONFIG.boss.floatHeight;
  three.bossMesh.position.set(state.boss.x, floatY, state.boss.z);
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
  if (state.cleared) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("in-range", inRange);
  three.rangeRingMat.color.set(inRange ? 0xef476f : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.35 : 0.15;
}

// ============================================================
// 6. 戦闘ロジック(将来サーバー連携する場合はここを差し替える)
// ============================================================

function attackBoss() {
  if (state.cleared || !isInAttackRange()) return;

  const now = Date.now();
  if (now - state.lastAttackAt < CONFIG.battle.attackCooldownMs) return;
  state.lastAttackAt = now;

  // --- ここから先がサーバー側で行うべき計算(現状はローカルで代用) ---
  const { minDamage, maxDamage } = CONFIG.battle;
  const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;

  state.currentHp = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  // --- ここまで ---

  dom.statusLine.textContent = `${damage} ダメージ！`;
  refreshUi();

  // ヒット演出(ボスを一瞬縮ませる)
  three.bossMesh.scale.set(0.85, 0.85, 0.85);
  setTimeout(() => three.bossMesh.scale.set(1, 1, 1), 100);

  if (state.currentHp === 0) {
    handleBossDefeated();
  }
}

function handleBossDefeated() {
  state.cleared = true;
  dom.statusLine.textContent = "🎉 ボス討伐！おつかれさま！";
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.remove("in-range");
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity = 0.3;
}

function resetBattle() {
  state.currentHp = CONFIG.boss.maxHp;
  state.totalDamage = 0;
  state.attackCount = 0;
  state.cleared = false;
  state.lastAttackAt = 0;

  state.player.x = CONFIG.player.startX;
  state.player.z = CONFIG.player.startZ;
  three.playerGroup.position.set(state.player.x, 0, state.player.z);

  state.boss.x = 0;
  state.boss.z = CONFIG.boss.homeZ;
  pickNewBossTarget();

  dom.statusLine.textContent = "";
  dom.attackBtn.disabled = false;
  three.bossMesh.material.transparent = false;
  three.bossMesh.material.opacity = 1;

  refreshUi();
}

// ============================================================
// 7. UI更新
// ============================================================
function refreshUi() {
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
