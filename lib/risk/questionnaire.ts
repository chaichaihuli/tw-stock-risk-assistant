import type { UserRiskProfile } from "@/types/risk";

/** 問卷單一選項：使用者看到的文字、儲存的值，以及對應的風險容忍分數（0-100，越高代表越能承受風險） */
export interface RiskQuestionnaireOption {
  value: string;
  label: string;
  score: number;
}

/** 問卷單一題目：id 對應 UserRiskProfile 的欄位名稱，weight 為此題在總分中的權重 */
export interface RiskQuestionnaireQuestion {
  id: keyof UserRiskProfile;
  question: string;
  weight: number;
  options: RiskQuestionnaireOption[];
}

/**
 * 使用者風險問卷的權威定義：題目文字、選項與各選項對應的風險容忍分數都集中在這裡，
 * UI 端可直接讀這份清單渲染表單，lib/risk/userRiskScore.ts 也讀同一份清單計分，
 * 避免題目內容跟計分邏輯分散在兩處而不同步。
 *
 * 十二題權重總和為 1：
 * riskAppetite 0.50 + maxDrawdownTolerance 0.07 + lossReaction 0.07 +
 * investmentHorizon 0.06 + liquidityNeed 0.05 + emergencyFund 0.05 +
 * netWorthPercentage 0.04 + incomeStability 0.04 + investmentExperience 0.04 +
 * investmentGoal 0.04 + debtLevel 0.03 + investableBudget 0.01 = 1
 *
 * 權重分配的邏輯：riskAppetite（使用者自己覺得願意承擔多少風險）拿到單題 0.5 的
 * 主導權重；其餘題目維持原本的相對排序（心理／行為類因子最重、期限/流動性/
 * 緊急預備金次之、背景因子再次之、負債與預算最弱），只是整體等比例縮小
 * （乘上 0.625）騰出空間給 riskAppetite。
 *
 * 注意：自陳式的風險偏好容易有過度自信偏誤（多數人在還沒真的虧錢之前都會高估
 * 自己能承受的風險），riskAppetite 拉到 0.5 之後，這份分數會比之前更貼近使用者
 * 「自己覺得」的風險承受度、更少受 maxDrawdownTolerance、lossReaction 這類情境式
 * 交叉驗證題目的制衡——這是刻意的權衡，不是忽略了這個風險。
 */
