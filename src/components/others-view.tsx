"use client";

import { useStore } from "@/lib/store";
import { useOpenTask } from "@/lib/open-task";
import { prefetchExtras } from "@/lib/task-extras";
import { BUCKET_STYLE } from "@/lib/buckets";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Person, Task } from "@/lib/types";
import { Avatar } from "./avatar";
import { CheckButton } from "./task-row";

/** Everything handed off or waiting on someone, grouped by person. Buckets stay visible per task. */
export function OthersView() {
  const { tasks, personById, domains, domainOfTask } = useStore();

  const groups = new Map<string, { person: Person | null; tasks: Task[] }>();
  for (const t of tasks) {
    if (t.status === "done") continue;
    const assignee = t.assignee_id ? personById.get(t.assignee_id) : undefined;
    const delegated = assignee && (assignee.type === "person" || assignee.type === "org");
    if (t.status !== "waiting" && !delegated) continue;
    const who = t.status === "waiting" ? (t.waiting_on_id ? personById.get(t.waiting_on_id) : undefined) : assignee;
    const key = who?.id ?? "unknown";
    if (!groups.has(key)) groups.set(key, { person: who ?? null, tasks: [] });
    groups.get(key)!.tasks.push(t);
  }

  const domainOrder = new Map(domains.map((d, i) => [d.id, i]));
  const sorted = [...groups.values()].sort((a, b) => {
    if (!a.person) return 1;
    if (!b.person) return -1;
    return a.person.name.localeCompare(b.person.name);
  });

  return (
    <main className="flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-10 md:px-8 md:pt-9 md:pl-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">🤝 With Others</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">What you handed off, and what you&apos;re waiting for.</p>
      </header>

      {sorted.length === 0 && (
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">
          Nothing out with others right now. Use ⏳ on a task when your part is done.
        </p>
      )}

      {sorted.map(({ person, tasks: list }) => (
        <section key={person?.id ?? "unknown"} className="rounded-[20px] bg-card p-2 shadow-[0_1px_2px_rgba(35,33,43,.05)]">
          <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
            {person ? <Avatar person={person} /> : <span aria-hidden="true">❔</span>}
            <h2 className="text-[15px] font-bold">{person?.name ?? "Someone (not set yet)"}</h2>
            <span className="ml-auto text-xs text-muted-foreground">{list.length}</span>
          </div>
          {list
            .sort((a, b) => (domainOrder.get(domainOfTask(a)?.id ?? "") ?? 0) - (domainOrder.get(domainOfTask(b)?.id ?? "") ?? 0))
            .map((t) => (
              <OtherRow key={t.id} task={t} />
            ))}
        </section>
      ))}
    </main>
  );
}

function OtherRow({ task }: { task: Task }) {
  const { domainOfTask, projectById, backToMe, today } = useStore();
  const openTask = useOpenTask();
  const domain = domainOfTask(task);
  const project = projectById.get(task.project_id);
  const style = BUCKET_STYLE[domain?.slug ?? "personal"];
  const followUpDue = task.follow_up_date && task.follow_up_date <= today;

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/60">
      <span className="pt-0.5">
        <CheckButton task={task} />
      </span>
      <button
        type="button"
        onClick={() => openTask(task.id)}
        onPointerEnter={() => prefetchExtras(task.id)}
        onFocus={() => prefetchExtras(task.id)}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span dir="auto" className="text-sm font-semibold">
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", style.tint, style.ink)}>
            {domain?.emoji} {domain?.name}
          </span>
          {project && `${project.emoji} ${project.name}`}
          {task.follow_up_date && (
            <span className={cn(followUpDue && "font-semibold text-foreground")}>
              · Follow up {formatShortDate(task.follow_up_date, today)}
            </span>
          )}
        </span>
      </button>
      {task.status === "waiting" && (
        <button
          type="button"
          onClick={() => backToMe(task.id)}
          className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--input)] hover:bg-secondary"
        >
          ↩ Back to me
        </button>
      )}
    </div>
  );
}
