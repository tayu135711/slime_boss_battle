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
  slimeParts: null, // ★追加: buildCuteSlimeBodyの戻り値(帽子グループ等)を保持
  initialized: false,
  sunLight: null,
  ambientLight: null,
  cobble: null,
  waterDrops: [],
  pond: null,
  pondPos: { x: 18, z: 6 },   // ★修正: pond_area建物(x:18,z:6)と同座標に統一
  flowerAreaPos: { x: -16, z: 14 }, // ★修正: flower_area建物(x:-16,z:14)と同座標に統一（buildFlowerScene/enterFlowerAreaで共有）
  dock: [],
  bigTree: null,
  bench: null,
  dragonflies: [],
  flowerField: [],
  flowerSceneField: [], // サブエリア（花畑シーン）専用の花配列
  // 花壇・露店・フェンス等の装飾オブジェクト（setPlazaObjectsVisibleで一括管理）
  decorObjects: [],
  // サブエリア（専用マップ）用のグループ
  pondSceneGroup: null,
  flowerSceneGroup: null,
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
const PLAZA_FIELD_LIMIT  = 38;
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

// ── サブエリア管理 ─────────────────────────────────────────────
// 釣り場・花畑に「入った」かどうかを追跡するフラグ
let currentSubArea = null; // null | "pond" | "flower"
// 広場に戻ったときのプレイヤー初期位置（エリア入口付近）
const POND_AREA_ENTRY   = { x: 18,  z: 12 };    // ★修正: pond建物(z:6)の手前6ユニット
const FLOWER_AREA_ENTRY = { x: -16, z: 20 };    // 花畑建物(z:14)の手前6ユニット
// サブエリア用カメラ固定：trueの間はupdatePlazaCameraFollowでカメラを上書きしない
let subAreaCameraLocked = false;
let _subAreaCameraTimer = null; // ★ カメラロック解除タイマー
let _areaTransitionLocked = false;

let plazaDialog = null;

