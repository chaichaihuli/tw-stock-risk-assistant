import { StockRiskLookup } from "@/components/stock-risk-lookup";

export default function StockLookupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">個股風險係數查詢</h1>
          <p className="text-sm text-muted-foreground">
            輸入台股代碼，查看即時計算的多因子風險分數。
          </p>
        </div>

        <div
          role="note"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <strong className="font-medium">免責聲明：</strong>
          本系統僅為研究輔助工具，計算結果不構成投資建議，投資前請自行判斷並承擔風險。
        </div>

        <StockRiskLookup />
      </main>
    </div>
  );
}
