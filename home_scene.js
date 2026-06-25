/**
 * home_scene.js
 * ホーム広場のThree.jsシーン管理
 * - 噴水回復
 * - NPC会話
 * - 釣り場（池・桟橋・木・ベンチ・花畑）
 */

const plaza = {
  ground: null,
  fountain: null,
  fountainPos: { x: 0, z: 0 },
  buildings: [],
  playerMesh: null,
  initialized: false,
  sunLight: null,
  ambientLight: null,
  cobble: null,
  waterDrops: [],
  pond: null,
  pondPos: { x: 18, z: -12 },
  dock: [],
  bigTree: null,
  bench: null,
  dragonflies: [],
  flowerField: [],
};

const plazaPlayer = { x: 0, z: 0 };

const PLAZA_BUILDINGS = [
  { type: "stage",      label: "⚔️ 冒険の門",  x:   0, z: -18, color: 0x8b4513 },
  { type: "shop",       label: "🛍 商　店",     x: -15, z: -10, color: 0x4169e1 },
  { type: "restaurant", label: "🍜 食　堂",     x:  15, z: -10, color: 0xdc143c },
];

const PLAZA_ENTER_RADIUS = 5;
const PLAZA_MOVE_SPEED   = 0.13;
const PLAZA_FIELD_LIMIT  = 24;
const NPC_TALK_RADIUS    = 3.5;
const FOUNTAIN_INTERACT_RADIUS = 3.0;
const POND_INTERACT_RADIUS = 4.5;
const BENCH_INTERACT_RADIUS = 2.5;

let plazaNearBuilding = null;
let plazaNearNPC = null;
let plazaNearFountain = false;
let plazaNearPond = false;
let plazaNearBench = false;
let plazaNearFlower = false;

let plazaDialog = null;

function initHomePlaza() {
  three.scene.background = new THREE.Color(0x87ceeb);
  three.scene.fog = new THREE.FogExp2(0x87ceeb, 0.007);

  if (!plaza.initialized) {
    buildPlazaScene();
    plaza.initialized = true;
    setBattleObjectsVisible(false);
  } else {
    setPlazaObjectsVisible(true);
    setBattleObjectsVisible(false);
  }

  plazaPlayer.x = 0;
  plazaPlayer.z = 0;
  updatePlazaCameraFollow();

  npcState.forEach(n => n.waitUntil = Date.now() + 1000);
  closeNpcDialog();

  // 花畑の場所を案内（初回のみ）
  if (!plaza._flowerHintShown) {
    plaza._flowerHintShown = true;
    setTimeout(() => {
      dom.statusLine.textContent = "🌸 左奥に花畑があるよ！花を摘んで料理の素材にしよう";
      setTimeout(() => dom.statusLine.textContent = "", 3500);
    }, 1500);
  }
}

function buildPlazaScene() {
  plaza.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  plaza.sunLight.position.set(10, 20, 10);
  plaza.sunLight.castShadow = true;
  three.scene.add(plaza.sunLight);
  plaza.ambientLight = new THREE.AmbientLight(0xd0e8ff, 0.7);
  three.scene.add(plaza.ambientLight);

  plaza.ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.9 })
  );
  plaza.ground.rotation.x = -Math.PI / 2;
  plaza.ground.receiveShadow = true;
  three.scene.add(plaza.ground);

  const cobble = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshStandardMaterial({ color: 0xb0a090, roughness: 0.95 }));
  cobble.rotation.x = -Math.PI / 2;
  cobble.position.y = 0.01;
  three.scene.add(cobble);
  plaza.cobble = cobble;

  buildFountain();
  buildPlazaBuildings();
  buildPlazaNPCs();
  buildPlazaPlayer();
  buildFishingSpot();
  buildFlowerField();   // 花畑
  buildDistantTrees(); // 遠景の木々
}

function buildFountain() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 }));
  base.position.y = 0.2;
  group.add(base);
  const basin = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.25, 8, 24), new THREE.MeshStandardMaterial({ color: 0x90c0e0, roughness: 0.3, metalness: 0.2 }));
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.5;
  group.add(basin);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xd0c0b0, roughness: 0.7 }));
  pillar.position.y = 1.1;
  group.add(pillar);
  const topDish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 }));
  topDish.position.y = 1.85;
  group.add(topDish);
  plaza.waterDrops = [];
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.75 }));
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

