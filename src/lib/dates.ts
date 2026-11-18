import type { RepeatRule, Task, WorkWindow } from "./types";

// All dates are plain YYYY-MM-DD strings in the workspace's timezone. Weeks start on Sunday.

export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function addMonths(iso: string, months: number): string {
  const d = toUTC(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUTC(d);
}

export function weekStart(iso: string): string {
  return addDays(iso, -toUTC(iso).getUTCDay());
}

/** Where a task really sits today. "passed" = its day went by and it needs a new work window. */
export type Effective = WorkWindow | "passed";

export const EFFECTIVE_RANK: Record<Effective, number> = {
  passed: -1,
  today: 0,
  tomorrow: 1,
  this_week: 2,
  next_week: 3,
  someday: 4,
};

function windowPosition(win: WorkWindow, setOn: string, today: string): Effective {
  const thisWeek = weekStart(today);
  switch (win) {
    case "someday":
      return "someday";
    case "today":
      return setOn >= today ? "today" : "passed";
    case "tomorrow": {
      const target = addDays(setOn, 1);
      if (target === today) return "today";
      return target > today ? "tomorrow" : "passed";
    }
    case "this_week": {
      const ws = weekStart(setOn);
      if (ws === thisWeek) return "this_week";
      return ws > thisWeek ? "this_week" : "passed";
    }
    case "next_week": {
      const target = addDays(weekStart(setOn), 7);
      if (target === thisWeek) return "this_week";
      return target > thisWeek ? "next_week" : "passed";
    }
  }
}

function duePosition(due: string, setOn: string, today: string): Effective | null {
  // A due date only nags if it passed after the window was last chosen.
  if (due < today) return setOn <= due ? "passed" : null;
  if (due === today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  const dueWeek = weekStart(due);
  const thisWeek = weekStart(today);
  if (dueWeek === thisWeek) return "this_week";
  if (dueWeek === addDays(thisWeek, 7)) return "next_week";
  return null;
}

/** Combines work window and due date: the due date can pull a task forward, never push it back. */
export function effectiveWindow(task: Pick<Task, "work_window" | "window_set_on" | "due_date">, today: string): Effective {
  const fromWindow = windowPosition(task.work_window, task.window_set_on, today);
  if (fromWindow === "passed") return "passed";
  if (!task.due_date) return fromWindow;
  const fromDue = duePosition(task.due_date, task.window_set_on, today);
  if (fromDue === null) return fromWindow;
  return EFFECTIVE_RANK[fromDue] < EFFECTIVE_RANK[fromWindow] ? fromDue : fromWindow;
}

/** The window that best describes a future date, from today's point of view. */
export function windowForDate(date: string, today: string): WorkWindow {
  if (date <= today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  const thisWeek = weekStart(today);
  if (weekStart(date) === thisWeek) return "this_week";
  if (weekStart(date) === addDays(thisWeek, 7)) return "next_week";
  return "someday"; // the due date will pull it forward when the time comes
}

export function nextOccurrence(rule: RepeatRule, from: string): string {
  switch (rule) {
    case "daily":
      return addDays(from, 1);
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly":
      return addMonths(from, 1);
  }
}

export function formatShortDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(toUTC(iso));
}

export function formatLongToday(timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone }).format(
    new Date(),
  );
}

export function greeting(timezone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
