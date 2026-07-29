/* =========================================================
   config.js — ゲーム定数・ステージ定義
   他の全JSファイルより先に読み込む
========================================================= */

/* ---- 迷路パラメータ ---- */
const MAZE_COLS      = 9;
const MAZE_ROWS      = 9;
const CELL           = 5;
const WALL_HEIGHT    = 3.2;
const WALL_THICKNESS = 0.5;

/* ---- プレイヤー / フィールド ---- */
const PLAYER_SPEED   = 6.5;
const ENCOUNTER_DIST = 1.6;

/**
 * 戦闘離脱後のエンカウント猶予 (2026/07/24 追加)
 * 「にげる」成功直後にすぐ同じ敵とまたエンカウントしてしまう問題への対応。
 * 戦闘終了直後は一定時間、新規エンカウントを起こさない。
 */
const ENCOUNTER_GRACE_MS   = 1400; // 戦闘終了後、このミリ秒だけ新規エンカウント無効
const FLEE_PUSHBACK_DIST   = 3.5;  // にげる成功時、その敵をプレイヤーから引き離す距離
let   encounterGraceUntil  = 0;    // performance.now()がこの値を超えるまでエンカウント無効

/* ---- 島 ---- */
const ISLAND_RADIUS       = 6.4;
const ISLAND_PLAYER_SPEED = 4.5;

/* ---- パーティ ---- */
// 主人公を除く仲間のパーティ上限。超過分はボックスへ送る。
const MAX_PARTY    = 3;
const FOLLOW_GAP   = 1.3;
const FOLLOW_SPEED = PLAYER_SPEED * 1.15;

/* ---- ガチャコスト ---- */
const GACHA_COST_PREMIUM_EQUIP = 8;   // ダイヤ消費(プレミアムそうびガチャ)
const GACHA_COST_EQUIP         = 30;  // コイン消費(通常そうびガチャ)
/** プレミアムそうびガチャの最低保証レアリティ(2026/07/23 決定・数値は暫定) */
const PREMIUM_GACHA_MIN_RARITY = 3;

/* =========================================================
   レアリティ共通テーブル
   星1:40% / 星2:30% / 星3:18% / 星4:9% / 星5:3%
   (でんぱガチャ・装備ガチャ共通の基準 — 仕様書5-7確定)
========================================================= */
const RARITY_WEIGHTS = [40, 30, 18, 9, 3];
const RARITY_TOTAL   = RARITY_WEIGHTS.reduce((a, b) => a + b, 0); // = 100

/**
 * 重み付きランダムでレアリティ(1〜5)を返す
 * @returns {number} 1〜5
 */
function rollRarity() {
  let r = Math.random() * RARITY_TOTAL;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    r -= RARITY_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}

/**
 * 最低保証つきの重み付きランダムでレアリティを返す(プレミアムそうびガチャ用)
 * @param {number} minRarity - このレアリティ以上が確定で出る(1〜5)
 * @returns {number} minRarity〜5
 */
function rollRarityWithFloor(minRarity) {
  const weights = RARITY_WEIGHTS.slice(minRarity - 1);
  const total   = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return minRarity + i;
  }
  return minRarity;
}

/* =========================================================
   属性システム (仕様書5-1確定)
   炎・水・自然・闇・光 の基本5属性
========================================================= */

/** 属性キー → 表示名 */
const ELEMENT_NAMES = {
  fire:   '炎',
  water:  '水',
  nature: '自然',
  dark:   '闇',
  light:  '光',
};

/** 属性キー → ボタン背景色 */
const ELEMENT_COLORS = {
  fire:   '#c8361a',
  water:  '#1460b0',
  nature: '#246e2e',
  dark:   '#5a24a0',
  light:  '#b07800',
};

/**
 * 属性相性テーブル (仕様書5-8確定方針)
 * 攻撃側 → { 守備側: ダメージ倍率 }
 *   ×1.5 = こうかはばつぐんだ！
 *   ×0.5 = こうかはいまひとつ…
 *   記載なし = ×1.0 (等倍)
 */
