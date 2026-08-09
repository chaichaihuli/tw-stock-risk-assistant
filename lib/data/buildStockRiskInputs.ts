import type { CalculateStockRiskScoreInput } from "@/lib/risk/stockRiskScore";
import {
  fetchFundamentalData,
  fetchPriceData,
  fetchSectorRelativePerformance,
  fetchStockBasicInfo,
  fetchVix,
} from "./yahooFinance";

/**
 * 組合個股風險計算所需的所有輸入。價格、基本面、VIX、產業 ETF 相對表現皆來自
 * Yahoo Finance（見 lib/data/yahooFinance.ts）。
 *
 * 台股版 v1 尚未接上新聞來源與台灣總經指標（Finnhub／FRED 對台股支援不足，見
 * CLAUDE.md「明確排除在 v1 之外」）：news 固定回傳空陣列，sentimentEvent 因子
 * 因此會透過 missingFactors 以中性值代入；macroIndicators 固定為 null，
 * lib/risk/macroSector.ts 只會用到 vix 這個子指標。
 *
 * 產業 ETF 相對表現：優先用 SECTOR_ETF_MAP 對應的產業 ETF，查無對應時
 * 回退用個股自己相對大盤（0050.TW）的近期報酬率，盡量保留這個因子的訊號。
 */
export async function buildStockRiskInputs(
  ticker: string
): Promise<CalculateStockRiskScoreInput> {
  const [priceData, fundamentalData, basicInfo, vix] = await Promise.all([
    fetchPriceData(ticker),
    fetchFundamentalData(ticker),
    fetchStockBasicInfo(ticker),
    fetchVix(),
  ]);

  const sectorPerf = await fetchSectorRelativePerformance(basicInfo.sector, ticker);

  return {
    ticker,
    priceData,
    fundamentalData,
    news: [],
    macro: {
      macroIndicators: null,
      vix,
      sectorRelativePerformance: sectorPerf?.relativeReturnPct ?? null,
    },
  };
}
