"""백테스팅 전략 공용 지표 계산 함수 모음 (이동평균, RSI, ATR, 돈치안 채널, 다이버전스)."""


def find_price_lows(closes, window=3):
    """
    가격 기준 로컬 저점 인덱스 반환.
    양쪽 window개보다 낮거나 같은 지점. 배열 끝부분은 오른쪽 비교 대상이
    부족하므로 자동으로 제외된다.
    """
    lows = []
    n = len(closes)
    for i in range(window, n - window):
        if all(closes[i] <= closes[i - j] for j in range(1, window + 1)) and \
           all(closes[i] <= closes[i + j] for j in range(1, window + 1)):
            lows.append(i)
    return lows


def detect_bullish_divergence(closes, rsi_values, lookback=30, window=3, rsi_warmup=15):
    """
    상승 다이버전스 탐지.
    전체 배열에서 가격 로컬 저점을 찾고, 가장 최근 저점(curr)이 lookback 범위 안에
    있으면 그 이전 저점(prev)과 비교한다. prev는 lookback 밖이어도 허용.
    rsi_warmup 이전 인덱스의 저점은 RSI가 신뢰할 수 없으므로 제외.
    - 가격: curr 저점이 prev 저점보다 낮음 (신저점)
    - RSI:  curr 저점 위치의 RSI가 prev 저점 위치보다 높음 (강도 회복)
    반환: (탐지 여부, 이전 저점 RSI, 현재 저점 RSI)
    """
    n = len(closes)
    if n < window * 2 + 2 or len(rsi_values) != n:
        return False, None, None

    # RSI 워밍업 이후 구간에서만 저점 탐색
    all_lows = [i for i in find_price_lows(closes, window) if i >= rsi_warmup]
    if len(all_lows) < 2:
        return False, None, None

    # 가장 최근 저점(curr)이 lookback 범위 안에 있어야 의미 있는 신호
    curr_abs = all_lows[-1]
    if curr_abs < n - lookback:
        return False, None, None

    prev_abs = all_lows[-2]

    price_divergence = closes[curr_abs] < closes[prev_abs]          # 가격 신저점
    rsi_divergence   = rsi_values[curr_abs] > rsi_values[prev_abs]  # RSI 상승

    if price_divergence and rsi_divergence:
        return True, rsi_values[prev_abs], rsi_values[curr_abs]
    return False, None, None


def sma(values, period):
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def sma_series(values, period):
    """
    단순이동평균 시계열. O(n) 누적합 방식.
    result[i] = values[i-period+1 .. i] 평균, 워밍업 구간은 None.
    """
    n = len(values)
    result = [None] * n
    if period <= 0:
        return result
    prefix = [0.0]
    for v in values:
        prefix.append(prefix[-1] + v)
    for i in range(period - 1, n):
        result[i] = (prefix[i + 1] - prefix[i + 1 - period]) / period
    return result


def vwma_series(closes, volumes, period):
    """
    거래량가중이동평균(VWMA) 시계열. O(n) 누적합 방식.
    result[i] = Σ(종가×거래량) / Σ(거래량) (최근 period봉), 워밍업 구간은 None.
    구간 거래량 합이 0이면 계산할 수 없으므로 None.
    """
    n = len(closes)
    result = [None] * n
    if period <= 0:
        return result
    pv_prefix = [0.0]  # 종가×거래량 누적합
    v_prefix = [0.0]   # 거래량 누적합
    for close, vol in zip(closes, volumes):
        pv_prefix.append(pv_prefix[-1] + close * vol)
        v_prefix.append(v_prefix[-1] + vol)
    for i in range(period - 1, n):
        vol_sum = v_prefix[i + 1] - v_prefix[i + 1 - period]
        if vol_sum > 0:
            result[i] = (pv_prefix[i + 1] - pv_prefix[i + 1 - period]) / vol_sum
    return result


