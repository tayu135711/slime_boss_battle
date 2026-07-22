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
  three.bossProjectiles = [];
  three.bossHazards = [];
  three.bossAttackIndicator = null;
  const s0 = getCurrentStage(state.stageIndex);
  three.scene.fog = new THREE.FogExp2(s0.bgColor, s0.fogDensity);
  three.scene.background = new THREE.Color(s0.bgColor);
  three.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, w / h, 0.1, 120);
  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  // ★ スマホ対応：デバイスピクセル比を最大1.5に制限（高解像スマホでの重さを軽減）
  three.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  three.renderer.setSize(w, h);
  three.renderer.shadowMap.enabled = true;
  three.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  three.renderer.outputColorSpace = THREE.SRGBColorSpace; // ★ MeshPhysicalMaterial用
  three.renderer.toneMapping = THREE.ACESFilmicToneMapping; // ★ ゼリー質感をきれいに表示
  three.renderer.toneMappingExposure = 1.0; // ★ 露出を下げて白飛びを抑制
  dom.sceneContainer.appendChild(three.renderer.domElement);
  setupLights();
  buildGround();
  buildForestDecor();
  buildAttackRing();
  buildBoss();
  buildPlayer();
}

function setupLights() {
  // ★ 全体の基本明るさ（白飛びしない程度に抑える）
  three.scene.add(new THREE.AmbientLight(0xfff5e0, 0.7));

  // ★ 太陽光（メインの昼光）
  const sun = new THREE.DirectionalLight(0xfff8d0, 1.4);
  sun.position.set(10, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
  sun.shadow.camera.right = sun.shadow.camera.top = 80;
  three.scene.add(sun);

  // ★ 補助ライト（影を柔らかくする逆方向の光）
  const fill = new THREE.DirectionalLight(0xc8e8ff, 0.4);
  fill.position.set(-6, 8, -4);
  three.scene.add(fill);

  // ★ 地面反射光（下からの跳ね返り）
  const bounce = new THREE.HemisphereLight(0x88dd88, 0x44aa44, 0.3);
  three.scene.add(bounce);

  // ★ ボス周辺の光
  three.bossLight = new THREE.PointLight(0xcc66ff, 1.2, 12);
  three.bossLight.position.set(0, 1.5, -2.5);
  three.scene.add(three.bossLight);

  // ★ フィールド中央の暖かい環境光（控えめに）
  const centerGlow = new THREE.PointLight(0xffdd88, 0.4, 30);
  centerGlow.position.set(0, 5, 0);
  three.scene.add(centerGlow);
}

function buildGround() {
  three.battleGround = []; // ★ バトル用地面オブジェクト管理

  // ★ 広い草原（オープンワールド感）
  const size = CONFIG.field.halfSize * 2 + 60;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0x3a7d2a, roughness: 0.85,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  three.scene.add(ground);
  three.battleGround.push(ground);

  // ★ バトルアリーナ（明るめの緑）- y=0.02で確実に浮かせてZファイティング防止
  const arena = new THREE.Mesh(
    new THREE.CircleGeometry(CONFIG.field.halfSize * 0.95, 64),
    new THREE.MeshStandardMaterial({
      color: 0x4a9e38, roughness: 0.75,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    })
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.y = 0.02;
  arena.receiveShadow = true;
  three.scene.add(arena);
  three.battleGround.push(arena);

  // ★ 境界リング（柔らかいトーン）- y=0.04
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CONFIG.field.halfSize * 0.95, CONFIG.field.halfSize + 0.8, 64),
    new THREE.MeshBasicMaterial({
      color: 0x2a5a20, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  three.scene.add(ring);
  three.battleGround.push(ring);

  // ★ 遠方の草原（段階的に広がる）- y=0.015
  for (let r = CONFIG.field.halfSize + 8; r < CONFIG.field.halfSize + 40; r += 12) {
    const farGrass = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 10, 32),
      new THREE.MeshStandardMaterial({
        color: r % 24 === (CONFIG.field.halfSize + 8) % 24 ? 0x3a7d2a : 0x336e25,
        roughness: 0.9,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      })
    );
    farGrass.rotation.x = -Math.PI / 2;
    farGrass.position.y = 0.015;
    three.scene.add(farGrass);
    three.battleGround.push(farGrass);
  }
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
  
  // 幹
  const trunkHeight = height * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius * 0.6, baseRadius, trunkHeight, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // もこもこな葉（複数の球体を重ねて雲のようなモコモコ樹冠を作る）
  const leafColor = 0x3d8c3a;
  const leafDark  = 0x2e6b2a;
  const leafLight = 0x5c9c48;
  const materials = [
    new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: leafDark, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: leafLight, roughness: 0.85 })
  ];

  // 球体をずらしながら配置して、自然なモコモコ感を出す
  const crownGroup = new THREE.Group();
  crownGroup.position.y = trunkHeight;

  const spherePlacements = [
    { r: height * 0.25, x: 0, y: height * 0.1, z: 0, matIdx: 0 },
    { r: height * 0.20, x: -height * 0.1, y: height * 0.25, z: height * 0.05, matIdx: 1 },
    { r: height * 0.20, x: height * 0.1, y: height * 0.22, z: -height * 0.05, matIdx: 2 },
    { r: height * 0.18, x: height * 0.05, y: height * 0.38, z: height * 0.08, matIdx: 0 },
    { r: height * 0.15, x: -height * 0.08, y: height * 0.48, z: -height * 0.05, matIdx: 1 },
    { r: height * 0.22, x: height * 0.12, y: height * 0.05, z: height * 0.12, matIdx: 1 },
    { r: height * 0.22, x: -height * 0.12, y: height * 0.08, z: -height * 0.12, matIdx: 2 }
  ];

  spherePlacements.forEach(({ r, x, y, z, matIdx }) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), materials[matIdx]);
    sphere.position.set(x, y, z);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    crownGroup.add(sphere);
  });

  group.add(crownGroup);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  
  // 風の揺れアニメーション用のプロパティをセット
  group.userData = {
    windPhase: Math.random() * Math.PI * 2,
    windSpeed: 0.0012 + Math.random() * 0.0008,
    windScale: 0.02 + Math.random() * 0.015,
    crown: crownGroup, // 葉の部分だけをより大きく揺らす
    isTree: true
  };

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

