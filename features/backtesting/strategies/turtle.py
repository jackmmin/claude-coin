from .utils import FEE_RATE, build_result
from .indicators import atr_series, prev_high_series, prev_low_series
from .filters import build_trend_filter, passes_volume_filter

MIN_ORDER_KRW = 1  # 이 금액 미만의 주문은 체결하지 않는다 (현금 소진 시 무한 추가매수 방지)


def _px(value):
    """표시용 가격 반올림. 1,000원 미만 저가 코인은 소수점을 유지한다."""
    if value is None:
        return None
    return round(value) if value >= 1000 else round(value, 4)


def _sizing_equity(equity, peak, use_rule, trigger, reduce):
    """
    낙폭 규칙을 반영한 포지션 크기 산정 기준 자산.
    자산이 고점 대비 trigger(10%)만큼 줄 때마다 기준 자산을 reduce(20%)씩 축소한다.
    원래 규칙은 연초 자산 기준이지만, 백테스팅 기간이 길 수 있어 고점 기준으로 적용했다.
    """
    if not use_rule or trigger <= 0 or peak <= 0:
        return equity
    drawdown = 1 - equity / peak
    steps = int(drawdown / trigger + 1e-9)
    return equity * (1 - reduce) ** steps if steps > 0 else equity


def _buy_unit(pos, cash, price, add_step, stop_n):
    """
    1유닛 매수. 현물이라 보유 현금 한도 내로 수량을 제한한다.
    체결되면 손절가를 (체결가 - stop_n×N)으로, 다음 추가매수 가격을
    (체결가 + add_step×N)으로 갱신하고 남은 현금을 반환한다. 체결 불가면 None.
    """
    qty = min(pos["unit_qty"], cash / (price * (1 + FEE_RATE)))
    if qty * price < MIN_ORDER_KRW:
        return None
    pos["qty"] += qty
    pos["cost"] += qty * price * (1 + FEE_RATE)  # 수수료 포함 매수 금액
    pos["gross"] += qty * price                  # 수수료 제외 매수 금액 (평균단가 계산용)
    pos["fee"] += qty * price * FEE_RATE
    pos["units"] += 1
    pos["stop"] = price - stop_n * pos["n"]       # 전체 유닛의 손절가를 함께 상향
    pos["next_add"] = price + add_step * pos["n"]
    return cash - qty * price * (1 + FEE_RATE)


def _trade_record(pos, sell_price, sell_datetime, is_open=False):
    """
    포지션(첫 진입 ~ 전량 청산)을 거래 1건으로 기록.
    pnl은 진입 시점 계좌 자산 대비 손익률이라 build_result의 복리 계산과 맞는다.
    """
    proceeds = pos["qty"] * sell_price * (1 - FEE_RATE)
    pnl = (proceeds - pos["cost"]) / pos["equity"]
    # 보유중이면 아직 매도 수수료가 발생하지 않았으므로 매수 수수료만 표시
    fee = pos["fee"] + (0 if is_open else pos["qty"] * sell_price * FEE_RATE)
    record = {
        "date": pos["buy_datetime"][:16],
        "buy_datetime": pos["buy_datetime"],
        "sell_datetime": "" if is_open else sell_datetime,
        "buy_price": _px(pos["gross"] / pos["qty"]),  # 유닛 평균 매수가
        "sell_price": _px(sell_price),
        "pnl": round(pnl, 6),
        "win": pnl > 0,
        "entry_amount": round(pos["equity"]),
        "fee": round(fee),
        "units": pos["units"],
    }
    if is_open:
        record["open"] = True
    return record, proceeds