function buildPlazaBuildings() {
  PLAZA_BUILDINGS.forEach(def => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }));
    body.position.y = 2;
    body.castShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
    roof.position.y = 5;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x3d1a00, roughness: 0.9 }));
    door.position.set(0, 1.0, 2.06);
    group.add(door);
    group.position.set(def.x, 0, def.z);
    three.scene.add(group);
    plaza.buildings.push({ mesh: group, ...def });
  });
}

function buildPlazaNPCs() {
  npcState.forEach(npc => {
    const costume = COSTUMES.find(c => c.id === npc.costumeId) || COSTUMES[0];
    const group = new THREE.Group();
    buildCuteSlimeBody(group, 0.45, costume.color);
    group.position.set(npc.x, 0, npc.z);
    three.scene.add(group);
    npc.mesh = group;
  });
}

function buildPlazaPlayer() {
  const group = new THREE.Group();
  const color = state.equippedCostume ? state.equippedCostume.color : CONFIG.player.color;
  buildCuteSlimeBody(group, CONFIG.player.radius, color);
  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.playerMesh = group;
}

function buildFishingSpot() {
  const px = plaza.pondPos.x, pz = plaza.pondPos.z;
  plaza.pond = new THREE.Mesh(new THREE.CircleGeometry(3.5, 32), new THREE.MeshStandardMaterial({ color: 0x2a6496, roughness: 0.3, transparent: true, opacity: 0.85 }));
  plaza.pond.rotation.x = -Math.PI / 2;
  plaza.pond.position.set(px, 0.02, pz);
  plaza.pond.receiveShadow = true;
  three.scene.add(plaza.pond);

  for (let i = -1; i <= 1; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 2.0), new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 }));
    plank.position.set(px + i * 1.8, 0.05, pz + 1.8);
    plank.castShadow = true;
    plank.receiveShadow = true;
    three.scene.add(plank);
    plaza.dock.push(plank);
  }

  const treeGroup = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 }));
  trunk.position.y = 2.25;
  trunk.castShadow = true;
  treeGroup.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.5 - i * 0.3, 8, 8), leafMat);
    leaf.position.y = 4.5 + i * 1.0;
    leaf.position.x = (Math.random() - 0.5) * 0.8;
    leaf.castShadow = true;
    treeGroup.add(leaf);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 1.0 }));
    branch.position.set(Math.cos(angle) * 1.8, 4.2, Math.sin(angle) * 1.8);
    branch.rotation.z = (Math.random() - 0.5) * 0.8;
    branch.rotation.x = (Math.random() - 0.5) * 1.2;
    treeGroup.add(branch);
  }
  treeGroup.position.set(px - 4, 0, pz - 4);
  three.scene.add(treeGroup);
  plaza.bigTree = treeGroup;

  const benchGroup = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 }));
  seat.position.y = 0.5;
  benchGroup.add(seat);
  for (let i = -1; i <= 1; i += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 }));
    leg.position.set(i * 0.8, 0.25, 0);
    benchGroup.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 }));
  back.position.set(0, 0.75, -0.3);
  benchGroup.add(back);
  benchGroup.position.set(px - 1.0, 0, pz - 2.5);
  three.scene.add(benchGroup);
  plaza.bench = benchGroup;

  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4.0 + Math.random() * 5.0;
    const x = px + Math.cos(angle) * dist;
    const z = pz + Math.sin(angle) * dist;
    const flower = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), new THREE.MeshStandardMaterial({ color: [0xFFB6C1, 0xFF69B4, 0xFFFF99][Math.floor(Math.random()*3)], roughness: 0.8 }));
    flower.position.set(x, 0.15, z);
    three.scene.add(flower);
  }
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4.0 + Math.random() * 4.0;
    const x = px + Math.cos(angle) * dist;
    const z = pz + Math.sin(angle) * dist;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.9 }));
    stalk.position.set(x, 0.3, z);
    three.scene.add(stalk);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4), new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 }));
    head.position.set(x, 0.6, z);
    three.scene.add(head);
  }

  const dragonflyMat = new THREE.PointsMaterial({ color: 0xADD8E6, size: 0.15, transparent: true, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 5; i++) {
    const point = new THREE.Vector3(px + (Math.random()-0.5)*8, 0.5+Math.random()*1.5, pz + (Math.random()-0.5)*8);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([point.x, point.y, point.z], 3));
    const dragonfly = new THREE.Points(geom, dragonflyMat);
    dragonfly.userData = { baseX: point.x, baseZ: point.z, speedX: (Math.random()-0.5)*0.02, speedZ: (Math.random()-0.5)*0.02, phase: Math.random()*Math.PI*2 };
    three.scene.add(dragonfly);
    plaza.dragonflies.push(dragonfly);
  }
}

