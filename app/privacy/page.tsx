import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">隱私權政策</h1>
          <p className="text-sm text-muted-foreground">最後更新：2026-08-09</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">你在網站上輸入的資料</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">風險問卷作答與計算結果：</span>
              只暫存在你這次瀏覽分頁的記憶體中，不會寫入 cookie，也不會上傳到我們的伺服器或任何資料庫。關閉分頁或重新整理頁面，這份資料就會消失。
            </p>
            <p>
              <span className="font-medium text-foreground">觀察清單：</span>
              儲存在你瀏覽器的本機儲存空間（localStorage），只留在你自己的裝置上，我們的伺服器完全不會收到這份清單。清除瀏覽器資料或換一台裝置，這份清單就不會同步過去。
            </p>
            <p>
              <span className="font-medium text-foreground">股票代碼查詢：</span>
              當你查詢一檔股票時，代碼會送到我們的伺服器，再由伺服器向 Yahoo Finance 等公開資料源取得報價與財報數據來計算風險分數。這些查詢不會與任何個人身分綁定——本網站沒有帳號系統、沒有登入機制。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">我們不會收集的資料</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              風險問卷全部是單選題，不會要求填寫姓名、電子郵件、電話、身分證件、銀行或券商帳號等任何可識別個人身分的資訊。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">追蹤與第三方工具</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>目前網站沒有安裝任何流量分析工具或廣告追蹤程式碼，也沒有使用追蹤型 cookie。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">資料來源</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>股價與財報數據來自 Yahoo Finance。</p>
            <p>
              目前尚未接上台灣總體經濟指標與新聞情緒分析資料源，對應的風險因子會以中性值代入計算，並在查詢結果中標示為資料缺失。
            </p>
            <p>以上皆為外部服務，資料的正確性與可用性不在我們的控制範圍內，僅供研究參考。</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          本系統僅為研究輔助工具，計算結果不構成投資建議，投資前請自行判斷並承擔風險。
        </p>
      </main>
    </div>
  );
}
