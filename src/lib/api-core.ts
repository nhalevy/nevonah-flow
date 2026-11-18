import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { effectiveWindow, nextOccurrence, todayIn, windowForDate, type Effective } from "./dates";
import { detectProvider } from "./buckets";
import { STATUS_LABEL, WINDOW_LABEL, type RepeatRule, type Status, type Task, type WorkWindow } from "./types";

// Server-side helpers for API-key access (Claude connector + REST). All access goes through the
// api_* database functions, which check the key and only touch that key's workspace.

interface Snapshot {
  workspace: { id: string; timezone: string };
  domains: { id: string; slug: string; name: string; emoji: string }[];
  projects: { id: string; domain_id: string; name: string; emoji: string }[];
  people: { id: string; name: string; type: string; is_active: boolean; domain_ids: string[] }[];
  tasks: Task[];
}

export class ApiError extends Error {}

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const WINDOWS: WorkWindow[] = ["today", "tomorrow", "this_week", "next_week", "someday"];
export const STATUSES: Exclude<Status, "done">[] = ["not_started", "in_progress", "waiting", "blocked"];

export class Api {
  private db = anonClient();
  private snap: Snapshot | null = null;

  constructor(private key: string) {}

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, { p_key: this.key, ...args });
    if (error) throw new ApiError(error.message === "invalid api key" ? "Invalid API key." : error.message);
    return data as T;
  }

  async snapshot(fresh = false): Promise<Snapshot> {
    if (!this.snap || fresh) this.snap = await this.rpc<Snapshot>("api_snapshot", {});
    return this.snap;
  }

  async today() {
    return todayIn((await this.snapshot()).workspace.timezone);
  }

  // ── name resolution ──
  async bucket(input: string) {
    const { domains } = await this.snapshot();
    const q = norm(input);
    const hit =
      domains.find((d) => norm(d.slug) === q || norm(d.name) === q) ??
      domains.find((d) => norm(d.name).includes(q) || q.includes(norm(d.slug)));
    if (!hit) throw new ApiError(`Unknown bucket "${input}". Use one of: ${domains.map((d) => d.name).join(", ")}.`);
    return hit;
  }

  async project(domainId: string, input?: string | null) {
    const { projects } = await this.snapshot();
    const list = projects.filter((p) => p.domain_id === domainId);
    if (!input) return list[0];
    const q = norm(input);
    const hit = list.find((p) => norm(p.name) === q) ?? list.find((p) => norm(p.name).includes(q) || q.includes(norm(p.name)));
    if (!hit) throw new ApiError(`Unknown project "${input}". In this bucket: ${list.map((p) => p.name).join(", ")}.`);
    return hit;
  }

  async person(input: string) {
    const { people } = await this.snapshot();
    const q = norm(input);
    if (["me", "myself", "i", "neta"].includes(q)) return people.find((p) => p.type === "me")!;
    const hit = people.find((p) => norm(p.name) === q) ?? people.find((p) => norm(p.name).startsWith(q));
    if (!hit) throw new ApiError(`Unknown person "${input}". Add them in the app's People page first.`);
    return hit;
  }

  async task(idOrPrefix: string) {
    const { tasks } = await this.snapshot();
    const q = idOrPrefix.trim().toLowerCase();
    const matches = tasks.filter((t) => t.id === q || t.id.startsWith(q));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new ApiError(`"${idOrPrefix}" matches several tasks. Use a longer id.`);
    throw new ApiError(`No open task with id "${idOrPrefix}". Use list_tasks to find it.`);
  }

  // ── reads ──
  async describe(t: Task) {
    const s = await this.snapshot();
    const today = await this.today();
    const project = s.projects.find((p) => p.id === t.project_id);
    const domain = s.domains.find((d) => d.id === project?.domain_id);
    const who = s.people.find((p) => p.id === t.assignee_id);
    const waiting = s.people.find((p) => p.id === t.waiting_on_id);
    const eff = effectiveWindow(t, today);
    const parts = [
      eff === "passed" ? "needs a new day" : WINDOW_LABEL[eff],
      STATUS_LABEL[t.status],
      `${domain?.name} › ${project?.name}`,
      who && who.type !== "me" ? `assigned to ${who.name}` : null,
      t.status === "waiting" ? `waiting on ${waiting?.name ?? "someone"}` : null,
      t.due_date ? `due ${t.due_date}` : null,
      t.follow_up_date ? `follow up ${t.follow_up_date}` : null,
      t.repeat_rule ? `repeats ${t.repeat_rule}` : null,
    ].filter(Boolean);
    return `• [${t.id.slice(0, 8)}] ${t.title} — ${parts.join(" · ")}`;
  }

  async listTasks(opts: { bucket?: string; window?: Effective | "needs_new_day" | "waiting"; query?: string; limit?: number }) {
    const s = await this.snapshot(true);
    const today = await this.today();
    const domain = opts.bucket ? await this.bucket(opts.bucket) : null;
    const projectIds = domain ? new Set(s.projects.filter((p) => p.domain_id === domain.id).map((p) => p.id)) : null;
    const q = opts.query ? norm(opts.query) : null;
    const rank: Record<Effective, number> = { passed: -1, today: 0, tomorrow: 1, this_week: 2, next_week: 3, someday: 4 };

    const list = s.tasks
      .filter((t) => !projectIds || projectIds.has(t.project_id))
      .filter((t) => {
        if (!opts.window) return true;
        if (opts.window === "waiting") return t.status === "waiting";
        const e = effectiveWindow(t, today);
        if (opts.window === "needs_new_day") return e === "passed";
        return e === opts.window;
      })
      .filter((t) => !q || norm(`${t.title} ${t.brief ?? ""}`).includes(q))
      .sort((a, b) => rank[effectiveWindow(a, today)] - rank[effectiveWindow(b, today)] || a.sort_order - b.sort_order)
      .slice(0, opts.limit ?? 50);

    // Keep buckets separate in the output.
    const byDomain = new Map<string, string[]>();
    for (const t of list) {
      const project = s.projects.find((p) => p.id === t.project_id);
      const key = project?.domain_id ?? "";
      if (!byDomain.has(key)) byDomain.set(key, []);
      byDomain.get(key)!.push(await this.describe(t));
    }
    if (!list.length) return "No matching open tasks.";
    return s.domains
      .filter((d) => byDomain.has(d.id))
      .map((d) => `${d.emoji} ${d.name}\n${byDomain.get(d.id)!.join("\n")}`)
      .join("\n\n");
  }

  async overview() {
    const s = await this.snapshot(true);
    return s.domains
      .map((d) => {
        const projects = s.projects.filter((p) => p.domain_id === d.id).map((p) => `${p.emoji} ${p.name}`);
        const people = s.people
          .filter((p) => p.is_active && p.type !== "me" && p.domain_ids.includes(d.id))
          .map((p) => `${p.name}${p.type === "ai" ? " (AI)" : p.type === "org" ? " (org)" : ""}`);
        return `${d.emoji} ${d.name} (bucket: "${d.slug}")\n  Projects: ${projects.join(", ")}\n  People: ${people.join(", ") || "—"}`;
      })
      .join("\n\n");
  }

  async details(id: string) {
    const t = await this.task(id);
    const d = await this.rpc<{ task: Task; links: { title: string; url: string }[]; notes: { date: string; body: string }[] }>(
      "api_task_details",
      { p_task: t.id },
    );
    const lines = [await this.describe(d.task)];
    if (d.task.brief) lines.push("", "Brief:", d.task.brief);
    if (d.links.length) lines.push("", "Links:", ...d.links.map((l) => `- ${l.title ?? "Link"}: ${l.url}`));
    if (d.notes.length) lines.push("", "Notes:", ...d.notes.map((n) => `- ${n.date}: ${n.body}`));
    return lines.join("\n");
  }

  // ── writes ──
  async addTask(input: {
    title: string;
    bucket: string;
    project?: string | null;
    work_window?: WorkWindow | null;
    due_date?: string | null;
    assignee?: string | null;
    brief?: string | null;
    link_url?: string | null;
    link_title?: string | null;
    note?: string | null;
  }) {
    if (!input.title?.trim()) throw new ApiError("title is required");
    const domain = await this.bucket(input.bucket);
    const project = await this.project(domain.id, input.project);
    const assignee = input.assignee ? await this.person(input.assignee) : null;
    const task = await this.rpc<Task>("api_add_task", {
      p_task: {
        title: input.title,
        project_id: project.id,
        assignee_id: assignee?.id ?? null,
        work_window: input.work_window ?? "this_week",
        window_set_on: await this.today(),
        due_date: input.due_date ?? null,
        brief: input.brief ?? null,
      },
    });
    this.snap?.tasks.push(task);
    if (input.link_url) await this.addLink(task.id, input.link_url, input.link_title);
    if (input.note) await this.addNote(task.id, input.note);
    return task;
  }

  async updateTask(
    id: string,
    input: {
      title?: string;
      status?: Exclude<Status, "done">;
      work_window?: WorkWindow;
      due_date?: string | null;
      bucket?: string;
      project?: string;
      assignee?: string;
      waiting_on?: string | null;
      follow_up_date?: string | null;
      brief?: string | null;
      repeat?: RepeatRule | "none";
    },
  ) {
    const t = await this.task(id);
    const patch: Record<string, unknown> = {};
    if (input.title) patch.title = input.title;
    if (input.status) patch.status = input.status;
    if (input.work_window) {
      patch.work_window = input.work_window;
      patch.window_set_on = await this.today();
    }
    if (input.due_date !== undefined) patch.due_date = input.due_date;
    if (input.follow_up_date !== undefined) patch.follow_up_date = input.follow_up_date;
    if (input.brief !== undefined) patch.brief = input.brief;
    if (input.repeat) patch.repeat_rule = input.repeat === "none" ? null : input.repeat;
    if (input.bucket || input.project) {
      const s = await this.snapshot();
      const currentDomain = s.projects.find((p) => p.id === t.project_id)?.domain_id ?? "";
      const domainId = input.bucket ? (await this.bucket(input.bucket)).id : currentDomain;
      patch.project_id = (await this.project(domainId, input.project)).id;
    }
    if (input.assignee) patch.assignee_id = (await this.person(input.assignee)).id;
    if (input.waiting_on !== undefined) {
      patch.waiting_on_id = input.waiting_on ? (await this.person(input.waiting_on)).id : null;
      if (input.waiting_on && !input.status) patch.status = "waiting";
    }
    if (input.status && input.status !== "waiting" && input.waiting_on === undefined) patch.waiting_on_id = null;
    if (!Object.keys(patch).length) throw new ApiError("Nothing to change.");
    return this.rpc<Task>("api_update_task", { p_id: t.id, p_patch: patch });
  }

  async complete(id: string) {
    const t = await this.task(id);
    const today = await this.today();
    const nextDue = t.repeat_rule ? nextOccurrence(t.repeat_rule, t.due_date ?? today) : null;
    const res = await this.rpc<{ next: Task | null }>("api_complete_task", {
      p_id: t.id,
      p_next_due: nextDue,
      p_next_window: nextDue ? windowForDate(nextDue, today) : null,
      p_today: today,
    });
    return { task: t, next: res.next };
  }

  async doneForToday(id: string) {
    const t = await this.task(id);
    return this.rpc<Task>("api_update_task", {
      p_id: t.id,
      p_patch: {
        work_window: "tomorrow",
        window_set_on: await this.today(),
        ...(t.status === "not_started" ? { status: "in_progress" } : {}),
      },
    });
  }

  async addLink(id: string, url: string, title?: string | null) {
    const t = await this.task(id);
    let value = url.trim();
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    const { provider, label } = detectProvider(value);
    return this.rpc("api_add_link", { p_task: t.id, p_url: value, p_title: title || label, p_provider: provider });
  }

  async addNote(id: string, body: string) {
    const t = await this.task(id);
    if (!body.trim()) throw new ApiError("Note is empty.");
    return this.rpc("api_add_note", { p_task: t.id, p_body: body });
  }
}
