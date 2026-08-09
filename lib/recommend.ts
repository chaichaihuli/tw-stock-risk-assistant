import { buildStockRiskInputs } from "@/lib/data/buildStockRiskInputs";
import { CANDIDATE_TICKERS } from "@/lib/data/stockUniverse";
import { calculateRiskMatch, resolveMatchLevel } from "@/lib/risk/riskMatch";
import { calculateStockRiskScore } from "@/lib/risk/stockRiskScore";
import type { RiskMatchLevel, RiskMatchResult, StockRiskScore, UserRiskScore } from "@/types/risk";

/** 單一候選股票的推薦結果 */
export interface StockRecommendation {
  stockRiskScore: StockRiskScore;
  /**
   * 此股票風險分數在「本次候選池」中的百分位排名（0-100，100 代表池內風險最高）。
   * 用途見 percentileMatchLevel。
   */
  percentileRank: number;
  /** percentileRank 與使用者風險分數的差距（正值代表此股票在池內排名比使用者風險承受度更高風險） */
  percentileGap: number;
  /**
   * 依「候選池內百分位排名」換算的匹配等級。
   *
   * 跟 match.matchLevel（絕對分數匹配）不同：絕對分數匹配會讓積極型使用者在候選池
   * 都是藍籌股、分數普遍上不去 80 分時，永遠配不到 excellent。百分位匹配則保證
   * 不管候選池的絕對分數分布落在哪裡，積極型使用者永遠能配到「池內風險最高」的
   * 那批股票，解決池子太小、太集中時絕對分數失真的問題。預設排序依這個欄位。
   */
  percentileMatchLevel: RiskMatchLevel;
  /** 依「絕對分數」計算的匹配結果，量尺與說明見 types/risk.ts RiskMatchResult */
  match: RiskMatchResult;
}

export interface RecommendStocksResult {
  recommendations: StockRecommendation[];
  /** 抓取或計算失敗的股票代碼，連同錯誤訊息，方便呼叫端顯示「哪些查不到」 */
  failed: { ticker: string; error: string }[];
}

const LEVEL_RANK: Record<RiskMatchLevel, number> = {
  excellent: 0,
  good: 1,
  fair: 2,
  poor: 3,
};

/**
 * 候選池一次最多同時抓幾支股票的資料。每支股票背後要打 5~6 次 Yahoo/Finnhub API，
 * 候選池一大（例如 35 支）就會瞬間發出上百個並行請求，容易撞到 Yahoo Finance／
 * Finnhub 的流量限制導致大量失敗。分批處理，批次之間留一點間隔可以大幅降低失敗率。
 */
const FETCH_BATCH_SIZE = 5;
const FETCH_BATCH_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** value 在 allValues 這組數字裡的百分位（0-100）：小於等於自己的比例 */
function percentileOf(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const countBelowOrEqual = allValues.filter((v) => v <= value).length;
  return (countBelowOrEqual / allValues.length) * 100;
}

/**
 * 這是連接 lib/data（資料抓取）與 lib/risk（風險計算）的組合層：
 * 對候選股票池平行抓取風險分數，計算絕對分數匹配與候選池內百分位匹配兩種結果，
 * 依百分位匹配等級（excellent > good > fair > poor）再依百分位差距絕對值排序。
 *
 * 只在伺服器端呼叫（會用到 FINNHUB_API_KEY / FRED_API_KEY），
 * 不要從 client component 直接 import，請透過 app/api/recommendations 呼叫。
 *
 * 任一股票抓取失敗不會讓整批推薦失敗，失敗的會列在 failed 裡。
 */
export async function recommendStocks(
  userScore: UserRiskScore,
  tickers: string[] = CANDIDATE_TICKERS
): Promise<RecommendStocksResult> {
  const stockRiskScores: StockRiskScore[] = [];
  const failed: { ticker: string; error: string }[] = [];

  for (let i = 0; i < tickers.length; i += FETCH_BATCH_SIZE) {
    const batch = tickers.slice(i, i + FETCH_BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map(async (ticker) => {
        const inputs = await buildStockRiskInputs(ticker);
        return calculateStockRiskScore(inputs);
      })
    );

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        stockRiskScores.push(result.value);
      } else {
        const error =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        failed.push({ ticker: batch[index], error });
      }
    });

    const isLastBatch = i + FETCH_BATCH_SIZE >= tickers.length;
    if (!isLastBatch) await sleep(FETCH_BATCH_DELAY_MS);
  }

  const allScores = stockRiskScores.map((s) => s.score);

  const recommendations: StockRecommendation[] = stockRiskScores.map((stockRiskScore) => {
    const percentileRank = percentileOf(stockRiskScore.score, allScores);
    const percentileGap = Math.round((percentileRank - userScore.score) * 100) / 100;

    return {
      stockRiskScore,
      percentileRank: Math.round(percentileRank * 100) / 100,
      percentileGap,
      percentileMatchLevel: resolveMatchLevel(Math.abs(percentileGap)),
      match: calculateRiskMatch(stockRiskScore, userScore),
    };
  });

  recommendations.sort((a, b) => {
    const rankDiff = LEVEL_RANK[a.percentileMatchLevel] - LEVEL_RANK[b.percentileMatchLevel];
    if (rankDiff !== 0) return rankDiff;
    return Math.abs(a.percentileGap) - Math.abs(b.percentileGap);
  });

  return { recommendations, failed };
}
