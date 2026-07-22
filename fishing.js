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
      <div id="fishingTimingWrap" style="display:none">
        <div id="fishingTimingLabel">⏱ 今だ！</div>
        <div id="fishingTimingTrack">
          <div id="fishingTimingBar"></div>
        </div>
      </div>
      <div id="fishingAction" style="opacity:0">Ａ でそっと合わせる</div>
    </div>
  `;
  document.body.appendChild(fishingUI);
  // ★修正: #fishingUI は画面全体を覆う(inset:0)モーダルで、z-index:100 が
  //         コントローラー部分(#hud, z-index:10)より上にあるため、モーダル表示中は
  //         画面下のＡボタン（タップ）がこのモーダルに覆われて一切押せなくなっていた。
  //         PCのキーボード(Enter/Space)は window に直接ついているので反応するが、
  //         スマホでは押せるボタンが画面上に存在しない状態になり、「釣れない」
  //         「反応しない」の直接の原因になっていた。モーダル自体をタップしても
  //         Ａボタンと同じ操作になるようにする。
  fishingUI.addEventListener("click", () => {
    if (typeof fishingActive !== "undefined" && fishingActive) fishingAction();
  });
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

    // ★ タイミングバーを表示してアニメーション開始
    const wrap = document.getElementById("fishingTimingWrap");
    const bar  = document.getElementById("fishingTimingBar");
    if (wrap && bar) {
      wrap.style.display = "block";
      bar.style.transition = "none";
      bar.style.width = "100%";
      // 1フレーム置いてからアニメーション開始（即0%にならないように）
      requestAnimationFrame(() => {
        bar.style.transition = `width ${FISHING_HIT_DURATION}ms linear`;
        bar.style.width = "0%";
      });
    }

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

  // ★ タイミングバーを隠す
  const wrap = document.getElementById("fishingTimingWrap");
  if (wrap) wrap.style.display = "none";

  if (success) {
    const fish = selectFish();
    if (!state.inventory.ingredients[fish.id]) state.inventory.ingredients[fish.id] = 0;
    state.inventory.ingredients[fish.id]++;
    state.dailyFishCount++;
    SE.fishingSuccess();

    document.getElementById("fishingPrompt").textContent = `${fish.icon} ${fish.name} をそっと釣り上げた。`;
    document.getElementById("fishingAction").style.display = "none";

    // ★ 釣った瞬間に直接クエスト進捗を加算（詳細はupdateFishQuestsのコメント参照）
    updateFishQuests(fish.id);

    // ★修正: 以前は spawnWaterSplash(100, 100) という、pondPosがpondPos(18,6)に
    //         統一される前の旧座標系（隔離座標）がそのまま残っていた。
    //         そのため水しぶきエフェクトは池から100ユニット近く離れた
    //         見えない場所で発生しており、実質何も見えていなかった。
    //         実際の池の座標（plaza.pondPos）を渡すよう修正する。
    if (typeof spawnWaterSplash === "function" && typeof plaza !== "undefined") {
      spawnWaterSplash(plaza.pondPos.x, plaza.pondPos.z);
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

// ★修正: 以前はchekQuestProgress()内で「現在のインベントリ所持数」から
//         クエスト進捗を推測していた（Math.maxで単調増加にする対策込み）。
//         しかしこの方式では、クエスト達成前に該当素材を料理で使い切って
//         しまうと、その後何匹釣ってもインベントリの所持数が一度に2匹以上に
//         達しないまま(例: 1匹釣る→料理で消費→また1匹釣る…)、いつまで
//         経ってもクエストが完了しないことがあった。flower.jsのupdateFlowerQuests()
//         と同じく、釣った瞬間に直接カウントを加算する方式に統一する。
function updateFishQuests(fishId) {
  const map = { funa: "fish_delivery", weed: "seaweed_collect", stone: "stone_collect" };
  const qid = map[fishId];
  if (!qid) return;
  const quest = state.quests[qid];
  if (quest?.active) {
    quest.collected++;
    if (quest.collected >= quest.goal) completeQuest(qid);
  }
}