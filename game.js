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
  npcDialog:         document.getElementById("npcDialog"),
  npcDialogName:     document.getElementById("npcDialogName"),
  npcDialogText:     document.getElementById("npcDialogText"),
  npcDialogNext:     document.getElementById("npcDialogNext"),
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

// ============================================================
// ぷにぷに勇者 顔パーツ（カービィ風・虹彩+瞳孔+まつ毛3層+ほっぺ）
// ============================================================
function addSlimeFace(parent, r, eyeY = 0.25) {
  const faceGroup = new THREE.Group();

  // ── マテリアル ──────────────────────────────────────────────
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.05,
    emissive: 0xeeeeff, emissiveIntensity: 0.08,
  });
  const irisMat = new THREE.MeshStandardMaterial({
    color: 0x1a6fcc, roughness: 0.2,
    emissive: 0x0d3d88, emissiveIntensity: 0.30,
  });
  const pupilMat   = new THREE.MeshStandardMaterial({ color: 0x0a0a18, roughness: 0.3 });
  const hlMainMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.0, emissive: 0xffffff, emissiveIntensity: 1.2 });
  const hlSubMat   = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.0, emissive: 0x88ccff, emissiveIntensity: 0.8 });
  const lashMat    = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.8 });
  const mouthMat   = new THREE.MeshStandardMaterial({ color: 0x331122, roughness: 0.5 });
  const cheekMat   = new THREE.MeshStandardMaterial({ color: 0xff8888, roughness: 1.0, transparent: true, opacity: 0.40 });

  function makeEye(side) {
    const eyeGroup = new THREE.Group();

    // 白目（縦長楕円でぱっちり感）
    const white = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 14, 14), eyeWhiteMat);
    white.scale.set(1.0, 1.28, 0.72);
    eyeGroup.add(white);

    // 虹彩
    const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 12, 12), irisMat);
    iris.scale.set(1.0, 1.22, 0.68);
    iris.position.z = r * 0.09;
    eyeGroup.add(iris);

    // 瞳孔
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.095, 10, 10), pupilMat);
    pupil.scale.set(1.0, 1.15, 0.65);
    pupil.position.z = r * 0.155;
    eyeGroup.add(pupil);

    // メインハイライト（左上・大）
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.072, 7, 7), hlMainMat);
    hl1.scale.set(1.0, 1.3, 0.7);
    hl1.position.set(-r * 0.07, r * 0.10, r * 0.21);
    eyeGroup.add(hl1);

    // サブハイライト（右下・小）
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.036, 6, 6), hlSubMat);
    hl2.position.set(r * 0.07, -r * 0.04, r * 0.22);
    eyeGroup.add(hl2);

    // まつ毛（3本のアーチ）
    for (let li = -1; li <= 1; li++) {
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const kt = k / 5;
        pts.push(new THREE.Vector3(
          li * r * 0.07 + (li === 0 ? 0 : li * r * 0.035 * kt),
          r * 0.21 + kt * r * 0.15,
          r * 0.17 - kt * r * 0.04
        ));
      }
      eyeGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 5, r * 0.016, 4, false),
        lashMat
      ));
    }

    const angle = side * 0.38;
    eyeGroup.position.set(
      Math.sin(angle) * r * 0.83,
      r * (0.46 + eyeY),
      Math.cos(angle) * r * 0.83
    );
    eyeGroup.rotation.z = side * 0.07;
    return eyeGroup;
  }

  faceGroup.add(makeEye(-1));
  faceGroup.add(makeEye( 1));

  // 口（大きなニコッとした笑顔）
  const mouthPoints = [];
  const mouthWidth = r * 0.42;
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const mx = (t - 0.5) * mouthWidth * 2;
    const my = (4 * (t - 0.5) ** 2 - 1) * r * 0.13;
    const mz = Math.sqrt(Math.max(0, r * r - mx * mx - (r * (0.26 + eyeY)) ** 2)) * 0.93;
    mouthPoints.push(new THREE.Vector3(mx, r * (0.26 + eyeY) - r * 0.34 + my, mz));
  }
  faceGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 14, r * 0.036, 6, false),
    mouthMat
  ));

  // ほっぺたの赤み（左右）
  [-1, 1].forEach(side => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 6), cheekMat);
    cheek.scale.set(1.4, 0.65, 0.5);
    const angle = side * 0.64;
    cheek.position.set(
      Math.sin(angle) * r * 0.74,
      r * (0.22 + eyeY),
      Math.cos(angle) * r * 0.76
    );
    faceGroup.add(cheek);
  });

  parent.add(faceGroup);
  return faceGroup;
}