function makeFlower(x, z) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.25, 5),
    new THREE.MeshStandardMaterial({ color: 0x44aa44 })
  );
  stem.position.y = 0.125;
  group.add(stem);
  const colors = [0xffdd44, 0xff88aa, 0xff6644, 0xffffff, 0xaa88ff];
  const petal = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 5),
    new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      roughness: 0.6, emissive: 0x331100, emissiveIntensity: 0.15
    })
  );
  petal.scale.y = 0.5;
  petal.position.y = 0.28;
  group.add(petal);
  group.position.set(x, 0, z);
  return group;
}

function makePond(x, z, radius = 1.5) {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.1, metalness: 0.3 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(x, 0.02, z);
  return pond;
}

function buildForestDecor() {
  three.battleDecors = []; // ★ バトル用装飾オブジェクト管理
  const half = CONFIG.field.halfSize;
  const rng = (min, max) => Math.random() * (max - min) + min;

  // アリーナ周辺の木（近い輪）
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const r = rng(half + 1.5, half + 4.5);
    const obj = makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(2.8, 5.2));
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // ★ 中距離の木（広い輪 1）
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
    const r = rng(half + 6, half + 14);
    const obj = makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(4, 8));
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // ★ 遠距離の木（広い輪 2）
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) {
    const r = rng(half + 16, half + 30);
    const obj = makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(6, 12));
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // ★ ランダム散在木（オープンワールド感）
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rng(half + 5, half + 35);
    const obj = makeFirTree(Math.cos(angle) * r, Math.sin(angle) * r, rng(3, 10));
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // 岩
  [
    [half - 1.5, -3, 0.6], [-half + 1.8, -2, 0.8], [3, half - 1.5, 0.5],
    [-3.5, -half + 1.2, 0.7], [half + 2.5, 3, 1.1], [-half - 2.2, 1, 0.9],
    [2, -half - 2.5, 0.7], [-1.5, half + 2.2, 0.6],
    [half + 8, -5, 1.3], [-half - 9, 4, 1.0], [6, half + 10, 0.9],
    [-8, -half - 11, 1.2],
  ].forEach(([x, z, s]) => { const obj = makeRock(x, z, s); three.scene.add(obj); three.battleDecors.push(obj); });

  // 苔（広い範囲に）
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rng(half * 0.3, half * 2.5);
    const obj = makeMoss(Math.cos(angle) * r, Math.sin(angle) * r);
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // 光るきのこ（アリーナ内外に増量）
  [
    [half - 0.8, 1.5], [-half + 0.6, -1.0], [1.8, half - 0.5], [-2.2, -half + 0.8],
    [half + 2.0, -3.5], [-half - 2.0, 2.5], [0, -half - 2.0], [half + 5, 5],
    [-half - 6, -3], [half - 3, half + 3],
  ].forEach(([x, z]) => { const obj = makeGlowMushroom(x, z); three.scene.add(obj); three.battleDecors.push(obj); });

  // ★ 花畑（オープンワールド点在）
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rng(half * 0.5, half * 3.0);
    const obj = makeFlower(Math.cos(angle) * r, Math.sin(angle) * r);
    three.scene.add(obj); three.battleDecors.push(obj);
  }

  // ★ 小さな池（遠くに点在）
  [
    [half + 12, -8], [-half - 14, 6], [half - 5, half + 15], [-half - 8, -half - 12],
  ].forEach(([x, z]) => { const obj = makePond(x, z, rng(1.2, 2.5)); three.scene.add(obj); three.battleDecors.push(obj); });
}

