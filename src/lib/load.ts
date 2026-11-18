import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_COLUMNS, type WorkspaceData } from "./types";

/** Loads everything the app needs (open tasks only). Works with the server or the browser client. */
export async function loadWorkspace(supabase: SupabaseClient): Promise<WorkspaceData> {
  const { data: workspaceId, error: bootError } = await supabase.rpc("bootstrap_workspace");
  if (bootError) throw new Error(bootError.message);

  const [ws, domains, projects, people, peopleDomains, tasks] = await Promise.all([
    supabase.from("workspaces").select("id, name, timezone, send_from_email").eq("id", workspaceId).single(),
    supabase.from("domains").select("id, slug, name, emoji, sort_order").eq("workspace_id", workspaceId).order("sort_order"),
    supabase
      .from("projects")
      .select("id, domain_id, name, emoji, sort_order, archived_at")
      .eq("workspace_id", workspaceId)
      .order("sort_order"),
    supabase.from("people").select("id, name, email, type, is_active").eq("workspace_id", workspaceId).order("created_at"),
    supabase.from("people_domains").select("person_id, domain_id").eq("workspace_id", workspaceId),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .order("sort_order"),
  ]);

  const firstError = [ws, domains, projects, people, peopleDomains, tasks].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  return {
    workspace: ws.data!,
    domains: domains.data ?? [],
    projects: projects.data ?? [],
    people: people.data ?? [],
    peopleDomains: peopleDomains.data ?? [],
    tasks: tasks.data ?? [],
  } as WorkspaceData;
}
