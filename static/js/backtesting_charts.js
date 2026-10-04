// 백테스팅 캔들 차트 렌더링 (RSI: backtesting_rsi_chart.js, 에쿼티: backtesting_equity_chart.js)

function renderBtCandleChart(d) {
  const container = document.getElementById("btCandleChart");
  container.innerHTML = "";
  if (btLwChart) { btLwChart.remove(); btLwChart = null; }
  if (!d || !d.candles || d.candles.length === 0) return;

  btLwChart = LightweightCharts.createChart(container, {
    layout: { background: { color: "#0d1117" }, textColor: "#8b949e" },
    grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#30363d" },
    timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
    width: container.clientWidth,
    height: container.clientHeight || 400,
  });

  const candleSeries = btLwChart.addCandlestickSeries({
    upColor: "#3fb950", downColor: "#f85149",
    borderUpColor: "#3fb950", borderDownColor: "#f85149",
    wickUpColor: "#3fb950", wickDownColor: "#f85149",
  });

  // KST 시간을 UTC 기준 Unix 초로 변환 (timezone offset 제거)
  const toChartTime = t => {
    const clean = t.replace(/\+09:00$/, "").replace(" ", "T");
    return Math.floor(new Date(clean + "Z").getTime() / 1000);
  };

  candleSeries.setData(d.candles.map(c => ({
    time: toChartTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c,
  })));

  // 매수/매도 마커
  if (d.trade_markers && d.trade_markers.length > 0) {
    const markers = [];
    for (const m of d.trade_markers) {
      // sell_datetime이 없으면 보유중 진입 마커 (주황색)
      if (m.buy_datetime)  markers.push({ time: toChartTime(m.buy_datetime),  position: "belowBar", color: m.sell_datetime ? "#3fb950" : "#e3b341", shape: "arrowUp",   text: "B" });
      if (m.sell_datetime) markers.push({ time: toChartTime(m.sell_datetime), position: "aboveBar", color: m.win ? "#3fb950" : "#f85149", shape: "arrowDown", text: "S" });
    }
    markers.sort((a, b) => a.time - b.time);
    candleSeries.setMarkers(markers);
  }

  // 볼륨 히스토그램 (차트 하단 20% 영역에 오버레이)
  const volumeSeries = btLwChart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
  });
  btLwChart.priceScale("volume").applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
    visible: false,
  });
  volumeSeries.setData(d.candles.map(c => ({
    time: toChartTime(c.t),
    value: c.v || 0,
    color: c.c >= c.o ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)",
  })));

  // 활성화된 추세필터 라인 오버레이 (활성화 순서대로 파랑, 주황, 보라 = 단기 MA, 장기 MA, VWMA)
  const MA_COLORS = ["#58a6ff", "#f0883e", "#bc8cff"];
  (d.ma_lines || []).forEach((ml, idx) => {
    if (!ml || !ml.data) return;
    const maSeries = btLwChart.addLineSeries({
      color: MA_COLORS[idx % MA_COLORS.length],
      lineWidth: 1.5,
      title: `${ml.type || "MA"}${ml.period}`,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    maSeries.setData(
      d.candles
        .map((c, i) => ml.data[i] != null ? { time: toChartTime(c.t), value: ml.data[i] } : null)
        .filter(v => v !== null)
    );
  });

  // 전략 전용 채널 라인 (터틀: 진입 채널 상단=초록 점선, 청산 채널 하단=빨강 점선)
  const CHANNEL_COLORS = { entry: "rgba(63,185,80,0.8)", exit: "rgba(248,81,73,0.8)" };
  (d.channel_lines || []).forEach(cl => {
    if (!cl || !cl.data) return;
    const chSeries = btLwChart.addLineSeries({
      color: CHANNEL_COLORS[cl.kind] || "#8b949e",
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      title: cl.label,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    chSeries.setData(
      d.candles
        .map((c, i) => cl.data[i] != null ? { time: toChartTime(c.t), value: cl.data[i] } : null)
        .filter(v => v !== null)
    );
  });

  btLwChart.timeScale().fitContent();

  // OHLC 툴팁: 크로스헤어 이동 시 봉 정보 표시
  let ohlcTooltip = document.getElementById("btOhlcTooltip");
  if (!ohlcTooltip) {
    ohlcTooltip = document.createElement("div");
    ohlcTooltip.id = "btOhlcTooltip";
    ohlcTooltip.style.cssText = [
      "position:absolute", "z-index:100", "pointer-events:none",
      "background:#161b22", "border:1px solid #30363d", "border-radius:6px",
      "padding:8px 12px", "font-size:12px", "line-height:1.8",
      "color:#e6edf3", "white-space:nowrap", "display:none",
    ].join(";");
    container.style.position = "relative";
    container.appendChild(ohlcTooltip);
  }

  // 캔들 데이터를 time → OHLCV 맵으로 구성
  const candleMap = new Map(d.candles.map(c => [toChartTime(c.t), c]));

  btLwChart.subscribeCrosshairMove(param => {
    if (!param || !param.time || !param.point) {
      ohlcTooltip.style.display = "none";
      return;
    }
    const c = candleMap.get(param.time);
    if (!c) { ohlcTooltip.style.display = "none"; return; }

    const fmt   = v => Number(v).toLocaleString("ko-KR");
    const isUp  = c.c >= c.o;
    const color = isUp ? "#3fb950" : "#f85149";
    const chg   = ((c.c - c.o) / c.o * 100).toFixed(2);
    const sign  = isUp ? "+" : "";

    ohlcTooltip.innerHTML = `
      <span style="color:#8b949e">시가</span> <span style="color:${color}">${fmt(c.o)}</span> &nbsp;
      <span style="color:#8b949e">고가</span> <span style="color:#3fb950">${fmt(c.h)}</span><br>
      <span style="color:#8b949e">저가</span> <span style="color:#f85149">${fmt(c.l)}</span> &nbsp;
      <span style="color:#8b949e">종가</span> <span style="color:${color}">${fmt(c.c)}</span><br>
      <span style="color:#8b949e">등락</span> <span style="color:${color}">${sign}${chg}%</span> &nbsp;
      <span style="color:#8b949e">거래량</span> <span style="color:#8b949e">${fmt(c.v || 0)}</span>
    `.trim();

    // 툴팁 위치: 우측 공간이 부족하면 좌측으로
    const rect = container.getBoundingClientRect();
    const ttW  = 260;
    const left = param.point.x + 16 + ttW > container.clientWidth
      ? param.point.x - ttW - 8
      : param.point.x + 16;
    ohlcTooltip.style.left    = `${left}px`;
    ohlcTooltip.style.top     = `${Math.max(4, param.point.y - 40)}px`;
    ohlcTooltip.style.display = "block";
  });

  new ResizeObserver(() => {
    if (btLwChart) btLwChart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 400 });
  }).observe(container);
}
