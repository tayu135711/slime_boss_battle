/**
 * game.js  v3
 * 全画面レスポンシブ対応 + ファンタジー森の風景
 */

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
  resetBtn:         document.getElementById("resetBtn"),
  retryBtn:         document.getElementById("retryBtn"),
  sceneContainer:   document.getElementById("sceneContainer"),
  playerHpBarInner: document.getElementById("playerHpBarInner"),
  playerHpText:     document.getElementById("playerHpText"),
  damageFlash:      document.getElementById("damageFlash"),
  gameOverScreen:   document.getElementById("gameOverScreen"),
  titleScreen:      document.getElementById("titleScreen"),
  menuScreen:        document.getElementById("menuScreen"),
  menuStageBtn:      document.getElementById("menuStageBtn"),
  menuGachaBtn:      document.getElementById("menuGachaBtn"),
  menuOtherBtn:      document.getElementById("menuOtherBtn"),
  stageSelectScreen: document.getElementById("stageSelectScreen"),
  stageList:         document.getElementById("stageList"),
  stageSelectBackBtn:document.getElementById("stageSelectBackBtn"),
  stageStartScreen: document.getElementById("stageStartScreen"),
  stageStartBtn:    document.getElementById("stageStartBtn"),
  stageChapter:     document.getElementById("stageChapter"),
  stageNo:          document.getElementById("stageNo"),
  stageBossName:    document.getElementById("stageBossName"),
  resultScreen:     document.getElementById("resultScreen"),
  resultTitle:      document.getElementById("resultTitle"),
  resultStats:      document.getElementById("resultStats"),
  nextStageBtn:     document.getElementById("nextStageBtn"),
  endingScreen:     document.getElementById("endingScreen"),
  endingRetryBtn:   document.getElementById("endingRetryBtn"),
  gachaScreen:         document.getElementById("gachaScreen"),
  gachaCollection:     document.getElementById("gachaCollection"),
  gachaCurrentCostume: document.getElementById("gachaCurrentCostume"),
  gachaBackBtn:        document.getElementById("gachaBackBtn"),
  rewardCards:         document.getElementById("rewardCards"),
  homePlazaScreen:   document.getElementById("homePlazaScreen"),
  npcBubble:         document.getElementById("npcBubble"),
  plazaActionPrompt: document.getElementById("plazaActionPrompt"),
  titleStartBtn:     document.getElementById("titleStartBtn"),
};

const state = {
  currentHp:    STAGES[0].maxHp,
  totalDamage:  0,
  attackCount:  0,
  cleared:      false,
  stageIndex:   0,
  stageStartAt: 0,
  battleStarted: false,
  titleShown: true,
  unlockedStages: 1,
  lastAttackAt: 0,
  specialGauge: 0,
  keys: { up: false, down: false, left: false, right: false, action: false },
  player: {
    x: CONFIG.player.startX, z: CONFIG.player.startZ,
    hp: CONFIG.player.maxHp,
    invincibleUntil: 0,
  },
  boss:   { x: 0, z: -2.5 },
  bossTarget: { x: 0, z: -2.5 },
  bossAI: {
    phase: 1,
    nextAttackAt: 0,
    mode: "wander",
    chargeTarget: null,
  },
  gameOver: false,
  equippedCostume: COSTUMES[0],
  ownedCostumes:   [COSTUMES[0]],
  quests: {},
  inventory: {
    ingredients: {}
  },
  bento: [],
  maxBento: 3,
  dailyFishCount: 0,
  lastFishDate: null,
  dailyFlowerCount: 0,
  lastFlowerDate: null,
  unlockedRecipes: [],
  accessories: [],
};

const three = {};

function getSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function initScene() {
  const { w, h } = getSize();
  three.scene = new THREE.Scene();
  three.magicCircles = [];
  const s0 = getCurrentStage(state.stageIndex);
  three.scene.fog = new THREE.FogExp2(s0.bgColor, s0.fogDensity);
  three.scene.background = new THREE.Color(s0.bgColor);
  three.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, w / h, 0.1, 120);
  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setSize(w, h);
  three.renderer.shadowMap.enabled = true;
  three.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.sceneContainer.appendChild(three.renderer.domElement);

  setupLights();
  buildGround();
  buildForestDecor();
  buildAttackRing();
  buildBoss();
  buildPlayer();
}

