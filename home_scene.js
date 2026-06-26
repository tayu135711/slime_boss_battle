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
  // 花壇・露店・フェンス等の装飾オブジェクト（setPlazaObjectsVisibleで一括管理）
  decorObjects: [],
  // 時間帯システム
  lastTimeOfDay: null,
  timeOfDayLabel: null,
};

const plazaPlayer = { x: 0, z: 0 };

const PLAZA_BUILDINGS = [
  { type: "stage",       label: "⚔️ 冒険の門",  x:   0, z: -18, color: 0x7a5030 },
  { type: "shop",        label: "🛍 商　店",     x: -15, z: -10, color: 0x4f7ec4 },
  { type: "restaurant",  label: "🍜 食　堂",     x:  15, z: -10, color: 0xc84040 },
  { type: "pond_area",   label: "🎣 釣り場",     x:  18, z:   6, color: 0x2a7a96 },
  { type: "flower_area", label: "🌸 花　畑",     x: -16, z:  14, color: 0xd45090 },
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
  // 空・霧は時間帯システムが制御するため初期値のみ設定
  three.scene.background = new THREE.Color(0x87ceeb);
  three.scene.fog = new THREE.FogExp2(0x87ceeb, 0.007);

  if (!plaza.initialized) {
    buildPlazaScene();
    plaza.initialized = true;
    // ★ 初回も必ず広場オブジェクトを表示する（デフォルトvisible=falseのままだと何も見えない）
    setPlazaObjectsVisible(true);
    setBattleObjectsVisible(false);
  } else {
    setPlazaObjectsVisible(true);
    setBattleObjectsVisible(false);
    // ★ 再入場時にコスチューム色を広場プレイヤーに反映
    if (plaza.playerMesh && state.equippedCostume) {
      plaza.playerMesh.traverse(child => {
        if (child.isMesh && child.material?.color) {
          child.material.color.set(state.equippedCostume.color);
        }
      });
    }
  }

  plazaPlayer.x = 0;
  plazaPlayer.z = 0;
  if (plaza.playerMesh) plaza.playerMesh.position.set(0, 0, 0);
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

// ── 時間帯システム ─────────────────────────────────────────────
/**
 * 現在時刻から「朝/昼/夕/夜」を判定して空・ライトを切り替える。
 * 毎フレームではなく、広場ループで1分に1回チェックする。
 */
const TIME_OF_DAY_SETTINGS = {
  morning: {
    label: "🌅 朝",
    skyColor:   0xffd6a5,  // 朝焼けオレンジ
    fogColor:   0xffd6a5,
    fogDensity: 0.008,
    sunColor:   0xffd580,
    sunIntensity: 1.4,
    sunPos: [8, 12, 18],   // 低めの朝日
    ambColor:   0xffe0b0,
    ambIntensity: 0.6,
    groundColor: 0x6abf69,
  },
  noon: {
    label: "☀️ 昼",
    skyColor:   0x87ceeb,
    fogColor:   0x87ceeb,
    fogDensity: 0.007,
    sunColor:   0xfff5e0,
    sunIntensity: 1.2,
    sunPos: [10, 20, 10],
    ambColor:   0xd0e8ff,
    ambIntensity: 0.7,
    groundColor: 0x5cb85c,
  },
  evening: {
    label: "🌆 夕方",
    skyColor:   0xff7043,  // 夕焼け赤
    fogColor:   0xff8a65,
    fogDensity: 0.010,
    sunColor:   0xff6d00,
    sunIntensity: 1.0,
    sunPos: [-12, 6, 10],  // 斜め低い西日
    ambColor:   0xffccaa,
    ambIntensity: 0.5,
    groundColor: 0x7a5c3a,
  },
  night: {
    label: "🌙 夜",
    skyColor:   0x0d1b3e,  // 深夜ネイビー
    fogColor:   0x0d1b3e,
    fogDensity: 0.015,
    sunColor:   0x4466bb,
    sunIntensity: 0.4,
    sunPos: [5, 18, 5],
    ambColor:   0x2a3a6a,
    ambIntensity: 0.35,
    groundColor: 0x2e4020,
  },
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 10) return "morning";
  if (h >= 10 && h < 17) return "noon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

function applyTimeOfDay(tod, showLabel = false) {
  const s = TIME_OF_DAY_SETTINGS[tod];
  if (!s) return;

  // 空・霧
  three.scene.background = new THREE.Color(s.skyColor);
  three.scene.fog = new THREE.FogExp2(s.fogColor, s.fogDensity);

  // 太陽光
  if (plaza.sunLight) {
    plaza.sunLight.color.set(s.sunColor);
    plaza.sunLight.intensity = s.sunIntensity;
    plaza.sunLight.position.set(...s.sunPos);
  }
  // 環境光
  if (plaza.ambientLight) {
    plaza.ambientLight.color.set(s.ambColor);
    plaza.ambientLight.intensity = s.ambIntensity;
  }
  // 地面の色
  if (plaza.ground) {
    plaza.ground.material.color.set(s.groundColor);
  }

  plaza.lastTimeOfDay = tod;

  // 街灯は夕方・夜だけON
  const lampOn = (tod === "evening" || tod === "night");
  (plaza.lamps || []).forEach(lamp => {
    const light = lamp.children.find(c => c.isLight);
    if (light) light.intensity = lampOn ? (tod === "night" ? 0.9 : 0.5) : 0.0;
    const globe = lamp.children.find(c => c.isMesh && c.geometry?.type?.includes("Sphere"));
    if (globe) globe.material.emissiveIntensity = lampOn ? (tod === "night" ? 1.2 : 0.5) : 0.1;
  });

  // 時間帯が変わったときだけ画面に通知
  if (showLabel) {
    dom.statusLine.textContent = `${s.label} の景色になりました`;
    setTimeout(() => dom.statusLine.textContent = "", 3000);
  }
}

function updateTimeOfDay() {
  // 広場が表示されているときだけ時間帯を適用する
  if (!dom.homePlazaScreen.classList.contains("visible")) return;
  const tod = getTimeOfDay();
  if (tod !== plaza.lastTimeOfDay) {
    applyTimeOfDay(tod, plaza.lastTimeOfDay !== null); // 初回は通知なし
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

  // 時間帯を初期適用（ライト・空が揃った後で実行）
  applyTimeOfDay(getTimeOfDay(), false);
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

    if (def.type === "pond_area") {
      // 釣り場：青い小屋＋錨マーク
      const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 3.5), new THREE.MeshStandardMaterial({ color: 0x5bafd6, roughness: 0.6 }));
      base.position.y = 1.6; base.castShadow = true; group.add(base);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x1a6080, roughness: 0.7 }));
      roof.position.y = 4.1; roof.rotation.y = Math.PI/4; group.add(roof);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0xfff8e0, roughness: 0.8 }));
      sign.position.set(0, 2.8, 1.76); group.add(sign);
    } else if (def.type === "flower_area") {
      // 花畑：ピンクの小屋＋丸屋根
      const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 3.5), new THREE.MeshStandardMaterial({ color: 0xf4a0c0, roughness: 0.6 }));
      base.position.y = 1.6; base.castShadow = true; group.add(base);
      const roof = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 8, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: 0xe060a0, roughness: 0.6 }));
      roof.position.y = 3.2; group.add(roof);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0xfff0f8, roughness: 0.8 }));
      sign.position.set(0, 2.8, 1.76); group.add(sign);
    } else {
      // 通常建物
      const roofColors = { stage: 0x5a3010, shop: 0x2a5090, restaurant: 0x902020 };
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.65 }));
      body.position.y = 2; body.castShadow = true; group.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2.2, 4), new THREE.MeshStandardMaterial({ color: roofColors[def.type] || 0x5a3010, roughness: 0.75 }));
      roof.position.y = 5.1; roof.rotation.y = Math.PI/4; group.add(roof);
      // 窓×2
      [-1.2, 1.2].forEach(wx => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.08), new THREE.MeshStandardMaterial({ color: 0xaad8f8, roughness: 0.2, metalness: 0.1 }));
        win.position.set(wx, 2.2, 2.05); group.add(win);
      });
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a1200, roughness: 0.9 }));
      door.position.set(0, 0.95, 2.05); group.add(door);
      // ドアノブ
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({ color: 0xf0c040, metalness: 0.8, roughness: 0.2 }));
      knob.position.set(0.4, 0.95, 2.10); group.add(knob);
    }

    // 看板ポール（全建物共通）
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x8b6030, roughness: 0.8 }));
    pole.position.set(2.8, 0.7, 0); group.add(pole);
    const labelBoard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xfffce0, roughness: 0.8 }));
    labelBoard.position.set(2.8, 1.5, 0); group.add(labelBoard);

    group.position.set(def.x, 0, def.z);
    three.scene.add(group);
    plaza.buildings.push({ mesh: group, ...def });
  });

  // ── 街灯 ────────────────────────────────────────────────
  const lampPositions = [
    [-8, -8], [8, -8], [-8, 8], [8, 8],
    [0, -14], [-14, 0], [14, 0],
  ];
  lampPositions.forEach(([x, z]) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.5, 8), new THREE.MeshStandardMaterial({ color: 0x606880, roughness: 0.5, metalness: 0.4 }));
    pole.position.y = 2.25; g.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfffce0, roughness: 0.1, emissive: 0xfff8c0, emissiveIntensity: 0.8 }));
    head.position.y = 4.65; g.add(head);
    const arm  = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x606880, roughness: 0.5 }));
    arm.rotation.z = Math.PI/2; arm.position.set(0.3, 4.45, 0); g.add(arm);
    const light = new THREE.PointLight(0xfffce0, 0.4, 6);
    light.position.y = 4.7; g.add(light);
    g.position.set(x, 0, z);
    three.scene.add(g);
    if (!plaza.lamps) plaza.lamps = [];
    plaza.lamps.push(g);
  });

  // ── 広場中央の花壇 ──────────────────────────────────────
  const bedColors = [0xff8888, 0xffcc66, 0x88ddff, 0xcc88ff, 0x88ffbb];
  const bedRim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.22, 8, 24), new THREE.MeshStandardMaterial({ color: 0xd0c0a8, roughness: 0.8 }));
  bedRim.rotation.x = -Math.PI/2; bedRim.position.set(0, 0.22, 6);
  three.scene.add(bedRim); plaza.decorObjects.push(bedRim);
  const bedSoil = new THREE.Mesh(new THREE.CircleGeometry(3.0, 24), new THREE.MeshStandardMaterial({ color: 0x8a6040, roughness: 0.95 }));
  bedSoil.rotation.x = -Math.PI/2; bedSoil.position.set(0, 0.02, 6);
  three.scene.add(bedSoil); plaza.decorObjects.push(bedSoil);
  for (let i = 0; i < 20; i++) {
    const angle = Math.random()*Math.PI*2, dist = Math.random()*2.5;
    const x = Math.cos(angle)*dist, z = 6+Math.sin(angle)*dist;
    const col = bedColors[Math.floor(Math.random()*bedColors.length)];
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.4,4), new THREE.MeshStandardMaterial({ color:0x44aa44, roughness:0.9 }));
    stem.position.set(x, 0.2, z); three.scene.add(stem); plaza.decorObjects.push(stem);
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5), new THREE.MeshStandardMaterial({ color:col, roughness:0.6, emissive:col, emissiveIntensity:0.06 }));
    petal.position.set(x, 0.45, z); three.scene.add(petal); plaza.decorObjects.push(petal);
  }

  // ── 露店スタンド ────────────────────────────────────────
  const stallDefs = [
    { x: -7, z: -6, color: 0xf9a060, label: "やきとり" },
    { x:  7, z: -6, color: 0x70d090, label: "くだもの" },
  ];
  stallDefs.forEach(sd => {
    const g = new THREE.Group();
    // カウンター
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0xd4a060, roughness: 0.8 }));
    counter.position.y = 0.9; g.add(counter);
    // 脚4本
    [[-0.9,-0.4],[0.9,-0.4],[-0.9,0.4],[0.9,0.4]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.9,6), new THREE.MeshStandardMaterial({ color:0x8b5a20, roughness:0.9 }));
      leg.position.set(lx, 0.45, lz); g.add(leg);
    });
    // テント
    const tent = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: sd.color, roughness: 0.7 }));
    tent.position.y = 2.6; g.add(tent);
    // テントポール
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.5,6), new THREE.MeshStandardMaterial({ color:0x707070, roughness:0.6 }));
    tp.position.y = 1.25; g.add(tp);
    g.position.set(sd.x, 0, sd.z);
    three.scene.add(g);
  });

  // ── 掲示板 ──────────────────────────────────────────────
  const bb = new THREE.Group();
  const bbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,2.5,8), new THREE.MeshStandardMaterial({ color:0x7a5530, roughness:0.9 }));
  bbPost.position.y = 1.25; bb.add(bbPost);
  const bbBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.12), new THREE.MeshStandardMaterial({ color:0xf5e8c0, roughness:0.85 }));
  bbBoard.position.y = 2.7; bb.add(bbBoard);
  const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.08), new THREE.MeshStandardMaterial({ color:0x9b7040, roughness:0.8 }));
  bbFrame.position.y = 2.7; bbFrame.position.z = -0.04; bb.add(bbFrame);
  // ピン装飾
  [[-0.7,0.4],[0.7,0.4],[-0.7,-0.3],[0.7,-0.3]].forEach(([px,py]) => {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), new THREE.MeshStandardMaterial({ color:[0xff4444,0x44aaff,0xffcc00,0xff88cc][Math.floor(Math.random()*4)], roughness:0.3 }));
    pin.position.set(px, 2.7+py, 0.1); bb.add(pin);
  });
  bb.position.set(-10, 0, -15);
  three.scene.add(bb);
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
  // ★ 料理・花摘みUIが開いているときはプレイヤー移動・インタラクションをスキップ
  const cookUI  = document.getElementById("cookingUI");
  const flUI    = document.getElementById("flowerUI");
  const uiOpen  = (cookUI && cookUI.style.display !== "none") ||
                  (flUI   && flUI.style.display   !== "none");

  if (!uiOpen) {
    updatePlazaPlayer();
    checkPlazaEntrances();
    checkFlowerProximity();
  }
  updatePlazaNPCs();
  updateFountain();
  updateDragonflies();
  updateFlowers();
  updatePlazaCameraFollow();
  updateTimeOfDay();  // 時間帯チェック（変化時のみ描画更新）
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
    if (plazaNearBuilding.type === "stage")       { exitHomePlaza(); showStageSelect("plaza"); }
    else if (plazaNearBuilding.type === "restaurant") { showCooking(); }
    else if (plazaNearBuilding.type === "pond_area")  { enterPondArea(); }
    else if (plazaNearBuilding.type === "flower_area"){ enterFlowerArea(); }
    else { showComingSoon(plazaNearBuilding.label); }
  } else if (plazaNearNPC)      { startNPCConversation(plazaNearNPC); }
  else if (plazaNearFountain)   { recoverAtFountain(); }
  else if (plazaNearPond)       { startFishing(); }
  else if (plazaNearBench)      { sitOnBench(); }
  else if (plazaNearFlower && nearestFlower) { pickFlower(); }
}

