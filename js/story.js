/* =========================================================
   story.js — 会話システム & ストーリーテキスト (2026/07/26 追加)
   依存: config.js, audio.js (SFX)
   読み込み順: config.js → audio.js → story.js → models.js → ...

   ------------------------------------------------------------
   物語のたたき台 (2026/07/26 時点。まだ考え中とのことなので下書き)
   ------------------------------------------------------------
   主人公: 嵐で船が難破し、海をただよって「おかしの島々」に流れ着いた
           食いしんぼうな旅人。最初はただ、お腹を満たす食べ物を探していただけ。

   世界観: 島々はそれぞれ違うお菓子/和菓子をモチーフにしていて、
           各島には「その島のあるじ」たる主(ぬし)のようなボスがいる。
           本来は島を見守る穏やかな存在だったはずなのに、なぜか気が立っていて
           よそ者を襲ってくる。

   謎: 実は島々の「おいしさ・風味」が、何か大きな存在に少しずつ
       吸い取られている。主たちはそれに気づき、身を守るためピリピリしている。
       ボスを倒す(なかよくなる)たびに、その手がかりが少しずつ明かされていく。

   ラスボス: ステージ9「カニロード」。深い海の底に長く孤立し、
             飢えと孤独から島々の"おいしさ"を吸い上げていた大ボス、という想定。
             倒す/なかよくなることで、島々の異変が収まる…というのが大筋の着地案。
             (2026/07/28 確定: 当初ステージ10想定だったが、ステージ9ボスに変更)

   ステージ3〜9のプロットは未定。今回は土台(会話エンジン)とステージ1・2分の
   会話、オープニングだけ実装し、以降は同じ形式でSTORYオブジェクトに追記していけば良い。
========================================================= */

/* ---------------------------------------------------------
   会話エンジン
--------------------------------------------------------- */
let dialogueQueue      = [];
let dialogueOnComplete = null;
let dialogueOpen       = false;

const dialogueBoxEl  = document.getElementById('dialogue-box');
const dialogueNameEl = document.getElementById('dialogue-name');
const dialogueTextEl = document.getElementById('dialogue-text');

/**
 * 会話を表示する
 * @param {Array<string|{name?:string, text:string}>} lines - 会話行の配列
 * @param {function} [onComplete] - 全て表示し終えたら呼ばれるコールバック
 */
function showDialogue(lines, onComplete) {
  if (!lines || lines.length === 0) {
    if (onComplete) onComplete();
    return;
  }
  dialogueQueue      = lines.slice();
  dialogueOnComplete = onComplete || null;
  dialogueOpen       = true;
  if (dialogueBoxEl) dialogueBoxEl.style.display = 'block';
  advanceDialogue();
}

/** 次の行へ進む。もう無ければ会話を終了してコールバックを呼ぶ */
function advanceDialogue() {
  if (dialogueQueue.length === 0) {
    if (dialogueBoxEl) dialogueBoxEl.style.display = 'none';
    dialogueOpen = false;
    const cb = dialogueOnComplete;
    dialogueOnComplete = null;
    if (cb) cb();
    return;
  }
  const line = dialogueQueue.shift();
  const speaker = typeof line === 'string' ? '' : (line.name || '');
  const text    = typeof line === 'string' ? line : (line.text || '');
  if (dialogueNameEl) {
    dialogueNameEl.textContent = speaker;
    dialogueNameEl.style.display = speaker ? 'block' : 'none';
  }
  if (dialogueTextEl) dialogueTextEl.textContent = text;
  if (typeof SFX !== 'undefined') SFX.cursor();
}

if (dialogueBoxEl) {
  dialogueBoxEl.addEventListener('click', () => { if (dialogueOpen) advanceDialogue(); });
}

/* ---------------------------------------------------------
   ストーリーフラグ (見た会話を記録。セーブデータにも保存される)
--------------------------------------------------------- */
let storyFlags = {};

