/**
 * game.js  v3
 * 全画面レスポンシブ対応 + ファンタジー森の風景
 */

// ============================================================
// 1. DOM
// ============================================================
const dom = {
  hpBarInner:     document.getElementById("hpBarInner"),
  hpText:         document.getElementById("hpText"),
  statusLine:     document.getElementById("statusLine"),
  attackBtn:      document.getElementById("attackBtn"),
  specialBtn:     document.getElementById("specialBtn"),
  gaugeInner:     document.getElementById("gaugeInner"),
  gaugeLabel:     document.getElementById("gaugeLabel"),
  totalDamageEl:  document.getElementById("totalDamage"),
  attackCountEl:  document.getElementById("attackCount"),
  resetBtn:       document.getElementById("resetBtn"),
  sceneContainer: document.getElementById("sceneContainer"),
};

// ============================================================
// 2. 状態
// ============================================================
const state = {
  currentHp:    CONFIG.boss.maxHp,
  totalDamage:  0,
  attackCount:  0,
  cleared:      false,
  lastAttackAt: 0,
  specialGauge: 0,
  keys: { up: false, down: false, left: false, right: false },
  player: { x: CONFIG.player.startX, z: CONFIG.player.startZ },
  boss:   { x: 0, z: CONFIG.boss.homeZ },
  bossTarget: { x: 0, z: CONFIG.boss.homeZ },
};

// ============================================================
// 3. Three.js シーン
// ============================================================
const three = {};

/** 画面サイズを取得（常に最新の viewport を返す） */
function getSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function initScene() {
  const { w, h } = getSize();

  three.scene = new THREE.Scene();
  // 霧で遠景をしっとりぼかす（ファンタジー感アップ）
  three.scene.fog = new THREE.FogExp2(0x1a2e1a, 0.04);
  three.scene.background = new THREE.Color(0x0d1f0d);

  three.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, w / h, 0.1, 120);

  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setSize(w, h);
  three.renderer.shadowMap.enabled = true;
  three.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.sceneContainer.appendChild(three.renderer.domElement);

  setupLights();
  buildGround();
  buildForestDecor();   // ← 木・岩・苔を配置
  buildAttackRing();
  buildBoss();
  buildPlayer();
}

// --- ライト ---
function setupLights() {
  // 月明かり風の青白い環境光
  three.scene.add(new THREE.AmbientLight(0x8899cc, 0.5));

  // メインの方向光（影あり）
  const moon = new THREE.DirectionalLight(0xaaccff, 0.9);
  moon.position.set(-8, 14, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 60;
  moon.shadow.camera.left = moon.shadow.camera.bottom = -20;
  moon.shadow.camera.right = moon.shadow.camera.top = 20;
  three.scene.add(moon);

  // ボスの足元を紫っぽく照らすポイントライト
  three.bossLight = new THREE.PointLight(0xcc66ff, 1.4, 8);
  three.bossLight.position.set(0, 1.5, CONFIG.boss.homeZ);
  three.scene.add(three.bossLight);
}

// --- 地面 ---
function buildGround() {
  const size = CONFIG.field.halfSize * 2 + 14;

  // メイン地面（草地）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a3d1a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  three.scene.add(ground);

  // 中央バトルエリアを少し明るい色で
  const arena = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.field.halfSize * 0.95, 48),
    new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 })
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.01;
  arena.receiveShadow = true;
  three.scene.add(arena);

  // 外周フェンス的な暗い円リング
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CONFIG.field.halfSize * 0.95, CONFIG.field.halfSize + 0.8, 48),
    new THREE.MeshBasicMaterial({ color: 0x111811, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  three.scene.add(ring);
}

// --- 攻撃範囲リング ---
function buildAttackRing() {
  const range = CONFIG.battle.attackRange;
  three.rangeRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
  });
  three.rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(range - 0.05, range, 48),
    three.rangeRingMat
  );
  three.rangeRing.rotation.x = -Math.PI / 2;
  three.rangeRing.position.y = 0.03;
  three.scene.add(three.rangeRing);
}

// ============================================================
// 森の装飾オブジェクト群
// ============================================================

