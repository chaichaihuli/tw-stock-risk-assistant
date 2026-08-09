import type { FactorScore } from "@/types/risk";
import type { MacroIndicators } from "@/types/market";
import {
  linearScore,
  weightedAverageSkipMissing,
  type CategoryScoreResult,
} from "./utils";

const CATEGORY_WEIGHTS = {
  macro: 0.5,
  sector: 0.5,
} as const;

/**
 * 總經次分數內部三個子指標的權重（總和為 1，再乘上 CATEGORY_WEIGHTS.macro）。
 *
 * 台股版 v1 只有 vix 有真實資料源（見 lib/data/yahooFinance.ts fetchVix）；
 * yieldCurveSpread／policyRate／unemploymentRate 目前沒有可靠的台灣公開資料源
 * （已實測 FRED 對台灣月頻總經資料覆蓋很薄，見 CLAUDE.md「明確排除在 v1 之外」），
 * 呼叫端固定傳 null，會經由 weightedAverageSkipMissing 自動跳過並重新正規化權重
 * （也就是目前這個子分數實質上完全由 vix 決定），而不是悄悄從公式移除不留痕跡——
 * 這三個因子仍會出現在 missingFactors，UI 會照樣提示使用者「以中性值代入」。
 */
const MACRO_SUB_WEIGHTS = {
  vix: 0.3,
  yieldCurveSpread: 0.3,
  policyRate: 0.2,
  unemploymentRate: 0.2,
} as const;

export interface MacroSectorInput {
  /**
   * 總經指標快照；v1 台股版三個欄位皆固定為 null（見 lib/data/buildStockRiskInputs.ts），
   * 整體為 null 時所有子指標一併以中性值代入。
   */
  macroIndicators: MacroIndicators | null;
  /** VIX 恐慌指數目前水準；抓取失敗或無資料時為 null（見 lib/data/yahooFinance.ts fetchVix） */
  vix: number | null;
  /**
   * 個股所屬產業的台股產業 ETF 相對大盤（0050.TW）近 ~3 個月超額報酬（百分點）；
   * 查無對應產業 ETF 時會回退用個股自身相對大盤的報酬率，仍抓取失敗時為 null
   * （見 lib/data/yahooFinance.ts fetchSectorRelativePerformance）
   */
  sectorRelativePerformance: number | null;
}

/**
 * 總經與產業風險，兩大部分各佔 50%：
 *
 * 【總經次分數】設計上由三個子指標組成——
 * - VIX 恐慌指數：市場對未來波動的預期，數值越高代表市場恐慌程度越高（台股 v1 唯一有
 *   真實資料的子指標，用全球 VIX 作為近似代理，見上方 MACRO_SUB_WEIGHTS 註解）
 * - 殖利率曲線利差、政策利率水準、失業率水準：v1 尚無台灣資料源，固定以中性值代入
 *
 * 【產業次分數】用個股所屬產業的台股產業 ETF 相對大盤（0050.TW）近 ~3 個月超額報酬換算：
 * 產業相對大盤弱勢（超額報酬為負）代表該產業目前逆風，風險較高；相對強勢則風險較低。
 */