function initHomePlaza() {
  // 空・霧は時間帯システムが制御するため初期値のみ設定（白すぎない青空）
  three.scene.background = new THREE.Color(0x4a9ec2);
  three.scene.fog = new THREE.FogExp2(0x5ab0d8, 0.007);

  if (!plaza.initialized) {
    buildPlazaScene();
    buildPondScene();
    buildFlowerScene();
    plaza.initialized = true;
    // ★ 初回も必ず広場オブジェクトを表示する（デフォルトvisible=falseのままだと何も見えない）
    setPlazaObjectsVisible(true);
    setPondSceneVisible(false);
    setFlowerSceneVisible(false);
    setBattleObjectsVisible(false);
  } else {
    setPlazaObjectsVisible(true);
    setPondSceneVisible(false);
    setFlowerSceneVisible(false);
    setBattleObjectsVisible(false);
    // ★ 再入場時に時間帯を即座に再適用（空・ライト・skyObjectsを確実に設定）
    applyTimeOfDay(getTimeOfDay(), false);
    // ★ 再入場時にコスチューム色を広場プレイヤーに反映
    if (plaza.playerMesh && state.equippedCostume) {
      try {
        plaza.playerMesh.traverse(child => {
          if (child.isMesh && child.material?.color) {
            child.material.color.set(state.equippedCostume.color);
          }
        });
      } catch(e) {
        console.warn("コスチューム色反映エラー:", e);
      }
    }
  }

  plazaPlayer.x = 0;
  plazaPlayer.z = 0;
  if (plaza.playerMesh) plaza.playerMesh.position.set(0, 0, 0);
  updatePlazaCameraFollow();

  npcState.forEach(n => n.waitUntil = Date.now() + 1000);
  closeNpcDialog();

  // マップの使い方ヒント（初回のみ）
  if (!plaza._flowerHintShown) {
    plaza._flowerHintShown = true;
    setTimeout(() => {
      dom.statusLine.textContent = "🗺️ 右上のマップから釣り場・花畑にすぐ移動できるよ！";
      setTimeout(() => dom.statusLine.textContent = "", 4000);
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
    skyColor:   0xd4945a,  // ★ 朝焼けをもっと濃いオレンジに
    fogColor:   0xd4945a,
    fogDensity: 0.008,
    sunColor:   0xffcc66,
    sunIntensity: 0.65,    // ★ 少し下げる（0.75→0.65）
    sunPos: [8, 12, 18],
    ambColor:   0xb8844a,  // ★ さらに暖色・暗め
    ambIntensity: 0.28,    // ★ 0.30→0.28
    groundColor: 0x4e9a48, // 少し濃いめの緑
  },
  noon: {
    label: "☀️ 昼",
    skyColor:   0x4a9ec2,  // ★ さらに落ち着いた青（0x5ab0d8→0x4a9ec2）
    fogColor:   0x5ab0d8,
    fogDensity: 0.007,
    sunColor:   0xffd890,  // ★ やや暖かみのある昼光
    sunIntensity: 0.70,    // ★ さらに下げる（0.80→0.70）
    sunPos: [10, 20, 10],
    ambColor:   0x6a9ab8,  // ★ 青みを抑えたグレー寄り
    ambIntensity: 0.28,    // ★ さらに下げる（0.32→0.28）
    groundColor: 0x3d8c3a, // 濃いめの緑
  },
  evening: {
    label: "🌆 夕方",
    skyColor:   0xe05a30,
    fogColor:   0xd06040,
    fogDensity: 0.010,
    sunColor:   0xff6600,
    sunIntensity: 0.65,    // 1.0 → 0.65
    sunPos: [-12, 6, 10],
    ambColor:   0xcc8855,  // 暗めの橙
    ambIntensity: 0.28,    // 0.5 → 0.28
    groundColor: 0x6b4e2a, // 夕方らしい茶みどり
  },
  night: {
    label: "🌙 夜",
    skyColor:   0x0a1530,
    fogColor:   0x0a1530,
    fogDensity: 0.015,
    sunColor:   0x3355aa,
    sunIntensity: 0.25,    // 0.4 → 0.25
    sunPos: [5, 18, 5],
    ambColor:   0x1e2d55,
    ambIntensity: 0.22,    // 0.35 → 0.22
    groundColor: 0x223318,
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

  // ── 太陽・月・星オブジェクト ──────────────────────────────
  _updateSkyObjects(tod);

  // 街灯は夕方・夜だけON
  const lampOn = (tod === "evening" || tod === "night");
  (plaza.lamps || []).forEach(lamp => {
    const globe = lamp.children.find(c => c.isMesh);
    if (globe) globe.material.emissiveIntensity = lampOn ? (tod === "night" ? 1.4 : 0.7) : 0.2;
  });

  // 時間帯が変わったときだけ画面に通知
  if (showLabel) {
    dom.statusLine.textContent = `${s.label} の景色になりました`;
    setTimeout(() => dom.statusLine.textContent = "", 3000);
  }
}

function _updateSkyObjects(tod) {
  // 既存の空オブジェクトを削除
  if (plaza._skyObjects) {
    plaza._skyObjects.forEach(o => three.scene.remove(o));
  }
  plaza._skyObjects = [];

  const add = obj => { three.scene.add(obj); plaza._skyObjects.push(obj); };

  if (tod === "morning" || tod === "noon") {
    // ☀️ 太陽
    const sunColor  = tod === "morning" ? 0xff9940 : 0xffee88;
    const sunPos    = tod === "morning" ? [28, 18, -30] : [0, 38, -35];
    const sunRadius = tod === "morning" ? 2.5 : 3.0;
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(sunRadius, 10, 8),
      new THREE.MeshBasicMaterial({ color: sunColor })
    );
    sun.position.set(...sunPos);
    add(sun);

    // 光輪（朝のみ）
    if (tod === "morning") {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(sunRadius + 0.4, sunRadius + 1.8, 20),
        new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      halo.position.set(...sunPos);
      halo.lookAt(0, 0, 0);
      add(halo);
    }

    // 雲（昼のみ・軽量BoxGeometry）
    if (tod === "noon") {
      [[15, 18, -28], [-20, 22, -30], [8, 20, -32]].forEach(([cx, cy, cz]) => {
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(3.5, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
        );
        cloud.scale.set(1, 0.5, 0.7);
        cloud.position.set(cx, cy, cz);
        add(cloud);
      });
    }

  } else if (tod === "evening") {
    // 🌆 夕焼け太陽（低い位置）
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4400 })
    );
    sun.position.set(-30, 8, -20);
    add(sun);
    // 夕焼けグロー
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(6, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.18 })
    );
    glow.position.set(-30, 8, -20);
    add(glow);

  } else if (tod === "night") {
    // 🌙 月
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xeef0d8 })
    );
    moon.position.set(20, 28, -30);
    add(moon);
    // 月のグロー
    const moonGlow = new THREE.Mesh(
      new THREE.SphereGeometry(3.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.12 })
    );
    moonGlow.position.set(20, 28, -30);
    add(moonGlow);
    // ✨ 星（30個・軽量PointsMaterial）
    const starPositions = [];
    for (let i = 0; i < 30; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.4; // 上半球
      const r     = 45 + Math.random() * 10;
      starPositions.push(
        Math.cos(theta) * Math.sin(phi) * r,
        Math.cos(phi) * r * 0.7 + 15,
        Math.sin(theta) * Math.sin(phi) * r
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.9 })
    );
    add(stars);
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
  plaza.sunLight = new THREE.DirectionalLight(0xfff0c0, 0.80);
  plaza.sunLight.position.set(10, 20, 10);
  plaza.sunLight.castShadow = true;
  three.scene.add(plaza.sunLight);
  plaza.ambientLight = new THREE.AmbientLight(0x8ab4cc, 0.32);
  three.scene.add(plaza.ambientLight);

  plaza.ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x3d8c3a, roughness: 0.9 })
  );
  plaza.ground.rotation.x = -Math.PI / 2;
  plaza.ground.receiveShadow = true;
  three.scene.add(plaza.ground);

  const cobble = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshStandardMaterial({
    color: 0x8a7a6a, roughness: 0.95,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  cobble.rotation.x = -Math.PI / 2;
  cobble.position.y = 0.02;
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
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x9a8878, roughness: 0.85 }));
  base.position.y = 0.2;
  group.add(base);
  const basin = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.25, 8, 24), new THREE.MeshStandardMaterial({ color: 0x90c0e0, roughness: 0.3, metalness: 0.2 }));
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = 0.5;
  group.add(basin);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x8a7868, roughness: 0.75 }));
  pillar.position.y = 1.1;
  group.add(pillar);
  const topDish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x9a8878, roughness: 0.85 }));
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

    if (def.type === "stage") {
      // ⚔️ 冒険の門：濃い赤レンガ風＋剣シンボル
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x8b2020, roughness: 0.75 }));
      body.position.y = 2.25; body.castShadow = true; group.add(body);
      // 石積みライン
      [-0.5, 0.5, 1.5, 2.5].forEach(py => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.08, 4.02),
          new THREE.MeshStandardMaterial({ color: 0x6a1010, roughness: 0.9 }));
        stripe.position.y = py; group.add(stripe);
      });
      // 屋根（ダーク赤茶）
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.0, 4),
        new THREE.MeshStandardMaterial({ color: 0x4a1008, roughness: 0.8 }));
      roof.position.y = 5.5; roof.rotation.y = Math.PI/4; group.add(roof);
      // 塔×2
      [-2.2, 2.2].forEach(tx => {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 5.5, 8),
          new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.8 }));
        tower.position.set(tx, 2.75, -1.5); group.add(tower);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x3a0808, roughness: 0.7 }));
        cap.position.set(tx, 6.1, -1.5); group.add(cap);
      });
      // ドア（アーチ風）
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x0a0808, roughness: 0.95 }));
      door.position.set(0, 1.2, 2.07); group.add(door);
      // 剣シンボル（十字）
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.8, roughness: 0.2 }));
      blade.position.set(0, 3.2, 2.08); group.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xb8a030, metalness: 0.7, roughness: 0.3 }));
      guard.position.set(0, 2.7, 2.08); group.add(guard);
      // 窓×2
      [-1.3, 1.3].forEach(wx => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.1, emissive: 0xff3300, emissiveIntensity: 0.4 }));
        win.position.set(wx, 3.0, 2.07); group.add(win);
      });

    } else if (def.type === "shop") {
      // 🛍 商店：明るいコバルトブルー＋星マーク
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x1a4a9a, roughness: 0.6 }));
      body.position.y = 2; body.castShadow = true; group.add(body);
      // アクセントライン
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.4, 4.02),
        new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.7 }));
      stripe.position.y = 0.2; group.add(stripe);
      // ひさし
      const eave = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 1.0),
        new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.7 }));
      eave.position.set(0, 2.4, 2.5); group.add(eave);
      // 屋根
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x0d2a66, roughness: 0.8 }));
      roof.position.y = 4.9; roof.rotation.y = Math.PI/4; group.add(roof);
      // 星マーク（正面）
      const starBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
        new THREE.MeshStandardMaterial({ color: 0xffe040, emissive: 0xffc000, emissiveIntensity: 0.5, metalness: 0.3 }));
      starBody.position.set(0, 3.3, 2.1); starBody.rotation.y = Math.PI/4; group.add(starBody);
      // ショーウィンドウ
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.05, transparent: true, opacity: 0.7 }));
      win.position.set(0, 1.6, 2.06); group.add(win);
      // ドア
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x0d2a66, roughness: 0.9 }));
      door.position.set(1.5, 0.9, 2.06); group.add(door);

    } else if (def.type === "restaurant") {
      // 🍜 食堂：暖かい朱色＋どんぶりシンボル
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0xc03018, roughness: 0.65 }));
      body.position.y = 2; body.castShadow = true; group.add(body);
      // 暖簾（のれん）風ストライプ
      [0, 1, 2, 3].forEach(i => {
        const noren = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.06),
          new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xe82010 : 0xf8f8e0, roughness: 0.9 }));
        noren.position.set(-1.2 + i * 0.82, 1.3, 2.1); group.add(noren);
      });
      // 提灯×2
      [-1.2, 1.2].forEach(lx => {
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.7, emissive: 0xff1100, emissiveIntensity: 0.4 }));
        lantern.position.set(lx, 3.8, 2.1); group.add(lantern);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
          new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 }));
        cord.position.set(lx, 4.25, 2.1); group.add(cord);
      });
      // 屋根（黒っぽい）
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x220808, roughness: 0.8 }));
      roof.position.y = 4.8; roof.rotation.y = Math.PI/4; group.add(roof);
      // どんぶりシンボル
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.3, 10),
        new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.3 }));
      bowl.position.set(0, 3.2, 2.08); group.add(bowl);
      const steam1 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 0.6 }));
      steam1.rotation.x = Math.PI/2; steam1.position.set(-0.15, 3.65, 2.08); group.add(steam1);
      const steam2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, opacity: 0.6 }));
      steam2.rotation.x = Math.PI/2; steam2.position.set(0.15, 3.8, 2.08); group.add(steam2);
      // ドア
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 0.95 }));
      door.position.set(0, 0.95, 2.07); group.add(door);

    } else if (def.type === "pond_area") {
      // 🎣 釣り場：水色の小屋＋魚マーク
      const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x1a7aaa, roughness: 0.55 }));
      body.position.y = 1.6; body.castShadow = true; group.add(body);
      // 波模様ライン
      [0.4, 1.1, 1.8].forEach(py => {
        const wave = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.12, 3.52),
          new THREE.MeshStandardMaterial({ color: 0x3aaad0, roughness: 0.7 }));
        wave.position.y = py; group.add(wave);
      });
      // 屋根（深い青）
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x0a3a5a, roughness: 0.75 }));
      roof.position.y = 4.1; roof.rotation.y = Math.PI/4; group.add(roof);
      // 魚シンボル（正面）
      const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xf0c060, metalness: 0.3, roughness: 0.4 }));
      fishBody.scale.set(1.5, 0.8, 0.5);
      fishBody.position.set(-0.3, 2.5, 1.77); group.add(fishBody);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 3),
        new THREE.MeshStandardMaterial({ color: 0xf0c060, metalness: 0.3, roughness: 0.4 }));
      tail.rotation.z = Math.PI/2; tail.position.set(0.65, 2.5, 1.77); group.add(tail);
      // 釣り竿
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x8b5020, roughness: 0.8 }));
      rod.rotation.z = -0.4; rod.position.set(1.4, 3.2, 1.77); group.add(rod);
      // ドア
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x0a2a40, roughness: 0.95 }));
      door.position.set(0, 0.9, 1.77); group.add(door);
      // 窓
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x88ddff, roughness: 0.1, transparent: true, opacity: 0.8 }));
      win.position.set(-1.2, 2.0, 1.77); group.add(win);

    } else if (def.type === "flower_area") {
      // 🌸 花畑：暖かいピンク＋花びらシンボル
      const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 3.5),
        new THREE.MeshStandardMaterial({ color: 0xb83060, roughness: 0.6 }));
      body.position.y = 1.6; body.castShadow = true; group.add(body);
      // アクセントライン
      [0.5, 1.4, 2.3].forEach(py => {
        const accent = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.14, 3.52),
          new THREE.MeshStandardMaterial({ color: 0xf060a0, roughness: 0.7 }));
        accent.position.y = py; group.add(accent);
      });
      // 丸屋根
      const roof = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 10, 7, 0, Math.PI*2, 0, Math.PI/2),
        new THREE.MeshStandardMaterial({ color: 0x8a1848, roughness: 0.6 }));
      roof.position.y = 3.2; group.add(roof);
      // 花びらシンボル×5（正面中央）
      const petalColors = [0xff88cc, 0xffcc44, 0xaa66ff, 0xff6688, 0x88ffaa];
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4),
          new THREE.MeshStandardMaterial({ color: petalColors[i], roughness: 0.5, emissive: petalColors[i], emissiveIntensity: 0.15 }));
        petal.scale.set(1, 0.5, 0.4);
        petal.position.set(Math.cos(angle)*0.42, 2.8 + Math.sin(angle)*0.32, 1.77); group.add(petal);
      }
      const flCenter = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xffe060, emissive: 0xffcc00, emissiveIntensity: 0.5 }));
      flCenter.position.set(0, 2.8, 1.77); group.add(flCenter);
      // ドア
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x3a0820, roughness: 0.95 }));
      door.position.set(0, 0.9, 1.77); group.add(door);
      // 窓
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xffccee, roughness: 0.1, transparent: true, opacity: 0.8 }));
      win.position.set(-1.2, 2.0, 1.77); group.add(win);
    }

    group.position.set(def.x, 0, def.z);
    three.scene.add(group);
    plaza.buildings.push({ mesh: group, ...def });
  });

  // ── 街灯（ポイントライト廃止→emissiveで軽量化） ──────────
  const lampPositions = [
    [-8, -8], [8, -8], [-8, 8], [8, 8],
    [0, -14], [-14, 0], [14, 0],
  ];
  lampPositions.forEach(([x, z]) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.5, 6), // ★6セグ→軽量
      new THREE.MeshStandardMaterial({ color: 0x606880, roughness: 0.5 }));
    pole.position.y = 2.25; g.add(pole);
    // ★PointLight廃止→emissiveで発光感を出す（重さの主原因）
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), // ★10→6セグ
      new THREE.MeshStandardMaterial({ color: 0xfffce0, roughness: 0.1, emissive: 0xfff8c0, emissiveIntensity: 1.2 }));
    head.position.y = 4.65; g.add(head);
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
    plaza.decorObjects.push(g); // ★修正: 露店をシーン管理下に
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
  plaza.decorObjects.push(bb); // ★修正: 掲示板をシーン管理下に
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
  const costume = state.equippedCostume;
  const color = costume ? costume.color : CONFIG.player.color;
  // ★修正: 戻り値(bodyMat/hatGroup等)を捨てずに plaza.slimeParts に保持する。
  //         これが無いと rebuildHat() が広場プレイヤーの帽子グループを
  //         見つけられず、帽子付きコスチュームが広場では永遠に反映されないバグになる。
  plaza.slimeParts = buildCuteSlimeBody(group, CONFIG.player.radius, color);
  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.playerMesh = group;
  // ★修正: 生成直後に現在の装備帽子を反映する（それまでは常に帽子なしのままだった）
  if (costume && typeof rebuildHat === "function") rebuildHat(costume);
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
  treeGroup.position.set(px + 6, 0, pz - 6); // ★修正: 池の北東へ移動（建物と被らない）
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
  benchGroup.position.set(px - 2.5, 0, pz + 4.5); // ★修正: 桟橋の横（池南側）へ
  three.scene.add(benchGroup);
  plaza.bench = benchGroup;

  // ★軽量化: 草花30→10本、葦15→6本
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4.0 + Math.random() * 5.0;
    const x = px + Math.cos(angle) * dist;
    const z = pz + Math.sin(angle) * dist;
    const flower = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), new THREE.MeshStandardMaterial({ color: [0xFFB6C1, 0xFF69B4, 0xFFFF99][Math.floor(Math.random()*3)], roughness: 0.8 }));
    flower.position.set(x, 0.15, z);
    three.scene.add(flower);
    plaza.decorObjects.push(flower);
  }
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4.0 + Math.random() * 4.0;
    const x = px + Math.cos(angle) * dist;
    const z = pz + Math.sin(angle) * dist;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.9 }));
    stalk.position.set(x, 0.3, z);
    three.scene.add(stalk);
    plaza.decorObjects.push(stalk);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4), new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 }));
    head.position.set(x, 0.6, z);
    three.scene.add(head);
    plaza.decorObjects.push(head);
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
  plaza.decorObjects.push(signPost); // ★修正: シーン切替で消えないよう管理下に

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xF5DEB3, roughness: 0.8 })
  );
  signBoard.position.set(fieldCenter.x + 5.5, 1.6, fieldCenter.z - 1);
  three.scene.add(signBoard);
  plaza.decorObjects.push(signBoard); // ★修正

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
    plaza.decorObjects.push(fence); // ★修正
  }

  // 地面（花畑エリアを緑で強調）
  const fieldGround = new THREE.Mesh(
    new THREE.CircleGeometry(fieldRadius, 24),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.9 })
  );
  fieldGround.rotation.x = -Math.PI / 2;
  fieldGround.position.set(fieldCenter.x, 0.01, fieldCenter.z);
  three.scene.add(fieldGround);
  plaza.decorObjects.push(fieldGround); // ★修正

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


