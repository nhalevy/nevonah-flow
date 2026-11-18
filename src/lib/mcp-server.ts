import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Api, ApiError, STATUSES, WINDOWS } from "./api-core";

const windowEnum = z.enum(WINDOWS as [string, ...string[]]);
const statusEnum = z.enum(STATUSES as [string, ...string[]]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (text: string): Result => ({ content: [{ type: "text", text }] });

async function run(fn: () => Promise<string>): Promise<Result> {
  try {
    return ok(await fn());
  } catch (e) {
    const message = e instanceof ApiError ? e.message : `Something went wrong: ${(e as Error).message}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

/** The NEVONAH FLOW tools Claude (or any MCP client) can use. */
export function buildMcpServer(key: string) {
  const api = new Api(key);
  const server = new McpServer(
    { name: "nevonah-flow", version: "1.0.0" },
    {
      instructions:
        "NEVONAH FLOW is Neta's calm task manager with three separate buckets: Personal, Nevonah and Chabad TMR. " +
        "Never mix buckets. Each task has a work window (when she plans to focus: today, tomorrow, this_week, next_week, someday) " +
        "that is different from its due date. Keep task names short. When she shares a chat link, attach it with add_link. " +
        "Call get_overview first if you don't know the projects or people.",
    },
  );

  server.registerTool(
    "get_overview",
    {
      title: "Buckets, projects and people",
      description: "Lists the three buckets, their projects, and the people/AI helpers available in each.",
      annotations: { readOnlyHint: true },
    },
    () => run(() => api.overview()),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List open tasks",
      description:
        "Lists open tasks, grouped by bucket. Filter by bucket, by window (today, tomorrow, this_week, next_week, someday, needs_new_day, waiting) or by text.",
      inputSchema: {
        bucket: z.string().optional().describe('"personal", "nevonah" or "tmr"'),
        window: z
          .enum(["today", "tomorrow", "this_week", "next_week", "someday", "needs_new_day", "waiting"])
          .optional(),
        query: z.string().optional().describe("Text to search in titles and briefs"),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args) => run(() => api.listTasks(args)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Task details",
      description: "Shows one task with its brief, links and notes. Accepts the 8-character id from list_tasks.",
      inputSchema: { task_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    ({ task_id }) => run(() => api.details(task_id)),
  );

  server.registerTool(
    "add_task",
    {
      title: "Add a task",
      description:
        "Adds a task to a bucket. Only title and bucket are required. Optionally attach a chat link (link_url) or a note. " +
        "If assigned to someone else, write a short brief (success looks like / why / context / don't touch / done when).",
      inputSchema: {
        title: z.string().min(1),
        bucket: z.string().describe('"personal", "nevonah" or "tmr"'),
        project: z.string().optional().describe("Project name inside the bucket; defaults to the first one"),
        work_window: windowEnum.optional().describe("Defaults to this_week"),
        due_date: date.optional(),
        assignee: z.string().optional().describe('Person name, "Claude", or "me" (default)'),
        brief: z.string().optional(),
        link_url: z.string().optional().describe("e.g. the URL of this chat"),
        link_title: z.string().optional(),
        note: z.string().optional().describe("Longer text to keep with the task"),
      },
    },
    (args) =>
      run(async () => {
        const task = await api.addTask(args as Parameters<Api["addTask"]>[0]);
        return `Added:\n${await api.describe(task)}`;
      }),
  );

  server.registerTool(
    "update_task",
    {
      title: "Change a task",
      description:
        "Changes any of: title, status, work_window, due_date, bucket/project, assignee, waiting_on (person; sets status to waiting), follow_up_date, brief, repeat. " +
        "Use complete_task to finish a task.",
      inputSchema: {
        task_id: z.string(),
        title: z.string().optional(),
        status: statusEnum.optional(),
        work_window: windowEnum.optional(),
        due_date: date.nullable().optional(),
        bucket: z.string().optional(),
        project: z.string().optional(),
        assignee: z.string().optional(),
        waiting_on: z.string().nullable().optional(),
        follow_up_date: date.nullable().optional(),
        brief: z.string().nullable().optional(),
        repeat: z.enum(["daily", "weekly", "biweekly", "monthly", "none"]).optional(),
      },
    },
    ({ task_id, ...rest }) =>
      run(async () => {
        const task = await api.updateTask(task_id, rest as Parameters<Api["updateTask"]>[1]);
        return `Updated:\n${await api.describe(task)}`;
      }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Mark all done",
      description: "Marks a task as completely done. Repeating tasks automatically get their next occurrence.",
      inputSchema: { task_id: z.string() },
    },
    ({ task_id }) =>
      run(async () => {
        const { task, next } = await api.complete(task_id);
        return `✅ Done: ${task.title}${next ? `\nNext one scheduled for ${next.due_date}.` : ""}`;
      }),
  );

  server.registerTool(
    "done_for_today",
    {
      title: "Done for today",
      description: "My part is done for today; continue tomorrow. Moves the task to tomorrow and keeps it in progress.",
      inputSchema: { task_id: z.string() },
    },
    ({ task_id }) =>
      run(async () => {
        const task = await api.doneForToday(task_id);
        return `🌙 Moved to tomorrow: ${task.title}`;
      }),
  );

  server.registerTool(
    "add_link",
    {
      title: "Attach a link",
      description: "Attaches a link (e.g. this AI chat, a Google Doc) to a task so it's one click away later.",
      inputSchema: { task_id: z.string(), url: z.string(), title: z.string().optional() },
    },
    ({ task_id, url, title }) =>
      run(async () => {
        await api.addLink(task_id, url, title);
        return `🔗 Link attached.`;
      }),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add a note",
      description: "Saves longer text (an email, instructions, a summary) on a task.",
      inputSchema: { task_id: z.string(), text: z.string().min(1) },
    },
    ({ task_id, text }) =>
      run(async () => {
        await api.addNote(task_id, text);
        return `🗒 Note saved.`;
      }),
  );

  return server;
}
