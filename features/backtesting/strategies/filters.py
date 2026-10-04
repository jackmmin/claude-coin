"""전략 공용 진입 필터 (추세필터, 볼륨필터)."""
from .indicators import sma_series, vwma_series

VOLUME_AVG_BARS = 20  # 볼륨필터 평균 거래량 계산 구간 (봉)


def build_trend_filter(data, sma_configs, vwma_config):
    """
    추세필터 판정 함수를 만든다.
    - sma_configs: [(활성화 여부, 기간), ...]  단기 MA, 장기 MA
    - vwma_config: (활성화 여부, 기간)        거래량가중이동평균

    반환된 passes(i, price)는 봉 i 진입 시점에 price가 활성화된 모든 평균선
    위에 있으면 True. 평균선은 미래 참조를 피하려고 직전 봉(i-1)까지의 값으로 본다.
    기간만큼 캔들이 쌓이지 않은 구간은 추세를 판단할 수 없으므로 False.
    """
    closes = [c["trade_price"] for c in data]
    volumes = [c.get("candle_acc_trade_volume", 0) for c in data]

    # 활성화된 평균선만 한 번씩 미리 계산 (period, 시계열)
    lines = []
    for enabled, period in sma_configs:
        if enabled:
            lines.append((period, sma_series(closes, period)))
    vwma_enabled, vwma_period = vwma_config
    if vwma_enabled:
        lines.append((vwma_period, vwma_series(closes, volumes, vwma_period)))

    def passes(i, price):
        for period, series in lines:
            if i < period:
                return False
            value = series[i - 1]
            if value is not None and price < value:
                return False
        return True

    return passes


def passes_volume_filter(data, i, mult):
    """볼륨필터: 봉 i 거래량이 직전 20봉 평균 × 배수 이상이면 True."""
    vol_window = data[max(0, i - VOLUME_AVG_BARS):i]
    vols = [c.get("candle_acc_trade_volume", 0) for c in vol_window]
    avg_vol = sum(vols) / len(vol_window) if vol_window else 0
    curr_vol = data[i].get("candle_acc_trade_volume", 0)
    return not (avg_vol > 0 and curr_vol < avg_vol * mult)
