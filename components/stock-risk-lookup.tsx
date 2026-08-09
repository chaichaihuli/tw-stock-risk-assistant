"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { RiskBreakdownChart } from "@/components/risk-breakdown-chart";
import { StockSearch } from "@/components/stock-search";
import { WatchlistToggleButton } from "@/components/watchlist-toggle-button";
import { explainStockRisk } from "@/lib/risk/explain";
import { buildMatchVerdict, calculateRiskMatch } from "@/lib/risk/riskMatch";
import { useUserRiskStore } from "@/lib/store/userRiskStore";
import type { StockRiskBreakdown, StockRiskScore } from "@/types/risk";

const BREAKDOWN_LABEL: Record<keyof StockRiskBreakdown, string> = {
  volatility: "波動度",
  fundamental: "基本面",
  valuationQuality: "估值品質",
  sentimentEvent: "新聞情緒",
  macroSector: "總經/產業",
};

const VERDICT_BADGE_CLASS: Record<"適合" | "臨界" | "不適合", string> = {
  適合: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  臨界: "border-amber-500 text-amber-600 dark:text-amber-400",
  不適合: "border-red-500 text-red-600 dark:text-red-400",
};

export function StockRiskLookup() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StockRiskScore | null>(null);

  // 若使用者已在問卷頁算過風險承受分數（同一個瀏覽分頁內），這裡可以順便顯示是否適合
  const userScore = useUserRiskStore((s) => s.result);

  async function lookup(tickerOverride?: string) {
    const trimmed = (tickerOverride ?? ticker).trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock-risk/${encodeURIComponent(trimmed)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `查詢 ${trimmed} 失敗`);
      setResult(json as StockRiskScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectFromSearch(selectedTicker: string) {
    setTicker(selectedTicker);
    lookup(selectedTicker);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <StockSearch onSelectTicker={handleSelectFromSearch} />

      <div className="flex gap-2">
        <Input
          placeholder="或直接輸入股票代碼，例如 2330.TW"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") lookup();
          }}
        />
        <Button onClick={() => lookup()} disabled={loading || !ticker.trim()}>
          {loading ? "查詢中…" : "查詢"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-2xl">{result.ticker}</CardTitle>
              <WatchlistToggleButton ticker={result.ticker} />
            </div>
            <CardDescription>
              綜合風險分數：
              <span className="font-medium text-foreground"> {result.score.toFixed(1)} / 100</span>
              （分數越高風險越高）
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              資料時間：{new Date(result.calculatedAt).toLocaleString("zh-TW")}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">{explainStockRisk(result)}</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(Object.keys(result.breakdown) as (keyof StockRiskBreakdown)[]).map((key) => (
                <div key={key} className="rounded-md border px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">{BREAKDOWN_LABEL[key]}</p>
                  <p className="text-lg font-medium tabular-nums">
                    {result.breakdown[key].toFixed(1)}
                  </p>
                </div>
              ))}
            </div>

            <RiskBreakdownChart breakdown={result.breakdown} />

            {userScore ? (
              (() => {
                const match = calculateRiskMatch(result, userScore);
                const { verdict, reason } = buildMatchVerdict(match);
                return (
                  <div className="rounded-md border px-3 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium">與你的風險承受度比對：</span>
                      <Badge variant="outline" className={VERDICT_BADGE_CLASS[verdict]}>
                        {verdict}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{reason}</p>
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-muted-foreground">
                尚未計算你的風險承受分數，
                <Link href="/" className="underline underline-offset-2">
                  先去填問卷
                </Link>
                ，回來後這裡會顯示這檔股票是否適合你。
              </p>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">因子明細</p>
              <ul className="flex flex-col gap-1.5">
                {result.factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="flex items-start justify-between gap-4 text-sm text-muted-foreground"
                  >
                    <span>{factor.description}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {factor.score} 分
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {result.missingFactors.length > 0 && (
              <p className="text-xs text-muted-foreground">
                以下因子因資料缺失以中性值代入，可能影響分數可信度：
                {result.missingFactors.join("、")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