export function scoreMacroSector(input: MacroSectorInput): CategoryScoreResult {
  const missingFactors: string[] = [];
  const macro = input.macroIndicators;

  // VIX：12 視為平靜市場基準（低風險），35 以上視為恐慌等級高風險
  const vixScore = input.vix === null ? null : linearScore(input.vix, 12, 35);
  if (vixScore === null) missingFactors.push("vix");

  // 政策利率水準：v1 尚無台灣央行利率資料源，恆為 null，以中性值代入
  const policyRate = macro?.policyRate.value ?? null;
  const policyRateScore =
    policyRate === null ? null : linearScore(policyRate, 0, 6);
  if (policyRateScore === null) missingFactors.push("policyRate");

  // 殖利率曲線利差：v1 尚無台灣公債殖利率資料源，恆為 null，以中性值代入
  const treasuryYield10Y = macro?.treasuryYield10Y.value ?? null;
  const yieldCurveSpread =
    treasuryYield10Y !== null && policyRate !== null
      ? treasuryYield10Y - policyRate
      : null;
  const yieldCurveScore =
    yieldCurveSpread === null ? null : linearScore(-yieldCurveSpread, -2, 1);
  if (yieldCurveScore === null) missingFactors.push("yieldCurveSpread");

  // 失業率水準：v1 尚無台灣失業率資料源，恆為 null，以中性值代入
  const unemploymentRate = macro?.unemploymentRate.value ?? null;
  const unemploymentScore =
    unemploymentRate === null ? null : linearScore(unemploymentRate, 3.5, 9);
  if (unemploymentScore === null) missingFactors.push("unemploymentRate");

  const macroScore = weightedAverageSkipMissing([
    { value: vixScore, weight: MACRO_SUB_WEIGHTS.vix },
    { value: yieldCurveScore, weight: MACRO_SUB_WEIGHTS.yieldCurveSpread },
    { value: policyRateScore, weight: MACRO_SUB_WEIGHTS.policyRate },
    { value: unemploymentScore, weight: MACRO_SUB_WEIGHTS.unemploymentRate },
  ]);

  // 產業相對表現：相對大盤超額報酬 -10 個百分點視為明顯落後（高風險），
  // +10 個百分點視為明顯領先（低風險）
  const sectorScore =
    input.sectorRelativePerformance === null
      ? null
      : linearScore(-input.sectorRelativePerformance, -10, 10);
  if (sectorScore === null) missingFactors.push("sectorRelativePerformance");

  const score = weightedAverageSkipMissing([
    { value: macroScore, weight: CATEGORY_WEIGHTS.macro },
    { value: sectorScore, weight: CATEGORY_WEIGHTS.sector },
  ]);

  const factors: FactorScore[] = [
    {
      name: "vix",
      score: vixScore ?? 50,
      weight: MACRO_SUB_WEIGHTS.vix * CATEGORY_WEIGHTS.macro,
      description:
        vixScore === null
          ? "缺少 VIX 資料，以中性 50 分代入"
          : `VIX 恐慌指數 ${input.vix}（全球市場恐慌情緒代理指標）換算風險分數`,
    },
    {
      name: "yield_curve_spread",
      score: yieldCurveScore ?? 50,
      weight: MACRO_SUB_WEIGHTS.yieldCurveSpread * CATEGORY_WEIGHTS.macro,
      description:
        yieldCurveScore === null
          ? "缺少台灣公債殖利率曲線利差資料（v1 尚無資料源），以中性 50 分代入"
          : `10 年期公債殖利率與政策利率利差 ${yieldCurveSpread!.toFixed(2)} 個百分點，` +
            (yieldCurveSpread! < 0
              ? "利差為負（曲線倒掛），為衰退預警訊號，風險偏高"
              : "利差為正（正常正斜率曲線），風險偏低"),
    },
    {
      name: "policy_rate",
      score: policyRateScore ?? 50,
      weight: MACRO_SUB_WEIGHTS.policyRate * CATEGORY_WEIGHTS.macro,
      description:
        policyRateScore === null
          ? "缺少台灣央行政策利率資料（v1 尚無資料源），以中性 50 分代入"
          : `政策利率 ${policyRate}% 換算風險分數`,
    },
    {
      name: "unemployment_rate",
      score: unemploymentScore ?? 50,
      weight: MACRO_SUB_WEIGHTS.unemploymentRate * CATEGORY_WEIGHTS.macro,
      description:
        unemploymentScore === null
          ? "缺少台灣失業率資料（v1 尚無資料源），以中性 50 分代入"
          : `失業率 ${unemploymentRate}% 換算風險分數`,
    },
    {
      name: "sector_relative_performance",
      score: sectorScore ?? 50,
      weight: CATEGORY_WEIGHTS.sector,
      description:
        sectorScore === null
          ? "缺少產業 ETF 相對表現資料（可能是該產業無對應 ETF，或抓取失敗），以中性 50 分代入"
          : `所屬產業相對大盤（0050.TW）近 ~3 個月超額報酬 ${input.sectorRelativePerformance!.toFixed(2)} 個百分點，` +
            (input.sectorRelativePerformance! < 0
              ? "產業相對弱勢，風險偏高"
              : "產業相對強勢，風險偏低"),
    },
  ];

  return { score, factors, missingFactors };
}
