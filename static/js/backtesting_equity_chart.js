// 백테스팅 에쿼티 커브 렌더링

let equityChart = null;

function renderEquityChart(d) {
  if (equityChart) { equityChart.destroy(); equityChart = null; }
  if (!d.equity_curve || d.equity_curve.length === 0) return;

  const ecLabels  = d.equity_curve.map(p => p.date);
  const ecValues  = d.equity_curve.map(p => p.value);
  const isProfit  = d.profit_loss >= 0;
  const lineColor = isProfit ? "#3fb950" : "#f85149";
  const ecCtx     = document.getElementById("equityChart").getContext("2d");
  equityChart = new Chart(ecCtx, {
    type: "line",
    data: {
      labels: ecLabels,
      datasets: [
        {
          label: "포트폴리오 가치",
          data: ecValues,
          borderColor: lineColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          backgroundColor: isProfit ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
          tension: 0.2,
        },
        {
          label: "원금",
          data: Array(ecValues.length).fill(d.initial_capital),
          borderColor: "#8b949e",
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#8b949e", font: { size: 12 } } },
        tooltip: {
          backgroundColor: "#161b22",
          borderColor: "#30363d",
          borderWidth: 1,
          titleColor: "#8b949e",
          bodyColor: "#e6edf3",
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              if (ctx.datasetIndex === 0) {
                const chg  = (val - d.initial_capital) / d.initial_capital * 100;
                const sign = chg >= 0 ? "+" : "";
                return ` ${Number(val).toLocaleString("ko-KR")} ₩  (원금대비 ${sign}${chg.toFixed(2)}%)`;
              }
              return ` ${Number(val).toLocaleString("ko-KR")} ₩`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: "#8b949e", maxTicksLimit: 10 }, grid: { color: "#21262d" } },
        y: { ticks: { color: "#8b949e", callback: v => Number(v).toLocaleString("ko-KR") }, grid: { color: "#21262d" } },
      },
    },
  });
}
