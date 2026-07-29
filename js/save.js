/* =========================================================
   save.js — セーブ / ロード (localStorage)
   依存: config.js, models.js(ENEMY_TYPES), maze.js(STAGES DOMは island.js で構築済み),
        party.js(TRAINER/party/box/fieldPartyModels), island.js(coins/diamonds/playerEquipInventory)
   読み込み順: config.js → models.js → maze.js → party.js → island.js → save.js → battle.js → main.js
========================================================= */

/**
 * 装備アイテムの id を持たせて保存用の簡易オブジェクトに変換する
 * @param {object|null} equipItem
 * @returns {number|null}
 */
function equipIdOf(equipItem) {
  return equipItem ? equipItem.id : null;
}

/** トレーナー・仲間 共通のステータス部分をシリアライズする */
function serializeFighterCommon(f) {
  return {
    hp: f.hp, maxHp: f.maxHp, atk: f.atk,
    level: f.level || 1, exp: f.exp || 0, rarity: f.rarity || 1,
    // MP (2026/07/27 追加: とくぎ使用に必要)
    mp: (typeof f.mp === 'number') ? f.mp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30),
    maxMp: (typeof f.maxMp === 'number') ? f.maxMp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30),
    equips: {
      頭: equipIdOf(f.equips && f.equips.頭),
      服: equipIdOf(f.equips && f.equips.服),
      足: equipIdOf(f.equips && f.equips.足),
    },
  };
}

/** 捕獲した仲間(party/box)をシリアライズする。ENEMY_TYPESのnameで種族を特定する */
function serializeMonster(f) {
  return Object.assign(
    { typeName: f.typeRef ? f.typeRef.name : f.name, evolved: !!f.evolved },
    serializeFighterCommon(f)
  );
}

/**
 * セーブされた仲間データから、実際に使えるfighterオブジェクトを復元する
 * @param {object} data - serializeMonster() で作られたデータ
 * @param {function} findEquip - id → 装備アイテム を引くヘルパー
 * @returns {object|null}
 */
function deserializeMonster(data, findEquip) {
  const type = ENEMY_TYPES.find(t => t.name === data.typeName);
  if (!type) return null; // 未知の種族データは読み飛ばす(将来のバージョン差異対策)

  const f = {
    name:    data.evolved ? type.evolvedName : type.name,
    color:   type.color,
    typeRef: type,
    element: type.element,
    hp:      data.hp,
    maxHp:   data.maxHp,
    atk:     data.atk,
    level:   data.level,
    exp:     data.exp,
    rarity:  data.rarity,
    evolved: !!data.evolved,
    // MP (2026/07/27 追加。旧セーブデータには無いのでフォールバックする)
    mp:      (typeof data.mp === 'number') ? data.mp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30),
    maxMp:   (typeof data.maxMp === 'number') ? data.maxMp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30),
    equips:  { 頭: null, 服: null, 足: null },
  };

  ['頭', '服', '足'].forEach(part => {
    const item = findEquip(data.equips && data.equips[part]);
    if (item) { f.equips[part] = item; item.equippedTo = f; }
  });

  return f;
}

/** 現在のゲーム状態をまるごとシリアライズする */
function buildSaveData() {
  return {
    version: 1,
    savedAt: Date.now(),
    coins, diamonds,
    trainer: serializeFighterCommon(TRAINER),
    party:   party.map(serializeMonster),
    box:     box.map(serializeMonster),
    equipInventory: playerEquipInventory.map(it => ({
      id: it.id, name: it.name, part: it.part, rarity: it.rarity,
      hpBonus: it.hpBonus, atkBonus: it.atkBonus,
    })),
    stages: STAGES.map(st => ({ no: st.no, unlocked: st.unlocked })),
    // 2026/07/25 追加: 開封済みの宝箱は再訪しても二度と出現しないようにする
    openedChests: Array.from(openedChestIds),
    // 2026/07/27 追加: 集めたものがたりアイテム
    storyItems: (typeof storyItems !== 'undefined') ? Array.from(storyItems) : [],
    // 2026/07/26 追加: 見た会話(ストーリー)の記録
    storyFlags: (typeof storyFlags !== 'undefined') ? storyFlags : {},
    // 2026/07/26 追加: スタミナ
    stamina: (typeof stamina !== 'undefined') ? stamina : MAX_STAMINA,
    lastStaminaTick: (typeof lastStaminaTick !== 'undefined') ? lastStaminaTick : Date.now(),
  };
}

/**
 * セーブする (localStorageへ保存)
 * @param {boolean} showMsg - トースト通知を出すか(自動セーブ時はfalseにして静かに保存する)
 * @returns {boolean} 成功したらtrue
 */
function saveGame(showMsg = true) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
    if (showMsg) { showToast('セーブしました！'); if (typeof SFX !== 'undefined') SFX.save(); }
    return true;
  } catch (err) {
    console.error('セーブに失敗しました', err);
    if (showMsg) showToast('セーブに しっぱいしました…');
    return false;
  }
}

/** セーブデータが存在するか */
function hasSaveData() {
  try { return !!localStorage.getItem(SAVE_KEY); }
  catch (err) { return false; }
}

