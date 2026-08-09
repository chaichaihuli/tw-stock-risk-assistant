import type { CalculateStockRiskScoreInput } from "@/lib/risk/stockRiskScore";
import type { MacroIndicators } from "@/types/market";
import { fetchPolicyRate } from "./cbc";
import { fetchUnemploymentRate } from "./dgbas";
import {
  fetchFundamentalData,
  fetchPriceData,
  fetchSectorRelativePerformance,
  fetchStockBasicInfo,
  fetchVix,
} from "./yahooFinance";

/**
 * 組合個股風險計算所需的所有輸入。價格、基本面、VIX、產業 ETF 相對表現皆來自
 * Yahoo Finance（見 lib/data/yahooFinance.ts）；政策利率取自央行、失業率取自
 * 主計總處（見 lib/data/cbc.ts、lib/data/dgbas.ts）。
 *
 * 台股版 v1 尚未接上新聞來源（Finnhub 對台股支援不足，見 CLAUDE.md「明確排除在
 * v1 之外」）：news 固定回傳空陣列，sentimentEvent 因子因此會透過 missingFactors
 * 以中性值代入。10 年期公債殖利率利差同樣還沒有可靠的官方即時資料源，
 * treasuryYield10Y 固定為 null，對應子指標一樣會以中性值代入。
 *
 * 產業 ETF 相對表現：優先用 SECTOR_ETF_MAP 對應的產業 ETF，查無對應時
 * 回退用個股自己相對大盤（0050.TW）的近期報酬率，盡量保留這個因子的訊號。
 */
export async function buildStockRiskInputs(
  ticker: string
): Promise<CalculateStockRiskScoreInput> {
  const [priceData, fundamentalData, basicInfo, vix, policyRate, unemploymentRate] =
    await Promise.all([
      fetchPriceData(ticker),
      fetchFundamentalData(ticker),
      fetchStockBasicInfo(ticker),
      fetchVix(),
      fetchPolicyRate(),
      fetchUnemploymentRate(),
    ]);

  const sectorPerf = await fetchSectorRelativePerformance(basicInfo.sector, ticker);

  const macroIndicators: MacroIndicators = {
    policyRate: { seriesId: "cbc:rediscountRate", ...policyRate, error: null },
    treasuryYield10Y: {
      seriesId: "tw:10yGovBondYield",
      value: null,
      date: null,
      error: null,
    },
    unemploymentRate: {
      seriesId: "dgbas:unemploymentRate",
      ...unemploymentRate,
      error: null,
    },
    fetchedAt: new Date().toISOString(),
  };

  return {
    ticker,
    priceData,
    fundamentalData,
    news: [],
    macro: {
      macroIndicators,
      vix,
      sectorRelativePerformance: sectorPerf?.relativeReturnPct ?? null,
    },
  };
}
