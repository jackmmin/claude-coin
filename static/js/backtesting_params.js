// 백테스팅 API 요청용 전략별 쿼리 파라미터 조립

function buildStrategyParams(strategy) {
  let params = "";
  if (strategy === "RSI_DIVERGENCE_TRAIL") {
    params += `&rdi_rsi_period=${document.getElementById("rdiRsiPeriod").value}`;
    params += `&rdi_lookback=${document.getElementById("rdiLookback").value}`;
    params += `&rdi_vol_mult=${document.getElementById("rdiVolMult").value}`;
    params += `&rdi_trail_pct=${parseFloat(document.getElementById("rdiTrailPct").value) / 100}`;
    params += `&rdi_sl_pct=${-parseFloat(document.getElementById("rdiSlPct").value) / 100}`;
    params += `&rdi_ma_filter=${document.getElementById("rdiMaFilter").checked}`;
    params += `&rdi_ma_period=${document.getElementById("rdiMaPeriod").value}`;
  } else if (strategy === "TRAILING_BREAKOUT") {
    params += `&k=${parseFloat(document.getElementById("tbKSlider").value)}`;
    params += `&tb_sl=${-parseFloat(document.getElementById("tbSl").value) / 100}`;
    params += `&tb_trail=${parseFloat(document.getElementById("tbTrail").value) / 100}`;
    params += `&tb_ma1_filter=${document.getElementById("tbMa1Filter").checked}`;
    params += `&tb_ma1_period=${document.getElementById("tbMa1Period").value}`;
    params += `&tb_ma2_filter=${document.getElementById("tbMa2Filter").checked}`;
    params += `&tb_ma2_period=${document.getElementById("tbMa2Period").value}`;
    params += `&tb_vwma_filter=${document.getElementById("tbVwmaFilter").checked}`;
    params += `&tb_vwma_period=${document.getElementById("tbVwmaPeriod").value}`;
    params += `&tb_volume_filter=${document.getElementById("tbVolumeFilter").checked}`;
    params += `&tb_volume_mult=${document.getElementById("tbVolumeMult").value}`;
  } else if (strategy === "K_VOLATILITY_BREAKOUT") {
    params += `&k=${parseFloat(kSlider.value)}`;
    params += `&k_use_tp=${document.getElementById("kUseTp").checked}`;
    params += `&k_tp=${parseFloat(document.getElementById("kTp").value) / 100}`;
    params += `&k_use_sl=${document.getElementById("kUseSl").checked}`;
    params += `&k_sl=${-parseFloat(document.getElementById("kSl").value) / 100}`;
    params += `&k_ma1_filter=${document.getElementById("kMa1Filter").checked}`;
    params += `&k_ma1_period=${document.getElementById("kMa1Period").value}`;
    params += `&k_ma2_filter=${document.getElementById("kMa2Filter").checked}`;
    params += `&k_ma2_period=${document.getElementById("kMa2Period").value}`;
    params += `&k_vwma_filter=${document.getElementById("kVwmaFilter").checked}`;
    params += `&k_vwma_period=${document.getElementById("kVwmaPeriod").value}`;
    params += `&k_volume_filter=${document.getElementById("kVolumeFilter").checked}`;
    params += `&k_volume_mult=${document.getElementById("kVolumeMult").value}`;
  } else if (strategy === "RSI_OVERSOLD_BOUNCE") {
    params += `&rsi_period=${document.getElementById("rsiPeriod").value}`;
    params += `&rsi_threshold=${document.getElementById("rsiThreshold").value}`;
    params += `&rsi_entry_mode=${document.getElementById("rsiEntryMode").value}`;
    params += `&rsi_use_tp=${document.getElementById("rsiUseTp").checked}`;
    params += `&rsi_tp=${parseFloat(document.getElementById("rsiTp").value) / 100}`;
    params += `&rsi_use_sl=${document.getElementById("rsiUseSl").checked}`;
    params += `&rsi_sl=${-parseFloat(document.getElementById("rsiSl").value) / 100}`;
    params += `&rsi_use_rsi_exit=${document.getElementById("rsiUseRsiExit").checked}`;
    params += `&rsi_exit=${document.getElementById("rsiExit").value}`;
    params += `&rsi_max_hold_bars=${document.getElementById("rsiMaxHoldBars").value}`;
    params += `&rsi_ma_filter=${document.getElementById("rsiMaFilter").checked}`;
    params += `&rsi_ma_period=${document.getElementById("rsiMaPeriod").value}`;
    params += `&rsi_volume_filter=${document.getElementById("rsiVolumeFilter").checked}`;
    params += `&rsi_volume_mult=${document.getElementById("rsiVolumeMult").value}`;
  } else if (strategy === "MA_GOLDEN_CROSS") {
    params += `&ma_fast=${document.getElementById("maFast").value}`;
    params += `&ma_slow=${document.getElementById("maSlow").value}`;
    params += `&ma_use_tp=${document.getElementById("maUseTp").checked}`;
    params += `&ma_tp=${parseFloat(document.getElementById("maTp").value) / 100}`;
    params += `&ma_use_sl=${document.getElementById("maUseSl").checked}`;
    params += `&ma_sl=${-parseFloat(document.getElementById("maSl").value) / 100}`;
    params += `&ma_use_ma_exit=${document.getElementById("mauseMAExit").checked}`;
    params += `&ma_volume_filter=${document.getElementById("maVolumeFilter").checked}`;
    params += `&ma_volume_mult=${document.getElementById("maVolumeMult").value}`;
    params += `&ma_max_hold_bars=${document.getElementById("maMaxHoldBars").value}`;
  } else if (strategy === "BOLLINGER_BOUNCE") {
    params += `&bb_period=${document.getElementById("bbPeriod").value}`;
    params += `&bb_std=${document.getElementById("bbStd").value}`;
    params += `&bb_use_tp=${document.getElementById("bbUseTp").checked}`;
    params += `&bb_tp=${parseFloat(document.getElementById("bbTp").value) / 100}`;
    params += `&bb_use_sl=${document.getElementById("bbUseSl").checked}`;
    params += `&bb_sl=${-parseFloat(document.getElementById("bbSl").value) / 100}`;
    params += `&bb_use_middle_exit=${document.getElementById("bbUseMiddleExit").checked}`;
    params += `&bb_volume_filter=${document.getElementById("bbVolumeFilter").checked}`;
    params += `&bb_volume_mult=${document.getElementById("bbVolumeMult").value}`;
    params += `&bb_max_hold_bars=${document.getElementById("bbMaxHoldBars").value}`;
  } else if (strategy === "TURTLE_TRADING") {
    const v = id => document.getElementById(id).value;
    const c = id => document.getElementById(id).checked;
    params += `&tt_system=${v("ttSystem")}`;
    params += `&tt_entry_period=${v("ttEntryPeriod")}`;
    params += `&tt_exit_period=${v("ttExitPeriod")}`;
    params += `&tt_failsafe_period=${v("ttFailsafePeriod")}`;
    params += `&tt_use_skip=${c("ttUseSkip")}`;
    params += `&tt_atr_period=${v("ttAtrPeriod")}`;
    // 화면의 % 값은 서버에서 비율(0.01 = 1%)로 쓴다
    params += `&tt_risk_pct=${parseFloat(v("ttRiskPct")) / 100}`;
    params += `&tt_add_step=${v("ttAddStep")}`;
    params += `&tt_max_units=${v("ttMaxUnits")}`;
    params += `&tt_stop_n=${v("ttStopN")}`;
    params += `&tt_use_dd_rule=${c("ttUseDdRule")}`;
    params += `&tt_dd_trigger=${parseFloat(v("ttDdTrigger")) / 100}`;
    params += `&tt_dd_reduce=${parseFloat(v("ttDdReduce")) / 100}`;
    params += `&tt_ma1_filter=${c("ttMa1Filter")}`;
    params += `&tt_ma1_period=${v("ttMa1Period")}`;
    params += `&tt_ma2_filter=${c("ttMa2Filter")}`;
    params += `&tt_ma2_period=${v("ttMa2Period")}`;
    params += `&tt_vwma_filter=${c("ttVwmaFilter")}`;
    params += `&tt_vwma_period=${v("ttVwmaPeriod")}`;
    params += `&tt_volume_filter=${c("ttVolumeFilter")}`;
    params += `&tt_volume_mult=${v("ttVolumeMult")}`;
  }
  return params;
}
