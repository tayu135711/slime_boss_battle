/**
 * home_scene.js
 * ホーム広場のThree.jsシーン管理
 *
 * 設計方針：
 * - バトル用の three オブジェクト（three.scene, three.camera 等）はそのまま使う
 * - 広場表示時はバトル用オブジェクト（boss, walls等）を非表示にし、広場用を追加
 * - 広場を出るときは逆に元に戻す
 */

// 広場専用オブジェクトを格納
const plaza = {
  ground: null,
  fountain: null,
  buildings: [],      // [{ mesh, label, type, x, z }]
  npcMeshes: [],
  playerMesh: null,
  animFrame: null,
  initialized: false,
};

// 広場内のプレイヤー座標（バトル用 state.player とは別管理）
const plazaPlayer = { x: 0, z: 0 };

// 建物定義
const PLAZA_BUILDINGS = [
  { type: "stage",      label: "⚔️ 冒険の門",  x:   0, z: -18, color: 0x8b4513 },
  { type: "shop",       label: "🛍 商　店",     x: -15, z: -10, color: 0x4169e1 },
  { type: "restaurant", label: "🍜 食　堂",     x:  15, z: -10, color: 0xdc143c },
];

const PLAZA_ENTER_RADIUS = 5;  // 建物接近判定の距離
const PLAZA_MOVE_SPEED   = 0.13;
const PLAZA_FIELD_LIMIT  = 24; // フィールドの端

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
function initHomePlaza() {
  if (!plaza.initialized) {
    buildPlazaScene();
    plaza.initialized = true;
  } else {
    // 2回目以降：広場オブジェクトを再表示
    setPlazaObjectsVisible(true);
  }

  // バトル用オブジェクトを非表示
  setBattleObjectsVisible(false);

  // カメラをリセット（広場用の俯瞰視点）
  plazaPlayer.x = 0;
  plazaPlayer.z = 0;
  updatePlazaCameraFollow();

  // アニメーションループ開始
  if (plaza.animFrame) cancelAnimationFrame(plaza.animFrame);
  plazaLoop();
}

// ─────────────────────────────────────────
// 広場シーンの構築（初回のみ）
// ─────────────────────────────────────────
function buildPlazaScene() {
  // 空と霧
  three.scene.background = new THREE.Color(0x87ceeb);
  three.scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

  // ライト（広場用：明るい昼光）
  plaza.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  plaza.sunLight.position.set(10, 20, 10);
  plaza.sunLight.castShadow = true;
  three.scene.add(plaza.sunLight);

  plaza.ambientLight = new THREE.AmbientLight(0xd0e8ff, 0.7);
  three.scene.add(plaza.ambientLight);

  // 地面（草色の広い平面）
  plaza.ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.9 })
  );
  plaza.ground.rotation.x = -Math.PI / 2;
  plaza.ground.receiveShadow = true;
  three.scene.add(plaza.ground);

  // 石畳（中央円形）
  const cobble = new THREE.Mesh(
    new THREE.CircleGeometry(12, 32),
    new THREE.MeshStandardMaterial({ color: 0xb0a090, roughness: 0.95 })
  );
  cobble.rotation.x = -Math.PI / 2;
  cobble.position.y = 0.01;
  three.scene.add(cobble);
  plaza.cobble = cobble;

  buildFountain();
  buildPlazaBuildings();
  buildPlazaNPCs();
  buildPlazaPlayer();
}

// ─────────────────────────────────────────
// 噴水
// ─────────────────────────────────────────
function buildFountain() {
  const group = new THREE.Group();

  // 台座
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.0, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 })
  );
  base.position.y = 0.2;
  group.add(base);

  // 水盤
  const basin = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.25, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x90c0e0, roughness: 0.3, metalness: 0.2 })
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.5;
  group.add(basin);

  // 中央柱
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd0c0b0, roughness: 0.7 })
  );
  pillar.position.y = 1.1;
  group.add(pillar);

  // 上部の皿
  const topDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.4, 0.15, 12),
    new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 })
  );
  topDish.position.y = 1.85;
  group.add(topDish);

  // 水しぶき（小球体 × 8をランダム配置）
  plaza.waterDrops = [];
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x88ccff, transparent: true, opacity: 0.75
      })
    );
    const angle = (i / 8) * Math.PI * 2;
    drop.userData.angle = angle;
    drop.userData.phase = (i / 8) * Math.PI * 2;
    drop.position.set(Math.cos(angle) * 0.4, 2.0, Math.sin(angle) * 0.4);
    group.add(drop);
    plaza.waterDrops.push(drop);
  }

  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.fountain = group;
}