function setupLights() {
  three.scene.add(new THREE.AmbientLight(0x8899cc, 0.5));
  const moon = new THREE.DirectionalLight(0xaaccff, 0.9);
  moon.position.set(-8, 14, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 60;
  moon.shadow.camera.left = moon.shadow.camera.bottom = -20;
  moon.shadow.camera.right = moon.shadow.camera.top = 20;
  three.scene.add(moon);
  three.bossLight = new THREE.PointLight(0xcc66ff, 1.4, 8);
  three.bossLight.position.set(0, 1.5, -2.5);
  three.scene.add(three.bossLight);
}

// --- 地面・装飾・攻撃リング・ボス・プレイヤー ---
function buildGround() {
  const size = CONFIG.field.halfSize * 2 + 14;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1a3d1a, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  three.scene.add(ground);
  const arena = new THREE.Mesh(new THREE.CircleGeometry(CONFIG.field.halfSize * 0.95, 48), new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 }));
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.01;
  arena.receiveShadow = true;
  three.scene.add(arena);
  const ring = new THREE.Mesh(new THREE.RingGeometry(CONFIG.field.halfSize * 0.95, CONFIG.field.halfSize + 0.8, 48), new THREE.MeshBasicMaterial({ color: 0x111811, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  three.scene.add(ring);
}

function buildAttackRing() {
  const range = CONFIG.battle.attackRange;
  three.rangeRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  three.rangeRing = new THREE.Mesh(new THREE.RingGeometry(range - 0.05, range, 48), three.rangeRingMat);
  three.rangeRing.rotation.x = -Math.PI / 2;
  three.rangeRing.position.y = 0.03;
  three.scene.add(three.rangeRing);
}

function makeFirTree(x, z, height = 3.5, baseRadius = 0.25) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius * 0.5, baseRadius, height * 0.35, 7), new THREE.MeshStandardMaterial({ color: 0x3d1f0a, roughness: 1.0 }));
  trunk.position.y = height * 0.175;
  trunk.castShadow = true;
  group.add(trunk);
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
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

function makeRock(x, z, scale = 1.0) {
  const geo = new THREE.DodecahedronGeometry(scale, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * (0.85 + Math.random() * 0.3));
    pos.setY(i, pos.getY(i) * (0.6  + Math.random() * 0.25));
    pos.setZ(i, pos.getZ(i) * (0.85 + Math.random() * 0.3));
  }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.95, metalness: 0.05 }));
  rock.scale.set(1, 0.65, 1);
  rock.position.set(x, scale * 0.35, z);
  rock.rotation.y = Math.random() * Math.PI * 2;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function makeMoss(x, z) {
  const r = 0.18 + Math.random() * 0.14;
  const moss = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), new THREE.MeshStandardMaterial({ color: 0x2d5a1a, roughness: 1.0 }));
  moss.scale.y = 0.55;
  moss.position.set(x, r * 0.3, z);
  return moss;
}

function makeGlowMushroom(x, z) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xddccaa }));
  stem.position.y = 0.15;
  group.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x8833cc, emissive: 0x6600cc, emissiveIntensity: 0.6, roughness: 0.7 }));
  cap.position.y = 0.28;
  group.add(cap);
  const glow = new THREE.PointLight(0xaa44ff, 0.6, 2.5);
  glow.position.y = 0.3;
  group.add(glow);
  group.position.set(x, 0, z);
  return group;
}

function buildForestDecor() {
  const half = CONFIG.field.halfSize;
  const rng = (min, max) => Math.random() * (max - min) + min;
  const treePositions = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 7) {
    const r = rng(half + 1.5, half + 5.5);
    treePositions.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  treePositions.forEach(([x, z]) => three.scene.add(makeFirTree(x, z, rng(2.8, 5.2))));
  const rockData = [
    [half - 1.5, -3, 0.6], [-half + 1.8, -2, 0.8], [3, half - 1.5, 0.5],
    [-3.5, -half + 1.2, 0.7], [half + 1.5, 0, 1.1], [-half - 1.2, 1, 0.9],
    [2, -half - 1.5, 0.7], [-1.5, half + 1.2, 0.6],
  ];
  rockData.forEach(([x, z, s]) => three.scene.add(makeRock(x, z, s)));
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rng(half * 0.3, half * 1.8);
    three.scene.add(makeMoss(Math.cos(angle) * r, Math.sin(angle) * r));
  }
  const shroomSpots = [
    [half - 0.8, 1.5], [-half + 0.6, -1.0], [1.8, half - 0.5],
    [-2.2, -half + 0.8], [half + 1.0, -2.5],
  ];
  shroomSpots.forEach(([x, z]) => three.scene.add(makeGlowMushroom(x, z)));
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
    const r = rng(half + 6, half + 11);
    three.scene.add(makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(5, 8)));
  }
}