const ELEMENT_AFFINITY = {
  fire:   { nature: 1.5, water:  0.5 },
  water:  { fire:   1.5, nature: 0.5 },
  nature: { water:  1.5, fire:   0.5 },
  dark:   { light:  1.5 },
  light:  { dark:   1.5 },
};

/**
 * 属性こうげき 自属性ボーナス (STAB, 2026/07/24 追加)
 * 「相性不明な相手には通常こうげきが常に安定・無リスクな最適解になる」
 * という問題への対応として、属性こうげきには相性倍率とは別に
 * 固定の自属性ボーナスをかける。
 *   等倍(1.0倍)の相手 → 1.0 × 1.25 = 1.25倍 (通常こうげきより有利)
 *   苦手(0.5倍)の相手 → 0.5 × 1.25 = 0.625倍 (通常こうげきより不利)
 *   得意(1.5倍)の相手 → 1.5 × 1.25 = 1.875倍 (大きく有利)
 * これにより「相性がわからない相手には基本は属性こうげき、
 * 苦手だと分かっている/疑っているときだけ通常こうげきに切り替える」
 * という駆け引きが生まれる。通常こうげきは常に1.0倍のまま(ボーナス無し)。
 */
const ELEMENT_ATK_STAB = 1.25;

/* =========================================================
   バトルコマンド仕様 (2026/07/23 仕様変更)
   旧: ターン属性ローテーション方式(炎→水→自然→闇→光→つかまえる循環)は廃止。
   新: 属性は各キャラ固有のプロパティとして扱う。
       - プレイヤー(主人公): 「つうじょうこうげき」「つかまえる」の2コマンド
       - 仲間(捕獲済み):     「つうじょうこうげき」「[固有属性]こうげき」の2コマンド
       行動は1体ずつキャラを選んで個別に実行するターン制(battle.js参照)
========================================================= */

/* =========================================================
   とくぎ・しんか システム (2026/07/25 修正)
   全キャラ共通の固定レベルで、3つ目のコマンド「とくぎ」が解放される。
   仲間(捕獲したモンスター)は別途しんかレベルで見た目とステータスが強化される。
   とくぎ解放(Lv20)を先に、しんか(Lv30)を後にすることで、
   「とくぎで手札が増える → その後しんかでさらに強くなる」という
   段階的な伸びを感じられるようにしている。
   数値はすべて暫定値(たたき台) — バランス調整の余地あり
========================================================= */
const SKILL_UNLOCK_LEVEL = 20; // とくぎ解放レベル(全キャラ共通)
const EVOLVE_LEVEL       = 30; // モンスターしんかレベル(仲間のみ。プレイヤーはレアリティ成長で対応)

/**
 * とくぎのMP制 (2026/07/27 追加)
 * 「何度でも技が打てると通常こうげきの意味が薄れる」との要望を受けて追加。
 * MPは戦闘中の通常こうげき/ぼうぎょのたびに少しずつ回復し、とくぎを使うとまとめて消費する。
 * いやしのいずみ(回復地点)でHPと一緒にMPも全回復する。
 */
const SKILL_MP_MAX          = 30; // 最大MP(現状は固定値。将来レベルで伸ばす余地あり)
// 2026/07/28 変更: こうげき/ぼうぎょでのMP自動回復は廃止。MPは使うたびに減る一方で、
// 回復地点(ボス直前に1箇所だけ)で全回復する以外は戻らない、消費リソースとしての性格を強めた。

/**
 * 属性ごとの「とくぎ」定義。
 * プレイヤー側が使うときは「相手(敵)」に、敵側が使うときは「対象(味方1体)」に効果が向く。
 *   dmgMult      : 通常こうげきに対するダメージ倍率
 *   mpCost       : とくぎ使用に必要なMP (2026/07/27 追加)
 *   healPct      : 自分の陣営を最大HPの割合で回復する(水属性)
 *   bindTarget   : 相手を1ターン行動不能にする(自然属性)
 *   atkDebuffMult / debuffTurns : 相手の攻撃力を一定ターン下げる(闇属性)
 *   cleanseSelf  : 自分の陣営にかかった状態変化(束縛・攻撃力低下)をすべて解除する(光属性)
 */