// ─────────────────────────────────────────
// 建物
// ─────────────────────────────────────────
function buildPlazaBuildings() {
  PLAZA_BUILDINGS.forEach(def => {
    const group = new THREE.Group();

    // 建物本体
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 4),
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
    );
    body.position.y = 2;
    body.castShadow = true;
    group.add(body);

    // 屋根
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(4, 2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
    );
    roof.position.y = 5;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // 扉
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.0, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3d1a00, roughness: 0.9 })
    );
    door.position.set(0, 1.0, 2.06);
    group.add(door);

    group.position.set(def.x, 0, def.z);
    three.scene.add(group);
    plaza.buildings.push({ mesh: group, ...def });
  });
}

// ─────────────────────────────────────────
// NPC スライム
// ─────────────────────────────────────────
function buildPlazaNPCs() {
  npcState.forEach(npc => {
    const costume = COSTUMES.find(c => c.id === npc.costumeId) || COSTUMES[0];
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 14, 14),
      new THREE.MeshStandardMaterial({ color: costume.color, roughness: 0.5 })
    );
    body.position.y = 0.45;
    body.castShadow = true;
    addSlimeFace(body, 0.45, 0.2);
    group.add(body);

    group.position.set(npc.x, 0, npc.z);
    three.scene.add(group);
    npc.mesh = group;
  });
}

// ─────────────────────────────────────────
// プレイヤースライム（広場用）
// ─────────────────────────────────────────
function buildPlazaPlayer() {
  const group = new THREE.Group();
  const color = state.equippedCostume ? state.equippedCostume.color : CONFIG.player.color;

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.player.radius, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  );
  body.position.y = CONFIG.player.radius;
  body.castShadow = true;
  addSlimeFace(body, CONFIG.player.radius, 0.2);
  group.add(body);

  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.playerMesh = group;
}

// ─────────────────────────────────────────
// 広場アニメーションループ
// ─────────────────────────────────────────
function plazaLoop() {
  updatePlazaPlayer();
  updatePlazaNPCs();
  updateFountain();
  checkPlazaEntrances();
  updatePlazaCameraFollow();
  three.renderer.render(three.scene, three.camera);
  plaza.animFrame = requestAnimationFrame(plazaLoop);
}

// ─────────────────────────────────────────
// プレイヤー移動
// ─────────────────────────────────────────
function updatePlazaPlayer() {
  let dx = 0, dz = 0;
  if (state.keys.up)    dz -= 1;
  if (state.keys.down)  dz += 1;
  if (state.keys.left)  dx -= 1;
  if (state.keys.right) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    plazaPlayer.x = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT,
      plazaPlayer.x + (dx / len) * PLAZA_MOVE_SPEED));
    plazaPlayer.z = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT,
      plazaPlayer.z + (dz / len) * PLAZA_MOVE_SPEED));
    if (plaza.playerMesh) {
      plaza.playerMesh.rotation.y = Math.atan2(dx, dz);
    }
  }
  if (plaza.playerMesh) {
    plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);
  }
}

// ─────────────────────────────────────────
// カメラ追従（広場用：少し高め俯瞰）
// ─────────────────────────────────────────
function updatePlazaCameraFollow() {
  three.camera.position.set(plazaPlayer.x, 8.0, plazaPlayer.z + 11.0);
  three.camera.lookAt(plazaPlayer.x, 0.5, plazaPlayer.z - 1.5);
}

