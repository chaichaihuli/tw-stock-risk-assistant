/**
 * 推薦功能用的候選股票池：以台股大型權值股（0050 成分股為主）涵蓋主要產業，
 * 方便驗證 lib/risk/macroSector.ts 的產業 ETF 對照是否涵蓋齊全。
 * 之後如果要接股票篩選器或更大的資料庫，只需要替換這裡的來源，
 * 呼叫端（lib/recommend.ts，尚未實作）不用改。
 */
export const CANDIDATE_TICKERS: string[] = [
  // 半導體 / 電子科技
  "2330.TW", // 台積電
  "2454.TW", // 聯發科
  "2303.TW", // 聯電
  "3711.TW", // 日月光投控
  "2308.TW", // 台達電
  "2382.TW", // 廣達
  "2357.TW", // 華碩
  "2327.TW", // 國巨
  // 電子代工 / 硬體
  "2317.TW", // 鴻海
  "4938.TW", // 和碩
  "2353.TW", // 宏碁
  "2324.TW", // 仁寶
  // 金融
  "2881.TW", // 富邦金
  "2882.TW", // 國泰金
  "2891.TW", // 中信金
  "2884.TW", // 玉山金
  "2886.TW", // 兆豐金
  "2892.TW", // 第一金
  // 傳產 / 原物料
  "1301.TW", // 台塑
  "1303.TW", // 南亞
  "2002.TW", // 中鋼
  "1101.TW", // 台泥
  // 電信
  "2412.TW", // 中華電
  "3045.TW", // 台灣大
  "4904.TW", // 遠傳
  // 汽車 / 運輸
  "2207.TW", // 和泰車
  "2603.TW", // 長榮
  "2609.TW", // 陽明
  "2615.TW", // 萬海
  // 光學 / 精密
  "3008.TW", // 大立光
  // 上櫃補充（測試 .TWO 代碼）
  "6488.TWO", // 環球晶
];

/** 每批預設幾支股票 */
export const CANDIDATE_BATCH_SIZE = CANDIDATE_TICKERS.length;

/**
 * 依「已經看過的股票代碼」從候選池挑下一批沒看過的。
 * 池子剩下的不夠一批時，用剩下的補滿，不足的部分從頭開始循環使用整個池子。
 */
export function pickNextBatch(
  excludeTickers: string[] = [],
  batchSize: number = CANDIDATE_BATCH_SIZE
): string[] {
  // excludeTickers 來自 API 請求的 body，屬於系統邊界輸入，防禦性過濾掉非字串項目
  const excludeSet = new Set(
    excludeTickers
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toUpperCase())
  );
  const remaining = CANDIDATE_TICKERS.filter((t) => !excludeSet.has(t));

  if (remaining.length >= batchSize) {
    return remaining.slice(0, batchSize);
  }

  const remainingSet = new Set(remaining);
  const wrapped = CANDIDATE_TICKERS.filter((t) => !remainingSet.has(t));
  return [...remaining, ...wrapped].slice(0, batchSize);
}