const ELEMENT_SKILLS = {
  fire:   { name: 'だいばくはつ',   dmgMult: 1.7, mpCost: 18 },
  water:  { name: 'いやしのしずく', dmgMult: 1.0, healPct: 0.18, mpCost: 14 },
  nature: { name: 'からみつくツタ', dmgMult: 1.1, bindTarget: true, mpCost: 16 },
  dark:   { name: 'のろいのことば', dmgMult: 1.1, atkDebuffMult: 0.6, debuffTurns: 2, mpCost: 16 },
  light:  { name: 'せいなるひかり', dmgMult: 1.3, cleanseSelf: true, mpCost: 16 },
};

/* =========================================================
   装備システム (仕様書7-1,7-3確定)
   頭・服・足の3部位、レア度は星1〜5
========================================================= */
const EQUIP_PARTS = ['頭', '服', '足'];

/**
 * 宝箱から装備がドロップする確率 (2026/07/24 追加)
 * コイン(・時々ダイヤ)に加えて、一定確率で装備も一緒に手に入る
 */
const CHEST_EQUIP_DROP_CHANCE = 0.35;

/**
 * 回復地点 (いやしのいずみ, 2026/07/24 追加)
 * ステージ(迷路)内に設置し、近づくとパーティ全員のHPを全回復する。
 * 一度使うと少し離れるまで再発動しない(その場に立ち止まり続けての連発回復を防ぐ)
 */
const HEAL_SPOT_TRIGGER_DIST = 1.3; // これより近づくと発動
const HEAL_SPOT_RESET_DIST   = 2.6; // これより離れると再度発動可能になる

/**
 * 全滅(戦闘離脱)時のペナルティ (2026/07/24 追加)
 * 手持ちのコインの一定割合を失った状態でしまに送還される
 */
const WIPE_PENALTY_COIN_RATIO = 0.3;

/**
 * ぼうぎょコマンド (2026/07/24 追加)
 * 自分のターンにぼうぎょを選ぶと、そのラウンドの敵の攻撃で
 * 自分が狙われたときの被ダメージが軽減される
 */
const DEFEND_DAMAGE_REDUCTION = 0.5; // 被ダメージを50%に軽減

/**
 * スタミナ制度 (2026/07/26 追加、2026/07/27 仕様変更)
 * ステージに出発するたびに1消費し、0だと出発できなくなる。
 * 1時間に1回復、最大3までためられる(いわゆるスタミナ/AP制)。
 * 島にいる間は自動では減らない。
 */
const MAX_STAMINA        = 3;
const STAMINA_COST_STAGE = 1;
const STAMINA_REGEN_MS   = 60 * 60 * 1000; // 1時間ごとに1回復

/**
 * つかまえる回数制限 (2026/07/28 追加)
 * ステージに出発するたびにリセットされ、成功・失敗を問わず1回使うごとに1減る。
 * 0になると「つかまえる」コマンドはグレーアウトして選べなくなる。
 */
const MAX_CAPTURE_USES = 10;

/**
 * BGMファイルのパス設定 (2026/07/26 追加、2026/07/26 音源反映)
 * audio/ フォルダに実際の音源ファイルを配置済み。
 * ファイル名を変えたい場合はここのパスを差し替えるだけで全シーンに反映される。
 */