// 遠景の木々（境界を隠す林）★軽量化: 本数削減＋建物座標排除
function buildDistantTrees() {
  const WALL = PLAZA_FIELD_LIMIT;

  // ★ 建物の座標（木と被らないようにスキップ）
  const BUILDING_EXCLUSIONS = [
    { x:  0, z: -18, r: 6 },
    { x: -15, z: -10, r: 6 },
    { x:  15, z: -10, r: 6 },
    { x:  18, z:   6, r: 7 },
    { x: -16, z:  14, r: 7 },
  ];
  function isTooClose(x, z) {
    return BUILDING_EXCLUSIONS.some(b => Math.hypot(x - b.x, z - b.z) < b.r);
  }

  const treePositions = [];

  // ★ 外周1リングのみ（3リング→1リング）、間隔を広くして本数削減
  const dist = WALL + 3;
  const count = Math.round(dist * Math.PI * 2 / 6.0); // 間隔6u（旧3.5u）
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    treePositions.push([Math.cos(angle) * dist, Math.sin(angle) * dist]);
  }

  // ★ 内側の木: 60本→20本に削減、建物近くはスキップ
  let attempts = 0;
  let added = 0;
  while (added < 20 && attempts < 200) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const r = WALL - 5 + Math.random() * 4;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (!isTooClose(x, z)) {
      treePositions.push([x, z]);
      added++;
    }
  }

  treePositions.forEach(([x, z]) => {
    const h = 4.0 + Math.random() * 5;
    const tree = makeFirTree(x, z, h);
    three.scene.add(tree);
    plaza.decorObjects.push(tree); // ★ setPlazaObjectsVisible管理下に追加
  });
}


