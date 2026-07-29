/* =========================================================
   maze.js — 迷路生成・ステージセットアップ・障害物管理
   依存: THREE, config.js, models.js (makeRock, buildChest, ENEMY_TYPES)
   読み込み順: config.js → models.js → maze.js
========================================================= */

/* ---- 共有マテリアル ---- */
const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7863, flatShading: true, roughness: 1 });

/* ---------------------------------------------------------
   苔むした石だたみ風テクスチャ (プロシージャル生成・外部画像なし)
--------------------------------------------------------- */
function createStoneTexture(mossy) {
  const size = 256;
  const cvs  = document.createElement('canvas');
  cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext('2d');

  // ベースの石色
  ctx.fillStyle = '#6b6459';
  ctx.fillRect(0, 0, size, size);

  // 石ブロックの目地(レンガ状にずらして配置)
  const blockSize = 32;
  ctx.strokeStyle = 'rgba(38,33,27,0.55)';
  ctx.lineWidth = 3;
  for (let y = 0; y < size; y += blockSize) {
    const offset = ((y / blockSize) % 2 === 0) ? 0 : blockSize / 2;
    for (let x = -blockSize; x < size + blockSize; x += blockSize) {
      ctx.strokeRect(x + offset, y, blockSize, blockSize);
    }
  }

  // 石のムラ(明暗のパッチで質感を出す)
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 3 + Math.random() * 9;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(28,24,20,0.18)' : 'rgba(160,150,130,0.14)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 苔(緑の斑点)。下寄り・すきま寄りに多めに配置してリアルさを出す
  if (mossy) {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * size;
      const y = size * 0.35 + Math.random() * size * 0.65;
      const r = 2 + Math.random() * 7;
      const g = 90 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgba(35, ${g}, 40, ${0.25 + Math.random() * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const wallStoneTexture = createStoneTexture(true);
wallStoneTexture.repeat.set(1.4, 1);
wallMat.map = wallStoneTexture;
wallMat.needsUpdate = true;

const mazeFloorTexture = createStoneTexture(true);
mazeFloorTexture.repeat.set(MAZE_COLS * 0.9, MAZE_ROWS * 0.9);
const mazeFloorMat = new THREE.MeshStandardMaterial({ map: mazeFloorTexture, roughness: 1 });
let mazeFloorMesh = null;

/** 迷路の広さに合わせた苔石だたみの床を敷く (ステージ開始時に呼ぶ) */
function setupMazeFloor() {
  const geo = new THREE.PlaneGeometry(MAZE_COLS * CELL + 2, MAZE_ROWS * CELL + 2);
  mazeFloorMesh = new THREE.Mesh(geo, mazeFloorMat);
  mazeFloorMesh.rotation.x = -Math.PI / 2;
  mazeFloorMesh.position.y = 0.01; // 地面との重なり(Zファイティング)を防ぐ
  mazeFloorMesh.receiveShadow = true;
  scene.add(mazeFloorMesh);
  stageDecorations.push(mazeFloorMesh);
}

/* ---- シーン上のオブジェクトリスト (scene は main.js で定義) ---- */
const obstacles       = []; // 丸型障害物(当たり判定付き装飾岩など)
let   mazeWallMeshes  = [];
let   mazeWallColliders = [];
let   stageDecorations = [];
let   torches          = [];
let   chests          = [];
let   healSpots       = []; // { mesh, active } — active=trueの間は発動済み(再度離れるとfalseに戻る)
let   bossGate        = null;
let   stageSecrets    = [];
let   currentMapMode  = 'stage'; // stage / bossArena
const enemies         = []; // { mesh, type, hp, maxHp, alive, isBoss, wanderTarget, wanderTimer }

/**
 * 開封済みの宝箱ID一覧 (2026/07/25 追加)
 * 「一度開けたら二度と開けられない」を実現するため、開封済みの宝箱idを
 * ここに記録しておく。同じ階に再入場してもこのidの宝箱は出現しなくなる。
 * save.js でセーブデータにも含めて永続化する。
 */
let openedChestIds = new Set();

// ものがたりアイテム (2026/07/27 追加。金の宝箱から手に入る、ステージクリアの証)
let storyItems = new Set();

/**
 * ものがたりアイテムを1つ手に入れる。既に持っていれば何も起きない(2重取得防止)。
 * ボスの間を何度でも訪れられる場合でも、コイン/装備は毎回もらえるが
 * ものがたりアイテムは最初の1回だけ手に入る設計。
 * @param {number} stageNo
 * @returns {{id:string,name:string,desc:string}|null} 新しく手に入れたアイテム(無ければnull)
 */
function collectStoryItem(stageNo) {
  const item = (typeof STORY_ITEMS !== 'undefined') ? STORY_ITEMS[stageNo] : null;
  if (!item || storyItems.has(item.id)) return null;
  storyItems.add(item.id);
  return item;
}

/**
 * シード付き疑似乱数生成器 (mulberry32)。同じseedなら毎回同じ数列を返す。
 * 2026/07/25 追加: ステージのマップ・敵の初期配置・宝箱の位置を、
 * 再訪問しても毎回同じ「作り込まれたレベル」として固定するために使う。
 */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * fn()の実行中だけ Math.random を指定seedの疑似乱数に差し替える。
 * 既存のgenerateMaze()や配置ループを一切書き換えずに、
 * そのステージ/階だけを毎回同じレイアウトにできる。
 */
function withSeededRandom(seed, fn) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/* ---------------------------------------------------------
   松明 (迷路の暗がりを照らす明かり)
--------------------------------------------------------- */
/** 松明1本分のモデル+点光源をまとめて生成する */
function buildTorch() {
  const g = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6), poleMat);
  pole.position.y = 0.55;
  g.add(pole);

  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.14, 8), bowlMat);
  bowl.position.y = 1.12;
  g.add(bowl);

  // 炎 (内側は明るい黄・外側はオレンジの2層 — ブルーム(発光)がかかる明るさにしてある)
  const flameOuter = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.34, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8a30 })
  );
  flameOuter.position.y = 1.34;
  g.add(flameOuter);

  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
  flameInner.position.y = 1.32;
  g.add(flameInner);

  const light = new THREE.PointLight(0xffaa55, 1.1, 6.5, 2);
  light.position.y = 1.3;
  g.add(light);

  g.userData.flameOuter = flameOuter;
  g.userData.flameInner = flameInner;
  g.userData.light      = light;
  g.userData.phase      = Math.random() * Math.PI * 2;

  return g;
}

/** 松明をワールド座標(x, z)に設置する */
function spawnTorch(x, z) {
  const t = buildTorch();
  t.position.set(x, 0, z);
  scene.add(t);
  torches.push(t);
}

/** 松明の炎のゆらぎアニメーション(毎フレーム呼び出す) */
function updateTorches() {
  if (torches.length === 0) return;
  const t0 = performance.now() / 1000;
  for (const torch of torches) {
    const phase = torch.userData.phase;
    const flick = Math.sin(t0 * 9 + phase) * 0.5 + Math.sin(t0 * 17 + phase) * 0.3;
    const s = 1 + flick * 0.12;
    torch.userData.flameOuter.scale.set(s, 1 + flick * 0.18, s);
    torch.userData.flameInner.scale.set(s, 1 + flick * 0.18, s);
    torch.userData.light.intensity = 1.0 + flick * 0.35;
  }
}

