/**
 * 風險計算相關的權重與門檻值集中於此，方便未來調整與回測，
 * 避免魔術數字散落在各個計算檔案中。每組 weights 物件的數值總和皆應為 1。
 */

/** 個股風險分數五大類別的權重 */
export const STOCK_RISK_CATEGORY_WEIGHTS = {
  volatility: 0.3,
  fundamental: 0.25,
  valuationQuality: 0.2,
  sentimentEvent: 0.15,
  macroSector: 0.1,
} as const;

/**
 * 使用者風險問卷各題權重，定義在 lib/risk/questionnaire.ts 的
 * RISK_QUESTIONNAIRE 裡（跟題目本身放在一起，方便對照調整）。
 */

/**
 * 使用者風險等級門檻：
 * score < conservativeMax → conservative；score >= aggressiveMin → aggressive；其餘 → moderate
 */
export const USER_RISK_LEVEL_THRESHOLDS = {
  conservativeMax: 40,
  aggressiveMin: 70,
} as const;

/** 風險匹配等級門檻，依 |gap|（個股風險分數 - 使用者風險分數 的絕對值）判定 */
export const RISK_MATCH_GAP_THRESHOLDS = {
  excellentMax: 10,
  goodMax: 25,
  fairMax: 40,
} as const;
