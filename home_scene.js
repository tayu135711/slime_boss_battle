/**
 * home_scene.js
 * ホーム広場のThree.jsシーン管理
 * - 噴水でHP/ゲージ回復
 * - NPCとのマルチページ会話
 */

const plaza = {
  ground: null,
  fountain: null,
  fountainPos: { x: 0, z: 0 },   // 噴水の中心座標
  buildings: [],
  playerMesh: null,
  initialized: false,
  sunLight: null,
  ambientLight: null,
  cobble: null,
  waterDrops: [],
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
const FOUNTAIN_INTERACT_RADIUS = 3.0;   // 噴水反応距離

// 会話状態
let plazaDialog = null;  // { npc, currentLineIndex, lines }

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
function initHomePlaza() {
  three.scene.background = new THREE.Color(0x87ceeb);
  three.scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

  if (!plaza.initialized) {
    buildPlazaScene();
    plaza.initialized = true;
  } else {
    setPlazaObjectsVisible(true);
  }

  setBattleObjectsVisible(false);
  if (three.sunLight) three.sunLight.visible = false;
  if (three.ambientLight) three.ambientLight.visible = false;

  plazaPlayer.x = 0;
  plazaPlayer.z = 0;
  updatePlazaCameraFollow();

  npcState.forEach(npc => { npc.waitUntil = Date.now() + 1000; });
  closeNpcDialog();   // 念のため閉じる
}

// ─────────────────────────────────────────
// 広場シーン構築（変更なし）
// ─────────────────────────────────────────
function buildPlazaScene() {
  plaza.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  plaza.sunLight.position.set(10, 20, 10);
  plaza.sunLight.castShadow = true;
  three.scene.add(plaza.sunLight);

  plaza.ambientLight = new THREE.AmbientLight(0xd0e8ff, 0.7);
  three.scene.add(plaza.ambientLight);

  plaza.ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.9 })
  );
  plaza.ground.rotation.x = -Math.PI / 2;
  plaza.ground.receiveShadow = true;
  three.scene.add(plaza.ground);

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
// 噴水（変更なし、位置情報を保存）
// ─────────────────────────────────────────
function buildFountain() {
  const group = new THREE.Group();
  // ...（既存の噴水ジオメトリ作成。変更不要）
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 }));
  base.position.y = 0.2;
  group.add(base);
  const basin = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.25, 8, 24), new THREE.MeshStandardMaterial({ color: 0x90c0e0, roughness: 0.3, metalness: 0.2 }));
  basin.rotation.x = -Math.PI / 2; basin.position.y = 0.5;
  group.add(basin);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xd0c0b0, roughness: 0.7 }));
  pillar.position.y = 1.1; group.add(pillar);
  const topDish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xe0d0c0, roughness: 0.8 }));
  topDish.position.y = 1.85; group.add(topDish);
  plaza.waterDrops = [];
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.75 }));
    const angle = (i / 8) * Math.PI * 2;
    drop.userData.angle = angle; drop.userData.phase = (i / 8) * Math.PI * 2;
    drop.position.set(Math.cos(angle) * 0.4, 2.0, Math.sin(angle) * 0.4);
    group.add(drop);
    plaza.waterDrops.push(drop);
  }
  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.fountain = group;
  plaza.fountainPos = { x: 0, z: 0 };  // 噴水の中心
}

// ─────────────────────────────────────────
// 建物、NPC、プレイヤー（変更なし）
// ─────────────────────────────────────────
function buildPlazaBuildings() {
  PLAZA_BUILDINGS.forEach(def => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 }));
    body.position.y = 2; body.castShadow = true; group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 }));
    roof.position.y = 5; roof.rotation.y = Math.PI / 4; group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x3d1a00, roughness: 0.9 }));
    door.position.set(0, 1.0, 2.06); group.add(door);
    group.position.set(def.x, 0, def.z);
    three.scene.add(group);
    plaza.buildings.push({ mesh: group, ...def });
  });
}