// --- スライム顔パーツ ---
function addSlimeFace(parent, r, eyeY = 0.25) {
  const faceGroup = new THREE.Group();

  // ── マテリアル ──────────────────────────────────────────────
  // カービィ風：目は大きな黒い楕円＋星型ハイライト
  const eyeBaseMat = new THREE.MeshStandardMaterial({
    color: 0x111133, roughness: 0.2,
  });
  const hlStarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.0,
    emissive: 0xffffff, emissiveIntensity: 1.5,
  });
  const hlSubMat = new THREE.MeshStandardMaterial({
    color: 0xaaddff, roughness: 0.0,
    emissive: 0x88ccff, emissiveIntensity: 1.0,
  });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x221111, roughness: 0.4 });
  const cheekMat = new THREE.MeshStandardMaterial({
    color: 0xff6699, roughness: 1.0, transparent: true, opacity: 0.50,
  });

  function makeEye(side) {
    const eyeGroup = new THREE.Group();

    // ── 大きな黒い楕円（カービィの目の特徴） ──
    const eyeBase = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.28, 18, 18),
      eyeBaseMat
    );
    eyeBase.scale.set(0.85, 1.35, 0.55); // 縦長・平らにして正面感UP
    eyeGroup.add(eyeBase);

    // ── ハイライト：大きい丸（左上）＋小さい丸（右下）のシンプル2点 ──
    const hlMain = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.095, 10, 10),
      hlStarMat
    );
    hlMain.position.set(-r * 0.07, r * 0.13, r * 0.17);
    eyeGroup.add(hlMain);

    const hlSub = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.048, 8, 8),
      hlSubMat
    );
    hlSub.position.set(r * 0.07, -r * 0.06, r * 0.17);
    eyeGroup.add(hlSub);

    // ── 目の配置：カービィ風に少し下・中央寄り ──
    const angle = side * 0.32;
    eyeGroup.position.set(
      Math.sin(angle) * r * 0.75,
      r * (0.42 + eyeY),
      Math.cos(angle) * r * 0.80
    );
    eyeGroup.rotation.z = side * 0.05;
    return eyeGroup;
  }

  faceGroup.add(makeEye(-1));
  faceGroup.add(makeEye( 1));

  // ── 口：カービィ風の小さなw字ニコニコ口 ──
  const mouthPts = [];
  const mw = r * 0.30;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const mx = (t - 0.5) * mw * 2;
    // w字カーブ：両端と中央が下がるハッピーな口
    const wave = Math.sin(t * Math.PI) * r * 0.10;
    const my = -wave;
    const mz = Math.sqrt(Math.max(0, r * r - mx * mx)) * 0.88;
    mouthPts.push(new THREE.Vector3(mx, r * (0.14 + eyeY) + my, mz));
  }
  const mouthMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPts), 20, r * 0.032, 6, false),
    mouthMat
  );
  faceGroup.add(mouthMesh);

  // ── ほっぺた：カービィ風の大きめ赤丸 ──
  [-1, 1].forEach(side => {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.16, 10, 8),
      cheekMat
    );
    cheek.scale.set(1.5, 0.75, 0.45);
    const angle = side * 0.58;
    cheek.position.set(
      Math.sin(angle) * r * 0.70,
      r * (0.20 + eyeY),
      Math.cos(angle) * r * 0.80
    );
    faceGroup.add(cheek);
  });

  parent.add(faceGroup);
  return faceGroup;
}

