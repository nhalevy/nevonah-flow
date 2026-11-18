import { Api, ApiError } from "@/lib/api-core";

// Simple REST endpoint for automations (Make.com, Shortcuts, WhatsApp helpers…).
//   GET  /api/v1/tasks?bucket=tmr&window=today      → open tasks (text)
//   POST /api/v1/tasks  {"title","bucket", "project"?, "work_window"?, "due_date"?, "link_url"?, "note"?}
// Auth: header "Authorization: Bearer nf_…"

function keyFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  return key.startsWith("nf_") ? key : null;
}

function fail(e: unknown) {
  const message = e instanceof ApiError ? e.message : (e as Error).message;
  const status = /invalid api key/i.test(message) ? 401 : 400;
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  const key = keyFrom(request);
  if (!key) return Response.json({ ok: false, error: "Missing API key" }, { status: 401 });
  const url = new URL(request.url);
  try {
    const text = await new Api(key).listTasks({
      bucket: url.searchParams.get("bucket") ?? undefined,
      window: (url.searchParams.get("window") as never) ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
    });
    return Response.json({ ok: true, text });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  const key = keyFrom(request);
  if (!key) return Response.json({ ok: false, error: "Missing API key" }, { status: 401 });
  try {
    const body = await request.json();
    const api = new Api(key);
    const task = await api.addTask(body);
    return Response.json({ ok: true, id: task.id, summary: await api.describe(task) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
