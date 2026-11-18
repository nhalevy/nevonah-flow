"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE } from "@/lib/buckets";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-[30px] items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 14c3-6 6 2 9-4s5-2 7-4" />
          <path d="M4 19c3-6 6 2 9-4s5-2 7-4" opacity=".5" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-[0.06em]">NEVONAH FLOW</span>
    </span>
  );
}

function NavLink({ href, active, children, count }: { href: string; active: boolean; children: React.ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-card/70",
        active && "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(35,33,43,.06)]",
      )}
    >
      {children}
      {count ? <span className="ml-auto text-xs font-normal text-muted-foreground">{count}</span> : null}
    </Link>
  );
}

export function useWithOthersCount() {
  const { tasks, personById } = useStore();
  return tasks.filter((t) => {
    if (t.status === "done") return false;
    if (t.status === "waiting") return true;
    const a = t.assignee_id ? personById.get(t.assignee_id) : undefined;
    return a?.type === "person" || a?.type === "org";
  }).length;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { domains } = useStore();
  const othersCount = useWithOthersCount();

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Desktop sidebar */}
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-1 px-4 py-7 md:flex">
        <Link href="/" className="mb-6 px-2.5">
          <Logo />
        </Link>
        <NavLink href="/" active={pathname === "/"}>
          ✨ Home
        </NavLink>
        <NavLink href="/others" active={pathname === "/others"} count={othersCount}>
          🤝 With Others
        </NavLink>
        <NavLink href="/search" active={pathname === "/search"}>
          🔎 Search
        </NavLink>
        <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">BUCKETS</p>
        {domains.map((d) => (
          <NavLink key={d.id} href={`/b/${d.slug}`} active={pathname === `/b/${d.slug}`}>
            <span className={cn("size-2.5 rounded-[4px]", BUCKET_STYLE[d.slug].dot)} aria-hidden="true" />
            {d.name}
          </NavLink>
        ))}
        <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">TEAM</p>
        <NavLink href="/people" active={pathname === "/people"}>
          👥 People
        </NavLink>
        <div className="mt-auto">
          <NavLink href="/settings" active={pathname === "/settings"}>
            ⚙️ Settings
          </NavLink>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">{children}</div>

      {/* Phone bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card px-1.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[
          { href: "/", icon: "✨", label: "Home", active: pathname === "/" },
          { href: "/b/personal", icon: "🗂", label: "Boards", active: pathname.startsWith("/b/") },
          { href: "/others", icon: "🤝", label: "Others", active: pathname === "/others" },
          { href: "/people", icon: "👥", label: "People", active: pathname === "/people" || pathname === "/settings" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[11px] text-secondary-foreground",
              item.active && "font-bold text-foreground",
            )}
          >
            <span className="text-lg" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