// ── エリア移動（フェードイン・アウト演出付き） ─────────────────
function enterAreaWithFade(areaName, onEnter) {
  const overlay = document.getElementById("areaTransitionOverlay") || (() => {
    const el = document.createElement("div");
    el.id = "areaTransitionOverlay";
    el.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(255,240,255,0);pointer-events:none;transition:background 0.4s ease;";
    document.body.appendChild(el);
    return el;
  })();
  overlay.style.background = "rgba(255,240,255,0)";
  requestAnimationFrame(() => {
    overlay.style.background = "rgba(255,240,255,0.85)";
    setTimeout(() => {
      // エリア名を一瞬表示
      const label = document.getElementById("areaTransitionLabel") || (() => {
        const el = document.createElement("div");
        el.id = "areaTransitionLabel";
        el.style.cssText = [
          "position:fixed","top:50%","left:50%",
          "transform:translate(-50%,-50%)",
          "font-size:22px","font-weight:900",
          "color:#c060a0","text-shadow:0 2px 12px rgba(200,100,180,0.4)",
          "z-index:201","pointer-events:none","letter-spacing:0.12em",
        ].join(";");
        document.body.appendChild(el);
        return el;
      })();
      label.textContent = areaName;
      label.style.opacity = "1";
      onEnter();
      setTimeout(() => {
        label.style.transition = "opacity 0.4s";
        label.style.opacity = "0";
        overlay.style.background = "rgba(255,240,255,0)";
      }, 600);
    }, 400);
  });
}