function updateHomePlazaLoop() {
  // 料理・花摘みUI、または釣り中はプレイヤー移動・インタラクションをスキップ
  const cookUI  = document.getElementById("cookingUI");
  const flUI    = document.getElementById("flowerUI");
  const uiOpen  = (cookUI && cookUI.style.display !== "none") ||
                  (flUI   && flUI.style.display   !== "none") ||
                  (typeof fishingActive !== "undefined" && fishingActive);

  if (!uiOpen) {
    updatePlazaPlayer();
    // ★ サブエリア（釣り場・花畑）内にいるときは建物入場チェックをスキップ
    // 　 （プレイヤーが建物近くにいても「入る」プロンプトを出さない）
    if (!currentSubArea) {
      checkPlazaEntrances();
    } else {
      // サブエリア内では建物プロンプト・NPC泡を消す
      dom.plazaActionPrompt.classList.remove("visible");
      plazaNearBuilding = null;
      if (currentSubArea === "flower") {
        checkFlowerProximity();
        // ★ 花畑エリア内でプロンプトを表示
        if (plazaNearFlower && nearestFlower) {
          dom.plazaActionPrompt.textContent = "Ａ で花を摘む";
          dom.plazaActionPrompt.classList.add("visible");
        } else {
          dom.plazaActionPrompt.classList.remove("visible");
        }
      } else if (currentSubArea === "pond") {
        // ★ 釣り場エリア内で釣り待機中のプロンプトを表示
        if (!fishingActive) {
          dom.plazaActionPrompt.textContent = "Ａ で釣り糸を垂らす";
          dom.plazaActionPrompt.classList.add("visible");
        } else {
          dom.plazaActionPrompt.classList.remove("visible");
        }
      }
    }
  } else {
    // ★ UI表示中はプロンプトを必ず消す
    dom.plazaActionPrompt.classList.remove("visible");
  }
  updatePlazaNPCs();
  updateFountain();
  updateDragonflies();
  updateFlowers();
  updatePlazaCameraFollow();
  updateTimeOfDay();  // 時間帯チェック（変化時のみ描画更新）
}

// ── 歩きモーション（ぽよんぽよんホップ）用の状態 ──────────────
const plazaWalk = {
  phase:     0,       // ホップ位相（0〜2π で1サイクル）
  isMoving:  false,   // 移動中フラグ
  wasMoving: false,   // 前フレームの移動状態（着地スクワッシュ用）
  landTimer: 0,       // 着地スクワッシュ残り時間（ms）
};
const WALK_HOP_SPEED   = 0.22;  // 位相の進み速さ（速いほど足が速い感じ）
const WALK_HOP_HEIGHT  = 0.28;  // ホップの最大高さ（単位:Three.jsユニット）
const WALK_SQUASH_TIME = 120;   // 着地スクワッシュ持続（ms）

function updatePlazaPlayer() {
  let dx = 0, dz = 0;

  // アナログジョイスティック優先（広場モード時）
  const jv = state.joystickVec;
  if (jv && (Math.abs(jv.x) > 0.05 || Math.abs(jv.y) > 0.05)) {
    dx = jv.x;
    dz = jv.y;
  } else {
    // キーボード / Dパッドのデジタル入力
    if (state.keys.up)    dz -= 1;
    if (state.keys.down)  dz += 1;
    if (state.keys.left)  dx -= 1;
    if (state.keys.right) dx += 1;
  }

  const isMoving = (dx !== 0 || dz !== 0);

  if (isMoving) {
    const len = Math.hypot(dx, dz);
    const speed = PLAZA_MOVE_SPEED * (jv && len > 0 ? Math.min(len, 1.0) : 1.0);
    plazaPlayer.x = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT, plazaPlayer.x + (dx / len) * speed));
    plazaPlayer.z = Math.max(-PLAZA_FIELD_LIMIT, Math.min(PLAZA_FIELD_LIMIT, plazaPlayer.z + (dz / len) * speed));
    if (plaza.playerMesh) plaza.playerMesh.rotation.y = Math.atan2(dx, dz);

    // ── ぽよんぽよんホップ位相を進める ──
    plazaWalk.phase += WALK_HOP_SPEED;
  }

  // ── 着地検出：移動→停止の瞬間にスクワッシュ ──
  if (plazaWalk.wasMoving && !isMoving) {
    plazaWalk.landTimer = WALK_SQUASH_TIME;
  }
  plazaWalk.wasMoving = isMoving;
  plazaWalk.isMoving  = isMoving;
  if (plazaWalk.landTimer > 0) plazaWalk.landTimer -= 16; // 約60fps想定

  // ── Y位置・スケールをアニメーション ──
  if (plaza.playerMesh) {
    let posY  = 0;
    let scaleX = 1, scaleY = 1, scaleZ = 1;

    if (isMoving) {
      // ぽよんぽよんホップ：sin波で上下
      // sin が正のとき上昇、0のとき地面接地
      const hopRaw = Math.sin(plazaWalk.phase);
      const hop    = Math.max(0, hopRaw);  // 負値（地中に潜る）をカット
      posY = hop * WALK_HOP_HEIGHT;

      // 接地フェーズ（sin≈0付近）でスクワッシュ、空中でストレッチ
      const squashStrength = 1.0 - hop;
      scaleX = 1 + squashStrength * 0.12;  // 横に広がる
      scaleY = 1 - squashStrength * 0.10;  // 縦に縮む
      scaleZ = scaleX;
    } else if (plazaWalk.landTimer > 0) {
      // 着地スクワッシュ：ぺちゃっと潰れてすぐ戻る
      const t = plazaWalk.landTimer / WALK_SQUASH_TIME; // 1→0
      const squash = Math.sin(t * Math.PI); // 山なりに0→1→0
      scaleX = 1 + squash * 0.22;
      scaleY = 1 - squash * 0.18;
      scaleZ = scaleX;
      posY = 0;
    } else {
      // 待機：ゆっくりフワフワする呼吸アニメ
      const breathe = Math.sin(Date.now() * 0.0015) * 0.025;
      posY   = breathe + 0.025;
      scaleX = 1 + Math.sin(Date.now() * 0.0012) * 0.012;
      scaleY = 1 - Math.sin(Date.now() * 0.0012) * 0.010;
      scaleZ = scaleX;
    }

    plaza.playerMesh.position.set(plazaPlayer.x, posY, plazaPlayer.z);
    plaza.playerMesh.scale.set(scaleX, scaleY, scaleZ);
  }
}

