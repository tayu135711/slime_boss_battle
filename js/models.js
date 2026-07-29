/* =========================================================
   models.js — Three.js プリミティブによる3Dモデル生成
   依存: THREE (three.min.js)
   読み込み順: config.js → models.js
========================================================= */

/* ---------------------------------------------------------
   ユーティリティ: 岩・宝箱
--------------------------------------------------------- */

/** 装飾用の岩を生成して返す */
function makeRock(x, z) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.4, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8378, flatShading: true })
  );
  rock.position.set(x, 0.4, z);
  rock.castShadow = true;
  return rock;
}

/** 装飾用の木を生成して返す (2026/07/25 追加: ステージ2「森」テーマ用) */
function makeTree(x, z) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, flatShading: true, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 7), trunkMat);
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, flatShading: true, roughness: 0.85 });
  const leafColors = [0x2f6b2f, 0x387a38, 0x275c27];
  for (let i = 0; i < 3; i++) {
    const s = 0.55 - i * 0.1;
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.55 - i * 0.12, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], flatShading: true, roughness: 0.85 })
    );
    leaf.position.y = 1.15 + i * 0.45;
    leaf.castShadow = true;
    g.add(leaf);
  }

  g.position.set(x, 0, z);
  const scale = 0.9 + Math.random() * 0.4;
  g.scale.set(scale, scale, scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/** 装飾用のヤシの木を生成して返す (2026/07/28 追加: ステージ3「フルーツパーラーのしま」用) */
function makePalmTree(x, z) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xa88450, flatShading: true, roughness: 0.85 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.7, 6), trunkMat);
  trunk.position.y = 0.85;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.95, 4), leafMat);
    leaf.position.set(Math.cos(angle) * 0.15, 1.75, Math.sin(angle) * 0.15);
    leaf.rotation.x = Math.PI / 2 - 0.5;
    leaf.rotation.z = -angle;
    g.add(leaf);
  }

  // ココナッツの実
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5a3c1e, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), coconutMat);
    const angle = (i / 3) * Math.PI * 2;
    nut.position.set(Math.cos(angle) * 0.16, 1.6, Math.sin(angle) * 0.16);
    g.add(nut);
  }

  g.position.set(x, 0, z);
  const scale = 0.9 + Math.random() * 0.4;
  g.scale.set(scale, scale, scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/**
 * 海面に浮かぶ岩礁を生成して返す (2026/07/28 追加: ステージ4「カニ軍団のしま」用)
 * 当たり判定つきの障害物として obstacles 配列に登録して使うことを想定。
 */
function makeReefRock(x, z) {
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6a68, flatShading: true, roughness: 0.9 });
  const rockCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < rockCount; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.35, 0), rockMat);
    rock.position.set((Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.15, (Math.random() - 0.5) * 0.6);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = true;
    g.add(rock);
  }
  // 海藻(緑のとげとげ)を少し生やす
  const seaweedMat = new THREE.MeshStandardMaterial({ color: 0x3f8a5a, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const weed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), seaweedMat);
    const angle = Math.random() * Math.PI * 2;
    weed.position.set(Math.cos(angle) * 0.4, 0.1, Math.sin(angle) * 0.4);
    weed.rotation.z = (Math.random() - 0.5) * 0.6;
    g.add(weed);
  }
  g.position.set(x, 0, z);
  return g;
}

/**
 * イカダの見た目モデルを生成して返す (2026/07/28 追加: ステージ4「カニ軍団のしま」用)
 * プレイヤー/パーティの足元に重ねて表示し、海の上を移動している見た目にする。
 */
function buildRaft() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, flatShading: true, roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 8), woodMat);
    log.rotation.z = Math.PI / 2;
    log.position.set(0, 0.02, -0.5 + i * 0.25);
    log.castShadow = true;
    g.add(log);
  }
  // 縛っているロープ(前後2本)
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6a4a28, flatShading: true });
  [-0.5, 0.5].forEach(zOff => {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 6), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(0, 0.09, zOff);
    g.add(rope);
  });
  return g;
}
function buildChest() {
  const g       = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd9a13c, flatShading: true });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.92), woodMat);
  base.position.y = 0.4; base.castShadow = true;
  g.add(base);

  const band1 = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.0), trimMat);
  band1.position.y = 0.4;
  g.add(band1);

  // ふた: 奥側(-z)のちょうつがいを軸に開閉できるよう、専用のヒンジグループでラップする
  // (2026/07/26 追加: 開封モーション用。g.userData.lidHingeを回転させると蓋が開く)
  const lidHinge = new THREE.Group();
  lidHinge.position.set(0, 0.8, -0.48);
  g.add(lidHinge);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.44, 0.96), woodMat);
  lid.position.set(0, 0.22, 0.48);
  lid.castShadow = true;
  lidHinge.add(lid);

  const band2 = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.0), trimMat);
  band2.position.set(0, 0.22, 0.48);
  lidHinge.add(band2);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.12), trimMat);
  lock.position.set(0, -0.1, 0.98);
  lidHinge.add(lock);

  // 宝石飾り
  const gemMat = new THREE.MeshBasicMaterial({ color: 0x4adfff });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gemMat);
  gem.position.set(0, -0.1, 1.0);
  lidHinge.add(gem);

  // 金色の角鉄 (本体側)
  [[-0.68, -0.45], [0.68, -0.45], [-0.68, 0.45], [0.68, 0.45]].forEach(([bx, bz]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 0.14), trimMat);
    corner.position.set(bx, 0.44, bz);
    g.add(corner);
  });

  g.userData.lidHinge = lidHinge;

  return g;
}

/** 回復地点(いやしのいずみ)メッシュを生成して返す。中央の水晶+浮遊する光の粒で回復スポットとわかるようにする */
function buildHealSpring() {
  const g = new THREE.Group();

  const basinMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, flatShading: true, roughness: 1 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.16, 12), basinMat);
  basin.position.y = 0.08;
  g.add(basin);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x6fe0d0, transparent: true, opacity: 0.85, roughness: 0.2 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), waterMat);
  water.position.y = 0.17;
  g.add(water);

  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xb0fff0 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystalMat);
  crystal.position.y = 0.5;
  g.add(crystal);

  const glowLight = new THREE.PointLight(0x7fffe0, 1.0, 4.5, 2);
  glowLight.position.y = 0.55;
  g.add(glowLight);

  // 周囲を漂う光の粒(回復スポットの目印。ふわふわアニメーションさせる)
  const motes = [];
  for (let i = 0; i < 5; i++) {
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xe0fff8 })
    );
    const angle = (i / 5) * Math.PI * 2;
    mote.position.set(Math.cos(angle) * 0.55, 0.35 + Math.random() * 0.3, Math.sin(angle) * 0.55);
    g.add(mote);
    motes.push(mote);
  }

  g.userData.crystal = crystal;
  g.userData.motes    = motes;
  g.userData.light    = glowLight;
  g.userData.phase    = Math.random() * Math.PI * 2;

  return g;
}

/* ---------------------------------------------------------
   ヤシの木 (島マップ用)
--------------------------------------------------------- */
function buildPalmTree(x, z, scale) {
  const g      = new THREE.Group();
  const trunk  = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a7a4a })
  );
  trunk.position.y = 0.9;
  trunk.rotation.z = 0.12;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3fae4f, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 4), leafMat);
    leaf.position.set(Math.cos(angle) * 0.32, 1.85, Math.sin(angle) * 0.32);
    leaf.rotation.x = Math.PI / 2.2;
    leaf.rotation.y = angle;
    g.add(leaf);
  }

  const coconut = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20 })
  );
  coconut.position.y = 1.72;
  g.add(coconut);

  g.position.set(x, 0, z);
  g.scale.set(scale, scale, scale);
  return g;
}

/* ---------------------------------------------------------
   トレーナー (プレイヤー・島プレイヤー共用)
--------------------------------------------------------- */
/**
 * 主人公(トレーナー)モデル。
 * (2026/07/28 修正: 「もっとかわいく」との要望を受けて、頭でっかちの
 *  ちび体型+大きなキラキラ目+ほっぺの赤みに全面リデザイン。
 *  帽子・ジャケット・リュックの色は変えず、シルエットの見分けは維持した)
 */
