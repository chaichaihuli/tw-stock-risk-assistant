import type { FactorScore } from "@/types/risk";
import type { NewsItem } from "@/types/market";
import { clamp, type CategoryScoreResult } from "./utils";

/**
 * 新聞情緒與事件風險：取近期新聞情緒分數的平均值換算。
 * 呼叫端須自行篩選「近期」範圍（例如近 14 天）的新聞再傳入，
 * 本函式只負責分數換算，不處理時間篩選邏輯。
 */
export function scoreSentimentEvent(news: NewsItem[]): CategoryScoreResult {
  const scored = news.filter(
    (item): item is NewsItem & { sentimentScore: number } =>
      item.sentimentScore !== null
  );

  if (scored.length === 0) {
    return {
      score: 50,
      factors: [
        {
          name: "news_sentiment_avg",
          score: 50,
          weight: 1,
          description: "近期無可用的新聞情緒資料，以中性 50 分代入",
        },
      ],
      missingFactors: ["news_sentiment_avg"],
    };
  }

  const avgSentiment =
    scored.reduce((sum, item) => sum + item.sentimentScore, 0) /
    scored.length;

  // sentimentScore: -1(極負面) ~ 1(極正面) → risk: 1 對應 0 分風險，-1 對應 100 分風險
  const sentimentRisk = clamp(((1 - avgSentiment) / 2) * 100, 0, 100);

  const factors: FactorScore[] = [
    {
      name: "news_sentiment_avg",
      score: sentimentRisk,
      weight: 1,
      description: `近 ${scored.length} 則新聞平均情緒分數 ${avgSentiment.toFixed(2)}（-1~1），換算為風險分數`,
    },
  ];

  return { score: sentimentRisk, factors, missingFactors: [] };
}