function addSlimeFace(parent, r, eyeY = 0.25) {
  const faceGroup = new THREE.Group();
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  function makeEye(side) {
    const eyeGroup = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 12), eyeWhiteMat);
    eyeGroup.add(white);
    const black = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 10), eyeBlackMat);
    black.position.z = r * 0.11;
    eyeGroup.add(black);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(r * 0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
    highlight.position.set(r * 0.04, r * 0.04, r * 0.18);
    eyeGroup.add(highlight);
    const angle = side * 0.38;
    eyeGroup.position.set(Math.sin(angle) * r * 0.88, r * (0.5 + eyeY), Math.cos(angle) * r * 0.88);
    return eyeGroup;
  }
  faceGroup.add(makeEye(-1));
  faceGroup.add(makeEye( 1));
  const mouthPoints = [];
  const mouthWidth = r * 0.38;
  const segments   = 10;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mx = (t - 0.5) * mouthWidth * 2;
    const my = -Math.abs(t - 0.5) * r * 0.18;
    const mz = Math.sqrt(Math.max(0, r * r - mx * mx - (r * (0.3 + eyeY) - r * 0.25) ** 2)) * 0.95;
    mouthPoints.push(new THREE.Vector3(mx, r * (0.3 + eyeY) - r * 0.32 + my, mz));
  }
  const mouthCurve = new THREE.CatmullRomCurve3(mouthPoints);
  const mouthMesh = new THREE.Mesh(new THREE.TubeGeometry(mouthCurve, 12, r * 0.04, 6, false), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
  faceGroup.add(mouthMesh);
  parent.add(faceGroup);
  return faceGroup;
}

function buildBoss() {
  if (three.bossGroup) {
    three.bossGroup.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
    three.scene.remove(three.bossGroup);
  }
  const s = getCurrentStage(state.stageIndex);
  three.bossMat = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4, metalness: 0.1 });
  three.bossGroup = new THREE.Group();
  const result = buildBossModel(three.bossGroup, s, three.bossMat);
  three.bossMesh = result.mesh;
  three.bossGroup.position.set(state.boss.x, s.radius, state.boss.z);
  three.scene.add(three.bossGroup);
}

function buildPlayer() {
  three.playerGroup = new THREE.Group();
  const playerColor = state.equippedCostume?.color ?? CONFIG.player.color;
  const body = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.player.radius, 20, 20), new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.5 }));
  body.position.y = CONFIG.player.radius;
  body.castShadow = true;
  three.playerGroup.add(body);
  addSlimeFace(body, CONFIG.player.radius, 0.2);
  three.swordPivot = new THREE.Group();
  three.swordPivot.position.set(0.5, 0.8, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.04), new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.9, roughness: 0.1, emissive: 0x88bbff, emissiveIntensity: 0.3 }));
  blade.position.y = 0.35;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.7, roughness: 0.3 }));
  guard.position.y = 0.02;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 }));
  grip.position.y = -0.12;
  three.swordPivot.add(blade, guard, grip);
  three.playerGroup.add(three.swordPivot);
  three.swordSwing = { active: false, progress: 0 };
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.scene.add(three.playerGroup);
}