function buildPlazaNPCs() {
  npcState.forEach(npc => {
    const costume = COSTUMES.find(c => c.id === npc.costumeId) || COSTUMES[0];
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 14), new THREE.MeshStandardMaterial({ color: costume.color, roughness: 0.5 }));
    body.position.y = 0.45; body.castShadow = true;
    addSlimeFace(body, 0.45, 0.2);
    group.add(body);
    group.position.set(npc.x, 0, npc.z);
    three.scene.add(group);
    npc.mesh = group;
  });
}

function buildPlazaPlayer() {
  const group = new THREE.Group();
  const color = state.equippedCostume ? state.equippedCostume.color : CONFIG.player.color;
  const body = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.player.radius, 16, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  body.position.y = CONFIG.player.radius; body.castShadow = true;
  addSlimeFace(body, CONFIG.player.radius, 0.2);
  group.add(body);
  group.position.set(0, 0, 0);
  three.scene.add(group);
  plaza.playerMesh = group;
}

// ─────────────────────────────────────────
// 更新（game.js から呼ばれる）
// ─────────────────────────────────────────
function updateHomePlazaLoop() {
  updatePlazaPlayer();
  updatePlazaNPCs();
  updateFountain();
  checkPlazaEntrances();
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
  three.camera.position.set(plazaPlayer.x, 8.0, plazaPlayer.z + 11.0);
  three.camera.lookAt(plazaPlayer.x, 0.5, plazaPlayer.z - 1.5);
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
      if (npc.conditionalLines && npc.conditionalLines.length > 0) {
        for (const cond of npc.conditionalLines) {
          if (cond.condition()) { line = cond.line; break; }
        }
      }
      if (!line && npc.lines && npc.lines.length > 0) {
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

// ─────────────────────────────────────────
// インタラクション判定
// ─────────────────────────────────────────
let plazaNearBuilding = null;
let plazaNearNPC = null;
let plazaNearFountain = false;

function checkPlazaEntrances() {
  plazaNearBuilding = null;
  plazaNearNPC = null;
  plazaNearFountain = false;

  // 建物チェック
  for (const b of plaza.buildings) {
    const dist = Math.hypot(plazaPlayer.x - b.x, plazaPlayer.z - b.z);
    if (dist < PLAZA_ENTER_RADIUS) {
      plazaNearBuilding = b;
      break;
    }
  }

  // NPCチェック（建物より優先しないが、別枠で記録）
  for (const npc of npcState) {
    const dist = Math.hypot(plazaPlayer.x - npc.x, plazaPlayer.z - npc.z);
    if (dist < NPC_TALK_RADIUS) {
      plazaNearNPC = npc;
      break;
    }
  }

  // 噴水チェック
  const fdist = Math.hypot(plazaPlayer.x - plaza.fountainPos.x, plazaPlayer.z - plaza.fountainPos.z);
  plazaNearFountain = fdist < FOUNTAIN_INTERACT_RADIUS;

  // プロンプト表示
  if (plazaNearBuilding) {
    dom.plazaActionPrompt.textContent = `Ａ で「${plazaNearBuilding.label}」に入る`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearNPC) {
    dom.plazaActionPrompt.textContent = `Ａ ではなしかける`;
    dom.plazaActionPrompt.classList.add("visible");
  } else if (plazaNearFountain) {
    dom.plazaActionPrompt.textContent = `Ａ で回復する`;
    dom.plazaActionPrompt.classList.add("visible");
  } else {
    dom.plazaActionPrompt.classList.remove("visible");
  }
}

// ─────────────────────────────────────────
// アクション実行
// ─────────────────────────────────────────
function handlePlazaAction() {
  if (plazaDialog) {
    advanceDialog();   // 会話中なら次ページへ
    return;
  }

  if (plazaNearBuilding) {
    if (plazaNearBuilding.type === "stage") {
      exitHomePlaza();
      showStageSelect();
    } else {
      showComingSoon(plazaNearBuilding.label);
    }
  } else if (plazaNearNPC) {
    startNPCConversation(plazaNearNPC);
  } else if (plazaNearFountain) {
    recoverAtFountain();
  }
}

// ─────────────────────────────────────────
// 噴水回復
// ─────────────────────────────────────────
function recoverAtFountain() {
  state.player.hp = CONFIG.player.maxHp;
  state.specialGauge = 100;
  dom.statusLine.textContent = "💧 噴水の力で全回復した！";
  setTimeout(() => { dom.statusLine.textContent = ""; }, 2000);
  refreshUi();
  // エフェクト：一瞬光る（適宜追加）
}

// ─────────────────────────────────────────
// NPC会話システム
// ─────────────────────────────────────────
function startNPCConversation(npc) {
  // 会話用のセリフを用意（条件付き→通常→デフォルト）
  let lines = [];
  if (npc.conditionalLines && npc.conditionalLines.length > 0) {
    const condLine = npc.conditionalLines.find(c => c.condition());
    if (condLine) lines = [condLine.line];
  }
  if (lines.length === 0 && npc.lines && npc.lines.length > 0) {
    lines = npc.lines.slice(); // 全行コピー
  }
  if (lines.length === 0) lines = [npc.line || "…"];

  plazaDialog = {
    npc: npc,
    currentLineIndex: 0,
    lines: lines,
  };

  // NPCの名前を表示（仮に costumeId から取得）
  const costume = COSTUMES.find(c => c.id === npc.costumeId);
  const npcName = costume ? costume.name : "???";
  dom.npcDialogName.textContent = npcName;

  showDialogLine();
  dom.npcDialog.classList.add("visible");
}

function showDialogLine() {
  if (!plazaDialog) return;
  const line = plazaDialog.lines[plazaDialog.currentLineIndex];
  dom.npcDialogText.textContent = line;
  // 最終ページならボタンのテキスト変更
  if (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) {
    dom.npcDialogNext.textContent = "閉じる";
  } else {
    dom.npcDialogNext.textContent = "次へ ▶";
  }
}

function advanceDialog() {
  if (!plazaDialog) return;
  if (plazaDialog.currentLineIndex >= plazaDialog.lines.length - 1) {
    closeNpcDialog();
    return;
  }
  plazaDialog.currentLineIndex++;
  showDialogLine();
}

function closeNpcDialog() {
  plazaDialog = null;
  dom.npcDialog.classList.remove("visible");
}

// ─────────────────────────────────────────
// 広場退出（変更なし）
// ─────────────────────────────────────────
function exitHomePlaza() {
  dom.homePlazaScreen.classList.remove("visible");
  dom.npcBubble.classList.remove("visible");
  dom.plazaActionPrompt.classList.remove("visible");
  closeNpcDialog();   // 会話も閉じる
  setPlazaObjectsVisible(false);
  setBattleObjectsVisible(true);
  if (three.sunLight) three.sunLight.visible = true;
  if (three.ambientLight) three.ambientLight.visible = true;
  const s0 = getCurrentStage(state.stageIndex);
  three.scene.background = new THREE.Color(s0.bgColor);
  three.scene.fog = new THREE.FogExp2(s0.bgColor, s0.fogDensity);
  updateCameraFollow();
}

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

function setBattleObjectsVisible(visible) {
  if (three.bossGroup)   three.bossGroup.visible = visible;
  if (three.playerGroup) three.playerGroup.visible = visible;
  if (three.rangeRing)   three.rangeRing.visible = visible;
  if (three.bossLight)   three.bossLight.visible = visible;
}

// npcDialogの次へボタンのイベント（game.js の setupInput に追加するか、ここで直接登録）
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('npcDialogNext')?.addEventListener('click', advanceDialog);
});