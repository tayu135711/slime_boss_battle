/**
 * save.js
 * Render APIを使ったセーブ・ロード処理
 */

const SAVE_API = "https://slime-boss-battle.onrender.com/api/save";

// プレイヤーIDをlocalStorageで管理（端末ごとに固定）
function getPlayerId() {
  let id = localStorage.getItem("slime_player_id");
  if (!id) {
    id = "player_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("slime_player_id", id);
  }
  return id;
}

// stateをAPIに保存
async function saveToServer() {
  const playerId = getPlayerId();
  const body = {
    playerId,
    stageIndex:        state.stageIndex,
    unlockedStages:    state.unlockedStages,
    equippedCostumeId: state.equippedCostume?.id || "c01",
    ownedCostumes:     JSON.stringify(state.ownedCostumes.map(c => c.id)),
    inventory:         JSON.stringify(state.inventory),
    bento:             JSON.stringify(state.bento),
    dailyFishCount:    state.dailyFishCount,
    lastFishDate:      state.lastFishDate || "",
    dailyFlowerCount:  state.dailyFlowerCount,
    lastFlowerDate:    state.lastFlowerDate || "",
    quests:            JSON.stringify(state.quests),
    maxBento:          state.maxBento,
    unlockedRecipes:   JSON.stringify(state.unlockedRecipes),
  };

  try {
    const res = await fetch(SAVE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      dom.statusLine.textContent = "💾 セーブしました！";
      setTimeout(() => dom.statusLine.textContent = "", 2000);
    }
  } catch (e) {
    console.warn("セーブ失敗:", e);
  }
}

// APIからstateを復元
async function loadFromServer() {
  const playerId = getPlayerId();
  try {
    const res = await fetch(`${SAVE_API}/${playerId}`);
    if (!res.ok) return false; // 初回プレイなどで404の場合

    const data = await res.json();

    state.stageIndex      = data.stageIndex      ?? 0;
    state.unlockedStages  = data.unlockedStages  ?? 1;
    state.dailyFishCount  = data.dailyFishCount  ?? 0;
    state.lastFishDate    = data.lastFishDate    || null;
    state.dailyFlowerCount = data.dailyFlowerCount ?? 0;
    state.lastFlowerDate  = data.lastFlowerDate  || null;
    state.maxBento        = data.maxBento        ?? 3;

    // クエスト
    if (data.quests) {
      try { state.quests = JSON.parse(data.quests); } catch {}
    }
    // 解放済みレシピ
    if (data.unlockedRecipes) {
      try { state.unlockedRecipes = JSON.parse(data.unlockedRecipes); } catch {}
    }

    // インベントリ
    if (data.inventory) {
      try { state.inventory = JSON.parse(data.inventory); } catch {}
    }

    // お弁当
    if (data.bento) {
      try { state.bento = JSON.parse(data.bento); } catch {}
    }

    // コスチューム
    if (data.ownedCostumes) {
      try {
        const ids = JSON.parse(data.ownedCostumes);
        state.ownedCostumes = ids.map(id => COSTUMES.find(c => c.id === id)).filter(Boolean);
      } catch {}
    }
    if (data.equippedCostumeId) {
      state.equippedCostume = COSTUMES.find(c => c.id === data.equippedCostumeId) || COSTUMES[0];
    }

    return true;
  } catch (e) {
    console.warn("ロード失敗:", e);
    return false;
  }
}
