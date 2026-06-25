/**
 * battle.js — 戦闘ロジック・ボスAI・エフェクト・被弾
 */

// ── 攻撃モーション ────────────────────────────────────────────

// ダッシュ攻撃：ボスめがけて高速突進→弾む→戻る
function startDashAttack() {
  if (!three.dashAttack) return;
  three.dashAttack.active   = true;
  three.dashAttack.progress = 0;
  const dx  = state.boss.x - state.player.x;
  const dz  = state.boss.z - state.player.z;
  const len = Math.hypot(dx, dz) || 1;
  three.dashAttack.dirX = dx / len;
  three.dashAttack.dirZ = dz / len;
}

function updateDashAttack() {
  if (!three.dashAttack?.active) return;
  three.dashAttack.progress += 0.075; // やや遅めにして距離感を出す
  const t = three.dashAttack.progress;

  let offset, squishX, squishY, squishZ, rotY = 0;

  if (t < 0.08) {
    // 予備動作：小さく引く
    const s = t / 0.08;
    offset  = -s * 0.18;
    squishX = 1 + s * 0.15; squishY = 1 - s * 0.12; squishZ = 1 + s * 0.15;
  } else if (t < 0.45) {
    // 突進：体を縦に伸ばしてダッシュ（距離1.2）
    const s = (t - 0.08) / 0.37;
    const ease = s < 0.5 ? 4*s*s*s : 1 - Math.pow(-2*s+2,3)/2;
    offset  = -0.18 + ease * 1.38;
    squishX = 1.15 - s * 0.25; squishY = 0.88 + s * 0.15; squishZ = 1.35 - s * 0.25;
  } else if (t < 0.58) {
    // ヒット：横につぶれて衝撃を表現
    const s = (t - 0.45) / 0.13;
    offset  = 1.2 - s * 0.25;
    squishX = 1.4 + s * 0.2; squishY = 0.6 - s * 0.1; squishZ = 1.4 + s * 0.2;
  } else if (t < 0.72) {
    // バウンド：跳ね返り
    const s = (t - 0.58) / 0.14;
    offset  = 0.95 - s * 0.6;
    squishX = 1.6 - s * 0.3; squishY = 0.5 + s * 0.3; squishZ = 1.6 - s * 0.3;
  } else {
    // 戻り
    const s = (t - 0.72) / 0.28;
    const ease = 1 - (1-s)*(1-s);
    offset  = 0.35 - ease * 0.35;
    squishX = 1.3 - s * 0.3; squishY = 0.8 + s * 0.2; squishZ = 1.3 - s * 0.3;
  }

  three.playerGroup.position.set(
    state.player.x + three.dashAttack.dirX * offset, 0,
    state.player.z + three.dashAttack.dirZ * offset
  );
  three.playerGroup.scale.set(squishX, squishY, squishZ);

  if (t >= 1.0) {
    three.dashAttack.active = false;
    three.playerGroup.position.set(state.player.x, 0, state.player.z);
    three.playerGroup.scale.set(1, 1, 1);
  }
}

// 剣モーション：大振りかぶり → 高速振り下ろし → 体も回転
function startSwordSwing() {
  if (!three.swordPivot) return;
  three.swordSwing.active   = true;
  three.swordSwing.progress = 0;
}

function updateSwordSwing() {
  if (!three.swordSwing?.active) return;
  three.swordSwing.progress += 0.055; // ゆっくり振りかぶって速く振り下ろす
  const t = three.swordSwing.progress;
  let angle, bodyRotZ = 0, bodyScaleX = 1, bodyScaleY = 1;

  if (t < 0.25) {
    // 大きく振りかぶる（後ろへ）
    const s = t / 0.25;
    angle = s * 2.2;                        // 振りかぶり最大 2.2rad
    bodyRotZ = -s * 0.25;                   // 体を少し傾ける
    bodyScaleX = 1 - s * 0.08;
    bodyScaleY = 1 + s * 0.12;
  } else if (t < 0.55) {
    // 高速振り下ろし（前へ ＋ 大きく回転）
    const s = (t - 0.25) / 0.30;
    const ease = s * s * (3 - 2*s);         // smoothstep で加速
    angle = 2.2 - ease * 5.8;              // -3.6rad（前方へ大きく）
    bodyRotZ = -0.25 + s * 0.45;           // 体が振られる
    bodyScaleX = 1 - 0.08 + s * 0.25;     // 横にぶれる
    bodyScaleY = 1 + 0.12 - s * 0.22;
  } else if (t < 0.72) {
    // 行き過ぎ→ちょっと戻る
    const s = (t - 0.55) / 0.17;
    angle = -3.6 + s * 1.1;
    bodyRotZ = 0.2 - s * 0.2;
    bodyScaleX = 1.17 - s * 0.12;
    bodyScaleY = 0.9  + s * 0.08;
  } else {
    // 元に戻す
    const s = (t - 0.72) / 0.28;
    angle = -2.5 + s * 2.5;
    bodyRotZ = 0;
  }

  three.swordPivot.rotation.z = angle;
  // 体全体を少し傾けて迫力を出す
  three.playerGroup.rotation.z = bodyRotZ;
  three.playerGroup.scale.set(bodyScaleX, bodyScaleY, bodyScaleX);

  if (t >= 1.0) {
    three.swordSwing.active = false;
    three.swordPivot.rotation.z = 0;
    three.playerGroup.rotation.z = 0;
    three.playerGroup.scale.set(1, 1, 1);
  }
}

