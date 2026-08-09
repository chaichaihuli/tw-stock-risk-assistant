import YahooFinance from "yahoo-finance2";
import type {
  SearchQuoteYahooEquity,
  SearchQuoteYahooETF,
} from "yahoo-finance2/modules/search";
import type {
  FundamentalData,
  PriceData,
  StockBasicInfo,
  StockSearchResult,
} from "@/types/market";
import { CACHE_TTL, getOrSetCache } from "./cache";
import { calculateAnnualizedVolatility, calculateMaxDrawdown } from "./metrics";
import { resolveAliasTicker } from "./stockAliases";

/**
 * yahoo-finance2 是非官方 API（無需金鑰），行為可能隨 Yahoo 網站調整而變動。
 * 因此本專案用它取得報價、歷史股價、基本面等資料，並全部包上快取（見 cache.ts）
 * 以降低呼叫頻率、減少被限流或格式異動影響的機會。
 *
 * 台股代碼格式：上市代碼加 ".TW"（如 "2330.TW" 台積電），上櫃加 ".TWO"（如 "6488.TWO" 環球晶）。
 * 已實測確認 quote/quoteSummary/chart 對台股代碼皆正常回傳資料，跟美股用的是同一套 API。
 */
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const DEFAULT_LOOKBACK_DAYS = 252;

/** 產業相對表現回溯天數，約 3 個月交易日 */
const SECTOR_LOOKBACK_DAYS = 63;

/** 產業相對表現的比較基準（大盤），美股版用 SPY，台股版用元大台灣50 */
const MARKET_BENCHMARK_TICKER = "0050.TW";

/**
 * GICS 產業（Yahoo assetProfile.sector 回傳的字串，台股與美股共用同一套分類）
 * 對應的台股產業 ETF 代碼。
 *
 * 只收錄已實測確認存在且流動性足夠的 ETF；台股沒有像美股 SPDR 那樣完整涵蓋 11 大產業的
 * ETF 產品線，只有 Technology／Financial Services 有明確對應（也是台股市值最集中的兩大產業）。
 * 其餘產業查不到對應 ETF 時，lib/data/buildStockRiskInputs.ts 會回退用大盤基準
 * （0050.TW）計算相對表現，而不是直接放棄這個因子。
 */
const SECTOR_ETF_MAP: Record<string, string> = {
  Technology: "0053.TW", // 元大MSCI台灣電子
  "Financial Services": "0055.TW", // 元大MSCI台灣金融
};

