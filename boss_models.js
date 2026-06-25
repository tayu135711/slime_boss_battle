/**
 * boss_models.js — ステージ別ボスモデルビルダー
 *
 * buildBossModel(group, stage, mat) を呼ぶと
 * group に3Dパーツを追加し、{ mesh: メインメッシュ } を返す。
 *
 * Chapter 1（全ステージ）: スライム系（球体ベース、stageNoで見た目に差）
 *   Stage1: シンプルスライム顔（目2つ、にっこり口）
 *   Stage2: ぬめりスライム（より大きい目、たれ目）
 *   Stage3: くさスライム（触角2本、太眉）
 *   Stage4: どろスライム（ひび割れ模様のコブ付き）
 *   Stage5: きのこスライム（頭に小きのこ生えてる）
 *   Stage6: 古王スライム（王冠付き、威厳のある顔）
 *
 * Chapter 2+: 異形モンスター系（chapterIndexで順番に登場）
 *   1体目: ぬめゴーレム
 *   2体目: くさモンスター
 *   3体目: どろベヒモス
 *   4体目: きのこ魔人
 *   5体目: 古王ガガントス
 *   それ以降: ガガントスを繰り返し
 */

// ───────────────────────────────────────────────
// 共通ヘルパー
// ───────────────────────────────────────────────
function mkMesh(geo, color, opts = {}) {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0.1,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveInt ?? 0,
  }));
}
function mkBox(w, h, d, color, opts)    { return mkMesh(new THREE.BoxGeometry(w, h, d), color, opts); }
function mkSphere(r, color, opts)       { return mkMesh(new THREE.SphereGeometry(r, 20, 20), color, opts); }
function mkCone(r, h, color, opts)      { return mkMesh(new THREE.ConeGeometry(r, h, 10), color, opts); }
function mkCyl(rt, rb, h, color, opts)  { return mkMesh(new THREE.CylinderGeometry(rt, rb, h, 10), color, opts); }

// ───────────────────────────────────────────────
// Chapter 1 — スライム系共通ベース
// ───────────────────────────────────────────────

/** シンプルなスライム顔（目2つ＋口）を group に追加する */
function addSimpleSlimeFace(group, r, eyeOpts = {}) {
  const {
    eyeScale   = 1.0,   // 目の大きさ倍率
    eyeTilt    = 0,     // 目の傾き（たれ目：正、つり目：負）
    eyeSpread  = 0.38,  // 目の左右広がり
    eyeY       = 0.15,  // 目の高さオフセット
    mouthCurve = -1,    // -1=笑顔、+1=への字
    eyeColor   = 0x1a1a2e,
    whiteColor = 0xffffff,
  } = eyeOpts;

  const whiteMat = new THREE.MeshStandardMaterial({ color: whiteColor, roughness: 0.2 });
  const blackMat = new THREE.MeshStandardMaterial({ color: eyeColor,   roughness: 0.4 });
  const hlMat    = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x221122, roughness: 0.5 });

  [-1, 1].forEach(side => {
    const eg = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24 * eyeScale, 14, 14), whiteMat);
    white.scale.set(1.0, 1.2, 0.75);
    eg.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13 * eyeScale, 10, 10), blackMat);
    pupil.position.z = r * 0.14;
    eg.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.05 * eyeScale, 6, 6), hlMat);
    hl.position.set(-r * 0.05, r * 0.06, r * 0.22);
    eg.add(hl);
    const angle = side * eyeSpread;
    eg.position.set(Math.sin(angle) * r * 0.85, r * (0.48 + eyeY), Math.cos(angle) * r * 0.85);
    eg.rotation.z = side * eyeTilt;
    group.add(eg);
  });

  // 口
  const mouthPts = [];
  for (let i = 0; i <= 12; i++) {
    const t  = i / 12;
    const mx = (t - 0.5) * r * 0.7;
    const my = mouthCurve * (4 * (t - 0.5) ** 2 - 1) * r * 0.1;
    const mz = Math.sqrt(Math.max(0, r * r - mx * mx)) * 0.88;
    mouthPts.push(new THREE.Vector3(mx, r * (0.22 + eyeY) + my, mz));
  }
  const mouth = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPts), 14, r * 0.035, 6, false),
    mouthMat
  );
  group.add(mouth);
}

