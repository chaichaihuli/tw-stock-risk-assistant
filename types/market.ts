/**
 * 市場資料相關型別。
 * 數值欄位在資料無法取得時一律使用 null，不得以 0 或估計值頂替，
 * 避免風險計算誤用缺失值造成分數失真（見 CLAUDE.md 缺失值處理規範）。
 */

/** 資料來源識別，用於標記每筆資料的出處與計算延遲 */
export type DataSource = "yahoo_finance" | "llm_sentiment";

/** 股票搜尋結果，用於「公司名稱／關鍵字搜尋」功能 */
export interface StockSearchResult {
  /** 股票代碼，例如 "2330.TW" */
  ticker: string;
  /** 公司名稱 */
  name: string;
  /** 掛牌交易所；無法取得時為 null */
  exchange: string | null;
}

/** 股票基本資料 */
export interface StockBasicInfo {
  /** 股票代碼，例如 "2330.TW"（上市）或 "6488.TWO"（上櫃） */
  ticker: string;
  /** 公司名稱 */
  name: string;
  /** 產業分類（GICS sector 等） */
  sector: string | null;
  /** 子產業/行業分類 */
  industry: string | null;
  /** 市值（新台幣） */
  marketCap: number | null;
  /** 掛牌交易所 */
  exchange: string | null;
  /** 計價貨幣，預設 "TWD" */
  currency: string;
}

/** 價格與波動相關資料，為 volatility 因子的主要輸入 */
export interface PriceData {
  /** 股票代碼 */
  ticker: string;
  /** 目前價格 */
  currentPrice: number;
  /** 當日漲跌幅，百分比（例如 1.5 代表 +1.5%） */
  changePercent: number | null;
  /** 歷史波動率（年化），百分比 */
  historicalVolatility: number | null;
  /** 相對大盤（0050.TW）的 Beta 值 */
  beta: number | null;
  /** 回溯期間內的最大回撤比例，0-1 */
  maxDrawdown: number | null;
  /** 最大回撤與波動率計算所用的回溯天數 */
  lookbackDays: number;
  /** 本筆價格資料的時間戳（ISO 8601） */
  asOf: string;
}

/** 基本面資料，為 fundamental 與 valuationQuality 因子的主要輸入 */
export interface FundamentalData {
  /** 股票代碼 */
  ticker: string;
  /** 負債權益比（Debt-to-Equity），越高代表財務槓桿風險越高 */
  debtToEquity: number | null;
  /** 利息保障倍數（EBIT / 利息費用），數值越低代表償債風險越高 */
  interestCoverageRatio: number | null;
  /** 流動比率（流動資產 / 流動負債） */
  currentRatio: number | null;
  /** 自由現金流（新台幣） */
  freeCashFlow: number | null;
  /** 本益比 */
  peRatio: number | null;
  /** 營收年增率，百分比 */
  revenueGrowthYoy: number | null;
  /** 財報所屬季度，例如 "2026Q2" */
  fiscalPeriod: string | null;
  /** 財報公布日期（ISO 8601） */
  reportedAt: string | null;
}

/** 新聞項目，為 sentimentEvent 因子的主要輸入。v1 尚未接上台股新聞來源，恆為空陣列，見 CLAUDE.md */
export interface NewsItem {
  /** 新聞標題 */
  title: string;
  /** 新聞來源（如 "工商時報"） */
  source: string;
  /** 發布時間（ISO 8601） */
  publishedAt: string;
  /** 原始連結 */
  url: string;
  /** LLM 情緒分析分數，-1（極負面）到 1（極正面）；尚未分析時為 null */
  sentimentScore: number | null;
  /** 此新聞相關的股票代碼列表 */
  relatedTickers: string[];
}

/** 資料新鮮度標記，附掛於任何抓取結果，供風險計算判斷資料是否過期或可信 */
export interface DataFreshness {
  /** 實際抓取時間（ISO 8601） */
  fetchedAt: string;
  /** 資料來源 */
  source: DataSource;
  /** 資料相對即時市場的延遲分鐘數（例如免費 API 常見的 15 分鐘延遲） */
  delayMinutes: number;
}

/**
 * 單一總經指標的最新觀測值。
 * v1 尚未接上台灣總經資料源（見 CLAUDE.md「明確排除在 v1 之外」），
 * getMacroIndicators() 之類的抓取函式尚未實作，lib/risk/macroSector.ts
 * 傳入 MacroIndicators 時三個欄位固定為 { seriesId, value: null, date: null, error: null }，
 * 讓對應子指標透過既有的 missingFactors 機制以中性值代入，而不是悄悄從公式移除。
 */
export interface MacroIndicatorValue {
  /** 指標代號 */
  seriesId: string;
  /** 觀測值；資料缺失或抓取失敗時為 null */
  value: number | null;
  /** 該觀測值對應的日期（YYYY-MM-DD）；無法取得時為 null */
  date: string | null;
  /** 抓取失敗時的錯誤訊息；成功（含「資料本身缺失」的情況）時為 null */
  error: string | null;
}

/** 整理後的總經指標快照，供 lib/risk/macroSector.ts 使用；v1 台股欄位皆為 null，見上方註解 */
export interface MacroIndicators {
  /** 政策利率（%）；v1 尚無台灣資料源 */
  policyRate: MacroIndicatorValue;
  /** 10 年期公債殖利率（%）；v1 尚無台灣資料源 */
  treasuryYield10Y: MacroIndicatorValue;
  /** 失業率（%）；v1 尚無台灣資料源 */
  unemploymentRate: MacroIndicatorValue;
  /** 本次抓取時間（ISO 8601） */
  fetchedAt: string;
}