// 入力（キーボード・タッチ）
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
    if (k === " " || k === "enter") {
      e.preventDefault();
      if (fishingActive) fishingAction();
      else if (dom.homePlazaScreen.classList.contains("visible")) handlePlazaAction();
      else attackBoss();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (keyMap[k]) state.keys[keyMap[k]] = false;
  });

  dom.attackBtn.addEventListener("click", () => {
    if (fishingActive) fishingAction();
    else if (dom.homePlazaScreen.classList.contains("visible")) handlePlazaAction();
    else attackBoss();
  });
  dom.specialBtn.addEventListener("click", useSpecialMove);
  dom.resetBtn.addEventListener("click", resetBattle);
  dom.retryBtn.addEventListener("click", () => { resetBattle(); showStageStart(); });
  dom.stageStartBtn.addEventListener("click", startStage);
  dom.titleStartBtn.addEventListener("click", dismissTitle);
  dom.titleStartBtn.addEventListener("touchend", e => { e.preventDefault(); dismissTitle(); }, { passive: false });
  dom.menuStageBtn.addEventListener("click", showStageSelect);
  dom.menuGachaBtn.addEventListener("click", showGacha);
  dom.menuOtherBtn.addEventListener("click", () => window.__adminOpenPanel?.());
  dom.stageSelectBackBtn.addEventListener("click", () => { dom.stageSelectScreen.classList.remove("visible"); showHomePlaza(); });
  dom.nextStageBtn.addEventListener("click", goNextStage);
  dom.endingRetryBtn.addEventListener("click", () => { state.stageIndex = 0; dom.endingScreen.classList.remove("visible"); resetBattle(); showMenu(); });
  dom.gachaBackBtn.addEventListener("click", () => { dom.gachaScreen.classList.remove("visible"); dom.menuScreen.classList.add("visible"); });

  window.addEventListener("resize", () => {
    const { w, h } = getSize();
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h);
  });
}

// バトル更新
function updatePlayerMovement() {
  if (state.gameOver || !state.battleStarted) return;
  let dx = 0, dz = 0;
  if (state.keys.up) dz -= 1;
  if (state.keys.down) dz += 1;
  if (state.keys.left) dx -= 1;
  if (state.keys.right) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    const half = CONFIG.field.halfSize;
    state.player.x = clamp(state.player.x + (dx / len) * CONFIG.player.moveSpeed, -half, half);
    state.player.z = clamp(state.player.z + (dz / len) * CONFIG.player.moveSpeed, -half, half);
    three.playerGroup.rotation.y = Math.atan2(dx, dz);
  }
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.rangeRing.position.set(state.player.x, 0.03, state.player.z);
}

function pickNewBossTarget() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * getCurrentStage(state.stageIndex).wanderRadius;
  state.bossTarget = { x: Math.cos(angle) * radius, z: -2.5 + Math.sin(angle) * radius };
}

function updateBossMovement() {
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  const now = Date.now();
  const s = getCurrentStage(state.stageIndex);
  const hpRatio = state.currentHp / s.maxHp;
  const prevPhase = state.bossAI.phase;
  if      (hpRatio <= s.phase3At) state.bossAI.phase = 3;
  else if (hpRatio <= s.phase2At) state.bossAI.phase = 2;
  else                            state.bossAI.phase = 1;
  if (state.bossAI.phase > prevPhase) onPhaseChange(state.bossAI.phase);
  const intervalMs = s.attackIntervalMs / state.bossAI.phase;
  if (now >= state.bossAI.nextAttackAt && state.bossAI.mode === "wander") {
    const roll = Math.random();
    if (state.bossAI.phase === 1) {
      startBossCharge();
    } else if (state.bossAI.phase === 2) {
      (roll < 0.5 || !s.hasShockwave) ? startBossCharge() : startBossShockwave();
    } else {
      startBossCharge();
      if (s.hasShockwave) setTimeout(() => { if (!state.cleared && !state.gameOver) startBossShockwave(); }, 800);
    }
    state.bossAI.nextAttackAt = now + intervalMs;
  }
  if (state.bossAI.mode === "charge" && state.bossAI.chargeTarget) {
    const dx = state.bossAI.chargeTarget.x - state.boss.x;
    const dz = state.bossAI.chargeTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      state.boss.x += (dx / dist) * s.chargeSpeed;
      state.boss.z += (dz / dist) * s.chargeSpeed;
      checkChargeHit();
    } else {
      state.bossAI.mode = "wander";
      state.bossAI.chargeTarget = null;
      three.bossMat.color.set(s.color);
    }
  } else {
    const dx = state.bossTarget.x - state.boss.x;
    const dz = state.bossTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      state.boss.x += (dx / dist) * s.moveSpeed;
      state.boss.z += (dz / dist) * s.moveSpeed;
    } else {
      pickNewBossTarget();
    }
  }
  const floatY = s.radius + Math.sin(now / s.floatSpeedMs) * s.floatHeight;
  three.bossGroup.position.set(state.boss.x, floatY, state.boss.z);
  three.bossLight.position.set(state.boss.x, 1.5, state.boss.z);
}

