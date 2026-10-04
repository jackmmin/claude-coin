// 백테스팅 RSI 서브차트 렌더링

let btRsiLwChart = null;

function renderBtRsiChart(d) {
  const wrap      = document.getElementById("btRsiChartWrap");
  const container = document.getElementById("btRsiChart");
  if (btRsiLwChart) { btRsiLwChart.remove(); btRsiLwChart = null; }

  // RSI 데이터가 없거나 전략이 RSI 무관이면 숨김
  if (!d.rsi_line || d.rsi_line.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  container.innerHTML = "";

  const toChartTime = t => {
    const clean = t.replace(/\+09:00$/, "").replace(" ", "T");
    return Math.floor(new Date(clean + "Z").getTime() / 1000);
  };

  btRsiLwChart = LightweightCharts.createChart(container, {
    layout: { background: { color: "#0d1117" }, textColor: "#8b949e" },
    grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#30363d", scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
    width: container.clientWidth,
    height: container.clientHeight || 160,
  });

  // RSI 라인
  const rsiSeries = btRsiLwChart.addLineSeries({
    color: "#c084fc",
    lineWidth: 1.5,
    title: `RSI(${d.rsi_period || 14})`,
    priceLineVisible: false,
    lastValueVisible: true,
  });
  const rsiData = d.candles
    .map((c, i) => d.rsi_line[i] != null ? { time: toChartTime(c.t), value: d.rsi_line[i] } : null)
    .filter(v => v !== null);
  rsiSeries.setData(rsiData);

  // 과매도(30) / 과매수(70) 기준선
  const makeBaseline = (val, color) => {
    const s = btRsiLwChart.addLineSeries({
      color, lineWidth: 2, lineStyle: 0,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    s.setData(rsiData.map(p => ({ time: p.time, value: val })));
  };
  makeBaseline(70, "rgba(63,185,80,0.5)");
  makeBaseline(30, "rgba(248,81,73,0.5)");
  makeBaseline(50, "rgba(139,148,158,0.3)");

  // RSI_DIVERGENCE_TRAIL: 다이버전스 저점 마커 표시
  if (d.strategy === "RSI_DIVERGENCE_TRAIL" && d.divergence_points && d.divergence_points.length > 0) {
    const divMarkers = [];
    for (const idx of d.divergence_points) {
      if (!d.candles[idx] || d.rsi_line[idx] == null) continue;
      divMarkers.push({
        time: toChartTime(d.candles[idx].t),
        position: "belowBar",
        color: "#f0883e",
        shape: "circle",
        text: "D",
        size: 1,
      });
    }
    divMarkers.sort((a, b) => a.time - b.time);
    rsiSeries.setMarkers(divMarkers);
  }

  btRsiLwChart.timeScale().fitContent();

  // RSI 툴팁: 크로스헤어 이동 시 RSI 수치 표시
  let rsiTooltip = document.getElementById("btRsiTooltip");
  if (!rsiTooltip) {
    rsiTooltip = document.createElement("div");
    rsiTooltip.id = "btRsiTooltip";
    rsiTooltip.style.cssText = [
      "position:absolute", "z-index:100", "pointer-events:none",
      "background:#161b22", "border:1px solid #30363d", "border-radius:6px",
      "padding:4px 10px", "font-size:12px", "line-height:1.6",
      "color:#e6edf3", "white-space:nowrap", "display:none",
    ].join(";");
    container.style.position = "relative";
    container.appendChild(rsiTooltip);
  }

  // RSI 데이터를 time → 값 맵으로 구성
  const rsiMap = new Map(rsiData.map(p => [p.time, p.value]));

  btRsiLwChart.subscribeCrosshairMove(param => {
    if (!param || !param.time || !param.point) {
      rsiTooltip.style.display = "none";
      return;
    }
    const rsiVal = rsiMap.get(param.time);
    if (rsiVal == null) { rsiTooltip.style.display = "none"; return; }

    // RSI 수치에 따라 색상 구분 (70 이상=과매수/초록, 30 이하=과매도/빨강, 중간=보라)
    const color = rsiVal >= 70 ? "#3fb950" : rsiVal <= 30 ? "#f85149" : "#c084fc";
    rsiTooltip.innerHTML =
      `<span style="color:#8b949e">RSI</span> <span style="color:${color}">${rsiVal.toFixed(2)}</span>`;

    // 툴팁 위치: 우측 공간이 부족하면 좌측으로
    const ttW  = 100;
    const left = param.point.x + 16 + ttW > container.clientWidth
      ? param.point.x - ttW - 8
      : param.point.x + 16;
    rsiTooltip.style.left    = `${left}px`;
    rsiTooltip.style.top     = `${Math.max(4, param.point.y - 20)}px`;
    rsiTooltip.style.display = "block";
  });

  // 캔들 차트와 시간축 동기화
  if (btLwChart) {
    btLwChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range && btRsiLwChart) btRsiLwChart.timeScale().setVisibleLogicalRange(range);
    });
    btRsiLwChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range && btLwChart) btLwChart.timeScale().setVisibleLogicalRange(range);
    });
  }

  new ResizeObserver(() => {
    if (btRsiLwChart) btRsiLwChart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 160 });
  }).observe(container);
}
