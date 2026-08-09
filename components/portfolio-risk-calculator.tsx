"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { RiskBreakdownChart } from "@/components/risk-breakdown-chart";
import { calculatePortfolioRisk, type PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import { matchLevelToVerdict, resolveMatchLevel } from "@/lib/risk/riskMatch";
import { useUserRiskStore } from "@/lib/store/userRiskStore";
import type { StockRiskScore } from "@/types/risk";

interface HoldingRow {
  ticker: string;
  weight: string;
}

const VERDICT_BADGE_CLASS: Record<"適合" | "臨界" | "不適合", string> = {
  適合: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  臨界: "border-amber-500 text-amber-600 dark:text-amber-400",
  不適合: "border-red-500 text-red-600 dark:text-red-400",
};

function makeEmptyRow(): HoldingRow {
  return { ticker: "", weight: "" };
}

export function PortfolioRiskCalculator() {
  const [rows, setRows] = useState<HoldingRow[]>([makeEmptyRow(), makeEmptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);
  const [result, setResult] = useState<PortfolioRiskResult | null>(null);

  const userScore = useUserRiskStore((s) => s.result);

  function updateRow(index: number, patch: Partial<HoldingRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeEmptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function calculate() {
    const validRows = rows
      .map((r) => ({ ticker: r.ticker.trim().toUpperCase(), weight: Number(r.weight) }))
      .filter((r) => r.ticker && Number.isFinite(r.weight) && r.weight > 0);

    if (validRows.length === 0) {
      setError("請至少輸入一列股票代碼與大於 0 的權重");
      return;
    }

    setLoading(true);
    setError(null);
    setFailedTickers([]);
    setResult(null);

    try {
      const holdings: { ticker: string; weight: number; stockRiskScore: StockRiskScore }[] = [];
      const failed: string[] = [];

      // 依序查詢而非同時發送，避免多檔一起查詢時觸發外部 API 的流量限制
      for (const row of validRows) {
        try {
          const response = await fetch(`/api/stock-risk/${encodeURIComponent(row.ticker)}`);
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? `查詢 ${row.ticker} 失敗`);
          holdings.push({
            ticker: row.ticker,
            weight: row.weight,
            stockRiskScore: json as StockRiskScore,
          });
        } catch {
          failed.push(row.ticker);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setFailedTickers(failed);

      const portfolioResult = calculatePortfolioRisk(holdings);
      if (!portfolioResult) {
        setError("沒有任何一檔股票成功取得資料，無法計算組合風險");
        return;
      }
      setResult(portfolioResult);
    } finally {
      setLoading(false);
    }
  }

  const gap = result && userScore ? result.score - userScore.score : null;
  const verdict = gap !== null ? matchLevelToVerdict(resolveMatchLevel(Math.abs(gap))) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>投資組合風險計算</CardTitle>
        <CardDescription>
          輸入多檔股票代碼與權重，依權重加權平均計算整體組合的風險分數。權重不用先手動換算成
          100%（例如可直接輸入 40 / 30 / 30），系統會自動依有效持股正規化。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="股票代碼，如 2330.TW"
                value={row.ticker}
                onChange={(e) => updateRow(i, { ticker: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="權重，如 40"
                value={row.weight}
                onChange={(e) => updateRow(i, { weight: e.target.value })}
                className="w-24"
                type="number"
                min="0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
              >
                移除
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            新增一列
          </Button>
          <Button onClick={calculate} disabled={loading}>
            {loading ? "計算中…" : "計算組合風險"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {failedTickers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            無法取得資料，已從計算中排除：{failedTickers.join("、")}
          </p>
        )}

        {result && (
          <>
            <Separator />

            <p className="text-sm">
              組合綜合風險分數：
              <span className="font-medium text-foreground"> {result.score.toFixed(1)} / 100</span>
            </p>

            <RiskBreakdownChart breakdown={result.breakdown} />

            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">持股權重明細</p>
              {result.holdings.map((h) => (
                <div
                  key={h.ticker}
                  className="flex items-center justify-between text-sm text-muted-foreground"
                >
                  <span className="font-mono">{h.ticker}</span>
                  <span>
                    正規化權重 {(h.normalizedWeight * 100).toFixed(1)}%（個股風險 {h.score.toFixed(1)}）
                  </span>
                </div>
              ))}
            </div>

            {userScore && verdict !== null && gap !== null ? (
              <div className="rounded-md border px-3 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">與你的風險承受度比對：</span>
                  <Badge variant="outline" className={VERDICT_BADGE_CLASS[verdict]}>
                    {verdict}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  這個組合的風險分數（{result.score.toFixed(1)}）
                  {gap > 0
                    ? `比你的風險承受度（${userScore.score.toFixed(1)}）高出 ${Math.abs(gap).toFixed(1)} 分。`
                    : gap < 0
                      ? `比你的風險承受度（${userScore.score.toFixed(1)}）低 ${Math.abs(gap).toFixed(1)} 分。`
                      : `與你的風險承受度（${userScore.score.toFixed(1)}）一致。`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                尚未計算你的風險承受分數，
                <Link href="/" className="underline underline-offset-2">
                  先去填問卷
                </Link>
                ，回來後這裡會顯示這個組合是否適合你。
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
