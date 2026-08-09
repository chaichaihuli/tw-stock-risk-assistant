import type { FactorScore } from "@/types/risk";
import type { FundamentalData } from "@/types/market";
import { linearScore, weightedAverageSkipMissing, type CategoryScoreResult } from "./utils";

const WEIGHTS = {
  debtToEquity: 0.35,
  interestCoverageRatio: 0.3,
  currentRatio: 0.2,
  freeCashFlowSign: 0.15,
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

  // 自由現金流僅取正負號作粗略風險訊號（轉負代表財務壓力升高）。
  // TODO: 待資料中補上營收欄位後，改用 FCF Margin 取代此二元判斷。
  const fcfScore =
    data.freeCashFlow === null ? null : data.freeCashFlow < 0 ? 80 : 20;
  if (fcfScore === null) missingFactors.push("freeCashFlow");

  const score = weightedAverageSkipMissing([
    { value: deScore, weight: WEIGHTS.debtToEquity },
    { value: icrScore, weight: WEIGHTS.interestCoverageRatio },
    { value: crScore, weight: WEIGHTS.currentRatio },
    { value: fcfScore, weight: WEIGHTS.freeCashFlowSign },
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
      name: "free_cash_flow_sign",
      score: fcfScore ?? 50,
      weight: WEIGHTS.freeCashFlowSign,
      description:
        fcfScore === null
          ? "缺少自由現金流資料，以中性 50 分代入"
          : `自由現金流為${data.freeCashFlow! < 0 ? "負" : "正"}，作為粗略風險訊號`,
    },
  ];

  return { score, factors, missingFactors };
}