// 槍モーション：大きく引いて→全力突き（2段）→戻る
function startSpearThrust() {
  if (!three.spearPivot) return;
  three.spearThrust.active   = true;
  three.spearThrust.progress = 0;
  three.spearThrust.stage    = 0;  // 0=引き, 1=1段目, 2=戻し, 3=2段目, 4=戻り
}

function updateSpearThrust() {
  if (!three.spearThrust?.active) return;
  three.spearThrust.progress += 0.065;
  const t = three.spearThrust.progress;
  let pz = 0, px = 0, bodyTilt = 0, bodyScaleX = 1, bodyScaleY = 1;

  if (t < 0.15) {
    // 大きく後ろへ引く
    const s = t / 0.15;
    pz = s * 0.55;                  // 後方へ引く（+z方向）
    px = -s * 0.1;
    bodyTilt = -s * 0.2;
    bodyScaleX = 1 + s * 0.1;
    bodyScaleY = 1 - s * 0.08;
  } else if (t < 0.30) {
    // 1段目：鋭く突く
    const s = (t - 0.15) / 0.15;
    const ease = s * s;             // 加速しながら突く
    pz = 0.55 - ease * 1.45;       // -0.9まで前進
    px = -0.1 + s * 0.15;
    bodyTilt = -0.2 + s * 0.35;
    bodyScaleX = 1.1 - s * 0.15;
    bodyScaleY = 0.92 + s * 0.1;
  } else if (t < 0.42) {
    // 少し戻す
    const s = (t - 0.30) / 0.12;
    pz = -0.9 + s * 0.65;
    bodyTilt = 0.15 - s * 0.3;
  } else if (t < 0.57) {
    // 2段目：さらに速く！
    const s = (t - 0.42) / 0.15;
    const ease = s * s * s;
    pz = -0.25 - ease * 1.1;       // -1.35（さらに深く）
    bodyTilt = -0.15 + s * 0.4;
    bodyScaleX = 0.95 + s * 0.2;
    bodyScaleY = 1.02 - s * 0.15;
  } else if (t < 0.70) {
    // 2段目ヒット：体ごとのめり込む
    const s = (t - 0.57) / 0.13;
    pz = -1.35 + s * 0.45;
    bodyTilt = 0.25;
    bodyScaleX = 1.15 - s * 0.1;
    bodyScaleY = 0.87 + s * 0.08;
  } else {
    // ゆっくり元の構えへ
    const s = (t - 0.70) / 0.30;
    const ease = 1 - (1-s)*(1-s);
    pz = -0.9 + ease * 0.9;
    bodyTilt = 0.25 * (1 - ease);
    bodyScaleX = 1.05 - ease * 0.05;
    bodyScaleY = 0.95 + ease * 0.05;
  }

  three.spearPivot.position.z = pz;
  three.spearPivot.position.x = px;
  three.playerGroup.rotation.x = bodyTilt;
  three.playerGroup.scale.set(bodyScaleX, bodyScaleY, bodyScaleX);

  if (t >= 1.0) {
    three.spearThrust.active = false;
    three.spearPivot.position.set(0, 0, 0);
    three.playerGroup.rotation.x = 0;
    three.playerGroup.scale.set(1, 1, 1);
  }
}

