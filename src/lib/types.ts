export type Status = "not_started" | "in_progress" | "waiting" | "blocked" | "done";
export type WorkWindow = "today" | "tomorrow" | "this_week" | "next_week" | "someday";
export type RepeatRule = "daily" | "weekly" | "biweekly" | "monthly";
export type PersonType = "me" | "person" | "org" | "ai";
export type BucketSlug = "personal" | "nevonah" | "tmr";

export interface Workspace {
  id: string;
  name: string;
  timezone: string;
  send_from_email: string | null;
}

export interface Domain {
  id: string;
  slug: BucketSlug;
  name: string;
  emoji: string;
  sort_order: number;
}

export interface Project {
  id: string;
  domain_id: string;
  name: string;
  emoji: string;
  sort_order: number;
  archived_at: string | null;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  type: PersonType;
  is_active: boolean;
}

export interface PersonDomain {
  person_id: string;
  domain_id: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  assignee_id: string | null;
  waiting_on_id: string | null;
  title: string;
  status: Status;
  work_window: WorkWindow;
  window_set_on: string; // YYYY-MM-DD
  due_date: string | null;
  follow_up_date: string | null;
  brief: string | null;
  repeat_rule: RepeatRule | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskLink {
  id: string;
  task_id: string;
  title: string | null;
  url: string;
  provider: string;
  created_at: string;
}

export interface TaskNote {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
}

export interface WorkspaceData {
  workspace: Workspace;
  domains: Domain[];
  projects: Project[];
  people: Person[];
  peopleDomains: PersonDomain[];
  tasks: Task[];
}

/** Placeholder name for a task created straight into the details panel; the panel selects it so you can type over it. */
export const NEW_TASK_TITLE = "New task";

export const TASK_COLUMNS =
  "id, workspace_id, project_id, assignee_id, waiting_on_id, title, status, work_window, window_set_on, due_date, follow_up_date, brief, repeat_rule, sort_order, completed_at, created_at, updated_at";

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  done: "Done",
};

export const WINDOW_LABEL: Record<WorkWindow, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  next_week: "Next week",
  someday: "Someday",
};

export const REPEAT_LABEL: Record<RepeatRule, string> = {
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};