function buildTrainerModel() {
  const g      = new THREE.Group();
  const skin   = new THREE.MeshStandardMaterial({ color: 0xffd9b0, flatShading: true });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2f6fd0, flatShading: true });
  const pants  = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd03030, flatShading: true });
  const blush  = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.8 });

  // 短い脚 (ちび体型)
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 8), pants);
  legL.position.set(-0.15, 0.17, 0); legL.castShadow = true;
  g.add(legL);

  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 8), pants);
  legR.position.set(0.15, 0.17, 0); legR.castShadow = true;
  g.add(legR);

  // 胴体 (頭でっかちにするため一回り小さく)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.5, 10), jacket);
  torso.position.y = 0.62; torso.castShadow = true;
  g.add(torso);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8), jacket);
  armL.position.set(-0.42, 0.66, 0); armL.rotation.z = 0.18; armL.castShadow = true;
  g.add(armL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skin);
  handL.position.set(0, -0.24, 0); // 腕ローカル座標
  armL.add(handL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8), jacket);
  armR.position.set(0.42, 0.66, 0); armR.rotation.z = -0.18; armR.castShadow = true;
  g.add(armR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skin);
  handR.position.set(0, -0.24, 0); // 腕ローカル座標
  armR.add(handR);

  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffcd3c, flatShading: true })
  );
  pack.position.set(0, 0.64, -0.28); pack.castShadow = true;
  g.add(pack);

  // 頭 (主役。胴体よりひとまわり大きくして頭でっかちに)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), skin);
  head.position.y = 1.14; head.castShadow = true;
  g.add(head);

  // ほっぺの赤み
  [-0.29, 0.29].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), blush);
    cheek.position.set(ex, 1.08, 0.355);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  // 目 (大きなキラキラ目+ハイライト2つ)
  const eyeMat       = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), eyeMat);
    eye.position.set(ex, 1.12, 0.42);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), highlightMat);
    hl1.position.set(ex + 0.024, 1.15, 0.48);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), highlightMat);
    hl2.position.set(ex - 0.02, 1.09, 0.48);
    g.add(hl2);
  });

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.013, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x8a4a3a })
  );
  mouth.position.set(0, 1.0, 0.44);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  const capTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    capMat
  );
  capTop.position.y = 1.42; capTop.castShadow = true;
  g.add(capTop);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), capMat);
  brim.position.set(0, 1.44, 0.14); brim.castShadow = true;
  g.add(brim);

  // ウォークアニメ用に参照を保存
  g.userData.legL      = legL;
  g.userData.legR      = legR;
  g.userData.armL      = armL;
  g.userData.armR      = armR;
  g.userData.walkPhase = 0;

  return g;
}

/**
 * タケオさん (島の案内役NPC。2026/07/26 追加)
 * 将来ボスになる予定なので、釣り竿と細めの目でさりげなく伏線を仕込んでいる。
 */
function buildTakeoNPC() {
  const g = new THREE.Group();
  const skin  = new THREE.MeshStandardMaterial({ color: 0xc9895a, flatShading: true });
  const vest  = new THREE.MeshStandardMaterial({ color: 0xd9722c, flatShading: true });
  const pants = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, flatShading: true });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xe8d29a, flatShading: true });

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8), pants);
  legL.position.set(-0.17, 0.25, 0); legL.castShadow = true;
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8), pants);
  legR.position.set(0.17, 0.25, 0); legR.castShadow = true;
  g.add(legR);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.7, 10), skin);
  torso.position.y = 0.88; torso.castShadow = true;
  g.add(torso);

  // はっぴ風のベスト
  const vestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.52, 0.72, 10, 1, true, -Math.PI * 0.35, Math.PI * 1.7),
    vest
  );
  vestMesh.position.y = 0.88;
  g.add(vestMesh);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.58, 8), skin);
  armL.position.set(-0.52, 0.88, 0); armL.rotation.z = 0.2; armL.castShadow = true;
  g.add(armL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
  handL.position.set(0, -0.33, 0);
  armL.add(handL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.58, 8), skin);
  armR.position.set(0.52, 0.88, 0); armR.rotation.z = -0.2; armR.castShadow = true;
  g.add(armR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
  handR.position.set(0, -0.33, 0);
  armR.add(handR);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 14, 12), skin);
  head.position.y = 1.5; head.castShadow = true;
  g.add(head);

  // 太い眉 (意志の強そうな表情)
  const browMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a });
  [-0.14, 0.14].forEach((ex, i) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), browMat);
    brow.position.set(ex, 1.6, 0.32);
    brow.rotation.z = i === 0 ? 0.15 : -0.15;
    g.add(brow);
  });

  // 目 (少し細め = どこか含みのある表情。伏線)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.13, 0.13].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
    eye.scale.set(1, 0.65, 1);
    eye.position.set(ex, 1.53, 0.34);
    g.add(eye);
  });

  // 口ひげ
  const mustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.045, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
  );
  mustache.position.set(0, 1.42, 0.35);
  g.add(mustache);

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.014, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x8a4a3a })
  );
  mouth.position.set(0, 1.37, 0.34);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  // 麦わら帽子
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), hatMat);
  hatBrim.position.y = 1.78;
  g.add(hatBrim);
  const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 12), hatMat);
  hatTop.position.y = 1.94;
  g.add(hatTop);
  const hatBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.025, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a2020 })
  );
  hatBand.rotation.x = Math.PI / 2;
  hatBand.position.y = 1.82;
  g.add(hatBand);

  // 釣り竿 (さりげない伏線。後にボス化したときの武器モチーフにする想定)
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a })
  );
  rod.position.set(-0.3, 1.3, -0.35);
  rod.rotation.set(-0.15, 0, 0.5);
  g.add(rod);
  const rodLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4),
    new THREE.MeshBasicMaterial({ color: 0xd8d8d8 })
  );
  rodLine.position.set(-0.7, 0.9, -0.55);
  rodLine.rotation.z = 0.5;
  g.add(rodLine);

  // ウォークアニメ用に参照を保存 (今は待機のみだが、将来歩かせる場合にも使えるように)
  g.userData.legL      = legL;
  g.userData.legR      = legR;
  g.userData.armL      = armL;
  g.userData.armR      = armR;
  g.userData.walkPhase = 0;

  return g;
}

/**
 * スイートポテト (どうぐやの売り子NPC。2026/07/27 追加。今後の重要人物候補なので
 * 最上級にかわいいデザインにしている: 頭でっかちのちび体型・大きなキラキラ目・
 * 赤いほっぺ・リボン付き)
 * さつまいもモチーフ: 紫の丸っこい胴体+葉っぱの髪+前掛け。
 * どうぐや画面遷移でカウンターの奥に立たせて使う。
 */
function buildSweetPotatoNPC() {
  const g = new THREE.Group();
  const skin   = new THREE.MeshStandardMaterial({ color: 0x9a5cae, flatShading: true }); // さつまいもの皮 (少し明るめの紫)
  const belly  = new THREE.MeshStandardMaterial({ color: 0xffe3ae, flatShading: true }); // 中の黄色い部分(お腹)
  const blush  = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.85 }); // ほっぺの赤み
  const leaf   = new THREE.MeshStandardMaterial({ color: 0x6fc95a, flatShading: true }); // 葉っぱ
  const apron  = new THREE.MeshStandardMaterial({ color: 0xfff6e6, flatShading: true });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0xe8506a, flatShading: true });

  // 胴体 (ちび体型: 頭でっかちにするため小さめの丸い胴体にする)
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin);
  torso.scale.set(1, 0.92, 0.95);
  torso.position.y = 0.42; torso.castShadow = true;
  g.add(torso);

  // 前掛け (売り子らしさ)
  const apronMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.27, 0.4, 10, 1, true, -Math.PI * 0.4, Math.PI * 0.8),
    apron
  );
  apronMesh.position.set(0, 0.36, 0.03);
  g.add(apronMesh);

  // お腹の黄色いのぞき (さつまいもを切った断面のイメージ)
  const bellyPatch = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), belly);
  bellyPatch.position.set(0, 0.5, 0.29);
  g.add(bellyPatch);

  // 短い手足 (ちびキャラなのでごく短く)
  const legL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skin);
  legL.position.set(-0.15, 0.1, 0.04); g.add(legL);
  const legR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skin);
  legR.position.set(0.15, 0.1, 0.04); g.add(legR);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), skin);
  armL.position.set(-0.33, 0.46, 0); armL.rotation.z = 0.4; armL.castShadow = true;
  g.add(armL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skin);
  handL.position.set(0, -0.17, 0);
  armL.add(handL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), skin);
  armR.position.set(0.33, 0.46, 0); armR.rotation.z = -0.4; armR.castShadow = true;
  g.add(armR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skin);
  handR.position.set(0, -0.17, 0);
  armR.add(handR);

  // 頭 (ちび体型の主役。胴体よりひとまわり以上大きくして「頭でっかち」に)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), skin);
  head.position.y = 1.02; head.castShadow = true;
  g.add(head);

  // ほっぺの赤み (かわいさの決め手。半透明のピンクを頬に重ねる)
  [-0.3, 0.3].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), blush);
    cheek.position.set(ex, 0.95, 0.375);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  // 目 (大きくまん丸のキラキラ目 + ハイライトで一番かわいいレベルに)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.17, 0.17].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), eyeMat);
    eye.position.set(ex, 1.0, 0.4);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), highlightMat);
    hl1.position.set(ex + 0.025, 1.03, 0.46);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), highlightMat);
    hl2.position.set(ex - 0.02, 0.97, 0.46);
    g.add(hl2);
  });

  // 口 (小さくにっこり)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.04, 0.011, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x8a4a3a })
  );
  mouth.position.set(0, 0.89, 0.42);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  // 葉っぱの髪 (頭のてっぺんから3枚。かわいく小さめに)
  [-0.16, 0, 0.16].forEach((ex, i) => {
    const leafMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), leaf);
    leafMesh.position.set(ex, 1.36 + (i === 1 ? 0.03 : 0), 0.05);
    leafMesh.rotation.z = ex * -1.0;
    leafMesh.rotation.x = -0.2;
    g.add(leafMesh);
  });

  // リボン (葉っぱの根元。重要キャラらしいワンポイント)
  const ribbonCenter = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), ribbon);
  ribbonCenter.position.set(-0.22, 1.28, 0.16);
  g.add(ribbonCenter);
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 6), ribbon);
    wing.position.set(-0.22 + side * 0.08, 1.28, 0.16);
    wing.rotation.z = side * 1.0;
    g.add(wing);
  });

  g.userData.legL      = legL;
  g.userData.legR      = legR;
  g.userData.armL      = armL;
  g.userData.armR      = armR;
  g.userData.walkPhase = 0;

  return g;
}