def run(data, initial_capital=1000000,
        tt_system=1, tt_entry_period=20, tt_exit_period=10, tt_failsafe_period=55,
        tt_use_skip=True, tt_atr_period=20, tt_risk_pct=0.01,
        tt_add_step=0.5, tt_max_units=4, tt_stop_n=2.0,
        tt_use_dd_rule=True, tt_dd_trigger=0.10, tt_dd_reduce=0.20,
        tt_ma1_filter=False, tt_ma1_period=50,
        tt_ma2_filter=False, tt_ma2_period=200,
        tt_vwma_filter=False, tt_vwma_period=100,
        tt_volume_filter=False, tt_volume_mult=1.5):
    """
    터틀 트레이딩 (돈치안 채널 돌파 추세추종, 현물이라 매수 전용)
    - N: ATR(tt_atr_period). 진입 시점의 N을 포지션 청산까지 고정해서 쓴다.
    - 진입: 직전 tt_entry_period봉 최고가 돌파 시 돌파 가격에 매수
    - 시스템 1 건너뛰기: 직전 돌파가 수익이었으면 이번 돌파는 건너뛰고,
      tt_failsafe_period봉 최고가를 돌파하면 무조건 진입 (큰 추세 놓침 방지)
    - 유닛: 기준 자산 × tt_risk_pct ÷ N (1N 움직임 = 자산의 tt_risk_pct)
    - 피라미딩: 마지막 체결가에서 tt_add_step×N 오를 때마다 1유닛 추가, 최대 tt_max_units
    - 청산: 손절가(마지막 체결가 - tt_stop_n×N)와 직전 tt_exit_period봉 최저가 중
      높은 가격(= 하락 시 먼저 닿는 가격)을 이탈하면 전량 매도
    """
    # 0 이하 값이 들어오면 무한 루프·0 나눗셈이 생기므로 최소값으로 보정
    entry_period = max(1, tt_entry_period)
    exit_period = max(1, tt_exit_period)
    failsafe_period = max(1, tt_failsafe_period)
    atr_period = max(1, tt_atr_period)
    max_units = max(1, tt_max_units)

    highs = [c["high_price"] for c in data]
    lows = [c["low_price"] for c in data]
    atr = atr_series(data, atr_period)
    entry_high = prev_high_series(highs, entry_period)
    exit_low = prev_low_series(lows, exit_period)
    failsafe_high = prev_high_series(highs, failsafe_period)
    trend_ok = build_trend_filter(
        data,
        [(tt_ma1_filter, tt_ma1_period), (tt_ma2_filter, tt_ma2_period)],
        (tt_vwma_filter, tt_vwma_period),
    )
    skip_rule = tt_system == 1 and tt_use_skip  # 건너뛰기 규칙은 시스템 1 전용

    trades = []
    cash = float(initial_capital)
    peak = cash       # 낙폭 규칙용 자산 고점
    pos = None        # 보유 포지션
    shadow = None     # 건너뛴 돌파의 가상 거래 (결과만 추적, 자금 미사용)
    last_win = None   # 직전 돌파의 수익 여부 (None = 아직 돌파 이력 없음)

    def open_position(i, price):
        """봉 i에서 price에 첫 유닛 진입. 같은 봉에서 더 오르면 추가 유닛까지 체결."""
        n = atr[i - 1]
        if not n or n <= 0:
            return None, cash
        sizing = _sizing_equity(cash, peak, tt_use_dd_rule, tt_dd_trigger, tt_dd_reduce)
        new_pos = {
            "equity": cash, "n": n, "unit_qty": sizing * tt_risk_pct / n,
            "qty": 0.0, "cost": 0.0, "gross": 0.0, "fee": 0.0, "units": 0,
            "buy_datetime": data[i]["candle_date_time_kst"],
        }
        remain = _buy_unit(new_pos, cash, price, tt_add_step, tt_stop_n)
        if remain is None:
            return None, cash
        return new_pos, add_units(new_pos, remain, i)

    def add_units(p, remain, i):
        """봉 i 고가가 추가매수 가격에 닿은 만큼 유닛 추가 (갭 상승이면 시가 체결)."""
        while tt_add_step > 0 and p["units"] < max_units and highs[i] >= p["next_add"]:
            fill = max(data[i]["opening_price"], p["next_add"])
            after = _buy_unit(p, remain, fill, tt_add_step, tt_stop_n)
            if after is None:
                break
            remain = after
        return remain

    # 채널과 N이 모두 계산되는 첫 봉부터 시작
    start = max(entry_period, exit_period, atr_period + 1)
    for i in range(start, len(data)):
        curr = data[i]
        open_p, high, low = curr["opening_price"], curr["high_price"], curr["low_price"]

        # ── 포지션 보유 중: 청산 확인 후 추가매수 ──
        if pos is not None:
            level = max(pos["stop"], exit_low[i])
            if low <= level:
                # 갭 하락으로 시가가 이미 청산가 아래면 시가에 체결
                record, proceeds = _trade_record(pos, min(open_p, level), curr["candle_date_time_kst"])
                trades.append(record)
                cash += proceeds
                peak = max(peak, cash)
                last_win = record["win"]  # 실제 진입한 돌파는 실제 손익으로 판정
                pos = None
            else:
                cash = add_units(pos, cash, i)
            continue

        filters_ok = trend_ok(i, open_p) and (
            not tt_volume_filter or passes_volume_filter(data, i, tt_volume_mult))

        # ── 건너뛴 돌파 추적 중: 가상 거래 결과 판정 또는 안전장치 진입 ──
        if shadow is not None:
            level = max(shadow["stop"], exit_low[i])
            if low <= level:
                last_win = min(open_p, level) > shadow["entry"]
                shadow = None
            elif failsafe_high[i] is not None and high >= failsafe_high[i] and filters_ok:
                pos, cash = open_position(i, max(open_p, failsafe_high[i]))
                if pos is not None:
                    shadow = None
            continue

        # ── 포지션 없음: 진입 채널 돌파 확인 ──
        if high < entry_high[i] or not filters_ok:
            continue
        price = max(open_p, entry_high[i])  # 갭 상승이면 시가 체결
        if skip_rule and last_win:
            if failsafe_high[i] is not None and high >= failsafe_high[i]:
                price = max(open_p, failsafe_high[i])  # 같은 봉에서 안전장치까지 돌파
            else:
                n = atr[i - 1] or 0
                shadow = {"entry": price, "stop": price - tt_stop_n * n}
                continue
        pos, cash = open_position(i, price)

    # ── 마지막 캔들까지 청산되지 않은 포지션은 보유중으로 표시 ──
    open_trade = None
    if pos is not None:
        open_trade, _ = _trade_record(pos, data[-1]["trade_price"], "", is_open=True)

    # ── current_signal: UI 표시용 현재 상태 ──
    last = data[-1]
    current_signal = {
        "date": last["candle_date_time_kst"][:16],
        "current_price": last["trade_price"],
        "entry_high": _px(entry_high[-1]),
        "exit_low": _px(exit_low[-1]),
        "n": _px(atr[-1]),
        "entry_period": entry_period,
        "exit_period": exit_period,
        "units": pos["units"] if pos else 0,
        "max_units": max_units,
        "stop_price": _px(max(pos["stop"], 0)) if pos else None,
        "skipping": shadow is not None,  # 건너뛴 돌파를 추적 중인지
        "triggered": False,              # 돌파 즉시 체결되므로 "신호만 발생" 상태가 없다
        "in_trade": pos is not None,
    }

    # 차트에 그릴 진입·청산 채널
    channel_lines = [
        {"label": f"진입{entry_period}", "kind": "entry", "data": [_px(v) for v in entry_high]},
        {"label": f"청산{exit_period}", "kind": "exit", "data": [_px(v) for v in exit_low]},
    ]

    return build_result(
        "TURTLE_TRADING", trades, initial_capital, current_signal,
        open_trade=open_trade, candles=data, channel_lines=channel_lines,
        tt_system=tt_system, tt_entry_period=entry_period, tt_exit_period=exit_period,
        tt_failsafe_period=failsafe_period, tt_use_skip=tt_use_skip,
        tt_atr_period=atr_period, tt_risk_pct=tt_risk_pct,
        tt_add_step=tt_add_step, tt_max_units=max_units, tt_stop_n=tt_stop_n,
        tt_use_dd_rule=tt_use_dd_rule, tt_dd_trigger=tt_dd_trigger, tt_dd_reduce=tt_dd_reduce,
        tt_ma1_filter=tt_ma1_filter, tt_ma1_period=tt_ma1_period,
        tt_ma2_filter=tt_ma2_filter, tt_ma2_period=tt_ma2_period,
        tt_vwma_filter=tt_vwma_filter, tt_vwma_period=tt_vwma_period,
        tt_volume_filter=tt_volume_filter, tt_volume_mult=tt_volume_mult,
        total_candles=len(data),
    )
