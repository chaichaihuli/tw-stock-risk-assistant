import type {
  RiskMatchLevel,
  RiskMatchResult,
  StockRiskScore,
  UserRiskScore,
} from "@/types/risk";
import { RISK_MATCH_GAP_THRESHOLDS } from "./constants";

/**
 * 依「差距絕對值」換算匹配等級，供 calculateRiskMatch 使用，
 * 也給 lib/recommend.ts 的百分位匹配共用同一套門檻（見 RISK_MATCH_GAP_THRESHOLDS）。
 */
export function resolveMatchLevel(absGap: number): RiskMatchLevel {
  if (absGap <= RISK_MATCH_GAP_THRESHOLDS.excellentMax) return "excellent";
  if (absGap <= RISK_MATCH_GAP_THRESHOLDS.goodMax) return "good";
  if (absGap <= RISK_MATCH_GAP_THRESHOLDS.fairMax) return "fair";
  return "poor";
}

/**
 * 計算個股風險分數與使用者風險承受分數的匹配程度。
 * 兩者共用同一把 0-100 風險量尺：StockRiskScore 越高代表股票本身風險越高，
 * UserRiskScore 越高代表使用者能承受的風險越高，理想匹配是兩者數值接近（gap 趨近 0）。
 */
export function calculateRiskMatch(
  stockScore: StockRiskScore,
  userScore: UserRiskScore
): RiskMatchResult {
  // 正值代表股票風險高於使用者承受度；負值代表股票風險低於使用者承受度
  const gap = stockScore.score - userScore.score;

  return {
    ticker: stockScore.ticker,
    stockRiskScore: stockScore.score,
    userRiskScore: userScore.score,
    gap: Math.round(gap * 100) / 100,
    matchLevel: resolveMatchLevel(Math.abs(gap)),
  };
}

/** 白話結論：excellent/good 視為適合、fair 為臨界（需自行斟酌）、poor 為不適合 */
export function matchLevelToVerdict(level: RiskMatchLevel): "適合" | "臨界" | "不適合" {
  if (level === "excellent" || level === "good") return "適合";
  if (level === "fair") return "臨界";
  return "不適合";
}

export interface MatchVerdict {
  verdict: "適合" | "臨界" | "不適合";
  reason: string;
}

/**
 * 依 calculateRiskMatch 的結果組出一句白話說明，取代單純的 badge + 數字，
 * 讓使用者不用自己解讀 gap 的正負號跟大小代表什麼意思。
 */
export function buildMatchVerdict(match: RiskMatchResult): MatchVerdict {
  const verdict = matchLevelToVerdict(match.matchLevel);
  const absGap = Math.abs(match.gap).toFixed(1);
  const stockScoreText = match.stockRiskScore.toFixed(1);
  const userScoreText = match.userRiskScore.toFixed(1);

  let reason: string;
  if (Math.abs(match.gap) <= 5) {
    reason = `${match.ticker} 的風險分數（${stockScoreText}）與你的風險承受度（${userScoreText}）非常接近，風險程度大致吻合。`;
  } else if (match.gap > 0) {
    reason = `${match.ticker} 的風險分數（${stockScoreText}）比你的風險承受度（${userScoreText}）高出 ${absGap} 分，代表這檔股票的風險可能超出你能接受的範圍。`;
  } else {
    reason = `${match.ticker} 的風險分數（${stockScoreText}）比你的風險承受度（${userScoreText}）低 ${absGap} 分，風險相對你能承受的範圍偏保守，可能的報酬潛力也較有限。`;
  }

  if (verdict === "臨界") {
    reason += " 屬於臨界情況，建議依個人狀況斟酌配置比例。";
  } else if (verdict === "不適合") {
    reason += " 建議謹慎評估或降低配置比例。";
  }

  return { verdict, reason };
}
