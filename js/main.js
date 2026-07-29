/* =========================================================
   main.js — メインシーン初期化・プレイヤー制御・メインループ
   依存: 全JSファイル
   読み込み順: config.js → models.js → maze.js → party.js → island.js → battle.js → main.js
========================================================= */

/* ---------------------------------------------------------
   メインシーン (フィールド)
--------------------------------------------------------- */
const container = document.getElementById('canvas-container');
const scene     = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0e8);
scene.fog        = new THREE.Fog(0x8fd0e8, 30, 70);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

/* ---------------------------------------------------------
   ポストプロセス(ブルーム)
   捕獲マーカー・炎などの明るい"発光"素材だけをふわっと光らせる。
   閾値を高めにして、空や地面などの中間輝度までは光らないよう絞っている。
--------------------------------------------------------- */
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.35,  // radius
  0.82   // threshold — 空の輝度(約0.77)より上、黄色いマーカー等(約0.88)より下に設定
);
composer.addPass(bloomPass);

/* ---------------------------------------------------------
   ライティング
--------------------------------------------------------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff6e0, 0.9);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left   = -30; sun.shadow.camera.right  = 30;
sun.shadow.camera.top    =  30; sun.shadow.camera.bottom = -30;
scene.add(sun);

/** 迷路(暗い洞窟)の雰囲気から、明るい屋外の雰囲気に戻す */
function resetFieldAtmosphere() {
  scene.fog.color.setHex(0x8fd0e8);
  scene.fog.near = 30;
  scene.fog.far  = 70;
  scene.background.setHex(0x8fd0e8);
  hemi.intensity = 0.9;
  sun.intensity  = 0.9;
}

/* ---------------------------------------------------------
   地面
--------------------------------------------------------- */
const groundGeo = new THREE.PlaneGeometry(70, 70, 20, 20);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, flatShading: true });
const ground    = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x  = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ---------------------------------------------------------
   プレイヤー (トレーナーモデル)
--------------------------------------------------------- */
const player = buildTrainerModel();
player.position.set(0, 0, 0);
scene.add(player);

let playerAngle = 0;

/* ---------------------------------------------------------
   キー入力
--------------------------------------------------------- */
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true;  });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

