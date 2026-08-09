import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "風險問卷" },
  { href: "/stock-lookup", label: "個股風險查詢" },
  { href: "/portfolio", label: "投資組合風險" },
  { href: "/watchlist", label: "觀察清單" },
];

export function SiteNav() {
  return (
    <nav className="flex w-full justify-center border-b bg-white/80 backdrop-blur dark:bg-black/80">
      <div className="flex w-full max-w-2xl items-center gap-4 px-4 py-3">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