/* ---------------------------------------------------------
   座標変換ヘルパー
--------------------------------------------------------- */
function cellToWorldX(c) { return (c - (MAZE_COLS - 1) / 2) * CELL; }
function cellToWorldZ(r) { return (r - (MAZE_ROWS - 1) / 2) * CELL; }
/** ワールド座標→迷路のマス目(行・列)に変換する (ミニマップ探索判定用) */
function worldToCell(x, z) {
  return {
    c: Math.round(x / CELL + (MAZE_COLS - 1) / 2),
    r: Math.round(z / CELL + (MAZE_ROWS - 1) / 2),
  };
}

/* ---------------------------------------------------------
   ミニマップ (じわじわ開放方式)
   歩いて訪れたマスだけを地図上に表示する。ワイヤーフレームの
   迷路と違い、実際に足を運んでいない場所は真っ暗なまま。
--------------------------------------------------------- */
const minimapWrapEl       = document.getElementById('minimap-wrap');
const minimapFloorLabelEl = document.getElementById('minimap-floor-label');
const minimapCanvas       = document.getElementById('minimap-canvas');
const minimapCtx          = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const minimapZoomOverlay  = document.getElementById('minimap-zoom-overlay');
const minimapZoomCanvas   = document.getElementById('minimap-zoom-canvas');
const minimapZoomCtx      = minimapZoomCanvas ? minimapZoomCanvas.getContext('2d') : null;

let currentMazeGrid = null;   // setupStage時点の grid (壁情報)
let exploredCells   = [];     // [r][c] = true/false (訪れたことがあるか)
let minimapZoomOpen  = false;
/** 現在挑戦中のステージ番号 (2026/07/24 追加: ボス撃破時の次ステージ解放を汎用化するため) */
let currentStageNo   = null;
/** つかまえるの残り回数 (2026/07/28 追加: ステージ出発のたびにMAX_CAPTURE_USESへリセット) */
let captureUsesLeft  = MAX_CAPTURE_USES;

document.getElementById('btn-minimap-zoom').addEventListener('click', () => {
  minimapZoomOpen = true;
  minimapZoomOverlay.style.display = 'flex';
  renderMinimap();
});
document.getElementById('btn-minimap-zoom-close').addEventListener('click', () => {
  minimapZoomOpen = false;
  minimapZoomOverlay.style.display = 'none';
});

/** ステージ開始時に呼び出す。探索状況をリセットしてミニマップを表示する */
function resetExploration(grid, stageLabel) {
  currentMazeGrid = grid;
  exploredCells = [];
  for (let r = 0; r < MAZE_ROWS; r++) exploredCells.push(new Array(MAZE_COLS).fill(false));
  exploredCells[0][0] = true; // スタート地点はあらかじめ見えている
  if (minimapFloorLabelEl) minimapFloorLabelEl.textContent = stageLabel;
  if (minimapWrapEl) minimapWrapEl.style.display = 'flex';
  renderMinimap();
}

/** プレイヤーの現在位置に応じて探索マスを更新する(毎フレーム呼び出す) */
function updateExploration() {
  if (!currentMazeGrid) return;
  const { r, c } = worldToCell(player.position.x, player.position.z);
  if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS) return;
  if (!exploredCells[r][c]) {
    exploredCells[r][c] = true;
    renderMinimap();
  }
}

/** 1つのcanvasにミニマップを描画する共通処理 */
function drawMinimapOn(ctx, size) {
  if (!ctx || !currentMazeGrid) return;
  const cell = size / MAZE_COLS;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0c0a10';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (!exploredCells[r][c]) continue;
      const x = c * cell, y = r * cell;

      ctx.fillStyle = '#5a4c3e';
      ctx.fillRect(x, y, cell, cell);

      const wcell = currentMazeGrid[r][c];
      ctx.strokeStyle = '#f0e6cc';
      ctx.lineWidth = Math.max(1, cell * 0.1);
      ctx.beginPath();
      if (wcell.walls.N) { ctx.moveTo(x, y);        ctx.lineTo(x + cell, y); }
      if (wcell.walls.S) { ctx.moveTo(x, y + cell);  ctx.lineTo(x + cell, y + cell); }
      if (wcell.walls.E) { ctx.moveTo(x + cell, y);  ctx.lineTo(x + cell, y + cell); }
      if (wcell.walls.W) { ctx.moveTo(x, y);         ctx.lineTo(x, y + cell); }
      ctx.stroke();
    }
  }

  // 宝箱アイコン (見つけたマスのみ)
  chests.forEach(ch => {
    if (ch.opened) return;
    const { r, c } = worldToCell(ch.mesh.position.x, ch.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#2b1810';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });

  // 回復地点アイコン (見つけたマスのみ)
  healSpots.forEach(spot => {
    const { r, c } = worldToCell(spot.mesh.position.x, spot.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#6fe0d0';
    ctx.strokeStyle = '#0e5a50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - cell * 0.18);
    ctx.lineTo(x + cell * 0.14, y);
    ctx.lineTo(x, y + cell * 0.18);
    ctx.lineTo(x - cell * 0.14, y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });

  // ボスアイコン (見つけたマスのみ)
  enemies.forEach(e => {
    if (!e.isBoss || !e.alive) return;
    const { r, c } = worldToCell(e.mesh.position.x, e.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(x, y - cell * 0.22);
    ctx.lineTo(x + cell * 0.2, y + cell * 0.16);
    ctx.lineTo(x - cell * 0.2, y + cell * 0.16);
    ctx.closePath();
    ctx.fill();
  });

  // プレイヤー(現在地は常に表示)
  const { r: pr, c: pc } = worldToCell(player.position.x, player.position.z);
  const px = pc * cell + cell / 2, py = pr * cell + cell / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(playerAngle);
  ctx.fillStyle = '#4a90d9';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.28);
  ctx.lineTo(cell * 0.18, cell * 0.2);
  ctx.lineTo(-cell * 0.18, cell * 0.2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** ミニマップ(小)と、開いていれば拡大表示も更新する */
function renderMinimap() {
  if (minimapCanvas) drawMinimapOn(minimapCtx, minimapCanvas.width);
  if (minimapZoomOpen && minimapZoomCanvas) drawMinimapOn(minimapZoomCtx, minimapZoomCanvas.width);
}

/* ---------------------------------------------------------
   迷路生成 (再帰バックトラッカー)
--------------------------------------------------------- */
function generateMaze(cols, rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ visited: false, walls: { N: true, S: true, E: true, W: true } });
    }
    grid.push(row);
  }

  const dirs = [
    { name: 'N', dr: -1, dc:  0, opp: 'S' },
    { name: 'S', dr:  1, dc:  0, opp: 'N' },
    { name: 'E', dr:  0, dc:  1, opp: 'W' },
    { name: 'W', dr:  0, dc: -1, opp: 'E' },
  ];

  const stack = [{ r: 0, c: 0 }];
  grid[0][0].visited = true;

  while (stack.length) {
    const cur       = stack[stack.length - 1];
    const neighbors = [];
    for (const d of dirs) {
      const nr = cur.r + d.dr, nc = cur.c + d.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited) {
        neighbors.push({ r: nr, c: nc, dir: d });
      }
    }
    if (neighbors.length) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[cur.r][cur.c].walls[next.dir.name]  = false;
      grid[next.r][next.c].walls[next.dir.opp] = false;
      grid[next.r][next.c].visited             = true;
      stack.push({ r: next.r, c: next.c });
    } else {
      stack.pop();
    }
  }
  return grid;
}