// ============================================================
// buildCuteSlimeBody — ぷにぷに体形＋触角＋帽子グループ を構築
// 戻り値 { body, bodyMat, hatGroup, stickMat } を呼び出し元で保存する
// ============================================================
function buildCuteSlimeBody(group, r, color) {
  // ── 本体（わずかに縦つぶれでぷにぷに感） ──────────────────
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 22), bodyMat);
  body.scale.set(1.0, 0.90, 1.0);
  body.position.y = r;
  body.castShadow = true;
  group.add(body);

  // ── 顔パーツ ────────────────────────────────────────────────
  addSlimeFace(body, r, 0.22);

  // ── 触角（左上に1本） ─────────────────────────────────────
  const stickMat = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
  const tipMat   = new THREE.MeshStandardMaterial({
    color: 0xaaddf8, roughness: 0.22,
    emissive: 0x44aace, emissiveIntensity: 0.35,
  });
  const tipHLMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.0,
  });

  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.044, r * 0.044, r * 0.62, 7), stickMat
  );
  stick.position.set(-r * 0.17, r * 0.85, r * 0.38);
  stick.rotation.z = 0.28;
  body.add(stick);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.115, 9, 9), tipMat);
  tip.position.set(-r * 0.36, r * 1.22, r * 0.33);
  body.add(tip);

  const tipHL = new THREE.Mesh(new THREE.SphereGeometry(r * 0.044, 6, 6), tipHLMat);
  tipHL.position.set(-r * 0.43, r * 1.30, r * 0.31);
  body.add(tipHL);

  // ── 帽子グループ（コスチューム差し替え用・空） ────────────
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, r * 0.88, 0);
  body.add(hatGroup);

  return { body, bodyMat, hatGroup, stickMat };
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
  const r     = CONFIG.player.radius;
  const color = state.equippedCostume?.color ?? CONFIG.player.color;

  // ── かわいいスライム本体を構築し three.slimeParts に保存 ──
  three.slimeParts = buildCuteSlimeBody(three.playerGroup, r, color);

  // ── 剣ピボット ─────────────────────────────────────────────
  three.swordPivot = new THREE.Group();
  three.swordPivot.position.set(r * 0.9, r * 1.4, 0);
  three.swordPivot.visible = false;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.68, 0.038),
    new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.92, roughness: 0.08, emissive: 0x88bbff, emissiveIntensity: 0.35 }));
  blade.position.y = 0.34;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.075),
    new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.75, roughness: 0.25 }));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.20, 6),
    new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 }));
  grip.position.y = -0.11;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 7),
    new THREE.MeshStandardMaterial({ color: 0xddbb33, metalness: 0.88, roughness: 0.18 }));
  pommel.position.y = -0.22;
  three.swordPivot.add(blade, guard, grip, pommel);
  three.playerGroup.add(three.swordPivot);

  // ── 槍ピボット ─────────────────────────────────────────────
  three.spearPivot = new THREE.Group();
  three.spearPivot.position.set(r * 0.9, r * 0.9, 0);
  three.spearPivot.visible = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.040, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b3d0f, roughness: 0.75 }));
  shaft.position.y = 1.1;
  [0.5, 0.9, 1.3].forEach(py => {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.065, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a1a05, roughness: 0.95 }));
    wrap.position.y = py;
    three.spearPivot.add(wrap);
  });
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.52, 8),
    new THREE.MeshStandardMaterial({ color: 0xd0e8ff, metalness: 0.96, roughness: 0.05, emissive: 0x3388ff, emissiveIntensity: 0.65 }));
  spearTip.position.y = 2.46;
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.058, 0.13, 8),
    new THREE.MeshStandardMaterial({ color: 0x99aacc, metalness: 0.88, roughness: 0.16 }));
  socket.position.y = 2.17;
  const spearButt = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.20, 8),
    new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.82, roughness: 0.22 }));
  spearButt.position.y = -0.10;
  spearButt.rotation.z = Math.PI;
  three.spearPivot.add(shaft, spearTip, socket, spearButt);
  three.playerGroup.add(three.spearPivot);

  three.swordSwing  = { active: false, progress: 0 };
  three.spearThrust = { active: false, progress: 0 };
  three.dashAttack  = { active: false, progress: 0 };

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
  startAttackMotion();
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

// ── 帽子差し替えシステム ──────────────────────────────────────
function rebuildHat(costume) {
  const hg = three.slimeParts?.hatGroup;
  if (!hg) return;
  // 既存を全破棄
  while (hg.children.length > 0) {
    const c = hg.children[0];
    c.traverse(x => { if (x.isMesh) { x.geometry?.dispose(); x.material?.dispose(); } });
    hg.remove(c);
  }
  const r = CONFIG.player.radius;
  switch (costume.hat) {
    case "witch":   _buildWitchHat(hg, r);    break;
    case "knight":  _buildKnightHelmet(hg, r); break;
    case "leaf":    _buildLeafCrown(hg, r);   break;
    case "crown":   _buildRoyalCrown(hg, r);  break;
    case "ice":     _buildIceCrystal(hg, r);  break;
    case "thunder": _buildThunderMark(hg, r); break;
  }
}