// Stage1: シンプルかわいいスライム
function buildSlimeStage1(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 24), mat);
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, { eyeScale: 1.0, mouthCurve: -1 });
  return { mesh };
}

// Stage2: ぬめりスライム（大きいたれ目、ほっぺ、ぷるぷる感）
function buildSlimeStage2(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 24), mat);
  mesh.scale.set(1.05, 0.92, 1.05); // 少し横に広い
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, { eyeScale: 1.25, eyeTilt: 0.18, mouthCurve: -1, eyeY: 0.12 });
  // ほっぺの赤み
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9999, transparent: true, opacity: 0.4, roughness: 1 });
  [-1, 1].forEach(side => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6), cheekMat);
    cheek.scale.set(1.3, 0.6, 0.5);
    cheek.position.set(side * r * 0.62, r * 0.28, r * 0.72);
    group.add(cheek);
  });
  // 底のぷるっとした膨らみ
  const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 14, 10), mat);
  belly.scale.set(1.1, 0.45, 1.1);
  belly.position.y = -r * 0.55;
  group.add(belly);
  return { mesh };
}

// Stage3: くさスライム（触角2本＋太眉）
function buildSlimeStage3(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 24), mat);
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, { eyeScale: 1.0, mouthCurve: -0.5, eyeY: 0.1 });

  // 触角（2本）
  [-1, 1].forEach(side => {
    const stalk = mkCyl(r*0.05, r*0.07, r*0.55, 0x2d7a18, { rough: 0.7 });
    stalk.position.set(side * r * 0.28, r * 1.12, 0);
    stalk.rotation.z = side * 0.3;
    group.add(stalk);
    const tip = mkSphere(r * 0.14, 0x44cc22, { emissive: 0x228800, emissiveInt: 0.3 });
    tip.position.set(side * r * 0.38, r * 1.46, 0);
    group.add(tip);
  });

  // 太眉
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1a5c10, roughness: 0.8 });
  [-1, 1].forEach(side => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 0.32, r * 0.07, r * 0.08), browMat);
    brow.position.set(side * r * 0.32, r * 0.72, r * 0.78);
    brow.rotation.z = side * 0.2;
    group.add(brow);
  });
  return { mesh };
}

// Stage4: どろスライム（ひび割れコブ＋つり目）
function buildSlimeStage4(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 20), mat);
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, {
    eyeScale: 1.1, eyeTilt: -0.22, mouthCurve: 0.6,
    eyeColor: 0xff3300, eyeY: 0.18,
  });

  // 表面のコブ（岩っぽい）
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.95 });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 7, 5), knobMat);
    knob.scale.set(1, 0.6, 1);
    knob.position.set(Math.cos(angle) * r * 0.78, Math.sin(angle) * r * 0.2, Math.sin(angle) * r * 0.5);
    group.add(knob);
  }

  // ひび割れライン（薄い板）
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(r * 0.04, r * 0.55, r * 0.04), crackMat);
    crack.position.set((i - 1) * r * 0.3, r * 0.1, r * 0.9);
    crack.rotation.z = (i - 1) * 0.25;
    group.add(crack);
  }
  return { mesh };
}

// Stage5: きのこスライム（頭にきのこが生えてる）
function buildSlimeStage5(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 24), mat);
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, {
    eyeScale: 1.05, mouthCurve: -0.8, eyeY: 0.08,
    eyeColor: 0x440066,
  });

  // 頭の中心にきのこ（大）
  const stemBig = mkCyl(r*0.1, r*0.12, r*0.38, 0xddbbcc, { rough: 0.7 });
  stemBig.position.set(0, r * 1.22, 0);
  group.add(stemBig);
  const capBig = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    new THREE.MeshStandardMaterial({ color: 0xee66cc, roughness: 0.5, emissive: 0xaa2288, emissiveIntensity: 0.4 })
  );
  capBig.position.set(0, r * 1.44, 0);
  group.add(capBig);

  // 小さいきのこ（左右）
  [-1, 1].forEach(side => {
    const stem = mkCyl(r*0.06, r*0.07, r*0.22, 0xddbbcc, { rough: 0.7 });
    stem.position.set(side * r * 0.38, r * 1.05, 0);
    stem.rotation.z = side * 0.3;
    group.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xff88cc, roughness: 0.5, emissive: 0x882266, emissiveIntensity: 0.3 })
    );
    cap.position.set(side * r * 0.44, r * 1.2, 0);
    group.add(cap);
  });

  // 胞子の光（発光）
  const sporeLight = new THREE.PointLight(0xff44cc, 0.8, 4);
  sporeLight.position.set(0, r * 1.3, 0);
  group.add(sporeLight);
  return { mesh };
}