/** 一度だけ見せる会話を表示する。既に見ていたら即座にonCompleteを呼ぶ */
function showDialogueOnce(flagKey, lines, onComplete) {
  if (storyFlags[flagKey]) {
    if (onComplete) onComplete();
    return;
  }
  storyFlags[flagKey] = true;
  showDialogue(lines, onComplete);
  if (typeof saveGame === 'function') saveGame(false);
}

/* ---------------------------------------------------------
   ストーリーテキスト本体 (たたき台。ステージ3以降は同じ形式で追記していく)
--------------------------------------------------------- */
const STORY = {
  opening: [
    '……ここは、どこだろう。',
    '嵐で船が沈み、気づけば見知らぬ浜辺に打ち上げられていた。',
    'おなかが すいた……なにか 食べるものは ないだろうか……',
    '甘い香りが、風に乗って ただよってくる。',
    { name: '？？？', text: '……ようこそ。おかしの島へ。' },
    'ふり返っても、そこには誰もいなかった。',
    'こうして、あなたの「おかしの島」でのぼうけんが はじまる。',
  ],

  stage1BossIntro: [
    { name: 'ホールケーキ王', text: 'この島に まよいこんだ よそ者よ。' },
    { name: 'ホールケーキ王', text: 'わが島の あまさを うばいに来たのか。' },
    { name: 'あなた', text: 'ちがう……ただ、おなかが すいてただけだよ。' },
    { name: 'ホールケーキ王', text: 'たわごとを……もう 話は終わりだ！' },
    'ホールケーキ王の目には、怒りと— わずかな怯えが うかんでいた。',
  ],
  stage1BossVictory: [
    { name: 'ホールケーキ王', text: '……くっ。まさか この我が……' },
    { name: 'ホールケーキ王', text: '待て……お前に 伝えねばならぬ ことがある。' },
    { name: 'ホールケーキ王', text: 'この島の「あまみ」が…… どこかへ 吸い取られておるのだ……' },
    { name: 'あなた', text: '吸い取られてる……？ 誰かに？' },
    { name: 'ホールケーキ王', text: '……分からぬ。だが 深い海の底から、そんな 気配がする。' },
    'ホールケーキ王は それ以上語らず、静かに座りこんだ。',
  ],

  stage2BossIntro: [
    { name: '羊羹将軍', text: 'ふむ……そなたが うわさの旅人か。' },
    { name: 'あなた', text: 'うわさ？ ぼくの こと知ってるの？' },
    { name: '羊羹将軍', text: '風の噂でな。ケーキのしまの主を たおしたとか。' },
    { name: '羊羹将軍', text: 'わがしのしまの ほこりにかけて、退くわけには いかぬ。' },
  ],
  stage2BossVictory: [
    { name: '羊羹将軍', text: '見事……しかし これで わかったであろう。' },
    { name: '羊羹将軍', text: 'この島々の 味が、何かに 奪われておる…… 深い海の底から……' },
    { name: 'あなた', text: 'ホールケーキ王も 同じことを言ってた。' },
    { name: '羊羹将軍', text: '……やはりな。この先の島々でも、同じ話を聞くことになろう。' },
    '羊羹将軍の言葉に、あなたは静かに うなずいた。',
  ],

  stage4BossIntro: [
    { name: 'タケオ', text: 'カニ軍団の 気配がする……ここは オレも 一緒に戦うよ。' },
    { name: 'あなた', text: 'タケオが 一緒だと 心強いよ！' },
    { name: 'ケガ二マン', text: 'ほう……島の案内人まで 連れてくるとはな。' },
    { name: 'ケガ二マン', text: 'だが 誰が来ようと、この波打ちぎわは 通さぬ！' },
    'ケガ二マンが 巨大なハサミを 打ち鳴らし、身構えた。',
  ],
  stage4BossVictory: [
    { name: 'ケガ二マン', text: 'ば、ばかな……この オレが……' },
    { name: 'ケガ二マン', text: 'カニロードさまに 勝てるわけが ないわ……' },
    'そう言い残すと、ケガ二マンの体は 黒いしぶきとなって 崩れていった。',
    'その一部が、まるで 意思を持つように──タケオへと まとわりついた。',
    { name: 'タケオ', text: '……っ、な、なんだ 今の……' },
    { name: 'あなた', text: 'タケオ！？ だいじょうぶ！？' },
    { name: 'タケオ', text: '……ああ、大丈夫。なんでも ないよ。' },
    'タケオは そう言って笑ったが、その笑顔は どこか いつもと 違って見えた。',
  ],

  /**
   * ステージ4クリア後、島でタケオが姿を消し、残影のカニロードに手も足も出ず惨敗する
   * 一連の演出 (2026/07/28 追加)。実際の戦闘は行わず、テキストと会話だけで語る形式。
   * showDialogueOnce('seenTakeoCurseAftermath', STORY.takeoCurseAftermath, ...) から呼ぶ。
   */
  takeoCurseAftermath: [
    'しまに もどると、タケオの ようすが おかしいことに 気づいた。',
    { name: 'タケオ', text: '……あ、ああ。おかえり。' },
    { name: 'あなた', text: 'タケオ？ だいじょうぶ？ なんだか いつもと ちがう……' },
    { name: 'タケオ', text: 'なんでもない。ただ……ちょっと、でかけてくる。' },
    'そう言うと、タケオは ふらつく足どりで、しまを あとにした。',
    'ひきとめる ひまも なく、あんない役は いなくなってしまった。',
    '── しばらくして。',
    'なにかに ひきよせられるように、あなたは 海の深くで「残影」と ぶつかった。',
    'それは、まぎれもなく── カニロードの すがただった。',
    'てもあしも でないまま、あなたは あっけなく はじき飛ばされた。',
    '自分の ちからのなさを、いやというほど 思いしらされた。',
    { name: 'スイートポテト', text: '……ずいぶん こわい かお してるね。' },
    { name: 'あなた', text: 'スイートポテト……見てたの？' },
    { name: 'スイートポテト', text: 'うん。あれに 立ち向かうには、いまのままじゃ たりない。' },
    { name: 'スイートポテト', text: '海の おくに、精霊が いる。あそこで 力を かしてもらうと いい。' },
    { name: 'あなた', text: 'たのんでみる。……タケオも、はやく 見つけないと。' },
    { name: 'スイートポテト', text: 'その気持ち、忘れずにね。' },
  ],

  // ステージ5〜9: 未実装。プロット確定後、同じ形式(○○BossIntro / ○○BossVictory)で追加する。
  // 2026/07/27 以降: ボスだけでなく { name: 'あなた', text: '…' } で主人公(ぼく口調)のセリフも挟むようにした。

  stage9BossIntro: [
    { name: 'カニロード', text: '……ここまで 来たか、ちいさき者よ。' },
    { name: 'あなた', text: '（このセリフも まだ考え中。ステージ9実装時に書き足す）' },
    { name: 'カニロード', text: '（このセリフは まだ考え中。ステージ9実装時に書き足す）' },
  ],

  stage3BossIntro: [
    { name: 'マスクメロン将軍', text: 'ほう……ここまで来るとはな、南の楽園に。' },
    { name: 'あなた', text: 'あなたも「あまみが奪われてる」って 知ってるの？' },
    { name: 'マスクメロン将軍', text: '……その話、私の口からは まだ話せぬ。' },
    { name: 'マスクメロン将軍', text: 'だが 力を示すというなら、受けて立とう。' },
    'マスクメロン将軍は 網目模様の体を きしませながら、静かに構えた。',
  ],
  stage3BossVictory: [
    { name: 'マスクメロン将軍', text: '……参った。噂に違わぬ 力だな。' },
    { name: 'マスクメロン将軍', text: '深い海の底に、古い古い 「みなもと」がある。' },
    { name: 'マスクメロン将軍', text: 'この島々の あまみは、そこから 少しずつ 吸われておるのだ。' },
    { name: 'あなた', text: 'みなもと……ぼく、そこまで 行かなきゃ。' },
    { name: 'マスクメロン将軍', text: '気をつけて行け、旅人よ。次の島でも 手がかりが待っていよう。' },
    'マスクメロン将軍の言葉を胸に、あなたは 海のかなたを見つめた。',
  ],

  stage9BossVictory: [
    { name: 'カニロード', text: '（エンディングにつながる会話。まだ考え中）' },
  ],

  /* -------------------------------------------------------
     タケオさん (島の案内役NPC。2026/07/26 追加)
     見た目は気のいい漁師のおじさんだが、将来ボスになる予定なので
     ヒントの端々に「何か知っていそうな」含みを少しずつ混ぜてある。
  ------------------------------------------------------- */
  takeoFirstMeeting: [
    { name: 'タケオ', text: 'おお、めずらしい顔だな。難破船の生き残りか？' },
    { name: 'タケオ', text: 'わしはタケオ。この島で長いこと漁をしとる者だ。' },
    { name: 'タケオ', text: 'ここらのモンスターは 見た目に反して 気性が荒い。気をつけるんだぞ。' },
    { name: 'タケオ', text: '困ったことがあれば、いつでも ここに来るといい。' },
  ],
  takeoHintsEarly: [
    [{ name: 'タケオ', text: 'ケーキのしまの奥に、なにやら気の立った主(ぬし)がおるらしいのう。' }],
    [{ name: 'タケオ', text: '宝箱は奥の方に隠れとることが多い。よう探すんだぞ。' }],
    [{ name: 'タケオ', text: 'ぼうぎょを使えば、こうげきをやわらげられる。ピンチのときは思い出すといい。' }],
    [{ name: 'タケオ', text: 'なかまが増えたら、パーティの並び順も見直してみるといいぞ。' }],
  ],
  takeoHintsMid: [
    [{ name: 'タケオ', text: 'わがしのしまにも 渡れるようになったか。気をつけて行くんだぞ。' }],
    [{ name: 'タケオ', text: '……最近、島の空気が どこかおかしい気がしてな。気のせいだといいんだが。' }],
    [{ name: 'タケオ', text: 'どうぐやは たしか、ステージ2をクリアすると開くと聞いたぞ。' }],
  ],
  takeoHintsLate: [
    [{ name: 'タケオ', text: 'ここまで来るとは、たいしたもんだ。' }],
    [{ name: 'タケオ', text: '……お前になら、話してもいいかもしれんな。いや……まだ早いか。' }],
    [{ name: 'タケオ', text: '海の底には、まだ誰も知らんことが 眠っておるものだ。' }],
  ],
};

