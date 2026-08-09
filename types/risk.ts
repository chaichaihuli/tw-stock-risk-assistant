/**
 * 使用者風險與個股風險相關型別。
 * 所有分數統一使用 0-100 區間，數值越高代表風險越高。
 */

/** 使用者風險承受等級 */
export type RiskLevel = "conservative" | "moderate" | "aggressive";

/** 收入穩定性 */
export type IncomeStability = "stable" | "variable" | "unstable";

/** 投資經驗程度 */
export type InvestmentExperience =
  | "none"
  | "beginner"
  | "intermediate"
  | "advanced";

/** 投資期限問卷選項 */
export type InvestmentHorizonAnswer =
  | "veryShort"
  | "short"
  | "mediumShort"
  | "medium"
  | "long";

/** 可接受最大回撤問卷選項 */
export type MaxDrawdownAnswer = "veryLow" | "low" | "medium" | "high";

/** 流動性需求問卷選項：多久內可能需要動用這筆資金 */
export type LiquidityNeedAnswer = "immediate" | "soon" | "later" | "notNeeded";

/** 面對投資虧損的心理反應問卷選項 */
export type LossReactionAnswer = "panicSellAll" | "sellSome" | "hold" | "buyMore";

/** 投資目標問卷選項 */
export type InvestmentGoalAnswer =
  | "majorPurchase"
  | "retirement"
  | "wealthGrowth"
  | "speculation";

/** 緊急預備金充足度問卷選項 */
export type EmergencyFundAnswer = "none" | "partial" | "full";

/** 這筆投資金額佔總資產比例問卷選項 */
export type NetWorthPercentageAnswer = "veryLarge" | "large" | "moderate" | "small";

/** 負債狀況問卷選項 */
export type DebtLevelAnswer = "heavy" | "manageable" | "none";

/** 可投資預算（資金規模）問卷選項 */
export type InvestableBudgetAnswer =
  | "under1k"
  | "1kTo10k"
  | "10kTo50k"
  | "50kTo250k"
  | "over250k";

/** 個人主觀風險偏好問卷選項：使用者自己覺得願意承擔多少風險 */
export type RiskAppetiteAnswer = "veryLow" | "low" | "medium" | "high" | "veryHigh";

/**
 * 使用者風險問卷的作答結果，用於推算 UserRiskScore。
 * 每個欄位對應 lib/risk/questionnaire.ts 裡的一道題目，欄位名稱即為題目 id。
 */
export interface UserRiskProfile {
  /** 個人主觀風險偏好：使用者自己覺得願意承擔多少風險，權重最高 */
  riskAppetite: RiskAppetiteAnswer;
  /** 投資期限 */
  investmentHorizon: InvestmentHorizonAnswer;
  /** 可接受的最大回撤 */
  maxDrawdownTolerance: MaxDrawdownAnswer;
  /** 收入穩定性 */
  incomeStability: IncomeStability;
  /** 投資經驗程度 */
  investmentExperience: InvestmentExperience;
  /** 流動性需求：多久內可能需要用到這筆錢 */
  liquidityNeed: LiquidityNeedAnswer;
  /** 面對投資組合虧損時的心理反應 */
  lossReaction: LossReactionAnswer;
  /** 投資目標 */
  investmentGoal: InvestmentGoalAnswer;
  /** 緊急預備金是否充足 */
  emergencyFund: EmergencyFundAnswer;
  /** 這筆投資金額佔目前總資產的比例 */
  netWorthPercentage: NetWorthPercentageAnswer;
  /** 負債狀況 */
  debtLevel: DebtLevelAnswer;
  /** 可投資預算（這筆資金的總額規模） */
  investableBudget: InvestableBudgetAnswer;
}

/** 使用者風險分數計算結果 */
export interface UserRiskScore {
  /** 綜合風險承受分數，0-100，越高代表可承受的風險越高 */
  score: number;
  /** 對應風險等級 */
  level: RiskLevel;
  /**
   * 可接受的個股風險分數區間（StockRiskScore.score 的範圍，0-100），供風險匹配使用。
   * 以 score 為中心，上下各留 RISK_MATCH_GAP_THRESHOLDS.goodMax 分的容忍帶。
   */
  acceptableStockRiskRange: {
    min: number;
    max: number;
  };
  /** 組成此分數的各因子（各題）明細，用於可解釋性 */
  factors: FactorScore[];
  /** 計算時間（ISO 8601） */
  calculatedAt: string;
}

/**
 * 單一因子分數，供任何「分數 + 說明」情境重複使用
 * （使用者風險因子、個股風險因子皆使用此結構以維持可解釋性一致）
 */
export interface FactorScore {
  /** 因子名稱（如 "age", "volatility_3m"） */
  name: string;
  /** 因子分數，0-100 */
  score: number;
  /** 因子在總分中的權重，0-1；若此因子非加權平均的一部分則省略 */
  weight?: number;
  /** 此分數如何得出的說明，供使用者理解計算依據 */
  description: string;
}

/** 個股風險分數的分類明細 */
export interface StockRiskBreakdown {
  /** 波動度風險（歷史波動率、Beta、最大回撤等），0-100 */
  volatility: number;
  /** 基本面風險（負債、流動性、獲利品質等），0-100 */
  fundamental: number;
  /** 估值品質風險（本益比合理性、獲利品質等），0-100 */
  valuationQuality: number;
  /** 新聞情緒與突發事件風險，0-100 */
  sentimentEvent: number;
  /** 總體經濟與產業風險，0-100 */
  macroSector: number;
}

/** 個股最終風險分數 */
export interface StockRiskScore {
  /** 股票代碼 */
  ticker: string;
  /** 綜合風險分數，0-100，越高風險越高 */
  score: number;
  /** 各類別分數明細，對應 StockRiskBreakdown 的五大類 */
  breakdown: StockRiskBreakdown;
  /** 組成分數的因子明細，用於可解釋性 UI 逐項顯示 */
  factors: FactorScore[];
  /** 本次計算時間（ISO 8601） */
  calculatedAt: string;
  /**
   * 因資料缺失而未能納入計算的因子名稱列表；
   * 呼叫端應據此提示使用者分數可信度可能受影響
   */
  missingFactors: string[];
}

/** 個股與使用者風險的匹配程度 */
export type RiskMatchLevel = "excellent" | "good" | "fair" | "poor";

/** 個股與使用者風險的匹配結果 */
export interface RiskMatchResult {
  /** 股票代碼 */
  ticker: string;
  /** 個股風險分數，引用自 StockRiskScore.score */
  stockRiskScore: number;
  /** 使用者風險分數，引用自 UserRiskScore.score */
  userRiskScore: number;
  /** 差距 = stockRiskScore - userRiskScore；正值代表股票風險高於使用者承受度 */
  gap: number;
  /** 依 gap 大小換算出的匹配等級 */
  matchLevel: RiskMatchLevel;
}
