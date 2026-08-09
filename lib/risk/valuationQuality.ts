import type { FactorScore } from "@/types/risk";
import type { FundamentalData } from "@/types/market";
import { clamp, linearScore, weightedAverageSkipMissing, type CategoryScoreResult } from "./utils";

const WEIGHTS = {
  peRatio: 0.75,
  revenueGrowthYoy: 0.25,
} as const;

/**
 * 估值品質風險：股價相對獲利是否過度昂貴、營收動能是成長還是衰退。
 *
 * peRatio 權重刻意設得比 revenueGrowthYoy 高很多（0.75 vs 0.25，原本是各半）。
 * 原本 50/50 平均會讓「本益比再誇張，只要成長率夠高就能完全洗白」：例如本益比 150
 * 跟本益比 1000，只要營收成長都超過 50%，兩者算出來的估值風險完全一樣（都是 50 分），
 * 這顯然不合理——極端本益比本身就是風險（估值倍數壓縮風險），成長只能部分緩解，
 * 不該讓它被完全抵銷。調高 peRatio 權重後，growth 依然能降低風險分數，但無法讓
 * 一支本益比破百的股票被算成「估值普通」。
 */
export function scoreValuationQuality(
  data: FundamentalData
): CategoryScoreResult {
  const missingFactors: string[] = [];

  // 本益比：<=0（無獲利）視為高風險估值；15 視為合理基準（0分附近）；
  // 60 以上視為過度昂貴的高風險估值（100分）
  let peScore: number | null;
  if (data.peRatio === null) {
    peScore = null;
  } else if (data.peRatio <= 0) {
    peScore = 100;
  } else {
    peScore = linearScore(data.peRatio, 15, 60);
  }
  if (peScore === null) missingFactors.push("peRatio");

  // 營收年增率：0% 為中性基準（50分），成長越快風險越低，衰退越快風險越高
  const growthScore =
    data.revenueGrowthYoy === null
      ? null
      : clamp(50 - data.revenueGrowthYoy, 0, 100);
  if (growthScore === null) missingFactors.push("revenueGrowthYoy");

  const score = weightedAverageSkipMissing([
    { value: peScore, weight: WEIGHTS.peRatio },
    { value: growthScore, weight: WEIGHTS.revenueGrowthYoy },
  ]);

  const factors: FactorScore[] = [
    {
      name: "pe_ratio",
      score: peScore ?? 50,
      weight: WEIGHTS.peRatio,
      description:
        peScore === null
          ? "缺少本益比資料，以中性 50 分代入"
          : data.peRatio! <= 0
            ? "本益比為負或無獲利，視為高風險估值"
            : `本益比 ${data.peRatio} 相對合理區間換算風險分數`,
    },
    {
      name: "revenue_growth_yoy",
      score: growthScore ?? 50,
      weight: WEIGHTS.revenueGrowthYoy,
      description:
        growthScore === null
          ? "缺少營收年增率資料，以中性 50 分代入"
          : `營收年增率 ${data.revenueGrowthYoy}% 換算風險分數`,
    },
  ];

  return { score, factors, missingFactors };
}
