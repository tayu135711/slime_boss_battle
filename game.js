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


function updateCameraFollow() {
  const { offsetY, offsetZ, lookAtY, lookAtZAhead } = CONFIG.camera;
  three.camera.position.set(state.player.x, offsetY, state.player.z + offsetZ);
  three.camera.lookAt(state.player.x, lookAtY, state.player.z + lookAtZAhead);
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