function buildFlowerField() {
  const fieldCenter = { x: -16, z: 14 };
  const fieldRadius = 5;

  // 看板（花畑の入口）
  const signPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.5, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 })
  );
  signPost.position.set(fieldCenter.x + 5.5, 0.75, fieldCenter.z - 1);
  three.scene.add(signPost);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 })
  );
  signBoard.position.set(fieldCenter.x + 5.5, 1.6, fieldCenter.z - 1);
  three.scene.add(signBoard);

  // 柵（花畑のまわり）
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xDEB887, roughness: 0.9 })
    );
    fence.position.set(
      fieldCenter.x + Math.cos(angle) * (fieldRadius + 0.5),
      0.3,
      fieldCenter.z + Math.sin(angle) * (fieldRadius + 0.5)
    );
    three.scene.add(fence);
  }

  // 地面（花畑エリアを緑で強調）
  const fieldGround = new THREE.Mesh(
    new THREE.CircleGeometry(fieldRadius, 24),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.9 })
  );
  fieldGround.rotation.x = -Math.PI / 2;
  fieldGround.position.set(fieldCenter.x, 0.01, fieldCenter.z);
  three.scene.add(fieldGround);

  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * fieldRadius;
    const x = fieldCenter.x + Math.cos(angle) * dist;
    const z = fieldCenter.z + Math.sin(angle) * dist;
    const r = Math.random();
    let cumulative = 0;
    let flowerType = FLOWER_TYPES[0];
    for (const ft of FLOWER_TYPES) {
      cumulative += ft.rarity;
      if (r < cumulative) { flowerType = ft; break; }
    }
    const group = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.9 }));
    stem.position.y = 0.25;
    group.add(stem);
    const petals = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), new THREE.MeshStandardMaterial({ color: flowerType.color, roughness: 0.7 }));
    petals.position.y = 0.55;
    group.add(petals);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshStandardMaterial({ color: 0xFFFF88, roughness: 0.5, emissive: 0xFFFF88, emissiveIntensity: 0.3 }));
    center.position.y = 0.55;
    group.add(center);
    group.position.set(x, 0.01, z);
    group.userData = { flowerType, picked: false, respawnTime: 0, phase: Math.random()*Math.PI*2 };
    three.scene.add(group);
    plaza.flowerField.push(group);
  }
}


// 遠景の木々（オープンワールド感）
function buildDistantTrees() {
  const positions = [];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 22 + Math.random() * 30;
    positions.push([Math.cos(angle) * dist, Math.sin(angle) * dist]);
  }
  positions.forEach(([x, z]) => {
    const h = 3.5 + Math.random() * 5;
    three.scene.add(makeFirTree(x, z, h));
  });
}

function updateHomePlazaLoop() {
  updatePlazaPlayer();
  updatePlazaNPCs();
  updateFountain();
  updateDragonflies();
  updateFlowers();
  checkPlazaEntrances();
  checkFlowerProximity();
  updatePlazaCameraFollow();
}

function updatePlazaPlayer() {
  let dx = 0, dz = 0;
  if (state.keys.up) dz -= 1;
  if (state.keys.down) dz += 1;
  if (state.keys.left) dx -= 1;
  if (state.keys.right) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    plazaPlayer.x = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT, plazaPlayer.x + (dx / len) * PLAZA_MOVE_SPEED));
    plazaPlayer.z = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT, plazaPlayer.z + (dz / len) * PLAZA_MOVE_SPEED));
    if (plaza.playerMesh) plaza.playerMesh.rotation.y = Math.atan2(dx, dz);
  }
  if (plaza.playerMesh) plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);
}

function updatePlazaCameraFollow() {
  three.camera.position.set(plazaPlayer.x, 3.5, plazaPlayer.z + 10.0);
  three.camera.lookAt(plazaPlayer.x, 0.5, plazaPlayer.z - 5.0);
}

