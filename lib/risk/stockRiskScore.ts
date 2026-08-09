import type { FactorScore, StockRiskBreakdown, StockRiskScore } from "@/types/risk";
import type { FundamentalData, NewsItem, PriceData } from "@/types/market";
import { STOCK_RISK_CATEGORY_WEIGHTS } from "./constants";
import { scoreVolatility } from "./volatility";
import { scoreFundamental } from "./fundamental";
import { scoreValuationQuality } from "./valuationQuality";
import { scoreSentimentEvent } from "./sentimentEvent";
import { scoreMacroSector, type MacroSectorInput } from "./macroSector";

export interface CalculateStockRiskScoreInput {
  ticker: string;
  priceData: PriceData;
  fundamentalData: FundamentalData;
  /** 近期（建議近 14 天）已附情緒分數的新聞列表 */
  news: NewsItem[];
  /** 尚未有產業風險資料源前為選填，缺省時 macroSector 類別會以中性分數代入 */
  macro?: MacroSectorInput;
}

/**
 * 計算個股綜合風險分數：五大類別各自計算後，依固定權重加權平均。
 * 任一類別因資料缺失以中性值（50分）代入時，會累積在 missingFactors 中，
 * 供呼叫端提示使用者本次分數的可信度可能受影響。
 */
export function calculateStockRiskScore(
  input: CalculateStockRiskScoreInput
): StockRiskScore {
  const volatility = scoreVolatility(input.priceData);
  const fundamental = scoreFundamental(input.fundamentalData);
  const valuationQuality = scoreValuationQuality(input.fundamentalData);
  const sentimentEvent = scoreSentimentEvent(input.news);
  const macroSector = scoreMacroSector(
    input.macro ?? {
      macroIndicators: null,
      vix: null,
      sectorRelativePerformance: null,
    }
  );

  const breakdown: StockRiskBreakdown = {
    volatility: volatility.score,
    fundamental: fundamental.score,
    valuationQuality: valuationQuality.score,
    sentimentEvent: sentimentEvent.score,
    macroSector: macroSector.score,
  };

  // 五大類別依 constants.ts 中的固定權重加權平均（權重總和為 1）
  const score =
    breakdown.volatility * STOCK_RISK_CATEGORY_WEIGHTS.volatility +
    breakdown.fundamental * STOCK_RISK_CATEGORY_WEIGHTS.fundamental +
    breakdown.valuationQuality * STOCK_RISK_CATEGORY_WEIGHTS.valuationQuality +
    breakdown.sentimentEvent * STOCK_RISK_CATEGORY_WEIGHTS.sentimentEvent +
    breakdown.macroSector * STOCK_RISK_CATEGORY_WEIGHTS.macroSector;

  const factors: FactorScore[] = [
    ...volatility.factors,
    ...fundamental.factors,
    ...valuationQuality.factors,
    ...sentimentEvent.factors,
    ...macroSector.factors,
  ];

  const missingFactors = [
    ...volatility.missingFactors,
    ...fundamental.missingFactors,
    ...valuationQuality.missingFactors,
    ...sentimentEvent.missingFactors,
    ...macroSector.missingFactors,
  ];

  return {
    ticker: input.ticker,
    score: Math.round(score * 100) / 100,
    breakdown,
    factors,
    calculatedAt: new Date().toISOString(),
    missingFactors,
  };
}
