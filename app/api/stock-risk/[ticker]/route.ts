import { NextResponse } from "next/server";
import { buildStockRiskInputs } from "@/lib/data/buildStockRiskInputs";
import { calculateStockRiskScore } from "@/lib/risk/stockRiskScore";

/**
 * GET /api/stock-risk/:ticker
 * 回傳單一股票的完整風險分數（五大類別 + 因子明細）。
 * 這裡是唯一會實際呼叫 Yahoo Finance / Finnhub / FRED 的地方——
 * 這些呼叫需要 API Key，必須留在伺服器端，不能從 client component 直接呼叫。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker?.trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "缺少股票代碼" }, { status: 400 });
  }

  try {
    const inputs = await buildStockRiskInputs(ticker);
    const stockRiskScore = calculateStockRiskScore(inputs);
    return NextResponse.json(stockRiskScore);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `無法取得 ${ticker} 的風險分數：${message}` },
      { status: 502 }
    );
  }
}
