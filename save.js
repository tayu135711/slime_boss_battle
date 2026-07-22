/**
 * save.js
 * Render APIを使ったセーブ・ロード処理
 */

const SAVE_API = "https://slime-boss-battle.onrender.com/api/save";

// ── Renderのコールドスタート対策：アプリ起動時にウォームアップリクエストを送る ──
(function warmUpServer() {
  // バックグラウンドでGETを叩いてサーバーを起こしておく（404でもOK）
  fetch(`${SAVE_API}/__warmup__`, { method: "GET", signal: AbortSignal.timeout(30000) })
    .catch(() => {}); // エラーは無視
})();

// プレイヤーIDをlocalStorageで管理（端末ごとに固定）
function getPlayerId() {
  try {
    let id = localStorage.getItem("slime_player_id");
    if (!id) {
      id = "player_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("slime_player_id", id);
    }
    return id;
  } catch (e) {
    // ★修正: プライベートブラウズ等でlocalStorageが使えない場合のクラッシュ対策
    return "player_guest_" + Math.random().toString(36).slice(2, 10);
  }
}

// ★ fetchをタイムアウト付きで実行するラッパー
async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ★修正: 釣りや花摘みで短時間に何度もアイテムを獲得すると、その都度 saveToServer() が
//         呼ばれる。Renderのコールドスタート対策で1回のセーブが最大3回リトライ（間に
//         8秒・16秒の待機を挟む）するため、複数のセーブ処理が同時に並走してしまうことが
//         あった。ネットワークの遅延次第では「後から送った新しいセーブ」より「先に送った
//         古いセーブ」がサーバーに遅れて到達し、結果的に新しく取得したアイテムが古いデータ
//         で上書きされて消えてしまう（次回ロード時にインベントリが減って見える）不具合の
//         原因になっていた。同時に1件しか通信しないようキューイングし、進行中のセーブが
//         終わった後に「その時点の最新state」でもう一度だけ送り直すようにする。
let _saveInFlight = false;
let _saveQueued = false;

async function saveToServer() {
  if (_saveInFlight) {
    _saveQueued = true; // 今のセーブが終わったら、最新stateでもう一度だけ送る
    return;
  }
  _saveInFlight = true;
  try {
    do {
      _saveQueued = false;
      await _saveToServerOnce();
    } while (_saveQueued);
  } finally {
    _saveInFlight = false;
  }
}

