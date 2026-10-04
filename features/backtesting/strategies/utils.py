from .indicators import (  # noqa: F401  (기존 import 경로 호환용 재노출)
    find_price_lows, detect_bullish_divergence, sma, rsi,
    calc_rsi_series, calc_rsi_series_from_closes, find_divergence_points,
    sma_series, vwma_series,
)

FEE_RATE = 0.0005  # 매수/매도 각 0.05% 수수료


def build_result(strategy, trades, initial_capital, current_signal, candles=None, open_trade=None, **extra):
    candle_data = []
    if candles:
        candle_data = [
            {"t": c["candle_date_time_kst"], "o": c["opening_price"],
             "h": c["high_price"], "l": c["low_price"], "c": c["trade_price"],
             "v": c.get("candle_acc_trade_volume", 0)}
            for c in candles
        ]

    # 활성화된 추세필터(MA/VWMA)별 라인 데이터 계산
    ma_lines = []
    if candles:
        closes = [c["trade_price"] for c in candles]
        volumes = [c.get("candle_acc_trade_volume", 0) for c in candles]

        # 전략별 추세필터 키 매핑 (필터 활성화 키, 기간 키, 라인 종류)
        trend_filter_keys = [
            ("k_ma1_filter", "k_ma1_period", "MA"),        # K변동성돌파 단기 MA
            ("k_ma2_filter", "k_ma2_period", "MA"),        # K변동성돌파 장기 MA
            ("k_vwma_filter", "k_vwma_period", "VWMA"),    # K변동성돌파 VWMA
            ("tb_ma1_filter", "tb_ma1_period", "MA"),      # 트레일링돌파 단기 MA
            ("tb_ma2_filter", "tb_ma2_period", "MA"),      # 트레일링돌파 장기 MA
            ("tb_vwma_filter", "tb_vwma_period", "VWMA"),  # 트레일링돌파 VWMA
            ("tt_ma1_filter", "tt_ma1_period", "MA"),      # 터틀 단기 MA
            ("tt_ma2_filter", "tt_ma2_period", "MA"),      # 터틀 장기 MA
            ("tt_vwma_filter", "tt_vwma_period", "VWMA"),  # 터틀 VWMA
            ("rsi_ma_filter", "rsi_ma_period", "MA"),      # RSI과매도 MA
            ("rdi_ma_filter", "rdi_ma_period", "MA"),      # RSI다이버전스 MA
        ]
        seen_lines = set()  # 동일 종류·기간 라인 중복 계산 방지
        for key_f, key_p, kind in trend_filter_keys:
            if not extra.get(key_f):
                continue
            period = extra.get(key_p)
            if not period or (kind, period) in seen_lines:
                continue
            seen_lines.add((kind, period))
            series = (sma_series(closes, period) if kind == "MA"
                      else vwma_series(closes, volumes, period))
            ma_lines.append({
                "period": period,
                "type": kind,
                "data": [round(v) if v is not None else None for v in series],
            })

    # RSI 시계열 및 다이버전스 저점 계산 (RSI 관련 전략에서만)
    rsi_line = []
    divergence_points = []
    rsi_period_for_line = None
    if candles:
        if strategy == "RSI_DIVERGENCE_TRAIL":
            rsi_period_for_line = extra.get("rdi_rsi_period", 14)
            lookback = extra.get("rdi_lookback", 30)
        elif strategy == "RSI_OVERSOLD_BOUNCE":
            rsi_period_for_line = extra.get("rsi_period", 14)

        if rsi_period_for_line:
            rsi_line = calc_rsi_series(candles, rsi_period_for_line)
            # RSI_DIVERGENCE_TRAIL 전략에서는 다이버전스 저점도 표시
            if strategy == "RSI_DIVERGENCE_TRAIL":
                divergence_points = find_divergence_points(candles, rsi_line, lookback=lookback)

    base = {
        "strategy": strategy,
        "total_trades": 0,
        "win_rate": 0,
        "avg_pnl_per_trade": 0,
        "total_return": 0,
        "initial_capital": initial_capital,
        "final_value": initial_capital,
        "profit_loss": 0,
        "equity_curve": [],
        "current_signal": current_signal,
        "trades": [],
        "candles": candle_data,
        "ma_lines": ma_lines,
        "channel_lines": [],  # 돈치안 채널 등 전략 전용 라인 (전략이 extra로 덮어씀)
        "rsi_line": rsi_line,
        "divergence_points": divergence_points,
        "rsi_period": rsi_period_for_line,
    }
    base.update(extra)

    if not trades and open_trade is None:
        return base

    if not trades:
        if open_trade is not None:
            base["trades"] = [open_trade]
            if open_trade.get("buy_datetime"):
                base["trade_markers"] = [{
                    "buy_datetime": open_trade["buy_datetime"],
                    "sell_datetime": None,
                    "win": None,
                }]
        return base

    wins = sum(1 for t in trades if t["win"])
    win_rate = wins / len(trades)
    avg_pnl = sum(t["pnl"] for t in trades) / len(trades)

    portfolio = initial_capital
    equity_curve = [{"date": "시작", "value": initial_capital}]
    for t in trades:
        prev = portfolio
        portfolio = round(portfolio * (1 + t["pnl"]))
        equity_curve.append({"date": t["date"], "value": portfolio})
        t["krw_pnl"] = portfolio - prev

    total_return = (portfolio / initial_capital - 1) if initial_capital > 0 else 0

    trade_markers = [
        {"buy_datetime": t["buy_datetime"], "sell_datetime": t["sell_datetime"], "win": t["win"]}
        for t in trades
        if "buy_datetime" in t and t.get("sell_datetime")
    ]
    # 보유중인 open trade의 진입 마커도 포함
    if open_trade is not None and open_trade.get("buy_datetime"):
        trade_markers.append({
            "buy_datetime": open_trade["buy_datetime"],
            "sell_datetime": None,
            "win": None,
        })

    displayed = trades[-50:]
    if open_trade is not None:
        displayed = displayed + [open_trade]

    base.update({
        "total_trades": len(trades),
        "win_rate": round(win_rate, 4),
        "avg_pnl_per_trade": round(avg_pnl, 6),
        "total_return": round(total_return, 4),
        "final_value": portfolio,
        "profit_loss": portfolio - initial_capital,
        "equity_curve": equity_curve,
        "trades": displayed,
        "trade_markers": trade_markers,
    })
    return base