const BGM_PATHS = {
  // --- 現在使用中 ---
  title:      'audio/title.mp3',         // タイトル画面
  island:     'audio/island.mp3',        // 島マップ(ハブ)
  shop:       'audio/shop.mp3',          // どうぐや
  gachaBox:   'audio/gacha_box.mp3',     // ガチャ/パーティ(ボックス)画面
  stage1:     'audio/stage1.mp3',        // ステージ1 (ケーキのしま) 1F/2F探索中
  stage2:     'audio/stage2_forest.mp3', // ステージ2 (わがしのしま) 1F/2F探索中
  stage3:     'audio/peaceful_beach.mp3',// ステージ3 (フルーツパーラーのしま) 1F/2F探索中
  battle:     'audio/battle.mp3',        // 通常戦闘 (ボス以外)
  boss1:      'audio/boss1.mp3',         // ステージ1ボス(ホールケーキ王)
  boss2:      'audio/boss2_wagashi.mp3', // ステージ2ボス(羊羹将軍)
  boss3:      'audio/boss_alt2.mp3',     // ステージ3ボス(マスクメロン将軍)
  boss4:      'audio/boss_alt3.mp3',     // ステージ4ボス(ケガ二マン)
  stage4:     'audio/sea.mp3',           // ステージ4 (カニ軍団のしま) イカダ探索中
  stageClear: 'audio/stage_clear.mp3',   // ステージクリア時(1回だけ再生)

  // --- 今はまだ未使用(今後のステージ/イベント用に確保) ---
  chestMimic:    'audio/chest_mimic.mp3',     // 宝箱がミミックだった時の演出用(未実装)
  strongEnemy:   'audio/strong_enemy.mp3',    // 強敵/レア個体との戦闘用(未実装)
  midBoss:       'audio/mid_boss.mp3',        // 中ボス用(未実装)
  desert:        'audio/desert.mp3',          // 砂漠ステージ用(未実装)
  desertLine:    'audio/desert_line.mp3',     // 砂漠ステージ用 別バージョン
  snowStage:     'audio/snow_stage.mp3',      // 雪ステージ用(未実装)
  dragonStage:   'audio/dragon_stage.mp3',    // 龍ステージ用(未実装)
  mysteriousForest: 'audio/mysterious_forest.mp3', // 森ステージの別バージョン
  autumnForest:  'audio/autumn_forest.mp3',   // 森ステージの別バージョン(秋)
  hauntedHouse:  'audio/haunted_house.mp3',   // お化け屋敷風ステージ用(未実装)
  peacefulStage: 'audio/peaceful_stage.mp3',  // のどかなステージ用 予備
  upbeatArea:    'audio/upbeat_area.mp3',     // にぎやかなエリア用 予備
  stageGeneric1: 'audio/stage_generic1.mp3',  // 汎用ステージBGM 予備1
  stageGeneric2: 'audio/stage_generic2.mp3',  // 汎用ステージBGM 予備2
};

/**
 * ステージ番号から探索中BGMを取得する (2026/07/28 追加)
 * ステージが増えるたびに if/三項演算子を継ぎ足していたのをやめて、一箇所にまとめた。
 * @param {number} stageNo
 * @returns {string}
 */
function getStageBgm(stageNo) {
  return BGM_PATHS[`stage${stageNo}`] || BGM_PATHS.stage1;
}

/**
 * ステージ番号からボス戦BGMを取得する (2026/07/28 追加)
 * @param {number} stageNo
 * @returns {string}
 */
function getBossBgm(stageNo) {
  return BGM_PATHS[`boss${stageNo}`] || BGM_PATHS.boss1;
}

/**
 * ボスの捕獲難易度 (2026/07/25 追加)
 * 以前はボスを一切つかまえられなかったバグを修正し、
 * 通常より低い成功率で捕獲を試せるようにする倍率
 */
const BOSS_CATCH_PENALTY = 0.55;

/**
 * セーブデータ (2026/07/24 追加)
 * localStorageに保存するキー。バージョンを上げる場合はキーも変更する
 */
const SAVE_KEY = 'capture_rpg_save_v1';

/**
 * レア度別 装備ステータスボーナス (1個あたり)
 * 未決定事項: 具体的な数値は暫定値 — 実装後にバランス調整予定
 */
const EQUIP_STAT_BY_RARITY = {
  1: { hp:  2, atk: 1 },
  2: { hp:  4, atk: 2 },
  3: { hp:  7, atk: 3 },
  4: { hp: 12, atk: 5 },
  5: { hp: 20, atk: 8 },
};

/* =========================================================
   レベルアップ / 経験値 (仕様書4-1,4-2,4-3)
   最大レベル100 / EXP計算式: 指数的成長カーブ
========================================================= */
const MAX_LEVEL = 100;

/**
 * 次のレベルアップに必要なEXP
 * @param {number} lv - 現在のレベル (1〜99)
 * @returns {number}
 */
