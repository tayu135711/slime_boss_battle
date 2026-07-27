/**
 * timing_ring.js — 円形タイミングゲージ（釣り・花摘み共通ミニゲーム部品）
 *
 * 円周を回転するポインターが、ハイライトされた「ここだ！」ゾーンに重なった
 * 瞬間にボタンを押すと成功、というシンプルなタイミングゲーム。
 * 以前の釣り・花摘みは画面全体を覆うポップアップ＋直線バー（釣りのみ）だったが、
 * 3Dの世界を隠さない小さなゲージに置き換えるための共通部品として作成した。
 */
function createTimingRing(containerEl, opts) {
  const {
    durationMs  = 1300,  // ポインターが1周するのにかかる時間
    zoneSizeDeg = 100,   // ハイライトゾーン（成功範囲）の角度幅。広いほど簡単
    ringColor   = "#ffe066",
    onResult    = () => {},
  } = opts;

  const size = 96;
  const cx = size / 2, cy = size / 2, r = size / 2 - 9;
  const zoneStartDeg = Math.random() * 360;
  const svgNS = "http://www.w3.org/2000/svg";

  function describeArc(startDeg, sweepDeg) {
    const startRad = (startDeg - 90) * Math.PI / 180;
    const endRad   = (startDeg + sweepDeg - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad),   y2 = cy + r * Math.sin(endRad);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.classList.add("timing-ring-svg");

  const track = document.createElementNS(svgNS, "circle");
  track.setAttribute("cx", cx); track.setAttribute("cy", cy); track.setAttribute("r", r);
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(255,255,255,0.4)");
  track.setAttribute("stroke-width", 7);
  svg.appendChild(track);

  const zone = document.createElementNS(svgNS, "path");
  zone.setAttribute("d", describeArc(zoneStartDeg, zoneSizeDeg));
  zone.setAttribute("fill", "none");
  zone.setAttribute("stroke", ringColor);
  zone.setAttribute("stroke-width", 9);
  zone.setAttribute("stroke-linecap", "round");
  zone.classList.add("timing-ring-zone");
  svg.appendChild(zone);

  // ★修正: 針(pointer)をSVGの transform="rotate(...)" 属性で回すのをやめ、
  //         毎フレーム先端の座標そのものを三角関数で計算してx2/y2に直接
  //         設定する方式に変更。transform属性まわりの挙動に依存しないので、
  //         より確実・軽量に「中心を軸に回る針」を描画できる。
  const pointer = document.createElementNS(svgNS, "line");
  pointer.setAttribute("x1", cx); pointer.setAttribute("y1", cy);
  pointer.setAttribute("x2", cx); pointer.setAttribute("y2", cy - r + 2);
  pointer.setAttribute("stroke", "#fff");
  pointer.setAttribute("stroke-width", 4);
  pointer.setAttribute("stroke-linecap", "round");
  pointer.classList.add("timing-ring-pointer");
  svg.appendChild(pointer);

  const hub = document.createElementNS(svgNS, "circle");
  hub.setAttribute("cx", cx); hub.setAttribute("cy", cy); hub.setAttribute("r", 5);
  hub.setAttribute("fill", "#fff");
  svg.appendChild(hub);

  containerEl.innerHTML = "";
  containerEl.appendChild(svg);

  let startTime = null;
  let rafId = null;
  let resolved = false;
  const pointerLen = r - 2;

  function angleAt(now) {
    const elapsed = now - startTime;
    return (elapsed / durationMs) * 360 % 360;
  }
  function isInZone(angle) {
    const norm = ((angle - zoneStartDeg) % 360 + 360) % 360;
    return norm <= zoneSizeDeg;
  }
  function setPointerAngle(angleDeg) {
    // ★ 0度を真上として時計回りに座標を計算する（describeArcと同じ基準）
    const rad = (angleDeg - 90) * Math.PI / 180;
    pointer.setAttribute("x2", cx + pointerLen * Math.cos(rad));
    pointer.setAttribute("y2", cy + pointerLen * Math.sin(rad));
  }
  function tick(now) {
    if (startTime === null) startTime = now;
    setPointerAngle(angleAt(now));
    if (!resolved) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  function finish(success) {
    if (resolved) return;
    resolved = true;
    if (rafId) cancelAnimationFrame(rafId);
    // ★修正: 以前はここで即座にonResult()を呼んでいたため、呼び出し側
    //         （endFishing/resolvePickFlower）がその場でゲージのDOMを
    //         非表示にしてしまい、「当たり(緑)／はずれ(赤)」の色が変わる
    //         演出が1フレームも描画されないまま消えてしまっていた。
    //         これが「合わせるための棒が急に消えて(飛んでいって)しまう」
    //         ように見えた原因。判定結果の色を少し見せてから
    //         onResult()を呼ぶようにする。
    zone.classList.add(success ? "timing-ring-zone-hit" : "timing-ring-zone-miss");
    setTimeout(() => onResult(success), 450);
  }

  return {
    // ボタンが押された瞬間の針の角度で成否判定する
    press() { finish(isInZone(angleAt(performance.now()))); },
    // 時間切れは常に失敗
    timeout() { finish(false); },
    // UIを破棄する際、まだ判定前ならアニメーションだけ止める（onResultは呼ばない）
    destroy() { resolved = true; if (rafId) cancelAnimationFrame(rafId); },
  };
}