function updatePlazaCameraFollow() {
  // ★ サブエリア入場直後はカメラを固定（演出カメラを上書きしない）
  if (subAreaCameraLocked) return;
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
    // ── NPCもぽよんぽよん歩きアニメ ──
    if (!npc.mesh) return;
    if (npc.moveState === "moving") {
      npc.walkPhase = (npc.walkPhase || 0) + 0.18;
      const hop = Math.max(0, Math.sin(npc.walkPhase)) * 0.18;
      const sq  = 1.0 - Math.max(0, Math.sin(npc.walkPhase));
      npc.mesh.position.y = hop;
      npc.mesh.scale.set(1 + sq * 0.08, 1 - sq * 0.07, 1 + sq * 0.08);
    } else {
      // 待機：ゆっくり呼吸
      const b = Math.sin(now * 0.001 + (npc.walkPhase || 0)) * 0.018;
      npc.mesh.position.y = b + 0.018;
      npc.mesh.scale.set(1 + b * 0.3, 1 - b * 0.25, 1 + b * 0.3);
    }
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
  plazaNearFlower = false;  // ← 料理UI中でもゴーストプロンプトが残らないようリセット

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
  // ★修正: 以前は上でplazaNearFlowerをfalseにリセットした後、
  //         このスコープ内では一度も再計算しないまま下のif/else-ifで参照していたため、
  //         「else if (plazaNearFlower)」が常にfalseになり、広場に咲いている花に近づいても
  //         「Ａ で花を摘む」プロンプトが絶対に表示されないバグになっていた。
  //         ここでchekFlowerProximity()を呼んで実際の距離判定を行う。
  checkFlowerProximity();

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
  // 花摘み待機中にAで摘む
  if (window._flowerWaiting) { doPickFlower(); return; }

  // ★ サブエリア内では「広場に戻る」以外の建物入場を防ぐ
  if (currentSubArea) {
    // 花畑エリア内: Aで花を摘む
    if (currentSubArea === "flower" && plazaNearFlower && nearestFlower) {
      if (window._flowerWaiting) {
        doPickFlower();
      } else {
        pickFlower();
      }
      return;
    }
    // 釣り場エリア内: Aで釣りを開始（釣り中でなければ）
    if (currentSubArea === "pond" && !fishingActive) {
      startFishing();
      return;
    }
    return;
  }

  if (plazaNearBuilding) {
    if (plazaNearBuilding.type === "stage")          { exitHomePlaza(); showStageSelect("plaza"); }
    else if (plazaNearBuilding.type === "shop")       { showShop(); }
    else if (plazaNearBuilding.type === "restaurant") { showCooking(); }
    else if (plazaNearBuilding.type === "pond_area")  { enterPondArea(); }
    else if (plazaNearBuilding.type === "flower_area"){ enterFlowerArea(); }
  } else if (plazaNearNPC)      { startNPCConversation(plazaNearNPC); }
  else if (plazaNearFountain)   { recoverAtFountain(); }
  else if (plazaNearPond)       { startFishing(); }
  else if (plazaNearBench)      { sitOnBench(); }
  else if (plazaNearFlower && nearestFlower) { pickFlower(); }
}

// ── エリア移動（フェードイン・アウト演出付き） ─────────────────
function enterAreaWithFade(areaName, onEnter) {
  // ★ フェード中の二重実行を防止
  if (_areaTransitionLocked) return;
  _areaTransitionLocked = true;

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
      try {
        onEnter();
      } catch (e) {
        console.error("Area transition error:", e);
      }
      setTimeout(() => {
        label.style.transition = "opacity 0.4s";
        label.style.opacity = "0";
        overlay.style.background = "rgba(255,240,255,0)";
        // ★ フェード完了後（または例外時）にロック解除
        _areaTransitionLocked = false;
      }, 600);
    }, 400);
  });
}

function enterPondArea() {
  enterAreaWithFade("🎣 釣り場", () => {
    currentSubArea = "pond";
    showSubAreaBackButton("pond");

    // サブエリアのシーングループを切り替え
    setPlazaObjectsVisible(false);
    setPondSceneVisible(true);
    setFlowerSceneVisible(false);

    // ★ プレイヤーをpond実体の手前（桟橋の前）に移動
    const px = plaza.pondPos.x;
    const pz = plaza.pondPos.z;
    plazaPlayer.x = px;
    plazaPlayer.z = pz + 5.5;  // 池の手前・桟橋のすぐ手前
    if (plaza.playerMesh) plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);

    // ★ カメラを池に向ける演出（次フレームで上書きされないようロック）
    subAreaCameraLocked = true;
    three.camera.position.set(px, 4.5, pz + 12);
    three.camera.lookAt(px, 0.2, pz);
    // 2秒後にカメラロック解除 → 以降は通常フォロー
    // （★修正: このタイマーが無いとカメラが演出位置に固まったまま二度と追従しなくなるバグがあった）
    if (_subAreaCameraTimer) clearTimeout(_subAreaCameraTimer);
    _subAreaCameraTimer = setTimeout(() => {
      subAreaCameraLocked = false;
      _subAreaCameraTimer = null;
    }, 2000);

    dom.statusLine.textContent = "池のほとりに来た。Ａ で釣り糸を垂らそう！";
    setTimeout(() => dom.statusLine.textContent = "", 3000);
    // ★ 自動でstartFishingを呼ばない → プレイヤーがAボタンで開始する
    // （フェード中に呼ぶと二重実行・タイミングバグの原因になる）
  });
}

