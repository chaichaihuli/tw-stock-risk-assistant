import type { StockRiskBreakdown, StockRiskScore } from "@/types/risk";

export interface PortfolioHoldingInput {
  ticker: string;
  /** 原始權重，不需要先正規化成總和 1（例如可以直接輸入 40 / 30 / 30） */
  weight: number;
  stockRiskScore: StockRiskScore;
}

export interface PortfolioHoldingResult {
  ticker: string;
  weight: number;
  /** 依有效持股權重總和正規化後的權重，總和為 1 */
  normalizedWeight: number;
  score: number;
}

export interface PortfolioRiskResult {
  /** 組合綜合風險分數，0-100，各持股依正規化權重加權平均 */
  score: number;
  /** 各風險類別的加權平均明細，供視覺化重用 RiskBreakdownChart */
  breakdown: StockRiskBreakdown;
  holdings: PortfolioHoldingResult[];
}

const BREAKDOWN_KEYS: (keyof StockRiskBreakdown)[] = [
  "volatility",
  "fundamental",
  "valuationQuality",
  "sentimentEvent",
  "macroSector",
];

/**
 * 依權重加權平均多檔個股的風險分數與各類別明細，組成投資組合層級的風險分數。
 * 權重 <= 0（或非數字）的列視為無效持股予以忽略；全部持股都無效或權重總和為 0 時回傳 null，
 * 由呼叫端決定要顯示什麼提示（缺失值處理，而非硬算出一個誤導性的分數）。
 */
export function calculatePortfolioRisk(
  holdings: PortfolioHoldingInput[]
): PortfolioRiskResult | null {
  const validHoldings = holdings.filter(
    (h) => Number.isFinite(h.weight) && h.weight > 0
  );
  const totalWeight = validHoldings.reduce((sum, h) => sum + h.weight, 0);
  if (validHoldings.length === 0 || totalWeight <= 0) return null;

  const holdingResults: PortfolioHoldingResult[] = validHoldings.map((h) => ({
    ticker: h.ticker,
    weight: h.weight,
    normalizedWeight: h.weight / totalWeight,
    score: h.stockRiskScore.score,
  }));

  const score = holdingResults.reduce(
    (sum, h) => sum + h.score * h.normalizedWeight,
    0
  );

  const breakdown = BREAKDOWN_KEYS.reduce((acc, key) => {
    acc[key] = validHoldings.reduce(
      (sum, h) => sum + h.stockRiskScore.breakdown[key] * (h.weight / totalWeight),
      0
    );
    return acc;
  }, {} as StockRiskBreakdown);

  return {
    score: Math.round(score * 100) / 100,
    breakdown,
    holdings: holdingResults,
  };
}
