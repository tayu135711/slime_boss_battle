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

function updateDashAttack(dtScale = 1) {
  if (!three.dashAttack?.active) return;
  three.dashAttack.progress += 0.075 * dtScale;
  const t = three.dashAttack.progress;

  let offset, squishX, squishY, squishZ, rotY = 0;

  if (t < 0.08) {
    const s = t / 0.08;
    offset  = -s * 0.18;
    squishX = 1 + s * 0.15; squishY = 1 - s * 0.12; squishZ = 1 + s * 0.15;
  } else if (t < 0.45) {
    const s = (t - 0.08) / 0.37;
    const ease = s < 0.5 ? 4*s*s*s : 1 - Math.pow(-2*s+2,3)/2;
    offset  = -0.18 + ease * 1.38;
    squishX = 1.15 - s * 0.25; squishY = 0.88 + s * 0.15; squishZ = 1.35 - s * 0.25;
  } else if (t < 0.58) {
    const s = (t - 0.45) / 0.13;
    offset  = 1.2 - s * 0.25;
    squishX = 1.4 + s * 0.2; squishY = 0.6 - s * 0.1; squishZ = 1.4 + s * 0.2;
  } else if (t < 0.72) {
    const s = (t - 0.58) / 0.14;
    offset  = 0.95 - s * 0.6;
    squishX = 1.6 - s * 0.3; squishY = 0.5 + s * 0.3; squishZ = 1.6 - s * 0.3;
  } else {
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

// 剣モーション：豪快な縦振り（X軸まわりで振りかぶり→振り下ろし）
function startSwordSwing() {
  if (!three.swordPivot) return;
  three.swordSwing.active   = true;
  three.swordSwing.progress = 0;
}

function updateSwordSwing(dtScale = 1) {
  if (!three.swordSwing?.active) return;
  three.swordSwing.progress += 0.055 * dtScale;
  const t = three.swordSwing.progress;
  // ★修正: 以前はX軸のみの回転で、剣が体の横に固定されたまま上下にしか
  //         動かず「蹴り」のように見えていた。Z軸の回転（右肩→左下への
  //         横振り）を組み合わせることで、斜めに振り下ろすスラッシュらしい
  //         軌道にする。
  let angleX, angleZ, bodyTilt = 0, bodyScaleX = 1, bodyScaleY = 1;

  if (t < 0.2) {
    // 大きく振りかぶる（右肩の上・斜め後方へ）
    const s = t / 0.2;
    angleX = s * 2.0;                   // 剣先が上後方へ
    angleZ = -s * 0.9;                  // 右側に大きく開いて構える
    bodyTilt = -s * 0.3;                // 体を後ろに反らす
    bodyScaleX = 1 - s * 0.1;
    bodyScaleY = 1 + s * 0.15;
  } else if (t < 0.5) {
    // 斜め振り下ろし（右上 → 左下、高速）
    const s = (t - 0.2) / 0.3;
    const ease = s * s * (3 - 2*s);
    angleX = 2.0 - ease * 5.5;          // 前下方へ
    angleZ = -0.9 + ease * 2.0;         // 右→左へ横振り抜け
    bodyTilt = -0.3 + s * 0.7;          // 体を前に倒す
    bodyScaleX = 0.9 + s * 0.3;
    bodyScaleY = 1.15 - s * 0.25;
  } else if (t < 0.65) {
    // 衝撃のめり込み
    const s = (t - 0.5) / 0.15;
    angleX = -3.5 + s * 0.8;
    angleZ = 1.1 - s * 0.15;
    bodyTilt = 0.4 - s * 0.2;
    bodyScaleX = 1.2 - s * 0.15;
    bodyScaleY = 0.9 + s * 0.05;
  } else {
    // 戻り
    const s = (t - 0.65) / 0.35;
    const ease = 1 - (1-s)*(1-s);
    angleX = -2.7 + ease * 2.7;
    angleZ = 0.95 - ease * 0.95;
    bodyTilt = 0.2 * (1 - ease);
    bodyScaleX = 1.05 - ease * 0.05;
    bodyScaleY = 0.95 + ease * 0.05;
  }

  three.swordPivot.rotation.x = angleX;    // 縦の振り（X軸）
  three.swordPivot.rotation.z = angleZ;    // 横の振り抜け（Z軸）→ 斜め斬りの軌道
  three.playerGroup.rotation.x = bodyTilt; // 体の前後傾き
  three.playerGroup.scale.set(bodyScaleX, bodyScaleY, bodyScaleX);

  if (t >= 1.0) {
    three.swordSwing.active = false;
    three.swordPivot.rotation.set(0, 0, 0);
    three.playerGroup.rotation.x = 0;
    three.playerGroup.scale.set(1, 1, 1);
  }
}

// 槍モーション：頭上から豪快に突き下ろす（オーバーヘッドスラム）
function startSpearThrust() {
  if (!three.spearPivot) return;
  three.spearThrust.active   = true;
  three.spearThrust.progress = 0;
}

function updateSpearThrust(dtScale = 1) {
  if (!three.spearThrust?.active) return;
  three.spearThrust.progress += 0.065 * dtScale;
  const t = three.spearThrust.progress;
  let px = 0, pz = 0, py = 0, bodyTilt = 0, bodyScaleX = 1, bodyScaleY = 1;

  if (t < 0.15) {
    // 槍を頭上に引き上げる
    const s = t / 0.15;
    py = s * 0.8;
    pz = -s * 0.2;
    bodyTilt = s * 0.3;
    bodyScaleX = 1 - s * 0.05;
    bodyScaleY = 1 + s * 0.1;
  } else if (t < 0.35) {
    // １段目の振り下ろし
    const s = (t - 0.15) / 0.2;
    const ease = s * s * (3 - 2*s);
    py = 0.8 - ease * 1.3;          // 下へ
    pz = -0.2 + ease * 0.8;         // 前に突き出す
    bodyTilt = 0.3 - ease * 0.6;
    bodyScaleX = 0.95 + ease * 0.2;
    bodyScaleY = 1.1 - ease * 0.15;
  } else if (t < 0.5) {
    // 戻し
    const s = (t - 0.35) / 0.15;
    py = -0.5 + s * 0.6;
    pz = 0.6 - s * 0.4;
    bodyTilt = -0.3 + s * 0.2;
  } else if (t < 0.7) {
    // ２段目の突き下ろし（さらに深く）
    const s = (t - 0.5) / 0.2;
    const ease = s * s * s;
    py = 0.1 - ease * 0.8;
    pz = 0.2 + ease * 0.7;
    bodyTilt = -0.1 + ease * 0.6;
    bodyScaleX = 1.15 - ease * 0.2;
    bodyScaleY = 0.95 + ease * 0.05;
  } else if (t < 0.85) {
    // 衝撃のめり込み
    const s = (t - 0.7) / 0.15;
    py = -0.7 + s * 0.3;
    pz = 0.9 - s * 0.1;
    bodyTilt = 0.5 - s * 0.1;
  } else {
    // 構えに戻る
    const s = (t - 0.85) / 0.15;
    const ease = 1 - (1-s)*(1-s);
    py = -0.4 + ease * 0.4;
    pz = 0.8 - ease * 0.8;
    bodyTilt = 0.4 * (1 - ease);
  }

  three.spearPivot.position.set(px, py, pz);
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
  const idx = state.stageIndex;
  three.bossMat.color.set(getCurrentStage(idx).hitColor);
  setTimeout(() => {
    if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color);
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
  // ★ お弁当バフ（攻撃力・クリティカル率）を反映
  const atkMult  = state._buffAttackMult  || 1;
  const critMult = state._buffCritMult    || 1;
  const baseMin  = Math.floor(minDamage * atkMult);
  const baseMax  = Math.floor(maxDamage * atkMult);
  const threshold = Math.floor(criticalThreshold / critMult); // 閾値を下げる→クリット増加
  const damage = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
  const isCrit = damage >= threshold;

  state.currentHp    = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = Math.min(100, state.specialGauge + specialGaugePerHit);

  startAttackMotion();
  // SE: 攻撃
  if (isCrit) { SE.attackCritical(); } else { SE.attack(); }
  spawnDamageNumber(damage, isCrit);
  flashBossHit(isCrit ? 200 : 120);
  SE.bossHit();
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
  if (!state.battleStarted || state.cleared || state.gameOver || state.specialGauge < 100) return;
  const { specialMinDamage, specialMaxDamage, specialMultiplier } = CONFIG.battle;
  const base   = Math.floor(Math.random() * (specialMaxDamage - specialMinDamage + 1)) + specialMinDamage;
  const damage = Math.floor(base * specialMultiplier);

  state.currentHp    = Math.max(0, state.currentHp - damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = 0;

  // ── コスチュームスキル分岐 ──────────────────────────────────
  const skillId = state.equippedCostume?.skillId || null;

  if (skillId === "wave") {
    SE.specialWave();
    spawnWaveSkill(damage);
  } else if (skillId === "ice") {
    SE.specialIce();
    spawnIceSkill(damage);
  } else if (skillId === "thunder") {
    SE.specialThunder();
    spawnThunderSkill(damage);
  } else {
    // デフォルト（スキルなしコスチューム）
    SE.specialDefault();
    spawnMagicCircle();
    spawnDamageNumber(damage, true);
    triggerCameraShake();
    three.bossMat.color.set(0xffffff);
    const idx = state.stageIndex;
    setTimeout(() => { if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color); }, 350);
    three.bossGroup.scale.set(0.6, 0.6, 0.6);
    setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 200);
    dom.statusLine.textContent = `✨ 光の必殺技！ 弱点ヒット！ ${damage} ダメージ！！`;
  }

  refreshUi();
  if (state.currentHp === 0) handleBossDefeated();
}

// ── wave スキル（キングスライム）: 衝撃波リング ───────────────
function spawnWaveSkill(damage) {
  triggerCameraShake();
  spawnDamageNumber(damage, true);

  // 青い衝撃波リングを3重に広がらせる
  const colors = [0x38bdf8, 0x7dd3fc, 0xbae6fd];
  colors.forEach((color, i) => {
    setTimeout(() => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.35, 40), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(state.boss.x, 0.1, state.boss.z);
      three.scene.add(ring);

      let frame = 0;
      const N = 50;
      const maxR = 5.0 + i * 1.2;
      (function tick() {
        const t = ++frame / N;
        const s = 1 + t * maxR;
        ring.scale.set(s, s, s);
        mat.opacity = 0.8 * (1 - t);
        if (frame < N) requestAnimationFrame(tick);
        else { three.scene.remove(ring); ring.geometry.dispose(); mat.dispose(); }
      })();
    }, i * 120);
  });

  // ボスを白フラッシュ
  three.bossMat.color.set(0x38bdf8);
  const idx = state.stageIndex;
  setTimeout(() => { if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color); }, 500);
  three.bossGroup.scale.set(0.5, 0.5, 0.5);
  setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 250);

  dom.statusLine.textContent = `🌊 キングウェーブ！ 大海嘯！ ${damage} ダメージ！！`;
}