// --- ボス ---
function buildBoss() {
  // ★修正: 以前はボスを常に「共通の球体＋汎用スライム顔」で組み立てていたため、
  //         boss_models.js に用意されていたステージ別モデル（Stage1〜6の専用スライム顔や
  //         Chapter2以降の異形モンスター群）が一度も呼ばれず、完全な死にコードになっていた。
  //         buildBossModel() を呼び、ステージ・チャプターに応じた専用モデルを実際に構築する。

  // 古いbossGroup配下の全パーツ（geometry・material）をdispose（メモリリーク防止）
  if (three.bossGroup) {
    three.bossGroup.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material && child.material !== three.bossMat) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      }
    });
  }
  if (three.bossMat) three.bossMat.dispose();

  const s = getCurrentStage(state.stageIndex);
  three.bossMat   = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4, metalness: 0.1 });
  three.bossGroup = new THREE.Group();

  // ★ ステージ／チャプターごとの専用ボスモデルを構築（boss_models.js）
  const built = buildBossModel(three.bossGroup, s, three.bossMat);
  three.bossMesh = built.mesh;
  three.bossMesh.castShadow = true;
  three.bossFaceGroup = null; // 顔パーツは各モデル内部で構築されるためここでは個別管理しない

  three.bossGroup.position.set(state.boss.x, s.radius, state.boss.z);
  three.scene.add(three.bossGroup);
}

// --- プレイヤー ---
// ★修正: 剣・槍のメッシュ生成をbuildPlayer専用の処理から独立関数に切り出した。
//         これまでバトル用の three.playerGroup にしか武器パーツが存在せず、
//         広場（ホーム画面）のスライムには武器の見た目が一切反映されなかった。
//         この関数を home_scene.js の buildPlazaPlayer() からも呼び出すことで、
//         ホーム画面でもコスチュームの武器（剣・槍）が表示されるようにする。

// ---- 剣メッシュ（ナイトスライム装備時に表示・デフォルト非表示） ----
function buildSwordPivot() {
  const pivot = new THREE.Group();
  pivot.position.set(0.55, 0.75, 0);
  pivot.visible = false;

  // 刀身：細長く大きく・強い輝き
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 1.45, 0.055),
    new THREE.MeshStandardMaterial({
      color: 0xe8f4ff, metalness: 0.97, roughness: 0.04,
      emissive: 0x66aaff, emissiveIntensity: 0.55,
    })
  );
  blade.position.y = 0.72;

  // 刀身の中央ラインに溝（細い板で表現）
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 1.2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xaaccff, metalness: 1.0, roughness: 0.0, emissive: 0x88ccff, emissiveIntensity: 0.8 })
  );
  fuller.position.set(0, 0.72, 0.033);
  pivot.add(fuller);

  // 鍔（クロスガード）：しっかりした十字
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.075, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xddbb33, metalness: 0.85, roughness: 0.2, emissive: 0x886600, emissiveIntensity: 0.2 })
  );
  guard.position.y = 0.04;

  // 鍔の縦バー
  const guardV = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.18, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xddbb33, metalness: 0.85, roughness: 0.2 })
  );
  guardV.position.y = 0.04;
  pivot.add(guardV);

  // グリップ
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.042, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a2008, roughness: 0.85 })
  );
  grip.position.y = -0.22;

  // ポメル（柄頭）
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 7),
    new THREE.MeshStandardMaterial({ color: 0xddbb33, metalness: 0.9, roughness: 0.2 })
  );
  pommel.position.y = -0.45;

  pivot.add(blade, guard, grip, pommel);
  return pivot;
}

// ---- 槍メッシュ（スライムスピア装備時に表示・デフォルト非表示） ----
function buildSpearPivot() {
  const pivot = new THREE.Group();
  pivot.position.set(0.5, 0.5, 0);
  pivot.visible = false;

  // 柄：長く太く
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.042, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b3d0f, roughness: 0.75, metalness: 0.05 })
  );
  shaft.position.y = 1.1;
  pivot.add(shaft);

  // 柄の中央に巻き革のリング
  [0.5, 0.9, 1.3].forEach(py => {
    const wrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.07, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a1a05, roughness: 0.95 })
    );
    wrap.position.y = py;
    pivot.add(wrap);
  });

  // 穂先：大きく鋭く、強発光
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.55, 8),
    new THREE.MeshStandardMaterial({
      color: 0xd0e8ff, metalness: 0.97, roughness: 0.04,
      emissive: 0x3388ff, emissiveIntensity: 0.7,
    })
  );
  tip.position.y = 2.47;
  pivot.add(tip);

  // 穂先の根元リング（ソケット）
  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.06, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x99aacc, metalness: 0.9, roughness: 0.15 })
  );
  socket.position.y = 2.18;
  pivot.add(socket);

  // 石突き（下端）
  const butt = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.85, roughness: 0.2 })
  );
  butt.position.y = -0.11;
  butt.rotation.z = Math.PI;
  pivot.add(butt);

  return pivot;
}

