/**
 * plaza_guide.js — 広場の案内役スライムが初回訪問時に話しかけてくる
 * ------------------------------------------------------------
 * home_npcs.js の HOME_NPCS 配列に定義済みの「ガイドスライム」(id:8) を、
 * 既存のNPC会話システム(startNPCConversation／npcDialog)を使って
 * 初回訪問時にだけ自動で話しかけさせる薄いラッパー。
 * NPC自体は普段どおり広場を歩き回っており、話しかけ直せば何度でも
 * 同じ案内セリフを聞き直せる（home_npcs.js側の仕組みをそのまま利用）。
 */
(function () {
  const SEEN_KEY = "slime_plaza_guide_seen_v1";
  let triggered = false;

  function tryTrigger() {
    if (triggered) return;
    if (typeof dom === "undefined" || !dom.homePlazaScreen) return;
    if (localStorage.getItem(SEEN_KEY)) { triggered = true; return; }

    const plazaVisible = dom.homePlazaScreen.classList.contains("visible");
    if (!plazaVisible) return;
    // タイトル演出中や他のダイアログ表示中は割り込まない
    if (dom.titleScreen?.classList.contains("visible")) return;
    if (dom.npcDialog?.classList.contains("visible")) return;
    if (typeof startNPCConversation !== "function") return;
    if (typeof HOME_NPCS === "undefined") return;

    const guide = HOME_NPCS.find(n => n.id === 8);
    if (!guide) return;

    triggered = true;
    localStorage.setItem(SEEN_KEY, "1");
    // 広場表示の演出が落ち着いてから話しかけさせる
    setTimeout(() => {
      if (dom.homePlazaScreen.classList.contains("visible") && !dom.npcDialog?.classList.contains("visible")) {
        startNPCConversation(guide);
      }
    }, 900);
  }

  setInterval(tryTrigger, 400);
})();