// ── ice スキル（ライリン）: 氷柱乱立 ──────────────────────────
function spawnIceSkill(damage) {
  triggerCameraShake();
  spawnDamageNumber(damage, true);

  // ボス周囲に氷柱を6本打ち上げる
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const dist  = 0.4 + Math.random() * 0.8;
      const cx = state.boss.x + Math.cos(angle) * dist;
      const cz = state.boss.z + Math.sin(angle) * dist;

      const h = 1.8 + Math.random() * 1.2;
      const geo = new THREE.CylinderGeometry(0.08, 0.22, h, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.85 });
      const shard = new THREE.Mesh(geo, mat);
      shard.position.set(cx, -h / 2, cz);
      three.scene.add(shard);

      // 突き上げアニメ
      let frame = 0;
      const N = 35;
      (function tick() {
        const t = ++frame / N;
        shard.position.y = (t < 0.6 ? (t / 0.6) : 1) * (h / 2) - h / 2;
        mat.opacity = t < 0.7 ? 0.85 : 0.85 * (1 - (t - 0.7) / 0.3);
        if (frame < N) requestAnimationFrame(tick);
        else { three.scene.remove(shard); geo.dispose(); mat.dispose(); }
      })();
    }, i * 80);
  }

  three.bossMat.color.set(0xa5f3fc);
  const idx = state.stageIndex;
  setTimeout(() => { if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color); }, 600);
  three.bossGroup.scale.set(0.55, 1.4, 0.55);
  setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 300);

  dom.statusLine.textContent = `🧊 アイスニードル！ 極寒乱撃！ ${damage} ダメージ！！`;
}

