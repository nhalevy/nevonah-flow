"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import { TaskRow } from "./task-row";

/** Search all open tasks. Results stay grouped by bucket — never mixed. */
export function SearchView() {
  const { tasks, domains, domainOfTask, personById } = useStore();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = query
    ? tasks.filter((t) => {
        if (t.status === "done") return false;
        const who = [t.assignee_id, t.waiting_on_id].map((id) => (id ? personById.get(id)?.name ?? "" : "")).join(" ");
        return `${t.title} ${t.brief ?? ""} ${who}`.toLowerCase().includes(query);
      })
    : [];

  return (
    <main className="flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-10 md:px-8 md:pt-9 md:pl-4">
      <h1 className="text-2xl font-bold tracking-tight">🔎 Search</h1>
      <label htmlFor="search" className="sr-only">
        Search tasks
      </label>
      <input
        id="search"
        dir="auto"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tasks, briefs, people…"
        className="h-12 rounded-2xl bg-card px-4 text-[15px] shadow-[0_1px_2px_rgba(35,33,43,.05)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {query && matches.length === 0 && <p className="text-sm text-muted-foreground">Nothing found.</p>}
      {domains.map((d) => {
        const list = matches.filter((t) => domainOfTask(t)?.id === d.id);
        if (!list.length) return null;
        return (
          <section key={d.id} className="overflow-hidden rounded-[20px] bg-card shadow-[0_1px_2px_rgba(35,33,43,.05)]">
            <h2 className={cn("px-4 py-3 text-sm font-bold", BUCKET_STYLE[d.slug].tint, BUCKET_STYLE[d.slug].ink)}>
              {d.emoji} {d.name} · {list.length}
            </h2>
            <div className="p-2">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