function enterFlowerArea() {
  enterAreaWithFade("🌸 花　畑", () => {
    currentSubArea = "flower";
    showSubAreaBackButton("flower");

    // サブエリアのシーングループを切り替え
    setPlazaObjectsVisible(false);
    setPondSceneVisible(false);
    setFlowerSceneVisible(true);

    // ★ プレイヤーを花畑の入口（中心から少し手前）に移動
    const fc = plaza.flowerAreaPos; // ★修正: buildFlowerSceneと同じ定数を共有し座標ズレを防止
    plazaPlayer.x = fc.x;
    plazaPlayer.z = fc.z + 6;  // 花畑の入口付近
    if (plaza.playerMesh) plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);

    // ★ カメラを花畑に向ける演出（ロック）
    subAreaCameraLocked = true;
    three.camera.position.set(fc.x, 4.5, fc.z + 13);
    three.camera.lookAt(fc.x, 0.3, fc.z);
    // 2秒後にカメラロック解除 → 以降は通常フォロー
    if (_subAreaCameraTimer) clearTimeout(_subAreaCameraTimer);
    _subAreaCameraTimer = setTimeout(() => {
      subAreaCameraLocked = false;
      _subAreaCameraTimer = null;
    }, 2000);

    // 花畑エリアではnearestFlowerを最寄り（距離近い方）の未採取花に強制セット
    const available = plaza.flowerSceneField.filter(f => !f.userData.picked);
    if (available.length > 0) {
      // ランダムではなく、プレイヤー移動先に最も近い花を選ぶ
      available.sort((a, b) => {
        const da = Math.hypot(a.position.x - plazaPlayer.x, a.position.z - plazaPlayer.z);
        const db = Math.hypot(b.position.x - plazaPlayer.x, b.position.z - plazaPlayer.z);
        return da - db;
      });
      nearestFlower = available[0];
      plazaNearFlower = true;
      dom.statusLine.textContent = "花畑に来た。Ａ で花を摘もう！";
      setTimeout(() => dom.statusLine.textContent = "", 3000);
    } else {
      nearestFlower = null;
      plazaNearFlower = false;
      dom.statusLine.textContent = "今日の花はもう摘み終わった。また明日来よう。";
      setTimeout(() => dom.statusLine.textContent = "", 3000);
    }
  });
}

/**
 * サブエリア（釣り場・花畑）用の「広場に戻る」ボタンを表示する。
 * 既存のボタンがあれば使い回し、なければ動的生成。
 * @param {"pond"|"flower"} areaType
 */
function showSubAreaBackButton(areaType) {
  let btn = document.getElementById("subAreaBackBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "subAreaBackBtn";
    btn.style.cssText = [
      "position:fixed",
      "bottom:210px", // CSSの#subAreaBackBtnで safe-area-inset対応
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:150",
      "padding:14px 32px",
      "min-height:52px",
      "background:rgba(255,240,255,0.92)",
      "color:#9a3080",
      "border:2px solid #d070b0",
      "border-radius:24px",
      "font-size:16px",
      "font-weight:700",
      "cursor:pointer",
      "box-shadow:0 2px 12px rgba(200,100,180,0.25)",
      "letter-spacing:0.08em",
      "touch-action:manipulation",
    ].join(";");
    document.body.appendChild(btn);
    btn.addEventListener("click", leaveSubArea);
  }
  btn.textContent = areaType === "pond" ? "🏡 広場に戻る" : "🏡 広場に戻る";
  btn.style.display = "block";
}

/** サブエリアから広場に戻る（フェード演出付き） */
function leaveSubArea() {
  // 釣り中なら強制終了
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
  // 花摘み待機中ならキャンセル
  window._flowerWaiting = false;
  const flui = document.getElementById("flowerUI");
  if (flui) flui.style.display = "none";

  // ボタンを隠す
  const btn = document.getElementById("subAreaBackBtn");
  if (btn) btn.style.display = "none";

  // カメラロック解除
  subAreaCameraLocked = false;
  if (_subAreaCameraTimer) { clearTimeout(_subAreaCameraTimer); _subAreaCameraTimer = null; }

  // エリアに応じた戻り先座標を設定（フェード後に適用）
  // ★ currentSubAreaはコールバック内でnullになるため事前にキャプチャ
  const returnPos = currentSubArea === "pond" ? POND_AREA_ENTRY : FLOWER_AREA_ENTRY;

  enterAreaWithFade("🏡 広　場", () => {
    currentSubArea = null;
    // 広場シーンに切り戻す
    setPlazaObjectsVisible(true);
    setPondSceneVisible(false);
    setFlowerSceneVisible(false);
    plazaPlayer.x = returnPos.x;
    plazaPlayer.z = returnPos.z;
    if (plaza.playerMesh) plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);
    updatePlazaCameraFollow();
    dom.statusLine.textContent = "広場に戻った。";
    setTimeout(() => dom.statusLine.textContent = "", 2000);
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
  const buff = recipe.buff || {};

  // ★ HPかいふく
  if (buff.hpRecover) {
    state.player.hp = Math.min(CONFIG.player.maxHp, state.player.hp + buff.hpRecover);
  }
  // ★ 必殺技ゲージ先行チャージ（次バトル開始時に反映させるためstateに保存）
  if (buff.specialStart) {
    state._buffSpecialStart = (state._buffSpecialStart || 0) + buff.specialStart;
  }
  // ★ 攻撃力アップ（バトル中の minDamage / maxDamage に一時乗算）
  if (buff.attackUp) {
    state._buffAttackMult = (state._buffAttackMult || 1) * buff.attackUp;
  }
  // ★ 移動速度アップ
  if (buff.speedUp) {
    state._buffSpeedMult = (state._buffSpeedMult || 1) * buff.speedUp;
  }
  // ★ クリティカル率アップ（criticalThresholdを下げる）
  if (buff.critUp) {
    state._buffCritMult = (state._buffCritMult || 1) * buff.critUp;
  }
  // ★ 防御力アップ（被ダメージ軽減）
  if (buff.defenseUp) {
    state._buffDefenseMult = (state._buffDefenseMult || 1) * buff.defenseUp;
  }

  const parts = [];
  if (buff.hpRecover)  parts.push(`HP +${buff.hpRecover}`);
  if (buff.attackUp)   parts.push(`攻撃×${buff.attackUp}`);
  if (buff.speedUp)    parts.push(`速度×${buff.speedUp}`);
  if (buff.critUp)     parts.push(`会心×${buff.critUp}`);
  if (buff.defenseUp)  parts.push(`防御×${buff.defenseUp}`);
  if (buff.specialStart) parts.push(`ゲージ+${buff.specialStart}%`);
  const msg = parts.length > 0 ? parts.join("・") : "なんだか元気が出てきた！";

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
  // ★ NPC自身のname（home_npcs.jsで定義）を使う。なければcostume名にフォールバック
  const costume = COSTUMES.find(c => c.id === npc.costumeId);
  dom.npcDialogName.textContent = npc.name || (costume ? costume.name : "???");
  showDialogLine();
  dom.npcDialog.classList.add("visible");
  SE.npcTalk();
}

function showDialogLine() {
  if (!plazaDialog) return;
  dom.npcDialogText.textContent = plazaDialog.lines[plazaDialog.currentLineIndex];
  dom.npcDialogNext.textContent = (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) ? "閉じる" : "次へ ▶";
}

function advanceDialog() {
  if (!plazaDialog) return;
  if (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) { SE.dialogClose(); closeNpcDialog(); return; }
  plazaDialog.currentLineIndex++;
  SE.dialogNext();
  showDialogLine();
}

function closeNpcDialog() {
  // ダイアログを閉じるとき、クエストを受注する
  if (plazaDialog?.npc?.questId) {
    const qid = plazaDialog.npc.questId;
    if (QUESTS[qid] && !state.quests[qid]) {
      acceptQuest(qid);
      SE.questAccept();
      dom.statusLine.textContent = "✨ クエスト「" + QUESTS[qid].name + "」を受注した！";
      setTimeout(() => dom.statusLine.textContent = "", 2500);
    }
  }
  plazaDialog = null;
  dom.npcDialog.classList.remove("visible");
}

function exitHomePlaza() {
  // ★ エリア移動ロックを強制解除
  _areaTransitionLocked = false;
  dom.homePlazaScreen.classList.remove("visible");
  dom.npcBubble.classList.remove("visible");
  dom.plazaActionPrompt.classList.remove("visible");
  closeNpcDialog();
  // マップボタン・マップ画面を非表示
  closePlazaMap();
  if (typeof updateMapBtnVisibility === "function") updateMapBtnVisibility();

  // ★ サブエリアフラグ・「広場に戻る」ボタンをリセット
  currentSubArea = null;
  subAreaCameraLocked = false;
  if (_subAreaCameraTimer) { clearTimeout(_subAreaCameraTimer); _subAreaCameraTimer = null; }
  setPondSceneVisible(false);
  setFlowerSceneVisible(false);
  const subBtn = document.getElementById("subAreaBackBtn");
  if (subBtn) subBtn.style.display = "none";

  // 花摘み待機中ならキャンセル
  window._flowerWaiting = false;

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
  // ジョイスティックのノブ位置をリセット
  const jKnob = document.getElementById("joystickKnob");
  if (jKnob) jKnob.style.transform = "translate(-50%, -50%)";
  // ★ 広場用スカイオブジェクト（雲・鳥など）をシーンから削除
  if (plaza._skyObjects && plaza._skyObjects.length > 0) {
    plaza._skyObjects.forEach(o => three.scene.remove(o));
    plaza._skyObjects = [];
  }
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
    plaza.sunLight, plaza.ambientLight,
    plaza.pond, plaza.bigTree, plaza.bench,
    ...plaza.buildings.map(b => b.mesh),
    ...npcState.map(n => n.mesh).filter(Boolean),
    ...plaza.dock,
    ...(plaza.decorObjects || []),
  ];
  targets.forEach(obj => { if (obj) obj.visible = visible; });
  // 広場の花（flowerField）は広場シーン専用なのでここで制御
  plaza.flowerField.forEach(f => { if (f) f.visible = visible; });
  // playerMeshは広場・サブエリア両方で見えるため visible に関わらず常に表示
  if (plaza.playerMesh) plaza.playerMesh.visible = true;
  if (plaza.waterDrops) plaza.waterDrops.forEach(d => d.visible = visible);
  if (plaza.dragonflies) plaza.dragonflies.forEach(d => d.visible = visible);
  if (plaza.lamps) plaza.lamps.forEach(l => l.visible = visible);
}

