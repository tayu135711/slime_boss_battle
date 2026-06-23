/**
 * scene.js
 * Three.jsのシーン構築・装飾オブジェクト・スライム顔パーツ
 * 依存: state, three, CONFIG, STAGES, getCurrentStage
 */

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

function buildGround() {
  const size = CONFIG.field.halfSize * 2 + 14;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a3d1a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  three.scene.add(ground);
  const arena = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.field.halfSize * 0.95, 48),
    new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 })
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.01;
  arena.receiveShadow = true;
  three.scene.add(arena);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CONFIG.field.halfSize * 0.95, CONFIG.field.halfSize + 0.8, 48),
    new THREE.MeshBasicMaterial({ color: 0x111811, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  three.scene.add(ring);
}

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

// --- 森の装飾 ---
function makeFirTree(x, z, height = 3.5, baseRadius = 0.25) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.5, baseRadius, height * 0.35, 7),
    new THREE.MeshStandardMaterial({ color: 0x3d1f0a, roughness: 1.0 })
  );
  trunk.position.y = height * 0.175;
  trunk.castShadow = true;
  group.add(trunk);
  const leafColor = new THREE.MeshStandardMaterial({ color: 0x1a5c1a, roughness: 0.9 });
  const leafDark  = new THREE.MeshStandardMaterial({ color: 0x143d14, roughness: 0.9 });
  [
    { r: height * 0.28, h: height * 0.45, y: height * 0.35, mat: leafColor },
    { r: height * 0.22, h: height * 0.38, y: height * 0.58, mat: leafDark  },
    { r: height * 0.14, h: height * 0.30, y: height * 0.78, mat: leafColor },
  ].forEach(({ r, h, y, mat }) => {
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
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.95, metalness: 0.05 })
  );
  rock.scale.set(1, 0.65, 1);
  rock.position.set(x, scale * 0.35, z);
  rock.rotation.y = Math.random() * Math.PI * 2;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

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

function makeGlowMushroom(x, z) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6),
    new THREE.MeshStandardMaterial({ color: 0xddccaa })
  );
  stem.position.y = 0.15;
  group.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x8833cc, emissive: 0x6600cc, emissiveIntensity: 0.6, roughness: 0.7
    })
  );
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
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 7) {
    const r = rng(half + 1.5, half + 5.5);
    three.scene.add(makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(2.8, 5.2)));
  }
  [
    [half - 1.5, -3, 0.6], [-half + 1.8, -2, 0.8], [3, half - 1.5, 0.5],
    [-3.5, -half + 1.2, 0.7], [half + 1.5, 0, 1.1], [-half - 1.2, 1, 0.9],
    [2, -half - 1.5, 0.7], [-1.5, half + 1.2, 0.6],
  ].forEach(([x, z, s]) => three.scene.add(makeRock(x, z, s)));
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rng(half * 0.3, half * 1.8);
    three.scene.add(makeMoss(Math.cos(angle) * r, Math.sin(angle) * r));
  }
  [[half - 0.8, 1.5], [-half + 0.6, -1.0], [1.8, half - 0.5], [-2.2, -half + 0.8], [half + 1.0, -2.5]]
    .forEach(([x, z]) => three.scene.add(makeGlowMushroom(x, z)));
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
    const r = rng(half + 6, half + 11);
    three.scene.add(makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(5, 8)));
  }
}