// ── 魔法陣エフェクト ──────────────────────────────────────────
function spawnMagicCircle() {
  const group = new THREE.Group();
  group.position.set(state.player.x, 0.05, state.player.z);
  group.userData.cancelled = false;
  three.scene.add(group);
  three.magicCircles.push(group);

  const mkRing = (r0, r1, seg, color) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, seg),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    return m;
  };
  const outer = mkRing(1.0, 1.15, 48, 0xffffff);
  const mid   = mkRing(0.6, 0.72, 48, 0xffd166);
  const inner = mkRing(0.25, 0.35, 32, 0xaaddff);
  outer.material.opacity = 0.85;

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xeeeeff, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  pillar.position.y = 3;
  group.add(pillar);

  const glow = new THREE.PointLight(0xaaddff, 0, 5);
  glow.position.y = 1.5;
  group.add(glow);

  let frame = 0;
  const N = 80;
  (function tick() {
    if (group.userData.cancelled) return;
    const t = ++frame / N;
    const op = t < 0.25 ? t / 0.25 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    outer.material.opacity  = op * 0.85;
    mid.material.opacity    = op * 0.9;
    inner.material.opacity  = op * 0.9;
    const pt = Math.max(0, (t - 0.15) / 0.3);
    const pv = Math.min(pt, 1 - Math.max(0, (t - 0.65) / 0.35));
    pillar.material.opacity = pv * 0.35;
    glow.intensity          = pv * 2.5;
    outer.rotation.z += 0.04;
    inner.rotation.z -= 0.07;
    const sc = t < 0.2 ? 0.5 + (t / 0.2) * 0.6 : 1.1 - (t - 0.2) * 0.1;
    group.scale.set(sc, 1, sc);
    if (frame < N) {
      requestAnimationFrame(tick);
    } else {
      three.scene.remove(group);
      [outer, mid, inner, pillar].forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      group.remove(glow);
      const i = three.magicCircles.indexOf(group);
      if (i !== -1) three.magicCircles.splice(i, 1);
    }
  })();
}

// ── ダメージ表示・ヒットエフェクト ────────────────────────────
function getBossScreenPos() {
  const { w, h } = getSize();
  const v = new THREE.Vector3(state.boss.x, getCurrentStage(state.stageIndex).radius * 1.5, state.boss.z);
  v.project(three.camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
}

function spawnDamageNumber(damage, isCrit) {
  const pos = getBossScreenPos();
  const el  = document.createElement("div");
  el.className   = "damage-number" + (isCrit ? " critical" : "");
  el.textContent = isCrit ? `⚡${damage}!!` : damage;
  el.style.left  = (pos.x + (Math.random() - 0.5) * 50) + "px";
  el.style.top   = (pos.y + (Math.random() - 0.5) * 24) + "px";
  dom.sceneContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function flashBossHit(ms = 120) {
  // ★ クリア後のタイムアウト誤発動を防ぐためにstageIndexをクロージャで保持
  const idx = state.stageIndex;
  three.bossMat.color.set(getCurrentStage(idx).hitColor);
  setTimeout(() => {
    if (!state.cleared) three.bossMat.color.set(getCurrentStage(state.stageIndex).color);
  }, ms);
}

function triggerCameraShake() {
  const el = dom.sceneContainer;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), CONFIG.camera.shakeMs);
}