/** 擬似的な木を1本作る（円柱の幹 + 円錐の葉） */
function makeFirTree(x, z, height = 3.5, baseRadius = 0.25) {
  const group = new THREE.Group();

  // 幹
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.5, baseRadius, height * 0.35, 7),
    new THREE.MeshStandardMaterial({ color: 0x3d1f0a, roughness: 1.0 })
  );
  trunk.position.y = height * 0.175;
  trunk.castShadow = true;
  group.add(trunk);

  // 葉（3段重ねで立体的に）
  const leafColor = new THREE.MeshStandardMaterial({ color: 0x1a5c1a, roughness: 0.9 });
  const leafDark  = new THREE.MeshStandardMaterial({ color: 0x143d14, roughness: 0.9 });
  const tiers = [
    { r: height * 0.28, h: height * 0.45, y: height * 0.35, mat: leafColor },
    { r: height * 0.22, h: height * 0.38, y: height * 0.58, mat: leafDark  },
    { r: height * 0.14, h: height * 0.30, y: height * 0.78, mat: leafColor },
  ];
  tiers.forEach(({ r, h, y, mat }) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat);
    cone.position.y = y * height * 0.1 + height * 0.3;
    cone.castShadow = true;
    group.add(cone);
  });

  group.position.set(x, 0, z);
  // 少しランダムに傾けて自然な感じに
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

/** 岩を1個作る（球を変形させて多面体風に） */
function makeRock(x, z, scale = 1.0) {
  const geo = new THREE.DodecahedronGeometry(scale, 0);
  // 頂点をランダムにでこぼこさせる
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * (0.85 + Math.random() * 0.3));
    pos.setY(i, pos.getY(i) * (0.6  + Math.random() * 0.25));
    pos.setZ(i, pos.getZ(i) * (0.85 + Math.random() * 0.3));
  }
  geo.computeVertexNormals();

  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.95, metalness: 0.05 })
  );
  rock.scale.set(1, 0.65, 1);   // 縦につぶして地面に馴染む形に
  rock.position.set(x, scale * 0.35, z);
  rock.rotation.y = Math.random() * Math.PI * 2;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

/** 苔の丸いかたまり（小さな半球） */
function makeMoss(x, z) {
  const r = 0.18 + Math.random() * 0.14;
  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(r, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x2d5a1a, roughness: 1.0 })
  );
  moss.scale.y = 0.55;
  moss.position.set(x, r * 0.3, z);
  return moss;
}

/** 発光するきのこ（雰囲気アップ用） */
function makeGlowMushroom(x, z) {
  const group = new THREE.Group();

  // 軸
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0xddccaa })
  );
  stem.position.y = 0.15;
  group.add(stem);

  // 傘
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x8833cc, emissive: 0x6600cc, emissiveIntensity: 0.6, roughness: 0.7
    })
  );
  cap.position.y = 0.28;
  group.add(cap);

  // 発光点
  const glow = new THREE.PointLight(0xaa44ff, 0.6, 2.5);
  glow.position.y = 0.3;
  group.add(glow);

  group.position.set(x, 0, z);
  return group;
}

/**
 * フィールド外周に木・岩・苔・きのこをランダム配置。
 * フィールド内側（halfSize以内）には置かない。
 */
function buildForestDecor() {
  const half = CONFIG.field.halfSize;
  const rng = (min, max) => Math.random() * (max - min) + min;

  // --- 木：フィールド外周を囲む ---
  // 8方向に固定で数本 + ランダム追加
  const treePositions = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 7) {
    const r = rng(half + 1.5, half + 5.5);
    treePositions.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  treePositions.forEach(([x, z]) => {
    const tree = makeFirTree(x, z, rng(2.8, 5.2));
    three.scene.add(tree);
  });

  // --- 岩：フィールド内外に散らばす ---
  const rockData = [
    [half - 1.5, -3, 0.6], [-half + 1.8, -2, 0.8], [3, half - 1.5, 0.5],
    [-3.5, -half + 1.2, 0.7], [half + 1.5, 0, 1.1], [-half - 1.2, 1, 0.9],
    [2, -half - 1.5, 0.7], [-1.5, half + 1.2, 0.6],
  ];
  rockData.forEach(([x, z, s]) => three.scene.add(makeRock(x, z, s)));

  // --- 苔：足元にランダムに ---
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r     = rng(half * 0.3, half * 1.8);
    three.scene.add(makeMoss(Math.cos(angle) * r, Math.sin(angle) * r));
  }

  // --- きのこ：数個だけ ---
  const shroomSpots = [
    [half - 0.8, 1.5], [-half + 0.6, -1.0], [1.8, half - 0.5],
    [-2.2, -half + 0.8], [half + 1.0, -2.5],
  ];
  shroomSpots.forEach(([x, z]) => three.scene.add(makeGlowMushroom(x, z)));

  // --- 遠景の木（より大きく・霧の向こう側） ---
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
    const r = rng(half + 6, half + 11);
    three.scene.add(makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(5, 8)));
  }
}

