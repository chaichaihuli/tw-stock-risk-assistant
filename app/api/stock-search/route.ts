import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/data/yahooFinance";

/**
 * GET /api/stock-search?q=關鍵字
 * 依公司名稱／關鍵字（中英文皆可）搜尋可能匹配的股票，供前端搜尋框使用。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "缺少查詢關鍵字" }, { status: 400 });
  }

  try {
    const results = await searchStocks(query);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `搜尋「${query}」失敗：${message}` },
      { status: 502 }
    );
  }
}
