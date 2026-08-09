import { CACHE_TTL, getOrSetCache } from "./cache";

/**
 * 中央銀行公開重貼現率等利率資料的 CSV（政府資料開放平台 dataset 6022，官方提供）。
 * 已實測確認可直接下載，免金鑰。CSV 標頭是中文（Big5 編碼），但資料列本身
 * （日期、數字）都是 ASCII 字元，Big5 對 ASCII 範圍與 UTF-8 相容，直接當文字讀取
 * 不會影響數字欄位解析，所以不需要額外做編碼轉換，只是標頭列印出來會是亂碼
 * （反正程式不需要讀標頭文字，用欄位固定順序解析即可）。
 */
const CBC_RATES_CSV_URL = "https://www.cbc.gov.tw/Public/Data/opendata/webF1.csv";

/**
 * 取得央行重貼現率（政策利率的代理指標）目前最新水準。
 * CSV 每列格式為「調整日期,重貼現率,擔保放款融通利率,短期融通利率」，
 * 依日期新到舊排序，第一列資料即為現行利率。
 * 抓取失敗或格式不符時回傳 { value: null, date: null }，不拋出例外。
 */
export async function fetchPolicyRate(): Promise<{
  value: number | null;
  date: string | null;
}> {
  return getOrSetCache("cbc:policyRate", CACHE_TTL.macro, async () => {
    try {
      const response = await fetch(CBC_RATES_CSV_URL);
      if (!response.ok) return { value: null, date: null };

      const text = await response.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      // 第 0 列是中文標頭，第 1 列開始才是資料（新到舊排序）
      const firstDataLine = lines[1];
      if (!firstDataLine) return { value: null, date: null };

      const [rawDate, rawRate] = firstDataLine.split(",");
      const rate = Number(rawRate);
      if (!rawDate || !Number.isFinite(rate)) return { value: null, date: null };

      // 原始日期格式為 "2024/3/22"，統一轉成 YYYY-MM-DD
      const [y, m, d] = rawDate.trim().split("/");
      const date =
        y && m && d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;

      return { value: rate, date };
    } catch {
      return { value: null, date: null };
    }
  });
}
