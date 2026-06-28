const QUESTS = {
  flower_beginner: {
    id: "flower_beginner",
    name: "花摘み入門",
    giver: "マスター（食堂）",
    description: "花を3つ摘んでみよう。食堂で待ってるよ。",
    goal: 3,
    reward: { type: "recipe", recipeId: "flower_basket" },
    rewardText: "花かごレシピ解放",
  },
  fish_delivery: {
    id: "fish_delivery",
    name: "釣り人の頼み",
    giver: "釣り人スライム（池のほとり）",
    description: "小魚を2匹釣ってきてほしい。",
    goal: 2,
    reward: { type: "accessory", accessoryId: "fishing_rod" },
    rewardText: "釣り竿アクセサリー",
  },
  seaweed_collect: {
    id: "seaweed_collect",
    name: "食堂の下ごしらえ",
    giver: "マスター（食堂）",
    description: "水草を1つ取ってきて。サラダに使うんだ。",
    goal: 1,
    reward: { type: "bento_slot", slotCount: 1 },
    rewardText: "お弁当の最大数が1つ増える",
  },
  stone_collect: {
    id: "stone_collect",
    name: "石集め",
    giver: "鉱物マニア",
    description: "きれいな石を2つ集めてほしい。",
    goal: 2,
    reward: { type: "accessory", accessoryId: "stone_charm" },
    rewardText: "石のお守り",
  },
};

function acceptQuest(questId) {
  if (!state.quests[questId]) {
    state.quests[questId] = { active: true, collected: 0, goal: QUESTS[questId].goal };
    return true;
  }
  return false;
}

function completeQuest(questId) {
  const quest = state.quests[questId];
  if (!quest || !quest.active || quest.collected < quest.goal) return;
  quest.active = false;
  quest.completed = true;
  const reward = QUESTS[questId].reward;
  if (reward.type === "recipe") state.unlockedRecipes.push(reward.recipeId);
  else if (reward.type === "bento_slot") state.maxBento += reward.slotCount;
  else if (reward.type === "accessory") state.accessories.push(reward.accessoryId);

  SE.questComplete();
  dom.statusLine.textContent = `✨ クエスト「${QUESTS[questId].name}」達成！ ${QUESTS[questId].rewardText}`;
  setTimeout(() => dom.statusLine.textContent = "", 3000);
}

function checkQuestProgress() {
  Object.keys(state.quests).forEach(qid => {
    const quest = state.quests[qid];
    if (!quest.active) return;
    if (qid === "fish_delivery") quest.collected = state.inventory.ingredients["funa"] || 0;
    if (qid === "seaweed_collect") quest.collected = state.inventory.ingredients["weed"] || 0;
    if (qid === "stone_collect") quest.collected = state.inventory.ingredients["stone"] || 0;
    if (quest.collected >= quest.goal) completeQuest(qid);
  });
}