/**
 * セーブデータを読み込んで、現在のゲーム状態に反映する
 * @param {boolean} showMsg - トースト通知を出すか
 * @returns {boolean} 成功したらtrue
 */
function loadGame(showMsg = true) {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); }
  catch (err) { return false; }
  if (!raw) return false;

  let data;
  try { data = JSON.parse(raw); }
  catch (err) { console.error('セーブデータの読み込みに失敗しました', err); return false; }

  // --- 通貨 ---
  if (typeof data.coins === 'number')    coins    = data.coins;
  if (typeof data.diamonds === 'number') diamonds = data.diamonds;

  // --- 装備インベントリを先に復元 (パーティ/トレーナーの装備リンクに必要) ---
  playerEquipInventory.length = 0;
  (data.equipInventory || []).forEach(it => {
    playerEquipInventory.push(Object.assign({}, it, { equippedTo: null }));
  });
  const findEquip = id => (id == null) ? null : (playerEquipInventory.find(it => it.id === id) || null);

  // --- トレーナー ---
  if (data.trainer) {
    TRAINER.hp     = data.trainer.hp;
    TRAINER.maxHp  = data.trainer.maxHp;
    TRAINER.atk    = data.trainer.atk;
    TRAINER.level  = data.trainer.level;
    TRAINER.exp    = data.trainer.exp;
    TRAINER.rarity = data.trainer.rarity;
    // MP (2026/07/27 追加。旧セーブデータには無いのでフォールバックする)
    TRAINER.mp     = (typeof data.trainer.mp === 'number') ? data.trainer.mp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30);
    TRAINER.maxMp  = (typeof data.trainer.maxMp === 'number') ? data.trainer.maxMp : ((typeof SKILL_MP_MAX !== 'undefined') ? SKILL_MP_MAX : 30);
    TRAINER.equips = { 頭: null, 服: null, 足: null };
    ['頭', '服', '足'].forEach(part => {
      const item = findEquip(data.trainer.equips && data.trainer.equips[part]);
      if (item) { TRAINER.equips[part] = item; item.equippedTo = TRAINER; }
    });
  }

  // --- パーティ / ボックス (フィールド追従モデルも作り直す) ---
  party.length = 0;
  box.length   = 0;
  fieldPartyModels.forEach(m => {
    if (typeof scene !== 'undefined') scene.remove(m);
  });
  fieldPartyModels.length = 0;

  (data.party || []).forEach(d => {
    const f = deserializeMonster(d, findEquip);
    if (f) {
      if (party.length < MAX_PARTY) {
        party.push(f);
        if (typeof addFieldFollower === 'function') addFieldFollower(f.typeRef);
      } else {
        // 上限変更前のセーブデータも、余剰分はボックスへ保管する。
        box.push(f);
      }
    }
  });
  (data.box || []).forEach(d => {
    const f = deserializeMonster(d, findEquip);
    if (f) box.push(f);
  });

  // --- ステージ解放状況 ---
  (data.stages || []).forEach(sd => {
    const st = STAGES.find(s => s.no === sd.no);
    if (st) st.unlocked = !!sd.unlocked;
  });
  document.querySelectorAll('.stage-dot').forEach((dot, i) => {
    const st = STAGES[i];
    if (st) dot.classList.toggle('locked', !st.unlocked);
  });

  // --- 開封済み宝箱 (2026/07/25 追加) ---
  if (typeof openedChestIds !== 'undefined') {
    openedChestIds = new Set(data.openedChests || []);
  }

  // --- ものがたりアイテム (2026/07/27 追加) ---
  if (typeof storyItems !== 'undefined') {
    storyItems = new Set(data.storyItems || []);
  }

  // --- 見た会話の記録 (2026/07/26 追加) ---
  if (typeof storyFlags !== 'undefined') {
    storyFlags = data.storyFlags || {};
  }

  // --- スタミナ (2026/07/26 追加) ---
  if (typeof stamina !== 'undefined') {
    stamina = (typeof data.stamina === 'number') ? data.stamina : MAX_STAMINA;
    lastStaminaTick = data.lastStaminaTick || Date.now();
    if (typeof regenStamina === 'function') regenStamina();
    if (typeof updateStaminaUI === 'function') updateStaminaUI();
  }

  updateCurrencyUI();
  updatePartyPanel();
  if (showMsg) showToast('セーブデータを よみこみました！');
  return true;
}

/** セーブデータを削除する */
function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* noop */ }
}

/* ---------------------------------------------------------
   セーブボタン
--------------------------------------------------------- */
const btnSaveGame = document.getElementById('btn-save-game');
if (btnSaveGame) {
  btnSaveGame.addEventListener('click', () => saveGame(true));
}

/* ---------------------------------------------------------
   離脱時オートセーブ
   (起動時の自動ロードは 2026/07/26 追加のタイトル画面が
    「つづきから」ボタンで明示的に行うようになったため、ここでは行わない)
--------------------------------------------------------- */
window.addEventListener('beforeunload', () => {
  saveGame(false);
});