/**
 * 歩行アニメーション更新 (毎フレーム呼び出す)
 * @param {THREE.Group} group
 * @param {number} dt - デルタ秒
 * @param {boolean} moving - 移動中かどうか
 */
function updateWalkAnimation(group, dt, moving) {
  if (!group || !group.userData.legL) return;
  const u = group.userData;
  if (moving) {
    u.walkPhase += dt * 9;
    const swing = Math.sin(u.walkPhase) * 0.55;
    u.legL.rotation.x =  swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x =  swing * 0.8;
  } else {
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
  }
}

/* ---------------------------------------------------------
   敵キャラクター (食べ物モチーフ)
--------------------------------------------------------- */

/** チョコおばけ */
function buildChocoGhost() {
  const g       = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, flatShading: true });
  const body    = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), bodyMat);
  body.scale.set(1, 1.15, 1);
  body.position.y = 0.6; body.castShadow = true;
  g.add(body);

  const dripMat   = new THREE.MeshStandardMaterial({ color: 0x3a2010, flatShading: true });
  const dripCount = 6;
  for (let i = 0; i < dripCount; i++) {
    const angle = (i / dripCount) * Math.PI * 2;
    const drip  = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), dripMat);
    drip.position.set(Math.cos(angle) * 0.52, 0.1, Math.sin(angle) * 0.52);
    drip.rotation.x = Math.PI; drip.castShadow = true;
    g.add(drip);
  }

  const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const hlMat    = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.18, 0.18].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), eyeMat);
    eye.position.set(ex, 0.66, 0.57);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), pupilMat);
    pupil.position.set(ex, 0.64, 0.585);
    g.add(pupil);
    // 2026/07/28 追加: 瞳にキラッとしたハイライトを乗せてかわいさアップ
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), hlMat);
    hl.position.set(ex + 0.025, 0.665, 0.588);
    g.add(hl);
  });

  // ほっぺの赤み (2026/07/28 追加)
  const blush = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.55 });
  [-0.34, 0.34].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), blush);
    cheek.position.set(ex, 0.55, 0.55);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc42840 })
  );
  cherry.position.set(0, 1.28, 0); cherry.castShadow = true;
  g.add(cherry);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4),
    new THREE.MeshStandardMaterial({ color: 0x2f6b2f })
  );
  stem.position.set(0, 1.38, 0);
  g.add(stem);

  // 口 (にやりと笑うチョコおばけの表情, 2026/07/25 デザイン強化)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.025, 6, 10, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1a1008 })
  );
  mouth.position.set(0, 0.5, 0.58);
  mouth.rotation.z = Math.PI;
  g.add(mouth);

  // ゆらゆら揺れる腕 (おばけらしい丸みのある小さな腕)
  const armMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, flatShading: true });
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), armMat);
    arm.scale.set(1, 1.3, 0.8);
    arm.position.set(side * 0.62, 0.42, 0.1);
    arm.rotation.z = side * -0.5;
    arm.castShadow = true;
    g.add(arm);
  });

  // てかり (つやつやしたチョコらしいハイライト)
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  );
  shine.position.set(-0.25, 0.85, 0.48);
  g.add(shine);

  return g;
}

/** ホールケーキ王 */
function buildCakeKing() {
  const g     = new THREE.Group();
  const tier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.8, 0.45, 14),
    new THREE.MeshStandardMaterial({ color: 0xf6dfc4, flatShading: true })
  );
  tier1.position.y = 0.225; tier1.castShadow = true;

  const tier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.4, 14),
    new THREE.MeshStandardMaterial({ color: 0xf4c6d0, flatShading: true })
  );
  tier2.position.y = 0.65; tier2.castShadow = true;

  const tier3 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.35, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true })
  );
  tier3.position.y = 1.02; tier3.castShadow = true;

  g.add(tier1, tier2, tier3);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0b83a, metalness: 0.3, roughness: 0.4 })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 1.28; crown.castShadow = true;
  g.add(crown);

  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc42840 })
  );
  cherry.position.y = 1.44;
  g.add(cherry);

  for (let i = 0; i < 3; i++) {
    const angle  = (i / 3) * Math.PI * 2;
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    candle.position.set(Math.cos(angle) * 0.2, 1.2, Math.sin(angle) * 0.2);
    g.add(candle);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.08, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb020 })
    );
    flame.position.set(Math.cos(angle) * 0.2, 1.35, Math.sin(angle) * 0.2);
    g.add(flame);
  }

  // 目 (2026/07/28 修正: 大きなキラキラ目+ハイライトに変更してかわいさアップ。
  // 「への字口」の威厳のある表情はそのまま残した)
  const eyeMat       = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.19, 0.19].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), eyeMat);
    eye.position.set(ex, 0.7, 0.62);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), highlightMat);
    hl1.position.set(ex + 0.025, 0.73, 0.68);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), highlightMat);
    hl2.position.set(ex - 0.02, 0.67, 0.68);
    g.add(hl2);
  });

  // ほっぺの赤み (2026/07/28 追加)
  const blush = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.55 });
  [-0.36, 0.36].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), blush);
    cheek.position.set(ex, 0.6, 0.58);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  // 口 (王らしい威厳のある「への字口」, 2026/07/25 デザイン強化)
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x7a3a2a })
  );
  mouth.position.set(0, 0.56, 0.6);
  g.add(mouth);

  // アイシングの垂れ (層と層の間からとろけるクリーム, 2026/07/25 追加)
  const icingMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const drip  = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), icingMat);
    drip.position.set(Math.cos(angle) * 0.56, 0.4, Math.sin(angle) * 0.56);
    drip.rotation.x = Math.PI;
    g.add(drip);
  }

  return g;
}

/** ドーナツリング */
function buildDonutRing() {
  const g     = new THREE.Group();
  const donut = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.28, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8a0c0, flatShading: true })
  );
  donut.rotation.x = Math.PI / 2;
  donut.position.y = 0.5; donut.castShadow = true;
  g.add(donut);

  const sprinkleColors = [0xffe45e, 0x5ed6ff, 0x7bd67a, 0xff6f91, 0xffffff];
  for (let i = 0; i < 14; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const radius = 0.3 + Math.random() * 0.5;
    const spr    = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5),
      new THREE.MeshStandardMaterial({ color: sprinkleColors[i % sprinkleColors.length] })
    );
    spr.position.set(
      Math.cos(angle) * radius,
      0.68 + Math.random() * 0.08,
      Math.sin(angle) * radius
    );
    spr.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(spr);
  }

  // 目 (2026/07/28 修正: 大きなキラキラ目+ハイライトに変更)
  const eyeMat       = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeMat);
    eye.position.set(ex, 0.52, 0.79);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), highlightMat);
    hl1.position.set(ex + 0.02, 0.55, 0.85);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), highlightMat);
    hl2.position.set(ex - 0.018, 0.49, 0.85);
    g.add(hl2);
  });

  // ほっぺの赤み (2026/07/28 追加)
  const blush = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.55 });
  [-0.32, 0.32].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), blush);
    cheek.position.set(ex, 0.42, 0.72);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  // 口 (ぱくっと開けた元気な口, 2026/07/25 デザイン強化)
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a2030 })
  );
  mouth.position.set(0, 0.35, 0.77);
  g.add(mouth);

  // 焼き目のグラデーション風の焦げ目 (ドーナツらしい質感の強化)
  const glazeSpotMat = new THREE.MeshStandardMaterial({ color: 0xb8557a, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.35 + Math.random() * 0.35;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.05 + Math.random() * 0.03, 8), glazeSpotMat);
    spot.position.set(Math.cos(angle) * radius, 0.72 + Math.random() * 0.06, Math.sin(angle) * radius);
    spot.lookAt(spot.position.x * 2, 3, spot.position.z * 2);
    g.add(spot);
  }

  return g;
}

/** いちごタルト姫 */
/**
 * いちごタルト姫
 * (2026/07/28 修正: 「もっとかわいく」との要望を受けて、目を大きなキラキラ目+
 *  ハイライトに変更し、ほっぺの赤みを追加。クラウンベリーは変えず、
 *  お姫様らしいシルエットは維持した)
 */
