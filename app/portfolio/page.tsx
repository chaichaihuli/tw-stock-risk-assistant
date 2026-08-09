import { PortfolioRiskCalculator } from "@/components/portfolio-risk-calculator";

export default function PortfolioPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">投資組合風險計算</h1>
          <p className="text-sm text-muted-foreground">
            輸入多檔台股代碼與權重，計算整體投資組合的風險分數。
          </p>
        </div>

        <div
          role="note"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <strong className="font-medium">免責聲明：</strong>
          本系統僅為研究輔助工具，計算結果不構成投資建議，投資前請自行判斷並承擔風險。
        </div>

        <PortfolioRiskCalculator />
      </main>
    </div>
  );
}