// --- スライム顔パーツ ---
function addSlimeFace(parent, r, eyeY = 0.25) {
  const faceGroup = new THREE.Group();

  // 目のマテリアル
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.0 });
  const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.3 });
  const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.0, emissive: 0xffffff, emissiveIntensity: 0.3 });
  const hlSub = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.0, emissive: 0xaaccff, emissiveIntensity: 0.2 });

  function makeEye(side) {
    const eyeGroup = new THREE.Group();

    // 白目：縦に少しつぶした楕円（ぱっちり感）
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.23, 14, 14),
      eyeWhiteMat
    );
    white.scale.set(1.0, 1.15, 0.85);   // 縦に広げて横に薄く → 大きい目
    eyeGroup.add(white);

    // 黒目：白目より少し小さめ、前に出す
    const black = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.145, 12, 12),
      eyeBlackMat
    );
    black.scale.set(1.0, 1.1, 0.8);
    black.position.z = r * 0.12;
    eyeGroup.add(black);

    // ハイライト①：大きめ・左上（メインの輝き）
    const hl1 = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.062, 7, 7),
      highlightMat
    );
    hl1.position.set(-r * 0.06, r * 0.07, r * 0.20);
    eyeGroup.add(hl1);

    // ハイライト②：小さめ・右下（サブの輝き）
    const hl2 = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.032, 6, 6),
      hlSub
    );
    hl2.position.set(r * 0.06, -r * 0.03, r * 0.21);
    eyeGroup.add(hl2);

    // 目の位置：正面やや上、左右に振り分け
    const angle = side * 0.36;
    eyeGroup.position.set(
      Math.sin(angle) * r * 0.85,
      r * (0.52 + eyeY),
      Math.cos(angle) * r * 0.85
    );
    return eyeGroup;
  }

  faceGroup.add(makeEye(-1));
  faceGroup.add(makeEye( 1));
  const mouthPoints = [];
  const mouthWidth = r * 0.38;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const mx = (t - 0.5) * mouthWidth * 2;
    const my = -Math.abs(t - 0.5) * r * 0.18;
    const mz = Math.sqrt(Math.max(0, r * r - mx * mx - (r * (0.3 + eyeY) - r * 0.25) ** 2)) * 0.95;
    mouthPoints.push(new THREE.Vector3(mx, r * (0.3 + eyeY) - r * 0.32 + my, mz));
  }
  const mouthMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints), 12, r * 0.04, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
  );
  faceGroup.add(mouthMesh);
  parent.add(faceGroup);
  return faceGroup;
}

// --- ボス ---
function buildBoss() {
  const s = getCurrentStage(state.stageIndex);
  three.bossMat = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4, metalness: 0.1 });
  three.bossGroup = new THREE.Group();
  three.bossMesh = new THREE.Mesh(new THREE.SphereGeometry(s.radius, 28, 28), three.bossMat);
  three.bossMesh.castShadow = true;
  three.bossGroup.add(three.bossMesh);
  three.bossFaceGroup = addSlimeFace(three.bossGroup, s.radius, 0.15);
  three.bossGroup.position.set(state.boss.x, s.radius, state.boss.z);
  three.scene.add(three.bossGroup);
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
  addSlimeFace(body, CONFIG.player.radius, 0.2);

  // ---- 剣（ナイトスライム装備時に表示・デフォルト非表示） ----
  three.swordPivot = new THREE.Group();
  three.swordPivot.position.set(0.5, 0.8, 0);
  three.swordPivot.visible = false;   // デフォルトは非表示
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.7, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.9, roughness: 0.1, emissive: 0x88bbff, emissiveIntensity: 0.3 })
  );
  blade.position.y = 0.35;
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.7, roughness: 0.3 })
  );
  guard.position.y = 0.02;
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 })
  );
  grip.position.y = -0.12;
  three.swordPivot.add(blade);
  three.swordPivot.add(guard);
  three.swordPivot.add(grip);
  three.playerGroup.add(three.swordPivot);

  // ---- 槍（スライムスピア装備時に表示・デフォルト非表示） ----
  three.spearPivot = new THREE.Group();
  three.spearPivot.position.set(0.5, 0.6, 0);
  three.spearPivot.visible = false;
  // 槍の柄
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8 })
  );
  shaft.position.y = 0.55;
  // 槍先
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0xccddff, metalness: 0.9, roughness: 0.1, emissive: 0x4488ff, emissiveIntensity: 0.4 })
  );
  tip.position.y = 1.24;
  // 石突き（槍の下端）
  const butt = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.14, 6),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 })
  );
  butt.position.y = -0.07;
  butt.rotation.z = Math.PI;
  three.spearPivot.add(shaft);
  three.spearPivot.add(tip);
  three.spearPivot.add(butt);
  three.playerGroup.add(three.spearPivot);

  // アニメーション状態
  three.swordSwing  = { active: false, progress: 0 };  // ナイトスライム用
  three.dashAttack  = { active: false, progress: 0 };  // デフォルト体当たり用
  three.spearThrust = { active: false, progress: 0 };  // スピア用

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.scene.add(three.playerGroup);
}