/** BFSでスタートから最も遠いセルを探す (ボス配置用) */
function findFarthestCell(grid, cols, rows) {
  const dist = grid.map(row => row.map(() => -1));
  const queue = [{ r: 0, c: 0 }];
  dist[0][0] = 0;
  let farthest = { r: 0, c: 0, d: 0 };

  while (queue.length) {
    const cur  = queue.shift();
    const d    = dist[cur.r][cur.c];
    if (d > farthest.d) farthest = { r: cur.r, c: cur.c, d };
    const cell  = grid[cur.r][cur.c];
    const moves = [];
    if (!cell.walls.N) moves.push({ r: cur.r - 1, c: cur.c });
    if (!cell.walls.S) moves.push({ r: cur.r + 1, c: cur.c });
    if (!cell.walls.E) moves.push({ r: cur.r,     c: cur.c + 1 });
    if (!cell.walls.W) moves.push({ r: cur.r,     c: cur.c - 1 });
    for (const m of moves) {
      if (dist[m.r][m.c] === -1) {
        dist[m.r][m.c] = d + 1;
        queue.push(m);
      }
    }
  }
  return farthest;
}

/** グリッド全体のBFS距離を返す (2026/07/25 追加: 2番目に遠いセルの特定などに使う) */
function bfsDistances(grid, cols, rows, startR = 0, startC = 0) {
  const dist = grid.map(row => row.map(() => -1));
  const queue = [{ r: startR, c: startC }];
  dist[startR][startC] = 0;
  while (queue.length) {
    const cur  = queue.shift();
    const d    = dist[cur.r][cur.c];
    const cell = grid[cur.r][cur.c];
    const moves = [];
    if (!cell.walls.N) moves.push({ r: cur.r - 1, c: cur.c });
    if (!cell.walls.S) moves.push({ r: cur.r + 1, c: cur.c });
    if (!cell.walls.E) moves.push({ r: cur.r,     c: cur.c + 1 });
    if (!cell.walls.W) moves.push({ r: cur.r,     c: cur.c - 1 });
    for (const m of moves) {
      if (dist[m.r][m.c] === -1) {
        dist[m.r][m.c] = d + 1;
        queue.push(m);
      }
    }
  }
  return dist;
}

/**
 * スタートから2番目に遠いセルを探す (2026/07/25 追加)
 * 固定の宝箱を「奥のほう」に置くために使う。ボスセルは除外する。
 */
function findSecondFarthestCell(grid, cols, rows, excludeR, excludeC) {
  const dist = bfsDistances(grid, cols, rows);
  let best = { r: 0, c: 0, d: -1 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === excludeR && c === excludeC) continue;
      if (dist[r][c] > best.d) best = { r, c, d: dist[r][c] };
    }
  }
  return best;
}

/* ---------------------------------------------------------
   壁セグメントの生成・当たり判定
--------------------------------------------------------- */
function addWallSegment(cx, cz, width, depth) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), wallMat);
  mesh.position.set(cx, WALL_HEIGHT / 2, cz);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mazeWallMeshes.push(mesh);
  mazeWallColliders.push({
    minX: cx - width / 2, maxX: cx + width / 2,
    minZ: cz - depth / 2, maxZ: cz + depth / 2,
  });
}

/** 指定座標(x,z)が壁コライダーと衝突しているか判定 */
function collidesWithWalls(x, z, radius) {
  for (const w of mazeWallColliders) {
    const cx = Math.max(w.minX, Math.min(x, w.maxX));
    const cz = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/* ---------------------------------------------------------
   宝箱
--------------------------------------------------------- */
function spawnChest(x, z, isGolden = false, id = null) {
  // 2026/07/25 追加: idが指定されていて、既に開封済みなら二度と出現させない
  if (id && openedChestIds.has(id)) return;

  const mesh   = buildChest();
  if (isGolden) {
    mesh.traverse(child => {
      if (!child.material?.color) return;
      child.material.color.setHex(child.material.color.getHex() === 0xd9a13c ? 0xffd447 : 0xb87818);
      child.material.emissive?.setHex(0x4a2600);
      if (child.material.emissiveIntensity !== undefined) child.material.emissiveIntensity = 0.35;
    });
  }
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  // 大型化した宝笱に合わせてマーカー位置を上方に調整
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
  marker.position.y = 1.8;
  mesh.add(marker);
  // 宝笱自体に少し左右えている感じを出す
  mesh.rotation.y = (Math.random() - 0.5) * 0.4;
  chests.push({ mesh, opened: false, isGolden, id });
}

function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;
  if (typeof SFX !== 'undefined') SFX.chest();
  if (typeof triggerChestOpenAnimation === 'function') triggerChestOpenAnimation(chest);
  // 2026/07/25 追加: idを持つ宝箱は開封済みとして記録し、二度と出現しないようにする
  if (chest.id) {
    openedChestIds.add(chest.id);
    if (typeof saveGame === 'function') saveGame(false);
  }

  // ふたが開ききったタイミングで中身を見せる (2026/07/26 追加)
  setTimeout(() => {
    scene.remove(chest.mesh);
    const gotCoins = chest.isGolden ? 80 + Math.floor(Math.random() * 61) : 10 + Math.floor(Math.random() * 21);
    coins += gotCoins;
    let msg = `たからばこを あけた！ コイン+${gotCoins}`;
    if (Math.random() < 0.3) {
      const gotDia = 2 + Math.floor(Math.random() * 4);
      diamonds += gotDia;
      msg += ` ダイヤ+${gotDia}`;
    }
    // 一定確率で装備もドロップする(2026/07/24 追加)
    if (chest.isGolden || Math.random() < CHEST_EQUIP_DROP_CHANCE) {
      const newEquip = createEquipItem(rollRarity());
      playerEquipInventory.push(newEquip);
      msg += ` 「${newEquip.name}」も みつけた！`;
    }
    // ものがたりアイテム (2026/07/27 追加: 金の宝箱限定。ステージごとに1つ、最初の1回だけ)
    if (chest.isGolden && typeof collectStoryItem === 'function') {
      const gotItem = collectStoryItem(currentStageNo);
      if (gotItem) msg += ` 「${gotItem.name}」を てにいれた！`;
    }
    updateCurrencyUI();
    showToast(msg); // showToastはtextContent表示のため装備名もプレーンテキストで追記する

    // ボス撃破後の金の宝箱を開けたら、少し間を置いてから島へ戻る
    // (2026/07/25 修正: 以前はボスを倒すとチェストを取りに行く前に
    //  1.8秒で強制送還されてしまい、金の宝箱が実質受け取れないバグがあった)
    if (chest.isGolden && typeof scheduleBossReturn === 'function') {
      scheduleBossReturn(1600);
    }
  }, 550);
}

/* ---------------------------------------------------------
   宝箱を開けるモーション (2026/07/26 追加)
   ふたが奥のちょうつがいを軸にパカッと開き、同時にキラッと光る。
--------------------------------------------------------- */
let openingChestAnims = [];

function triggerChestOpenAnimation(chest) {
  const hinge = chest.mesh.userData.lidHinge;
  if (hinge) {
    openingChestAnims.push({ hinge, start: performance.now(), duration: 550 });
  }

  // キラッと光るスパークル演出
  const sparkle = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
  );
  sparkle.position.copy(chest.mesh.position);
  sparkle.position.y += 1.3;
  scene.add(sparkle);
  const sparkleStart = performance.now();
  (function animateSparkle() {
    const t = (performance.now() - sparkleStart) / 500;
    if (t >= 1) { scene.remove(sparkle); return; }
    sparkle.scale.setScalar(1 + t * 3.2);
    sparkle.material.opacity = 1 - t;
    requestAnimationFrame(animateSparkle);
  })();
}

