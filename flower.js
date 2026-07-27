const FLOWER_PICK_LIMIT = 5;
const FLOWER_TYPES = [
  { id: "red_flower",   name: "赤い花",   icon: "🌹", color: 0xFF4444, rarity: 0.4 },
  { id: "blue_flower",  name: "青い花",   icon: "🌼", color: 0x4488FF, rarity: 0.3 },
  { id: "yellow_flower",name: "黄色い花",  icon: "🌻", color: 0xFFDD44, rarity: 0.2 },
  { id: "white_flower", name: "白い花",   icon: "🌸", color: 0xFFFFFF, rarity: 0.1 },
];

let flowerUI = null;
let flowerRingCtrl = null; // ★追加: 円形タイミングゲージの制御オブジェクト
const FLOWER_RING_SPIN_MS  = 2000; // ★変更: 速すぎたので少し落ち着かせた
const FLOWER_RING_ZONE_DEG = 130;  // 成功ゾーンの角度幅（釣りより広め＝易しめ）
const FLOWER_RING_TIMEOUT_MS = 2800;
let flowerRingTimer = null;

function initFlowerUI() {
  if (document.getElementById("flowerUI")) return;
  flowerUI = document.createElement("div");
  flowerUI.id = "flowerUI";
  // ★変更: 画面全体を覆う暗転ポップアップだと3Dの世界（花を摘んでいる自分の
  //         スライム）が見えなくなってしまうため、小さなパネルに変更。
  //         また、以前はＡボタンを押すだけで確実に摘めていたが、釣りと同じ
  //         円形タイミングゲージ(timing_ring.js)を追加し、タイミングを合わせて
  //         摘む楽しさを持たせる。
  flowerUI.innerHTML = `
    <div id="flowerBox">
      <div id="flowerPrompt"></div>
      <div id="flowerRingWrap" style="display:none">
        <div id="flowerRing"></div>
      </div>
      <div id="flowerAction" style="opacity:0">Ａ でそっと摘む</div>
    </div>
  `;
  document.body.appendChild(flowerUI);
  // ★修正: fishing.jsと同根のバグ。#flowerUI も画面全体を覆うモーダル(z-index:100)で、
  //         コントローラーのＡボタン(#hud, z-index:10)を覆ってしまうため、スマホでは
  //         花摘み確認モーダルが出た瞬間にタップで確定する手段がなくなっていた。
  //         モーダル自体をタップしてもＡボタンと同じ操作になるようにする。
  flowerUI.addEventListener("click", () => {
    if (window._flowerWaiting) doPickFlower();
  });
}

function pickFlower() {
  if (!nearestFlower || nearestFlower.userData.picked) return;

  // ★修正: 花を摘んだ直後の結果メッセージ表示中（flowerUIがまだ非表示になっていない間）に
  //         近くの別の花へ移動してAを押すと、pickFlower()が再度呼び出され、表示中の
  //         メッセージ・タイマーと競合して表示が壊れたり花摘みが正しく反映されなかったり
  //         する不具合があった（fishing.jsの既知バグと同根）。結果表示中は新しい花摘みを
  //         開始しないようにする。
  const existingUI = document.getElementById("flowerUI");
  if (existingUI && existingUI.style.display !== "none" && existingUI.style.display !== "") return;

  const today = new Date().toDateString();
  if (!state.lastFlowerDate || state.lastFlowerDate !== today) {
    state.dailyFlowerCount = 0;
    state.lastFlowerDate = today;
  }
  if (state.dailyFlowerCount >= FLOWER_PICK_LIMIT) {
    dom.statusLine.textContent = "🌸 今日はもう十分。また明日摘みにおいで。";
    setTimeout(() => dom.statusLine.textContent = "", 2000);
    if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
    return;
  }

  initFlowerUI();
  flowerUI.style.display = "flex";
  const flowerType = nearestFlower.userData.flowerType;
  document.getElementById("flowerPrompt").textContent = `${flowerType.icon} ${flowerType.name} が咲いている… タイミングを合わせて摘もう！`;
  document.getElementById("flowerAction").style.opacity = "1";

  // ★変更: 円形タイミングゲージを表示する。以前はAボタンを押すだけで確実に
  //         摘めていたが、釣りと同じ仕組みでタイミングを合わせる楽しさを持たせる。
  const wrap = document.getElementById("flowerRingWrap");
  const ringEl = document.getElementById("flowerRing");
  if (wrap && ringEl) {
    wrap.style.display = "flex";
    flowerRingCtrl = createTimingRing(ringEl, {
      durationMs: FLOWER_RING_SPIN_MS,
      zoneSizeDeg: FLOWER_RING_ZONE_DEG,
      ringColor: "#ffb6d9",
      onResult: (success) => resolvePickFlower(success),
    });
  }
  flowerRingTimer = setTimeout(() => {
    if (window._flowerWaiting && flowerRingCtrl) flowerRingCtrl.timeout();
  }, FLOWER_RING_TIMEOUT_MS);

  // ★ 自動摘みから「Aボタン待ち」に変更：flowerPhaseフラグで管理
  window._flowerWaiting = true;
}