function calcNextExp(lv) {
  return Math.floor(30 * Math.pow(1.15, lv - 1));
}

/* =========================================================
   捕獲時の初期レベル (2026/07/24 追加)
   旧仕様ではレア度に関係なく一律Lv5(ボスはLv15)固定で、
   レア度の恩恵がスキル構成の初期値以外に反映されていなかった。
   レア度が高いほど初期レベルにボーナスがつくようにし、
   ★1は従来と同じ基準値を維持しつつ、★5は明確に強い状態で
   仲間になるようにする。
========================================================= */
const CAPTURE_LEVEL_BASE            = 5;  // 通常個体の基準レベル(★1相当。従来値のまま)
const CAPTURE_LEVEL_BASE_BOSS       = 15; // ボス個体の基準レベル(★1相当。従来値のまま)
const CAPTURE_LEVEL_BONUS_PER_STAR  = 2;  // 通常個体: レア度1つにつき+2レベル
const CAPTURE_LEVEL_BONUS_PER_STAR_BOSS = 3; // ボス個体: レア度1つにつき+3レベル

/**
 * 捕獲したモンスターの初期レベルをレア度に応じて算出する
 * @param {number} rarity - 1〜5
 * @param {boolean} isBoss - ボス個体を捕獲した場合はtrue
 * @returns {number}
 */
function calcCaptureLevel(rarity, isBoss) {
  const base  = isBoss ? CAPTURE_LEVEL_BASE_BOSS : CAPTURE_LEVEL_BASE;
  const perStar = isBoss ? CAPTURE_LEVEL_BONUS_PER_STAR_BOSS : CAPTURE_LEVEL_BONUS_PER_STAR;
  return Math.min(MAX_LEVEL, base + perStar * (rarity - 1));
}

/* =========================================================
   ステージ定義 (仕様書6-3確定: 食べ物テーマ全10ステージ)
========================================================= */
const STAGES = [
  { no:1,  name:'ケーキのしま',  letter:'ケ', unlocked:true,  desc:'あまい かおりがする、さいしょのステージ' },
  { no:2,  name:'わがしのしま',  letter:'わ', unlocked:false, desc:'じゅんびちゅう…' },
  { no:3,  name:'フルーツパーラーのしま', letter:'フ', unlocked:false, desc:'あまずっぱい かおりが ただよう、みなみの しま' },
  { no:4,  name:'カニ軍団のしま', letter:'カ', unlocked:false, desc:'いかだで すすむ、あらなみの しま' },
  { no:5,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:6,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:7,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:8,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:9,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:10, name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
];

/** ボスの見た目の大きさ倍率 (2026/07/27 追加。フィールド・バトル両方に適用) */
const BOSS_SCALE_MULT = 1.9;

/**
 * 金の宝箱(ボス撃破報酬)から手に入る、ステージ固有の「ものがたりアイテム」
 * (2026/07/27 追加)。今のところ収集のみで、使い道は今後のストーリー進行で実装予定。
 * ステージ番号 → { id, name, desc }
 */
/**
 * ステージ番号→ボスのENEMY_TYPESインデックス対応表 (2026/07/28 追加)
 * ステージが増えるたびに三項演算子を継ぎ足すのをやめて、一箇所にまとめた。
 */
const STAGE_BOSS_TYPE_IDX = { 1: 1, 2: 9, 3: 13, 4: 15 };

const STORY_ITEMS = {
  1: { id: 'holecake-fragment', name: 'ホールケーキ王のかけら', desc: 'ホールケーキ王が最後に見せた、あまい島の記憶のかけら。' },
  2: { id: 'youkan-seal',       name: '羊羹将軍のしるし',       desc: '深い海の底の気配を知る、羊羹将軍からの証。' },
  3: { id: 'melon-crest',       name: 'マスクメロン将軍の紋章', desc: '南の海をわたってきた将軍が背負っていた、網目模様の紋章。' },
  4: { id: 'kegani-claw',       name: 'ケガ二マンのハサミのかけら', desc: '「カニロードさまに勝てるわけがない…」その言葉とともに残された、硬いハサミの欠片。' },
};