/** 毎フレーム呼び出して、開封中の宝箱のふたアニメを進める */
function updateChestAnimations() {
  if (openingChestAnims.length === 0) return;
  const now = performance.now();
  openingChestAnims = openingChestAnims.filter(a => {
    const t = Math.min(1, (now - a.start) / a.duration);
    const eased = 1 - Math.pow(1 - t, 3); // イーズアウトで勢いよく開く
    a.hinge.rotation.x = -eased * 2.05;
    return t < 1;
  });
}

function buildBossGate(kind = 'boss') {
  const gate = new THREE.Group();
  const stone  = new THREE.MeshStandardMaterial({ color: 0x4a3028, flatShading: true });
  // 2026/07/25 修正: 階段(次の階へ)は青系、ボスの間へは金色系で見分けられるようにする
  const accentColor = kind === 'stairs' ? 0x3fa0c8 : 0xd49b38;
  const gold = new THREE.MeshStandardMaterial({ color: accentColor, emissive: 0x102a3a, emissiveIntensity: 0.2, flatShading: true });
  [-1.25, 1.25].forEach(x => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.3, 0.7), stone);
    pillar.position.set(x, 1.65, 0);
    pillar.castShadow = true;
    gate.add(pillar);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.65, 0.75), stone);
  top.position.y = 3.15;
  top.castShadow = true;
  gate.add(top);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.18), gold);
  door.position.set(0, 1.25, 0.12);
  door.castShadow = true;
  gate.add(door);
  const sign = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshBasicMaterial({ color: kind === 'stairs' ? 0x6fd0ff : 0xffe45e }));
  sign.position.set(0, 3.55, 0);
  gate.add(sign);
  return gate;
}

function spawnBossGate(x, z, opts = {}) {
  const kind = opts.kind || 'boss';
  const mesh = buildBossGate(kind);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  stageDecorations.push(mesh);
  bossGate = {
    mesh, x, z, triggered: false, promptOpen: false, promptAnswered: false,
    kind,
    label: opts.label || 'ボスの間へ すすみますか？',
    desc:  opts.desc  || 'この先に入ると、たおすまで もどれません',
    nextAction: opts.nextAction || (() => { if (typeof setupBossArena === 'function') setupBossArena(); }),
  };
}

function setupBossArena() {
  currentMapMode = 'bossArena';
  if (typeof playBgm === 'function') playBgm(getBossBgm(currentStageNo));
  clearStageObjects();
  setupMazeFloor();
  if (currentStageNo === 4) {
    setSeaAtmosphere();
    wallMat.color.setHex(0x1a3a4a);
    mazeFloorMat.color.setHex(0x1f6a8a);
  } else {
    setDungeonAtmosphere();
    wallMat.color.setHex(0x241a24);
  }
  if (minimapWrapEl) minimapWrapEl.style.display = 'none';

  const arenaHalf = 14;
  addWallSegment(0, -arenaHalf, arenaHalf * 2, WALL_THICKNESS);
  addWallSegment(0, arenaHalf, arenaHalf * 2, WALL_THICKNESS);
  addWallSegment(-arenaHalf, 0, WALL_THICKNESS, arenaHalf * 2);
  addWallSegment(arenaHalf, 0, WALL_THICKNESS, arenaHalf * 2);

  player.position.set(0, 0, 8);
  player.rotation.y = Math.PI;
  fieldPartyModels.forEach((m, i) => m.position.set(0, 0, 8 + 1.3 * (i + 1)));
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spawnTorch(Math.cos(angle) * 10, Math.sin(angle) * 10);
  }
  spawnBoss(0, -6, STAGE_BOSS_TYPE_IDX[currentStageNo] || 1);
}

/* ---------------------------------------------------------
   回復地点 (いやしのいずみ)
--------------------------------------------------------- */
function spawnHealSpot(x, z) {
  const mesh = buildHealSpring();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  healSpots.push({ mesh, active: false });
}

/**
 * 指定セルの近く(隣接優先、無ければ徐々に範囲を広げる)で、
 * まだ使われていない空きセルを1つ探して返す。見つからなければnull。
 * (2026/07/28 追加: 回復地点を「ボスのすぐ手前」に固定配置するために使う。
 *  道中に置くとヌルゲー化するため、ボス戦直前の1箇所だけにする方針。)
 */
function findNearbyFreeCell(centerR, centerC, usedSet) {
  for (let radius = 1; radius <= Math.max(MAZE_ROWS, MAZE_COLS); radius++) {
    const candidates = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue; // このradiusの外周だけ
        const r = centerR + dr, c = centerC + dc;
        if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS) continue;
        const key = `${r},${c}`;
        if (usedSet.has(key)) continue;
        candidates.push({ r, c });
      }
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return null;
}

/** 回復地点のふわふわアニメーション(毎フレーム呼び出す) */
function updateHealSpots() {
  if (healSpots.length === 0) return;
  const t0 = performance.now() / 1000;
  for (const spot of healSpots) {
    const g = spot.mesh;
    const phase = g.userData.phase;
    if (g.userData.crystal) g.userData.crystal.rotation.y = t0 * 0.8 + phase;
    if (g.userData.light)   g.userData.light.intensity = 0.85 + Math.sin(t0 * 2 + phase) * 0.25;
    (g.userData.motes || []).forEach((mote, i) => {
      const a = t0 * 0.6 + phase + (i / 5) * Math.PI * 2;
      mote.position.x = Math.cos(a) * 0.55;
      mote.position.z = Math.sin(a) * 0.55;
      mote.position.y = 0.35 + Math.sin(t0 * 2 + i) * 0.12;
    });
  }
}

/** プレイヤーが回復地点に近づいたときの判定・発動(毎フレーム呼び出す) */
function updateHealSpotTrigger() {
  for (const spot of healSpots) {
    const dist = Math.hypot(
      player.position.x - spot.mesh.position.x,
      player.position.z - spot.mesh.position.z
    );
    if (dist < HEAL_SPOT_TRIGGER_DIST && !spot.active) {
      spot.active = true;
      const healed = healPartyFully();
      if (healed) showToast('いやしのいずみで やすんだ！なかまが ぜんかいふくした！');
    } else if (dist > HEAL_SPOT_RESET_DIST && spot.active) {
      spot.active = false;
    }
  }
}

/* ---------------------------------------------------------
   敵スポーン
--------------------------------------------------------- */
function buildEnemyAlertMarker(isBoss = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 112px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('!', 64, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    color: isBoss ? 0xff5050 : 0xff2020,
    transparent: true,
    depthTest: false,
  }));
  marker.scale.set(isBoss ? 1.25 : 0.9, isBoss ? 1.25 : 0.9, 1);
  marker.position.y = isBoss ? 2.8 : 2.15;
  marker.visible = false;
  return marker;
}

function spawnEnemy(x, z, allowedIndices = [0, 1, 2, 3, 4]) {
  const randIdx = allowedIndices[Math.floor(Math.random() * allowedIndices.length)];
  const type  = ENEMY_TYPES[randIdx];
  const mesh  = type.build();
  mesh.scale.set(1.3, 1.3, 1.3);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  // 追跡マーカー: 通常は黄色、追跡中は赤に変わる
  const marker = buildEnemyAlertMarker();
  mesh.add(marker);
  mesh.userData.chaseMarker = marker; // main.jsから参照できるよう保存

  enemies.push({
    mesh, type,
    hp: type.baseHp, maxHp: type.baseHp,
    alive: true,
    wasChasing: false,
    visionRange: 8.5,
    visionAngle: Math.cos(Math.PI * 0.34),
    wanderTarget: new THREE.Vector3(x, 0, z),
    wanderTimer: 0,
  });
}