function startBossCharge() { state.bossAI.mode = "charge"; state.bossAI.chargeTarget = { x: state.player.x, z: state.player.z }; three.bossMat.color.set(0xff3300); }
function checkChargeHit() {
  const s = getCurrentStage(state.stageIndex);
  if (Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z) < s.radius + CONFIG.player.radius + 0.3) applyPlayerDamage(s.chargeDamage);
}
function startBossShockwave() { if (!state.cleared && !state.gameOver) { state.bossAI.mode = "shockwave"; spawnShockwave(); setTimeout(() => { state.bossAI.mode = "wander"; }, 600); } }
function spawnShockwave() {
  const cx = state.boss.x, cz = state.boss.z;
  const ringGeo = new THREE.RingGeometry(0.1, 0.4, 36);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.08, cz);
  ring.scale.set(0.1, 1, 0.1);
  three.scene.add(ring);
  let frame = 0, hit = false;
  function animateWave() {
    frame++;
    const t = frame / 30;
    const r = t * getCurrentStage(state.stageIndex).shockwaveRadius;
    ring.scale.set(r, 1, r);
    ring.material.opacity = 0.9 * (1 - t);
    if (!hit && !state.cleared && !state.gameOver) {
      const pd = Math.hypot(state.player.x - cx, state.player.z - cz);
      if (pd < r + 0.5 && pd > r - 1.2) { hit = true; applyPlayerDamage(getCurrentStage(state.stageIndex).shockwaveDamage); }
    }
    if (frame < 30) requestAnimationFrame(animateWave);
    else { three.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); }
  }
  requestAnimationFrame(animateWave);
}
function onPhaseChange(phase) {
  const msgs = { 2: "⚠️ ボスが怒り始めた！", 3: "🔥 ボスが本気を出した！！" };
  dom.statusLine.textContent = msgs[phase] || "";
  three.bossMat.color.set(0xffffff);
  setTimeout(() => three.bossMat.color.set(getCurrentStage(state.stageIndex).color), 500);
  triggerCameraShake();
}
function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
}
function isInAttackRange() { return Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z) <= CONFIG.battle.attackRange; }
function updateAttackButtonState() {
  if (state.cleared) return;
  const inRange = isInAttackRange();
  dom.attackBtn.classList.toggle("disabled-look", !inRange);
  three.rangeRingMat.color.set(inRange ? 0x4466cc : 0xffffff);
  three.rangeRingMat.opacity = inRange ? 0.35 : 0.12;
}
function getBossScreenPos() {
  const { w, h } = getSize();
  const v = new THREE.Vector3(state.boss.x, getCurrentStage(state.stageIndex).radius * 1.5, state.boss.z);
  v.project(three.camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
}
function startSwordSwing() { if (!three.swordPivot) return; three.swordSwing.active = true; three.swordSwing.progress = 0; }
function updateSwordSwing() {
  if (!three.swordSwing || !three.swordSwing.active) return;
  three.swordSwing.progress += 0.06;
  const t = three.swordSwing.progress;
  let angle;
  if (t < 0.3) angle = (t / 0.3) * 1.2;
  else if (t < 0.8) angle = 1.2 - ((t - 0.3) / 0.5) * 3.2;
  else angle = -2.0 + ((t - 0.8) / 0.2) * 2.0;
  three.swordPivot.rotation.z = angle;
  if (t >= 1.0) { three.swordSwing.active = false; three.swordPivot.rotation.z = 0; }
}
function applyPlayerDamage(damage) {
  const now = Date.now();
  if (now < state.player.invincibleUntil || state.cleared || state.gameOver) return;
  state.player.hp = Math.max(0, state.player.hp - damage);
  state.player.invincibleUntil = now + CONFIG.player.invincibleMs;
  dom.damageFlash.classList.add("active");
  setTimeout(() => dom.damageFlash.classList.remove("active"), 150);
  const bodyMat = three.playerGroup.children[0]?.material;
  if (bodyMat) {
    bodyMat.color.set(0xffffff);
    setTimeout(() => bodyMat.color.set(state.equippedCostume?.color ?? CONFIG.player.color), 200);
  }
  triggerCameraShake();
  refreshUi();
  if (state.player.hp === 0) handleGameOver();
}
function handleGameOver() { state.gameOver = true; dom.gameOverScreen.classList.add("visible"); dom.statusLine.textContent = ""; }
function spawnMagicCircle() {
  const px = state.player.x, pz = state.player.z;
  const group = new THREE.Group();
  group.position.set(px, 0.05, pz);
  three.scene.add(group);
  three.magicCircles.push(group);
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  outerRing.rotation.x = -Math.PI / 2;
  group.add(outerRing);
  const midRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 48), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  midRing.rotation.x = -Math.PI / 2;
  group.add(midRing);
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.35, 32), new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  innerRing.rotation.x = -Math.PI / 2;
  group.add(innerRing);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 6.0, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xeeeeff, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
  pillar.position.y = 3.0;
  group.add(pillar);
  const glow = new THREE.PointLight(0xaaddff, 0, 5);
  glow.position.y = 1.5;
  group.add(glow);
  let frame = 0;
  group.userData.cancelled = false;
  function animate() {
    if (group.userData.cancelled) return;
    frame++;
    const t = frame / 80;
    let op;
    if (t < 0.25) op = t / 0.25;
    else if (t < 0.7) op = 1.0;
    else op = 1.0 - (t - 0.7) / 0.3;
    outerRing.material.opacity = op * 0.85;
    midRing.material.opacity = op * 0.9;
    innerRing.material.opacity = op * 0.9;
    const pillarT = Math.max(0, (t - 0.15) / 0.3);
    pillar.material.opacity = Math.min(pillarT, 1.0 - Math.max(0, (t - 0.65) / 0.35)) * 0.35;
    glow.intensity = Math.min(pillarT, 1.0 - Math.max(0, (t - 0.65) / 0.35)) * 2.5;
    outerRing.rotation.z += 0.04;
    innerRing.rotation.z -= 0.07;
    const scale = t < 0.2 ? 0.5 + (t / 0.2) * 0.6 : 1.1 - (t - 0.2) * 0.1;
    group.scale.set(scale, 1, scale);
    if (frame < 80) requestAnimationFrame(animate);
    else {
      three.scene.remove(group);
      [outerRing, midRing, innerRing, pillar].forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      group.remove(glow);
      three.magicCircles.splice(three.magicCircles.indexOf(group), 1);
    }
  }
  requestAnimationFrame(animate);
}
function spawnDamageNumber(damage, isCrit) {
  const pos = getBossScreenPos();
  const el = document.createElement("div");
  el.className = "damage-number" + (isCrit ? " critical" : "");
  el.textContent = isCrit ? `⚡${damage}!!` : damage;
  el.style.left = (pos.x + (Math.random() - 0.5) * 50) + "px";
  el.style.top  = (pos.y + (Math.random() - 0.5) * 24) + "px";
  dom.sceneContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}
