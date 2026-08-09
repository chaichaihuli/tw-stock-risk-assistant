"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WatchlistToggleButton } from "@/components/watchlist-toggle-button";
import { buildMatchVerdict, calculateRiskMatch, matchLevelToVerdict } from "@/lib/risk/riskMatch";
import { calculateUserRiskScore } from "@/lib/risk/userRiskScore";
import type {
  RiskMatchLevel,
  RiskMatchResult,
  StockRiskScore,
  UserRiskProfile,
  UserRiskScore,
} from "@/types/risk";

interface StockRecommendation {
  stockRiskScore: StockRiskScore;
  percentileRank: number;
  percentileGap: number;
  percentileMatchLevel: RiskMatchLevel;
  match: RiskMatchResult;
}

interface RecommendationsResponse {
  userScore: UserRiskScore;
  recommendations: StockRecommendation[];
  failed: { ticker: string; error: string }[];
}

const MATCH_LEVEL_LABEL: Record<RiskMatchLevel, string> = {
  excellent: "完美匹配",
  good: "良好匹配",
  fair: "普通匹配",
  poor: "落差較大",
};

const MATCH_LEVEL_CLASS: Record<RiskMatchLevel, string> = {
  excellent: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  good: "border-blue-500 text-blue-600 dark:text-blue-400",
  fair: "border-amber-500 text-amber-600 dark:text-amber-400",
  poor: "border-red-500 text-red-600 dark:text-red-400",
};

const VERDICT_BADGE_CLASS: Record<"適合" | "臨界" | "不適合", string> = {
  適合: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  臨界: "border-amber-500 text-amber-600 dark:text-amber-400",
  不適合: "border-red-500 text-red-600 dark:text-red-400",
};

function RecommendationRow({ item }: { item: StockRecommendation }) {
  const verdict = matchLevelToVerdict(item.percentileMatchLevel);
  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{item.stockRiskScore.ticker}</span>
          <span className="text-sm text-muted-foreground">
            風險分數 {item.stockRiskScore.score.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            （候選池中第 {item.percentileRank.toFixed(0)} 百分位）
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={MATCH_LEVEL_CLASS[item.percentileMatchLevel]}>
            {MATCH_LEVEL_LABEL[item.percentileMatchLevel]}
          </Badge>
          <WatchlistToggleButton ticker={item.stockRiskScore.ticker} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {verdict === "適合" &&
          "此股票在這批候選池中的相對風險排名，跟你的風險承受度算合拍，屬於適合的範圍。"}
        {verdict === "臨界" &&
          "此股票在這批候選池中的相對風險排名跟你的風險承受度有一些落差，屬於臨界情況，建議自行斟酌。"}
        {verdict === "不適合" &&
          "此股票在這批候選池中的相對風險排名跟你的風險承受度落差較大，可能不太適合。"}
      </p>
    </div>
  );
}

function MatchRow({ ticker, match }: { ticker: string; match: RiskMatchResult }) {
  const { verdict, reason } = buildMatchVerdict(match);
  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{ticker}</span>
          <span className="text-sm text-muted-foreground">
            個股風險 {match.stockRiskScore.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            差距 {match.gap > 0 ? "+" : ""}
            {match.gap.toFixed(1)}
          </span>
          <Badge variant="outline" className={VERDICT_BADGE_CLASS[verdict]}>
            {verdict}
          </Badge>
          <WatchlistToggleButton ticker={ticker} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

export function StockRecommendations({ profile }: { profile: UserRiskProfile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  // 累計「已經看過的股票代碼」，換一批時當 excludeTickers 送給伺服器，
  // 讓伺服器從候選池挑一批沒看過的（見 lib/data/stockUniverse.ts pickNextBatch）
  const [seenTickers, setSeenTickers] = useState<string[]>([]);

  const [customTicker, setCustomTicker] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customResults, setCustomResults] = useState<
    { stockRiskScore: StockRiskScore; match: RiskMatchResult }[]
  >([]);

  async function fetchRecommendations(excludeTickers: string[]) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, excludeTickers }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "推薦失敗");
      const result = json as RecommendationsResponse;
      setData(result);
      setSeenTickers((prev) => [
        ...prev,
        ...result.recommendations.map((r) => r.stockRiskScore.ticker),
        ...result.failed.map((f) => f.ticker),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function checkCustomTicker() {
    const ticker = customTicker.trim().toUpperCase();
    if (!ticker) return;

    setCustomLoading(true);
    setCustomError(null);
    try {
      const response = await fetch(`/api/stock-risk/${encodeURIComponent(ticker)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `查詢 ${ticker} 失敗`);
      const stockRiskScore = json as StockRiskScore;

      // 已按過「查看推薦股票」就重用同一份 userScore，避免不同次計算的些微差異；
      // 否則直接用同一份 profile 在 client 端重算一次（calculateUserRiskScore 是純函式）
      const userScore = data?.userScore ?? calculateUserRiskScore(profile);
      const match = calculateRiskMatch(stockRiskScore, userScore);

      setCustomResults((prev) => [
        { stockRiskScore, match },
        ...prev.filter((r) => r.stockRiskScore.ticker !== ticker),
      ]);
      setCustomTicker("");
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : String(err));
    } finally {
      setCustomLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>推薦股票</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button onClick={() => fetchRecommendations(seenTickers)} disabled={loading}>
              {loading
                ? "計算中，請稍候…"
                : data
                  ? "換一批"
                  : "查看推薦股票"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            會對候選股票池即時抓取資料計算風險分數（分批處理避免觸發外部 API
            流量限制），約需 20～40 秒。匹配等級是依這一批候選池內的百分位排名決定，
            而不是絕對分數——積極型使用者永遠會配到這批裡風險最高的那批股票。
            「換一批」會從候選池挑一批還沒看過的股票重新計算，全部看過一輪後會循環。
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {data && (
            <div className="flex flex-col gap-2">
              {data.recommendations.map((r) => (
                <RecommendationRow key={r.stockRiskScore.ticker} item={r} />
              ))}
              {data.failed.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  無法取得資料：{data.failed.map((f) => f.ticker).join("、")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>查詢特定股票</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="輸入股票代碼，例如 2330.TW"
              value={customTicker}
              onChange={(e) => setCustomTicker(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkCustomTicker();
              }}
            />
            <Button onClick={checkCustomTicker} disabled={customLoading || !customTicker.trim()}>
              {customLoading ? "查詢中…" : "查詢"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            這裡是跟你的風險承受分數做絕對分數比較（不是跟候選池比百分位），
            差距 ±10 內算完美匹配、±25 內算良好匹配。
          </p>

          {customError && <p className="text-sm text-destructive">{customError}</p>}

          {customResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {customResults.map((r) => (
                <MatchRow key={r.stockRiskScore.ticker} ticker={r.stockRiskScore.ticker} match={r.match} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
