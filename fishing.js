/**
 * fishing.js
 * のどかな釣りミニゲーム
 */

let fishingActive = false;
let fishingPhase = "idle";
let fishingTimer = null;
let fishingHitZone = { start: 0, end: 0 };

const FISHING_DAILY_LIMIT = 3;
const FISHING_WAIT_MIN = 3000;
const FISHING_WAIT_MAX = 7000;
const FISHING_HIT_DURATION = 800;

let fishingUI = null;

function initFishingUI() {
  if (document.getElementById("fishingUI")) return;
  fishingUI = document.createElement("div");
  fishingUI.id = "fishingUI";
  fishingUI.innerHTML = `
    <div id="fishingBox">
      <div id="fishingPrompt">静かな水面を見つめる…</div>
      <div id="fishingAction" style="opacity:0">Ａ でそっと合わせる</div>
    </div>
  `;
  document.body.appendChild(fishingUI);
}

function startFishing() {
  if (fishingActive) return;
  // ★修正: endFishing() は「釣り上げた／逃してしまった」の結果メッセージを約1〜1.5秒
  //         表示している間に fishingActive を先に false へ戻す。そのため、この結果表示中に
  //         Ａボタンを押すと（handlePlazaAction経由で）startFishing()が再実行されてしまい、
  //         直前のUI・タイマーと競合して表示が壊れたり釣果が正しく反映されなかったりする
  //         不具合があった。結果表示中（fishingUIがまだ非表示になっていない間）は
  //         新しい釣りを開始しない。
  const existingUI = document.getElementById("fishingUI");
  if (existingUI && existingUI.style.display !== "none" && existingUI.style.display !== "") return;
  fishingActive = true;  // ← フェードアニメーション中の連打を即ブロック

  const today = new Date().toDateString();
  if (!state.lastFishDate || state.lastFishDate !== today) {
    state.dailyFishCount = 0;
    state.lastFishDate = today;
  }
  if (state.dailyFishCount >= FISHING_DAILY_LIMIT) {
    fishingActive = false;  // 制限に引っかかった場合はリセット
    dom.statusLine.textContent = "🎣 今日はもう十分。また明日おいで。";
    setTimeout(() => dom.statusLine.textContent = "", 2000);
    return;
  }

  initFishingUI();
  fishingPhase = "waiting";

  fishingUI.style.display = "flex";
  document.getElementById("fishingPrompt").textContent = "浮きがそっと揺れるのを待つ…";
  document.getElementById("fishingAction").style.opacity = "0";
  SE.fishingCast();

  const waitTime = FISHING_WAIT_MIN + Math.random() * (FISHING_WAIT_MAX - FISHING_WAIT_MIN);
  fishingTimer = setTimeout(() => {
    if (!fishingActive) return;
    fishingPhase = "strike";
    document.getElementById("fishingPrompt").textContent = "…きた。";
    document.getElementById("fishingAction").style.opacity = "1";
    SE.fishingBite();
    const now = Date.now();
    fishingHitZone.start = now;
    fishingHitZone.end = now + FISHING_HIT_DURATION;
    fishingTimer = setTimeout(() => {
      if (fishingActive && fishingPhase === "strike") endFishing(false, "miss");
    }, FISHING_HIT_DURATION);
  }, waitTime);
}

function endFishing(success, reason = "miss") {
  clearTimeout(fishingTimer);
  fishingTimer = null;
  fishingActive = false;
  fishingPhase = "idle";

  if (success) {
    const fish = selectFish();
    if (!state.inventory.ingredients[fish.id]) state.inventory.ingredients[fish.id] = 0;
    state.inventory.ingredients[fish.id]++;
    state.dailyFishCount++;
    SE.fishingSuccess();

    document.getElementById("fishingPrompt").textContent = `${fish.icon} ${fish.name} をそっと釣り上げた。`;
    document.getElementById("fishingAction").style.display = "none";

    // ★ 釣り成功時に水しぶきパーティクルを発生（隔離座標 100, 100 に）
    if (typeof spawnWaterSplash === "function") {
      spawnWaterSplash(100, 100);
    }

    setTimeout(() => {
      fishingUI.style.display = "none";
      document.getElementById("fishingAction").style.display = "";
      subAreaCameraLocked = false;  // ★ カメラロック解除（釣り後は自由移動）
      dom.statusLine.textContent = `${fish.icon} ${fish.name}: ${fish.desc}`;
      setTimeout(() => dom.statusLine.textContent = "", 2500);
      checkQuestProgress();
      saveToServer(); // ★ 釣り結果（インベントリ・カウント）をセーブ
      if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
      // ★ 釣り場エリア内なら残り回数があれば自動で次の一投を促す
      _afterFishingInArea();
    }, 1500);
  } else {
    SE.fishingMiss();
    if (reason === "too_early") {
      document.getElementById("fishingPrompt").textContent = "…早すぎた！そっと逃がしてしまった。";
    } else {
      document.getElementById("fishingPrompt").textContent = "…遅すぎた！そっと逃がしてしまった。";
    }
    document.getElementById("fishingAction").style.display = "none";
    setTimeout(() => {
      fishingUI.style.display = "none";
      document.getElementById("fishingAction").style.display = "";
      subAreaCameraLocked = false;  // ★ カメラロック解除
      if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
      // ★ 釣り場エリア内なら残り回数があれば次の一投を促す
      _afterFishingInArea();
    }, 1200);
  }
}

/** 釣り終了後、釣り場エリア内ならプロンプトを表示 */
function _afterFishingInArea() {
  if (typeof currentSubArea === "undefined" || currentSubArea !== "pond") return;
  const remaining = FISHING_DAILY_LIMIT - state.dailyFishCount;
  if (remaining > 0) {
    dom.statusLine.textContent = `🎣 あと ${remaining} 回釣れる。Ａ でもう一度！`;
    setTimeout(() => dom.statusLine.textContent = "", 3000);
  } else {
    dom.statusLine.textContent = "🎣 今日はもう十分。また明日おいで。";
    setTimeout(() => dom.statusLine.textContent = "", 2500);
  }
}

function selectFish() {
  const r = Math.random();
  let cumulative = 0;
  for (const fish of FISH_TABLE) {
    cumulative += fish.rarity;
    if (r < cumulative) return fish;
  }
  return FISH_TABLE[0];
}

function fishingAction() {
  if (!fishingActive) return;
  if (fishingPhase === "waiting") {
    endFishing(false, "too_early");
    return;
  }
  if (fishingPhase !== "strike") return;
  const now = Date.now();
  if (now >= fishingHitZone.start && now <= fishingHitZone.end) {
    endFishing(true);
  } else {
    endFishing(false, "miss");
  }
}