// Stage6: 古王スライム（王冠付き、威厳のある顔）
function buildSlimeStage6(group, s, mat) {
  const r = s.radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 28), mat);
  mesh.castShadow = true;
  group.add(mesh);
  addSimpleSlimeFace(group, r, {
    eyeScale: 1.2, eyeTilt: -0.12, mouthCurve: 0.3,
    eyeColor: 0x331100, whiteColor: 0xffeecc, eyeY: 0.2,
  });

  // 王冠（5つの突起）
  const crownBase = mkCyl(r*0.55, r*0.58, r*0.18, 0xffd700, { rough: 0.2, metal: 0.9, emissive: 0xaa8800, emissiveInt: 0.3 });
  crownBase.position.y = r * 1.08;
  group.add(crownBase);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = mkCone(r*0.10, r*0.32, 0xffd700, { rough: 0.2, metal: 0.9, emissive: 0xaa8800, emissiveInt: 0.3 });
    spike.position.set(Math.cos(angle) * r * 0.52, r * 1.28, Math.sin(angle) * r * 0.52);
    group.add(spike);
    // 宝石
    const gem = mkSphere(r * 0.08, i % 2 === 0 ? 0xff2244 : 0x2244ff, { emissive: i % 2 === 0 ? 0xcc0022 : 0x0022cc, emissiveInt: 0.8, rough: 0.1 });
    gem.position.set(Math.cos(angle) * r * 0.52, r * 1.38, Math.sin(angle) * r * 0.52);
    group.add(gem);
  }

  // オーラ（金色の発光）
  const aura = new THREE.PointLight(0xffd700, 1.5, 6);
  aura.position.set(0, r * 0.5, 0);
  group.add(aura);

  // マント風のひだ（底部に広がり感）
  const mantleMat = new THREE.MeshStandardMaterial({
    color: 0x6600aa, transparent: true, opacity: 0.7,
    roughness: 0.6, emissive: 0x330066, emissiveIntensity: 0.2
  });
  const mantle = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.85, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.35),
    mantleMat
  );
  mantle.scale.set(1.25, 1.0, 1.25);
  mantle.position.y = -r * 0.25;
  group.add(mantle);

  return { mesh };
}

// ───────────────────────────────────────────────
// Chapter 2+ — 異形モンスター系
// ───────────────────────────────────────────────

function buildMonsterGolem(group, s, mat) {
  const r = s.radius;
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.9, 1), mat);
  body.scale.set(1.0, 1.15, 0.9);
  body.castShadow = true;
  group.add(body);
  const head = mkSphere(r * 0.56, 0x556677, { rough: 0.8 });
  head.position.set(0, r * 1.55, 0);
  head.scale.set(1, 1.1, 0.9);
  group.add(head);
  [-1, 1].forEach(side => {
    const eye = mkSphere(r * 0.10, 0xff2200, { emissive: 0xff2200, emissiveInt: 1.0, rough: 0.3 });
    eye.position.set(side * r * 0.22, r * 1.65, r * 0.48);
    group.add(eye);
  });
  const upperArmL = mkCyl(r*0.22, r*0.28, r*0.9, 0x445566, { rough: 0.85 });
  upperArmL.rotation.z = -0.8;
  upperArmL.position.set(-r*0.95, r*0.4, 0);
  const fistL = new THREE.Mesh(new THREE.DodecahedronGeometry(r*0.32, 0), new THREE.MeshStandardMaterial({ color: 0x3a4a55, roughness: 0.9 }));
  fistL.position.set(-r*1.5, r*0.0, 0);
  const upperArmR = mkCyl(r*0.22, r*0.28, r*0.9, 0x445566, { rough: 0.85 });
  upperArmR.rotation.z = 1.0;
  upperArmR.position.set(r*0.95, r*0.6, 0);
  const fistR = new THREE.Mesh(new THREE.DodecahedronGeometry(r*0.32, 0), new THREE.MeshStandardMaterial({ color: 0x3a4a55, roughness: 0.9 }));
  fistR.position.set(r*1.55, r*0.15, 0);
  group.add(upperArmL, fistL, upperArmR, fistR);
  [-1, 1].forEach(side => {
    const leg = mkCyl(r*0.26, r*0.32, r*0.7, 0x3a4a50, { rough: 0.9 });
    leg.position.set(side * r * 0.4, -r * 0.55, 0);
    group.add(leg);
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const knob = new THREE.Mesh(new THREE.DodecahedronGeometry(r*0.14, 0), new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.95 }));
    knob.position.set(Math.cos(angle)*r*0.8, Math.sin(angle)*r*0.3, Math.sin(angle)*r*0.3);
    group.add(knob);
  }
  return { mesh: body };
}