// stateをAPIに保存（実際の通信処理・常に呼び出し時点の最新stateを送る）
async function _saveToServerOnce() {
  const playerId = getPlayerId();
  const body = {
    playerId,
    stageIndex:        state.stageIndex,
    unlockedStages:    state.unlockedStages,
    equippedCostumeId: state.equippedCostume?.id || "c01",
    ownedCostumes:     JSON.stringify(state.ownedCostumes.map(c => c.id)),
    inventory:         JSON.stringify(state.inventory?.ingredients !== undefined ? state.inventory : { ingredients: {} }),
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
    gachaTickets:      state.gachaTickets ?? 0,
  };

  const reqOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  // ★ サーバーエラー時用にローカルにバックアップを保存
  localStorage.setItem("slime_boss_save_fallback", JSON.stringify(body));

  // ★ 最大3回リトライ（コールドスタートで1回目が失敗してもリトライで成功させる）
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchWithTimeout(SAVE_API, reqOptions, 25000);
      if (res.ok) {
        dom.statusLine.textContent = "💾 セーブしました！";
        setTimeout(() => dom.statusLine.textContent = "", 2000);
        console.log("[save] セーブ成功:", playerId, `(attempt ${attempt})`);
        return;
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[save] セーブ失敗 attempt=${attempt} status=` + res.status, errText);
        if (attempt === 3) {
          dom.statusLine.textContent = "⚠️ セーブに失敗しました（通信エラー）";
          setTimeout(() => dom.statusLine.textContent = "", 3000);
        }
      }
    } catch (e) {
      console.warn(`[save] セーブ例外 attempt=${attempt}:`, e);
      if (attempt < 3) {
        // リトライ前に少し待つ（コールドスタート起動待ち）
        await new Promise(r => setTimeout(r, attempt * 8000));
      } else {
        dom.statusLine.textContent = "⚠️ セーブに失敗しました（サーバー起動中かも）";
        setTimeout(() => dom.statusLine.textContent = "", 4000);
      }
    }
  }
}

// APIからstateを復元
async function loadFromServer() {
  const playerId = getPlayerId();
  // ★修正: 以前は fetchWithTimeout が例外を投げると（タイムアウト・オフライン等）
  //         関数全体のcatchに飛んで即座に return false していたため、
  //         ローカルバックアップ(localStorage)の復元処理(下のブロック)に
  //         一切到達できなかった。Renderの無料プランはコールドスタートで
  //         数十秒かかることがあり、タイムアウト(30秒)に達すると必ずこの経路に
  //         入っていたため、セーブ自体はローカルに残っているのに「初回プレイ」
  //         扱いになってしまい、実質的にデータが保存されていないように見える
  //         バグになっていた。サーバー通信だけを個別のtry/catchで囲み、
  //         失敗してもローカルバックアップの復元まで必ず到達するようにする。
  let data = null;
  try {
    const res = await fetchWithTimeout(`${SAVE_API}/${playerId}`, {}, 30000);
    if (!res.ok) {
      console.log("[load] セーブデータなし（新規プレイまたは通信エラー）", res.status);
    } else {
      data = await res.json();
      console.log("[load] サーバーからロード成功:", data);
    }
  } catch (e) {
    console.warn("[load] サーバー通信失敗。ローカルバックアップを使用します:", e);
  }

  try {
    // ★ サーバーになくてもローカルにバックアップがあればマージする
    const localDataRaw = localStorage.getItem("slime_boss_save_fallback");
    if (localDataRaw) {
      try {
        const localData = JSON.parse(localDataRaw);
        if (!data) {
          data = localData;
          console.log("[load] ローカルからロード成功:", data);
        } else {
          // 簡単なマージ（今回は簡略化してサーバー優先、なければローカル）
          data = { ...localData, ...data };
        }
      } catch (e) { console.warn("ローカルバックアップ破損", e); }
    }

    if (!data) return false; // 初回プレイなどで両方ない場合

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
      try {
        const parsed = JSON.parse(data.inventory);
        // ★ { ingredients: {...} } 形式を保証する（古いセーブデータ互換対策）
        if (parsed && typeof parsed === "object") {
          if (parsed.ingredients && typeof parsed.ingredients === "object") {
            state.inventory = parsed; // 正常フォーマット
          } else if (!parsed.ingredients) {
            // ingredientsキーがない場合：parsed自体がingredientsとして保存されていた古い形式
            state.inventory = { ingredients: parsed };
          }
        }
      } catch (e) { console.warn("[load] inventory parse失敗", e); }
    }
    // ★ ingredientsが存在しない場合は必ず初期化
    if (!state.inventory || !state.inventory.ingredients) {
      state.inventory = { ingredients: {} };
    }

    // お弁当
    if (data.bento) {
      try {
        const parsed = JSON.parse(data.bento);
        // ★ 配列形式を保証する
        state.bento = Array.isArray(parsed) ? parsed : [];
      } catch (e) { console.warn("[load] bento parse失敗", e); }
    }
    // ★ bentoが配列でない場合は初期化
    if (!Array.isArray(state.bento)) state.bento = [];

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
    // ★ 既存セーブにはまだ無いフィールドなので、無ければ初回同様に少額プレゼント
    state.gachaTickets = data.gachaTickets ?? 3;

    return true;
  } catch (e) {
    console.warn("[load] ロード例外:", e);
    return false;
  }
}
