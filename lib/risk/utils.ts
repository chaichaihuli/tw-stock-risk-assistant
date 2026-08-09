import type { FactorScore } from "@/types/risk";

/** 將數值限制在 [min, max] 區間內 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 將 value 從 [min, max] 線性映射到 [0, 100]，超出範圍時夾在邊界（min 對應 0 分，max 對應 100 分）。
 * 這是本專案風險分數換算的共用手法：先定義一個「低風險基準」與「高風險基準」，
 * 落在區間外的極端值一律視為 0 分或 100 分，避免離群值把分數推出合理範圍。
 */
export function linearScore(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

export interface WeightedInput {
  value: number | null;
  weight: number;
}

/**
 * 加權平均，自動排除缺失值（value 為 null）並依剩餘項目的權重比例重新正規化，
 * 而非直接把缺失值當 0 分計算（會嚴重低估風險）。若全部缺失則回傳 fallback，
 * 預設 50 分代表「中性、不確定」而非「低風險」。
 */
export function weightedAverageSkipMissing(
  inputs: WeightedInput[],
  fallback = 50
): number {
  const present = inputs.filter(
    (item): item is WeightedInput & { value: number } => item.value !== null
  );
  const totalWeight = present.reduce((sum, item) => sum + item.weight, 0);
  if (present.length === 0 || totalWeight === 0) return fallback;

  const weightedSum = present.reduce(
    (sum, item) => sum + item.value * item.weight,
    0
  );
  return weightedSum / totalWeight;
}

/** 單一風險因子類別（volatility/fundamental/...）計算後的中介結果 */
export interface CategoryScoreResult {
  /** 該類別的綜合分數，0-100 */
  score: number;
  /** 該類別下每個因子的明細，用於可解釋性 UI */
  factors: FactorScore[];
  /** 因資料缺失而以中性值代入的因子名稱 */
  missingFactors: string[];
}