// ── thunder スキル（イカズチ）: 落雷 ──────────────────────────
function spawnThunderSkill(damage) {
  triggerCameraShake();
  spawnDamageNumber(damage, true);

  // 黄色い雷柱をボスの上から落とす
  const bx = state.boss.x, bz = state.boss.z;
  const mat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 7, 8, 1, true), mat);
  bolt.position.set(bx, 3.5, bz);
  three.scene.add(bolt);

  // 落下 → フラッシュ演出
  let frame = 0;
  const N = 28;
  (function tick() {
    const t = ++frame / N;
    bolt.scale.x = bolt.scale.z = 1 + Math.sin(t * Math.PI * 6) * 0.3;
    mat.opacity = t < 0.7 ? 0.95 : 0.95 * (1 - (t - 0.7) / 0.3);
    if (frame < N) requestAnimationFrame(tick);
    else { three.scene.remove(bolt); bolt.geometry.dispose(); mat.dispose(); }
  })();

  // 地面の放電エフェクト
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(bx, 0.05, bz);
  three.scene.add(glow);
  setTimeout(() => { three.scene.remove(glow); glow.geometry.dispose(); glow.material.dispose(); }, 400);

  three.bossMat.color.set(0xfde047);
  const idx = state.stageIndex;
  setTimeout(() => { if (!state.cleared) three.bossMat.color.set(getCurrentStage(idx).color); }, 450);
  three.bossGroup.scale.set(1.3, 0.5, 1.3);
  setTimeout(() => { if (!state.cleared) three.bossGroup.scale.set(1, 1, 1); }, 200);

  dom.statusLine.textContent = `⚡ サンダーボルト！ 天罰一撃！ ${damage} ダメージ！！`;
}