function spawnBoss(x, z, enemyTypeIdx = 1) {
  const baseType = ENEMY_TYPES[enemyTypeIdx];
  // 2026/07/27 修正: 「ボスがでかすぎず、弱すぎる」との声を受けて強化。
  // HP 3倍→4.5倍、攻撃力1.8倍→2.4倍、battleScale 1.4→1.9、フィールド上の見た目も1.6→2.1に拡大。
  // battleScale を上げると、battle.js側の updateIdleCameraForEnemyCount() が
  // 自動でカメラを追加で引いてくれるので、画面からはみ出す心配はない。
  const bossType = Object.assign({}, baseType, {
    baseHp:      Math.round(baseType.baseHp * 4.5),
    atk:         Math.round(baseType.atk * 2.4),
    battleScale: BOSS_SCALE_MULT,
  });
  const mesh = baseType.build();
  mesh.scale.set(BOSS_SCALE_MULT + 0.25, BOSS_SCALE_MULT + 0.25, BOSS_SCALE_MULT + 0.25); // フィールド上ではさらに目立つよう少し大きめに
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const marker = buildEnemyAlertMarker(true);
  mesh.add(marker);

  enemies.push({
    mesh, type: bossType,
    hp: bossType.baseHp, maxHp: bossType.baseHp,
    alive: true, isBoss: true, isGuardBoss: true,
    wasChasing: false,
    visionRange: 10.5,
    visionAngle: Math.cos(Math.PI * 0.42),
    wanderTarget: new THREE.Vector3(x, 0, z),
    wanderTimer: 0,
  });
}

/* ---------------------------------------------------------
   ステージオブジェクトの一括削除
--------------------------------------------------------- */
function clearStageObjects() {
  mazeWallMeshes.forEach(m => scene.remove(m));
  mazeWallMeshes   = [];
  mazeWallColliders = [];
  enemies.forEach(e => { if (e.mesh) scene.remove(e.mesh); });
  enemies.length = 0;
  stageDecorations.forEach(d => scene.remove(d));
  stageDecorations = [];
  torches.forEach(t => scene.remove(t));
  torches = [];
  chests.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  chests = [];
  healSpots.forEach(s => { if (s.mesh) scene.remove(s.mesh); });
  healSpots = [];
  stageSecrets.forEach(s => { if (s.mesh) scene.remove(s.mesh); });
  stageSecrets = [];
  bossGate = null;
  obstacles.length = 0; // 丸型障害物(2026/07/28 追加: ステージ4の浮き岩などで使用)
}

let stageSecretHintUntil       = 0;
let stageSecretInteractionUntil = 0;

/**
 * 隠し要素(宝箱/モンスター)の目印。
 * (2026/07/27 修正: 「もう少しわかりやすく」との要望を受けて、ただの緑の球体だけでなく、
 *  ふわふわ浮かぶ淡い光の粒を追加。近づく前から遠目に「なにか光ってる」と気づけるようにした。
 *  ただし宝箱/モンスターどちらかまでは分からないよう、演出自体は控えめにしてある)
 */
function createHiddenSecretMarker(x, z) {
  const group = new THREE.Group();

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x86c67f, flatShading: true, roughness: 0.85,
      emissive: 0xffe27a, emissiveIntensity: 0.2,
    })
  );
  marker.position.y = 0.22;
  marker.castShadow = true;
  group.add(marker);

  // ふわふわ浮かぶ光の粒
  const sparkle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.85 })
  );
  sparkle.position.y = 0.72;
  group.add(sparkle);

  const glowLight = new THREE.PointLight(0xffe6a0, 0.55, 2.6);
  glowLight.position.y = 0.5;
  group.add(glowLight);

  group.position.set(x, 0, z);
  group.userData.sparkle  = sparkle;
  group.userData.marker   = marker;
  group.userData.glowLight = glowLight;
  group.userData.bobTime  = Math.random() * Math.PI * 2;
  return group;
}

function placeHiddenStageSecret(x, z, opts = {}) {
  const mesh = createHiddenSecretMarker(x, z);
  mesh.userData.hidden = true;
  scene.add(mesh);
  stageDecorations.push(mesh);
  stageSecrets.push(Object.assign({ x, z, mesh, resolved: false }, opts));
}

function revealStageSecret(secret) {
  secret.resolved = true;
  if (secret.mesh) {
    scene.remove(secret.mesh);
    stageDecorations = stageDecorations.filter(d => d !== secret.mesh);
  }
  if (secret.kind === 'chest') {
    spawnChest(secret.x, secret.z, false, secret.id);
    showToast('ひみつの たからばこを みつけた！');
  } else if (secret.kind === 'enemy') {
    spawnEnemy(secret.x, secret.z, secret.allowedIndices || [0, 2, 4, 5]);
    showToast('どこからか かくれたモンスターが あらわれた！');
  }
}

function updateStageInteractables(dt = 0.016) {
  if (currentMapMode !== 'stage' || !stageSecrets.length) return;

  // マーカーのふわふわ演出は、会話中や戦闘中でも見た目だけは動かし続けてOK
  for (const secret of stageSecrets) {
    if (secret.resolved || !secret.mesh || !secret.mesh.userData.sparkle) continue;
    const u = secret.mesh.userData;
    u.bobTime += dt;
    u.sparkle.position.y = 0.72 + Math.sin(u.bobTime * 1.8) * 0.08;
    u.sparkle.rotation.y += dt * 1.4;
    const pulse = 0.55 + Math.sin(u.bobTime * 2.2) * 0.35;
    if (u.glowLight) u.glowLight.intensity = 0.35 + pulse * 0.4;
    if (u.marker)    u.marker.material.emissiveIntensity = 0.12 + pulse * 0.18;
  }

  if (typeof dialogueOpen !== 'undefined' && dialogueOpen) return;
  if (typeof chestConfirmOpen !== 'undefined' && chestConfirmOpen) return;
  if (typeof gateConfirmOpen !== 'undefined' && gateConfirmOpen) return;
  if (battleState) return;

  for (const secret of stageSecrets) {
    if (secret.resolved) continue;
    const dist = Math.hypot(player.position.x - secret.x, player.position.z - secret.z);
    if (dist > 1.7) continue;
    if ((keys['z'] || keys['enter']) && performance.now() > stageSecretInteractionUntil) {
      stageSecretInteractionUntil = performance.now() + 900;
      revealStageSecret(secret);
      return;
    }
    if (performance.now() > stageSecretHintUntil) {
      stageSecretHintUntil = performance.now() + 2200;
      showToast('Zをおして しらべる');
    }
  }
}

/** 迷路突入時、屋外の明るいフォグ/ライティングから暗い洞窟風の雰囲気に切り替える */
function setDungeonAtmosphere() {
  scene.fog.color.setHex(0x140f18);
  scene.fog.near = 6;
  scene.fog.far  = 26;
  scene.background.setHex(0x140f18);
  hemi.intensity = 0.35;
  sun.intensity  = 0.15;
}

/** 森の中の雰囲気に切り替える (2026/07/25 追加: ステージ2「わがしのしま」用) */
function setForestAtmosphere() {
  scene.fog.color.setHex(0x14260f);
  scene.fog.near = 7;
  scene.fog.far  = 24;
  scene.background.setHex(0x1c3016);
  hemi.intensity = 0.55;
  sun.intensity  = 0.3;
}