function buildMonsterPlant(group, s, mat) {
  const r = s.radius;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), mat);
  body.scale.set(0.95, 1.1, 0.95);
  body.castShadow = true;
  group.add(body);
  const head = mkSphere(r*0.55, 0x1a5c10, { rough: 0.7 });
  head.scale.set(1.1, 0.8, 1.1);
  head.position.set(0, r*1.45, 0);
  group.add(head);
  [-1, 1].forEach(side => {
    const eye = mkSphere(r*0.11, 0xffee00, { emissive: 0xddcc00, emissiveInt: 0.8, rough: 0.2 });
    eye.position.set(side*r*0.25, r*1.52, r*0.45);
    group.add(eye);
    const pupil = mkSphere(r*0.055, 0x0a0a00, { rough: 0.5 });
    pupil.scale.set(0.4, 1.0, 0.5);
    pupil.position.set(side*r*0.25, r*1.52, r*0.52);
    group.add(pupil);
  });
  [
    { ax: -1.1, ay: 0.3, az: 0.3, rx: 0.3, rz: -0.5 },
    { ax:  1.1, ay: 0.3, az: 0.3, rx: 0.3, rz:  0.5 },
    { ax: -0.7, ay:-0.3, az: 0.5, rx: 0.6, rz: -0.3 },
    { ax:  0.7, ay:-0.3, az: 0.5, rx: 0.6, rz:  0.3 },
  ].forEach(({ ax, ay, az, rx, rz }) => {
    const vine = mkCyl(r*0.07, r*0.12, r*1.1, 0x2d7a18, { rough: 0.9 });
    vine.position.set(ax*r, ay*r, az*r);
    vine.rotation.set(rx, 0, rz);
    group.add(vine);
    const leaf = mkSphere(r*0.2, 0x44bb22, { rough: 0.6 });
    leaf.scale.set(1.3, 0.5, 1.3);
    leaf.position.set(ax*r*1.55, ay*r + Math.sin(rz)*r*0.7, az*r + Math.cos(rx)*r*0.2);
    group.add(leaf);
  });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = mkCone(r*0.10, r*0.45, 0x33aa22, { rough: 0.7 });
    spike.position.set(Math.cos(angle)*r*0.38, r*1.9, Math.sin(angle)*r*0.38);
    spike.rotation.z = Math.cos(angle)*0.5;
    spike.rotation.x = Math.sin(angle)*0.5;
    group.add(spike);
  }
  return { mesh: body };
}

