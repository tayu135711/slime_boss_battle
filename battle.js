/**
 * battle.js
 * 戦闘ロジック・ボスAI・エフェクト・プレイヤー被弾
 * 依存: state, three, dom, CONFIG, STAGES, getCurrentStage
 */

// ============================================================
// 攻撃モーション
// ============================================================

/**
 * デフォルト：体当たりダッシュ
 * ボス方向へぐっと突進して即戻る。
 * playerGroupのpositionをオフセットで動かす。
 */
function startDashAttack() {
  if (!three.dashAttack) return;
  three.dashAttack.active   = true;
  three.dashAttack.progress = 0;
  // 突進方向（プレイヤー → ボス）を正規化して保存
  const dx = state.boss.x - state.player.x;
  const dz = state.boss.z - state.player.z;
  const len = Math.hypot(dx, dz) || 1;
  three.dashAttack.dirX = dx / len;
  three.dashAttack.dirZ = dz / len;
}

function updateDashAttack() {
  if (!three.dashAttack || !three.dashAttack.active) return;
  three.dashAttack.progress += 0.09;
  const t = three.dashAttack.progress;
  // 0→0.4: 突進（イーズイン）  0.4→1.0: 戻り（イーズアウト）
  let offset, squishX, squishY;
  if (t < 0.4) {
    const s = t / 0.4;
    offset  = s * s * 0.55;          // 最大0.55ユニット前に出る
    squishX = 1.0 + s * 0.25;        // 横に膨らむ
    squishY = 1.0 - s * 0.18;        // 縦につぶれる
  } else {
    const s = (t - 0.4) / 0.6;
    offset  = (1 - s) * 0.55;
    squishX = 1.25 - s * 0.25;
    squishY = 0.82 + s * 0.18;
  }
  // playerGroupのベース位置にオフセットを加算
  three.playerGroup.position.set(
    state.player.x + three.dashAttack.dirX * offset,
    0,
    state.player.z + three.dashAttack.dirZ * offset
  );
  // 体がぷにっとつぶれる
  three.playerGroup.scale.set(squishX, squishY, squishX);

  if (t >= 1.0) {
    three.dashAttack.active = false;
    three.playerGroup.position.set(state.player.x, 0, state.player.z);
    three.playerGroup.scale.set(1, 1, 1);
  }
}

/**
 * ナイトスライム：剣スイング（従来の実装を温存）
 */
function startSwordSwing() {
  if (!three.swordPivot) return;
  three.swordSwing.active   = true;
  three.swordSwing.progress = 0;
}

function updateSwordSwing() {
  if (!three.swordSwing || !three.swordSwing.active) return;
  three.swordSwing.progress += 0.06;
  const t = three.swordSwing.progress;
  let angle;
  if      (t < 0.3) angle = (t / 0.3) * 1.2;
  else if (t < 0.8) angle = 1.2 - ((t - 0.3) / 0.5) * 3.2;
  else              angle = -2.0 + ((t - 0.8) / 0.2) * 2.0;
  three.swordPivot.rotation.z = angle;
  if (t >= 1.0) {
    three.swordSwing.active = false;
    three.swordPivot.rotation.z = 0;
  }
}

/**
 * スライムスピア：槍突き
 * spearPivotをZ軸方向にぐっと突き出して戻す。
 */
function startSpearThrust() {
  if (!three.spearPivot) return;
  three.spearThrust.active   = true;
  three.spearThrust.progress = 0;
}

function updateSpearThrust() {
  if (!three.spearThrust || !three.spearThrust.active) return;
  three.spearThrust.progress += 0.08;
  const t = three.spearThrust.progress;
  let zOffset;
  if (t < 0.35)      zOffset = -(t / 0.35) * 0.7;   // 前に突き出す
  else if (t < 0.55) zOffset = -0.7;                  // 止める
  else               zOffset = -0.7 + ((t - 0.55) / 0.45) * 0.7;  // 引く
  three.spearPivot.position.z = zOffset;
  if (t >= 1.0) {
    three.spearThrust.active = false;
    three.spearPivot.position.z = 0;
  }
}

// ============================================================
// 魔法陣エフェクト
// ============================================================
function spawnMagicCircle() {
  const group = new THREE.Group();
  group.position.set(state.player.x, 0.05, state.player.z);
  three.scene.add(group);
  three.magicCircles.push(group);
  group.userData.cancelled = false;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.15, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  outerRing.rotation.x = -Math.PI / 2;
  group.add(outerRing);

  const midRing = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.72, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  midRing.rotation.x = -Math.PI / 2;
  group.add(midRing);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.35, 32),
    new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  innerRing.rotation.x = -Math.PI / 2;
  group.add(innerRing);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 6.0, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xeeeeff, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
  );
  pillar.position.y = 3.0;
  group.add(pillar);

  const glow = new THREE.PointLight(0xaaddff, 0, 5);
  glow.position.y = 1.5;
  group.add(glow);

  let frame = 0;
  const totalFrames = 80;
  function animateMagicCircle() {
    if (group.userData.cancelled) return;
    frame++;
    const t = frame / totalFrames;
    let opacity;
    if      (t < 0.25) opacity = t / 0.25;
    else if (t < 0.7)  opacity = 1.0;
    else               opacity = 1.0 - (t - 0.7) / 0.3;
    outerRing.material.opacity = opacity * 0.85;
    midRing.material.opacity   = opacity * 0.9;
    innerRing.material.opacity = opacity * 0.9;
    const pillarT = Math.max(0, (t - 0.15) / 0.3);
    pillar.material.opacity = Math.min(pillarT, 1.0 - Math.max(0, (t - 0.65) / 0.35)) * 0.35;
    glow.intensity = Math.min(pillarT, 1.0 - Math.max(0, (t - 0.65) / 0.35)) * 2.5;
    outerRing.rotation.z +=  0.04;
    innerRing.rotation.z -= 0.07;
    const scale = t < 0.2 ? 0.5 + (t / 0.2) * 0.6 : 1.1 - (t - 0.2) * 0.1;
    group.scale.set(scale, 1, scale);
    if (frame < totalFrames) {
      requestAnimationFrame(animateMagicCircle);
    } else {
      three.scene.remove(group);
      [outerRing, midRing, innerRing, pillar].forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      group.remove(glow);
      const idx = three.magicCircles.indexOf(group);
      if (idx !== -1) three.magicCircles.splice(idx, 1);
    }
  }
  requestAnimationFrame(animateMagicCircle);
}