function updatePlazaNPCs() {
  const now = Date.now();
  let nearLine = null;
  npcState.forEach(npc => {
    if (!npc.mesh) return;
    const distToTarget = Math.hypot(npc.targetX - npc.x, npc.targetZ - npc.z);
    if (npc.moveState === "idle") {
      if (now >= npc.waitUntil) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (npc.moveRadius || 2.0);
        npc.targetX = npc.startX + Math.cos(angle) * radius;
        npc.targetZ = npc.startZ + Math.sin(angle) * radius;
        npc.moveState = "moving";
      }
    } else if (npc.moveState === "moving") {
      if (distToTarget < 0.3) {
        npc.moveState = "idle";
        npc.waitUntil = now + (npc.pauseTime || 2000);
      } else {
        const speed = npc.moveSpeed || 0.02;
        npc.x += (npc.targetX - npc.x) / distToTarget * speed;
        npc.z += (npc.targetZ - npc.z) / distToTarget * speed;
      }
    }
    npc.mesh.position.set(npc.x, 0, npc.z);
    const dist = Math.hypot(plazaPlayer.x - npc.x, plazaPlayer.z - npc.z);
    if (dist < NPC_TALK_RADIUS) {
      let line = null;
      if (npc.conditionalLines?.length) {
        for (const cond of npc.conditionalLines) {
          if (cond.condition()) { line = cond.line; break; }
        }
      }
      if (!line && npc.lines?.length) {
        if (now - npc.lastLineTime > 1000) {
          npc.lastLine = npc.lines[Math.floor(Math.random() * npc.lines.length)];
          npc.lastLineTime = now;
        }
        line = npc.lastLine;
      }
      nearLine = line || npc.line;
    }
  });
  if (nearLine) {
    dom.npcBubble.textContent = nearLine;
    dom.npcBubble.classList.add("visible");
  } else {
    dom.npcBubble.classList.remove("visible");
  }
}

function updateFountain() {
  if (!plaza.waterDrops) return;
  const t = Date.now() * 0.002;
  plaza.waterDrops.forEach(drop => {
    const ph = drop.userData.phase;
    drop.position.y = 1.9 + Math.abs(Math.sin(t + ph)) * 0.8;
    drop.material.opacity = 0.4 + Math.abs(Math.sin(t + ph)) * 0.45;
  });
}

function updateDragonflies() {
  const t = Date.now() * 0.001;
  plaza.dragonflies.forEach(d => {
    const pos = d.geometry.attributes.position;
    d.userData.baseX += d.userData.speedX;
    d.userData.baseZ += d.userData.speedZ;
    const dx = d.userData.baseX - plaza.pondPos.x;
    const dz = d.userData.baseZ - plaza.pondPos.z;
    if (Math.sqrt(dx*dx+dz*dz) > 5.0) {
      d.userData.speedX *= -1;
      d.userData.speedZ *= -1;
    }
    pos.setXYZ(0,
      d.userData.baseX + Math.sin(t*2 + d.userData.phase)*0.5,
      0.8 + Math.sin(t*3 + d.userData.phase)*0.3,
      d.userData.baseZ + Math.cos(t*2.5 + d.userData.phase)*0.5
    );
    d.geometry.attributes.position.needsUpdate = true;
  });
}

function checkPlazaEntrances() {
  plazaNearBuilding = null;
  plazaNearNPC = null;
  plazaNearFountain = false;
  plazaNearPond = false;
  plazaNearBench = false;

  for (const b of plaza.buildings) {
    if (Math.hypot(plazaPlayer.x - b.x, plazaPlayer.z - b.z) < PLAZA_ENTER_RADIUS) {
      plazaNearBuilding = b;
      break;
    }
  }
  for (const npc of npcState) {
    if (Math.hypot(plazaPlayer.x - npc.x, plazaPlayer.z - npc.z) < NPC_TALK_RADIUS) {
      plazaNearNPC = npc;
      break;
    }
  }
  plazaNearFountain = Math.hypot(plazaPlayer.x - plaza.fountainPos.x, plazaPlayer.z - plaza.fountainPos.z) < FOUNTAIN_INTERACT_RADIUS;
  plazaNearPond = Math.hypot(plazaPlayer.x - plaza.pondPos.x, plazaPlayer.z - plaza.pondPos.z) < POND_INTERACT_RADIUS;
  if (plaza.bench) plazaNearBench = Math.hypot(plazaPlayer.x - plaza.bench.position.x, plazaPlayer.z - plaza.bench.position.z) < BENCH_INTERACT_RADIUS;

  if (plazaNearBuilding) {
    dom.plazaActionPrompt.textContent = `Ａ で「${plazaNearBuilding.label}」に入る`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearNPC) {
    dom.plazaActionPrompt.textContent = `Ａ ではなしかける`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearFountain) {
    dom.plazaActionPrompt.textContent = `Ａ で回復する`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearPond) {
    dom.plazaActionPrompt.textContent = `Ａ で釣り糸を垂らす`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearBench) {
    dom.plazaActionPrompt.textContent = `Ａ でベンチに座る`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearFlower) {
    dom.plazaActionPrompt.textContent = `Ａ で花を摘む`;
    dom.plazaActionPrompt.classList.add("visible");
  } else {
    dom.plazaActionPrompt.classList.remove("visible");
  }
}