/** 南国の明るい雰囲気に切り替える (2026/07/28 追加: ステージ3「フルーツパーラーのしま」用) */
function setBeachAtmosphere() {
  scene.fog.color.setHex(0x8fd8e0);
  scene.fog.near = 9;
  scene.fog.far  = 30;
  scene.background.setHex(0x6cc7d8);
  hemi.intensity = 0.85;
  sun.intensity  = 0.55;
}

/** 荒波の海の雰囲気に切り替える (2026/07/28 追加: ステージ4「カニ軍団のしま」用) */
function setSeaAtmosphere() {
  scene.fog.color.setHex(0x1c4a5e);
  scene.fog.near = 8;
  scene.fog.far  = 27;
  scene.background.setHex(0x143848);
  hemi.intensity = 0.6;
  sun.intensity  = 0.35;
}

/**
 * プレイヤー/パーティの足元にイカダを表示するかどうかを切り替える (2026/07/28 追加)
 * ステージ4「カニ軍団のしま」限定。他のステージに移動する際は必ずfalseで呼び出すこと。
 */
function setRaftVisual(enabled) {
  const targets = [player, ...fieldPartyModels];
  targets.forEach(m => {
    if (!m) return;
    if (enabled) {
      if (m.userData.raftMesh) return; // 既についていれば何もしない
      const raft = buildRaft();
      raft.position.y = -0.05;
      m.add(raft);
      m.userData.raftMesh = raft;
    } else if (m.userData.raftMesh) {
      m.remove(m.userData.raftMesh);
      m.userData.raftMesh = null;
    }
  });
}

/* ---------------------------------------------------------
   ステージ1: ケーキのしま (2026/07/25 修正: 1階/2階の2フロア構成に)
   同じseedで毎回同じレイアウトになるので、宝箱の位置を「奥に固定」できる。
--------------------------------------------------------- */
const STAGE1_F1_SEED = 190401;
const STAGE1_F2_SEED = 190402;
let   stage1Floor     = 1;

/** ステージ1の入り口 (島から選ぶと必ず1階から始まる) */
function setupStage1() {
  captureUsesLeft = MAX_CAPTURE_USES;
  setRaftVisual(false); // ステージ4から戻ってきた場合に備えてイカダを外す
  setupStage1Floor1();
}

