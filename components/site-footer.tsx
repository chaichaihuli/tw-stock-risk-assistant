import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto flex w-full justify-center border-t bg-white/80 py-4 dark:bg-black/80">
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground">
        <span>台股風險評估助手僅為研究輔助工具，不構成投資建議。</span>
        <Link href="/guide" className="underline underline-offset-2 hover:text-foreground">
          使用指南
        </Link>
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          隱私權政策
        </Link>
      </div>
    </footer>
  );
}
