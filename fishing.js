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

  const waitTime = FISHING_WAIT_MIN + Math.random() * (FISHING_WAIT_MAX - FISHING_WAIT_MIN);
  fishingTimer = setTimeout(() => {
    if (!fishingActive) return;
    fishingPhase = "strike";
    document.getElementById("fishingPrompt").textContent = "…きた。";
    document.getElementById("fishingAction").style.opacity = "1";
    const now = Date.now();
    fishingHitZone.start = now;
    fishingHitZone.end = now + FISHING_HIT_DURATION;
    fishingTimer = setTimeout(() => {
      if (fishingActive && fishingPhase === "strike") endFishing(false);
    }, FISHING_HIT_DURATION);
  }, waitTime);
}

function endFishing(success) {
  clearTimeout(fishingTimer);
  fishingTimer = null;
  fishingActive = false;

  if (success) {
    const fish = selectFish();
    if (!state.inventory.ingredients[fish.id]) state.inventory.ingredients[fish.id] = 0;
    state.inventory.ingredients[fish.id]++;
    state.dailyFishCount++;

    document.getElementById("fishingPrompt").textContent = `${fish.icon} ${fish.name} をそっと釣り上げた。`;
    document.getElementById("fishingAction").style.display = "none";
    setTimeout(() => {
      fishingUI.style.display = "none";
      document.getElementById("fishingAction").style.display = "";
      fishingPhase = "idle";
      dom.statusLine.textContent = `${fish.icon} ${fish.name}: ${fish.desc}`;
      setTimeout(() => dom.statusLine.textContent = "", 2500);
      checkQuestProgress();
      if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
    }, 1500);
  } else {
    document.getElementById("fishingPrompt").textContent = "…そっと逃がしてしまった。";
    document.getElementById("fishingAction").style.display = "none";
    setTimeout(() => {
      fishingUI.style.display = "none";
      document.getElementById("fishingAction").style.display = "";
      fishingPhase = "idle";
      if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
    }, 1000);
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
  if (!fishingActive || fishingPhase !== "strike") return;
  const now = Date.now();
  if (now >= fishingHitZone.start && now <= fishingHitZone.end) {
    endFishing(true);
  } else {
    endFishing(false);
  }
}