function setBattleObjectsVisible(visible) {
  if (three.bossGroup) three.bossGroup.visible = visible;
  if (three.playerGroup) three.playerGroup.visible = visible;
  if (three.rangeRing) three.rangeRing.visible = visible;
  if (three.bossLight) three.bossLight.visible = visible;
  // ★ バトル用地面・森装飾（岩・苔・きのこ・木・花）も一緒に切り替える
  if (three.battleGround) three.battleGround.forEach(o => { if (o) o.visible = visible; });
  if (three.battleDecors) three.battleDecors.forEach(o => { if (o) o.visible = visible; });
}

// 花摘み関連のグローバル変数（flower.js で使う）
let nearestFlower = null;
const FLOWER_PICK_RADIUS = 1.8;
function checkFlowerProximity() {
  nearestFlower = null;
  // サブエリア（花畑シーン）内では flowerSceneField、広場では flowerField を参照
  const targetField = (currentSubArea === "flower") ? plaza.flowerSceneField : plaza.flowerField;
  targetField.forEach(flower => {
    if (flower.userData.picked) return;
    const dx = plazaPlayer.x - flower.position.x;
    const dz = plazaPlayer.z - flower.position.z;
    if (Math.sqrt(dx*dx+dz*dz) < FLOWER_PICK_RADIUS) nearestFlower = flower;
  });
  plazaNearFlower = nearestFlower !== null;
}

function updateFlowers() {
  const now = Date.now();
  const t = now * 0.001;
  // 広場の花とサブエリアの花、両方を更新する
  const allFlowers = [...plaza.flowerField, ...(plaza.flowerSceneField || [])];
  allFlowers.forEach(flower => {
    // 翌日リスポーン：respawnTimeを過ぎたら花を復活させる
    if (flower.userData.picked) {
      if (flower.userData.respawnTime > 0 && now >= flower.userData.respawnTime) {
        flower.userData.picked = false;
        flower.userData.respawnTime = 0;
        flower.visible = true;
      }
      return;
    }
    flower.rotation.z = Math.sin(t * 1.5 + flower.userData.phase) * 0.1;
  });
}

document.getElementById('npcDialogNext')?.addEventListener('click', advanceDialog);
// ============================================================
// ワールドマップ機能
// ============================================================

/** マップ画面を開く */
function openPlazaMap() {
  const mapScreen = document.getElementById('plazaMapScreen');
  if (!mapScreen) return;
  mapScreen.classList.add('visible');
  updateMapPlayerDot();
}

/** マップ画面を閉じる */
function closePlazaMap() {
  const mapScreen = document.getElementById('plazaMapScreen');
  if (mapScreen) mapScreen.classList.remove('visible');
}

/**
 * プレイヤー位置をマップ上のドットに反映する
 * 広場の実座標 (-38〜38) を SVG座標 (0〜320, 0〜280) にマッピング
 */
function updateMapPlayerDot() {
  const dot  = document.getElementById('mapPlayerDot');
  const icon = document.getElementById('mapPlayerIcon');
  if (!dot || !icon) return;
  // 実座標 → SVG座標 変換
  const svgX = ((plazaPlayer.x + 38) / 76) * 320;
  const svgY = ((plazaPlayer.z + 38) / 76) * 280;
  dot.setAttribute('cx', svgX.toFixed(1));
  dot.setAttribute('cy', svgY.toFixed(1));
  icon.setAttribute('x', svgX.toFixed(1));
  icon.setAttribute('y', (svgY + 4).toFixed(1));
}

/**
 * マップのエリアボタンからワープする
 * @param {'stage'|'shop'|'restaurant'|'pond'|'flower'} dest
 */
function warpToArea(dest) {
  closePlazaMap();

  // ★修正: pond建物(x:18,z:6)・flower建物(x:-16,z:14)の手前に合わせた正確な座標
  const WARP_TARGETS = {
    stage:      { x:  0,  z: -12, action: () => { exitHomePlaza(); showStageSelect('plaza'); } },
    shop:       { x: -14, z:  -5, action: () => showShop() },
    restaurant: { x:  14, z:  -5, action: () => showCooking() },
    pond:       { x:  18, z:  12, action: () => enterPondArea() },   // ★修正: 建物(z:6)手前6u
    flower:     { x: -16, z:  20, action: () => enterFlowerArea() }, // ★修正: 建物(z:14)手前6u
  };

  const target = WARP_TARGETS[dest];
  if (!target) return;

  // フェード演出でワープ
  enterAreaWithFade('', () => {
    // ★修正: pond/flowerへワープする場合も含め、常にサブエリア状態をリセットしてから入り直す
    if (currentSubArea) {
      currentSubArea = null;
      subAreaCameraLocked = false;
      _areaTransitionLocked = false; // ★ ロックも解除
      const btn = document.getElementById('subAreaBackBtn');
      if (btn) btn.style.display = 'none';
    }

    plazaPlayer.x = target.x;
    plazaPlayer.z = target.z;
    if (plaza.playerMesh) plaza.playerMesh.position.set(plazaPlayer.x, 0, plazaPlayer.z);
    updatePlazaCameraFollow();

    // 少し遅らせてアクションを実行（カメラ移動後）
    setTimeout(() => { target.action(); }, 200);
  });
}