function doPickFlower() {
  if (!window._flowerWaiting) return;
  // ★変更: 即座に成功させず、円形ゲージのpress()で判定する。
  //         成否の実処理はresolvePickFlower()（ゲージのonResultコールバック）で行う。
  if (flowerRingCtrl) flowerRingCtrl.press();
}

/** 円形ゲージの判定結果を受けて、花摘みの成功/失敗を処理する */
function resolvePickFlower(success) {
  window._flowerWaiting = false;
  clearTimeout(flowerRingTimer);
  flowerRingTimer = null;
  const wrap = document.getElementById("flowerRingWrap");
  if (wrap) wrap.style.display = "none";
  if (flowerRingCtrl) { flowerRingCtrl.destroy(); flowerRingCtrl = null; }

  if (!nearestFlower || nearestFlower.userData.picked) {
    if (flowerUI) flowerUI.style.display = "none";
    return;
  }

  const flowerType = nearestFlower.userData.flowerType;

  if (!success) {
    // ★変更: 花は逃げないので、タイミングを外しても日課回数は消費せず、
    //         花もそのまま咲いた状態を保つ（気軽にもう一度挑戦できるように）。
    SE.fishingMiss();
    document.getElementById("flowerPrompt").textContent = "…ちょっとタイミングがずれた。もう一度！";
    document.getElementById("flowerAction").style.display = "none";
    setTimeout(() => {
      flowerUI.style.display = "none";
      document.getElementById("flowerAction").style.display = "";
      if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
    }, 1100);
    return;
  }

  nearestFlower.visible = false;
  nearestFlower.userData.picked = true;
  nearestFlower.userData.respawnTime = Date.now() + 86400000;
  SE.flowerPick();

  // ★ 花摘み成功時にキラキラのフラワーパーティクルを発生
  if (typeof spawnFlowerParticles === "function") {
    spawnFlowerParticles(nearestFlower.position.x, nearestFlower.position.z);
  }

  if (!state.inventory.ingredients[flowerType.id]) state.inventory.ingredients[flowerType.id] = 0;
  state.inventory.ingredients[flowerType.id]++;
  state.dailyFlowerCount++;

  document.getElementById("flowerPrompt").textContent = `${flowerType.icon} ${flowerType.name} をそっと摘んだ。`;
  document.getElementById("flowerAction").style.display = "none";
  setTimeout(() => {
    flowerUI.style.display = "none";
    document.getElementById("flowerAction").style.display = "";
    // ★修正: ここでの nearestFlower = null / plazaNearFlower = false の手動クリアを廃止。
    //         これらは毎フレーム checkFlowerProximity() で自動的に正しく再計算されるため、
    //         タイマー内でのクリアは「別の花に近づいても認識しなくなる」バグの原因になります。
    if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
  }, 1500);

  updateFlowerQuests(flowerType.id);
  checkQuestProgress();
  saveToServer(); // ★ 花摘み結果（インベントリ・カウント）をセーブ
}

function updateFlowerQuests(flowerId) {
  if (state.quests["flower_beginner"]?.active) {
    state.quests["flower_beginner"].collected++;
    if (state.quests["flower_beginner"].collected >= state.quests["flower_beginner"].goal) {
      completeQuest("flower_beginner");
    }
  }
}