/** 配列からランダムに1つ選ぶ */
function pickRandomStoryLine(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** タケオさんに話しかけたときの会話行を返す (初対面/進行度に応じて変わる) */
function getTakeoLines() {
  if (!storyFlags.metTakeo) {
    storyFlags.metTakeo = true;
    if (typeof saveGame === 'function') saveGame(false);
    return STORY.takeoFirstMeeting;
  }
  const stage2Unlocked = typeof STAGES !== 'undefined' && !!STAGES.find(s => s.no === 2 && s.unlocked);
  if (!stage2Unlocked) return pickRandomStoryLine(STORY.takeoHintsEarly);

  const stage3Unlocked = typeof STAGES !== 'undefined' && !!STAGES.find(s => s.no === 3 && s.unlocked);
  if (!stage3Unlocked) return pickRandomStoryLine(STORY.takeoHintsMid);

  return pickRandomStoryLine(STORY.takeoHintsLate);
}

/** ステージ番号からボス戦前の会話行を取得する。無ければnull */
function getBossIntroLines(stageNo) {
  return STORY[`stage${stageNo}BossIntro`] || null;
}

/** ステージ番号からボス撃破後の会話行を取得する。無ければnull */
function getBossVictoryLines(stageNo) {
  return STORY[`stage${stageNo}BossVictory`] || null;
}
