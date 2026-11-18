"use client";

import { createClient } from "@/lib/supabase/client";
import type { TaskLink, TaskNote } from "./types";

// Links and notes per task, cached in memory so the panel opens instantly.
// Fetched when you point at a task (before the click), refreshed in the background on open.

export interface Extras {
  links: TaskLink[];
  notes: TaskNote[];
}

const cache = new Map<string, Extras>();
const inflight = new Map<string, Promise<Extras>>();

export function cachedExtras(taskId: string): Extras | undefined {
  return cache.get(taskId);
}

export function loadExtras(taskId: string, { force = false } = {}): Promise<Extras> {
  if (!force && cache.has(taskId)) return Promise.resolve(cache.get(taskId)!);
  const pending = inflight.get(taskId);
  if (pending) return pending;
  const supabase = createClient();
  const promise = Promise.all([
    supabase.from("task_links").select("id, task_id, title, url, provider, created_at").eq("task_id", taskId).order("created_at"),
    supabase.from("task_notes").select("id, task_id, body, created_at").eq("task_id", taskId).order("created_at", { ascending: false }),
  ])
    .then(([l, n]) => {
      const extras = { links: (l.data as TaskLink[]) ?? [], notes: (n.data as TaskNote[]) ?? [] };
      cache.set(taskId, extras);
      return extras;
    })
    .finally(() => inflight.delete(taskId));
  inflight.set(taskId, promise);
  return promise;
}

/** Call on hover/focus of a task: warms the cache. */
export function prefetchExtras(taskId: string) {
  if (!cache.has(taskId)) void loadExtras(taskId);
}

export function updateCachedExtras(taskId: string, update: (e: Extras) => Extras) {
  const current = cache.get(taskId) ?? { links: [], notes: [] };
  cache.set(taskId, update(current));
}
