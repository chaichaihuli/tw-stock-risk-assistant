"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMatchVerdict, calculateRiskMatch } from "@/lib/risk/riskMatch";
import { useUserRiskStore } from "@/lib/store/userRiskStore";
import { useWatchlistStore } from "@/lib/store/watchlistStore";
import type { StockRiskScore } from "@/types/risk";

const VERDICT_BADGE_CLASS: Record<"適合" | "臨界" | "不適合", string> = {
  適合: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  臨界: "border-amber-500 text-amber-600 dark:text-amber-400",
  不適合: "border-red-500 text-red-600 dark:text-red-400",
};

interface RowState {
  loading: boolean;
  error: string | null;
  result: StockRiskScore | null;
}

export function Watchlist() {
  const items = useWatchlistStore((s) => s.items);
  const remove = useWatchlistStore((s) => s.remove);
  const userScore = useUserRiskStore((s) => s.result);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [refreshing, setRefreshing] = useState(false);

  async function refreshAll() {
    setRefreshing(true);
    // 依序查詢而非同時發送，避免多檔一起查詢時觸發外部 API 的流量限制
    for (const item of items) {
      setRows((prev) => ({
        ...prev,
        [item.ticker]: { loading: true, error: null, result: prev[item.ticker]?.result ?? null },
      }));
      try {
        const response = await fetch(`/api/stock-risk/${encodeURIComponent(item.ticker)}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? `查詢 ${item.ticker} 失敗`);
        setRows((prev) => ({
          ...prev,
          [item.ticker]: { loading: false, error: null, result: json as StockRiskScore },
        }));
      } catch (err) {
        setRows((prev) => ({
          ...prev,
          [item.ticker]: {
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            result: null,
          },
        }));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    setRefreshing(false);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        尚未加入任何觀察項目。可以到
        <Link href="/stock-lookup" className="underline underline-offset-2">
          個股風險查詢
        </Link>
        或問卷推薦結果裡按「加入觀察清單」。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={refreshAll} disabled={refreshing}>
        {refreshing ? "更新中…" : "更新全部風險分數"}
      </Button>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const row = rows[item.ticker];
          const match = row?.result && userScore ? calculateRiskMatch(row.result, userScore) : null;
          const verdict = match ? buildMatchVerdict(match) : null;

          return (
            <Card key={item.ticker}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg">{item.ticker}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => remove(item.ticker)}>
                  移除
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {!row && (
                  <p className="text-xs text-muted-foreground">按上方「更新全部風險分數」查看目前分數</p>
                )}
                {row?.loading && <p className="text-sm text-muted-foreground">查詢中…</p>}
                {row?.error && <p className="text-sm text-destructive">{row.error}</p>}
                {row?.result && (
                  <>
                    <p className="text-sm">
                      風險分數：
                      <span className="font-medium text-foreground">
                        {" "}
                        {row.result.score.toFixed(1)} / 100
                      </span>
                    </p>
                    {verdict ? (
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={`w-fit ${VERDICT_BADGE_CLASS[verdict.verdict]}`}
                        >
                          {verdict.verdict}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{verdict.reason}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        尚未計算你的風險承受分數，
                        <Link href="/" className="underline underline-offset-2">
                          先去填問卷
                        </Link>
                        即可在此看到適合度。
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
