"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StockSearchResult } from "@/types/market";

/** 使用者停止輸入後多久才觸發搜尋，避免每個按鍵都打一次 API */
const DEBOUNCE_MS = 400;

interface StockSearchProps {
  /** 使用者點選某個搜尋結果時呼叫，帶入該股票代碼 */
  onSelectTicker: (ticker: string) => void;
}

/** 公司名稱／關鍵字搜尋股票（中英文皆可），點選結果後回呼 onSelectTicker */
export function StockSearch({ onSelectTicker }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock-search?q=${encodeURIComponent(trimmed)}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "搜尋失敗");
        setResults(json.results as StockSearchResult[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(ticker: string) {
    onSelectTicker(ticker);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜尋公司名稱或關鍵字，例如 台積電、2330、聯發科"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // 延遲關閉，讓點擊結果的 click 事件能先觸發
            setTimeout(() => setOpen(false), 150);
          }}
          className="pr-8 pl-8"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && query.trim() && (
        <Card className="absolute top-full z-10 mt-1 max-h-80 w-full gap-0 overflow-y-auto py-1 shadow-lg">
          {loading && results.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              搜尋中…
            </p>
          )}

          {!loading && error && (
            <p className="px-3 py-3 text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              找不到符合「{query.trim()}」的股票
            </p>
          )}

          {!error &&
            results.length > 0 &&
            results.map((result) => (
              <button
                key={result.ticker}
                type="button"
                onClick={() => handleSelect(result.ticker)}
                className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{result.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {result.exchange ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
                  {result.ticker}
                </span>
              </button>
            ))}
        </Card>
      )}
    </div>
  );
}
