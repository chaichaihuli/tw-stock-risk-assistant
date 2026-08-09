import type { FactorScore } from "@/types/risk";
import type { FundamentalData } from "@/types/market";
import { linearScore, weightedAverageSkipMissing, type CategoryScoreResult } from "./utils";

const WEIGHTS = {
  debtToEquity: 0.35,
  interestCoverageRatio: 0.3,
  currentRatio: 0.2,
  freeCashFlow: 0.15,
} as const;

/**
 * 基本面（財務體質）風險：負債槓桿、償債能力、短期流動性、現金流方向。
 */
export function scoreFundamental(data: FundamentalData): CategoryScoreResult {
  const missingFactors: string[] = [];

  // 負債權益比：0 視為無槓桿風險（0分），2 以上視為高槓桿風險（100分）
  const deScore =
    data.debtToEquity === null ? null : linearScore(data.debtToEquity, 0, 2);
  if (deScore === null) missingFactors.push("debtToEquity");

  // 利息保障倍數：越低代表償債風險越高，故用 100 - linearScore 反轉；
  // >=8 視為安全（0分），<=1 視為高風險（100分）
  const icrScore =
    data.interestCoverageRatio === null
      ? null
      : 100 - linearScore(data.interestCoverageRatio, 1, 8);
  if (icrScore === null) missingFactors.push("interestCoverageRatio");

  // 流動比率：越低代表短期償債風險越高；>=2 視為安全（0分），<=1 視為高風險（100分）
  const crScore =
    data.currentRatio === null
      ? null
      : 100 - linearScore(data.currentRatio, 1, 2);
  if (crScore === null) missingFactors.push("currentRatio");

  // 自由現金流利潤率（FCF / 營收）：-20% 視為嚴重燒錢的高風險（100分），
  // +20% 視為健康的低風險（0分附近）。缺少營收資料時退回只看 freeCashFlow 正負號的
  // 粗略判斷（轉負代表財務壓力升高），兩者都缺才算真的缺失。
  let fcfScore: number | null;
  if (data.freeCashFlowMargin !== null) {
    fcfScore = linearScore(-data.freeCashFlowMargin, -20, 20);
  } else if (data.freeCashFlow !== null) {
    fcfScore = data.freeCashFlow < 0 ? 80 : 20;
  } else {
    fcfScore = null;
  }
  if (fcfScore === null) missingFactors.push("freeCashFlow");

  const score = weightedAverageSkipMissing([
    { value: deScore, weight: WEIGHTS.debtToEquity },
    { value: icrScore, weight: WEIGHTS.interestCoverageRatio },
    { value: crScore, weight: WEIGHTS.currentRatio },
    { value: fcfScore, weight: WEIGHTS.freeCashFlow },
  ]);

  const factors: FactorScore[] = [
    {
      name: "debt_to_equity",
      score: deScore ?? 50,
      weight: WEIGHTS.debtToEquity,
      description:
        deScore === null
          ? "缺少負債權益比資料，以中性 50 分代入"
          : `負債權益比 ${data.debtToEquity} 換算風險分數`,
    },
    {
      name: "interest_coverage_ratio",
      score: icrScore ?? 50,
      weight: WEIGHTS.interestCoverageRatio,
      description:
        icrScore === null
          ? "缺少利息保障倍數資料，以中性 50 分代入"
          : `利息保障倍數 ${data.interestCoverageRatio} 換算風險分數`,
    },
    {
      name: "current_ratio",
      score: crScore ?? 50,
      weight: WEIGHTS.currentRatio,
      description:
        crScore === null
          ? "缺少流動比率資料，以中性 50 分代入"
          : `流動比率 ${data.currentRatio} 換算風險分數`,
    },
    {
      name: "free_cash_flow",
      score: fcfScore ?? 50,
      weight: WEIGHTS.freeCashFlow,
      description:
        fcfScore === null
          ? "缺少自由現金流資料，以中性 50 分代入"
          : data.freeCashFlowMargin !== null
            ? `自由現金流利潤率 ${data.freeCashFlowMargin.toFixed(1)}% 換算風險分數`
            : `缺少營收資料，退回只看自由現金流為${data.freeCashFlow! < 0 ? "負" : "正"}的粗略判斷`,
    },
  ];

  return { score, factors, missingFactors };
}