function handlePlazaAction() {
  if (plazaDialog) { advanceDialog(); return; }
  // ベンチ座り中にAでお弁当を食べる
  if (state._benchBentoReady && eatBentoOnBench()) return;
  if (plazaNearBuilding) {
    if (plazaNearBuilding.type === "stage") { exitHomePlaza(); showStageSelect(); }
    else if (plazaNearBuilding.type === "restaurant") { showCooking(); }
    else { showComingSoon(plazaNearBuilding.label); }
  } else if (plazaNearNPC) { startNPCConversation(plazaNearNPC); }
  else if (plazaNearFountain) { recoverAtFountain(); }
  else if (plazaNearPond) { startFishing(); }
  else if (plazaNearBench) { sitOnBench(); }
  else if (plazaNearFlower && nearestFlower) { pickFlower(); }
}

function recoverAtFountain() {
  state.player.hp = CONFIG.player.maxHp;
  state.specialGauge = 100;
  dom.statusLine.textContent = "💧 噴水の力で全回復した！";
  setTimeout(() => dom.statusLine.textContent = "", 2000);
  refreshUi();
}

function sitOnBench() {
  state.keys = { up: false, down: false, left: false, right: false, action: false };
  three.camera.position.set(plaza.bench.position.x + 2, 2.0, plaza.bench.position.z + 3);
  three.camera.lookAt(plaza.bench.position.x, 1.0, plaza.bench.position.z);

  if (state.bento.length > 0) {
    // お弁当がある → 食べるか聞く
    const recipe = state.bento[0];
    dom.statusLine.textContent = `🪑 ベンチに座った。🍱 ${recipe.name}を食べる？（Ａ）`;
    // Aボタンで食べられるよう一時フラグ
    state._benchBentoReady = true;
    setTimeout(() => {
      if (state._benchBentoReady) {
        dom.statusLine.textContent = "";
        state._benchBentoReady = false;
        updatePlazaCameraFollow();
      }
    }, 4000);
  } else {
    dom.statusLine.textContent = "🪑 ベンチに座ってのんびり…　お弁当があればここで食べられる";
    setTimeout(() => { dom.statusLine.textContent = ""; updatePlazaCameraFollow(); }, 3000);
  }
}

function eatBentoOnBench() {
  if (!state._benchBentoReady || state.bento.length === 0) return false;
  const recipe = state.bento.shift();
  state._benchBentoReady = false;
  const msg = recipe.buff?.hpRecover
    ? `HP が ${recipe.buff.hpRecover} 回復した！`
    : "なんだか元気が出てきた！";
  state.player.hp = Math.min(CONFIG.player.maxHp, state.player.hp + (recipe.buff?.hpRecover || 0));
  dom.statusLine.textContent = `${recipe.icon} ${recipe.name} を食べた。${msg}`;
  setTimeout(() => { dom.statusLine.textContent = ""; updatePlazaCameraFollow(); }, 3000);
  refreshUi();
  saveToServer();
  return true;
}

