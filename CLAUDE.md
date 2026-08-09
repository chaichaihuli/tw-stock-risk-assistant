# Project: 台股風險評估助手（tw-stock-risk-assistant）

## Why
一個台股投資輔助系統。根據使用者條件計算風險承受係數，再結合股價數據、財報、新聞情緒與總體經濟環境，為個股計算多因子風險分數，並推薦風險匹配的標的。

本專案是 `us-stock-risk-assistant`（美股版）的姊妹專案，沿用同一套風險評分方法論與 Next.js 架構，資料來源與部分風險因子改為台股適用版本。兩個專案完全獨立，互不影響、分開部署。

## What
- 技術棧：Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Zustand
- 核心功能：使用者風險問卷、個股多因子風險評分、風險匹配推薦
- 資料來源：Yahoo Finance（報價、基本面、產業 ETF 相對表現，支援 `.TW` 上市／`.TWO` 上櫃代碼）
- 重要：本系統僅為研究輔助工具，不構成投資建議，需有明顯 Disclaimer

## v1 已知資料缺口（明確排除，不是 bug）

以下項目已實測確認台股缺乏對應的免費公開資料源，v1 讓對應風險因子透過既有的
「缺失值以中性分數代入 + 記錄進 `missingFactors`」機制處理（`lib/risk/utils.ts`
`weightedAverageSkipMissing`），而不是報錯或算出失真分數：

- **新聞情緒分析**：Finnhub 免費方案對台股回傳 `"You don't have access to this resource."`，
  Yahoo Finance 附帶的新聞也不是台股相關新聞。`sentimentEvent` 因子固定以中性值代入
  （`lib/data/buildStockRiskInputs.ts` 的 `news` 固定傳空陣列）。
- **台灣總經指標**：FRED 對台灣的月頻總經資料（利率、失業率）覆蓋很薄，
  `lib/risk/macroSector.ts` 的 `policyRate`／`yieldCurveSpread`／`unemploymentRate`
  三個子指標固定為 `null`，只有 `vix`（全球 CBOE VIX，近似代理指標）有真實資料。
- 若之後要補上這兩塊，優先研究：新聞可考慮台灣證交所 MOPS 重大訊息公開資料；
  總經指標可考慮 data.gov.tw（主計總處／中央銀行開放資料）。

## How
### Commands
- `npm run dev`：啟動開發伺服器
- `npm run build`：正式建置
- `npm run lint`：檢查程式碼

### Conventions
- 使用 TypeScript strict
- 所有風險計算邏輯集中在 `/lib/risk` 目錄
- 數值計算要有清楚註解與可解釋性
- 優先做可運作的核心流程，再優化 UI 與進階因子
- 敏感資訊使用環境變數，不要寫死 API Key（v1 目前所有資料源皆免金鑰，Yahoo Finance 為非官方套件）
- 每次涉及金融計算都要考慮缺失值處理
- 股票代碼格式：上市加 `.TW`（如 `2330.TW` 台積電），上櫃加 `.TWO`（如 `6488.TWO` 環球晶）
- 幣別：所有金額欄位皆為新台幣（TWD）

### Architecture
- `/app`：頁面
- `/components`：UI 元件
- `/lib/risk`：風險評分邏輯（大多與美股版共用同一套邏輯，只有 `macroSector.ts` 因資料源差異而不同）
- `/lib/data`：資料抓取與快取（只用 Yahoo Finance，無 Finnhub／FRED）
- `/types`：型別定義
