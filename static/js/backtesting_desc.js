// 백테스팅 전략 이름·개요·설명 문구

const STRATEGY_NAMES = {
  K_VOLATILITY_BREAKOUT: "K변동성 돌파",
  TRAILING_BREAKOUT:     "트레일링 스탑 돌파",
  RSI_OVERSOLD_BOUNCE:   "RSI 과매도 반등",
  RSI_DIVERGENCE_TRAIL:  "RSI 다이버전스 + 트레일링",
  MA_GOLDEN_CROSS:       "MA 골든크로스",
  BOLLINGER_BOUNCE:      "볼린저밴드 반등",
  TURTLE_TRADING:        "터틀 트레이딩",
};

const STRATEGY_OVERVIEW = {
  K_VOLATILITY_BREAKOUT: "전일 변동폭의 K배를 시가에 더한 가격을 돌파하면 매수. 추세 추종형으로 변동성이 클수록 유리하며, TP/SL로 수익과 손실을 제한합니다.",
  RSI_OVERSOLD_BOUNCE:   "RSI가 과매도 구간에 진입할 때 반등을 노리는 평균 회귀 전략. 횡보장에서 유효하며 추세장에서는 손실이 커질 수 있습니다.",
  RSI_DIVERGENCE_TRAIL:  "가격은 신저점인데 RSI는 오히려 올라오는 상승 다이버전스 + 거래량 급증 시 진입. 추세 전환 초입을 포착하며 트레일링 스탑으로 수익을 극대화합니다.",
  MA_GOLDEN_CROSS:       "단기 이동평균이 장기 이동평균을 상향 돌파(골든크로스)할 때 매수. 중·장기 추세 추종 전략으로 추세가 뚜렷한 시장에서 강합니다.",
  BOLLINGER_BOUNCE:      "볼린저밴드 하단을 이탈한 가격이 밴드 안으로 복귀할 때 매수. 과매도 반등을 노리는 평균 회귀 전략입니다.",
  TRAILING_BREAKOUT:     "변동성 돌파로 진입 후 즉시 타이트한 손절로 손실을 제한하고, 고점 대비 일정 % 하락 시 청산(트레일링)으로 수익을 극대화. 손익비 중심 단기 전략.",
  TURTLE_TRADING:        "최근 N봉 최고가를 돌파하면 매수하는 추세추종 전략. 변동성(ATR)으로 매수 수량을 정하고, 오를 때마다 나눠서 추가 매수하며, 손절 폭이나 최근 저가를 이탈하면 전량 매도합니다. 승률은 낮지만 큰 추세에서 수익을 냅니다.",
};

const INTERVAL_LABEL = {
  minutes15: "15분봉", minutes60: "1시간봉", minutes240: "4시간봉",
  days: "1일봉", weeks: "주봉", months: "월봉",
};