function buildTartPrincess() {
  const g     = new THREE.Group();
  const crust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.7, 0.22, 14),
    new THREE.MeshStandardMaterial({ color: 0xd9a066, flatShading: true })
  );
  crust.position.y = 0.11; crust.castShadow = true;
  g.add(crust);

  const cream = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xfff6e8, flatShading: true })
  );
  cream.position.y = 0.22; cream.castShadow = true;
  g.add(cream);

  const berryMat = new THREE.MeshStandardMaterial({ color: 0xd6304a, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const berry = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), berryMat);
    berry.position.set(Math.cos(angle) * 0.28, 0.55, Math.sin(angle) * 0.28);
    berry.rotation.x = Math.PI; berry.castShadow = true;
    g.add(berry);
  }

  const crownBerry = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), berryMat);
  crownBerry.position.y = 0.72;
  crownBerry.rotation.x = Math.PI;
  g.add(crownBerry);

  // ほっぺの赤み (2026/07/28 追加)
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8aa0, transparent: true, opacity: 0.8 });
  [-0.34, 0.34].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), blush);
    cheek.position.set(ex, 0.28, 0.62);
    cheek.rotation.y = ex < 0 ? -0.55 : 0.55;
    g.add(cheek);
  });

  // 目 (2026/07/28 修正: 大きなキラキラ目+ハイライト2つに変更)
  const eyeMat       = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.17, 0.17].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeMat);
    eye.position.set(ex, 0.33, 0.68);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), highlightMat);
    hl1.position.set(ex + 0.022, 0.36, 0.735);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), highlightMat);
    hl2.position.set(ex - 0.018, 0.30, 0.735);
    g.add(hl2);
  });

  // 口 (お姫様らしい小さな笑顔, 2026/07/25 デザイン強化)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.018, 6, 10, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xa8384a })
  );
  mouth.position.set(0, 0.24, 0.68);
  mouth.rotation.z = Math.PI;
  g.add(mouth);

  // クリームのツヤ (瑞々しさを出すハイライト)
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  shine.position.set(-0.18, 0.42, 0.32);
  g.add(shine);

  return g;
}

/* ---------------------------------------------------------
   ENEMY_TYPES — 全敵キャラクターのマスタデータ
   (build関数を参照するため models.js 末尾に定義)
--------------------------------------------------------- */
/** 抹茶ロール (自然属性) */
function buildMatchaRoll() {
  const g = new THREE.Group();
  const rollMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, flatShading: true });
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16),
    rollMat
  );
  roll.rotation.x = Math.PI / 2;
  roll.position.y = 0.6;
  roll.castShadow = true;
  g.add(roll);

  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, flatShading: true });
  const innerRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.41, 16),
    creamMat
  );
  innerRoll.rotation.x = Math.PI / 2;
  innerRoll.position.y = 0.6;
  g.add(innerRoll);

  const spiralMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, flatShading: true });
  const spiral = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.43),
    spiralMat
  );
  spiral.position.set(0.1, 0.6, 0);
  g.add(spiral);

  // 目 (2026/07/28 修正: 大きなキラキラ目+ハイライトに変更)
  const eyeMat       = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), eyeMat);
    eye.position.set(ex, 0.61, 0.24);
    g.add(eye);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), highlightMat);
    hl1.position.set(ex + 0.02, 0.64, 0.29);
    g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), highlightMat);
    hl2.position.set(ex - 0.016, 0.58, 0.29);
    g.add(hl2);
  });

  // 口 (2026/07/28 追加: 今まで無かったのでにっこり口を追加)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x2f5a28 })
  );
  mouth.position.set(0, 0.5, 0.27);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  // ほっぺの赤み (2026/07/28 追加)
  const blush = new THREE.MeshBasicMaterial({ color: 0xff9ab0, transparent: true, opacity: 0.55 });
  [-0.32, 0.32].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), blush);
    cheek.position.set(ex, 0.55, 0.2);
    cheek.rotation.y = ex < 0 ? -0.6 : 0.6;
    g.add(cheek);
  });

  return g;
}

/* ---------------------------------------------------------
   進化後モデル (Lv.30到達で見た目が強化される)
--------------------------------------------------------- */
/** 進化演出共通パーツ: 足元に属性カラーの光る輪をつける */
function addAuraRing(g, color, y, radius) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  g.add(ring);
  return ring;
}

/** チョコおばけ 進化形態: チョコキング (闇) */
function buildChocoGhostEvolved() {
  const g = buildChocoGhost();
  g.scale.set(1.25, 1.25, 1.25);

  const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0d08, flatShading: true });
  [-0.22, 0.22].forEach(hx => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), hornMat);
    horn.position.set(hx, 1.25, 0);
    horn.rotation.z = hx > 0 ? -0.3 : 0.3;
    horn.castShadow = true;
    g.add(horn);
  });

  addAuraRing(g, 0x5a24a0, 0.02, 0.85);
  return g;
}

/** ホールケーキ王 進化形態: ホールケーキ神皇 (光) */
function buildCakeKingEvolved() {
  const g = buildCakeKing();
  g.scale.set(1.2, 1.25, 1.2);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
  );
  halo.position.y = 1.75;
  g.add(halo);

  addAuraRing(g, 0xb07800, 0.02, 0.95);
  return g;
}

/** ドーナツリング 進化形態: ドーナツフレア (炎) */
function buildDonutRingEvolved() {
  const g = buildDonutRing();
  g.scale.set(1.2, 1.2, 1.2);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a30 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), flameMat);
    flame.position.set(Math.cos(angle) * 0.55, 0.5 + Math.sin(i) * 0.05, Math.sin(angle) * 0.55);
    flame.rotation.x = Math.PI;
    g.add(flame);
  }

  addAuraRing(g, 0xc8361a, 0.02, 0.85);
  return g;
}

/** いちごタルト姫 進化形態: いちごタルト女王 (水) */
function buildTartPrincessEvolved() {
  const g = buildTartPrincess();
  g.scale.set(1.2, 1.2, 1.2);

  const tiaraMat = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, metalness: 0.4, roughness: 0.3 });
  const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 16, Math.PI), tiaraMat);
  tiara.rotation.x = Math.PI / 2;
  tiara.position.y = 0.78;
  g.add(tiara);

  addAuraRing(g, 0x1460b0, 0.02, 0.8);
  return g;
}

/** 抹茶ロール 進化形態: 抹茶ロール大樹 (自然) */
function buildMatchaRollEvolved() {
  const g = buildMatchaRoll();
  g.scale.set(1.15, 1.3, 1.15);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9142, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), leafMat);
    leaf.position.set(Math.cos(angle) * 0.25, 0.95, Math.sin(angle) * 0.25);
    leaf.rotation.x = Math.PI;
    g.add(leaf);
  }

  addAuraRing(g, 0x246e2e, 0.02, 0.8);
  return g;
}

/** もりのぬし (自然属性) — 画像のようなずっしり丸い体に赤いキノコが生えているモンスター */
function buildMushroomBoss() {
  const g = new THREE.Group();

  // ボディ — ずっしりした丸い角张り
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4c8a8, flatShading: true, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), bodyMat);
  body.scale.set(1.15, 1.05, 1.1);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);

  // 腐葉層 — 下半を少し木色に
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xa89878, flatShading: true, roughness: 1 });
  const baseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.5, 12), baseMat);
  baseBody.position.y = 0.25;
  baseBody.castShadow = true;
  g.add(baseBody);

  // なまこ髪 (ボディ横幅に旀) — 大型キノコを何本か繋りまとめたような形
  const capMat    = new THREE.MeshStandardMaterial({ color: 0xc23030, flatShading: true, roughness: 0.7 });
  const capSpotMat = new THREE.MeshBasicMaterial({ color: 0xfff5e0 });

  // メインキノコ (真正面上)
  const mainCap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  mainCap.position.set(0, 1.42, 0);
  mainCap.castShadow = true;
  g.add(mainCap);

  const mainStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.28, 8), bodyMat);
  mainStem.position.set(0, 1.2, 0);
  g.add(mainStem);

  // 山の点
  for (let si = 0; si < 4; si++) {
    const sAngle = (si / 4) * Math.PI * 2 + 0.3;
    const r      = 0.28 + (si % 2) * 0.08;
    const sx = Math.cos(sAngle) * r;
    const sz = Math.sin(sAngle) * r;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.06 + Math.random()*0.04, 8), capSpotMat);
    spot.position.set(sx, 1.68 + Math.random()*0.08, sz);
    spot.lookAt(sx * 3, 3.5, sz * 3);
    g.add(spot);
  }

  // サイドキノコ (左)
  const sideCapL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 7, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  sideCapL.position.set(-0.5, 1.18, 0.1);
  sideCapL.rotation.z = -0.3;
  sideCapL.castShadow = true;
  g.add(sideCapL);
  const sideStemL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 6), bodyMat);
  sideStemL.position.set(-0.46, 1.06, 0.1);
  sideStemL.rotation.z = -0.3;
  g.add(sideStemL);

  // サイドキノコ (右)
  const sideCapR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 7, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  sideCapR.position.set(0.52, 1.22, 0.05);
  sideCapR.rotation.z = 0.35;
  sideCapR.castShadow = true;
  g.add(sideCapR);
  const sideStemR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.15, 6), bodyMat);
  sideStemR.position.set(0.48, 1.1, 0.05);
  sideStemR.rotation.z = 0.35;
  g.add(sideStemR);

  // 小さなキノコ (左耂部)
  const tinyCap1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  tinyCap1.position.set(-0.62, 0.75, 0.35);
  g.add(tinyCap1);
  const tinyCap2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  tinyCap2.position.set(0.60, 0.72, 0.32);
  g.add(tinyCap2);

  // 目 (強面の赤い目)
  const eyeMat    = new THREE.MeshStandardMaterial({ color: 0x8a1010, flatShading: true });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4040 });
  [-0.22, 0.22].forEach((ex, idx) => {
    // 外側の目
    const eyeOuter = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    eyeOuter.position.set(ex, 0.84, 0.7);
    eyeOuter.scale.set(1, 0.6, 0.7);
    g.add(eyeOuter);
    // 光る瞳子
    const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 7), eyeGlowMat);
    eyeGlow.position.set(ex, 0.84, 0.74);
    g.add(eyeGlow);
    // 山屡たまゆ
    const browMat = new THREE.MeshStandardMaterial({ color: 0x4a2020, flatShading: true });
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), browMat);
    brow.position.set(ex, 0.94, 0.7);
    brow.rotation.z = idx === 0 ? 0.3 : -0.3;
    g.add(brow);
  });

  // 小さなバビ (脂肪たっぷり感)
  const blobMat = new THREE.MeshStandardMaterial({ color: 0xccc0a0, flatShading: true, roughness: 0.9 });
  [[-0.58, 0.5, 0.5, 0.15], [0.55, 0.48, 0.55, 0.13], [-0.2, 0.28, 0.68, 0.11], [0.22, 0.3, 0.66, 0.10]].forEach(([bx, by, bz, br]) => {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(br, 8, 6), blobMat);
    blob.position.set(bx, by, bz);
    g.add(blob);
  });

  // 自然属性の「かび」演出用オーラリング
  addAuraRing(g, 0x246e2e, 0.04, 0.9);

  return g;
}

