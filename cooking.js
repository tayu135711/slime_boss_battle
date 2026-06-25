let cookingUI = null;
let selectedIngredients = [];
const MAX_BENTO = 3;

function initCookingUI() {
  if (document.getElementById("cookingUI")) return;
  cookingUI = document.createElement("div");
  cookingUI.id = "cookingUI";
  cookingUI.innerHTML = `
    <div id="cookingBox">
      <div id="cookingHeader">🍜 食堂</div>
      <div id="cookingChefMsg">マスター「いらっしゃい！何を作ろうか？」</div>
      <div id="cookingIngredients"></div>
      <div id="cookingButtons">
        <button id="cookBtn">調理する</button>
        <button id="cookingBackBtn">やめる</button>
      </div>
      <div id="cookingResult"></div>
    </div>
  `;
  document.body.appendChild(cookingUI);
  document.getElementById("cookBtn").addEventListener("click", executeCooking);
  document.getElementById("cookingBackBtn").addEventListener("click", closeCooking);
}

function showCooking() {
  if (fishingActive || plazaDialog) return;
  initCookingUI();
  cookingUI.style.display = "flex";
  selectedIngredients = [];
  renderIngredientSelection();
  document.getElementById("cookingChefMsg").textContent = "マスター「使いたい素材を選んでね」";
  document.getElementById("cookingResult").innerHTML = "";
}

function closeCooking() {
  cookingUI.style.display = "none";
  selectedIngredients = [];
}

function renderIngredientSelection() {
  const container = document.getElementById("cookingIngredients");
  container.innerHTML = "";
  const inv = state.inventory.ingredients;
  let hasAny = false;

  Object.keys(inv).forEach(id => {
    const count = inv[id];
    if (count <= 0) return;
    hasAny = true;
    const fishInfo = FISH_TABLE.find(f => f.id === id) || FLOWER_TYPES.find(f => f.id === id);
    const name = fishInfo ? fishInfo.name : id;
    const icon = fishInfo ? fishInfo.icon : "🧂";
    const div = document.createElement("div");
    div.className = "cooking-ingredient";
    div.dataset.id = id;
    div.innerHTML = `${icon} ${name} ×${count}`;
    if (selectedIngredients.filter(i => i === id).length < count) div.classList.add("available");
    div.addEventListener("click", () => {
      if (selectedIngredients.filter(i => i === id).length < count) selectedIngredients.push(id);
      renderIngredientSelection();
    });
    container.appendChild(div);
  });

  if (selectedIngredients.length > 0) {
    const selectedDiv = document.createElement("div");
    selectedDiv.className = "selected-ingredients";
    selectedDiv.innerHTML = `選択中: ${selectedIngredients.map(id => (FISH_TABLE.find(f=>f.id===id)||FLOWER_TYPES.find(f=>f.id===id)||{}).icon||id).join(" ")} <button class="clear-selection">クリア</button>`;
    selectedDiv.querySelector(".clear-selection").addEventListener("click", () => { selectedIngredients = []; renderIngredientSelection(); });
    container.appendChild(selectedDiv);
  }

  if (!hasAny) container.innerHTML = "<p>まだ素材がありません。釣りや花摘みで集めてね。</p>";
  document.getElementById("cookBtn").disabled = selectedIngredients.length === 0;
}

function executeCooking() {
  if (selectedIngredients.length === 0) return;
  const ingredientCounts = {};
  selectedIngredients.forEach(id => ingredientCounts[id] = (ingredientCounts[id] || 0) + 1);

  const matchedRecipe = RECIPES.find(recipe => {
    const req = recipe.ingredients;
    const reqIds = Object.keys(req);
    const selectedIds = Object.keys(ingredientCounts);
    if (reqIds.length !== selectedIds.length) return false;
    return reqIds.every(id => req[id] === ingredientCounts[id]);
  });

  const resultDiv = document.getElementById("cookingResult");
  if (matchedRecipe) {
    selectedIngredients.forEach(id => {
      state.inventory.ingredients[id]--;
      if (state.inventory.ingredients[id] <= 0) delete state.inventory.ingredients[id];
    });

    if (state.bento.length >= state.maxBento) {
      resultDiv.innerHTML = `<p>お弁当がいっぱいだ…。先に食べてからにしてね。</p>`;
    } else {
      state.bento.push(matchedRecipe);
      resultDiv.innerHTML = `<p>✨ ${matchedRecipe.icon} ${matchedRecipe.name} が完成！</p><p>${matchedRecipe.effectDesc}</p><p>お弁当に入れたよ🍱</p>`;
    }
  } else {
    resultDiv.innerHTML = `<p>その組み合わせでは何もできなかった…。別の素材を試してみよう。</p>`;
  }

  selectedIngredients = [];
  renderIngredientSelection();
  setTimeout(() => { if (cookingUI.style.display !== "none") resultDiv.innerHTML = ""; }, 2500);
}