"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useOpenTask } from "@/lib/open-task";
import { prefetchExtras } from "@/lib/task-extras";
import { BUCKET_STYLE } from "@/lib/buckets";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, WINDOW_LABEL, type Task } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "./avatar";
import { WaitPicker } from "./wait-picker";

const iconButton =
  "flex size-8 items-center justify-center rounded-[9px] bg-card text-[15px] shadow-[inset_0_0_0_1px_var(--input)] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CheckButton({ task, size = "md" }: { task: Task; size?: "md" | "lg" }) {
  const { complete, domainOfTask } = useStore();
  const slug = domainOfTask(task)?.slug ?? "personal";
  return (
    <button
      type="button"
      aria-label={`All done: ${task.title}`}
      title="All done"
      onClick={() => complete(task.id)}
      className={cn(
        "group/check shrink-0 rounded-[7px] border-2 bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        BUCKET_STYLE[slug].border,
        size === "lg" ? "size-6 rounded-lg" : "size-5",
      )}
    >
      <svg viewBox="0 0 24 24" className="hidden size-full p-0.5 text-muted-foreground group-hover/check:block" aria-hidden="true">
        <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function WaitButton({ task, className }: { task: Task; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Waiting on others" title="Waiting on others (follow up)" className={cn(iconButton, className)}>
        ⏳
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <WaitPicker task={task} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export function MoonButton({ task, className }: { task: Task; className?: string }) {
  const { doneForToday } = useStore();
  return (
    <button
      type="button"
      aria-label="Done for today, continue tomorrow"
      title="Done for today — continue tomorrow"
      onClick={() => doneForToday(task.id)}
      className={cn(iconButton, className)}
    >
      🌙
    </button>
  );
}

/** One task line: ☐ always; ⏳ 🌙 on hover/focus (always visible on touch screens). */
export function TaskRow({ task, showProject = true, showWindow = true }: { task: Task; showProject?: boolean; showWindow?: boolean }) {
  const { projectById, personById, effective, today } = useStore();
  const openTask = useOpenTask();
  const project = projectById.get(task.project_id);
  const assignee = task.assignee_id ? personById.get(task.assignee_id) : undefined;
  const waitingOn = task.waiting_on_id ? personById.get(task.waiting_on_id) : undefined;
  const eff = effective(task);

  const meta = [
    showWindow && eff !== "passed" ? WINDOW_LABEL[eff] : null,
    showProject && project ? `${project.emoji} ${project.name}` : null,
    task.status === "in_progress" || task.status === "blocked" ? STATUS_LABEL[task.status] : null,
    task.status === "waiting" ? `⏳ ${waitingOn?.name ?? "Waiting"}` : null,
    task.due_date ? `Due ${formatShortDate(task.due_date, today)}` : null,
    task.repeat_rule ? "↻" : null,
  ].filter(Boolean);

  return (
    <div className="group/row flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-accent/60 focus-within:bg-accent/60">
      <span className="pt-0.5">
        <CheckButton task={task} />
      </span>
      <button
        type="button"
        onClick={() => openTask(task.id)}
        onPointerEnter={() => prefetchExtras(task.id)}
        onFocus={() => prefetchExtras(task.id)}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left focus-visible:outline-none"
      >
        <span dir="auto" className="text-sm font-semibold leading-snug">
          {task.title}
        </span>
        {meta.length > 0 && <span className="text-xs text-muted-foreground">{meta.join(" · ")}</span>}
      </button>
      {task.status !== "waiting" && (
        <span className="flex shrink-0 gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">
          <WaitButton task={task} />
          <MoonButton task={task} />
        </span>
      )}
      <Avatar person={assignee} className="mt-0.5" />
    </div>
  );
}
