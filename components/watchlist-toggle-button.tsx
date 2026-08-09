"use client";

import { Button } from "@/components/ui/button";
import { useWatchlistStore } from "@/lib/store/watchlistStore";

export function WatchlistToggleButton({ ticker }: { ticker: string }) {
  const normalized = ticker.trim().toUpperCase();
  const items = useWatchlistStore((s) => s.items);
  const add = useWatchlistStore((s) => s.add);
  const remove = useWatchlistStore((s) => s.remove);

  const inWatchlist = items.some((item) => item.ticker === normalized);

  if (!normalized) return null;

  return (
    <Button
      type="button"
      variant={inWatchlist ? "outline" : "ghost"}
      size="sm"
      onClick={() => (inWatchlist ? remove(normalized) : add(normalized))}
    >
      {inWatchlist ? "已加入觀察清單 ✓" : "加入觀察清單"}
    </Button>
  );
}