// 魔女帽子（まほうつかいスライム c11）
function _buildWitchHat(g, r) {
  const brimM = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.65 });
  const coneM = new THREE.MeshStandardMaterial({ color: 0x4c0579, roughness: 0.60 });
  const ribM  = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.50 });
  const gemM  = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.55, roughness: 0.1 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.80, r * 0.80, r * 0.08, 22), brimM));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.44, r * 1.5, 18), coneM);
  cone.position.y = r * 0.80;
  g.add(cone);
  const rib = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.455, r * 0.455, r * 0.13, 22), ribM);
  rib.position.y = r * 0.11;
  g.add(rib);
  const gem = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 8, 8), gemM);
  gem.position.set(r * 0.18, r * 1.6, r * 0.30);
  g.add(gem);
}

// 騎士兜（ナイトスライム c12）
function _buildKnightHelmet(g, r) {
  const domeM  = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.82, roughness: 0.18 });
  const visM   = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.30 });
  const crestM = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.88, roughness: 0.12 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.64, 16, 16), domeM);
  dome.position.y = r * 0.28;
  dome.scale.y = 0.75;
  g.add(dome);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(r * 0.92, r * 0.17, r * 0.28), visM);
  visor.position.set(0, r * 0.04, r * 0.44);
  g.add(visor);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.32, 6), crestM);
  crest.position.y = r * 0.73;
  g.add(crest);
}

// 葉の冠（もりのスライム c13）
function _buildLeafCrown(g, r) {
  const cols = [0x16a34a, 0x22c55e, 0x15803d];
  [0, Math.PI * 0.55, Math.PI * 1.1, Math.PI * 1.65].forEach((angle, i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * 0.33, 10, 7),
      new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.7 }));
    leaf.scale.set(0.38, 1.35, 0.28);
    leaf.position.set(Math.sin(angle) * r * 0.46, r * 0.46, Math.cos(angle) * r * 0.46);
    leaf.rotation.set(0, angle, Math.PI * 0.15);
    g.add(leaf);
  });
  const flower = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.35 }));
  flower.position.y = r * 0.56;
  g.add(flower);
}

// 王冠（キングスライム c21）
function _buildRoyalCrown(g, r) {
  const goldM  = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.15 });
  const spikeM = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.88, roughness: 0.12 });
  const gemMs  = [
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.4 }),
  ];
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.57, r * 0.57, r * 0.30, 22), goldM));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.10, r * 0.42, 6), spikeM);
    spike.position.set(Math.sin(a) * r * 0.50, r * 0.37, Math.cos(a) * r * 0.50);
    g.add(spike);
    if (i % 2 === 0) {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 7, 7), gemMs[Math.floor(i / 2) % 3]);
      gem.position.set(Math.sin(a) * r * 0.50, r * 0.14, Math.cos(a) * r * 0.50);
      g.add(gem);
    }
  }
}

// 氷の結晶（ライリンスライム c22）
function _buildIceCrystal(g, r) {
  const iceM1 = new THREE.MeshStandardMaterial({ color: 0xe0f9fe, metalness: 0.45, roughness: 0.08, transparent: true, opacity: 0.88 });
  const iceM2 = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, metalness: 0.40, roughness: 0.14, transparent: true, opacity: 0.78 });
  const main = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.82, 6), iceM1);
  main.position.y = r * 0.50;
  g.add(main);
  [{angle:0,s:0.55},{angle:Math.PI*0.62,s:0.45},{angle:Math.PI*1.32,s:0.50}].forEach(({angle,s}) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08 * s, r * 0.52 * s, 6), iceM2);
    c.position.set(Math.sin(angle) * r * 0.34, r * 0.28 * s, Math.cos(angle) * r * 0.34);
    c.rotation.z = Math.sin(angle) * 0.32;
    g.add(c);
  });
}

// 雷マーク（イカズチスライム c23）
function _buildThunderMark(g, r) {
  const boltM = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.85, roughness: 0.10 });
  const glowM = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.0, transparent: true, opacity: 0.72 });
  const pts = [
    new THREE.Vector3( r * 0.20, r * 0.92, r * 0.52),
    new THREE.Vector3(-r * 0.08, r * 0.58, r * 0.52),
    new THREE.Vector3( r * 0.14, r * 0.46, r * 0.52),
    new THREE.Vector3(-r * 0.20, r * 0.06, r * 0.52),
  ];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, r * 0.054, 5, false), boltM));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 8), glowM);
  glow.position.set(r * 0.20, r * 0.97, r * 0.52);
  g.add(glow);
}

// ── 攻撃モーション振り分け ────────────────────────────────────
function startAttackMotion() {
  const w = state.equippedCostume?.weapon || "none";
  if      (w === "sword") startSwordSwing();
  else if (w === "spear") startSpearThrust();
  else                    startDashAttack();
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
  updateDashAttack();
  updateSpearThrust();
  three.renderer.render(three.scene, three.camera);
  requestAnimationFrame(animate);
}

function init() {
  initScene();
  applyCostume(state.equippedCostume);
  setupInput();
  pickNewBossTarget();
  refreshUi();
  animate();
}

init();