// ============================================================
// ダメージ数字・ヒットエフェクト
// ============================================================
function getBossScreenPos() {
  const { w, h } = getSize();
  const v = new THREE.Vector3(state.boss.x, getCurrentStage(state.stageIndex).radius * 1.5, state.boss.z);
  v.project(three.camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
}

function spawnDamageNumber(damage, isCrit) {
  const pos = getBossScreenPos();
  const el  = document.createElement("div");
  el.className = "damage-number" + (isCrit ? " critical" : "");
  el.textContent = isCrit ? `⚡${damage}!!` : damage;
  el.style.left = (pos.x + (Math.random() - 0.5) * 50) + "px";
  el.style.top  = (pos.y + (Math.random() - 0.5) * 24) + "px";
  dom.sceneContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function flashBossHit(ms = 120) {
  three.bossMat.color.set(getCurrentStage(state.stageIndex).hitColor);
  setTimeout(() => three.bossMat.color.set(getCurrentStage(state.stageIndex).color), ms);
}

function triggerCameraShake() {
  const el = dom.sceneContainer;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), CONFIG.camera.shakeMs);
}

// ============================================================
// 通常攻撃・必殺技
// ============================================================
function isInAttackRange() {
  return Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z) <= CONFIG.battle.attackRange;
}

function attackBoss() {
  if (!state.battleStarted || state.cleared || state.gameOver || !isInAttackRange()) return;
  const now = Date.now();
  if (now - state.lastAttackAt < CONFIG.battle.attackCooldownMs) return;
  state.lastAttackAt = now;

  const { minDamage, maxDamage, criticalThreshold, specialGaugePerHit } = CONFIG.battle;
  const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
  const isCrit = damage >= criticalThreshold;

  state.currentHp    = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = Math.min(100, state.specialGauge + specialGaugePerHit);

  startAttackMotion(); // コスチューム装備によって体当たり/剣/槍を振り分け
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
  if (!state.battleStarted || state.cleared || !isInAttackRange() || state.specialGauge < 100) return;
  const { specialMinDamage, specialMaxDamage, specialMultiplier } = CONFIG.battle;
  const base   = Math.floor(Math.random() * (specialMaxDamage - specialMinDamage + 1)) + specialMinDamage;
  const damage = Math.floor(base * specialMultiplier);

  state.currentHp    = Math.max(0, state.currentHp - damage);
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

// ============================================================
// ボスAI
// ============================================================
function updateBossMovement() {
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  const now = Date.now();
  const s = getCurrentStage(state.stageIndex);
  const hpRatio = state.currentHp / s.maxHp;

  // フェーズ判定
  const prevPhase = state.bossAI.phase;
  if      (hpRatio <= s.phase3At) state.bossAI.phase = 3;
  else if (hpRatio <= s.phase2At) state.bossAI.phase = 2;
  else                             state.bossAI.phase = 1;
  if (state.bossAI.phase > prevPhase) onPhaseChange(state.bossAI.phase);

  // 攻撃タイミング
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

  // 移動
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
      three.bossMat.color.set(getCurrentStage(state.stageIndex).color);
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

function startBossCharge() {
  state.bossAI.mode = "charge";
  state.bossAI.chargeTarget = { x: state.player.x, z: state.player.z };
  three.bossMat.color.set(0xff3300);
}

function checkChargeHit() {
  const s = getCurrentStage(state.stageIndex);
  const dist = Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z);
  if (dist < s.radius + CONFIG.player.radius + 0.3) applyPlayerDamage(s.chargeDamage);
}

function startBossShockwave() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "shockwave";
  spawnShockwave();
  setTimeout(() => { state.bossAI.mode = "wander"; }, 600);
}

function spawnShockwave() {
  const cx = state.boss.x, cz = state.boss.z;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.4, 36), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.08, cz);
  three.scene.add(ring);

  let frame = 0, hit = false;
  const maxR = getCurrentStage(state.stageIndex).shockwaveRadius;
  function animateWave() {
    frame++;
    const t = frame / 30;
    const r = t * maxR;
    ring.geometry.dispose();
    ring.geometry = new THREE.RingGeometry(r, r + 0.35, 36);
    ring.material.opacity = 0.9 * (1 - t);
    if (!hit && !state.cleared && !state.gameOver) {
      const pd = Math.hypot(state.player.x - cx, state.player.z - cz);
      if (pd < r + 0.5 && pd > r - 1.2) {
        hit = true;
        applyPlayerDamage(getCurrentStage(state.stageIndex).shockwaveDamage);
      }
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

// ============================================================
// プレイヤー被弾・ゲームオーバー
// ============================================================
function applyPlayerDamage(damage) {
  const now = Date.now();
  if (now < state.player.invincibleUntil) return;
  if (state.cleared || state.gameOver) return;
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

function handleGameOver() {
  state.gameOver = true;
  dom.gameOverScreen.classList.add("visible");
  dom.statusLine.textContent = "";
}