/** もりのぬし 進化 (大樹キノコ王) */
function buildMushroomBossEvolved() {
  const g = buildMushroomBoss();
  g.scale.set(1.2, 1.2, 1.2);

  // 追加の巨大キノコ
  const capMat = new THREE.MeshStandardMaterial({ color: 0xa01818, flatShading: true });
  const megaCap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  megaCap.position.set(0.15, 1.85, 0);
  megaCap.rotation.z = 0.2;
  g.add(megaCap);

  // 木の根のようなもの
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x6a4a28, flatShading: true });
  [-0.4, 0.4].forEach(rx => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.1), rootMat);
    root.position.set(rx, -0.05, 0.3);
    root.rotation.z = rx > 0 ? 0.4 : -0.4;
    g.add(root);
  });

  addAuraRing(g, 0x1a5e22, 0.04, 1.1);
  return g;
}

/* =========================================================
   しま広場 用シーナリー (2026/07/25 追加)
   ガチャ/パーティ機能の建物・噴水・街灯・ベンチなど、
   参考画像のような「広場に建物が並ぶ」構図を再現するためのモデル群
========================================================= */

/** 看板 (canvasテクスチャで文字を描画したプレート) */
function buildSignboard(text, plateColor = '#fff8ec') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = plateColor;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#2b1810';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#3a2a1a';
  ctx.font = 'bold 44px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.43),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  return mesh;
}

/** 広場中央の噴水 */
function buildIslandFountain() {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b8, flatShading: true, roughness: 1 });
  const trimMat  = new THREE.MeshStandardMaterial({ color: 0xc9a568, flatShading: true, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x6fc8e0, transparent: true, opacity: 0.88, roughness: 0.15 });

  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.35, 20), stoneMat);
  baseRing.position.y = 0.17;
  baseRing.castShadow = true;
  g.add(baseRing);

  const water1 = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.12, 20), waterMat);
  water1.position.y = 0.38;
  g.add(water1);

  const midPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.55, 12), trimMat);
  midPillar.position.y = 0.7;
  g.add(midPillar);

  const midRing = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.22, 16), stoneMat);
  midRing.position.y = 1.05;
  g.add(midRing);

  const water2 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16), waterMat);
  water2.position.y = 1.17;
  g.add(water2);

  const topPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 10), trimMat);
  topPillar.position.y = 1.42;
  g.add(topPillar);

  const spout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshBasicMaterial({ color: 0xdff5ff }));
  spout.position.y = 1.7;
  g.add(spout);

  // 水しぶき粒子(装飾)
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 6; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), dropMat);
    const a = (i / 6) * Math.PI * 2;
    drop.position.set(Math.cos(a) * 0.25, 1.55 + Math.random() * 0.1, Math.sin(a) * 0.25);
    g.add(drop);
  }

  return g;
}

/** ガチャの建物 (青い屋根、ダイヤの看板) */
function buildShopBuilding() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3f6fb0, flatShading: true, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a4f85, flatShading: true, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf0d89a, flatShading: true });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2b3a52, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 2.0), wallMat);
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.15, 4), roofMat);
  roof.position.y = 2.25;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.08), doorMat);
  door.position.set(0, 0.48, 1.02);
  g.add(door);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), trimMat);
  awning.position.set(0, 1.05, 1.15);
  awning.rotation.x = -0.15;
  g.add(awning);

  const diamondMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), diamondMat);
  diamond.position.set(0, 1.35, 1.05);
  g.add(diamond);

  const sign = buildSignboard('ガチャ', '#eaf3ff');
  sign.position.set(0, 1.85, 1.02);
  g.add(sign);

  return g;
}

/** パーティ編成の建物 (赤い屋根、丸窓) */
function buildHouseBuilding() {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd6714a, flatShading: true, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9c3a2e, flatShading: true, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf0d89a, flatShading: true });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3320, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 2.0), wallMat);
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.15, 4), roofMat);
  roof.position.y = 2.25;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.08), doorMat);
  door.position.set(0, 0.48, 1.02);
  g.add(door);

  [-0.75, 0.75].forEach(x => {
    const windowPane = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), trimMat);
    windowPane.position.set(x, 1.1, 1.01);
    g.add(windowPane);
  });

  const sign = buildSignboard('どうぐや', '#fff1ea');
  sign.position.set(0, 1.85, 1.02);
  g.add(sign);

  return g;
}

/** 街灯 */
function buildLamppost() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 8), poleMat);
  pole.position.y = 0.9;
  g.add(pole);

  const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, flatShading: true });
  const arm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), armMat);
  arm.position.y = 1.82;
  g.add(arm);

  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  glow.position.y = 1.82;
  g.add(glow);

  const light = new THREE.PointLight(0xfff0c0, 0.5, 3.5, 2);
  light.position.y = 1.82;
  g.add(light);

  return g;
}

/** ベンチ */
function buildBench() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6a3e, flatShading: true });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), woodMat);
  seat.position.y = 0.35;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.06), woodMat);
  back.position.set(0, 0.55, -0.15);
  g.add(back);
  [-0.35, 0.35].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.3), woodMat);
    leg.position.set(x, 0.17, 0);
    g.add(leg);
  });
  return g;
}

/* ---------------------------------------------------------
   ステージ2専用モンスター (わがしのしま) — 2026/07/25 追加
   これまでステージ1のチョコおばけ/抹茶ロールを使い回していたのを、
   和菓子テーマの専用モンスターに一新する。
--------------------------------------------------------- */

/** 大福おばけ (闇属性) */
function buildDaifukuGhost() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfaf3e6, flatShading: true, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), bodyMat);
  body.scale.set(1.05, 0.95, 1.05);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  // てっぺんのつまみ (大福らしいひねり)
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), bodyMat);
  knot.position.set(0, 1.05, 0);
  g.add(knot);

  // きなこ粉 (小さな点々)
  const kinakoMat = new THREE.MeshStandardMaterial({ color: 0xe0c078, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.45;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02 + Math.random() * 0.015, 5, 5), kinakoMat);
    dot.position.set(Math.cos(angle) * radius, 0.6 + Math.random() * 0.4, Math.sin(angle) * radius * 0.6 + 0.4);
    g.add(dot);
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.15, 0.15].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(ex, 0.58, 0.52);
    g.add(eye);
  });

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.016, 6, 10, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xc8a878 })
  );
  mouth.position.set(0, 0.44, 0.54);
  mouth.rotation.z = Math.PI;
  g.add(mouth);

  // ゆらゆら揺れる腕
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bodyMat);
    arm.scale.set(1, 1.2, 0.75);
    arm.position.set(side * 0.55, 0.42, 0.05);
    arm.rotation.z = side * -0.5;
    arm.castShadow = true;
    g.add(arm);
  });

  return g;
}

