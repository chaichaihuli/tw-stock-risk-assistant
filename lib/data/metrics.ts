/**
 * 由歷史價格序列計算風險指標的純函式。不涉及任何外部 API 呼叫，
 * 方便獨立測試，也讓 yahooFinance.ts 只需專注於資料抓取與型別轉換。
 */

/** 由收盤價序列計算逐日對數報酬率；價格為 0 或負值的異常資料點會被跳過 */
export function calculateDailyLogReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

/**
 * 年化歷史波動率（百分比）。
 * 以每日對數報酬率的樣本標準差，乘上 sqrt(252)（一年約 252 個交易日）年化後轉為百分比。
 * 可用資料點不足 2 天（無法計算標準差）時回傳 null，交由呼叫端視為缺失值處理。
 */
export function calculateAnnualizedVolatility(
  closes: number[]
): number | null {
  const returns = calculateDailyLogReturns(closes);
  if (returns.length < 2) return null;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (returns.length - 1);
  const dailyStdDev = Math.sqrt(variance);

  return dailyStdDev * Math.sqrt(252) * 100;
}

/**
 * 回溯期間內的最大回撤比例（0-1）：從任一高點到其後最低點的最大跌幅。
 * 可用資料點不足 2 天時回傳 null。
 */
export function calculateMaxDrawdown(closes: number[]): number | null {
  if (closes.length < 2) return null;

  let peak = closes[0];
  let maxDrawdown = 0;

  for (const price of closes) {
    if (price > peak) peak = price;
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}