function flashBossHit(ms = 120) { three.bossMat.color.set(getCurrentStage(state.stageIndex).hitColor); setTimeout(() => three.bossMat.color.set(getCurrentStage(state.stageIndex).color), ms); }
function triggerCameraShake() {
  const el = dom.sceneContainer;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), CONFIG.camera.shakeMs);
}
function attackBoss() {
  if (!state.battleStarted || state.cleared || !isInAttackRange()) return;
  const now = Date.now();
  if (now - state.lastAttackAt < CONFIG.battle.attackCooldownMs) return;
  state.lastAttackAt = now;
  const { minDamage, maxDamage, criticalThreshold, specialGaugePerHit } = CONFIG.battle;
  const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
  const isCrit = damage >= criticalThreshold;
  state.currentHp = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = Math.min(100, state.specialGauge + specialGaugePerHit);
  startSwordSwing();
  spawnDamageNumber(damage, isCrit);
  flashBossHit(isCrit ? 200 : 120);
  triggerCameraShake();
  three.bossGroup.scale.set(0.85, 0.85, 0.85);
  setTimeout(() => three.bossGroup.scale.set(1, 1, 1), 100);
  dom.statusLine.textContent = isCrit ? `⚡ クリティカル！ ${damage} ダメージ！` : `${damage} ダメージ！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}
function useSpecialMove() {
  if (state.cleared || !isInAttackRange() || state.specialGauge < 100) return;
  const { specialMinDamage, specialMaxDamage, specialMultiplier } = CONFIG.battle;
  const base = Math.floor(Math.random() * (specialMaxDamage - specialMinDamage + 1)) + specialMinDamage;
  const damage = Math.floor(base * specialMultiplier);
  state.currentHp = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = 0;
  spawnMagicCircle();
  spawnDamageNumber(damage, true);
  triggerCameraShake();
  three.bossMat.color.set(0xffffff);
  setTimeout(() => three.bossMat.color.set(getCurrentStage(state.stageIndex).color), 350);
  three.bossGroup.scale.set(0.6, 0.6, 0.6);
  setTimeout(() => three.bossGroup.scale.set(1, 1, 1), 200);
  dom.statusLine.textContent = `✨ 光の必殺技！ 弱点ヒット！ ${damage} ダメージ！！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}
