-- NEVONAH FLOW — API access for AI tools (Claude connector) and automations.
-- Tools hold a secret key ("nf_…"). Only its SHA-256 hash is stored.
-- Every api_* function checks the key first and only touches that key's workspace.

-- ───────── key management (signed-in user) ─────────
create or replace function public.create_api_key(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
  plain text;
begin
  select workspace_id into ws from workspace_members where user_id = auth.uid() limit 1;
  if ws is null then raise exception 'not signed in'; end if;
  plain := 'nf_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into api_keys (workspace_id, name, key_hash)
    values (ws, coalesce(nullif(trim(p_name), ''), 'API key'), encode(extensions.digest(plain, 'sha256'), 'hex'));
  return plain; -- shown once, never stored
end;
$$;
revoke all on function public.create_api_key(text) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;

-- ───────── internal: key → workspace ─────────
create or replace function public._api_workspace(p_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare ws uuid;
begin
  update api_keys set last_used_at = now()
    where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
    returning workspace_id into ws;
  if ws is null then raise exception 'invalid api key' using errcode = '28000'; end if;
  return ws;
end;
$$;
revoke all on function public._api_workspace(text) from public, anon, authenticated;

create or replace function public._api_check_ids(ws uuid, p_project uuid, p_person uuid, p_waiting uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_project is not null and not exists (select 1 from projects where id = p_project and workspace_id = ws) then
    raise exception 'unknown project';
  end if;
  if p_person is not null and not exists (select 1 from people where id = p_person and workspace_id = ws) then
    raise exception 'unknown person';
  end if;
  if p_waiting is not null and not exists (select 1 from people where id = p_waiting and workspace_id = ws) then
    raise exception 'unknown person';
  end if;
end;
$$;
revoke all on function public._api_check_ids(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- ───────── read everything (open tasks only) ─────────
create or replace function public.api_snapshot(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ws uuid := _api_workspace(p_key);
begin
  return jsonb_build_object(
    'workspace', (select jsonb_build_object('id', id, 'timezone', timezone) from workspaces where id = ws),
    'domains', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'name', name, 'emoji', emoji) order by sort_order) from domains where workspace_id = ws), '[]'),
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'domain_id', domain_id, 'name', name, 'emoji', emoji) order by sort_order) from projects where workspace_id = ws and archived_at is null), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'type', p.type, 'is_active', p.is_active,
        'domain_ids', coalesce((select jsonb_agg(pd.domain_id) from people_domains pd where pd.person_id = p.id), '[]'))) from people p where p.workspace_id = ws), '[]'),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from tasks t where t.workspace_id = ws and t.status <> 'done'), '[]')
  );
end;
$$;

