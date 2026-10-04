// 백테스팅 탭 UI 이벤트 및 실행

function onStrategyChange() {
  const strategy = document.getElementById("strategySelect").value;
  ["ctrl-k", "ctrl-tb", "ctrl-rdi", "ctrl-rsi", "ctrl-ma", "ctrl-bb", "ctrl-tt"].forEach(id =>
    document.getElementById(id).classList.remove("active")
  );
  const map = {
    K_VOLATILITY_BREAKOUT: "ctrl-k",
    RSI_OVERSOLD_BOUNCE:   "ctrl-rsi",
    RSI_DIVERGENCE_TRAIL:  "ctrl-rdi",
    MA_GOLDEN_CROSS:       "ctrl-ma",
    BOLLINGER_BOUNCE:      "ctrl-bb",
    TRAILING_BREAKOUT:     "ctrl-tb",
    TURTLE_TRADING:        "ctrl-tt",
  };
  const id = map[strategy];
  if (id) document.getElementById(id).classList.add("active");
  document.getElementById("strategyOverview").textContent = STRATEGY_OVERVIEW[strategy] || "";
  document.getElementById("strategyDesc").textContent = getStrategyDesc(strategy);
  document.getElementById("btResult").style.display = "none";
}

function updateStrategyDesc() {
  const strategy = document.getElementById("strategySelect").value;
  document.getElementById("strategyOverview").textContent = STRATEGY_OVERVIEW[strategy] || "";
  document.getElementById("strategyDesc").textContent = getStrategyDesc(strategy);
}

document.querySelectorAll(".param-panel input, .param-panel select").forEach(el => {
  el.addEventListener("input",  updateStrategyDesc);
  el.addEventListener("change", updateStrategyDesc);
});

const kSlider  = document.getElementById("kSlider");
const kDisplay = document.getElementById("kValueDisplay");
kSlider.addEventListener("input", () => { kDisplay.textContent = kSlider.value; });

const tbKSlider  = document.getElementById("tbKSlider");
const tbKDisplay = document.getElementById("tbKValueDisplay");
tbKSlider.addEventListener("input", () => { tbKDisplay.textContent = tbKSlider.value; });

// 터틀 시스템 선택 시 채널 기간을 해당 시스템 기본값으로 바꾼다 (시스템 1: 20/10, 시스템 2: 55/20).
// 건너뛰기 규칙과 안전장치는 시스템 1 전용이라 시스템 2에서는 비활성화한다.
const ttSystem = document.getElementById("ttSystem");
ttSystem.addEventListener("change", () => {
  const isS1 = ttSystem.value === "1";
  document.getElementById("ttEntryPeriod").value = isS1 ? 20 : 55;
  document.getElementById("ttExitPeriod").value  = isS1 ? 10 : 20;
  document.getElementById("ttUseSkip").disabled        = !isS1;
  document.getElementById("ttFailsafePeriod").disabled = !isS1;
  updateStrategyDesc();
});

const capitalInput = document.getElementById("initialCapital");
capitalInput.addEventListener("input", () => {
  const raw    = capitalInput.value.replace(/[^0-9]/g, "");
  const cursor = capitalInput.selectionStart;
  const prevLen = capitalInput.value.length;
  capitalInput.value = raw ? Number(raw).toLocaleString("ko-KR") : "";
  const diff = capitalInput.value.length - prevLen;
  capitalInput.setSelectionRange(cursor + diff, cursor + diff);
});
function getCapitalValue() {
  return parseInt(capitalInput.value.replace(/[^0-9]/g, "")) || 1000000;
}

async function runBacktest() {
  const market   = document.getElementById("marketSelect").value;
  if (!market) { showToast("마켓을 선택해주세요"); return; }
  const strategy = document.getElementById("strategySelect").value;
  const interval = document.getElementById("intervalSelect").value;
  const count    = parseInt(document.getElementById("candleCount").value) || 1000;
  const initialCapital = getCapitalValue();

  let params = `market=${market}&strategy=${strategy}&interval=${interval}&count=${count}&initial_capital=${initialCapital}`;
  params += buildStrategyParams(strategy);

  const btn = document.getElementById("btRunBtn");
  btn.disabled = true;
  document.getElementById("btLoadingMsg").style.display = "block";
  document.getElementById("btLoadingText").textContent =
    `${STRATEGY_NAMES[strategy]} | ${INTERVAL_LABEL[interval]} ${count}개 캔들 수집 중...`;
  document.getElementById("btResult").style.display = "none";
  document.getElementById("btErrorMsg").style.display = "none";

  try {
    const res  = await fetch(`/api/backtesting?${params}`);
    const data = await res.json();
    if (data.error) {
      showBtError(data.error);
      return;
    }
    document.getElementById("btResult").style.display = "block";
    renderBacktest(data);
  } catch (e) {
    showBtError("백테스팅 오류: " + e.message);
  } finally {
    btn.disabled = false;
    document.getElementById("btLoadingMsg").style.display = "none";
  }
}

function showBtError(message) {
  document.getElementById("btErrorText").textContent = message;
  document.getElementById("btErrorMsg").style.display = "block";
}