function enterPondArea() {
  enterAreaWithFade("🎣 釣り場", () => {
    dom.statusLine.textContent = "池のほとりに来た。のんびり釣りでもしよう。";
    setTimeout(() => dom.statusLine.textContent = "", 3000);
    startFishing();
  });
}

function enterFlowerArea() {
  enterAreaWithFade("🌸 花　畑", () => {
    dom.statusLine.textContent = "花畑に来た。好きな花を選んで摘もう。";
    setTimeout(() => dom.statusLine.textContent = "", 3000);
    // 花畑エリアではnearestFlowerを最寄りの未採取花に強制セット
    const available = plaza.flowerField.filter(f => !f.userData.picked);
    if (available.length > 0) {
      nearestFlower = available[Math.floor(Math.random() * available.length)];
      plazaNearFlower = true; // ★ フラグも必ず同期する
      pickFlower();
    } else {
      nearestFlower = null;
      plazaNearFlower = false;
      dom.statusLine.textContent = "今日の花はもう摘み終わった。また明日来よう。";
      setTimeout(() => dom.statusLine.textContent = "", 3000);
    }
  });
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

  // ★ 釣りが進行中なら強制終了（UIとフラグを両方クリア）
  if (typeof fishingActive !== "undefined" && fishingActive) {
    if (typeof fishingTimer !== "undefined" && fishingTimer) {
      clearTimeout(fishingTimer);
      fishingTimer = null;
    }
    fishingActive = false;
    fishingPhase = "idle";
    const fui = document.getElementById("fishingUI");
    if (fui) fui.style.display = "none";
  }

  // ★ 料理UIが開いていたら閉じる
  const cui = document.getElementById("cookingUI");
  if (cui && cui.style.display !== "none") {
    if (typeof closeCooking === "function") closeCooking();
    else cui.style.display = "none";
  }

  // ★ 花摘みUIが開いていたら閉じる
  const flui = document.getElementById("flowerUI");
  if (flui && flui.style.display !== "none") flui.style.display = "none";

  // ★ ベンチ待機フラグをリセット
  state._benchBentoReady = false;

  // ★ フェードオーバーレイを即座に非表示
  const overlay = document.getElementById("areaTransitionOverlay");
  if (overlay) overlay.style.background = "rgba(255,240,255,0)";
  const label = document.getElementById("areaTransitionLabel");
  if (label) label.style.opacity = "0";

  // バトルHUD要素を再表示
  dom.bossHpArea?.classList.remove("hud-hidden");
  dom.gaugeArea?.classList.remove("hud-hidden");
  dom.statsArea?.classList.remove("hud-hidden");
  dom.playerHpArea?.classList.remove("hud-hidden");
  dom.controllerPanel?.classList.remove("plaza-mode");
  setPlazaObjectsVisible(false);
  setBattleObjectsVisible(true);
  // バトル用の空・霧を復元
  three.scene.background = new THREE.Color(getCurrentStage(state.stageIndex).bgColor);
  three.scene.fog = new THREE.FogExp2(getCurrentStage(state.stageIndex).bgColor, getCurrentStage(state.stageIndex).fogDensity);
  // 次回広場に入ったとき時間帯を再適用するためキャッシュをリセット
  plaza.lastTimeOfDay = null;
  updateCameraFollow();
}

function setPlazaObjectsVisible(visible) {
  const targets = [
    plaza.ground, plaza.cobble, plaza.fountain,
    plaza.playerMesh, plaza.sunLight, plaza.ambientLight,
    plaza.pond, plaza.bigTree, plaza.bench,
    ...plaza.buildings.map(b => b.mesh),
    ...npcState.map(n => n.mesh).filter(Boolean),
    ...plaza.dock,
    ...plaza.flowerField,
    ...(plaza.decorObjects || []),
  ];
  targets.forEach(obj => { if (obj) obj.visible = visible; });
  if (plaza.waterDrops) plaza.waterDrops.forEach(d => d.visible = visible);
  if (plaza.dragonflies) plaza.dragonflies.forEach(d => d.visible = visible);
  if (plaza.lamps) plaza.lamps.forEach(l => l.visible = visible);
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