-- ───────── add a task ─────────
create or replace function public.api_add_task(p_key text, p_task jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := _api_workspace(p_key);
  v_project uuid := (p_task->>'project_id')::uuid;
  v_assignee uuid := nullif(p_task->>'assignee_id', '')::uuid;
  result jsonb;
begin
  if v_project is null then raise exception 'project_id is required'; end if;
  if v_assignee is null then
    select id into v_assignee from people where workspace_id = ws and type = 'me';
  end if;
  perform _api_check_ids(ws, v_project, v_assignee, null);

  insert into tasks (workspace_id, project_id, assignee_id, title, work_window, window_set_on, due_date, brief, status, created_by)
  values (
    ws, v_project, v_assignee,
    trim(p_task->>'title'),
    coalesce(nullif(p_task->>'work_window', ''), 'this_week'),
    coalesce(nullif(p_task->>'window_set_on', '')::date, current_date),
    nullif(p_task->>'due_date', '')::date,
    nullif(p_task->>'brief', ''),
    coalesce(nullif(p_task->>'status', ''), 'not_started'),
    null
  )
  returning to_jsonb(tasks.*) into result;
  return result;
end;
$$;

-- ───────── update a task (only the fields given) ─────────
create or replace function public.api_update_task(p_key text, p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := _api_workspace(p_key);
  result jsonb;
begin
  if not exists (select 1 from tasks where id = p_id and workspace_id = ws) then raise exception 'unknown task'; end if;
  perform _api_check_ids(ws,
    nullif(p_patch->>'project_id', '')::uuid,
    nullif(p_patch->>'assignee_id', '')::uuid,
    nullif(p_patch->>'waiting_on_id', '')::uuid);

  update tasks set
    title          = case when p_patch ? 'title' then trim(p_patch->>'title') else title end,
    status         = case when p_patch ? 'status' then p_patch->>'status' else status end,
    work_window    = case when p_patch ? 'work_window' then p_patch->>'work_window' else work_window end,
    window_set_on  = case when p_patch ? 'window_set_on' then (p_patch->>'window_set_on')::date else window_set_on end,
    due_date       = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date', '')::date else due_date end,
    follow_up_date = case when p_patch ? 'follow_up_date' then nullif(p_patch->>'follow_up_date', '')::date else follow_up_date end,
    project_id     = case when p_patch ? 'project_id' then (p_patch->>'project_id')::uuid else project_id end,
    assignee_id    = case when p_patch ? 'assignee_id' then nullif(p_patch->>'assignee_id', '')::uuid else assignee_id end,
    waiting_on_id  = case when p_patch ? 'waiting_on_id' then nullif(p_patch->>'waiting_on_id', '')::uuid else waiting_on_id end,
    brief          = case when p_patch ? 'brief' then nullif(p_patch->>'brief', '') else brief end,
    completed_at   = case when p_patch->>'status' = 'done' then now() when p_patch ? 'status' then null else completed_at end
  where id = p_id and workspace_id = ws
  returning to_jsonb(tasks.*) into result;
  return result;
end;
$$;

-- ───────── complete (creates the next one for repeating tasks) ─────────
create or replace function public.api_complete_task(p_key text, p_id uuid, p_next_due date, p_next_window text, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := _api_workspace(p_key);
  t tasks;
  next_task jsonb;
begin
  select * into t from tasks where id = p_id and workspace_id = ws;
  if not found then raise exception 'unknown task'; end if;
  update tasks set status = 'done', completed_at = now() where id = p_id;
  if t.repeat_rule is not null and p_next_due is not null then
    insert into tasks (workspace_id, project_id, assignee_id, title, brief, repeat_rule, due_date, work_window, window_set_on, sort_order)
    values (ws, t.project_id, t.assignee_id, t.title, t.brief, t.repeat_rule, p_next_due, coalesce(p_next_window, 'someday'), coalesce(p_today, current_date), t.sort_order)
    returning to_jsonb(tasks.*) into next_task;
  end if;
  return jsonb_build_object('completed', p_id, 'next', next_task);
end;
$$;

-- ───────── links & notes ─────────
create or replace function public.api_add_link(p_key text, p_task uuid, p_url text, p_title text, p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := _api_workspace(p_key);
  result jsonb;
begin
  if not exists (select 1 from tasks where id = p_task and workspace_id = ws) then raise exception 'unknown task'; end if;
  insert into task_links (workspace_id, task_id, url, title, provider)
    values (ws, p_task, p_url, nullif(p_title, ''), coalesce(nullif(p_provider, ''), 'other'))
    returning to_jsonb(task_links.*) into result;
  return result;
end;
$$;

create or replace function public.api_add_note(p_key text, p_task uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := _api_workspace(p_key);
  result jsonb;
begin
  if not exists (select 1 from tasks where id = p_task and workspace_id = ws) then raise exception 'unknown task'; end if;
  insert into task_notes (workspace_id, task_id, body, author_id)
    values (ws, p_task, p_body, null)
    returning to_jsonb(task_notes.*) into result;
  return result;
end;
$$;

create or replace function public.api_task_details(p_key text, p_task uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ws uuid := _api_workspace(p_key);
begin
  if not exists (select 1 from tasks where id = p_task and workspace_id = ws) then raise exception 'unknown task'; end if;
  return jsonb_build_object(
    'task', (select to_jsonb(t) from tasks t where t.id = p_task),
    'links', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'url', url) order by created_at) from task_links where task_id = p_task), '[]'),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('date', created_at::date, 'body', body) order by created_at desc) from task_notes where task_id = p_task), '[]')
  );
end;
$$;

-- The api_* functions are reachable with the public anon key, but useless without a valid secret key.
revoke all on function public.api_snapshot(text) from public;
revoke all on function public.api_add_task(text, jsonb) from public;
revoke all on function public.api_update_task(text, uuid, jsonb) from public;
revoke all on function public.api_complete_task(text, uuid, date, text, date) from public;
revoke all on function public.api_add_link(text, uuid, text, text, text) from public;
revoke all on function public.api_add_note(text, uuid, text) from public;
revoke all on function public.api_task_details(text, uuid) from public;
grant execute on function public.api_snapshot(text) to anon, authenticated;
grant execute on function public.api_add_task(text, jsonb) to anon, authenticated;
grant execute on function public.api_update_task(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.api_complete_task(text, uuid, date, text, date) to anon, authenticated;
grant execute on function public.api_add_link(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.api_add_note(text, uuid, text) to anon, authenticated;
grant execute on function public.api_task_details(text, uuid) to anon, authenticated;