/* ---------------------------------------------------------
   スマホ向け仮想十字キー (2026/07/26 追加)
   タッチ/マウスどちらでも同じkeysオブジェクトを操作するので、
   移動ロジック側は一切変更しなくて済む。
--------------------------------------------------------- */
document.querySelectorAll('.dpad-btn').forEach(btn => {
  const key = btn.dataset.key;
  const press   = (e) => { e.preventDefault(); keys[key] = true; };
  const release = (e) => { e.preventDefault(); keys[key] = false; };
  btn.addEventListener('touchstart', press,   { passive: false });
  btn.addEventListener('touchend',   release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup',   release);
  btn.addEventListener('mouseleave', release);
});

/* ---------------------------------------------------------
   ウィンドウリサイズ
--------------------------------------------------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  resizeBattleCanvas();
  resizeIslandCanvas();
});

/* ---------------------------------------------------------
   カメラ追従 (フィールド見下ろし)
--------------------------------------------------------- */
function updateCamera() {
  const camOffset = new THREE.Vector3(0, 9, 7);
  const targetPos = player.position.clone().add(camOffset);
  // フィールド移動中の追従遅れによる画面の揺れをなくし、常に一定の視点で追従する。
  camera.position.copy(targetPos);
  camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
}

/* ---------------------------------------------------------
   丸型障害物との衝突判定 (現状は装飾岩のみ使用)
--------------------------------------------------------- */
function checkCollision(x, z, radius) {
  for (const o of obstacles) {
    if (Math.hypot(x - o.x, z - o.z) < radius + o.r) return true;
  }
  return false;
}

/* ---------------------------------------------------------
   メインアニメーションループ
--------------------------------------------------------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (titleScreenOpen) {
    // タイトル画面表示中は入力を受け付けず、島マップを背景として映すだけにする
    window.islandRenderer?.render(window.islandScene, window.islandCamera);
    return;
  }

  const islandVisible = document.getElementById('island-overlay')?.style.display !== 'none';
  const shopVisible   = document.getElementById('shop-screen')?.style.display === 'block';
  if (islandVisible) {
    // 島マップ
    if (typeof window.updateIslandPlayer === 'function') window.updateIslandPlayer(dt);
    window.islandRenderer?.render(window.islandScene, window.islandCamera);

  } else if (shopVisible) {
    // どうぐや (2026/07/27 追加: 画面遷移した専用シーン)
    if (typeof window.updateSweetPotatoIdle === 'function') window.updateSweetPotatoIdle(dt);
    window.shopRenderer?.render(window.shopScene, window.shopCamera);

  } else if (gateConfirmOpen || chestConfirmOpen || dialogueOpen) {
    // ゲート/宝箱/会話の確認ダイアログ表示中は操作を止める(演出・カメラはそのまま)

  } else if (!battleState) {
    // フィールド探索
    if (typeof regenStamina === 'function') regenStamina();
    if (typeof updateChestAnimations === 'function') updateChestAnimations();
    let dx = 0, dz = 0;
    if (keys['w'] || keys['arrowup'])    dz -= 1;
    if (keys['s'] || keys['arrowdown'])  dz += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len; dz /= len;
      const nx = player.position.x + dx * PLAYER_SPEED * dt;
      const nz = player.position.z + dz * PLAYER_SPEED * dt;
      if (!checkCollision(nx, nz, 0.5) && !collidesWithWalls(nx, nz, 0.4)) {
        player.position.x = nx;
        player.position.z = nz;
      }
      playerAngle      = Math.atan2(dx, dz);
      player.rotation.y = playerAngle;
    }
    updateWalkAnimation(player, dt, dx !== 0 || dz !== 0);
    updateFieldFollowers(dt);
    updateTorches();
    updateHealSpots();
    updateHealSpotTrigger();
    // 2026/07/27 修正(重要バグ): 隠し要素(Zキーで調べる宝箱・モンスター)の
    // 更新関数がどこからも呼ばれておらず、機能していなかった。ここで呼び出す。
    if (typeof updateStageInteractables === 'function') updateStageInteractables(dt);
    updateExploration();

    if (currentMapMode === 'stage' && bossGate && !bossGate.triggered && !bossGate.promptOpen) {
      const gateDist = Math.hypot(player.position.x - bossGate.x, player.position.z - bossGate.z);
      if (gateDist < 2.0 && !bossGate.promptAnswered) {
        showGateConfirm();
      } else if (gateDist > 3.2 && bossGate.promptAnswered) {
        bossGate.promptAnswered = false; // 十分離れたら再度たずねられるようにする
      }
    }

    // 敵のAI (彺徨 + 追跡 + エンカウント)
    const WANDER_SPEED = 0.72;  // ターン制の間合いを壊さない緩やかな徘徊
    const CHASE_SPEED  = 1.65;  // 視界に入った時だけ、ゆっくり追跡

    for (const e of enemies) {
      if (!e.alive) continue;

      const distToPlayer = Math.hypot(
        player.position.x - e.mesh.position.x,
        player.position.z - e.mesh.position.z
      );
      // 敵の正面の視界 cone + 壁チェック。壁越し・背後からは追跡しない。
      const toPlayer = new THREE.Vector3(
        player.position.x - e.mesh.position.x, 0,
        player.position.z - e.mesh.position.z
      );
      const dirLen = toPlayer.length();
      const facing = new THREE.Vector3(Math.sin(e.mesh.rotation.y), 0, Math.cos(e.mesh.rotation.y));
      const inVisionCone = dirLen > 0.01 && facing.dot(toPlayer.clone().normalize()) >= (e.visionAngle || Math.cos(Math.PI * 0.34));
      const canSeePlayer = !e.isGuardBoss && dirLen <= (e.visionRange || 8.5) && inVisionCone && isLineOfSightClear(
        e.mesh.position.x, e.mesh.position.z, player.position.x, player.position.z
      );
      // 一度見つけた敵は、視界から少し外れても近距離だけ追跡を維持する。
      const isChasing = canSeePlayer || (e.wasChasing && dirLen < 3.6 && isLineOfSightClear(
        e.mesh.position.x, e.mesh.position.z, player.position.x, player.position.z
      ));

      // 追跡モードの記憶が切り替わったときに「！」マーカーを切り替える
      if (isChasing !== e.wasChasing) {
        e.wasChasing = isChasing;
        // 追跡開始: マーカーを赤い山に
        if (e.mesh.userData.chaseMarker) {
          e.mesh.userData.chaseMarker.visible = isChasing;
          e.mesh.userData.chaseMarker.material.color.setHex(
            isChasing ? 0xff2020 : 0xffe45e
          );
        }
      }

      if (isChasing) {
        // === 追跡モード: プレイヤーに向かって突進 ===
        e.wanderTimer = 0; // 彺徨タイマーリセット
        const dir = new THREE.Vector3(
          player.position.x - e.mesh.position.x,
          0,
          player.position.z - e.mesh.position.z
        );
        if (dir.length() > 0.1) {
          dir.normalize();
          const enx = e.mesh.position.x + dir.x * CHASE_SPEED * dt;
          const enz = e.mesh.position.z + dir.z * CHASE_SPEED * dt;
          if (!collidesWithWalls(enx, enz, 0.65) && isLineOfSightClear(
            enx, enz, player.position.x, player.position.z
          )) {
            e.mesh.position.x = enx;
            e.mesh.position.z = enz;
          } else {
            // 壁に当たったとき: 少し横に逃げて持って再追跡
            const perp = new THREE.Vector3(-dir.z, 0, dir.x);
            const side = Math.random() < 0.5 ? 1 : -1;
            const ex2  = e.mesh.position.x + perp.x * side * CHASE_SPEED * dt;
            const ez2  = e.mesh.position.z + perp.z * side * CHASE_SPEED * dt;
          if (!collidesWithWalls(ex2, ez2, 0.65) && isLineOfSightClear(
            ex2, ez2, player.position.x, player.position.z
          )) {
              e.mesh.position.x = ex2;
              e.mesh.position.z = ez2;
            }
          }
          e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      } else if (!e.isGuardBoss) {
        // === 彺徨モード: 従来通りにランダム彺徨 ===
        e.wanderTimer -= dt;
        if (e.wanderTimer <= 0) {
          e.wanderTimer = 2 + Math.random() * 3;
          e.wanderTarget.set(
            e.mesh.position.x + (Math.random() - 0.5) * 6,
            0,
            e.mesh.position.z + (Math.random() - 0.5) * 6
          );
        }
        const dir = new THREE.Vector3(
          e.wanderTarget.x - e.mesh.position.x,
          0,
          e.wanderTarget.z - e.mesh.position.z
        );
        if (dir.length() > 0.1) {
          dir.normalize();
          const enx = e.mesh.position.x + dir.x * WANDER_SPEED * dt;
          const enz = e.mesh.position.z + dir.z * WANDER_SPEED * dt;
          if (!collidesWithWalls(enx, enz, 0.65)) {
            e.mesh.position.x = enx;
            e.mesh.position.z = enz;
          } else {
            e.wanderTimer = 0; // 壁衝突 → 次フレームで新目標を選択
          }
          e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }

      // 敷波浮遊 (Y軍バウンス)
      e.mesh.position.y = Math.sin(performance.now() / 400 + e.mesh.id) * 0.08;

      // エンカウント判定 (戦闘終了直後の猶予中は発生しない)
      if (distToPlayer < ENCOUNTER_DIST && performance.now() > encounterGraceUntil) triggerEncounter(e);
    }

    // 宝箱: 近づいたら自動で開けず、「あけますか？」を確認する (2026/07/25 修正)
    if (!chestConfirmOpen) {
      for (const chest of chests) {
        if (chest.opened) continue;
        const cd = Math.hypot(
          player.position.x - chest.mesh.position.x,
          player.position.z - chest.mesh.position.z
        );
        if (cd < 1.4 && !chest.promptAnswered) {
          showChestConfirm(chest);
          break;
        } else if (cd > 2.2 && chest.promptAnswered) {
          chest.promptAnswered = false; // 十分離れたら再度たずねられるようにする
        }
      }
    }

  } else {
    // バトル中
    updateAttackMotions();
    if (typeof updateLockOnReticle === 'function') updateLockOnReticle();
    battleRenderer.render(battleScene, battleCamera);
  }

  updateCamera();
  composer.render();
}

/* ---------------------------------------------------------
   エンカウント演出: 暗転フラッシュ + 「！」
--------------------------------------------------------- */
const encounterFlashEl = document.getElementById('encounter-flash');
let encounterLocked = false; // エンカウント連発防止フラグ

function triggerEncounter(e) {
  if (encounterLocked) return;
  encounterLocked = true;
  // 暗転フラッシュ
  if (encounterFlashEl) {
    encounterFlashEl.style.opacity = '0.85';
    setTimeout(() => {
      encounterFlashEl.style.opacity = '0';
    }, 160);
  }
  // 少し遅らせてバトル開始
  setTimeout(() => {
    startBattle(e);
    encounterLocked = false;
  }, 120);
}

/**
 * 「にげる」成功時に、その敵をプレイヤーから引き離す (2026/07/24 追加)
 * 戦闘終了直後にすぐ同じ敵とまたエンカウントしてしまう問題への対応。
 * 追跡状態もリセットするので、しばらくは追ってこない。
 */
function pushEnemyAway(enemy) {
  if (!enemy || !enemy.mesh) return;
  const dx  = enemy.mesh.position.x - player.position.x;
  const dz  = enemy.mesh.position.z - player.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx  = enemy.mesh.position.x + (dx / len) * FLEE_PUSHBACK_DIST;
  const nz  = enemy.mesh.position.z + (dz / len) * FLEE_PUSHBACK_DIST;
  if (!collidesWithWalls(nx, nz, 0.65)) {
    enemy.mesh.position.x = nx;
    enemy.mesh.position.z = nz;
  }
  enemy.wasChasing  = false;
  enemy.wanderTimer = 1.5 + Math.random(); // すぐには新しい徘徊行動を始めない
  if (enemy.mesh.userData.chaseMarker) {
    enemy.mesh.userData.chaseMarker.visible = false;
  }
}

/* ---------------------------------------------------------
   ボスの間ゲート確認ダイアログ (2026/07/24 追加)
   以前は門に近づくと自動でボスの間に遷移していたが、
   「戻れません」という重要な選択を無警告で確定させてしまうのは
   親切でないため、はい/いいえを選べるようにした。
--------------------------------------------------------- */
let gateConfirmOpen = false;
const gateConfirmPanel = document.getElementById('gate-confirm-panel');
const btnGateYes = document.getElementById('btn-gate-yes');
const btnGateNo  = document.getElementById('btn-gate-no');

function showGateConfirm() {
  if (!bossGate) return;
  bossGate.promptOpen = true;
  gateConfirmOpen = true;
  const titleEl = document.getElementById('gate-confirm-title');
  const descEl  = document.getElementById('gate-confirm-desc');
  if (titleEl) titleEl.textContent = bossGate.label || 'ボスの間へ すすみますか？';
  if (descEl)  descEl.textContent  = bossGate.desc  || 'この先に入ると、たおすまで もどれません';
  if (gateConfirmPanel) gateConfirmPanel.style.display = 'block';
}

function hideGateConfirm() {
  gateConfirmOpen = false;
  if (bossGate) bossGate.promptOpen = false;
  if (gateConfirmPanel) gateConfirmPanel.style.display = 'none';
}

if (btnGateYes) {
  btnGateYes.addEventListener('click', () => {
    if (!bossGate) return;
    const action = bossGate.nextAction;
    bossGate.triggered = true;
    hideGateConfirm();
    setTimeout(() => {
      if (battleState) return;
      if (typeof action === 'function') action();
    }, 300);
  });
}

if (btnGateNo) {
  btnGateNo.addEventListener('click', () => {
    if (bossGate) bossGate.promptAnswered = true; // 離れるまでは再度たずねない
    hideGateConfirm();
  });
}

/* ---------------------------------------------------------
   宝箱を開けるか確認するダイアログ (2026/07/25 追加)
   以前は近づくだけで自動的に開封していたが、「あけますか？」を
   選べるようにして誤操作を防ぐ。
--------------------------------------------------------- */
let chestConfirmOpen = false;
let pendingChest = null;
const chestConfirmPanel = document.getElementById('chest-confirm-panel');
const btnChestYes = document.getElementById('btn-chest-yes');
const btnChestNo  = document.getElementById('btn-chest-no');

function showChestConfirm(chest) {
  pendingChest = chest;
  chest.promptOpen = true;
  chestConfirmOpen = true;
  if (chestConfirmPanel) chestConfirmPanel.style.display = 'block';
}

function hideChestConfirm() {
  chestConfirmOpen = false;
  if (pendingChest) pendingChest.promptOpen = false;
  if (chestConfirmPanel) chestConfirmPanel.style.display = 'none';
  pendingChest = null;
}

if (btnChestYes) {
  btnChestYes.addEventListener('click', () => {
    const chest = pendingChest;
    hideChestConfirm();
    if (chest && !chest.opened) openChest(chest);
  });
}

if (btnChestNo) {
  btnChestNo.addEventListener('click', () => {
    if (pendingChest) pendingChest.promptAnswered = true; // 離れるまでは再度たずねない
    hideChestConfirm();
  });
}

/* ---------------------------------------------------------
   タイトル画面 (2026/07/26 追加)
   「はじめから」「つづきから」を選ぶまでゲームを開始しない。
   セーブデータが無い場合は「つづきから」を押せないようにする。
--------------------------------------------------------- */
let titleScreenOpen = true;
const titleScreenEl   = document.getElementById('title-screen');
const btnTitleNew      = document.getElementById('btn-title-new');
const btnTitleContinue = document.getElementById('btn-title-continue');

if (typeof playBgm === 'function') playBgm(BGM_PATHS.title);

if (btnTitleContinue) {
  btnTitleContinue.disabled = !(typeof hasSaveData === 'function' && hasSaveData());
}

function closeTitleScreen() {
  titleScreenOpen = false;
  if (titleScreenEl) titleScreenEl.style.display = 'none';
}

if (btnTitleNew) {
  btnTitleNew.addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.menu();
    const proceed = (!btnTitleContinue || btnTitleContinue.disabled)
      ? true
      : confirm('セーブデータを けして、はじめから あそびますか？');
    if (!proceed) return;
    if (typeof deleteSave === 'function') deleteSave();
    if (typeof storyFlags !== 'undefined') storyFlags = {}; // ストーリーの既読フラグもリセット
    closeTitleScreen();
    if (typeof openIslandOverlay === 'function') openIslandOverlay();
    // オープニングの会話 (2026/07/26 追加)
    if (typeof showDialogue === 'function' && STORY.opening) {
      setTimeout(() => showDialogue(STORY.opening), 400);
    }
  });
}

if (btnTitleContinue) {
  btnTitleContinue.addEventListener('click', () => {
    if (btnTitleContinue.disabled) return;
    if (typeof SFX !== 'undefined') SFX.menu();
    if (typeof loadGame === 'function') loadGame(false);
    closeTitleScreen();
    if (typeof openIslandOverlay === 'function') openIslandOverlay();
  });
}

/* ---------------------------------------------------------
   起動
--------------------------------------------------------- */
animate();
