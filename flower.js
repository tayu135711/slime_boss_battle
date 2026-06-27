const FLOWER_PICK_LIMIT = 5;
const FLOWER_TYPES = [
  { id: "red_flower",   name: "赤い花",   icon: "🌹", color: 0xFF4444, rarity: 0.4 },
  { id: "blue_flower",  name: "青い花",   icon: "🌼", color: 0x4488FF, rarity: 0.3 },
  { id: "yellow_flower",name: "黄色い花",  icon: "🌻", color: 0xFFDD44, rarity: 0.2 },
  { id: "white_flower", name: "白い花",   icon: "🌸", color: 0xFFFFFF, rarity: 0.1 },
];

let flowerUI = null;

function initFlowerUI() {
  if (document.getElementById("flowerUI")) return;
  flowerUI = document.createElement("div");
  flowerUI.id = "flowerUI";
  flowerUI.innerHTML = `
    <div id="flowerBox">
      <div id="flowerPrompt"></div>
      <div id="flowerAction" style="opacity:0">Ａ でそっと摘む</div>
    </div>
  `;
  document.body.appendChild(flowerUI);
}

function pickFlower() {
  if (!nearestFlower || nearestFlower.userData.picked) return;

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
  document.getElementById("flowerPrompt").textContent = `${flowerType.icon} ${flowerType.name} が咲いている…`;
  document.getElementById("flowerAction").style.opacity = "1";

  // ★ 自動摘みから「Aボタン待ち」に変更：flowerPhaseフラグで管理
  window._flowerWaiting = true;
}

function doPickFlower() {
  if (!window._flowerWaiting || !nearestFlower || nearestFlower.userData.picked) return;
  window._flowerWaiting = false;

  const flowerType = nearestFlower.userData.flowerType;
  nearestFlower.visible = false;
  nearestFlower.userData.picked = true;
  nearestFlower.userData.respawnTime = Date.now() + 86400000;

  if (!state.inventory.ingredients[flowerType.id]) state.inventory.ingredients[flowerType.id] = 0;
  state.inventory.ingredients[flowerType.id]++;
  state.dailyFlowerCount++;

  document.getElementById("flowerPrompt").textContent = `${flowerType.icon} ${flowerType.name} をそっと摘んだ。`;
  document.getElementById("flowerAction").style.display = "none";
  setTimeout(() => {
    flowerUI.style.display = "none";
    document.getElementById("flowerAction").style.display = "";
    nearestFlower = null;
    plazaNearFlower = false;
    if (typeof updatePlazaCameraFollow === "function") updatePlazaCameraFollow();
  }, 1500);

  updateFlowerQuests(flowerType.id);
  checkQuestProgress();
}

function updateFlowerQuests(flowerId) {
  if (state.quests["flower_beginner"]?.active) {
    state.quests["flower_beginner"].collected++;
    if (state.quests["flower_beginner"].collected >= state.quests["flower_beginner"].goal) {
      completeQuest("flower_beginner");
    }
  }
}