function buildMonsterBehemoth(group, s, mat) {
  const r = s.radius;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
  body.scale.set(1.4, 0.85, 1.1);
  body.castShadow = true;
  group.add(body);
  const neck = mkCyl(r*0.38, r*0.44, r*0.6, 0x775533, { rough: 0.85 });
  neck.position.set(0, r*0.55, r*0.7);
  neck.rotation.x = -0.5;
  group.add(neck);
  const head = mkSphere(r*0.65, 0x886644, { rough: 0.8 });
  head.scale.set(1.25, 0.85, 1.0);
  head.position.set(0, r*0.85, r*1.35);
  group.add(head);
  [-1, 1].forEach(side => {
    const nostril = mkSphere(r*0.09, 0x331100, { rough: 0.95 });
    nostril.position.set(side*r*0.18, r*0.72, r*1.85);
    group.add(nostril);
    const eye = mkSphere(r*0.11, 0xff8800, { emissive: 0xff6600, emissiveInt: 0.7, rough: 0.3 });
    eye.position.set(side*r*0.38, r*1.05, r*1.55);
    group.add(eye);
    const horn = mkCone(r*0.12, r*0.55, 0x664422, { rough: 0.7 });
    horn.position.set(side*r*0.3, r*1.45, r*1.2);
    horn.rotation.z = side*0.3; horn.rotation.x = -0.4;
    group.add(horn);
  });
  [
    { x: -0.75, z: -0.6 }, { x:  0.75, z: -0.6 },
    { x: -0.75, z:  0.5 }, { x:  0.75, z:  0.5 },
  ].forEach(({ x, z }) => {
    const leg = mkCyl(r*0.22, r*0.28, r*0.85, 0x664422, { rough: 0.85 });
    leg.position.set(x*r*1.1, -r*0.55, z*r);
    group.add(leg);
    const hoof = mkSphere(r*0.28, 0x443322, { rough: 0.95 });
    hoof.scale.set(1.1, 0.6, 1.1);
    hoof.position.set(x*r*1.1, -r*1.05, z*r);
    group.add(hoof);
  });
  return { mesh: body };
}

function buildMonsterMushroom(group, s, mat) {
  const r = s.radius;
  const torso = mkCyl(r*0.38, r*0.44, r*1.2, 0xcc6699, { rough: 0.6 });
  torso.position.y = r*0.1;
  group.add(torso);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r*1.15, 24, 16, 0, Math.PI*2, 0, Math.PI*0.58), mat);
  cap.castShadow = true;
  cap.position.y = r*0.85;
  group.add(cap);
  const gill = mkCyl(r*0.42, r*1.0, r*0.12, 0xff88cc, { rough: 0.4, emissive: 0xdd44aa, emissiveInt: 0.5 });
  gill.position.y = r*0.75;
  group.add(gill);
  for (let i = 0; i < 7; i++) {
    const angle = (i/7)*Math.PI*2;
    const spot = mkSphere(r*0.13, 0xffffff, { rough: 0.5 });
    spot.position.set(Math.cos(angle)*r*0.65, r*0.95 + Math.sin(angle)*r*0.15, Math.sin(angle)*r*0.65);
    group.add(spot);
  }
  [-1, 1].forEach(side => {
    const eye = mkSphere(r*0.12, 0x440066, { emissive: 0x8800cc, emissiveInt: 1.0, rough: 0.2 });
    eye.position.set(side*r*0.3, r*0.72, r*0.85);
    group.add(eye);
    const arm = mkCyl(r*0.09, r*0.12, r*0.95, 0xcc6699, { rough: 0.7 });
    arm.rotation.z = side*1.1;
    arm.position.set(side*r*0.72, r*0.22, 0);
    group.add(arm);
    const spore = mkSphere(r*0.22, 0x88ff44, { emissive: 0x44cc00, emissiveInt: 0.8, rough: 0.3 });
    spore.position.set(side*r*1.4, -r*0.22, 0);
    group.add(spore);
    const leg = mkCyl(r*0.11, r*0.14, r*1.0, 0xaa5588, { rough: 0.75 });
    leg.rotation.z = side*0.18;
    leg.position.set(side*r*0.22, -r*0.65, 0);
    group.add(leg);
  });
  return { mesh: cap };
}