// --- ボス ---
function buildBoss() {
  three.bossMat = new THREE.MeshStandardMaterial({
    color: CONFIG.boss.color, roughness: 0.4, metalness: 0.1
  });
  three.bossMesh = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.boss.radius, 28, 28),
    three.bossMat
  );
  three.bossMesh.castShadow = true;
  three.bossMesh.position.set(state.boss.x, CONFIG.boss.radius, state.boss.z);
  three.scene.add(three.bossMesh);
}

// --- プレイヤー ---
function buildPlayer() {
  three.playerGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.player.radius, 20, 20),
    new THREE.MeshStandardMaterial({ color: CONFIG.player.color, roughness: 0.5 })
  );
  body.position.y = CONFIG.player.radius;
  body.castShadow = true;
  three.playerGroup.add(body);
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.scene.add(three.playerGroup);
}

// ============================================================
// 4. 入力
// ============================================================
function setupInput() {
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

  const keyMap = { arrowup:"up",w:"up", arrowdown:"down",s:"down", arrowleft:"left",a:"left", arrowright:"right",d:"right" };
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
  dom.specialBtn.addEventListener("click", useSpecialMove);
  dom.resetBtn.addEventListener("click", resetBattle);

  // ウィンドウリサイズ対応
  window.addEventListener("resize", () => {
    const { w, h } = getSize();
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });
}

// ============================================================
// 5. 更新処理
// ============================================================
function updatePlayerMovement() {
  let dx = 0, dz = 0;
  if (state.keys.up)    dz -= 1;
  if (state.keys.down)  dz += 1;
  if (state.keys.left)  dx -= 1;
  if (state.keys.right) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len  = Math.hypot(dx, dz);
    const half = CONFIG.field.halfSize;
    state.player.x = clamp(state.player.x + (dx / len) * CONFIG.player.moveSpeed, -half, half);
    state.player.z = clamp(state.player.z + (dz / len) * CONFIG.player.moveSpeed, -half, half);
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  }
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.rangeRing.position.set(state.player.x, 0.03, state.player.z);
}

function pickNewBossTarget() {
  const angle  = Math.random() * Math.PI * 2;
  const radius = Math.random() * CONFIG.boss.wanderRadius;
  state.bossTarget = { x: Math.cos(angle) * radius, z: CONFIG.boss.homeZ + Math.sin(angle) * radius };
}

function updateBossMovement() {
  if (state.cleared) return;
  const dx = state.bossTarget.x - state.boss.x;
  const dz = state.bossTarget.z - state.boss.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.1) {
    state.boss.x += (dx / dist) * CONFIG.boss.moveSpeed;
    state.boss.z += (dz / dist) * CONFIG.boss.moveSpeed;
  } else {
    pickNewBossTarget();
  }
  const floatY = CONFIG.boss.radius + Math.sin(Date.now() / CONFIG.boss.floatSpeedMs) * CONFIG.boss.floatHeight;
  three.bossMesh.position.set(state.boss.x, floatY, state.boss.z);
  // ボスの足元ライトを追従
  three.bossLight.position.set(state.boss.x, 1.5, state.boss.z);
}

function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
}

function isInAttackRange() {
  return Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z) <= CONFIG.battle.attackRange;
}