function startNPCConversation(npc) {
  let lines = [];
  if (npc.conditionalLines?.length) {
    const condLine = npc.conditionalLines.find(c => c.condition());
    if (condLine) lines = [condLine.line];
  }
  if (lines.length === 0 && npc.lines?.length) lines = npc.lines.slice();
  if (lines.length === 0) lines = [npc.line || "…"];

  // クエスト受注セリフを末尾に追加
  if (npc.questId && QUESTS[npc.questId]) {
    const quest = QUESTS[npc.questId];
    const alreadyAccepted = state.quests[npc.questId];
    if (!alreadyAccepted) {
      lines.push("【依頼】" + quest.description);
      lines.push("報酬：" + quest.rewardText + " — 受けてくれる？");
    } else if (alreadyAccepted.completed) {
      lines.push("クエストはもう達成してくれたね！ありがとう！");
    } else {
      const q = state.quests[npc.questId];
      lines.push("今 " + q.collected + "/" + q.goal + " 達成中。引き続きよろしく！");
    }
  }

  plazaDialog = { npc, currentLineIndex: 0, lines };
  const costume = COSTUMES.find(c => c.id === npc.costumeId);
  dom.npcDialogName.textContent = costume ? costume.name : "???";
  showDialogLine();
  dom.npcDialog.classList.add("visible");
}

function showDialogLine() {
  if (!plazaDialog) return;
  dom.npcDialogText.textContent = plazaDialog.lines[plazaDialog.currentLineIndex];
  dom.npcDialogNext.textContent = (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) ? "閉じる" : "次へ ▶";
}

function advanceDialog() {
  if (!plazaDialog) return;
  if (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) { closeNpcDialog(); return; }
  plazaDialog.currentLineIndex++;
  showDialogLine();
}

function closeNpcDialog() {
  // ダイアログを閉じるとき、クエストを受注する
  if (plazaDialog?.npc?.questId) {
    const qid = plazaDialog.npc.questId;
    if (QUESTS[qid] && !state.quests[qid]) {
      acceptQuest(qid);
      dom.statusLine.textContent = "✨ クエスト「" + QUESTS[qid].name + "」を受注した！";
      setTimeout(() => dom.statusLine.textContent = "", 2500);
    }
  }
  plazaDialog = null;
  dom.npcDialog.classList.remove("visible");
}

function exitHomePlaza() {
  dom.homePlazaScreen.classList.remove("visible");
  dom.npcBubble.classList.remove("visible");
  dom.plazaActionPrompt.classList.remove("visible");
  closeNpcDialog();
  setPlazaObjectsVisible(false);
  setBattleObjectsVisible(true);
  if (three.sunLight) three.sunLight.visible = true;
  if (three.ambientLight) three.ambientLight.visible = true;
  three.scene.background = new THREE.Color(getCurrentStage(state.stageIndex).bgColor);
  three.scene.fog = new THREE.FogExp2(getCurrentStage(state.stageIndex).bgColor, getCurrentStage(state.stageIndex).fogDensity);
  updateCameraFollow();
}

function setPlazaObjectsVisible(visible) {
  const targets = [
    plaza.ground, plaza.cobble, plaza.fountain,
    plaza.playerMesh, plaza.sunLight, plaza.ambientLight,
    ...plaza.buildings.map(b => b.mesh),
    ...npcState.map(n => n.mesh).filter(Boolean),
    ...plaza.dock, plaza.bigTree, plaza.bench,
    ...plaza.flowerField
  ];
  targets.forEach(obj => { if (obj) obj.visible = visible; });
  if (plaza.waterDrops) plaza.waterDrops.forEach(d => d.visible = visible);
  if (plaza.dragonflies) plaza.dragonflies.forEach(d => d.visible = visible);
}

function setBattleObjectsVisible(visible) {
  if (three.bossGroup) three.bossGroup.visible = visible;
  if (three.playerGroup) three.playerGroup.visible = visible;
  if (three.rangeRing) three.rangeRing.visible = visible;
  if (three.bossLight) three.bossLight.visible = visible;
}

// 花摘み関連のグローバル変数（flower.js で使う）
let nearestFlower = null;
const FLOWER_PICK_RADIUS = 1.8;
function checkFlowerProximity() {
  nearestFlower = null;
  plaza.flowerField.forEach(flower => {
    if (flower.userData.picked) return;
    const dx = plazaPlayer.x - flower.position.x;
    const dz = plazaPlayer.z - flower.position.z;
    if (Math.sqrt(dx*dx+dz*dz) < FLOWER_PICK_RADIUS) nearestFlower = flower;
  });
  plazaNearFlower = nearestFlower !== null;
}

function updateFlowers() {
  const t = Date.now() * 0.001;
  plaza.flowerField.forEach(flower => {
    if (flower.userData.picked) return;
    flower.rotation.z = Math.sin(t * 1.5 + flower.userData.phase) * 0.1;
  });
}

document.getElementById('npcDialogNext')?.addEventListener('click', advanceDialog);