function handleBossDefeated() {
  state.cleared = true;
  dom.attackBtn.disabled = true;
  dom.attackBtn.classList.add("disabled-look");
  dom.specialBtn.classList.remove("visible");
  three.bossMesh.material.transparent = true;
  three.bossMesh.material.opacity = 0.3;
  const elapsed = Math.floor((Date.now() - state.stageStartAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const stg = getCurrentStage(state.stageIndex);
  if (state.stageIndex + 1 > state.unlockedStages) state.unlockedStages = state.stageIndex + 1;
  setTimeout(() => {
    if (state.stageIndex >= STAGES.length - 1) dom.endingScreen.classList.add("visible");
    else {
      dom.resultTitle.textContent = `✨ Stage ${stg.stageNo} CLEAR! ✨`;
      dom.resultStats.innerHTML = `<div>🏆 討伐: <b>${stg.name}</b></div><div>⏱ クリアタイム: <b>${mm}:${ss}</b></div><div>⚔️ 与ダメージ: <b>${state.totalDamage}</b></div><div>🔢 攻撃回数: <b>${state.attackCount}</b>回</div>`;
      dom.resultScreen.classList.add("visible");
    }
  }, 800);
}
function dismissTitle() {
  if (!state.titleShown) return;
  state.titleShown = false;
  dom.titleScreen.style.transition = "opacity 0.5s ease";
  dom.titleScreen.style.opacity = "0";
  setTimeout(() => {
    dom.titleScreen.classList.remove("visible");
    dom.titleScreen.style.transition = "";
    dom.titleScreen.style.opacity = "";
    showHomePlaza();
  }, 500);
}
function showMenu() { dom.menuScreen.classList.add("visible"); }
function hideMenu() { dom.menuScreen.classList.remove("visible"); }
function showComingSoon(name) { dom.statusLine.textContent = `🚧 ${name}は準備中です！`; setTimeout(() => dom.statusLine.textContent = "", 2000); }
function showHomePlaza() {
  state.battleStarted = false;
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("visible"));
  dom.homePlazaScreen.classList.add("visible");
  initHomePlaza();
}
function showStageSelect() { hideMenu(); dom.stageSelectScreen.classList.add("visible"); buildStageList(); }
function buildStageList() {
  dom.stageList.innerHTML = "";
  STAGES.forEach((stg, idx) => {
    const locked = idx >= state.unlockedStages;
    const card = document.createElement("div");
    card.className = "stage-card" + (locked ? " locked" : "");
    card.innerHTML = `<div class="stage-card-no">Stage<b>${stg.stageNo}</b></div><div class="stage-card-info"><div class="stage-card-name">${stg.name}</div><div class="stage-card-hp">HP ${stg.maxHp.toLocaleString()}</div></div><div class="stage-card-lock">${locked ? "🔒" : "▶"}</div>`;
    if (!locked) card.addEventListener("click", () => { state.stageIndex = idx; resetBattle(); dom.stageSelectScreen.classList.remove("visible"); showStageStart(); });
    dom.stageList.appendChild(card);
  });
}
function showStageStart() {
  const stg = getCurrentStage(state.stageIndex);
  dom.stageChapter.textContent = `Chapter ${stg.chapter}`;
  dom.stageNo.textContent = `Stage ${stg.stageNo}`;
  dom.stageBossName.textContent = stg.name;
  dom.stageStartScreen.classList.add("visible");
}
function startStage() {
  dom.stageStartScreen.classList.remove("visible");
  state.stageStartAt = Date.now();
  state.battleStarted = true;
  const stg = getCurrentStage(state.stageIndex);
  three.scene.fog = new THREE.FogExp2(stg.bgColor, stg.fogDensity);
  three.scene.background = new THREE.Color(stg.bgColor);
  three.bossMat.color.set(stg.color);
  if (three.bossGroup) three.bossGroup.scale.set(1, 1, 1);
  three.scene.remove(three.bossGroup);
  buildBoss();
}
function goNextStage() { dom.resultScreen.classList.remove("visible"); state.stageIndex++; resetBattle(); showStageStart(); }
function resetBattle() {
  state.currentHp = getCurrentStage(state.stageIndex).maxHp;
  state.totalDamage = 0;
  state.attackCount = 0;
  state.cleared = false;
  state.lastAttackAt = 0;
  state.specialGauge = 0;
  state.keys = { up: false, down: false, left: false, right: false, action: false };
  state.gameOver = false;
  state.battleStarted = false;
  state.player.hp = CONFIG.player.maxHp;
  state.player.invincibleUntil = 0;
  state.bossAI = { phase: 1, nextAttackAt: Date.now() + 2000, mode: "wander", chargeTarget: null };
  dom.gameOverScreen.classList.remove("visible");
  document.querySelectorAll(".dpad-btn").forEach(btn => btn.classList.remove("pressed"));
  if (three.swordPivot) three.swordPivot.rotation.z = 0;
  if (three.swordSwing) three.swordSwing = { active: false, progress: 0 };
  three.magicCircles.forEach(g => { g.userData.cancelled = true; three.scene.remove(g); });
  three.magicCircles = [];
  state.player.x = CONFIG.player.startX;
  state.player.z = CONFIG.player.startZ;
  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  state.boss.x = 0; state.boss.z = -2.5;
  if (three.bossGroup) three.bossGroup.position.set(0, getCurrentStage(state.stageIndex).radius, -2.5);
  pickNewBossTarget();
  dom.statusLine.textContent = "";
  dom.attackBtn.disabled = false;
  three.bossMesh.material.transparent = false;
  three.bossMesh.material.opacity = 1;
  three.bossMat.color.set(getCurrentStage(state.stageIndex).color);
  refreshUi();
}
function refreshUi() {
  const cs = getCurrentStage(state.stageIndex);
  const hpPct = Math.max(0, (state.currentHp / cs.maxHp) * 100);
  dom.hpBarInner.style.width = hpPct + "%";
  dom.hpText.textContent = `${cs.name}　HP ${state.currentHp} / ${cs.maxHp}`;
  if (hpPct < 20) dom.hpBarInner.style.background = "linear-gradient(90deg,#7c0a02,#ff4d4d)";
  else if (hpPct < 50) dom.hpBarInner.style.background = "linear-gradient(90deg,#ff4d4d,#ff8c42)";
  else dom.hpBarInner.style.background = "linear-gradient(90deg,#ffb347,#ffd166)";
  dom.gaugeInner.style.width = state.specialGauge + "%";
  dom.gaugeLabel.textContent = `必殺技ゲージ: ${state.specialGauge}%`;
  dom.specialBtn.classList.toggle("visible", state.specialGauge >= 100);
  dom.totalDamageEl.textContent = state.totalDamage;
  dom.attackCountEl.textContent = state.attackCount;
  const playerHpPct = Math.max(0, (state.player.hp / CONFIG.player.maxHp) * 100);
  dom.playerHpBarInner.style.width = playerHpPct + "%";
  dom.playerHpText.textContent = `勇者　HP ${state.player.hp} / ${CONFIG.player.maxHp}`;
  if (playerHpPct < 25) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#cc0000,#ff4444)";
  else if (playerHpPct < 50) dom.playerHpBarInner.style.background = "linear-gradient(90deg,#ff8c00,#ffcc00)";
  else dom.playerHpBarInner.style.background = "linear-gradient(90deg,#44cc88,#88ffcc)";
}
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function animate() {
  if (fishingActive) {
    three.renderer.render(three.scene, three.camera);
    requestAnimationFrame(animate);
    return;
  }
  if (dom.homePlazaScreen.classList.contains("visible")) {
    updateHomePlazaLoop();
    three.renderer.render(three.scene, three.camera);
    requestAnimationFrame(animate);
    return;
  }
  updatePlayerMovement();
  updateBossMovement();
  updateCameraFollow();
  updateAttackButtonState();
  updateSwordSwing();
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