export const RISK_QUESTIONNAIRE: RiskQuestionnaireQuestion[] = [
  {
    id: "riskAppetite",
    question: "整體來說，你覺得自己願意承擔多少投資風險？",
    weight: 0.5,
    options: [
      { value: "veryLow", label: "完全不想冒風險，穩定為主", score: 5 },
      { value: "low", label: "偏保守，能接受一點點風險", score: 30 },
      { value: "medium", label: "中等，希望風險與報酬平衡", score: 55 },
      { value: "high", label: "偏積極，願意承擔較高風險換取更高報酬", score: 80 },
      { value: "veryHigh", label: "非常積極，樂於承擔高風險追求高報酬", score: 100 },
    ],
  },
  {
    id: "investmentHorizon",
    question: "這筆錢預計投資多久？",
    weight: 0.06,
    options: [
      { value: "veryShort", label: "3 個月以內", score: 5 },
      { value: "short", label: "3 個月～1 年", score: 30 },
      { value: "mediumShort", label: "1～3 年", score: 55 },
      { value: "medium", label: "3～7 年", score: 80 },
      { value: "long", label: "7 年以上", score: 100 },
    ],
  },
  {
    id: "maxDrawdownTolerance",
    question: "如果投資組合短期內下跌，你能接受的最大跌幅大概是多少？",
    weight: 0.07,
    options: [
      { value: "veryLow", label: "幾乎不能接受虧損（5% 以內）", score: 5 },
      { value: "low", label: "5%～15%", score: 35 },
      { value: "medium", label: "15%～30%", score: 65 },
      { value: "high", label: "30% 以上也能接受", score: 100 },
    ],
  },
  {
    id: "incomeStability",
    question: "你目前的收入穩定性如何？",
    weight: 0.04,
    options: [
      { value: "stable", label: "穩定（正職、公務員等固定收入）", score: 100 },
      { value: "variable", label: "浮動（業績抽成、自由業等）", score: 60 },
      { value: "unstable", label: "不穩定（待業中、收入不確定）", score: 20 },
    ],
  },
  {
    id: "investmentExperience",
    question: "你的投資經驗大概是？",
    weight: 0.04,
    options: [
      { value: "none", label: "完全沒有經驗", score: 20 },
      { value: "beginner", label: "略懂，投資不到 2 年", score: 40 },
      { value: "intermediate", label: "有一定經驗，投資 2～5 年", score: 70 },
      { value: "advanced", label: "資深投資人，5 年以上或具專業背景", score: 100 },
    ],
  },
  {
    id: "liquidityNeed",
    question: "你多久內可能需要動用到這筆資金？",
    weight: 0.05,
    options: [
      { value: "immediate", label: "3 個月內可能需要", score: 5 },
      { value: "soon", label: "6 個月～1 年內可能需要", score: 35 },
      { value: "later", label: "1～3 年內可能需要", score: 65 },
      { value: "notNeeded", label: "3 年以上都不需要動用", score: 100 },
    ],
  },
  {
    id: "lossReaction",
    question: "如果你的投資組合一個月內下跌 20%，你比較可能會怎麼做？",
    weight: 0.07,
    options: [
      { value: "panicSellAll", label: "非常焦慮，可能會全部賣出", score: 5 },
      { value: "sellSome", label: "會緊張，可能賣出一部分", score: 35 },
      { value: "hold", label: "會擔心，但傾向持有觀望", score: 65 },
      { value: "buyMore", label: "視為加碼機會，考慮逢低買進", score: 100 },
    ],
  },
  {
    id: "investmentGoal",
    question: "這筆投資的主要目標是什麼？",
    weight: 0.04,
    options: [
      {
        value: "majorPurchase",
        label: "短中期大額支出（買房頭期款、子女教育金等）",
        score: 20,
      },
      { value: "retirement", label: "退休規劃", score: 55 },
      { value: "wealthGrowth", label: "長期累積財富", score: 75 },
      { value: "speculation", label: "短期積極獲利／投機", score: 100 },
    ],
  },
  {
    id: "emergencyFund",
    question: "除了這筆投資，你是否另外準備了緊急預備金？",
    weight: 0.05,
    options: [
      { value: "none", label: "沒有額外準備", score: 15 },
      { value: "partial", label: "有部分準備（大約 1～6 個月生活費）", score: 50 },
      { value: "full", label: "已有完整緊急預備金（6 個月以上生活費）", score: 100 },
    ],
  },
  {
    id: "netWorthPercentage",
    question: "這筆投資金額大概佔你目前總資產（存款、投資、不動產等）的比例？",
    weight: 0.04,
    options: [
      { value: "veryLarge", label: "50% 以上", score: 10 },
      { value: "large", label: "20%～50%", score: 35 },
      { value: "moderate", label: "5%～20%", score: 70 },
      { value: "small", label: "5% 以下", score: 100 },
    ],
  },
  {
    id: "debtLevel",
    question: "你目前的負債狀況是？",
    weight: 0.03,
    options: [
      {
        value: "heavy",
        label: "負債負擔較重（例如高利率卡債、還款壓力大）",
        score: 20,
      },
      { value: "manageable", label: "有房貸／車貸等，但在可負擔範圍內", score: 60 },
      { value: "none", label: "沒有負債", score: 100 },
    ],
  },
  {
    id: "investableBudget",
    question: "這筆用來投資的資金總額大概是多少（新台幣）？",
    weight: 0.01,
    options: [
      { value: "under1k", label: "NT$3萬 以下", score: 40 },
      { value: "1kTo10k", label: "NT$3萬～NT$30萬", score: 50 },
      { value: "10kTo50k", label: "NT$30萬～NT$150萬", score: 60 },
      { value: "50kTo250k", label: "NT$150萬～NT$750萬", score: 75 },
      { value: "over250k", label: "NT$750萬 以上", score: 90 },
    ],
  },
];
