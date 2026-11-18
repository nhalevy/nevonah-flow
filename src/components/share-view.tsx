"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE, detectProvider } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const URL_RE = /https?:\/\/[^\s]+/i;

/** Landing page for the Android share sheet and the desktop bookmark button. */
export function ShareView() {
  const params = useSearchParams();
  const router = useRouter();
  const { tasks, domains, projects, domainOfTask, addTask, openTask } = useStore();

  const rawText = params.get("text") ?? "";
  const url = params.get("url") || rawText.match(URL_RE)?.[0] || "";
  const sharedTitle = (params.get("title") || rawText.replace(URL_RE, "")).trim();
  const { label } = detectProvider(url);

  const [mode, setMode] = useState<"attach" | "new">("attach");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState(sharedTitle.replace(/\s*[-|–]\s*(Claude|ChatGPT)$/i, ""));
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const query = q.trim().toLowerCase();
  const open = tasks.filter((t) => t.status !== "done" && (!query || t.title.toLowerCase().includes(query)));

  async function saveLink(task: Pick<Task, "id" | "workspace_id">) {
    const { provider } = detectProvider(url);
    const { error } = await createClient()
      .from("task_links")
      .insert({ workspace_id: task.workspace_id, task_id: task.id, url, provider, title: sharedTitle || label });
    if (error) throw new Error(error.message);
  }

  async function attach(task: Task) {
    setBusy(true);
    try {
      await saveLink(task);
      toast(`🔗 Attached to “${task.title}”`);
      router.replace("/");
      openTask(task.id);
    } catch (e) {
      toast.error(`Couldn't attach: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  async function createNew(e: React.FormEvent) {
    e.preventDefault();
    const projectId = projects.find((p) => p.domain_id === domainId && !p.archived_at)?.id;
    if (!title.trim() || !projectId) return;
    setBusy(true);
    const task = await addTask({ title, projectId });
    if (!task) return setBusy(false);
    try {
      if (url) await saveLink(task);
      toast("✨ Task added with the link");
      router.replace("/");
    } catch (err) {
      toast.error(`Task added, but the link failed: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  if (!url) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-8">
        <h1 className="text-2xl font-bold tracking-tight">🔗 Save a link</h1>
        <p className="text-sm text-muted-foreground">Nothing was shared. Use Share in another app, or the bookmark button on your computer.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-6 pb-10 md:pt-9">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">🔗 Save this {label === "Link" ? "link" : `${label} link`}</h1>
        <div className="rounded-2xl bg-card px-4 py-3 text-sm shadow-[0_1px_2px_rgba(35,33,43,.05)]">
          {sharedTitle && (
            <p dir="auto" className="font-semibold">
              {sharedTitle}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        </div>
      </header>

      <div role="tablist" aria-label="What to do" className="grid grid-cols-2 gap-1 rounded-[14px] bg-secondary p-1">
        {(
          [
            ["attach", "Add to a task"],
            ["new", "New task"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn("rounded-[11px] py-2.5 text-[13px] font-semibold text-secondary-foreground", mode === id && "bg-card text-foreground shadow-sm")}
          >
            {text}
          </button>
        ))}
      </div>

      {mode === "attach" ? (
        <div className="flex flex-col gap-4">
          <label htmlFor="share-search" className="sr-only">
            Find a task
          </label>
          <input
            id="share-search"
            dir="auto"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find the task…"
            className="h-11 rounded-xl bg-card px-4 text-[15px] shadow-[0_1px_2px_rgba(35,33,43,.05)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {domains.map((d) => {
            const list = open.filter((t) => domainOfTask(t)?.id === d.id).slice(0, query ? 20 : 6);
            if (!list.length) return null;
            return (
              <section key={d.id} className="overflow-hidden rounded-[18px] bg-card">
                <h2 className={cn("px-4 py-2.5 text-xs font-bold", BUCKET_STYLE[d.slug].tint, BUCKET_STYLE[d.slug].ink)}>
                  {d.emoji} {d.name}
                </h2>
                {list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => attach(t)}
                    dir="auto"
                    className="block w-full border-t px-4 py-3 text-left text-sm font-semibold first:border-t-0 hover:bg-accent"
                  >
                    {t.title}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <form onSubmit={createNew} className="flex flex-col gap-3 rounded-[18px] bg-card p-4">
          <label htmlFor="share-title" className="text-sm font-semibold">
            Task name
          </label>
          <input
            id="share-title"
            dir="auto"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl bg-accent px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div role="group" aria-label="Bucket" className="grid grid-cols-3 gap-1.5">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={domainId === d.id}
                onClick={() => setDomainId(d.id)}
                className={cn(
                  "rounded-xl py-2.5 text-[13px] font-semibold",
                  domainId === d.id ? cn(BUCKET_STYLE[d.slug].tint, BUCKET_STYLE[d.slug].ink) : "bg-accent text-secondary-foreground",
                )}
              >
                {d.emoji} {d.slug === "tmr" ? "TMR" : d.name}
              </button>
            ))}
          </div>
          <button type="submit" disabled={busy} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            Add task with link
          </button>
        </form>
      )}
    </main>
  );
}
