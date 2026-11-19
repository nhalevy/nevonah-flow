"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useOpenTask } from "@/lib/open-task";
import { prefetchExtras } from "@/lib/task-extras";
import { BUCKET_STYLE } from "@/lib/buckets";
import { EFFECTIVE_RANK, formatShortDate, type Effective } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { NEW_TASK_TITLE, STATUS_LABEL, WINDOW_LABEL, type Project, type Task } from "@/lib/types";
import { Avatar } from "./avatar";
import { CheckButton } from "./task-row";

type Filter = "all" | "today" | "tomorrow" | "this_week" | "waiting" | "ai";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This week" },
  { id: "waiting", label: "⏳ Waiting" },
  { id: "ai", label: "🤖 With AI" },
];

export function BoardView({ slug }: { slug: string }) {
  const { domains, projects, tasks, domainOfTask, effective, personById } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const domain = domains.find((d) => d.slug === slug);

  if (!domain) {
    return (
      <main className="px-6 py-10">
        <p className="text-sm text-muted-foreground">
          This bucket doesn&apos;t exist. <Link href="/" className="underline">Go home</Link>
        </p>
      </main>
    );
  }

  const style = BUCKET_STYLE[domain.slug];
  const columns = projects.filter((p) => p.domain_id === domain.id && !p.archived_at);
  const open = tasks.filter((t) => t.status !== "done" && domainOfTask(t)?.id === domain.id);

  const passes = (t: Task) => {
    const e = effective(t);
    switch (filter) {
      case "all":
        return true;
      case "today":
        return e === "today" || e === "passed";
      case "tomorrow":
        return e === "tomorrow";
      case "this_week":
        return e === "today" || e === "tomorrow" || e === "this_week";
      case "waiting":
        return t.status === "waiting";
      case "ai":
        return (t.assignee_id ? personById.get(t.assignee_id)?.type : null) === "ai";
    }
  };

  const todayCount = open.filter((t) => effective(t) === "today").length;

  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pl-4">
      {/* bucket switcher (mostly for phone) */}
      <div role="tablist" aria-label="Bucket" className="grid grid-cols-3 gap-1 rounded-[14px] bg-secondary p-1 md:hidden">
        {domains.map((d) => (
          <Link
            key={d.id}
            href={`/b/${d.slug}`}
            role="tab"
            aria-selected={d.id === domain.id}
            className={cn(
              "rounded-[11px] px-1 py-2.5 text-center text-[13px] font-semibold text-secondary-foreground",
              d.id === domain.id && cn("bg-card shadow-sm", BUCKET_STYLE[d.slug].ink),
            )}
          >
            {d.emoji} {d.slug === "tmr" ? "TMR" : d.name}
          </Link>
        ))}
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl text-xl", style.tint)} aria-hidden="true">
          {domain.emoji}
        </span>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
          <span className="text-[13px] text-muted-foreground">
            {open.length} open · {todayCount} today
          </span>
        </div>
      </header>

      <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-secondary-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[repeat(auto-fit,minmax(270px,1fr))]">
        {columns.map((p) => (
          <Column
            key={p.id}
            project={p}
            tasks={open
              .filter((t) => t.project_id === p.id && passes(t))
              .sort((a, b) => rank(effective(a)) - rank(effective(b)) || a.sort_order - b.sort_order)}
          />
        ))}
      </div>
    </main>
  );
}

function rank(e: Effective) {
  return EFFECTIVE_RANK[e];
}

function Column({ project, tasks }: { project: Project; tasks: Task[] }) {
  const { addTask } = useStore();
  const openTask = useOpenTask();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const value = title;
    setTitle("");
    const created = await addTask({ title: value, projectId: project.id });
    if (!created) setTitle(value);
  }

  async function addWithDetails() {
    const value = title.trim() || NEW_TASK_TITLE;
    setTitle("");
    setAdding(false);
    const created = await addTask({ title: value, projectId: project.id });
    if (created) openTask(created.id);
  }

  return (
    <section aria-label={project.name} className="flex flex-col gap-2 rounded-[20px] bg-secondary p-3">
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-1.5">
        <span aria-hidden="true">{project.emoji}</span>
        <h2 className="text-sm font-bold">{project.name}</h2>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <Card key={t.id} task={t} />
      ))}
      {tasks.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nothing here ✨</p>}
      {adding ? (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-[14px] bg-card p-2.5">
          <label htmlFor={`add-${project.id}`} className="sr-only">
            New task in {project.name}
          </label>
          <input
            id={`add-${project.id}`}
            dir="auto"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Task name…"
            className="h-9 rounded-lg bg-accent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              Add
            </button>
            <button
              type="button"
              onClick={addWithDetails}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-secondary-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-accent"
            >
              ✏️ Details
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground">
              Done
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl px-2 py-2.5 text-left text-[13px] font-semibold text-secondary-foreground hover:bg-card/60"
        >
          ＋ Add task
        </button>
      )}
    </section>
  );
}

function Card({ task }: { task: Task }) {
  const { effective, personById, today, domainOfTask } = useStore();
  const openTask = useOpenTask();
  const e = effective(task);
  const style = BUCKET_STYLE[domainOfTask(task)?.slug ?? "personal"];
  const assignee = task.assignee_id ? personById.get(task.assignee_id) : undefined;
  const waitingOn = task.waiting_on_id ? personById.get(task.waiting_on_id) : undefined;

  const windowChip =
    e === "passed" ? (
      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold">🗓 Pick a day</span>
    ) : (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          e === "today" ? cn(style.tint, style.ink) : "bg-muted text-secondary-foreground",
        )}
      >
        {WINDOW_LABEL[e]}
      </span>
    );

  return (
    <article className="flex flex-col gap-2.5 rounded-[14px] bg-card p-3 shadow-[0_1px_2px_rgba(35,33,43,.05)]">
      <div className="flex items-start gap-2.5">
        <span className="pt-px">
          <CheckButton task={task} />
        </span>
        <button
          type="button"
          dir="auto"
          onClick={() => openTask(task.id)}
          onPointerEnter={() => prefetchExtras(task.id)}
          onFocus={() => prefetchExtras(task.id)}
          className="min-w-0 flex-1 text-left text-sm leading-snug font-semibold focus-visible:outline-none"
        >
          {task.title}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-[30px]">
        {windowChip}
        {task.status === "waiting" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-secondary-foreground">⏳ {waitingOn?.name ?? "Waiting"}</span>
        ) : task.status === "in_progress" || task.status === "blocked" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-secondary-foreground">{STATUS_LABEL[task.status]}</span>
        ) : null}
        {task.due_date && <span className="text-[11px] text-muted-foreground">Due {formatShortDate(task.due_date, today)}</span>}
        {task.repeat_rule && <span className="text-[11px] text-muted-foreground" title="Repeats">↻</span>}
        <Avatar person={assignee} className="ml-auto size-[22px] text-[9px]" />
      </div>
    </article>
  );
}
