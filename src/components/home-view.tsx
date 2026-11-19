"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE } from "@/lib/buckets";
import { EFFECTIVE_RANK, formatLongToday, greeting, type Effective } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { WINDOW_LABEL, type Domain, type Task, type WorkWindow } from "@/lib/types";
import { TaskRow } from "./task-row";
import { QuickAdd } from "./quick-add";

const BUCKET_KEY = "nf:home-bucket";

function readSavedBucket(): string | null {
  try {
    return localStorage.getItem(BUCKET_KEY);
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function HomeView() {
  const { domains, workspace } = useStore();
  // Remembered tab (phone): read after hydration so server and client HTML match.
  const saved = useSyncExternalStore(subscribeStorage, readSavedBucket, () => null);
  const [chosen, setChosen] = useState<string | null>(null);
  const bucket =
    chosen ?? (saved && domains.some((d) => d.id === saved) ? saved : (domains[0]?.id ?? ""));
  const hello = { date: formatLongToday(workspace.timezone), greet: greeting(workspace.timezone) };

  function chooseBucket(id: string) {
    setChosen(id);
    try {
      localStorage.setItem(BUCKET_KEY, id);
    } catch {}
  }

  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-10 md:px-9 md:pt-9 md:pl-5">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span suppressHydrationWarning className="min-h-5 text-[13px] font-medium text-muted-foreground">
            {hello.date}
          </span>
          <h1 suppressHydrationWarning className="text-2xl font-bold tracking-tight md:text-[28px]">
            {hello.greet}, Neta ☕
          </h1>
        </div>
        <div className="w-full md:ml-auto md:w-auto md:min-w-[380px]">
          <QuickAdd domainId={bucket} onDomainChange={chooseBucket} />
        </div>
      </header>

      {/* Phone: one bucket at a time */}
      <div role="tablist" aria-label="Bucket" className="grid grid-cols-3 gap-1 rounded-[14px] bg-secondary p-1 md:hidden">
        {domains.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={bucket === d.id}
            onClick={() => chooseBucket(d.id)}
            className={cn(
              "rounded-[11px] px-1 py-2.5 text-[13px] font-semibold text-secondary-foreground",
              bucket === d.id && cn("bg-card shadow-sm", BUCKET_STYLE[d.slug].ink),
            )}
          >
            {d.emoji} {d.slug === "tmr" ? "TMR" : d.name}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-[18px] md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {domains.map((d) => (
          <BucketCard key={d.id} domain={d} hiddenOnPhone={bucket !== d.id} />
        ))}
      </div>

      <p className="hidden text-[13px] text-muted-foreground md:block">
        ☐ all done · point at a task for ⏳ waiting on others and 🌙 done for today · the next task slides up into its spot.
      </p>
    </main>
  );
}

const GROUP_ORDER: Effective[] = ["today", "tomorrow", "this_week", "next_week", "someday"];

function BucketCard({ domain, hiddenOnPhone }: { domain: Domain; hiddenOnPhone: boolean }) {
  const { tasks, domainOfTask, isOnMyPlate, effective, personById, setWindow } = useStore();
  const [expanded, setExpanded] = useState(false);
  const style = BUCKET_STYLE[domain.slug];

  const inBucket = tasks.filter((t) => domainOfTask(t)?.id === domain.id && t.status !== "done");
  const mine = inBucket.filter(isOnMyPlate);
  const withEff = mine.map((t) => ({ t, e: effective(t) }));
  const byRank = (a: { t: Task; e: Effective }, b: { t: Task; e: Effective }) =>
    EFFECTIVE_RANK[a.e] - EFFECTIVE_RANK[b.e] || a.t.sort_order - b.t.sort_order;

  const passed = withEff.filter((x) => x.e === "passed").map((x) => x.t);
  const candidates = withEff.filter((x) => x.e === "today").sort(byRank);
  const upNext = candidates.slice(0, 3).map((x) => x.t);
  const upNextIds = new Set(upNext.map((t) => t.id));
  const rest = withEff.filter((x) => x.e !== "passed" && !upNextIds.has(x.t.id)).sort(byRank);
  const todayCount = withEff.filter((x) => x.e === "today").length;
  const othersCount = inBucket.filter((t) => {
    if (t.status === "waiting") return true;
    const a = t.assignee_id ? personById.get(t.assignee_id) : undefined;
    return a?.type === "person" || a?.type === "org";
  }).length;

  const replan = passed[0];

  return (
    <section
      aria-label={domain.name}
      className={cn(
        "flex flex-col overflow-hidden rounded-[20px] bg-card shadow-[0_1px_2px_rgba(35,33,43,.05),0_8px_24px_rgba(35,33,43,.05)]",
        hiddenOnPhone && "hidden md:flex",
      )}
    >
      <Link href={`/b/${domain.slug}`} className={cn("flex items-center gap-2.5 px-[18px] py-4", style.tint)}>
        <span className="text-xl" aria-hidden="true">
          {domain.emoji}
        </span>
        <h2 className={cn("text-base font-bold", style.ink)}>{domain.name}</h2>
        <span className={cn("ml-auto text-xs font-semibold", style.ink)}>
          {todayCount ? `${todayCount} today` : `${mine.length} open`}
        </span>
      </Link>

      <div className="flex flex-col px-2.5 pt-3.5 pb-1">
        <span className="px-2 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">UP NEXT</span>
        {upNext.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-2 pt-3 pb-5 text-center">
            <span className="text-3xl" aria-hidden="true">
              🎉
            </span>
            <p className="text-[15px] font-bold">Today&apos;s clear!</p>
            <p className="text-[13px] text-muted-foreground">Nothing left for today here. Enjoy it.</p>
          </div>
        ) : (
          upNext.map((t) => <TaskRow key={t.id} task={t} />)
        )}
      </div>

      {replan && (
        <div className="mx-3 mt-1 mb-2 flex flex-col gap-2.5 rounded-[14px] bg-accent p-3 pl-3.5">
          <div className="flex items-start gap-2">
            <span aria-hidden="true">🗓</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span dir="auto" className="text-[13px] font-semibold">
                {replan.title}
              </span>
              <span className="text-xs text-muted-foreground">
                Its day passed. When&apos;s a better time?
                {passed.length > 1 ? ` (+${passed.length - 1} more)` : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["today", "tomorrow", "this_week", "next_week"] as WorkWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(replan.id, w)}
                className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-secondary-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-secondary"
              >
                {WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      )}

      {expanded && rest.length > 0 && (
        <div className="flex flex-col border-t px-2.5 py-2">
          {GROUP_ORDER.map((g) => {
            const group = rest.filter((x) => x.e === g);
            if (!group.length) return null;
            return (
              <div key={g} className="flex flex-col">
                <span className="px-2 pt-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
                  {WINDOW_LABEL[g as WorkWindow].toUpperCase()}
                </span>
                {group.map((x) => (
                  <TaskRow key={x.t.id} task={x.t} showWindow={false} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex items-center border-t">
        {rest.length > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex flex-1 items-center gap-2 px-[18px] py-3.5 text-left",
              upNext.length ? cn("text-[13px] font-semibold", style.ink) : "text-xs text-muted-foreground hover:text-foreground",
            )}
          >
            {expanded ? "Show less" : upNext.length ? `See ${rest.length} more` : `See upcoming tasks (${rest.length})`}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className={cn("transition-transform", expanded && "rotate-180")}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {othersCount > 0 && (
          <Link href="/others" className="px-[18px] py-3.5 text-xs text-muted-foreground hover:text-foreground">
            🤝 {othersCount} with others
          </Link>
        )}
      </div>
    </section>
  );
}
