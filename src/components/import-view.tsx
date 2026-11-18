"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE, detectProvider } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, WINDOW_LABEL, type BucketSlug, type RepeatRule, type Status, type WorkWindow } from "@/lib/types";

interface ImportRow {
  sourceRef: string;
  bucket: BucketSlug;
  project: string;
  title: string;
  category: string | null;
  assignee: string;
  status: Status;
  workWindow: WorkWindow;
  dueDate: string | null;
  brief: string | null;
  repeat: RepeatRule | null;
  notes: string[];
  links: { url: string; title: string | null }[];
  flags: string[];
}

interface RowState extends ImportRow {
  include: boolean;
  projectId: string;
  already: boolean; // same sourceRef already in the database
  similar: boolean; // an open task with the same name exists in this bucket
}

export function ImportView() {
  const supabase = useMemo(() => createClient(), []);
  const { domains, projects, people, tasks, workspace, today, reload, domainOfTask } = useStore();
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/import-preview");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (alive) setError(body.error ?? `Couldn't load the import file (${res.status}).`);
        return;
      }
      const file = (await res.json()) as { tasks: ImportRow[] };
      const { data: existing, error: refError } = await supabase
        .from("tasks")
        .select("source_ref")
        .eq("workspace_id", workspace.id)
        .not("source_ref", "is", null);
      if (refError) {
        if (alive) setError(refError.message);
        return;
      }
      const refs = new Set((existing ?? []).map((r) => r.source_ref as string));
      if (!alive) return;
      setRows(
        file.tasks.map((t) => {
          const domain = domains.find((d) => d.slug === t.bucket);
          const project = projects.find((p) => p.domain_id === domain?.id && p.name === t.project);
          const similar = tasks.some(
            (x) => domainOfTask(x)?.slug === t.bucket && x.title.trim().toLowerCase() === t.title.trim().toLowerCase(),
          );
          const already = refs.has(t.sourceRef);
          return { ...t, projectId: project?.id ?? "", already, similar, include: !already && !similar };
        }),
      );
    })();
    return () => {
      alive = false;
    };
    // Load once; the preview shouldn't reshuffle while you edit it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows?.filter((r) => r.include && !r.already) ?? [];

  function update(ref: string, patch: Partial<RowState>) {
    setRows((rs) => rs?.map((r) => (r.sourceRef === ref ? { ...r, ...patch } : r)) ?? null);
  }

  async function runImport() {
    if (!selected.length) return;
    setBusy(true);
    const personByName = new Map(people.map((p) => [p.type === "me" ? "Me" : p.name, p]));
    const base = Date.now() / 1000;
    const taskRows = selected.map((r, i) => {
      const assignee = personByName.get(r.assignee) ?? personByName.get("Me");
      const mine = !assignee || assignee.type === "me";
      return {
        workspace_id: workspace.id,
        project_id: r.projectId,
        assignee_id: assignee?.id ?? null,
        title: r.title,
        status: r.status,
        work_window: r.workWindow,
        window_set_on: today,
        due_date: r.dueDate,
        brief: mine ? null : r.brief,
        repeat_rule: r.repeat,
        source_ref: r.sourceRef,
        sort_order: base + i / 1000,
      };
    });

    const { data: inserted, error: insertError } = await supabase.from("tasks").insert(taskRows).select("id, source_ref");
    if (insertError) {
      setBusy(false);
      toast.error(`Import failed, nothing was saved: ${insertError.message}`);
      return;
    }
    const idByRef = new Map((inserted ?? []).map((t) => [t.source_ref as string, t.id as string]));

    const links = selected.flatMap((r) =>
      r.links.map((l) => {
        const { provider, label } = detectProvider(l.url);
        return { workspace_id: workspace.id, task_id: idByRef.get(r.sourceRef)!, url: l.url, provider, title: l.title ?? label };
      }),
    );
    const notes = selected.flatMap((r) => {
      const assignee = personByName.get(r.assignee);
      const mine = !assignee || assignee.type === "me";
      const bodies = [...(mine && r.brief ? [r.brief] : []), ...r.notes];
      return bodies.map((body) => ({ workspace_id: workspace.id, task_id: idByRef.get(r.sourceRef)!, body: `From the workbook:\n${body}` }));
    });

    const [linkRes, noteRes] = await Promise.all([
      links.length ? supabase.from("task_links").insert(links) : Promise.resolve({ error: null }),
      notes.length ? supabase.from("task_notes").insert(notes) : Promise.resolve({ error: null }),
    ]);
    if (linkRes.error || noteRes.error) {
      toast.error(`Tasks imported, but some links/notes failed: ${(linkRes.error ?? noteRes.error)?.message}`);
    }

    await reload();
    setBusy(false);
    setDone(selected.length);
    setRows((rs) => rs?.map((r) => (r.include && idByRef.has(r.sourceRef) ? { ...r, already: true, include: false } : r)) ?? null);
  }

  return (
    <main className="flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-28 md:px-8 md:pt-9 md:pl-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">📥 Import from your workbook</h1>
        <p className="text-[13px] text-muted-foreground">
          Review before anything is saved. Completed tasks are skipped. Rows marked ⚠ had a missing value that was filled with a default. Change the project if needed.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-2xl bg-card p-5 text-sm">
          {error}
        </p>
      )}
      {!rows && !error && <p className="text-sm text-muted-foreground">Reading the workbook…</p>}

      {done !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-tmr-tint p-4 text-sm text-tmr-ink">
          ✅ Imported {done} tasks.
          <Link href="/" className="font-semibold underline">
            Go to Home
          </Link>
        </div>
      )}

      {rows &&
        domains.map((d) => {
          const list = rows.filter((r) => r.bucket === d.slug);
          if (!list.length) return null;
          const style = BUCKET_STYLE[d.slug];
          const bucketProjects = projects.filter((p) => p.domain_id === d.id && !p.archived_at);
          return (
            <section key={d.id} className="overflow-hidden rounded-[20px] bg-card shadow-[0_1px_2px_rgba(35,33,43,.05)]">
              <h2 className={cn("flex items-center px-4 py-3 text-sm font-bold", style.tint, style.ink)}>
                {d.emoji} {d.name}
                <span className="ml-auto text-xs font-semibold">
                  {list.filter((r) => r.include && !r.already).length} of {list.length} selected
                </span>
              </h2>
              <ul className="divide-y">
                {list.map((r) => (
                  <li key={r.sourceRef} className={cn("flex flex-wrap items-start gap-3 px-4 py-3", (r.already || !r.include) && "opacity-55")}>
                    <input
                      type="checkbox"
                      aria-label={`Import ${r.title}`}
                      checked={r.include && !r.already}
                      disabled={r.already}
                      onChange={(e) => update(r.sourceRef, { include: e.target.checked })}
                      className="mt-1 size-4 accent-current"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span dir="auto" className="text-sm font-semibold">
                        {r.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          WINDOW_LABEL[r.workWindow],
                          STATUS_LABEL[r.status],
                          r.assignee !== "Me" ? `→ ${r.assignee}` : null,
                          r.dueDate ? `Due ${r.dueDate}` : null,
                          r.links.length ? `🔗 ${r.links.length}` : null,
                          r.brief ? "📝 brief" : null,
                          r.notes.length ? "🗒 note" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {r.already && <span className="text-xs font-semibold">Already imported, skipped</span>}
                      {!r.already && r.similar && (
                        <span className="text-xs font-semibold">A task with this name already exists, unchecked to avoid a duplicate</span>
                      )}
                      {r.flags.map((f) => (
                        <span key={f} className="text-xs text-secondary-foreground">
                          ⚠ {f}
                        </span>
                      ))}
                    </div>
                    <label className="sr-only" htmlFor={`proj-${r.sourceRef}`}>
                      Project for {r.title}
                    </label>
                    <select
                      id={`proj-${r.sourceRef}`}
                      value={r.projectId}
                      disabled={r.already}
                      onChange={(e) => update(r.sourceRef, { projectId: e.target.value })}
                      className="h-8 rounded-[10px] bg-accent px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {bucketProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {rows && (
        <div className="fixed inset-x-0 bottom-[76px] z-30 flex justify-center px-4 md:bottom-6 md:pl-[232px]">
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={runImport}
            className="rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
          >
            {busy ? "Importing…" : selected.length ? `Import ${selected.length} tasks` : "Nothing selected"}
          </button>
        </div>
      )}
    </main>
  );
}
