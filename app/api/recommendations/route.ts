import { NextResponse } from "next/server";
import { pickNextBatch } from "@/lib/data/stockUniverse";
import { recommendStocks } from "@/lib/recommend";
import { calculateUserRiskScore } from "@/lib/risk/userRiskScore";
import type { UserRiskProfile } from "@/types/risk";

interface RecommendationsRequestBody {
  profile: UserRiskProfile;
  /** 已經看過的股票代碼；有帶的話這次會挑池子裡沒看過的一批（「換一批」用） */
  excludeTickers?: string[];
}

/**
 * POST /api/recommendations
 * body: { profile: UserRiskProfile, excludeTickers?: string[] }
 *
 * 伺服器端重新用問卷作答算一次 UserRiskScore（不直接信任 client 算好的分數）。
 * excludeTickers 省略或為空陣列時回傳候選池的第一批；帶入先前已看過的股票代碼
 * 則從池子裡挑一批沒看過的（池子看完一輪會自動循環，見 pickNextBatch）。
 */
export async function POST(request: Request) {
  let body: RecommendationsRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式不是合法的 JSON" }, { status: 400 });
  }

  if (!body?.profile) {
    return NextResponse.json({ error: "缺少 profile（問卷作答）" }, { status: 400 });
  }

  let userScore;
  try {
    userScore = calculateUserRiskScore(body.profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `問卷作答不完整或不合法：${message}` },
      { status: 400 }
    );
  }

  const tickers = pickNextBatch(body.excludeTickers ?? []);
  const { recommendations, failed } = await recommendStocks(userScore, tickers);

  return NextResponse.json({ userScore, recommendations, failed });
}
