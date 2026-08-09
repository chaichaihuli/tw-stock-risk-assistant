import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WatchlistItem {
  ticker: string;
  addedAt: string;
}

interface WatchlistStore {
  items: WatchlistItem[];
  add: (ticker: string) => void;
  remove: (ticker: string) => void;
}

/**
 * 觀察清單存在 localStorage（透過 zustand persist），跟 userRiskStore 不同——
 * 使用者風險分數是「這次填答」的暫時結果，觀察清單則是使用者主動收藏、
 * 預期跨瀏覽階段都還在的清單，所以需要持久化。
 */
export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (ticker) => {
        const upper = ticker.trim().toUpperCase();
        if (!upper || get().items.some((item) => item.ticker === upper)) return;
        set((state) => ({
          items: [...state.items, { ticker: upper, addedAt: new Date().toISOString() }],
        }));
      },
      remove: (ticker) => {
        const upper = ticker.trim().toUpperCase();
        set((state) => ({ items: state.items.filter((item) => item.ticker !== upper) }));
      },
    }),
    { name: "watchlist-storage" }
  )
);