// ─────────────────────────────────────────
// NPC ランダムウォーク & 吹き出し
// ─────────────────────────────────────────
function updatePlazaNPCs() {
  const t = Date.now() * 0.001;
  let nearLine = null;

  npcState.forEach(npc => {
    if (!npc.mesh) return;

    // sin/cos でゆったり揺れるウォーク
    npc.x = npc.startX + Math.sin(t * 0.4 + npc.wanderOffset) * 2.5;
    npc.z = npc.startZ + Math.cos(t * 0.3 + npc.wanderOffset) * 2.5;
    npc.mesh.position.set(npc.x, 0, npc.z);

    // プレイヤーとの距離
    const dist = Math.hypot(plazaPlayer.x - npc.x, plazaPlayer.z - npc.z);
    if (dist < 3.5) nearLine = npc.line;
  });

  // 吹き出し表示
  if (nearLine) {
    dom.npcBubble.textContent = nearLine;
    dom.npcBubble.classList.add("visible");
  } else {
    dom.npcBubble.classList.remove("visible");
  }
}

// ─────────────────────────────────────────
// 噴水アニメーション（水しぶき上下）
// ─────────────────────────────────────────
function updateFountain() {
  if (!plaza.waterDrops) return;
  const t = Date.now() * 0.002;
  plaza.waterDrops.forEach(drop => {
    const ph = drop.userData.phase;
    drop.position.y = 1.9 + Math.abs(Math.sin(t + ph)) * 0.8;
    drop.material.opacity = 0.4 + Math.abs(Math.sin(t + ph)) * 0.45;
  });
}

// ─────────────────────────────────────────
// 建物接近判定・アクションプロンプト
// ─────────────────────────────────────────
let plazaNearBuilding = null;

function checkPlazaEntrances() {
  plazaNearBuilding = null;

  for (const b of plaza.buildings) {
    const dist = Math.hypot(plazaPlayer.x - b.x, plazaPlayer.z - b.z);
    if (dist < PLAZA_ENTER_RADIUS) {
      plazaNearBuilding = b;
      break;
    }
  }

  if (plazaNearBuilding) {
    dom.plazaActionPrompt.textContent = `Ａ で「${plazaNearBuilding.label}」に入る`;
    dom.plazaActionPrompt.classList.add("visible");
  } else {
    dom.plazaActionPrompt.classList.remove("visible");
  }
}

// Aボタン（attackBtn）が広場で押されたとき
function handlePlazaAction() {
  if (!plazaNearBuilding) return;

  if (plazaNearBuilding.type === "stage") {
    exitHomePlaza();
    showStageSelect();
  } else {
    showComingSoon(plazaNearBuilding.label);
  }
}

// ─────────────────────────────────────────
// 広場を退出（バトルシーンへ戻す準備）
// ─────────────────────────────────────────
function exitHomePlaza() {
  // ループ停止
  if (plaza.animFrame) {
    cancelAnimationFrame(plaza.animFrame);
    plaza.animFrame = null;
  }

  // 広場 UI 非表示
  dom.homePlazaScreen.classList.remove("visible");
  dom.npcBubble.classList.remove("visible");
  dom.plazaActionPrompt.classList.remove("visible");

  // 広場オブジェクトを非表示
  setPlazaObjectsVisible(false);

  // バトル用オブジェクトを再表示
  setBattleObjectsVisible(true);

  // バトル用の空・霧に戻す
  const s0 = getCurrentStage(state.stageIndex);
  three.scene.background = new THREE.Color(s0.bgColor);
  three.scene.fog = new THREE.FogExp2(s0.bgColor, s0.fogDensity);
}

// ─────────────────────────────────────────
// 広場オブジェクト一括表示切替
// ─────────────────────────────────────────
function setPlazaObjectsVisible(visible) {
  const targets = [
    plaza.ground, plaza.cobble, plaza.fountain,
    plaza.playerMesh, plaza.sunLight, plaza.ambientLight,
    ...plaza.buildings.map(b => b.mesh),
    ...npcState.map(n => n.mesh).filter(Boolean),
  ];
  targets.forEach(obj => { if (obj) obj.visible = visible; });
  if (plaza.waterDrops) plaza.waterDrops.forEach(d => { d.visible = visible; });
}

// バトル用オブジェクト（boss・playerGroup・walls等）の表示切替
function setBattleObjectsVisible(visible) {
  if (three.bossGroup)   three.bossGroup.visible   = visible;
  if (three.playerGroup) three.playerGroup.visible  = visible;
  if (three.rangeRing)   three.rangeRing.visible    = visible;
  if (three.bossLight)   three.bossLight.visible    = visible;
}