function setupStage1Floor1() {
  currentStageNo = 1;
  currentMapMode = 'stage';
  stage1Floor = 1;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage1);
  withSeededRandom(STAGE1_F1_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setDungeonAtmosphere();

    // 壁のテクスチャ色をケーキ島用に戻す
    wallMat.color.setHex(0x8a7863);

    const grid      = generateMaze(MAZE_COLS, MAZE_ROWS);
    const stairCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    resetExploration(grid, 'ステージ1 (1かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーをスタート位置へ
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 8体 (1階はやや控えめに。チョコおばけとドーナツリング中心)
    const usedCells = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 8 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 2]);
      spawned++;
    }

    // 2階への階段 (2026/07/25 追加: 1階の奥がボスの間ではなく2階へつながる)
    spawnBossGate(cellToWorldX(stairCell.c), cellToWorldZ(stairCell.r), {
      kind: 'stairs',
      label: '2かいへ すすみますか？',
      desc:  'ケーキのしま 2かいへの かいだんだ',
      nextAction: () => setupStage1Floor2(),
    });

    // 宝箱2個 (idを付けて開封済みなら二度と出現しないようにする)
    const chestUsed = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let chestSpawned = 0, chestGuard = 0;
    while (chestSpawned < 2 && chestGuard < 500) {
      chestGuard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (chestUsed.has(key)) continue;
      chestUsed.add(key);
      spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage1-f1-chest-${r}-${c}`);
      chestSpawned++;
    }

    // 隠しモンスター (2026/07/27 追加: Zキー/決定で調べると出現。1階と同じ敵プールを使う)
    {
      let secretGuard = 0;
      while (secretGuard < 500) {
        secretGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        placeHiddenStageSecret(cellToWorldX(c), cellToWorldZ(r), { kind: 'enemy', allowedIndices: [0, 2] });
        break;
      }
    }

    // 装飾岩 (当たり判定なし)
    for (let i = 0; i < 10; i++) {
      const r    = Math.floor(Math.random() * MAZE_ROWS);
      const c    = Math.floor(Math.random() * MAZE_COLS);
      const rock = makeRock(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      rock.scale.setScalar(0.6);
      scene.add(rock);
      stageDecorations.push(rock);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/** ステージ1・2階 (2026/07/25 追加: 奥に固定の宝箱と、ホールケーキ王への本当のボスゲート) */
function setupStage1Floor2() {
  currentStageNo = 1;
  currentMapMode = 'stage';
  stage1Floor = 2;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage1);
  withSeededRandom(STAGE1_F2_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setDungeonAtmosphere();

    // 2階は1階よりも少し不穏な色合いの壁にして視覚的に区別する
    wallMat.color.setHex(0x6a5648);

    const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
    const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    const deepCell = findSecondFarthestCell(grid, MAZE_COLS, MAZE_ROWS, bossCell.r, bossCell.c);
    resetExploration(grid, 'ステージ1 (2かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーは階段を上がってきた位置からスタート
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 10体 (2階は1階より手強い布陣。もりのぬしも混ざる)
    const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 10 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 2, 5]);
      spawned++;
    }

    // ボスの間へのゲート (ホールケーキ王)
    spawnBossGate(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r));

    // 固定の宝箱 (2026/07/25 追加: 奥のいちばん深いセルに固定配置。一度開けたら二度と出現しない)
    spawnChest(cellToWorldX(deepCell.c), cellToWorldZ(deepCell.r), false, 'stage1-f2-fixed-chest');

    // 追加の宝箱1個 (seedが固定なので毎回同じ位置に出る)
    const chestUsed = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    {
      let chestGuard = 0;
      while (chestGuard < 500) {
        chestGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage1-f2-chest-${r}-${c}`);
        break;
      }
    }

    // 回復地点(いやしのいずみ)をボスの手前に1箇所だけ配置
    // (2026/07/28 変更: 道中に置くとヌルゲー化するため、ボス直前限定にした)
    {
      const spot = findNearbyFreeCell(bossCell.r, bossCell.c, chestUsed);
      if (spot) {
        chestUsed.add(`${spot.r},${spot.c}`);
        spawnHealSpot(cellToWorldX(spot.c), cellToWorldZ(spot.r));
      }
    }
    for (let i = 0; i < 10; i++) {
      const r    = Math.floor(Math.random() * MAZE_ROWS);
      const c    = Math.floor(Math.random() * MAZE_COLS);
      const rock = makeRock(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      rock.scale.setScalar(0.6);
      scene.add(rock);
      stageDecorations.push(rock);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/* ---------------------------------------------------------
   ステージ2: わがしのしま
--------------------------------------------------------- */
/* ---------------------------------------------------------
   ステージ2: わがしのしま (2026/07/25 修正: 森テーマの1階/2階構成に)
--------------------------------------------------------- */
const STAGE2_F1_SEED = 280401;
const STAGE2_F2_SEED = 280402;
let   stage2Floor     = 1;

/** ステージ2の入り口 (島から選ぶと必ず1階から始まる) */
function setupStage2() {
  captureUsesLeft = MAX_CAPTURE_USES;
  setRaftVisual(false); // ステージ4から戻ってきた場合に備えてイカダを外す
  setupStage2Floor1();
}

function setupStage2Floor1() {
  currentStageNo = 2;
  currentMapMode = 'stage';
  stage2Floor = 1;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage2);
  withSeededRandom(STAGE2_F1_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setForestAtmosphere();

    // 壁は苔むした木の柵をイメージした深緑色
    wallMat.color.setHex(0x3a4a28);

    const grid      = generateMaze(MAZE_COLS, MAZE_ROWS);
    const stairCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    resetExploration(grid, 'ステージ2 (1かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーをスタート位置へ
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 8体 (1階はやや控えめに。わがしのしま専用の3種)
    const usedCells = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 8 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [6, 7, 8]);
      spawned++;
    }

    // 2階への階段
    spawnBossGate(cellToWorldX(stairCell.c), cellToWorldZ(stairCell.r), {
      kind: 'stairs',
      label: '2かいへ すすみますか？',
      desc:  'わがしのしま 2かいへの かいだんだ',
      nextAction: () => setupStage2Floor2(),
    });

    // 宝箱2個 (idを付けて開封済みなら二度と出現しないようにする)
    const chestUsed = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let chestSpawned = 0, chestGuard = 0;
    while (chestSpawned < 2 && chestGuard < 500) {
      chestGuard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (chestUsed.has(key)) continue;
      chestUsed.add(key);
      spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage2-f1-chest-${r}-${c}`);
      chestSpawned++;
    }

    // 隠し宝箱 (2026/07/27 追加: Zキー/決定で調べると出現)
    {
      let secretGuard = 0;
      while (secretGuard < 500) {
        secretGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        placeHiddenStageSecret(cellToWorldX(c), cellToWorldZ(r), { kind: 'chest', id: `stage2-f1-secret-${r}-${c}` });
        break;
      }
    }

    // 装飾木 (2026/07/25 修正: 岩→木に変更して森らしく)
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const tree = makeTree(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      scene.add(tree);
      stageDecorations.push(tree);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/** ステージ2・2階 (2026/07/25 追加: 奥に固定の宝箱と、羊羹将軍への本当のボスゲート) */
function setupStage2Floor2() {
  currentStageNo = 2;
  currentMapMode = 'stage';
  stage2Floor = 2;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage2);
  withSeededRandom(STAGE2_F2_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setForestAtmosphere();

    // 2階はより深い森の色合いに
    wallMat.color.setHex(0x24331a);

    const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
    const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    const deepCell = findSecondFarthestCell(grid, MAZE_COLS, MAZE_ROWS, bossCell.r, bossCell.c);
    resetExploration(grid, 'ステージ2 (2かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーは階段を上がってきた位置からスタート
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 10体 (2階は1階より手強い布陣)
    const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 10 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [6, 7, 8]);
      spawned++;
    }

    // ボスの間へのゲート (羊羹将軍)
    spawnBossGate(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r));

    // 固定の宝箱 (奥のいちばん深いセルに固定配置。一度開けたら二度と出現しない)
    spawnChest(cellToWorldX(deepCell.c), cellToWorldZ(deepCell.r), false, 'stage2-f2-fixed-chest');

    // 追加の宝箱1個 (seedが固定なので毎回同じ位置に出る)
    const chestUsed = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    {
      let chestGuard = 0;
      while (chestGuard < 500) {
        chestGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage2-f2-chest-${r}-${c}`);
        break;
      }
    }

    // 回復地点(いやしのいずみ)をボスの手前に1箇所だけ配置
    // (2026/07/28 変更: 道中に置くとヌルゲー化するため、ボス直前限定にした)
    {
      const spot = findNearbyFreeCell(bossCell.r, bossCell.c, chestUsed);
      if (spot) {
        chestUsed.add(`${spot.r},${spot.c}`);
        spawnHealSpot(cellToWorldX(spot.c), cellToWorldZ(spot.r));
      }
    }
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const tree = makeTree(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      scene.add(tree);
      stageDecorations.push(tree);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/* ---------------------------------------------------------
   ステージ3: フルーツパーラーのしま (2026/07/28 追加)
   南国リゾート風。1階/2階の2フロア構成で、わがしのしまと同じ骨組み。
--------------------------------------------------------- */
const STAGE3_F1_SEED = 370401;
const STAGE3_F2_SEED = 370402;
let   stage3Floor     = 1;

/** ステージ3の入り口 (島から選ぶと必ず1階から始まる) */
function setupStage3() {
  captureUsesLeft = MAX_CAPTURE_USES;
  setRaftVisual(false); // ステージ4から戻ってきた場合に備えてイカダを外す
  setupStage3Floor1();
}

function setupStage3Floor1() {
  currentStageNo = 3;
  currentMapMode = 'stage';
  stage3Floor = 1;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage3);
  withSeededRandom(STAGE3_F1_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setBeachAtmosphere();

    // 壁は明るい砂浜色に
    wallMat.color.setHex(0xe8c878);

    const grid      = generateMaze(MAZE_COLS, MAZE_ROWS);
    const stairCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    resetExploration(grid, 'ステージ3 (1かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーをスタート位置へ
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 8体 (1階はやや控えめに。フルーツパーラーのしま専用の3種)
    const usedCells = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 8 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [10, 11, 12]);
      spawned++;
    }

    // 2階への階段
    spawnBossGate(cellToWorldX(stairCell.c), cellToWorldZ(stairCell.r), {
      kind: 'stairs',
      label: '2かいへ すすみますか？',
      desc:  'フルーツパーラーのしま 2かいへの かいだんだ',
      nextAction: () => setupStage3Floor2(),
    });

    // 宝箱2個 (idを付けて開封済みなら二度と出現しないようにする)
    const chestUsed = new Set([`0,0`, `${stairCell.r},${stairCell.c}`]);
    let chestSpawned = 0, chestGuard = 0;
    while (chestSpawned < 2 && chestGuard < 500) {
      chestGuard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (chestUsed.has(key)) continue;
      chestUsed.add(key);
      spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage3-f1-chest-${r}-${c}`);
      chestSpawned++;
    }

    // 隠し宝箱 (Zキー/決定で調べると出現)
    {
      let secretGuard = 0;
      while (secretGuard < 500) {
        secretGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        placeHiddenStageSecret(cellToWorldX(c), cellToWorldZ(r), { kind: 'chest', id: `stage3-f1-secret-${r}-${c}` });
        break;
      }
    }

    // 装飾ヤシの木
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const tree = makePalmTree(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      scene.add(tree);
      stageDecorations.push(tree);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/** ステージ3・2階 (奥に固定の宝箱と、マスクメロン将軍への本当のボスゲート) */
function setupStage3Floor2() {
  currentStageNo = 3;
  currentMapMode = 'stage';
  stage3Floor = 2;

  if (typeof playBgm === 'function') playBgm(BGM_PATHS.stage3);
  withSeededRandom(STAGE3_F2_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setBeachAtmosphere();

    // 2階はより濃い夕焼けリゾートの色合いに
    wallMat.color.setHex(0xd89a4a);

    const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
    const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
    const deepCell = findSecondFarthestCell(grid, MAZE_COLS, MAZE_ROWS, bossCell.r, bossCell.c);
    resetExploration(grid, 'ステージ3 (2かい)');

    // 壁を配置
    for (let r = 0; r < MAZE_ROWS; r++) {
      for (let c = 0; c < MAZE_COLS; c++) {
        const cell = grid[r][c];
        const cx   = cellToWorldX(c);
        const cz   = cellToWorldZ(r);
        if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
        if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
        if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
      }
    }

    // プレイヤーは階段を上がってきた位置からスタート
    const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
    player.position.set(startX, 0, startZ);
    player.rotation.y = 0;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ - 1.3 * (i + 1));
    });

    // 雑魚敵 10体 (2階は1階より手強い布陣)
    const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    let spawned = 0, guard = 0;
    while (spawned < 10 && guard < 500) {
      guard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);
      spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [10, 11, 12]);
      spawned++;
    }

    // ボスの間へのゲート (マスクメロン将軍)
    spawnBossGate(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r));

    // 固定の宝箱 (奥のいちばん深いセルに固定配置。一度開けたら二度と出現しない)
    spawnChest(cellToWorldX(deepCell.c), cellToWorldZ(deepCell.r), false, 'stage3-f2-fixed-chest');

    // 追加の宝箱1個 (seedが固定なので毎回同じ位置に出る)
    const chestUsed = new Set([`0,0`, `${bossCell.r},${bossCell.c}`, `${deepCell.r},${deepCell.c}`]);
    {
      let chestGuard = 0;
      while (chestGuard < 500) {
        chestGuard++;
        const r = Math.floor(Math.random() * MAZE_ROWS);
        const c = Math.floor(Math.random() * MAZE_COLS);
        const key = `${r},${c}`;
        if (chestUsed.has(key)) continue;
        chestUsed.add(key);
        spawnChest(cellToWorldX(c), cellToWorldZ(r), false, `stage3-f2-chest-${r}-${c}`);
        break;
      }
    }

    // 回復地点(いやしのいずみ)をボスの手前に1箇所だけ配置
    // (2026/07/28 変更: 道中に置くとヌルゲー化するため、ボス直前限定にした)
    {
      const spot = findNearbyFreeCell(bossCell.r, bossCell.c, chestUsed);
      if (spot) {
        chestUsed.add(`${spot.r},${spot.c}`);
        spawnHealSpot(cellToWorldX(spot.c), cellToWorldZ(spot.r));
      }
    }

    // 装飾ヤシの木
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const tree = makePalmTree(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
      );
      scene.add(tree);
      stageDecorations.push(tree);
    }

    // 松明 (通路を照らす明かり)
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      spawnTorch(
        cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
        cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
      );
    }
  });
}

/* ---------------------------------------------------------
   ステージ4: カニ軍団のしま (2026/07/28 追加)
   これまでの「壁だらけの迷路」ではなく、開けた海面をイカダで自由に進む構成。
   浮き岩(obstacles配列に登録した丸型障害物)だけを避けながら進む。
--------------------------------------------------------- */
const STAGE4_SEED = 470401;
const STAGE4_HALF  = 19; // 移動できる範囲(原点からの最大距離、正方形の半分)

/** ステージ4の入り口 */
function setupStage4() {
  captureUsesLeft = MAX_CAPTURE_USES;
  currentStageNo  = 4;
  currentMapMode  = 'stage';

  if (typeof playBgm === 'function') playBgm(getStageBgm(4));
  withSeededRandom(STAGE4_SEED, () => {
    clearStageObjects();
    setupMazeFloor();
    setSeaAtmosphere();
    setRaftVisual(true);

    // 床(このステージだけ海面として青くする)
    mazeFloorMat.color.setHex(0x2a7ab0);
    if (minimapWrapEl) minimapWrapEl.style.display = 'none'; // 壁のない開けた海なのでミニマップは非表示

    // プレイヤーをスタート位置(手前の岸)へ。奥(-Z方向)がボスのいる沖合
    const startX = 0, startZ = STAGE4_HALF - 2;
    player.position.set(startX, 0, startZ);
    player.rotation.y = Math.PI;
    fieldPartyModels.forEach((m, i) => {
      m.position.set(startX, 0, startZ + 1.6 * (i + 1));
    });

    const placed = [{ x: startX, z: startZ, r: 3.5 }];
    const bossX = 0, bossZ = -(STAGE4_HALF - 2);
    placed.push({ x: bossX, z: bossZ, r: 4 });

    function isFarEnough(x, z, minDist) {
      return placed.every(p => Math.hypot(p.x - x, p.z - z) >= (minDist + (p.r || 0)));
    }
    function randomOpenSpot(minDist) {
      let guard = 0;
      while (guard < 800) {
        guard++;
        const x = (Math.random() * 2 - 1) * STAGE4_HALF;
        const z = (Math.random() * 2 - 1) * STAGE4_HALF;
        if (isFarEnough(x, z, minDist)) return { x, z };
      }
      return null;
    }

    // 浮き岩(当たり判定つき障害物)を配置
    for (let i = 0; i < 16; i++) {
      const spot = randomOpenSpot(3.2);
      if (!spot) break;
      placed.push({ x: spot.x, z: spot.z, r: 1.1 });
      const rock = makeReefRock(spot.x, spot.z);
      scene.add(rock);
      stageDecorations.push(rock);
      obstacles.push({ x: spot.x, z: spot.z, r: 1.1 });
    }

    // 雑魚敵(カニマンのみ) 12体
    for (let i = 0; i < 12; i++) {
      const spot = randomOpenSpot(2.6);
      if (!spot) break;
      placed.push({ x: spot.x, z: spot.z, r: 1.2 });
      spawnEnemy(spot.x, spot.z, [14]);
    }

    // 宝箱3個
    for (let i = 0; i < 3; i++) {
      const spot = randomOpenSpot(2.6);
      if (!spot) break;
      placed.push({ x: spot.x, z: spot.z, r: 1.2 });
      spawnChest(spot.x, spot.z, false, `stage4-chest-${i}`);
    }

    // 隠し宝箱 (Zキー/決定で調べると出現)
    {
      const spot = randomOpenSpot(2.6);
      if (spot) {
        placed.push({ x: spot.x, z: spot.z, r: 1.2 });
        placeHiddenStageSecret(spot.x, spot.z, { kind: 'chest', id: 'stage4-secret-chest' });
      }
    }

    // 回復地点(いやしのいずみ)をボスの手前に1箇所だけ配置
    spawnHealSpot(bossX, bossZ + 3.5);

    // ボスの間へのゲート(ケガ二マン)
    spawnBossGate(bossX, bossZ, {
      label: 'ケガ二マンが 待ちうけている…！ すすみますか？',
      desc:  'この先に入ると、たおすまで もどれません',
    });
  });
}

/**
 * プレイヤーと敵の直線上に壁が存在しないか判定する (視界判定)
 * @param {number} x1 - 始点X (敵)
 * @param {number} z1 - 始点Z (敵)
 * @param {number} x2 - 終点X (プレイヤー)
 * @param {number} z2 - 終点Z (プレイヤー)
 * @returns {boolean} 壁に遮られていなければ true
 */
function isLineOfSightClear(x1, z1, x2, z2) {
  for (const w of mazeWallColliders) {
    if (lineIntersectsAABB(x1, z1, x2, z2, w.minX, w.maxX, w.minZ, w.maxZ)) {
      return false; // 壁に衝突＝視界が遮られている
    }
  }
  return true;
}

/** 簡易的な線分と矩形(AABB)の交差判定 */
function lineIntersectsAABB(x1, z1, x2, z2, minX, maxX, minZ, maxZ) {
  let tMin = 0.0;
  let tMax = 1.0;
  
  const dx = x2 - x1;
  const dz = z2 - z1;
  
  // X軸のクリッピング
  if (Math.abs(dx) < 0.000001) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const invDX = 1.0 / dx;
    let t1 = (minX - x1) * invDX;
    let t2 = (maxX - x1) * invDX;
    if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  
  // Z軸のクリッピング
  if (Math.abs(dz) < 0.000001) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    const invDZ = 1.0 / dz;
    let t1 = (minZ - z1) * invDZ;
    let t2 = (maxZ - z1) * invDZ;
    if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  
  return true;
}
