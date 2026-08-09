import type { StockRiskBreakdown, StockRiskScore } from "@/types/risk";

const CATEGORY_LABEL: Record<keyof StockRiskBreakdown, string> = {
  volatility: "波動度",
  fundamental: "基本面",
  valuationQuality: "估值品質",
  sentimentEvent: "新聞情緒",
  macroSector: "總經/產業",
};

function overallRiskLabel(score: number): string {
  if (score >= 70) return "偏高";
  if (score >= 40) return "中等";
  return "偏低";
}

/**
 * 依綜合分數與五大類別明細，組出一段白話說明，點出主要風險來源，
 * 讓使用者不用自己逐項比對 breakdown 數字。
 */
export function explainStockRisk(result: StockRiskScore): string {
  const entries = Object.entries(result.breakdown) as [keyof StockRiskBreakdown, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const topCategories = sorted.slice(0, 2).map(([key]) => CATEGORY_LABEL[key]);

  let text = `${result.ticker} 的整體風險程度${overallRiskLabel(result.score)}（${result.score.toFixed(
    1
  )} / 100），主要風險來源為${topCategories.join("與")}。`;

  if (result.missingFactors.length > 0) {
    text += ` 有部分資料缺失（${result.missingFactors.join(
      "、"
    )}），以中性值代入計算，實際風險可能與顯示分數有落差。`;
  }

  return text;
}
