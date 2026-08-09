/**
 * 極簡的記憶體內 TTL 快取，用於降低對外部 API（Yahoo Finance）的重複呼叫。
 * 限制：僅存在於單一 Node.js process 記憶體中，重啟或多執行個體（如 serverless）之間不會共享，
 * 屬於 MVP 階段的暫時方案；之後若需要跨執行個體共享，可替換為 Redis 等外部快取，
 * 屆時只需替換這個檔案的實作，呼叫端介面（getOrSetCache）不需變動。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** 若快取存在且未過期則直接回傳，否則呼叫 fetcher 取得新值並寫入快取 */
export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** 常用 TTL（毫秒），依各類資料的更新頻率設定 */
export const CACHE_TTL = {
  /** 即時報價：1 分鐘 */
  quote: 60_000,
  /** 歷史線圖：15 分鐘 */
  chart: 15 * 60_000,
  /** 基本面／公司資料：1 天（財報不會頻繁更新） */
  fundamentals: 24 * 60 * 60_000,
  /** 股票搜尋結果：1 小時（公司名稱/代碼對應關係幾乎不變，但仍保留較短 TTL 以反映新上市/更名） */
  search: 60 * 60_000,
  /** 總經指標：12 小時（央行利率、失業率等通常按月/不定期更新，不需要頻繁重抓） */
  macro: 12 * 60 * 60_000,
} as const;