def atr_series(candles, period=20):
    """
    ATR(평균 실제 범위) 시계열. 터틀 트레이딩의 N 값.
    TR = max(고가-저가, |고가-전봉종가|, |전봉종가-저가|)
    첫 값은 TR의 단순평균으로 시드, 이후 와일더 평활: N = ((period-1)×전봉N + TR) / period
    워밍업 구간(인덱스 0 ~ period-1)은 None.
    """
    n = len(candles)
    result = [None] * n
    if period <= 0 or n < period + 1:
        return result

    # 인덱스 0은 전봉 종가가 없으므로 TR을 계산하지 않는다
    trs = [0.0] * n
    for i in range(1, n):
        high = candles[i]["high_price"]
        low = candles[i]["low_price"]
        prev_close = candles[i - 1]["trade_price"]
        trs[i] = max(high - low, abs(high - prev_close), abs(prev_close - low))

    atr = sum(trs[1:period + 1]) / period
    result[period] = atr
    for i in range(period + 1, n):
        atr = (atr * (period - 1) + trs[i]) / period
        result[i] = atr
    return result


def prev_high_series(values, period):
    """
    돈치안 채널 상단. result[i] = 직전 period봉(현재 봉 i 제외)의 최고값.
    현재 봉을 제외하므로 "봉 i의 고가가 result[i] 이상"이면 돌파다.
    """
    n = len(values)
    result = [None] * n
    if period <= 0:
        return result
    for i in range(period, n):
        result[i] = max(values[i - period:i])
    return result


def prev_low_series(values, period):
    """돈치안 채널 하단. result[i] = 직전 period봉(현재 봉 i 제외)의 최저값."""
    n = len(values)
    result = [None] * n
    if period <= 0:
        return result
    for i in range(period, n):
        result[i] = min(values[i - period:i])
    return result


def rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    diffs = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0) for d in diffs]
    losses = [abs(min(d, 0)) for d in diffs]
    # Wilder EMA: SMA 시드 후 지수 스무딩
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    return 100 - (100 / (1 + avg_gain / avg_loss))


def calc_rsi_series(candles, period):
    """전체 캔들에 대해 RSI 시계열 계산. 워밍업 구간은 None. O(n) 단일 패스."""
    closes = [c["trade_price"] for c in candles]
    return calc_rsi_series_from_closes(closes, period)


def calc_rsi_series_from_closes(closes, period):
    """
    종가 리스트로 RSI 시계열 계산. O(n) 단일 패스 (Wilder EMA).
    워밍업 구간(인덱스 0 ~ period)은 None, 이후는 float.
    """
    n = len(closes)
    result = [None] * n
    if n < period + 1:
        return result

    diffs = [closes[i] - closes[i - 1] for i in range(1, n)]
    gains = [max(d, 0) for d in diffs]
    losses = [abs(min(d, 0)) for d in diffs]

    # Wilder EMA 시드: 첫 period개 SMA
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def _rsi_val(ag, al):
        if al == 0:
            return 100.0 if ag > 0 else 50.0
        return 100 - (100 / (1 + ag / al))

    result[period] = round(_rsi_val(avg_gain, avg_loss), 2)

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        result[i + 1] = round(_rsi_val(avg_gain, avg_loss), 2)

    return result


def find_divergence_points(candles, rsi_series, lookback=30, window=3):
    """
    백테스팅 전 구간에서 다이버전스가 탐지된 캔들 인덱스 목록을 반환.
    슬라이싱 없이 전체 저점 목록을 한 번만 계산한 뒤 인덱스별로 직접 탐색. O(n).
    """
    closes = [c["trade_price"] for c in candles]
    rsi_vals = [v if v is not None else -1.0 for v in rsi_series]
    rsi_warmup = 15

    # 전체 가격 저점 목록을 한 번만 계산
    all_lows = [i for i in find_price_lows(closes, window) if i >= rsi_warmup]

    points = []
    # 저점 목록을 순서대로 순회하며 직전 저점과의 관계로 다이버전스 여부 판단
    for low_idx in range(1, len(all_lows)):
        curr_abs = all_lows[low_idx]
        prev_abs = all_lows[low_idx - 1]

        price_div = closes[curr_abs] < closes[prev_abs]
        rsi_div   = rsi_vals[curr_abs] > rsi_vals[prev_abs]

        if price_div and rsi_div:
            i = curr_abs
            # 3봉 이내로 붙은 신호는 최신 것으로 대체
            if points and i - points[-1] < 3:
                points[-1] = i
            else:
                points.append(i)

    return points
