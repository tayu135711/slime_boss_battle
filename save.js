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
    accessories:       JSON.stringify(state.accessories  || []),
    bestTimes:         JSON.stringify(state.bestTimes    || {}),
    totalClears:       state.totalClears ?? 0,
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
      console.log("[save] セーブ成功:", playerId);
    } else {
      const errText = await res.text().catch(() => "");
      console.warn("[save] セーブ失敗 status=" + res.status, errText);
      dom.statusLine.textContent = "⚠️ セーブに失敗しました（通信エラー）";
      setTimeout(() => dom.statusLine.textContent = "", 3000);
    }
  } catch (e) {
    console.warn("[save] セーブ例外:", e);
    // Renderのコールドスタートで失敗した場合はリトライ（15秒後）
    setTimeout(async () => {
      try {
        await fetch(SAVE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        console.log("[save] リトライ成功");
      } catch (e2) {
        console.warn("[save] リトライも失敗:", e2);
      }
    }, 15000);
  }
}

// APIからstateを復元
async function loadFromServer() {
  const playerId = getPlayerId();
  try {
    const res = await fetch(`${SAVE_API}/${playerId}`);
    if (!res.ok) {
      console.log("[load] セーブデータなし（新規プレイ）", res.status);
      return false; // 初回プレイなどで404の場合
    }

    const data = await res.json();
    console.log("[load] ロード成功:", data);

    state.stageIndex      = data.stageIndex      ?? 0;
    state.unlockedStages  = data.unlockedStages  ?? 1;
    state.dailyFishCount  = data.dailyFishCount  ?? 0;
    state.lastFishDate    = data.lastFishDate    || null;
    state.dailyFlowerCount = data.dailyFlowerCount ?? 0;
    state.lastFlowerDate  = data.lastFlowerDate  || null;
    state.maxBento        = data.maxBento        ?? 3;

    // クエスト
    if (data.quests) {
      try { state.quests = JSON.parse(data.quests); } catch (e) { console.warn("[load] quests parse失敗", e); }
    }
    // 解放済みレシピ
    if (data.unlockedRecipes) {
      try { state.unlockedRecipes = JSON.parse(data.unlockedRecipes); } catch (e) { console.warn("[load] unlockedRecipes parse失敗", e); }
    }

    // インベントリ
    if (data.inventory) {
      try { state.inventory = JSON.parse(data.inventory); } catch (e) { console.warn("[load] inventory parse失敗", e); }
    }

    // お弁当
    if (data.bento) {
      try { state.bento = JSON.parse(data.bento); } catch (e) { console.warn("[load] bento parse失敗", e); }
    }

    // コスチューム
    if (data.ownedCostumes) {
      try {
        const ids = JSON.parse(data.ownedCostumes);
        state.ownedCostumes = ids.map(id => COSTUMES.find(c => c.id === id)).filter(Boolean);
      } catch (e) { console.warn("[load] ownedCostumes parse失敗", e); }
    }
    // ★ ownedCostumesが空になってしまった場合は初期コスチュームを補填
    if (!state.ownedCostumes || state.ownedCostumes.length === 0) {
      state.ownedCostumes = [COSTUMES[0]];
    }
    if (data.equippedCostumeId) {
      state.equippedCostume = COSTUMES.find(c => c.id === data.equippedCostumeId) || COSTUMES[0];
    }
    // ★ 装備コスチュームが所持リストにない場合は追加
    if (!state.ownedCostumes.find(c => c.id === state.equippedCostume?.id)) {
      state.ownedCostumes.unshift(state.equippedCostume || COSTUMES[0]);
    }

    // ★ stageIndexがSTAGESの範囲外ならクランプ
    state.stageIndex = Math.max(0, Math.min(state.stageIndex, STAGES.length - 1));
    // ★ unlockedStagesもクランプ（最低1、最大はSTAGES.length）
    state.unlockedStages = Math.max(1, Math.min(state.unlockedStages, STAGES.length));

    // アクセサリー・クリア記録
    if (data.accessories) {
      try { state.accessories = JSON.parse(data.accessories); } catch (e) { console.warn("[load] accessories parse失敗", e); }
    }
    if (data.bestTimes) {
      try { state.bestTimes = JSON.parse(data.bestTimes); } catch (e) { console.warn("[load] bestTimes parse失敗", e); }
    }
    state.totalClears = data.totalClears ?? 0;

    return true;
  } catch (e) {
    console.warn("[load] ロード例外:", e);
    return false;
  }
}