/** 將日期換算為財報季別標籤，例如 2026-05-15 → "2026Q2" */
function toFiscalPeriodLabel(date: Date): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}Q${quarter}`;
}

/** 取得股票基本資料（名稱、產業、市值、交易所、幣別） */
export async function fetchStockBasicInfo(
  ticker: string
): Promise<StockBasicInfo> {
  return getOrSetCache(
    `yahoo:basicInfo:${ticker}`,
    CACHE_TTL.fundamentals,
    async () => {
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ["assetProfile", "price"],
      });

      return {
        ticker,
        name: summary.price?.longName ?? summary.price?.shortName ?? ticker,
        sector: summary.assetProfile?.sector ?? null,
        industry: summary.assetProfile?.industry ?? null,
        marketCap: summary.price?.marketCap ?? null,
        exchange: summary.price?.exchangeName ?? null,
        currency: summary.price?.currency ?? "TWD",
      };
    }
  );
}

/**
 * 取得價格與波動相關資料。
 * currentPrice / changePercent / beta 取自 Yahoo 即時報價；
 * historicalVolatility / maxDrawdown 由 chart 歷史收盤價自行計算（見 metrics.ts），
 * Yahoo 本身不提供這兩個指標的現成數據。
 */
export async function fetchPriceData(
  ticker: string,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<PriceData> {
  return getOrSetCache(
    `yahoo:price:${ticker}:${lookbackDays}`,
    CACHE_TTL.quote,
    async () => {
      const period1 = new Date();
      // 交易日約為日曆天的 5/7，多抓一些天數當緩衝以確保有足夠交易日數量
      period1.setDate(period1.getDate() - Math.ceil(lookbackDays * 1.6));

      const [quote, chartResult, summary] = await Promise.all([
        yahooFinance.quote(ticker),
        yahooFinance.chart(ticker, { period1, interval: "1d" }),
        // quote().beta 經常缺漏，summaryDetail.beta 較穩定，當作備援來源
        yahooFinance.quoteSummary(ticker, { modules: ["summaryDetail"] }),
      ]);

      if (quote.regularMarketPrice === undefined) {
        throw new Error(`Yahoo Finance 未回傳 ${ticker} 的即時價格`);
      }

      const closes = chartResult.quotes
        .map((q) => q.adjclose ?? q.close)
        .filter((c): c is number => c !== null)
        .slice(-lookbackDays);

      return {
        ticker,
        currentPrice: quote.regularMarketPrice,
        changePercent: quote.regularMarketChangePercent ?? null,
        historicalVolatility: calculateAnnualizedVolatility(closes),
        beta: quote.beta ?? summary.summaryDetail?.beta ?? null,
        maxDrawdown: calculateMaxDrawdown(closes),
        lookbackDays,
        asOf: new Date().toISOString(),
      };
    }
  );
}

/**
 * 取得計算利息保障倍數與自由現金流利潤率所需的原始數字（EBIT、利息費用、自由現金流、營收）。
 *
 * quoteSummary 的 incomeStatementHistory 模組自 2024 年 11 月起幾乎不回傳資料
 * （yahoo-finance2 呼叫時會直接印出官方提示改用 fundamentalsTimeSeries），改用這個模組
 * 取最近一個年度的數據；用 module: "all" 一次拿齊財報三表，比分開呼叫省一次網路請求。
 * 已實測 2330.TW／2317.TW／2454.TW／6488.TWO 都能正常回傳 EBIT 與利息費用。
 * 任一數值缺失或整體抓取失敗時回傳全 null，不拋出例外——呼叫端會走既有的缺失值代入機制。
 */
async function fetchIncomeAndCashFlowSnapshot(ticker: string): Promise<{
  ebit: number | null;
  interestExpense: number | null;
  freeCashFlow: number | null;
  totalRevenue: number | null;
}> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 2);

    const rows = await yahooFinance.fundamentalsTimeSeries(ticker, {
      period1,
      type: "annual",
      module: "all",
    });
    const last = rows[rows.length - 1];
    // module: "all" 回傳的每一筆 TYPE 都是 "ALL"，但函式簽章的回傳型別是
    // BalanceSheet|CashFlow|Financials|All 的聯合，TS 無法從執行期字串參數靜態窄化，
    // 需要用 TYPE 判斷才能存取合併後才有的欄位（EBIT、interestExpense 等）。
    const latest = last?.TYPE === "ALL" ? last : undefined;

    return {
      ebit: latest?.EBIT ?? null,
      interestExpense: latest?.interestExpense ?? null,
      freeCashFlow: latest?.freeCashFlow ?? null,
      totalRevenue: latest?.totalRevenue ?? null,
    };
  } catch {
    return { ebit: null, interestExpense: null, freeCashFlow: null, totalRevenue: null };
  }
}

/**
 * 取得基本面資料。debtToEquity / currentRatio / revenueGrowthYoy 取自 Yahoo 的
 * financialData 模組，peRatio 取自 summaryDetail，interestCoverageRatio 與
 * freeCashFlowMargin 則由 fetchIncomeAndCashFlowSnapshot 取得的 EBIT／利息費用／
 * 自由現金流／營收換算而來（見該函式註解）。
 */
export async function fetchFundamentalData(
  ticker: string
): Promise<FundamentalData> {
  return getOrSetCache(
    `yahoo:fundamentals:${ticker}`,
    CACHE_TTL.fundamentals,
    async () => {
      const [summary, incomeCashFlow] = await Promise.all([
        yahooFinance.quoteSummary(ticker, {
          modules: ["financialData", "summaryDetail", "defaultKeyStatistics"],
        }),
        fetchIncomeAndCashFlowSnapshot(ticker),
      ]);

      const financialData = summary.financialData;
      const mostRecentQuarter = summary.defaultKeyStatistics?.mostRecentQuarter;

      // 利息保障倍數 = EBIT / 利息費用；利息費用缺失或 <= 0（無意義的除法基準）時視為缺失，
      // 不強行代入極端值。
      const interestCoverageRatio =
        incomeCashFlow.ebit !== null &&
        incomeCashFlow.interestExpense !== null &&
        incomeCashFlow.interestExpense > 0
          ? incomeCashFlow.ebit / incomeCashFlow.interestExpense
          : null;

      // 自由現金流利潤率 = 自由現金流 / 營收 * 100；營收缺失時視為缺失，
      // lib/risk/fundamental.ts 會退回只看 freeCashFlow 正負號的粗略判斷。
      const freeCashFlowMargin =
        incomeCashFlow.freeCashFlow !== null &&
        incomeCashFlow.totalRevenue !== null &&
        incomeCashFlow.totalRevenue > 0
          ? (incomeCashFlow.freeCashFlow / incomeCashFlow.totalRevenue) * 100
          : null;

      return {
        ticker,
        // Yahoo 回傳的 debtToEquity 是「原始比率 * 100」（例如 78.445 代表 D/E = 0.78445），
        // 與 currentRatio 等其他比率欄位的單位不一致，這裡除以 100 還原成原始比率，
        // 讓 lib/risk/fundamental.ts 的 linearScore(de, 0, 2) 換算基準保持一致。
        debtToEquity:
          financialData?.debtToEquity != null
            ? financialData.debtToEquity / 100
            : null,
        interestCoverageRatio,
        currentRatio: financialData?.currentRatio ?? null,
        // 優先用 fundamentalsTimeSeries 的數字（跟 freeCashFlowMargin 同一來源、口徑一致），
        // 抓不到時退回 quoteSummary 的 financialData.freeCashflow 當備援
        freeCashFlow: incomeCashFlow.freeCashFlow ?? financialData?.freeCashflow ?? null,
        freeCashFlowMargin,
        peRatio: summary.summaryDetail?.trailingPE ?? null,
        // Yahoo 回傳的 revenueGrowth 為小數比例（如 0.05 代表 5%），換算為百分比
        revenueGrowthYoy:
          financialData?.revenueGrowth != null
            ? financialData.revenueGrowth * 100
            : null,
        fiscalPeriod: mostRecentQuarter
          ? toFiscalPeriodLabel(mostRecentQuarter)
          : null,
        reportedAt: mostRecentQuarter?.toISOString() ?? null,
      };
    }
  );
}

/**
 * 取得 VIX 恐慌指數目前水準；抓取失敗或查無資料時回傳 null（不拋出例外）。
 *
 * 台股沒有找到公開、穩定可用的自有波動率指數資料源，v1 沿用全球 CBOE VIX 作為市場
 * 恐慌情緒的代理指標——台股是高度出口導向、與美股連動性強的市場，VIX 仍有參考意義，
 * 但屬於近似值，見 CLAUDE.md「明確排除在 v1 之外」。
 */
export async function fetchVix(): Promise<number | null> {
  try {
    return await getOrSetCache("yahoo:vix", CACHE_TTL.quote, async () => {
      const quote = await yahooFinance.quote("^VIX");
      return quote.regularMarketPrice ?? null;
    });
  } catch {
    return null;
  }
}

/** 計算某檔標的近 lookbackDays 個交易日的報酬率（百分比）；資料不足時回傳 null */
async function fetchTrailingReturnPct(
  ticker: string,
  lookbackDays: number
): Promise<number | null> {
  const period1 = new Date();
  period1.setDate(period1.getDate() - Math.ceil(lookbackDays * 1.6));

  const chartResult = await yahooFinance.chart(ticker, { period1, interval: "1d" });
  const closes = chartResult.quotes
    .map((q) => q.adjclose ?? q.close)
    .filter((c): c is number => c !== null)
    .slice(-lookbackDays);

  if (closes.length < 2 || closes[0] <= 0) return null;

  return ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
}

/**
 * 依 GICS 產業取得對應台股產業 ETF 相對大盤（0050.TW）近 ~3 個月的超額報酬（百分點）。
 * 查無對應 ETF 時（見 SECTOR_ETF_MAP 註解，只涵蓋 Technology／Financial Services）
 * 回退直接比較個股本身相對大盤的超額報酬，盡量保留這個因子的訊號而不是直接回傳 null。
 * sector 為 null 或抓取失敗時回傳 null（不拋出例外）。
 */
export async function fetchSectorRelativePerformance(
  sector: string | null,
  fallbackTicker?: string
): Promise<{ etf: string; relativeReturnPct: number } | null> {
  if (!sector) return null;
  const etf = SECTOR_ETF_MAP[sector] ?? fallbackTicker;
  if (!etf) return null;

  try {
    return await getOrSetCache(
      `yahoo:sectorPerf:${etf}`,
      CACHE_TTL.chart,
      async () => {
        const [sectorReturn, benchmarkReturn] = await Promise.all([
          fetchTrailingReturnPct(etf, SECTOR_LOOKBACK_DAYS),
          fetchTrailingReturnPct(MARKET_BENCHMARK_TICKER, SECTOR_LOOKBACK_DAYS),
        ]);

        if (sectorReturn === null || benchmarkReturn === null) return null;

        return { etf, relativeReturnPct: sectorReturn - benchmarkReturn };
      }
    );
  } catch {
    return null;
  }
}

/** 搜尋結果最多回傳幾筆，避免清單過長 */
const SEARCH_RESULT_LIMIT = 8;

/**
 * 依公司名稱或關鍵字搜尋股票，回傳可能的匹配清單（代碼、名稱、交易所）。
 *
 * Yahoo Finance 的搜尋 API 對中文查詢會直接回傳錯誤（已實測確認），所以先透過
 * stockAliases.ts 的中文別名表比對，命中就轉換成代碼後再查，讓「台積電」「聯發科」
 * 這類中文關鍵字也能查到對應股票。
 *
 * 只保留 EQUITY／ETF 類型的結果（濾掉期貨、貨幣、選擇權等不適用本系統風險評分的類型）。
 */
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const aliasTicker = resolveAliasTicker(trimmed);
  const searchTerm = aliasTicker ?? trimmed;

  return getOrSetCache(
    `yahoo:search:${searchTerm.toLowerCase()}`,
    CACHE_TTL.search,
    async () => {
      const result = await yahooFinance.search(searchTerm, {
        quotesCount: SEARCH_RESULT_LIMIT,
      });

      const matches: StockSearchResult[] = result.quotes
        .filter(
          (q): q is SearchQuoteYahooEquity | SearchQuoteYahooETF =>
            "quoteType" in q && (q.quoteType === "EQUITY" || q.quoteType === "ETF")
        )
        .map((q) => ({
          ticker: q.symbol,
          name: q.longname ?? q.shortname ?? q.symbol,
          exchange: q.exchDisp ?? null,
        }));

      // 別名命中時，把該代碼排到最前面
      if (aliasTicker) {
        matches.sort((a, b) => {
          if (a.ticker === aliasTicker) return -1;
          if (b.ticker === aliasTicker) return 1;
          return 0;
        });
      }

      return matches.slice(0, SEARCH_RESULT_LIMIT);
    }
  );
}
