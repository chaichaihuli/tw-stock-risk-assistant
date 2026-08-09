import type { FactorScore } from "@/types/risk";
import type { PriceData } from "@/types/market";
import { linearScore, weightedAverageSkipMissing, type CategoryScoreResult } from "./utils";

const WEIGHTS = {
  historicalVolatility: 0.4,
  beta: 0.3,
  maxDrawdown: 0.3,
} as const;

/**
 * 波動度風險：綜合歷史波動率、Beta、最大回撤。
 * 三者皆為「數值越大風險越高」，可直接用 linearScore 正向換算。
 */
export function scoreVolatility(data: PriceData): CategoryScoreResult {
  const missingFactors: string[] = [];

  // 年化歷史波動率：10% 視為低風險基準，80% 以上視為高風險
  const volScore =
    data.historicalVolatility === null
      ? null
      : linearScore(data.historicalVolatility, 10, 80);
  if (volScore === null) missingFactors.push("historicalVolatility");

  // Beta：0 視為與大盤無關（低風險），2.5 以上視為高波動（高風險）
  const betaScore = data.beta === null ? null : linearScore(data.beta, 0, 2.5);
  if (betaScore === null) missingFactors.push("beta");

  // 最大回撤（0-1 比例）：0% 對應 0 分，100% 對應 100 分，直接線性映射
  const drawdownScore =
    data.maxDrawdown === null ? null : linearScore(data.maxDrawdown, 0, 1);
  if (drawdownScore === null) missingFactors.push("maxDrawdown");

  const score = weightedAverageSkipMissing([
    { value: volScore, weight: WEIGHTS.historicalVolatility },
    { value: betaScore, weight: WEIGHTS.beta },
    { value: drawdownScore, weight: WEIGHTS.maxDrawdown },
  ]);

  const factors: FactorScore[] = [
    {
      name: "historical_volatility",
      score: volScore ?? 50,
      weight: WEIGHTS.historicalVolatility,
      description:
        volScore === null
          ? "缺少歷史波動率資料，以中性 50 分代入"
          : `年化歷史波動率 ${data.historicalVolatility}% 換算風險分數`,
    },
    {
      name: "beta",
      score: betaScore ?? 50,
      weight: WEIGHTS.beta,
      description:
        betaScore === null
          ? "缺少 Beta 資料，以中性 50 分代入"
          : `Beta ${data.beta} 換算風險分數`,
    },
    {
      name: "max_drawdown",
      score: drawdownScore ?? 50,
      weight: WEIGHTS.maxDrawdown,
      description:
        drawdownScore === null
          ? "缺少最大回撤資料，以中性 50 分代入"
          : `回溯 ${data.lookbackDays} 天最大回撤 ${(
              data.maxDrawdown! * 100
            ).toFixed(1)}% 換算風險分數`,
    },
  ];

  return { score, factors, missingFactors };
}
