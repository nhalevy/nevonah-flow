"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE } from "@/lib/buckets";
import { cn } from "@/lib/utils";

/** Type a name, press Enter. Bucket + project are small optional pickers. Press "N" anywhere to focus. */
export function QuickAdd({ domainId, onDomainChange }: { domainId: string; onDomainChange: (id: string) => void }) {
  const { domains, projects, addTask } = useStore();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const bucketProjects = projects.filter((p) => p.domain_id === domainId && !p.archived_at);
  const effectiveProject = bucketProjects.some((p) => p.id === projectId) ? projectId : (bucketProjects[0]?.id ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !effectiveProject) return;
    const value = title;
    setTitle("");
    const created = await addTask({ title: value, projectId: effectiveProject });
    if (!created) setTitle(value);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-2xl bg-card p-1.5 shadow-[0_1px_2px_rgba(35,33,43,.05),0_6px_20px_rgba(35,33,43,.04)]"
    >
      <div className="flex items-center gap-2 pl-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-muted-foreground">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <label htmlFor="quick-add" className="sr-only">
          Add a task
        </label>
        <input
          ref={inputRef}
          id="quick-add"
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task… just the name is enough"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        <kbd className="hidden rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground md:block">N</kbd>
        <button type="submit" className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Add
        </button>
      </div>
      {title.trim() && (
        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-1">
          <div role="group" aria-label="Bucket" className="hidden gap-1.5 md:flex">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={d.id === domainId}
                onClick={() => onDomainChange(d.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold text-secondary-foreground",
                  d.id === domainId ? cn(BUCKET_STYLE[d.slug].tint, BUCKET_STYLE[d.slug].ink) : "hover:bg-accent",
                )}
              >
                {d.emoji} {d.name}
              </button>
            ))}
          </div>
          <label htmlFor="quick-add-project" className="sr-only">
            Project
          </label>
          <select
            id="quick-add-project"
            value={effectiveProject}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-7 rounded-full bg-accent px-2.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {bucketProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">· This week</span>
        </div>
      )}
    </form>
  );
}
