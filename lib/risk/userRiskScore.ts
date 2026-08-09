import type { FactorScore, UserRiskProfile, UserRiskScore, RiskLevel } from "@/types/risk";
import { RISK_MATCH_GAP_THRESHOLDS, USER_RISK_LEVEL_THRESHOLDS } from "./constants";
import { RISK_QUESTIONNAIRE } from "./questionnaire";
import { clamp } from "./utils";

function resolveRiskLevel(score: number): RiskLevel {
  if (score < USER_RISK_LEVEL_THRESHOLDS.conservativeMax) return "conservative";
  if (score >= USER_RISK_LEVEL_THRESHOLDS.aggressiveMin) return "aggressive";
  return "moderate";
}

/**
 * 計算使用者風險承受分數。
 *
 * 逐題讀取 RISK_QUESTIONNAIRE（見 lib/risk/questionnaire.ts）定義的權重與選項分數，
 * 直接依權重加權平均——問卷每題都是必答的單選題，不會有缺失值，
 * 所以這裡不需要像個股風險計算那樣處理缺失值重新正規化權重。
 *
 * 分數量尺與 StockRiskScore 相同（0-100），但語意相反：這裡分數越高代表
 * 使用者「能承受」的風險越高，之後可直接與個股風險分數比較做風險匹配
 * （見 lib/risk/riskMatch.ts）。
 */
export function calculateUserRiskScore(profile: UserRiskProfile): UserRiskScore {
  const factors: FactorScore[] = [];
  let weightedSum = 0;

  for (const q of RISK_QUESTIONNAIRE) {
    const answerValue = profile[q.id];
    const option = q.options.find((o) => o.value === answerValue);
    if (!option) {
      throw new Error(
        `問卷題目 "${q.id}" 的作答 "${String(answerValue)}" 不是合法選項，請檢查表單資料`
      );
    }

    weightedSum += option.score * q.weight;
    factors.push({
      name: q.id,
      score: option.score,
      weight: q.weight,
      description: `${q.question}：選擇「${option.label}」`,
    });
  }

  const score = Math.round(weightedSum * 100) / 100;

  return {
    score,
    level: resolveRiskLevel(score),
    // 以使用者分數為中心，上下各留「good」等級的容忍帶（見 RISK_MATCH_GAP_THRESHOLDS），
    // 落在此區間內的個股風險分數都算可接受的匹配。
    acceptableStockRiskRange: {
      min: clamp(score - RISK_MATCH_GAP_THRESHOLDS.goodMax, 0, 100),
      max: clamp(score + RISK_MATCH_GAP_THRESHOLDS.goodMax, 0, 100),
    },
    factors,
    calculatedAt: new Date().toISOString(),
  };
}
