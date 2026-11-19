"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { useOpenTask, useOpenTaskId } from "@/lib/open-task";
import { cachedExtras, loadExtras, updateCachedExtras } from "@/lib/task-extras";
import { BUCKET_STYLE, detectProvider } from "@/lib/buckets";
import { EFFECTIVE_RANK, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  NEW_TASK_TITLE,
  REPEAT_LABEL,
  STATUS_LABEL,
  WINDOW_LABEL,
  type RepeatRule,
  type Status,
  type Task,
  type TaskLink,
  type TaskNote,
  type WorkWindow,
} from "@/lib/types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CheckButton, MoonButton, WaitButton } from "./task-row";

export const BRIEF_TEMPLATE = `🎯 Success looks like:
💡 Why it matters:
📎 Context you'll need:
🚧 Please don't change / touch:
✅ How we'll know it's done: `;

const chip =
  "rounded-full px-3 py-1.5 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--input)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const fieldBox =
  "h-9 rounded-[10px] bg-accent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const sectionTitle = "text-xs font-bold tracking-[0.06em] text-muted-foreground";

export function TaskPanel() {
  const { tasks, domainOfTask, effective, addTask } = useStore();
  const openTaskId = useOpenTaskId();
  const openTask = useOpenTask();

  // When the panel opens, take a snapshot of that bucket's open tasks in the order
  // the boards show them. "Next" walks this list, so a task doesn't jump around
  // just because you changed its window. The list stays inside one bucket.
  const [queue, setQueue] = useState<string[]>([]);
  const [prevId, setPrevId] = useState<string | null>(null);
  if (openTaskId !== prevId) {
    setPrevId(openTaskId);
    if (!openTaskId) setQueue([]);
    else if (!queue.includes(openTaskId)) {
      const start = tasks.find((t) => t.id === openTaskId);
      const bucket = start ? domainOfTask(start)?.id : undefined;
      setQueue(
        tasks
          .filter((t) => t.status !== "done" && domainOfTask(t)?.id === bucket)
          .sort((a, b) => EFFECTIVE_RANK[effective(a)] - EFFECTIVE_RANK[effective(b)] || a.sort_order - b.sort_order)
          .map((t) => t.id),
      );
    }
  }

  const live = new Set(tasks.filter((t) => t.status !== "done").map((t) => t.id));
  const after = (id: string | null) => {
    const i = id ? queue.indexOf(id) : -1;
    return queue.slice(i + 1).find((x) => live.has(x)) ?? null;
  };
  const before = (id: string) => {
    const i = queue.indexOf(id);
    return i < 0 ? null : (queue.slice(0, i).reverse().find((x) => live.has(x)) ?? null);
  };

  // If the open task was just finished or deleted, slide to the next one instead of closing.
  const currentId = openTaskId && live.has(openTaskId) ? openTaskId : openTaskId && queue.includes(openTaskId) ? after(openTaskId) : null;
  const task = tasks.find((t) => t.id === currentId);
  const nextId = after(currentId);
  const prevTaskId = currentId ? before(currentId) : null;
  const remaining = queue.filter((x) => live.has(x));
  const position = currentId ? remaining.indexOf(currentId) + 1 : 0;

  function go(id: string | null, e: React.MouseEvent) {
    if (!id) return;
    e.currentTarget.closest('[data-slot="sheet-content"]')?.scrollTo({ top: 0 });
    openTask(id);
  }

  /** New task in the same project as the one you're looking at, opened right here. */
  async function newTask(from: Task, e: React.MouseEvent) {
    const scroller = e.currentTarget.closest('[data-slot="sheet-content"]');
    const created = await addTask({ title: NEW_TASK_TITLE, projectId: from.project_id });
    if (!created) return;
    scroller?.scrollTo({ top: 0 });
    // slot it in right after the current task, so Next/← keep your place in the review
    setQueue((q) => {
      const i = q.indexOf(from.id);
      return i < 0 ? [...q, created.id] : [...q.slice(0, i + 1), created.id, ...q.slice(i + 1)];
    });
    openTask(created.id);
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && openTask(null)}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {task && <PanelBody key={task.id} task={task} />}
        {task && (
          <nav
            aria-label="Go through tasks"
            className="sticky bottom-0 mt-auto flex items-center gap-2 border-t bg-popover/95 px-6 py-3 backdrop-blur-sm sm:px-8"
          >
            {remaining.length > 1 && (
              <>
                <button
                  type="button"
                  disabled={!prevTaskId}
                  onClick={(e) => go(prevTaskId, e)}
                  aria-label="Previous task"
                  className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-secondary-foreground hover:bg-accent disabled:opacity-30"
                >
                  ←
                </button>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {position} of {remaining.length}
                </span>
              </>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={(e) => newTask(task, e)}
              title="New task in the same project"
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-secondary-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-accent"
            >
              ＋ New
            </button>
            {remaining.length <= 1 ? null : nextId ? (
              <button
                type="button"
                onClick={(e) => go(nextId, e)}
                className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                Next task →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openTask(null)}
                className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                All caught up ✨
              </button>
            )}
          </nav>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({ task }: { task: Task }) {
  const {
    domains,
    projects,
    domainOfTask,
    peopleForDomain,
    personById,
    updateTask,
    setWindow,
    deleteTask,
    workspace,
    today,
    me,
  } = useStore();
  const domain = domainOfTask(task);
  const style = BUCKET_STYLE[domain?.slug ?? "personal"];
  const assignee = task.assignee_id ? personById.get(task.assignee_id) : undefined;
  const delegated = !!assignee && assignee.type !== "me";
  const people = domain ? peopleForDomain(domain.id) : [];
  const [title, setTitle] = useState(task.title);
  const [brief, setBrief] = useState(task.brief ?? (delegated ? BRIEF_TEMPLATE : ""));
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // A task just made with "Details": put the cursor in the name so you can type right away.
  useEffect(() => {
    if (task.title !== NEW_TASK_TITLE) return;
    const el = titleRef.current;
    const t = setTimeout(() => {
      el?.focus();
      el?.select();
    }, 160);
    return () => clearTimeout(t);
    // only on first open of this task
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOptions: Status[] = ["not_started", "in_progress", "waiting", "blocked"];
  const windowOptions: WorkWindow[] = ["today", "tomorrow", "this_week", "next_week", "someday"];

  function saveTitle() {
    const t = title.trim();
    if (t && t !== task.title) void updateTask(task.id, { title: t });
    else setTitle(task.title);
  }

  function saveBrief() {
    const value = brief.trim() === BRIEF_TEMPLATE.trim() ? null : brief;
    if (value !== task.brief) void updateTask(task.id, { brief: value });
  }

  const briefText = useMemo(() => {
    const lines = [`Task: ${task.title}`];
    if (task.due_date) lines.push(`Due: ${formatShortDate(task.due_date, today)}`);
    lines.push("", brief.trim());
    return lines.join("\n");
  }, [task.title, task.due_date, brief, today]);

  async function copyPrompt() {
    const prompt = `I'm delegating this task to you. Please own it end to end.\n\n${briefText}\n\nIf anything is unclear, ask me before you start.`;
    await navigator.clipboard.writeText(prompt);
    toast("📋 Copied — paste it into your AI chat");
  }

  function emailHref() {
    const body = `Hi ${assignee?.name?.split(" ")[0] ?? ""},\n\nCould you take this one? Here's what I have in mind:\n\n${briefText}\n\nThank you!`;
    const params = new URLSearchParams({ view: "cm", fs: "1", to: assignee?.email ?? "", su: task.title, body });
    if (workspace.send_from_email) params.set("authuser", workspace.send_from_email);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-6 pb-10 sm:px-8">
      <SheetDescription className={cn("w-fit rounded-full px-3 py-1 text-xs font-semibold", style.tint, style.ink)}>
        {domain?.emoji} {domain?.name}
      </SheetDescription>

      <div className="flex items-start gap-3 pr-8">
        <span className="pt-1.5">
          <CheckButton task={task} size="lg" />
        </span>
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <label htmlFor="task-title" className="sr-only">
          Task name
        </label>
        <textarea
          ref={titleRef}
          id="task-title"
          dir="auto"
          rows={Math.max(1, Math.ceil(title.length / 34))}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-lg bg-transparent text-xl leading-snug font-bold outline-none focus-visible:bg-accent"
        />
        {task.status !== "waiting" && (
          <span className="flex shrink-0 gap-1">
            <WaitButton task={task} />
            <MoonButton task={task} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5 text-sm">
        <label htmlFor="task-project" className="text-[13px] text-muted-foreground">
          Bucket
        </label>
        <select
          id="task-project"
          value={task.project_id}
          onChange={(e) => updateTask(task.id, { project_id: e.target.value })}
          className={cn(fieldBox, "justify-self-start")}
        >
          {domains.map((d) => (
            <optgroup key={d.id} label={`${d.emoji} ${d.name}`}>
              {projects
                .filter((p) => p.domain_id === d.id && !p.archived_at)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <label htmlFor="task-who" className="text-[13px] text-muted-foreground">
          Who
        </label>
        <select
          id="task-who"
          value={task.assignee_id ?? me?.id ?? ""}
          onChange={(e) => {
            const next = personById.get(e.target.value);
            if (next && next.type !== "me" && !brief.trim()) setBrief(BRIEF_TEMPLATE);
            void updateTask(task.id, { assignee_id: e.target.value });
          }}
          className={cn(fieldBox, "justify-self-start")}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.type === "ai" ? "🤖 " : p.type === "org" ? "🏢 " : ""}
              {p.name}
            </option>
          ))}
        </select>

        <span className="text-[13px] text-muted-foreground">Status</span>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={task.status === s}
              onClick={() => updateTask(task.id, { status: s, ...(s !== "waiting" ? { waiting_on_id: null } : {}) })}
              className={cn(chip, task.status === s && "bg-primary text-primary-foreground shadow-none hover:bg-primary")}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {task.status === "waiting" && (
          <>
            <label htmlFor="task-waiting" className="text-[13px] text-muted-foreground">
              Waiting on
            </label>
            <select
              id="task-waiting"
              value={task.waiting_on_id ?? ""}
              onChange={(e) => updateTask(task.id, { waiting_on_id: e.target.value || null })}
              className={cn(fieldBox, "justify-self-start")}
            >
              <option value="">Not sure yet</option>
              {people
                .filter((p) => p.type !== "me")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </>
        )}

        <span className="text-[13px] text-muted-foreground">Work window</span>
        <div role="group" aria-label="Work window" className="flex flex-wrap gap-1.5">
          {windowOptions.map((w) => {
            const on = task.work_window === w;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => setWindow(task.id, w)}
                className={cn(chip, on && cn(style.solid, "shadow-none"))}
              >
                {WINDOW_LABEL[w]}
              </button>
            );
          })}
        </div>

        <span className="text-[13px] text-muted-foreground">Due · Repeat</span>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="task-due">
            Due date
          </label>
          <input
            id="task-due"
            type="date"
            value={task.due_date ?? ""}
            onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
            className={fieldBox}
          />
          <label className="sr-only" htmlFor="task-repeat">
            Repeat
          </label>
          <select
            id="task-repeat"
            value={task.repeat_rule ?? ""}
            onChange={(e) => updateTask(task.id, { repeat_rule: (e.target.value || null) as RepeatRule | null })}
            className={fieldBox}
          >
            <option value="">↻ Doesn&apos;t repeat</option>
            {(Object.keys(REPEAT_LABEL) as RepeatRule[]).map((r) => (
              <option key={r} value={r}>
                ↻ {REPEAT_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        {(delegated || task.status === "waiting") && (
          <>
            <label htmlFor="task-follow" className="text-[13px] text-muted-foreground">
              Follow up
            </label>
            <input
              id="task-follow"
              type="date"
              value={task.follow_up_date ?? ""}
              onChange={(e) => updateTask(task.id, { follow_up_date: e.target.value || null })}
              className={cn(fieldBox, "justify-self-start")}
            />
          </>
        )}
      </div>

      {delegated && (
        <section aria-labelledby="brief-h" className={cn("flex flex-col gap-3 rounded-2xl p-4", style.tint)}>
          <div className="flex items-baseline gap-2">
            <h2 id="brief-h" className="text-sm font-bold">
              📝 Brief for {assignee?.name}
            </h2>
            <span className="text-xs text-muted-foreground">so they can run with it</span>
          </div>
          <label htmlFor="task-brief" className="sr-only">
            Brief
          </label>
          <textarea
            id="task-brief"
            dir="auto"
            rows={7}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={saveBrief}
            className="w-full resize-y rounded-xl bg-card p-3.5 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            {assignee?.type === "ai" ? (
              <button type="button" onClick={copyPrompt} className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground">
                📋 Copy as prompt
              </button>
            ) : (
              <a
                href={emailHref()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={saveBrief}
                className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                📧 Email {assignee?.name}
                {!assignee?.email && <span className="font-normal opacity-80"> (no email saved)</span>}
              </a>
            )}
            {assignee?.type === "ai" ? null : (
              <button
                type="button"
                onClick={copyPrompt}
                className="rounded-xl bg-card px-4 py-2.5 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--input)]"
              >
                📋 Copy
              </button>
            )}
          </div>
        </section>
      )}

      <LinksSection task={task} />
      <NotesSection task={task} />

      <div className="flex justify-end border-t pt-4">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this task? This can't be undone.")) void deleteTask(task.id);
          }}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-accent"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function LinksSection({ task }: { task: Task }) {
  const supabase = useMemo(() => createClient(), []);
  const [links, setLinksState] = useState<TaskLink[] | null>(() => cachedExtras(task.id)?.links ?? null);
  const [url, setUrl] = useState("");

  const setLinks = (update: (l: TaskLink[] | null) => TaskLink[]) =>
    setLinksState((cur) => {
      const next = update(cur);
      updateCachedExtras(task.id, (e) => ({ ...e, links: next }));
      return next;
    });

  useEffect(() => {
    let alive = true;
    loadExtras(task.id, { force: true }).then((e) => alive && setLinksState(e.links));
    return () => {
      alive = false;
    };
  }, [task.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let value = url.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    const { provider, label } = detectProvider(value);
    const { data, error } = await supabase
      .from("task_links")
      .insert({ workspace_id: task.workspace_id, task_id: task.id, url: value, provider, title: label })
      .select("id, task_id, title, url, provider, created_at")
      .single();
    if (error) return toast.error(`Couldn't save link: ${error.message}`);
    setLinks((l) => [...(l ?? []), data as TaskLink]);
    setUrl("");
  }

  async function remove(id: string) {
    setLinks((l) => (l ?? []).filter((x) => x.id !== id));
    const { error } = await supabase.from("task_links").delete().eq("id", id);
    if (error) toast.error(`Couldn't remove link: ${error.message}`);
  }

  return (
    <section aria-labelledby="links-h" className="flex flex-col gap-2.5">
      <h2 id="links-h" className={sectionTitle}>
        🔗 CHAT &amp; LINKS
      </h2>
      {links?.map((l) => (
        <div key={l.id} className="group/link flex items-center gap-2 rounded-xl bg-accent px-3 py-2">
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
            ↗ {l.title ?? l.url}
            <span className="ml-2 font-normal text-muted-foreground">{l.url.replace(/^https?:\/\//, "").slice(0, 48)}</span>
          </a>
          <button type="button" aria-label="Remove link" onClick={() => remove(l.id)} className="rounded-md px-1.5 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ))}
      <form onSubmit={add} className="flex items-center gap-2 rounded-xl bg-accent py-1 pr-1 pl-3.5">
        <label htmlFor="link-in" className="sr-only">
          Paste a link
        </label>
        <input
          id="link-in"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a chat or doc link…"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="submit" className="rounded-[9px] bg-card px-3 py-1.5 text-xs font-semibold">
          Add
        </button>
      </form>
    </section>
  );
}

function NotesSection({ task }: { task: Task }) {
  const supabase = useMemo(() => createClient(), []);
  const { today } = useStore();
  const [notes, setNotesState] = useState<TaskNote[] | null>(() => cachedExtras(task.id)?.notes ?? null);
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);

  const setNotes = (update: (n: TaskNote[] | null) => TaskNote[]) =>
    setNotesState((cur) => {
      const next = update(cur);
      updateCachedExtras(task.id, (e) => ({ ...e, notes: next }));
      return next;
    });

  useEffect(() => {
    let alive = true;
    loadExtras(task.id).then((e) => alive && setNotesState(e.notes));
    return () => {
      alive = false;
    };
  }, [task.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const { data, error } = await supabase
      .from("task_notes")
      .insert({ workspace_id: task.workspace_id, task_id: task.id, body: draft })
      .select("id, task_id, body, created_at")
      .single();
    if (error) return toast.error(`Couldn't save note: ${error.message}`);
    setNotes((n) => [data as TaskNote, ...(n ?? [])]);
    setDraft("");
    setWriting(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note?")) return;
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    const { error } = await supabase.from("task_notes").delete().eq("id", id);
    if (error) toast.error(`Couldn't delete note: ${error.message}`);
  }

  return (
    <section aria-labelledby="notes-h" className="flex flex-col gap-2.5">
      <h2 id="notes-h" className={sectionTitle}>
        🗒 NOTES
      </h2>
      {writing ? (
        <form onSubmit={add} className="flex flex-col gap-2">
          <label htmlFor="note-in" className="sr-only">
            New note
          </label>
          <textarea
            id="note-in"
            dir="auto"
            autoFocus
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste an email, instructions, anything long…"
            className="w-full resize-y rounded-xl bg-accent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              Save note
            </button>
            <button type="button" onClick={() => setWriting(false)} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="rounded-2xl border-[1.5px] border-dashed px-4 py-4 text-left text-[13px] text-secondary-foreground hover:bg-accent"
        >
          ＋ Paste an email, instructions, anything long…
        </button>
      )}
      {notes?.map((n) => (
        <article key={n.id} className="group/note rounded-xl bg-accent px-3.5 py-3">
          <div className="mb-1.5 flex items-center text-[11px] font-semibold text-muted-foreground">
            {formatShortDate(n.created_at.slice(0, 10), today)}
            <button
              type="button"
              aria-label="Delete note"
              onClick={() => remove(n.id)}
              className="ml-auto rounded px-1 opacity-0 group-hover/note:opacity-100 focus-visible:opacity-100"
            >
              ✕
            </button>
          </div>
          <p dir="auto" className="text-sm whitespace-pre-wrap">
            {n.body}
          </p>
        </article>
      ))}
    </section>
  );
}