function buildMonsterGaganthos(group, s, mat) {
  const r = s.radius;
  const dark = 0x4a1a88, gold = 0xffd700;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r*1.0, 24, 20), mat);
  body.scale.set(0.95, 1.25, 0.88);
  body.castShadow = true;
  group.add(body);
  const neck = mkCyl(r*0.42, r*0.5, r*0.7, dark, { rough: 0.5, metal: 0.2 });
  neck.position.set(0, r*1.2, 0);
  group.add(neck);
  const head = mkSphere(r*0.72, dark, { rough: 0.4, metal: 0.25 });
  head.scale.set(1.15, 0.95, 1.2);
  head.position.set(0, r*1.88, 0);
  group.add(head);
  const jaw = mkBox(r*0.55, r*0.22, r*0.7, 0x5a2a99, { rough: 0.5 });
  jaw.position.set(0, r*1.68, r*0.55);
  group.add(jaw);
  [-1, -0.35, 0.35, 1].forEach(t => {
    const fang = mkCone(r*0.07, r*0.28, 0xeeeeff, { rough: 0.3, emissive: 0xaaaaff, emissiveInt: 0.4 });
    fang.rotation.x = Math.PI;
    fang.position.set(t*r*0.25, r*1.58, r*0.78);
    group.add(fang);
  });
  [-1, 1].forEach(side => {
    const eye = mkSphere(r*0.15, gold, { emissive: 0xffaa00, emissiveInt: 1.2, rough: 0.1 });
    eye.position.set(side*r*0.38, r*1.98, r*0.62);
    group.add(eye);
    const horn = mkCone(r*0.15, r*0.85, gold, { rough: 0.3, metal: 0.8, emissive: 0xaa8800, emissiveInt: 0.3 });
    horn.position.set(side*r*0.42, r*2.42, 0);
    horn.rotation.z = side*0.35;
    group.add(horn);
    const wing = new THREE.Group();
    const bone1 = mkCyl(r*0.08, r*0.12, r*1.2, dark, { rough: 0.4, metal: 0.3 });
    bone1.rotation.z = side*1.0;
    bone1.position.set(side*r*0.55, r*0.35, 0);
    wing.add(bone1);
    const membrane = new THREE.Mesh(
      new THREE.SphereGeometry(r*0.9, 12, 8, side > 0 ? 0 : Math.PI, Math.PI, 0.1, Math.PI*0.7),
      new THREE.MeshStandardMaterial({ color: 0x6600bb, transparent: true, opacity: 0.65, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x330066, emissiveIntensity: 0.3 })
    );
    membrane.scale.set(1.6, 1.0, 0.5);
    membrane.rotation.x = 0.3;
    membrane.position.set(side*r*1.1, r*0.5, 0.1);
    wing.add(membrane);
    group.add(wing);
    const upperArm = mkCyl(r*0.28, r*0.35, r*0.85, dark, { rough: 0.4, metal: 0.2 });
    upperArm.rotation.z = side*0.7;
    upperArm.position.set(side*r*1.0, r*0.3, 0);
    group.add(upperArm);
  });
  const thirdEye = mkSphere(r*0.18, 0xff4444, { emissive: 0xff0000, emissiveInt: 1.5, rough: 0.1 });
  thirdEye.position.set(0, r*2.18, r*0.55);
  group.add(thirdEye);
  const aura = new THREE.PointLight(0x9b5de5, 2.5, 8);
  aura.position.set(0, r*0.5, 0);
  group.add(aura);
  return { mesh: body };
}

// ───────────────────────────────────────────────
// エクスポート：chapter と stageNo で振り分け
// ───────────────────────────────────────────────
const CHAPTER2_MONSTERS = [
  buildMonsterGolem,
  buildMonsterPlant,
  buildMonsterBehemoth,
  buildMonsterMushroom,
  buildMonsterGaganthos,
];

function buildBossModel(group, stage, mat) {
  if (stage.chapter === 1) {
    // Chapter1 はすべてスライム、stageNoで見た目を変える
    switch (stage.stageNo) {
      case 1: return buildSlimeStage1(group, stage, mat);
      case 2: return buildSlimeStage2(group, stage, mat);
      case 3: return buildSlimeStage3(group, stage, mat);
      case 4: return buildSlimeStage4(group, stage, mat);
      case 5: return buildSlimeStage5(group, stage, mat);
      case 6: return buildSlimeStage6(group, stage, mat);
      default: return buildSlimeStage1(group, stage, mat);
    }
  } else {
    // Chapter2+ は異形モンスターを順番に出す
    // Chapter2の1体目→インデックス0、2体目→1、...
    const chapterStageIndex = stage.stageNo - 1; // Chapter内でのステージ番号（0始まり）
    const builder = CHAPTER2_MONSTERS[chapterStageIndex % CHAPTER2_MONSTERS.length];
    return builder(group, stage, mat);
  }
}