function buildPlayer() {
  three.playerGroup = new THREE.Group();
  // buildCuteSlimeBodyでbody/bodyMat/hatGroup/stickMatを生成しthree.slimePartsに保存
  const parts = buildCuteSlimeBody(three.playerGroup, CONFIG.player.radius, CONFIG.player.color);
  three.slimeParts = parts;
  const body = parts.body;

  three.swordPivot = buildSwordPivot();
  three.playerGroup.add(three.swordPivot);

  three.spearPivot = buildSpearPivot();
  three.playerGroup.add(three.spearPivot);

  // アニメーション状態
  three.swordSwing  = { active: false, progress: 0 };  // ナイトスライム用
  three.dashAttack  = { active: false, progress: 0 };  // デフォルト体当たり用
  three.spearThrust = { active: false, progress: 0 };  // スピア用

  three.playerGroup.position.set(state.player.x, 0, state.player.z);
  three.scene.add(three.playerGroup);
}

// ============================================================
// buildCuteSlimeBody — ぷにぷに体形＋触角＋帽子グループ を構築
// home_scene.jsのNPC・広場プレイヤー生成にも使用
// 戻り値 { body, bodyMat, hatGroup, stickMat }
// ============================================================
function buildCuteSlimeBody(group, r, color) {
  // ── ぷにぷに体形：頂点変形で底面を平たく・上部をふっくら ──
  const geo = new THREE.SphereGeometry(r, 32, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = y / r; // -1〜1の正規化Y
    // 底面を平らに押し込む
    const flatBottom = ny < -0.3 ? -0.3 + (ny + 0.3) * 0.35 : ny;
    // 上部をふっくり膨らませる
    const puff = ny > 0 ? 1.0 + ny * 0.18 : 1.0;
    // 横方向を少し膨らませてぷにっと感
    const bulge = 1.0 + Math.max(0, 1.0 - ny * ny) * 0.12;
    pos.setXYZ(i, x * bulge * puff, flatBottom * r * puff, z * bulge * puff);
  }
  pos.needsUpdate = true;  // ★ 頂点変形をGPUに反映
  geo.computeVertexNormals();

  // ── MeshPhysicalMaterialでゼリー質感 ──
  // ★修正: 以前もtransmission/clearcoat/envMapIntensityを一度下げていたが、
  //         それでも「白すぎる・のっぺりして可愛くない」という声があった。
  //         transmission(半透明感)とclearcoat(環境光を白く反射するコーティング)が
  //         組み合わさると、どの衣装色でも表面が白くぼやけて見えてしまい、
  //         結果としてコスチュームごとの色の違いも埋もれて薄く感じられていた。
  //         半透明を完全にオフにし、コーティングと環境反射をさらに抑え、
  //         代わりにemissiveIntensityを上げて本体色そのものをはっきり主張させる。
  //         roughnessも上げてマット寄りにし、鏡面ハイライトでの白飛びを抑える。
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,          // ★ 0.15→0.32：マットよりにして白い鏡面ハイライトを抑制
    metalness: 0.0,
    transmission: 0.0,        // ★ 0.08→0.0：半透明のミルキーさが白飛びの主因だったため撤廃
    thickness: r * 0.8,
    clearcoat: 0.30,          // ★ 0.8→0.30：白く反射するコーティングを大幅に抑制
    clearcoatRoughness: 0.25, // ★ ハイライトをぼかして柔らかい質感に
    ior: 1.35,
    envMapIntensity: 0.25,    // ★ 0.8→0.25：空・環境の白い映り込みをさらに抑制
    // ★ emissiveで本体色をはっきり主張させる（白飛び・コスチューム差が薄い対策）
    emissive: color,
    emissiveIntensity: 0.25,  // ★ 0.12→0.25
  });
  const body = new THREE.Mesh(geo, bodyMat);
  body.scale.set(1.0, 1.0, 1.0);
  body.position.y = r * 0.78;  // 底面が平らな分少し下げる
  body.castShadow = true;
  group.add(body);

  addSlimeFace(body, r, 0.22);

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

  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, r * 0.88, 0);
  body.add(hatGroup);

  return { body, bodyMat, hatGroup, stickMat };
}

// ── 帽子差し替えシステム ──────────────────────────────────────
function rebuildHat(costume) {
  // ★修正: 以前は three.slimeParts（バトル用スライム）の帽子しか更新しておらず、
  //         広場のスライム(plaza.slimeParts)には帽子付きコスチュームが一切反映されなかった。
  //         両方のhatGroupを更新するようにする。
  const hatGroups = [three.slimeParts?.hatGroup, plaza?.slimeParts?.hatGroup].filter(Boolean);
  hatGroups.forEach(hg => _rebuildHatGroup(hg, costume));
}

function _rebuildHatGroup(hg, costume) {
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