// ── ボスAI ────────────────────────────────────────────────────
function updateBossMovement() {
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  const now = Date.now();
  const s   = getCurrentStage(state.stageIndex);
  const hpR = state.currentHp / s.maxHp;

  const prev = state.bossAI.phase;
  if      (hpR <= s.phase3At) state.bossAI.phase = 3;
  else if (hpR <= s.phase2At) state.bossAI.phase = 2;
  else                        state.bossAI.phase = 1;
  if (state.bossAI.phase > prev) onPhaseChange(state.bossAI.phase);

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
  SE.bossCharge();
}

function checkChargeHit() {
  const s    = getCurrentStage(state.stageIndex);
  const dist = Math.hypot(state.player.x - state.boss.x, state.player.z - state.boss.z);
  if (dist < s.radius + CONFIG.player.radius + 0.3) applyPlayerDamage(s.chargeDamage);
}

function startBossShockwave() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "shockwave";
  SE.bossShockwave();
  spawnShockwave();
  setTimeout(() => { if (!state.gameOver && !state.cleared) state.bossAI.mode = "wander"; }, 600);
}

function spawnShockwave() {
  const cx  = state.boss.x, cz = state.boss.z;
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
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
    ring.scale.set(r / 1.35, 1, r / 1.35);
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
  SE.phaseChange();
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

  // ★ お弁当バフ（防御力）を反映してダメージ軽減
  const defMult = state._buffDefenseMult || 1;
  const actualDamage = Math.max(1, Math.floor(damage / defMult));
  state.player.hp             = Math.max(0, state.player.hp - actualDamage);
  state.player.invincibleUntil = now + CONFIG.player.invincibleMs;

  dom.damageFlash.classList.add("active");
  setTimeout(() => dom.damageFlash.classList.remove("active"), 150);
  SE.playerHit();

  const bodyMat = three.slimeParts?.bodyMat;
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
  SE.gameOver();
  dom.gameOverScreen.classList.add("visible");
  dom.statusLine.textContent = "";
  clearBentoBuffs(); // ★修正: このバトルで使い切ったお弁当バフをここでクリアする
}

// ★修正: お弁当バフのクリアをresetBattle()から移動。
//         resetBattle()はバトル開始前にも呼ばれるため、そこでクリアすると
//         広場で食べた直後のバフがバトルに反映されないまま消えてしまっていた。
//         代わりにバトルの決着（勝敗）が付いたタイミングでクリアする。
function clearBentoBuffs() {
  state._buffAttackMult   = 1;
  state._buffSpeedMult    = 1;
  state._buffCritMult     = 1;
  state._buffDefenseMult  = 1;
  state._buffSpecialStart = 0;
}