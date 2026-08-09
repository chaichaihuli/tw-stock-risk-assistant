import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    href: "/",
    title: "1. 風險問卷",
    body: "回答 12 題選擇題，算出你的「風險承受分數」（0-100，越高代表能承受的風險越高）與可接受的個股風險區間。這份結果只存在這次瀏覽的分頁裡，重新整理會消失，之後其他頁面的「適合度比對」都要靠這一步先算出結果。",
  },
  {
    href: "/",
    title: "2. 推薦股票 / 查詢特定股票（在問卷頁下方）",
    body: "填完問卷後，頁面下方會出現「推薦股票」，依候選股票池即時計算風險分數並排序，可以按「換一批」看下一批候選股票；旁邊的「查詢特定股票」可以直接輸入你自己想看的代碼，跟你的風險分數做比對。兩者都會顯示「適合／臨界／不適合」與白話原因。",
  },
  {
    href: "/stock-lookup",
    title: "3. 個股風險查詢",
    body: "輸入任一台股代碼（如 2330.TW），查看完整的多因子風險分數拆解（波動度、基本面、估值品質、新聞情緒、總經/產業）與白話說明。如果你已經在第 1 步填過問卷，這裡會多顯示一塊「與你的風險承受度比對」。",
  },
  {
    href: "/portfolio",
    title: "4. 投資組合風險計算",
    body: "輸入多檔股票代碼與各自的權重（不用先換算成 100%），計算整個投資組合的加權風險分數，同樣會跟你的風險承受度比對。",
  },
  {
    href: "/watchlist",
    title: "5. 觀察清單",
    body: "在任何看到股票代碼的地方按「加入觀察清單」，之後到這一頁按「更新全部風險分數」，就能一次看到所有收藏股票的最新風險分數。這份清單存在你瀏覽器的本機儲存，換裝置或清瀏覽器資料不會保留。",
  },
];

export default function GuidePage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">使用指南</h1>
          <p className="text-sm text-muted-foreground">
            建議按照下面的順序操作，1、2 兩步做完後，其他頁面才能顯示「是否適合你」的比對結果。
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((step) => (
            <Card key={step.title}>
              <CardHeader>
                <CardTitle className="text-lg">
                  <Link href={step.href} className="hover:underline">
                    {step.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          本系統僅為研究輔助工具，計算結果不構成投資建議，投資前請自行判斷並承擔風險。
        </p>
      </main>
    </div>
  );
}
