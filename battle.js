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
  const atkMult  = (state._buffAttackMult  || 1) * (state._buildAttackMult || 1);
  const critMult = (state._buffCritMult    || 1) * (state._buildCritMult || 1);
  const baseMin  = Math.floor(minDamage * atkMult);
  const baseMax  = Math.floor(maxDamage * atkMult);
  const threshold = Math.floor(criticalThreshold / critMult); // 閾値を下げる→クリット増加
  let damage = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
  if (state.bossAI.guarding) damage = Math.max(1, Math.floor(damage * 0.25));
  const isCrit = damage >= threshold;

  state.currentHp    = Math.max(0, state.currentHp - damage);
  applyBossBreak(damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  // ★ イカズチスライム装備時はゲージが追加上昇（gaugeReductionを流用）
  const _thunderBonus = state.equippedCostume?.skillId === "thunder"
    ? (SKILL_INFO["thunder"]?.gaugeReduction ?? 0) : 0;
  state.specialGauge = Math.min(100, state.specialGauge + specialGaugePerHit + _thunderBonus + (state._buildGaugeBonus || 0));

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

// ── 全画面スキル演出 ──────────────────────────────────────────
const SKILL_CINEMATIC = {
  wave:    { bg: "linear-gradient(135deg,#0ea5e9,#38bdf8,#7dd3fc)", icon: "🌊", color: "#38bdf8" },
  ice:     { bg: "linear-gradient(135deg,#a5f3fc,#6ee7f7,#bae6fd)", icon: "🧊", color: "#a5f3fc" },
  thunder: { bg: "linear-gradient(135deg,#fde047,#facc15,#fbbf24)", icon: "⚡", color: "#fde047" },
  default: { bg: "linear-gradient(135deg,#a78bfa,#c4b5fd,#ede9fe)", icon: "✨", color: "#e9d5ff" },
};

function showSkillCinematic(skillId, skillName, onDone) {
  const cfg = SKILL_CINEMATIC[skillId] || SKILL_CINEMATIC.default;
  const el = document.createElement("div");
  el.id = "skillCinematic";
  el.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:${cfg.bg};
    opacity:0;transition:opacity 0.18s ease;
    pointer-events:none;
  `;
  el.innerHTML = `
    <div style="font-size:72px;animation:skillIconPop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both">${cfg.icon}</div>
    <div style="font-size:28px;font-weight:900;color:${cfg.color};
      text-shadow:0 0 20px rgba(255,255,255,0.8),0 2px 4px rgba(0,0,0,0.3);
      letter-spacing:0.08em;margin-top:12px;
      animation:skillNameSlide 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.2s both">
      ${skillName}
    </div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:8px;letter-spacing:0.12em;
      animation:skillNameSlide 0.35s ease 0.3s both">
      SKILL ACTIVATED
    </div>
  `;
  // アニメ定義（一度だけ追加）
  if (!document.getElementById("skillCinematicStyle")) {
    const st = document.createElement("style");
    st.id = "skillCinematicStyle";
    st.textContent = `
      @keyframes skillIconPop {
        from { opacity:0; transform:scale(0.3) rotate(-20deg); }
        to   { opacity:1; transform:scale(1)   rotate(0deg);   }
      }
      @keyframes skillNameSlide {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0);    }
      }
    `;
    document.head.appendChild(st);
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });

  // 0.7秒表示してフェードアウト後にスキル発動
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      el.remove();
      if (onDone) onDone();
    }, 180);
  }, 700);
}

function useSpecialMove() {
  if (!state.battleStarted || state.cleared || state.gameOver || state.specialGauge < 100) return;
  const { specialMinDamage, specialMaxDamage, specialMultiplier } = CONFIG.battle;
  const base   = Math.floor(Math.random() * (specialMaxDamage - specialMinDamage + 1)) + specialMinDamage;
  const damage = Math.floor(base * specialMultiplier);
  const skillId = state.equippedCostume?.skillId || null;
  const skillName = skillId && SKILL_INFO[skillId] ? SKILL_INFO[skillId].name : "必殺技";

  state.currentHp    = Math.max(0, state.currentHp - damage);
  applyBossBreak(damage);
  state.totalDamage += damage;
  state.attackCount += 1;
  state.specialGauge = 0;
  refreshUi();

  // ★ 全画面演出を挟んでからスキルエフェクト発動
  showSkillCinematic(skillId, skillName, () => {
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

    if (state.currentHp === 0) handleBossDefeated();
  });
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
function spawnIceSkill(baseDamage) {
  // ★ アイスは1.1倍ダメージボーナス
  const iceBonus = SKILL_INFO["ice"]?.bonusDamageRate ?? 1.0;
  let damage = iceBonus !== 1.0 ? Math.floor(baseDamage * iceBonus) : baseDamage;
  if (damage !== baseDamage) {
    state.currentHp   = Math.max(0, state.currentHp - (damage - baseDamage));
    state.totalDamage += (damage - baseDamage);
  }
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
function updateBossMovement(dtScale = 1) {
  if (!state.battleStarted || state.cleared || state.gameOver) return;
  if (state.bossStaggered) {
    three.bossGroup.position.set(state.boss.x, getCurrentStage(state.stageIndex).radius, state.boss.z);
    return;
  }
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
      queueBossAttack("charge");
    } else if (state.bossAI.phase === 2) {
      (roll < 0.35) ? queueBossAttack("guard") : (roll < 0.65 || !s.hasShockwave) ? queueBossAttack("charge") : queueBossAttack("shockwave");
    } else {
      const lateRoll = Math.random();
      queueBossAttack(lateRoll < 0.22 ? "guard" : lateRoll < 0.47 ? "mine" : lateRoll < 0.72 ? "projectile" : "charge");
      if (s.hasShockwave) setTimeout(() => {
        if (!state.cleared && !state.gameOver && state.bossAI.mode === "wander") queueBossAttack("shockwave");
      }, 800);
    }
    state.bossAI.nextAttackAt = now + interval;
  }

  if (state.bossAI.mode === "charge" && state.bossAI.chargeTarget) {
    const dx   = state.bossAI.chargeTarget.x - state.boss.x;
    const dz   = state.bossAI.chargeTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      // ★修正: プレイヤー移動と同根のバグ。ここもdtScaleを掛けないと
      //         高リフレッシュレート端末でボスの突進が速くなりすぎてしまう。
      const rageSpeed = state.bossAI.phase === 3 ? 1.18 : 1;
      state.boss.x += (dx / dist) * s.chargeSpeed * rageSpeed * dtScale;
      state.boss.z += (dz / dist) * s.chargeSpeed * rageSpeed * dtScale;
      checkChargeHit();
    } else {
      state.bossAI.mode        = "wander";
      state.bossAI.chargeTarget = null;
      removeBossAttackIndicator();
      three.bossMat.color.set(s.color);
    }
  } else if (state.bossAI.mode === "wander") {
    const dx   = state.bossTarget.x - state.boss.x;
    const dz   = state.bossTarget.z - state.boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      // ★修正: 徘徊移動もdtScaleを適用し、実時間ベースの速度にする。
      const rageSpeed = state.bossAI.phase === 3 ? 1.22 : 1;
      state.boss.x += (dx / dist) * s.moveSpeed * rageSpeed * dtScale;
      state.boss.z += (dz / dist) * s.moveSpeed * rageSpeed * dtScale;
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
  removeBossAttackIndicator();
  const points = [new THREE.Vector3(state.boss.x, 0.12, state.boss.z), new THREE.Vector3(state.bossAI.chargeTarget.x, 0.12, state.bossAI.chargeTarget.z)];
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.8 }));
  three.scene.add(line);
  three.bossAttackIndicator = line;
  SE.bossCharge();
}

function removeBossAttackIndicator() {
  const indicator = three.bossAttackIndicator;
  if (!indicator) return;
  three.scene.remove(indicator);
  indicator.geometry.dispose();
  indicator.material.dispose();
  three.bossAttackIndicator = null;
}

function queueBossAttack(type) {
  if (state.cleared || state.gameOver || state.bossAI.mode !== "wander") return;
  state.bossAI.mode = "telegraph";
  dom.statusLine.textContent = type === "shockwave"
    ? "⚠ ボスが広範囲攻撃を準備中！離れてください"
    : type === "guard" ? "⚠ ボスが防御態勢に入ります！攻撃の隙を待ちましょう"
    : type === "mine" ? "⚠ 足元に危険エリアが出現します！移動し続けてください"
    : type === "projectile" ? "⚠ ボスが追尾弾を準備中！横へ回避してください"
    : "⚠ ボスが突進を準備中！横へ回避してください";
  three.bossMat.color.set(0xffcc33);
  const startedAt = Date.now();
  state.bossAI.telegraphStartedAt = startedAt;
  setTimeout(() => {
    if (state.cleared || state.gameOver || state.bossAI.mode !== "telegraph" || state.bossAI.telegraphStartedAt !== startedAt) return;
    if (type === "shockwave") startBossShockwave();
    else if (type === "guard") startBossGuard();
    else if (type === "mine") startBossMines();
    else if (type === "projectile") startBossProjectileBarrage();
    else startBossCharge();
  }, CONFIG.battle.bossTelegraphMs);
}

function startBossGuard() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "guard";
  state.bossAI.guarding = true;
  three.bossMat.color.set(0x66ccff);
  removeBossAttackIndicator();
  const shield = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  shield.rotation.x = -Math.PI / 2;
  shield.position.set(state.boss.x, 0.08, state.boss.z);
  three.scene.add(shield);
  three.bossAttackIndicator = shield;
  dom.statusLine.textContent = "🛡 ボスは防御中！ダメージ大幅軽減";
  setTimeout(() => {
    state.bossAI.guarding = false;
    if (!state.cleared && !state.gameOver) {
      state.bossAI.mode = "wander";
      removeBossAttackIndicator();
      three.bossMat.color.set(getCurrentStage(state.stageIndex).color);
      dom.statusLine.textContent = "防御が解除されました！";
    }
  }, 1300);
}

function startBossMines() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "mine";
  const baseX = state.player.x;
  const baseZ = state.player.z;
  const damage = Math.max(1, Math.floor(getCurrentStage(state.stageIndex).shockwaveDamage * 1.15));
  const spots = [
    { x: baseX, z: baseZ },
    { x: baseX + 1.6, z: baseZ - 0.8 },
    { x: baseX - 1.6, z: baseZ + 0.8 },
  ];
  spots.forEach((spot, index) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), mat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(spot.x, 0.06, spot.z);
    three.scene.add(marker);
    three.bossHazards.push(marker);
    let elapsed = 0;
    (function pulse() {
      if (state.cleared || state.gameOver || !marker.parent) {
        if (marker.parent) marker.parent.remove(marker);
        marker.geometry.dispose();
        mat.dispose();
        const hazardIndex = three.bossHazards.indexOf(marker);
        if (hazardIndex !== -1) three.bossHazards.splice(hazardIndex, 1);
        return;
      }
      elapsed += 16;
      marker.scale.setScalar(0.8 + Math.min(elapsed / 900, 1) * 0.2);
      mat.opacity = 0.25 + Math.sin(elapsed * 0.02) * 0.12;
      if (elapsed < 900) requestAnimationFrame(pulse);
      else {
        const dist = Math.hypot(state.player.x - spot.x, state.player.z - spot.z);
        if (dist < 0.95) applyPlayerDamage(damage);
        three.scene.remove(marker);
        marker.geometry.dispose();
        mat.dispose();
      }
    })();
  });
  dom.statusLine.textContent = "💥 危険エリアがまもなく爆発します！";
  setTimeout(() => { if (!state.cleared && !state.gameOver && state.bossAI.mode === "mine") state.bossAI.mode = "wander"; }, 950);
}

function startBossProjectileBarrage() {
  if (state.cleared || state.gameOver) return;
  state.bossAI.mode = "projectile";
  const angle = Math.atan2(state.player.z - state.boss.z, state.player.x - state.boss.x);
  const damage = Math.max(1, Math.floor(getCurrentStage(state.stageIndex).chargeDamage * 0.6));
  const lateStage = state.stageIndex >= 5;
  const angles = lateStage
    ? Array.from({ length: 8 }, (_, i) => i * Math.PI / 4).concat([angle - 0.14, angle + 0.14])
    : [-1, 0, 1].map(i => angle + i * 0.18);
  angles.forEach(a => {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8844 }));
    orb.position.set(state.boss.x, 0.9, state.boss.z);
    orb.userData = { vx: Math.cos(a) * 0.16, vz: Math.sin(a) * 0.16, damage, life: 0 };
    three.scene.add(orb);
    three.bossProjectiles.push(orb);
  });
  SE.bossCharge();
  setTimeout(() => { if (!state.cleared && !state.gameOver && state.bossAI.mode === "projectile") state.bossAI.mode = "wander"; }, 650);
}

function updateBossProjectiles(dtScale = 1) {
  if (!three.bossProjectiles) return;
  for (let i = three.bossProjectiles.length - 1; i >= 0; i--) {
    const orb = three.bossProjectiles[i];
    orb.position.x += orb.userData.vx * dtScale;
    orb.position.z += orb.userData.vz * dtScale;
    orb.userData.life += dtScale;
    const hit = Math.hypot(state.player.x - orb.position.x, state.player.z - orb.position.z) < 0.55;
    if (hit) applyPlayerDamage(orb.userData.damage);
    if (hit || orb.userData.life > 100 || state.cleared || state.gameOver) {
      three.scene.remove(orb);
      orb.geometry.dispose();
      orb.material.dispose();
      three.bossProjectiles.splice(i, 1);
    }
  }
}

function applyBossBreak(damage) {
  if (state.bossStaggered || state.cleared) return;
  state.bossBreakGauge = Math.max(0, state.bossBreakGauge - damage * CONFIG.battle.bossBreakPerDamage);
  if (state.bossBreakGauge > 0) return;
  state.bossStaggered = true;
  state.bossAI.mode = "staggered";
  state.bossAI.guarding = false;
  removeBossAttackIndicator();
  three.bossMat.color.set(0xffffff);
  three.bossGroup.scale.set(1.25, 0.65, 1.25);
  dom.statusLine.textContent = "💥 ブレイク！ ボスが崩れた！ 大ダメージチャンス！";
  triggerCameraShake();
  setTimeout(() => {
    if (state.cleared || state.gameOver) return;
    state.bossStaggered = false;
    state.bossBreakGauge = CONFIG.battle.bossBreakMax;
    state.bossAI.mode = "wander";
    three.bossGroup.scale.set(1, 1, 1);
    three.bossMat.color.set(getCurrentStage(state.stageIndex).color);
    dom.statusLine.textContent = "ボスが立ち上がった！";
  }, CONFIG.battle.bossStaggerMs);
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
  setTimeout(() => {
    if (state.gameOver || state.cleared) return;
    state.bossAI.mode = "wander";
    if (state.bossAI.phase === 3 && Math.random() < 0.65) queueBossAttack("projectile");
  }, 600);
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

  // ★修正: animate()ループのdtScale化と同じ理由。ここは独立したrequestAnimationFrame
  //         ループで「frame++」を1回ずつ数えて30フレームで完了とみなしていたため、
  //         高リフレッシュレート端末では衝撃波の広がり（＝被弾判定が発生する時間）が
  //         実時間の半分以下で終わってしまっていた。経過ミリ秒ベースに変更する。
  const DURATION_MS = 500; // 60fps換算で30フレーム分
  const startTime = performance.now();
  let hit = false;
  (function tick(now) {
    const elapsed = (typeof now === "number" ? now : performance.now()) - startTime;
    const t = Math.min(1, elapsed / DURATION_MS);
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
    if (t < 1) requestAnimationFrame(tick);
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
  if (now < state.player.invincibleUntil) {
    if (state.dodge.active && !state.dodge.perfectRewarded) {
      state.dodge.perfectRewarded = true;
      state.specialGauge = Math.min(100, state.specialGauge + 12);
      dom.statusLine.textContent = "✨ ジャスト回避！ 必殺ゲージ上昇";
      refreshUi();
    }
    return;
  }
  if (state.cleared || state.gameOver) return;

  // ★ お弁当バフ（防御力）を反映してダメージ軽減
  const defMult = state._buffDefenseMult || 1;
  const actualDamage = Math.max(1, Math.floor(damage / defMult / (state._buildDefenseMult || 1)));
  state.player.hp             = Math.max(0, state.player.hp - actualDamage);
  state.player.invincibleUntil = now + CONFIG.player.invincibleMs;

  dom.damageFlash.classList.add("active");
  setTimeout(() => dom.damageFlash.classList.remove("active"), 150);
  SE.playerHit();

  const bodyMat = three.slimeParts?.bodyMat;
  if (bodyMat) {
    // ★修正: 短時間に連続被弾すると、前の被弾で仕込んだ「200ms後に色を戻す」
    //         setTimeoutが複数同時に走ることがあった。後から発火した方が先に
    //         元の色に戻してしまい、それより後で発火するはずだった最新の白化が
    //         そのまま残って本体が白く固まって見える可能性があった。
    //         直前のタイマーを確実にキャンセルしてから積み直す。
    if (three._hitFlashTimer) clearTimeout(three._hitFlashTimer);
    bodyMat.color.set(0xffffff);
    three._hitFlashTimer = setTimeout(() => {
      bodyMat.color.set(state.equippedCostume?.color ?? CONFIG.player.color);
      three._hitFlashTimer = null;
    }, 200);
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