function buildDaifukuGhostEvolved() {
  const g = buildDaifukuGhost();
  addAuraRing(g, 0x8a3fe0, 0.02, 0.75);
  // 黒蜜のつや (進化で贅沢な見た目に)
  const syrup = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1810, flatShading: true, transparent: true, opacity: 0.55 })
  );
  syrup.scale.set(1.08, 0.5, 1.08);
  syrup.position.y = 0.85;
  g.add(syrup);
  return g;
}

/** たい焼き忍者 (炎属性) */
function buildTaiyakiNinja() {
  const g = new THREE.Group();
  const batterMat = new THREE.MeshStandardMaterial({ color: 0xc98a3e, flatShading: true, roughness: 0.7 });

  // 魚型のボディ
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), batterMat);
  body.scale.set(1.35, 0.85, 0.9);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  // しっぽ (尾びれ)
  const finMat = new THREE.MeshStandardMaterial({ color: 0xa8702e, flatShading: true });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 4), finMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.8, 0.55, 0);
  tail.scale.set(1, 1, 0.35);
  tail.castShadow = true;
  g.add(tail);

  // 背びれ
  const finTop = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 4), finMat);
  finTop.position.set(0.05, 0.95, 0);
  finTop.rotation.x = Math.PI;
  finTop.scale.set(1, 1, 0.3);
  g.add(finTop);

  // 焼き目の縁
  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.05, 6, 20),
    new THREE.MeshStandardMaterial({ color: 0x7a4a20, flatShading: true })
  );
  edge.position.set(0.05, 0.55, 0);
  edge.scale.set(1.3, 0.85, 1);
  g.add(edge);

  // 忍者の鉢巻
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true })
  );
  band.position.set(0.32, 0.66, 0.6);
  g.add(band);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a0a });
  [-0.13, 0.13].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(ex + 0.32, 0.55, 0.66);
    g.add(eye);
  });

  return g;
}

function buildTaiyakiNinjaEvolved() {
  const g = buildTaiyakiNinja();
  addAuraRing(g, 0xff5522, 0.02, 0.85);
  // 二尾化(特上の証)
  const tail2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.3, 4),
    new THREE.MeshStandardMaterial({ color: 0xa8702e, flatShading: true })
  );
  tail2.rotation.z = Math.PI / 2;
  tail2.position.set(-0.85, 0.7, 0.18);
  tail2.scale.set(1, 1, 0.35);
  g.add(tail2);
  return g;
}

/** みたらし団子三兄弟 (自然属性) */
function buildMitarashiDangoTrio() {
  const g = new THREE.Group();
  const dangoMat = new THREE.MeshStandardMaterial({ color: 0xf0e0c0, flatShading: true });
  const glazeMat = new THREE.MeshStandardMaterial({ color: 0x8a5a28, flatShading: true, transparent: true, opacity: 0.5 });
  const eyeMat   = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });

  [0.32, 0.72, 1.12].forEach(y => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), dangoMat);
    ball.position.y = y;
    ball.castShadow = true;
    g.add(ball);

    const glaze = new THREE.Mesh(new THREE.SphereGeometry(0.335, 12, 10), glazeMat);
    glaze.position.y = y;
    g.add(glaze);

    [-0.1, 0.1].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
      eye.position.set(ex, y + 0.02, 0.3);
      g.add(eye);
    });
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.01, 5, 8, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x6a3a18 })
    );
    mouth.position.set(0, y - 0.08, 0.31);
    mouth.rotation.z = Math.PI;
    g.add(mouth);
  });

  // 竹串
  const skewer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xc8a878, flatShading: true })
  );
  skewer.position.y = 0.7;
  g.add(skewer);

  return g;
}

function buildMitarashiDangoTrioEvolved() {
  const g = buildMitarashiDangoTrio();
  addAuraRing(g, 0x4fae4f, 0.02, 0.6);
  const sesameMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  [0.32, 0.72, 1.12].forEach(y => {
    for (let i = 0; i < 4; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const sesame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 4), sesameMat);
      sesame.position.set(Math.cos(angle) * 0.28, y + (Math.random() - 0.5) * 0.2, Math.sin(angle) * 0.28);
      g.add(sesame);
    }
  });
  return g;
}

/** 羊羹将軍 (ステージ2ボス。闇属性) */
function buildYokanGeneral() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a1a20, flatShading: true, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.7), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);

  // つや (羊羹らしい照り)
  const shine = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.11, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })
  );
  shine.position.set(0, 0.65, 0.36);
  g.add(shine);

  // 兜
  const kabutoMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, flatShading: true, metalness: 0.3, roughness: 0.5 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), kabutoMat);
  dome.position.y = 1.28;
  dome.castShadow = true;
  g.add(dome);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a838, metalness: 0.4, roughness: 0.4, flatShading: true });
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 12, Math.PI), goldMat);
  crescent.position.set(0, 1.55, 0.05);
  crescent.rotation.x = Math.PI / 2;
  g.add(crescent);

  // 眉
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1a0a08 });
  [-0.16, 0.16].forEach((ex, idx) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), browMat);
    brow.position.set(ex, 1.08, 0.37);
    brow.rotation.z = idx === 0 ? 0.3 : -0.3;
    g.add(brow);
  });

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
    eye.position.set(ex, 0.98, 0.37);
    g.add(eye);
  });

  // 背中の軍旗
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4028 })
  );
  pole.position.set(0, 1.3, -0.4);
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.4, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x8a2020, flatShading: true })
  );
  flag.position.set(0.16, 1.55, -0.4);
  g.add(flag);

  return g;
}

function buildYokanGeneralEvolved() {
  const g = buildYokanGeneral();
  addAuraRing(g, 0x8a3fe0, 0.02, 1.0);
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xd4a838, metalness: 0.4, roughness: 0.4, flatShading: true })
  );
  shoulder.position.set(0, 1.05, 0);
  g.add(shoulder);
  return g;
}

/* ---------------------------------------------------------
   ステージ3(フルーツパーラーのしま)専用モンスター (2026/07/28 追加)
--------------------------------------------------------- */

/** いちごスライム (水属性) */
function buildStrawberrySlime() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3f5f, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), bodyMat);
  body.scale.set(1, 0.85, 1);
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);

  // つや
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  shine.position.set(-0.2, 0.62, 0.32);
  g.add(shine);

  // 種つぶ
  const seedMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (let i = 0; i < 10; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.6 + 0.15;
    const seed  = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), seedMat);
    seed.position.set(
      Math.sin(phi) * Math.cos(theta) * 0.49,
      0.42 + Math.cos(phi) * 0.41,
      Math.sin(phi) * Math.sin(theta) * 0.49
    );
    g.add(seed);
  }

  // ヘタ (葉っぱ5枚)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a9c4a, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), leafMat);
    leaf.position.set(Math.cos(angle) * 0.13, 0.85, Math.sin(angle) * 0.13);
    leaf.rotation.x = 0.5 * Math.cos(angle + Math.PI / 2);
    leaf.rotation.z = 0.5 * Math.sin(angle + Math.PI / 2);
    g.add(leaf);
  }

  // 目・ハイライト
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const hlMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), eyeMat);
    eye.position.set(ex, 0.46, 0.44);
    g.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), hlMat);
    hl.position.set(ex + 0.02, 0.49, 0.48);
    g.add(hl);
  });

  // 口
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.04, 0.011, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x9c1a30 })
  );
  mouth.position.set(0, 0.34, 0.47);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  // ほっぺ
  const blush = new THREE.MeshBasicMaterial({ color: 0xffb0c0, transparent: true, opacity: 0.55 });
  [-0.34, 0.34].forEach(ex => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), blush);
    cheek.position.set(ex, 0.4, 0.4);
    cheek.rotation.y = ex < 0 ? -0.7 : 0.7;
    g.add(cheek);
  });

  return g;
}

function buildStrawberrySlimeEvolved() {
  const g = buildStrawberrySlime();
  addAuraRing(g, 0x3fa8ff, 0.02, 0.55);
  // つぶつぶがきらめく大粒の種を追加
  const bigSeedMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const seed  = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), bigSeedMat);
    seed.position.set(Math.cos(angle) * 0.5, 0.5, Math.sin(angle) * 0.5);
    g.add(seed);
  }
  return g;
}

/** パイナップル鎧武者 (火属性) */
function buildPineappleWarrior() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9a52c, flatShading: true, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.95, 12), bodyMat);
  body.position.y = 0.68;
  body.castShadow = true;
  g.add(body);

  // 鎧の菱形模様 (斜めの帯を2方向に交差させる)
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xb9821c, flatShading: true, roughness: 0.5 });
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      [0.5, -0.5].forEach(dir => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.05), plateMat);
        const r = 0.41;
        strip.position.set(Math.cos(angle) * r, 0.35 + row * 0.3, Math.sin(angle) * r);
        strip.rotation.y = -angle;
        strip.rotation.z = dir * 0.9;
        g.add(strip);
      });
    }
  }

  // 葉の冠 (トゲトゲの葉っぱが上に広がる)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3f, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), leafMat);
    const outward = i % 2 === 0 ? 0.55 : 0.3;
    leaf.position.set(Math.cos(angle) * outward * 0.3, 1.28, Math.sin(angle) * outward * 0.3);
    leaf.rotation.x = Math.cos(angle) * outward;
    leaf.rotation.z = Math.sin(angle) * outward;
    g.add(leaf);
  }

  // 脚
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a5a1c, flatShading: true });
  [-0.16, 0.16].forEach(ex => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8), legMat);
    leg.position.set(ex, 0.12, 0);
    g.add(leg);
  });

  // りりしい眉+目
  const browMat = new THREE.MeshStandardMaterial({ color: 0x3a2408 });
  [-0.14, 0.14].forEach((ex, idx) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), browMat);
    brow.position.set(ex, 0.86, 0.36);
    brow.rotation.z = idx === 0 ? 0.35 : -0.35;
    g.add(brow);
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a08 });
  [-0.14, 0.14].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eye.position.set(ex, 0.78, 0.37);
    g.add(eye);
  });

  // 葉の剣 (右手側に構える)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3f, flatShading: true });
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.65, 4), bladeMat);
  blade.position.set(0.46, 0.55, 0.1);
  blade.rotation.z = -0.7;
  g.add(blade);

  return g;
}