// ── 通常攻撃・必殺技 ──────────────────────────────────────────
function isInAttackRange() {
  return Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z)
    <= CONFIG.battle.attackRange;
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

  startAttackMotion();
  spawnDamageNumber(damage, isCrit);
  flashBossHit(isCrit ? 200 : 120);
  triggerCameraShake();
  three.bossGroup.scale.set(0.85, 0.85, 0.85);
  setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 100);

  dom.statusLine.textContent = isCrit
    ? `⚡ クリティカル！ ${damage} ダメージ！`
    : `${damage} ダメージ！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}

function useSpecialMove() {
  // ★ gameOver チェックを追加
  if (!state.battleStarted || state.cleared || state.gameOver || state.specialGauge < 100) return;
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
  const idx = state.stageIndex;
  setTimeout(() => {
    if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color);
  }, 350);
  three.bossGroup.scale.set(0.6, 0.6, 0.6);
  setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 200);

  dom.statusLine.textContent = `✨ 光の必殺技！ 弱点ヒット！ ${damage} ダメージ！！`;
  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}

// ── ボスAI ────────────────────────────────────────────────────
function updateBossMovement() {
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  const now = Date.now();
  const s   = getCurrentStage(state.stageIndex);
  const hpR = state.currentHp / s.maxHp;

  // フェーズ判定
  const prev = state.bossAI.phase;
  if      (hpR <= s.phase3At) state.bossAI.phase = 3;
  else if (hpR <= s.phase2At) state.bossAI.phase = 2;
  else                        state.bossAI.phase = 1;
  if (state.bossAI.phase > prev) onPhaseChange(state.bossAI.phase);

  // 攻撃タイミング
  const interval = s.attackIntervalMs / state.bossAI.phase;
  if (now >= state.bossAI.nextAttackAt && state.bossAI.mode === "wander") {
    const roll = Math.random();
    if (state.bossAI.phase === 1) {
      startBossCharge();
    } else if (state.bossAI.phase === 2) {
      (roll < 0.5 || !s.hasShockwave) ? startBossCharge() : startBossShockwave();
    } else {
      startBossCharge();
      if (s.hasShockwave) setTimeout(() => {
        if (!state.cleared && !state.gameOver) startBossShockwave();
      }, 800);
    }
    state.bossAI.nextAttackAt = now + interval;
  }

  // 移動
  if (state.bossAI.mode === "charge" && state.bossAI.chargeTarget) {
    const dx   = state.bossAI.chargeTarget.x - state.boss.x;
    const dz   = state.bossAI.chargeTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      state.boss.x += (dx / dist) * s.chargeSpeed;
      state.boss.z += (dz / dist) * s.chargeSpeed;
      checkChargeHit();
    } else {
      state.bossAI.mode        = "wander";
      state.bossAI.chargeTarget = null;
      three.bossMat.color.set(s.color);
    }
  } else if (state.bossAI.mode !== "shockwave") {
    const dx   = state.bossTarget.x - state.boss.x;
    const dz   = state.bossTarget.z - state.boss.z;
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
  state.bossAI.mode         = "charge";
  state.bossAI.chargeTarget = { x: state.player.x, z: state.player.z };
  three.bossMat.color.set(0xff3300);
}

function checkChargeHit() {
  const s    = getCurrentStage(state.stageIndex);
  const dist = Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z);
  if (dist < s.radius + CONFIG.player.radius + 0.3) applyPlayerDamage(s.chargeDamage);
}

function startBossShockwave() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "shockwave";
  spawnShockwave();
  setTimeout(() => { if (!state.gameOver && !state.cleared) state.bossAI.mode = "wander"; }, 600);
}

function spawnShockwave() {
  const cx  = state.boss.x, cz = state.boss.z;
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  // ★ 固定サイズのRingGeometryを1回だけ作り、scaleで拡大（毎フレームdispose+再生成をやめる）
  const maxR = getCurrentStage(state.stageIndex).shockwaveRadius;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 36), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.08, cz);
  ring.scale.set(0.01, 1, 0.01);
  three.scene.add(ring);

  let frame = 0, hit = false;
  (function tick() {
    frame++;
    const t = frame / 30;
    const r = t * maxR;
    // ★ scaleで半径を表現（geometry再生成なし）
    ring.scale.set(r, 1, r);
    ring.material.opacity = 0.9 * (1 - t);
    if (!hit && !state.cleared && !state.gameOver) {
      const pd = Math.hypot(state.player.x - cx, state.player.z - cz);
      if (pd <= r + 0.4 && pd >= Math.max(0, r - 0.8)) {
        hit = true;
        applyPlayerDamage(getCurrentStage(state.stageIndex).shockwaveDamage);
      }
    }
    if (frame < 30) requestAnimationFrame(tick);
    else { three.scene.remove(ring); ring.geometry.dispose(); mat.dispose(); }
  })();
}

function onPhaseChange(phase) {
  const msgs = { 2: "⚠️ ボスが怒り始めた！", 3: "🔥 ボスが本気を出した！！" };
  dom.statusLine.textContent = msgs[phase] || "";
  three.bossMat.color.set(0xffffff);
  const idx = state.stageIndex;
  setTimeout(() => {
    if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color);
  }, 500);
  triggerCameraShake();
}

// ── プレイヤー被弾・ゲームオーバー ────────────────────────────
function applyPlayerDamage(damage) {
  const now = Date.now();
  if (now < state.player.invincibleUntil) return;
  if (state.cleared || state.gameOver) return;

  state.player.hp             = Math.max(0, state.player.hp - damage);
  state.player.invincibleUntil = now + CONFIG.player.invincibleMs;

  dom.damageFlash.classList.add("active");
  setTimeout(() => dom.damageFlash.classList.remove("active"), 150);

  const bodyMat = three.playerGroup?.children[0]?.material;
  if (bodyMat) {
    bodyMat.color.set(0xffffff);
    // ★ 被弾後の色戻しをequippedCostumeから取得
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
