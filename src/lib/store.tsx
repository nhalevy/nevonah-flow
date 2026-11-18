"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loadWorkspace } from "./load";
import { effectiveWindow, nextOccurrence, todayIn, windowForDate, type Effective } from "./dates";
import {
  TASK_COLUMNS,
  type Domain,
  type Person,
  type PersonType,
  type Project,
  type Task,
  type WorkWindow,
  type WorkspaceData,
} from "./types";

type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "project_id"
    | "assignee_id"
    | "waiting_on_id"
    | "status"
    | "work_window"
    | "window_set_on"
    | "due_date"
    | "follow_up_date"
    | "brief"
    | "repeat_rule"
    | "sort_order"
    | "completed_at"
  >
>;

interface Store extends WorkspaceData {
  today: string;
  me: Person | undefined;
  openTaskId: string | null;
  // lookups
  projectById: Map<string, Project>;
  domainById: Map<string, Domain>;
  personById: Map<string, Person>;
  domainOfTask: (task: Task) => Domain | undefined;
  effective: (task: Task) => Effective;
  peopleForDomain: (domainId: string, opts?: { includeInactive?: boolean }) => Person[];
  isOnMyPlate: (task: Task) => boolean;
  // actions
  openTask: (id: string | null) => void;
  addTask: (input: { title: string; projectId: string; workWindow?: WorkWindow }) => Promise<Task | null>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  setWindow: (id: string, win: WorkWindow) => Promise<void>;
  complete: (id: string) => Promise<void>;
  doneForToday: (id: string) => Promise<void>;
  waitOn: (id: string, personId: string | null, followUp: string | null) => Promise<void>;
  backToMe: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addPerson: (input: { name: string; email?: string; type: PersonType; domainIds: string[] }) => Promise<Person | null>;
  updatePerson: (id: string, patch: Partial<Pick<Person, "name" | "email" | "type" | "is_active">>) => Promise<void>;
  setPersonDomains: (personId: string, domainIds: string[]) => Promise<void>;
  updateWorkspace: (patch: { send_from_email: string | null }) => Promise<void>;
  reload: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

export function StoreProvider({ initial, children }: { initial: WorkspaceData; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<WorkspaceData>(initial);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayIn(initial.workspace.timezone));
  const tasksRef = useRef(data.tasks);
  useEffect(() => {
    tasksRef.current = data.tasks;
  }, [data.tasks]);

  // Roll over at midnight / when the tab comes back.
  useEffect(() => {
    const tick = () => setToday(todayIn(data.workspace.timezone));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [data.workspace.timezone]);

  const reload = useCallback(async () => {
    try {
      setData(await loadWorkspace(supabase));
    } catch (e) {
      toast.error(`Couldn't refresh: ${(e as Error).message}`);
    }
  }, [supabase]);

  const fail = useCallback(
    (message: string) => {
      toast.error(`Couldn't save: ${message}`);
      void reload();
    },
    [reload],
  );

  // ── lookups ──
  const projectById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);
  const domainById = useMemo(() => new Map(data.domains.map((d) => [d.id, d])), [data.domains]);
  const personById = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const me = useMemo(() => data.people.find((p) => p.type === "me"), [data.people]);

  const domainOfTask = useCallback(
    (task: Task) => {
      const project = projectById.get(task.project_id);
      return project ? domainById.get(project.domain_id) : undefined;
    },
    [projectById, domainById],
  );

  const effective = useCallback((task: Task) => effectiveWindow(task, today), [today]);

  const peopleForDomain = useCallback(
    (domainId: string, opts?: { includeInactive?: boolean }) => {
      const ids = new Set(data.peopleDomains.filter((pd) => pd.domain_id === domainId).map((pd) => pd.person_id));
      return data.people.filter((p) => (p.type === "me" || ids.has(p.id)) && (opts?.includeInactive || p.is_active));
    },
    [data.people, data.peopleDomains],
  );

  /** Mine to act on: assigned to me, to an AI helper, or to nobody — and not waiting on anyone. */
  const isOnMyPlate = useCallback(
    (task: Task) => {
      if (task.status === "waiting" || task.status === "done") return false;
      if (!task.assignee_id) return true;
      const p = personById.get(task.assignee_id);
      return !p || p.type === "me" || p.type === "ai";
    },
    [personById],
  );

  // ── task mutations ──
  const patchLocal = useCallback((id: string, patch: TaskPatch) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      patchLocal(id, patch);
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) fail(error.message);
    },
    [supabase, patchLocal, fail],
  );

  const addTask = useCallback(
    async ({ title, projectId, workWindow = "this_week" }: { title: string; projectId: string; workWindow?: WorkWindow }) => {
      const { data: row, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: data.workspace.id,
          project_id: projectId,
          assignee_id: me?.id ?? null,
          title: title.trim(),
          work_window: workWindow,
          window_set_on: today,
          sort_order: Date.now() / 1000,
        })
        .select(TASK_COLUMNS)
        .single();
      if (error) {
        fail(error.message);
        return null;
      }
      setData((d) => ({ ...d, tasks: [...d.tasks, row as Task] }));
      return row as Task;
    },
    [supabase, data.workspace.id, me, today, fail],
  );

  const setWindow = useCallback(
    (id: string, win: WorkWindow) => updateTask(id, { work_window: win, window_set_on: today }),
    [updateTask, today],
  );

  const restore = useCallback(
    async (snapshot: Task, createdId?: string) => {
      setData((d) => ({
        ...d,
        tasks: [...d.tasks.filter((t) => t.id !== snapshot.id && t.id !== createdId), snapshot],
      }));
      const { id, ...fields } = snapshot;
      const { error } = await supabase
        .from("tasks")
        .update({
          status: fields.status,
          completed_at: fields.completed_at,
          work_window: fields.work_window,
          window_set_on: fields.window_set_on,
          waiting_on_id: fields.waiting_on_id,
          follow_up_date: fields.follow_up_date,
        })
        .eq("id", id);
      if (createdId) await supabase.from("tasks").delete().eq("id", createdId);
      if (error) fail(error.message);
    },
    [supabase, fail],
  );

  const complete = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      // Leaves the active lists right away.
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return fail(error.message);

      let createdId: string | undefined;
      if (task.repeat_rule) {
        const nextDue = nextOccurrence(task.repeat_rule, task.due_date ?? today);
        const { data: row, error: repeatError } = await supabase
          .from("tasks")
          .insert({
            workspace_id: task.workspace_id,
            project_id: task.project_id,
            assignee_id: task.assignee_id,
            title: task.title,
            brief: task.brief,
            repeat_rule: task.repeat_rule,
            due_date: nextDue,
            work_window: windowForDate(nextDue, today),
            window_set_on: today,
            sort_order: task.sort_order,
          })
          .select(TASK_COLUMNS)
          .single();
        if (repeatError) return fail(repeatError.message);
        createdId = (row as Task).id;
        setData((d) => ({ ...d, tasks: [...d.tasks, row as Task] }));
      }

      toast(task.repeat_rule ? "✅ Done — the next one is scheduled" : "✅ Done", {
        action: { label: "Undo", onClick: () => void restore(task, createdId) },
      });
    },
    [supabase, today, fail, restore],
  );

  const doneForToday = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      await updateTask(id, {
        work_window: "tomorrow",
        window_set_on: today,
        status: task.status === "not_started" ? "in_progress" : task.status,
      });
      toast("🌙 Nice work — continuing tomorrow", {
        action: { label: "Undo", onClick: () => void restore(task) },
      });
    },
    [updateTask, today, restore],
  );

  const waitOn = useCallback(
    async (id: string, personId: string | null, followUp: string | null) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      await updateTask(id, { status: "waiting", waiting_on_id: personId, follow_up_date: followUp });
      const who = personId ? personById.get(personId)?.name : null;
      toast(`⏳ Waiting${who ? ` on ${who}` : ""}`, {
        action: { label: "Undo", onClick: () => void restore(task) },
      });
    },
    [updateTask, personById, restore],
  );

  const backToMe = useCallback(
    (id: string) =>
      updateTask(id, { status: "in_progress", waiting_on_id: null, work_window: "today", window_set_on: today }),
    [updateTask, today],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
      setOpenTaskId((cur) => (cur === id ? null : cur));
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) fail(error.message);
      else toast("Task deleted");
    },
    [supabase, fail],
  );

  // ── people ──
  const addPerson = useCallback(
    async ({ name, email, type, domainIds }: { name: string; email?: string; type: PersonType; domainIds: string[] }) => {
      const { data: row, error } = await supabase
        .from("people")
        .insert({ workspace_id: data.workspace.id, name: name.trim(), email: email?.trim() || null, type })
        .select("id, name, email, type, is_active")
        .single();
      if (error) {
        fail(error.message);
        return null;
      }
      const person = row as Person;
      if (domainIds.length) {
        const links = domainIds.map((domain_id) => ({ workspace_id: data.workspace.id, person_id: person.id, domain_id }));
        const { error: linkError } = await supabase.from("people_domains").insert(links);
        if (linkError) fail(linkError.message);
      }
      setData((d) => ({
        ...d,
        people: [...d.people, person],
        peopleDomains: [...d.peopleDomains, ...domainIds.map((domain_id) => ({ person_id: person.id, domain_id }))],
      }));
      return person;
    },
    [supabase, data.workspace.id, fail],
  );

  const updatePerson = useCallback(
    async (id: string, patch: Partial<Pick<Person, "name" | "email" | "type" | "is_active">>) => {
      setData((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      const { error } = await supabase.from("people").update(patch).eq("id", id);
      if (error) fail(error.message);
    },
    [supabase, fail],
  );

  const setPersonDomains = useCallback(
    async (personId: string, domainIds: string[]) => {
      setData((d) => ({
        ...d,
        peopleDomains: [
          ...d.peopleDomains.filter((pd) => pd.person_id !== personId),
          ...domainIds.map((domain_id) => ({ person_id: personId, domain_id })),
        ],
      }));
      const del = await supabase.from("people_domains").delete().eq("person_id", personId);
      if (del.error) return fail(del.error.message);
      if (domainIds.length) {
        const ins = await supabase
          .from("people_domains")
          .insert(domainIds.map((domain_id) => ({ workspace_id: data.workspace.id, person_id: personId, domain_id })));
        if (ins.error) fail(ins.error.message);
      }
    },
    [supabase, data.workspace.id, fail],
  );

  const updateWorkspace = useCallback(
    async (patch: { send_from_email: string | null }) => {
      setData((d) => ({ ...d, workspace: { ...d.workspace, ...patch } }));
      const { error } = await supabase.from("workspaces").update(patch).eq("id", data.workspace.id);
      if (error) fail(error.message);
    },
    [supabase, data.workspace.id, fail],
  );

  const value: Store = {
    ...data,
    today,
    me,
    openTaskId,
    projectById,
    domainById,
    personById,
    domainOfTask,
    effective,
    peopleForDomain,
    isOnMyPlate,
    openTask: setOpenTaskId,
    addTask,
    updateTask,
    setWindow,
    complete,
    doneForToday,
    waitOn,
    backToMe,
    deleteTask,
    addPerson,
    updatePerson,
    setPersonDomains,
    updateWorkspace,
    reload,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