function getStrategyDesc(strategy) {
  const g   = id => document.getElementById(id);
  const chk = id => g(id) ? g(id).checked : false;
  const val = id => g(id) ? g(id).value   : "";

  if (strategy === "K_VOLATILITY_BREAKOUT") {
    const k    = val("kSlider");
    const exit = [];
    if (chk("kUseTp")) exit.push(`TP+${val("kTp")}%`);
    if (chk("kUseSl")) exit.push(`SL-${val("kSl")}%`);
    if (!exit.length) exit.push("당일종가");
    const filter = [];
    if (chk("kMa1Filter"))    filter.push(`단기MA${val("kMa1Period")}`);
    if (chk("kMa2Filter"))    filter.push(`장기MA${val("kMa2Period")}`);
    if (chk("kVwmaFilter"))   filter.push(`VWMA${val("kVwmaPeriod")}`);
    if (chk("kVolumeFilter")) filter.push(`볼륨${val("kVolumeMult")}x`);
    return `진입: 시가+K(${k})×전봉변동폭 | 청산: ${exit.join(" · ")} | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "RSI_DIVERGENCE_TRAIL") {
    const period  = val("rdiRsiPeriod");
    const lookback = val("rdiLookback");
    const vol     = val("rdiVolMult");
    const trail   = val("rdiTrailPct");
    const sl      = val("rdiSlPct");
    const filter  = [];
    if (chk("rdiMaFilter")) filter.push(`MA${val("rdiMaPeriod")}봉`);
    return `진입: RSI${period} 다이버전스 + 거래량${vol}x (탐색${lookback}봉) | 청산: 트레일${trail}% · SL-${sl}% | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "RSI_OVERSOLD_BOUNCE") {
    const period = val("rsiPeriod"), thr = val("rsiThreshold");
    const mode   = val("rsiEntryMode") === "crossover" ? "회복후진입" : "즉시진입";
    const exit   = [];
    if (chk("rsiUseTp"))      exit.push(`TP+${val("rsiTp")}%`);
    if (chk("rsiUseSl"))      exit.push(`SL-${val("rsiSl")}%`);
    if (chk("rsiUseRsiExit")) exit.push(`RSI${val("rsiExit")}↑`);
    const maxBars = parseInt(val("rsiMaxHoldBars"));
    if (maxBars > 0) exit.push(`최대${maxBars}봉`);
    if (!exit.length) exit.push("수동청산");
    const filter = [];
    if (chk("rsiMaFilter"))     filter.push(`MA${val("rsiMaPeriod")}봉`);
    if (chk("rsiVolumeFilter")) filter.push(`볼륨${val("rsiVolumeMult")}x`);
    return `진입: RSI${period} <${thr} · ${mode} | 청산: ${exit.join(" · ")} | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "MA_GOLDEN_CROSS") {
    const fast = val("maFast"), slow = val("maSlow");
    const exit = [];
    if (chk("maUseTp"))    exit.push(`TP+${val("maTp")}%`);
    if (chk("maUseSl"))    exit.push(`SL-${val("maSl")}%`);
    if (chk("mauseMAExit")) exit.push("데드크로스");
    const maxBars = parseInt(val("maMaxHoldBars"));
    if (maxBars > 0) exit.push(`최대${maxBars}봉`);
    if (!exit.length) exit.push("수동청산");
    const filter = [];
    if (chk("maVolumeFilter")) filter.push(`볼륨${val("maVolumeMult")}x`);
    return `진입: MA${fast}/MA${slow} 골든크로스 | 청산: ${exit.join(" · ")} | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "TRAILING_BREAKOUT") {
    const k     = val("tbKSlider");
    const sl    = val("tbSl");
    const trail = val("tbTrail");
    const filter = [];
    if (chk("tbMa1Filter"))    filter.push(`단기MA${val("tbMa1Period")}`);
    if (chk("tbMa2Filter"))    filter.push(`장기MA${val("tbMa2Period")}`);
    if (chk("tbVwmaFilter"))   filter.push(`VWMA${val("tbVwmaPeriod")}`);
    if (chk("tbVolumeFilter")) filter.push(`볼륨${val("tbVolumeMult")}x`);
    return `진입: 시가+K(${k})×전봉변동폭 | SL: -${sl}% 고정 · 트레일: 고점-${trail}% | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "BOLLINGER_BOUNCE") {
    const period = val("bbPeriod"), std = val("bbStd");
    const exit   = [];
    if (chk("bbUseTp"))         exit.push(`TP+${val("bbTp")}%`);
    if (chk("bbUseSl"))         exit.push(`SL-${val("bbSl")}%`);
    if (chk("bbUseMiddleExit")) exit.push("중간선청산");
    const maxBars = parseInt(val("bbMaxHoldBars"));
    if (maxBars > 0) exit.push(`최대${maxBars}봉`);
    if (!exit.length) exit.push("수동청산");
    const filter = [];
    if (chk("bbVolumeFilter")) filter.push(`볼륨${val("bbVolumeMult")}x`);
    return `진입: BB${period}봉 σ${std} | 청산: ${exit.join(" · ")} | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  if (strategy === "TURTLE_TRADING") {
    const isS1  = val("ttSystem") === "1";
    const entry = [`${val("ttEntryPeriod")}봉 최고가 돌파`];
    // 건너뛰기 규칙과 안전장치는 시스템 1에서만 동작
    if (isS1 && chk("ttUseSkip")) entry.push(`직전 수익 시 건너뜀(안전장치 ${val("ttFailsafePeriod")}봉)`);
    const size = `유닛=자산${val("ttRiskPct")}%÷N(ATR${val("ttAtrPeriod")}) · ${val("ttAddStep")}N마다 추가 · 최대 ${val("ttMaxUnits")}유닛`;
    const exit = [`손절 ${val("ttStopN")}N`, `${val("ttExitPeriod")}봉 최저가 이탈`];
    if (chk("ttUseDdRule")) exit.push(`낙폭 ${val("ttDdTrigger")}%마다 기준자산 ${val("ttDdReduce")}% 축소`);
    const filter = [];
    if (chk("ttMa1Filter"))    filter.push(`단기MA${val("ttMa1Period")}`);
    if (chk("ttMa2Filter"))    filter.push(`장기MA${val("ttMa2Period")}`);
    if (chk("ttVwmaFilter"))   filter.push(`VWMA${val("ttVwmaPeriod")}`);
    if (chk("ttVolumeFilter")) filter.push(`볼륨${val("ttVolumeMult")}x`);
    return `진입: ${entry.join(" · ")} | 포지션: ${size} | 청산: ${exit.join(" · ")} | 필터: ${filter.length ? filter.join(" · ") : "없음"}`;
  }
  return "";
}