function updateAttackButtonState() {
  if (state.cleared) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("in-range", inRange);
  three.rangeRingMat.color.set(inRange ? 0xef476f : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.3 : 0.12;
}

// ============================================================
// 6. 戦闘 & エフェクト
// ============================================================
function getBossScreenPos() {
  const { w, h } = getSize();
  const v = new THREE.Vector3(state.boss.x, CONFIG.boss.radius, state.boss.z);
  v.project(three.camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
}

function spawnDamageNumber(damage, isCrit) {
  const pos = getBossScreenPos();
  const el  = document.createElement("div");
  el.className = "damage-number" + (isCrit ? " critical" : "");
  el.textContent = isCrit ? `⚡${damage}!!` : damage;
  el.style.left = (pos.x + (Math.random() - 0.5) * 50) + "px";
  el.style.top  = (pos.y + (Math.random() - 0.5) * 24) + "px";
  dom.sceneContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function flashBossHit(ms = 120) {
  three.bossMat.color.set(CONFIG.boss.hitColor);
  setTimeout(() => three.bossMat.color.set(CONFIG.boss.color), ms);
}

function triggerCameraShake() {
  const el = dom.sceneContainer;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), CONFIG.camera.shakeMs);
}

function attackBoss() {
  if (state.cleared || !isInAttackRange()) return;
  const now = Date.now();
  if (now - state.lastAttackAt < CONFIG.battle.attackCooldownMs) return;
  state.lastAttackAt = now;

  const { minDamage, maxDamage, criticalThreshold, specialGaugePerHit } = CONFIG.battle;
  const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
  const isCrit = damage >= criticalThreshold;

  state.currentHp    = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = Math.min(100, state.specialGauge + specialGaugePerHit);

  spawnDamageNumber(damage, isCrit);
  flashBossHit(isCrit ? 200 : 120);
  triggerCameraShake();

  three.bossMesh.scale.set(0.85, 0.85, 0.85);
  setTimeout(() => three.bossMesh.scale.set(1, 1, 1), 100);

  dom.statusLine.textContent = isCrit ? `⚡ クリティカル！ ${damage} ダメージ！` : `${damage} ダメージ！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}

function useSpecialMove() {
  if (state.cleared || !isInAttackRange() || state.specialGauge < 100) return;

  const { specialMinDamage, specialMaxDamage, specialMultiplier } = CONFIG.battle;
  const base   = Math.floor(Math.random() * (specialMaxDamage - specialMinDamage + 1)) + specialMinDamage;
  const damage = Math.floor(base * specialMultiplier);

  state.currentHp    = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = 0;

  spawnDamageNumber(damage, true);
  triggerCameraShake();
  three.bossMat.color.set(0xffffff);
  setTimeout(() => three.bossMat.color.set(CONFIG.boss.color), 350);
  three.bossMesh.scale.set(0.6, 0.6, 0.6);
  setTimeout(() => three.bossMesh.scale.set(1, 1, 1), 200);

  dom.statusLine.textContent = `✨ 光の必殺技！ 弱点ヒット！ ${damage} ダメージ！！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}

function handleBossDefeated() {
  state.cleared = true;
  dom.statusLine.textContent = "🎉 ボス討伐！おつかれさま！";
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.remove("in-range");
  dom.specialBtn.classList.remove("visible");
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity = 0.3;
}

function resetBattle() {
  state.currentHp    = CONFIG.boss.maxHp;
  state.totalDamage  = 0;
  state.attackCount  = 0;
  state.cleared      = false;
  state.lastAttackAt = 0;
  state.specialGauge = 0;

  // キー押しっぱなし状態をリセット（リセットボタン押下時に移動し続けるバグ対策）
  state.keys = { up: false, down: false, left: false, right: false };
  // 十字ボタンの見た目もリセット
  document.querySelectorAll(".dpad-btn").forEach(btn => btn.classList.remove("pressed"));

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
  three.bossMat.color.set(CONFIG.boss.color);
  refreshUi();
}

// ============================================================
// 7. UI
// ============================================================
function refreshUi() {
  const hpPct = Math.max(0, (state.currentHp / CONFIG.boss.maxHp) * 100);
  dom.hpBarInner.style.width = hpPct + "%";
  dom.hpText.textContent = `${CONFIG.boss.name}　HP ${state.currentHp} / ${CONFIG.boss.maxHp}`;

  if (hpPct < 20)      dom.hpBarInner.style.background = "linear-gradient(90deg,#7c0a02,#ff4d4d)";
  else if (hpPct < 50) dom.hpBarInner.style.background = "linear-gradient(90deg,#ff4d4d,#ff8c42)";
  else                 dom.hpBarInner.style.background = "linear-gradient(90deg,#ffb347,#ffd166)";

  dom.gaugeInner.style.width = state.specialGauge + "%";
  dom.gaugeLabel.textContent = `必殺技ゲージ: ${state.specialGauge}%`;
  dom.specialBtn.classList.toggle("visible", state.specialGauge >= 100);
  dom.totalDamageEl.textContent = state.totalDamage;
  dom.attackCountEl.textContent = state.attackCount;
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

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

function init() {
  initScene();
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();