function buildPineappleWarriorEvolved() {
  const g = buildPineappleWarrior();
  addAuraRing(g, 0xff5522, 0.02, 0.55);
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.3, roughness: 0.4, flatShading: true })
  );
  shoulder.position.y = 1.02;
  g.add(shoulder);
  return g;
}

/** ぶどう妖精トリオ (闇属性) */
function buildGrapeFairyTrio() {
  const g = new THREE.Group();
  const berryMat = new THREE.MeshStandardMaterial({ color: 0x7c4fae, flatShading: true });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
  const eyeMat   = new THREE.MeshBasicMaterial({ color: 0x1a1a2a });
  const wingMat  = new THREE.MeshStandardMaterial({ color: 0xd8c8f0, flatShading: true, transparent: true, opacity: 0.75 });

  const positions = [
    { x: -0.3, z: 0.15, y: 0.42, s: 1.0 },
    { x: 0.3,  z: 0.15, y: 0.42, s: 1.0 },
    { x: 0,    z: -0.2, y: 0.68, s: 0.85 },
  ];
  positions.forEach(p => {
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.26 * p.s, 12, 10), berryMat);
    berry.position.set(p.x, p.y, p.z);
    berry.castShadow = true;
    g.add(berry);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.06 * p.s, 6, 6), shineMat);
    shine.position.set(p.x - 0.1 * p.s, p.y + 0.1 * p.s, p.z + 0.2 * p.s);
    g.add(shine);

    [-0.09, 0.09].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035 * p.s, 6, 6), eyeMat);
      eye.position.set(p.x + ex * p.s, p.y, p.z + 0.24 * p.s);
      g.add(eye);
    });

    // 羽
    [-1, 1].forEach(dir => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09 * p.s, 0.22 * p.s, 3), wingMat);
      wing.position.set(p.x + dir * 0.24 * p.s, p.y + 0.08 * p.s, p.z);
      wing.rotation.z = dir * 1.1;
      wing.rotation.x = 0.3;
      g.add(wing);
    });
  });

  // つるとリーフ (3粒をつなぐ)
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, flatShading: true });
  const vine = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 12, Math.PI * 1.3), vineMat);
  vine.position.set(0, 0.78, -0.05);
  vine.rotation.x = Math.PI / 2.2;
  g.add(vine);
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), vineMat);
  leaf.position.set(0, 0.95, -0.15);
  leaf.rotation.x = -0.6;
  g.add(leaf);

  return g;
}

function buildGrapeFairyTrioEvolved() {
  const g = buildGrapeFairyTrio();
  addAuraRing(g, 0x8a3fe0, 0.02, 0.6);
  const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffe9ff });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), sparkleMat);
    sparkle.position.set(Math.cos(angle) * 0.5, 0.55 + Math.random() * 0.3, Math.sin(angle) * 0.5);
    g.add(sparkle);
  }
  return g;
}

/** マスクメロン将軍 (ステージ3ボス。自然属性) */
function buildMelonGeneral() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8fbf5a, flatShading: true, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 14), bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);

  // 網目模様 (トーラスを何本も交差させる)
  const netMat = new THREE.MeshStandardMaterial({ color: 0xe8f0c8, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.02, 6, 20), netMat);
    ring.position.y = 0.85;
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = (i / 5) * Math.PI;
    g.add(ring);
  }
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5 - i * 0.15, 0.02, 6, 20), netMat);
    ring.position.y = 0.35 + i * 0.5;
    g.add(ring);
  }

  // へた(将軍の兜がわり)
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6a4a28, flatShading: true });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 8), stemMat);
  stem.position.y = 1.55;
  g.add(stem);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a838, metalness: 0.4, roughness: 0.4, flatShading: true });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 14, Math.PI), goldMat);
  crown.position.set(0, 1.42, 0.02);
  crown.rotation.x = Math.PI / 2;
  g.add(crown);

  // 肩あて
  [-0.6, 0.6].forEach(ex => {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.3), goldMat);
    shoulder.position.set(ex, 1.05, 0);
    g.add(shoulder);
  });

  // 眉+目 (いかつい表情)
  const browMat = new THREE.MeshStandardMaterial({ color: 0x2a3a18 });
  [-0.2, 0.2].forEach((ex, idx) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.06), browMat);
    brow.position.set(ex, 1.05, 0.58);
    brow.rotation.z = idx === 0 ? 0.35 : -0.35;
    g.add(brow);
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5020 });
  [-0.2, 0.2].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), eyeMat);
    eye.position.set(ex, 0.92, 0.6);
    g.add(eye);
  });
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2a3a18 })
  );
  mouth.position.set(0, 0.72, 0.62);
  g.add(mouth);

  // 脚
  [-0.28, 0.28].forEach(ex => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 8), stemMat);
    leg.position.set(ex, 0.15, 0);
    g.add(leg);
  });

  return g;
}

function buildMelonGeneralEvolved() {
  const g = buildMelonGeneral();
  addAuraRing(g, 0x4fae4f, 0.02, 1.0);
  const cape = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3f6a2f, flatShading: true, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.85, -0.6);
  g.add(cape);
  return g;
}

/* ---------------------------------------------------------
   ステージ4(カニ軍団のしま)専用モンスター (2026/07/28 追加)
--------------------------------------------------------- */

/** カニマン (水属性・雑魚専用。ステージ4は雑魚をこの1種に絞る方針) */
function buildCrabMan() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xd94a2a, flatShading: true, roughness: 0.55 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), shellMat);
  shell.rotation.x = Math.PI;
  shell.position.y = 0.62;
  shell.castShadow = true;
  g.add(shell);

  // おなか(下側の淡い色)
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, flatShading: true });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bellyMat);
  belly.position.y = 0.42;
  g.add(belly);

  // 脚 (左右3本ずつ、横に張り出す)
  const legMat = new THREE.MeshStandardMaterial({ color: 0xb93a1e, flatShading: true });
  for (let i = 0; i < 3; i++) {
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.4, 5), legMat);
      const z = -0.15 + i * 0.16;
      leg.position.set(side * 0.42, 0.28, z);
      leg.rotation.z = side * 1.0;
      leg.rotation.x = 0.3;
      g.add(leg);
    });
  }

  // 大きなハサミ (左右)
  const clawMat = new THREE.MeshStandardMaterial({ color: 0xe85838, flatShading: true });
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.3, 8), clawMat);
    arm.position.set(side * 0.56, 0.55, 0.28);
    arm.rotation.z = side * 0.6;
    g.add(arm);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), clawMat);
    palm.position.set(side * 0.72, 0.42, 0.44);
    g.add(palm);

    for (let p = 0; p < 2; p++) {
      const pincer = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 5), clawMat);
      pincer.position.set(side * 0.72 + (p === 0 ? side * 0.05 : side * -0.02), 0.42 + (p === 0 ? 0.09 : -0.09), 0.6);
      pincer.rotation.x = Math.PI / 2 + (p === 0 ? -0.25 : 0.25);
      g.add(pincer);
    }
  });

  // 目 (にょきっと伸びた目玉)
  const eyeStalkMat = new THREE.MeshStandardMaterial({ color: 0xd94a2a, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
  [-0.13, 0.13].forEach(ex => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 6), eyeStalkMat);
    stalk.position.set(ex, 0.94, 0.32);
    stalk.rotation.x = -0.35;
    g.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(ex, 1.03, 0.42);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
    pupil.position.set(ex, 1.03, 0.46);
    g.add(pupil);
  });

  // 口の泡
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  bubble.position.set(0, 0.5, 0.5);
  g.add(bubble);

  return g;
}

function buildCrabManEvolved() {
  const g = buildCrabMan();
  addAuraRing(g, 0x2f8ac0, 0.02, 0.55);
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.7 });
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), shineMat);
  shine.position.set(-0.15, 0.85, 0.35);
  g.add(shine);
  return g;
}