// ── マップボタン・エリアボタンのイベント登録 ──────────────────
(function setupMapEvents() {
  // DOMContentLoaded後に登録（スクリプト読み込み順の都合でDOMが先に存在する）
  function bindMapEvents() {
    const mapBtn   = document.getElementById('plazaMapBtn');
    const closeBtn = document.getElementById('plazaMapCloseBtn');
    const screen   = document.getElementById('plazaMapScreen');

    if (mapBtn)   mapBtn.addEventListener('click', openPlazaMap);
    if (closeBtn) closeBtn.addEventListener('click', closePlazaMap);

    // マップ背景タップで閉じる
    if (screen) {
      screen.addEventListener('click', (e) => {
        if (e.target === screen) closePlazaMap();
      });
    }

    // エリアボタン
    const areaButtons = {
      mapBtnStage:      'stage',
      mapBtnShop:       'shop',
      mapBtnRestaurant: 'restaurant',
      mapBtnPond:       'pond',
      mapBtnFlower:     'flower',
    };
    Object.entries(areaButtons).forEach(([id, dest]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => warpToArea(dest));
      // ホバー時に説明を表示
      const labels = {
        stage: '⚔️ 冒険の門 — ステージ選択へ',
        shop:  '🛍 商　店 — きがえ・クエスト・図鑑',
        restaurant: '🍜 食　堂 — 料理をする',
        pond:  '🎣 釣　場 — 魚を釣る',
        flower:'🌸 花　畑 — 花を摘む',
      };
      btn.addEventListener('mouseenter', () => {
        const desc = document.getElementById('plazaMapDesc');
        if (desc) desc.textContent = labels[dest] || '';
      });
      btn.addEventListener('mouseleave', () => {
        const desc = document.getElementById('plazaMapDesc');
        if (desc) desc.textContent = '行きたい場所をタップ！';
      });
    });
  }

  // DOMが既に読み込まれていれば即実行、なければ待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMapEvents);
  } else {
    bindMapEvents();
  }
})();

/** 広場表示/非表示に合わせてマップボタンを出し入れ */
function updateMapBtnVisibility() {
  const btn = document.getElementById('plazaMapBtn');
  if (!btn) return;
  const plazaVisible = dom.homePlazaScreen.classList.contains('visible');
  btn.style.display = plazaVisible ? 'flex' : 'none';
}

// ── サブエリア専用マップ構築 ──────────────────────────────────────

function setPondSceneVisible(visible) {
  if (plaza.pondSceneGroup) plaza.pondSceneGroup.visible = visible;
}

function setFlowerSceneVisible(visible) {
  if (plaza.flowerSceneGroup) plaza.flowerSceneGroup.visible = visible;
}

function buildPondScene() {
  plaza.pondSceneGroup = new THREE.Group();
  plaza.pondSceneGroup.visible = false;
  // ★修正: グループ自体はオフセットしない。
  //         checkFlowerProximity等のゲーム内判定は各メッシュの .position.x/z を
  //         そのままワールド座標として扱っているため、グループ側でオフセットすると
  //         見た目の位置と当たり判定の位置がズレてしまう。よって各オブジェクトの
  //         position.set()に直接 plaza.pondPos を加算する方式にする。
  three.scene.add(plaza.pondSceneGroup);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({ color: 0x4d9c4a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(plaza.pondPos.x, 0, plaza.pondPos.z);
  ground.receiveShadow = true;
  plaza.pondSceneGroup.add(ground);

  // 巨大な池
  const pond = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 0.4, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a9cd4, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 })
  );
  pond.position.set(plaza.pondPos.x, 0.2, plaza.pondPos.z);
  pond.receiveShadow = true;
  plaza.pondSceneGroup.add(pond);

  // 釣り桟橋
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5030, roughness: 0.9 })
  );
  dock.position.set(plaza.pondPos.x, 0.5, plaza.pondPos.z + 10);
  dock.castShadow = true;
  dock.receiveShadow = true;
  plaza.pondSceneGroup.add(dock);

  // 周囲の木々
  for (let i = 0; i < 40; i++) {
    const geo = new THREE.CylinderGeometry(0, 2 + Math.random(), 6 + Math.random() * 4, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2d6c2a, roughness: 0.9 });
    const tree = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 30;
    tree.position.set(plaza.pondPos.x + Math.cos(angle) * r, tree.geometry.parameters.height / 2, plaza.pondPos.z + Math.sin(angle) * r);
    tree.rotation.y = Math.random() * Math.PI;
    tree.castShadow = true;
    plaza.pondSceneGroup.add(tree);
  }
}

function buildFlowerScene() {
  plaza.flowerSceneGroup = new THREE.Group();
  plaza.flowerSceneGroup.visible = false;
  // ★修正: グループ自体はオフセットしない（理由はbuildPondSceneのコメント参照）。
  //         各花の position.set()に直接 plaza.flowerAreaPos を加算し、
  //         checkFlowerProximity/enterFlowerAreaのワールド座標判定と一致させる。
  three.scene.add(plaza.flowerSceneGroup);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({ color: 0x5dae5a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(plaza.flowerAreaPos.x, 0, plaza.flowerAreaPos.z);
  ground.receiveShadow = true;
  plaza.flowerSceneGroup.add(ground);

  // 大量の花
  // ★ サブエリア専用の花は plaza.flowerSceneField で管理（広場の plaza.flowerField とは分離）
  plaza.flowerSceneField = [];
  const colors = [0xff88cc, 0xffdd44, 0xaa66ff, 0xffbbdd, 0x88ccff];
  
  for (let i = 0; i < 150; i++) {
    // FLOWER_TYPESからランダムに選ぶ
    const rType = Math.random();
    let cumulative = 0;
    let type = FLOWER_TYPES[0];
    if (typeof FLOWER_TYPES !== 'undefined') {
      for (const ft of FLOWER_TYPES) {
        cumulative += ft.rarity;
        if (rType < cumulative) { type = ft; break; }
      }
    }
    const c = type.color;
    
    const geo = new THREE.SphereGeometry(0.35, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
    const fl = new THREE.Mesh(geo, mat);
    // 花畑エリアの中心付近に散らす（★修正: flowerAreaPosを加算してワールド座標に合わせる）
    const r = Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    fl.position.set(plaza.flowerAreaPos.x + Math.cos(angle) * r, 0.35, plaza.flowerAreaPos.z + Math.sin(angle) * r);
    fl.castShadow = true;
    fl.userData = { picked: false, baseColor: c, originalY: 0.35, flowerType: type, respawnTime: 0, phase: Math.random() * Math.PI * 2 };
    plaza.flowerSceneGroup.add(fl);
    plaza.flowerSceneField.push(fl); // サブエリア専用配列に登録
  }

  // 休憩ベンチ
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 1),
    new THREE.MeshStandardMaterial({ color: 0xa87858, roughness: 0.9 })
  );
  bench.position.set(plaza.flowerAreaPos.x, 0.6, plaza.flowerAreaPos.z + 6);
  bench.castShadow = true;
  plaza.flowerSceneGroup.add(bench);

  // 周囲の木々
  for (let i = 0; i < 30; i++) {
    const geo = new THREE.CylinderGeometry(0, 1.5, 5 + Math.random() * 3, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8dcc8a, roughness: 0.9 });
    const tree = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const r = 25 + Math.random() * 20;
    tree.position.set(plaza.flowerAreaPos.x + Math.cos(angle) * r, tree.geometry.parameters.height / 2, plaza.flowerAreaPos.z + Math.sin(angle) * r);
    tree.castShadow = true;
    plaza.flowerSceneGroup.add(tree);
  }
}