/** ケガ二マン (水属性・ステージ4ボス。「毛ガニ」をもじった、より大きく毛深いカニ) */
function buildKeganiMan() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, flatShading: true, roughness: 0.7 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), shellMat);
  shell.rotation.x = Math.PI;
  shell.position.y = 0.92;
  shell.castShadow = true;
  g.add(shell);

  // 甲羅の毛(細いトゲトゲを無数に生やして「毛ガニ」感を出す)
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a2c14, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.55;
    const hair  = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.13, 4), hairMat);
    const px = Math.sin(phi) * Math.cos(theta) * 0.78;
    const pz = Math.sin(phi) * Math.sin(theta) * 0.78;
    const py = 0.92 + Math.cos(phi) * 0.78;
    hair.position.set(px, py, pz);
    hair.lookAt(px * 2, py + 0.9, pz * 2);
    hair.rotateX(Math.PI / 2);
    g.add(hair);
  }

  // おなか
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd8a878, flatShading: true });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.66, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), bellyMat);
  belly.position.y = 0.62;
  g.add(belly);

  // 脚 (左右4本ずつ、太くたくましい)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6a3218, flatShading: true });
  for (let i = 0; i < 4; i++) {
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.55, 6), legMat);
      const z = -0.28 + i * 0.19;
      leg.position.set(side * 0.62, 0.35, z);
      leg.rotation.z = side * 1.0;
      leg.rotation.x = 0.3;
      g.add(leg);
    });
  }

  // 巨大なハサミ (左右。武者風に構える)
  const clawMat = new THREE.MeshStandardMaterial({ color: 0xb9542e, flatShading: true, roughness: 0.5 });
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 8), clawMat);
    arm.position.set(side * 0.88, 0.85, 0.4);
    arm.rotation.z = side * 0.7;
    g.add(arm);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), clawMat);
    palm.position.set(side * 1.14, 0.62, 0.68);
    g.add(palm);

    for (let p = 0; p < 2; p++) {
      const pincer = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), clawMat);
      pincer.position.set(side * 1.14 + (p === 0 ? side * 0.08 : side * -0.03), 0.62 + (p === 0 ? 0.16 : -0.16), 0.98);
      pincer.rotation.x = Math.PI / 2 + (p === 0 ? -0.3 : 0.3);
      g.add(pincer);
    }
  });

  // 目 (赤く光る、いかつい目)
  const eyeStalkMat = new THREE.MeshStandardMaterial({ color: 0x8a4a2a, flatShading: true });
  [-0.2, 0.2].forEach(ex => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 6), eyeStalkMat);
    stalk.position.set(ex, 1.42, 0.46);
    stalk.rotation.x = -0.35;
    g.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    eye.position.set(ex, 1.56, 0.6);
    g.add(eye);
  });

  return g;
}

function buildKeganiManEvolved() {
  const g = buildKeganiMan();
  addAuraRing(g, 0x2f8ac0, 0.02, 1.1);
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.05, 6, 14, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd4a838, metalness: 0.4, roughness: 0.4, flatShading: true })
  );
  crown.position.set(0, 1.6, 0.05);
  crown.rotation.x = Math.PI / 2;
  g.add(crown);
  return g;
}

const ENEMY_TYPES = [
  { name: 'チョコおばけ',   color: 0x4a2c17, build: buildChocoGhost,    baseHp: 32, atk: 5, catchMod: 1.3, element: 'dark',

    fleeResistance: 0.12, moveName: 'ダークボール',
    evolvedName: 'ビターチョコおばけ',    evolvedBuild: buildChocoGhostEvolved },
  { name: 'ホールケーキ王', color: 0xe0b83a, build: buildCakeKing,      baseHp: 70, atk: 11, catchMod: 0.6, element: 'light',
    fleeResistance: 0.82, moveName: 'ホーリークリーム',
    evolvedName: 'ホールケーキ大王',      evolvedBuild: buildCakeKingEvolved },
  { name: 'ドーナツリング', color: 0xe8a0c0, build: buildDonutRing,     baseHp: 36, atk: 6, catchMod: 1.2, element: 'fire',
    fleeResistance: 0.24, moveName: 'ブレイズドーナツ',
    evolvedName: 'アツアツドーナツリング', evolvedBuild: buildDonutRingEvolved },
  { name: 'いちごタルト姫', color: 0xd6304a, build: buildTartPrincess,  baseHp: 42, atk: 7, catchMod: 1.0, element: 'water',
    fleeResistance: 0.38, moveName: 'アクアベリー',
    evolvedName: 'ダブルいちごタルト姫',  evolvedBuild: buildTartPrincessEvolved },
  { name: '抹茶ロール',     color: 0x4a7c3f, build: buildMatchaRoll,    baseHp: 40, atk: 6, catchMod: 1.1, element: 'nature',
    fleeResistance: 0.5, moveName: 'リーフ抹茶',
    evolvedName: '特濃抹茶ロール',        evolvedBuild: buildMatchaRollEvolved },
  { name: 'もりのぬし',     color: 0x8a3a3a, build: buildMushroomBoss,  baseHp: 64, atk: 10, catchMod: 0.7, element: 'nature',
    fleeResistance: 0.9, bodySlam: true, moveName: 'アースクラッシュ',
    evolvedName: '大樹のぬし',            evolvedBuild: buildMushroomBossEvolved },
  // 2026/07/25 追加: ステージ2(わがしのしま)専用モンスター
  { name: '大福おばけ',     color: 0xfaf3e6, build: buildDaifukuGhost,        baseHp: 50, atk: 9, catchMod: 1.25, element: 'dark',
    fleeResistance: 0.15, moveName: 'もちパンチ',
    evolvedName: '黒蜜大福おばけ',        evolvedBuild: buildDaifukuGhostEvolved },
  { name: 'たい焼き忍者',   color: 0xc98a3e, build: buildTaiyakiNinja,        baseHp: 56, atk: 11, catchMod: 1.15, element: 'fire',
    fleeResistance: 0.2, moveName: 'あんこしゅりけん',
    evolvedName: '特上たい焼き忍者',      evolvedBuild: buildTaiyakiNinjaEvolved },
  { name: 'みたらし団子三兄弟', color: 0xf0e0c0, build: buildMitarashiDangoTrio, baseHp: 58, atk: 10, catchMod: 1.1, element: 'nature',
    fleeResistance: 0.3, moveName: 'だんごスピン',
    evolvedName: 'ごまみたらし団子三兄弟', evolvedBuild: buildMitarashiDangoTrioEvolved },
  { name: '羊羹将軍',       color: 0x4a1a20, build: buildYokanGeneral,        baseHp: 95, atk: 16, catchMod: 0.65, element: 'dark',
    fleeResistance: 0.88, bodySlam: true, moveName: '漆黒ようかんぎり',
    evolvedName: '大将軍羊羹',            evolvedBuild: buildYokanGeneralEvolved },
  // 2026/07/28 追加: ステージ3(フルーツパーラーのしま)専用モンスター
  { name: 'いちごスライム', color: 0xff3f5f, build: buildStrawberrySlime,     baseHp: 65, atk: 12, catchMod: 1.2, element: 'water',
    fleeResistance: 0.22, moveName: 'ベリーウェイブ',
    evolvedName: '完熟いちごスライム',    evolvedBuild: buildStrawberrySlimeEvolved },
  { name: 'パイナップル鎧武者', color: 0xd9a52c, build: buildPineappleWarrior, baseHp: 74, atk: 15, catchMod: 0.95, element: 'fire',
    fleeResistance: 0.35, moveName: 'とげとげスラッシュ',
    evolvedName: '黄金パイナップル武者', evolvedBuild: buildPineappleWarriorEvolved },
  { name: 'ぶどう妖精トリオ', color: 0x7c4fae, build: buildGrapeFairyTrio,    baseHp: 70, atk: 14, catchMod: 1.1, element: 'dark',
    fleeResistance: 0.4, moveName: 'パープルミスト',
    evolvedName: 'マスカット妖精トリオ', evolvedBuild: buildGrapeFairyTrioEvolved },
  { name: 'マスクメロン将軍', color: 0x8fbf5a, build: buildMelonGeneral,      baseHp: 115, atk: 19, catchMod: 0.6, element: 'nature',
    fleeResistance: 0.9, bodySlam: true, moveName: 'あみめディバイド',
    evolvedName: '大将軍マスクメロン',    evolvedBuild: buildMelonGeneralEvolved },
  // 2026/07/28 追加: ステージ4(カニ軍団のしま)専用モンスター。雑魚はカニマン1種に絞る方針
  { name: 'カニマン',   color: 0xd94a2a, build: buildCrabMan,   baseHp: 68, atk: 13, catchMod: 1.15, element: 'water',
    fleeResistance: 0.25, moveName: 'バブルカッター',
    evolvedName: 'ビッグクロー・カニマン', evolvedBuild: buildCrabManEvolved },
  { name: 'ケガ二マン', color: 0x8a4a2a, build: buildKeganiMan, baseHp: 1300, atk: 21, catchMod: 0.55, element: 'water',
    fleeResistance: 0.92, bodySlam: true, moveName: 'ごうもうクラッシュ',
    evolvedName: '大将軍ケガ二マン',       evolvedBuild: buildKeganiManEvolved },
];
