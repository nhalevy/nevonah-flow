-- NEVONAH FLOW — initial schema
-- Multi-user ready: every row belongs to a workspace; access = workspace membership (RLS).

create extension if not exists pgcrypto;

-- ───────────────────────── Workspaces ─────────────────────────
create table public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  timezone        text not null default 'America/Toronto',
  send_from_email text,
  created_at      timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Membership check used by every policy. SECURITY DEFINER avoids recursive RLS on workspace_members.
create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- ───────────────────────── Buckets & projects ─────────────────────────
create table public.domains (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug         text not null,
  name         text not null,
  emoji        text not null default '',
  color        text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain_id    uuid not null references public.domains(id) on delete cascade,
  name         text not null,
  emoji        text not null default '',
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index projects_domain_idx on public.projects (domain_id);

-- ───────────────────────── People (the "Who" list) ─────────────────────────
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  email        text,
  type         text not null default 'person' check (type in ('me', 'person', 'org', 'ai')),
  is_active    boolean not null default true,
  user_id      uuid references auth.users(id) on delete set null, -- if they become an app user later
  created_at   timestamptz not null default now()
);
create index people_workspace_idx on public.people (workspace_id);
create unique index people_one_me_per_workspace on public.people (workspace_id) where type = 'me';

create table public.people_domains (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  domain_id    uuid not null references public.domains(id) on delete cascade,
  primary key (person_id, domain_id)
);
create index people_domains_domain_idx on public.people_domains (domain_id);

-- ───────────────────────── Tasks ─────────────────────────
create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete restrict,
  assignee_id    uuid references public.people(id) on delete set null,
  waiting_on_id  uuid references public.people(id) on delete set null,
  title          text not null check (length(trim(title)) > 0),
  status         text not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'waiting', 'blocked', 'done')),
  -- Work window is relative to the day it was set: "tomorrow" set on Mon = Tue.
  work_window    text not null default 'this_week'
                 check (work_window in ('today', 'tomorrow', 'this_week', 'next_week', 'someday')),
  window_set_on  date not null default current_date,
  due_date       date,
  follow_up_date date,
  brief          text,
  repeat_rule    text check (repeat_rule in ('daily', 'weekly', 'biweekly', 'monthly')),
  sort_order     double precision not null default extract(epoch from now()),
  completed_at   timestamptz,
  source_ref     text, -- e.g. "import:Personal!B12" for duplicate detection
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tasks_open_idx on public.tasks (workspace_id, status, work_window);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_waiting_idx on public.tasks (waiting_on_id);
create unique index tasks_source_ref_uniq on public.tasks (workspace_id, source_ref) where source_ref is not null;

create table public.task_links (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  title        text,
  url          text not null,
  provider     text not null default 'other',
  created_at   timestamptz not null default now()
);
create index task_links_task_idx on public.task_links (task_id);

create table public.task_notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  author_id    uuid default auth.uid() references auth.users(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index task_notes_task_idx on public.task_notes (task_id);

-- API keys for AI tools / automations (only a hash is stored)
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  key_hash     text not null unique,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── updated_at trigger ─────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks
for each row execute function public.touch_updated_at();

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.domains           enable row level security;
alter table public.projects          enable row level security;
alter table public.people            enable row level security;
alter table public.people_domains    enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_links        enable row level security;
alter table public.task_notes        enable row level security;
alter table public.api_keys          enable row level security;

create policy "members read workspace" on public.workspaces
  for select using (public.is_member(id));
create policy "members update workspace" on public.workspaces
  for update using (public.is_member(id)) with check (public.is_member(id));

create policy "see own memberships" on public.workspace_members
  for select using (user_id = auth.uid() or public.is_member(workspace_id));

-- Same policy for every workspace-scoped table
do $$
declare t text;
begin
  foreach t in array array['domains','projects','people','people_domains','tasks','task_links','task_notes','api_keys']
  loop
    execute format(
      'create policy "members manage %1$s" on public.%1$I for all
         using (public.is_member(workspace_id))
         with check (public.is_member(workspace_id));', t);
  end loop;
end $$;

-- ───────────────────────── First-login setup ─────────────────────────
-- Creates the workspace, the 3 buckets, their projects and the starting people.
-- Safe to call repeatedly: returns the existing workspace if there is one.
create or replace function public.bootstrap_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  d_personal uuid; d_nevonah uuid; d_tmr uuid;
  p uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select workspace_id into ws from workspace_members where user_id = uid limit 1;
  if ws is not null then
    return ws;
  end if;

  insert into workspaces (name) values ('NEVONAH FLOW') returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');

  insert into domains (workspace_id, slug, name, emoji, color, sort_order)
    values (ws, 'personal', 'Personal', '💜', 'personal', 1) returning id into d_personal;
  insert into domains (workspace_id, slug, name, emoji, color, sort_order)
    values (ws, 'nevonah', 'Nevonah', '🩷', 'nevonah', 2) returning id into d_nevonah;
  insert into domains (workspace_id, slug, name, emoji, color, sort_order)
    values (ws, 'tmr', 'Chabad TMR', '🩵', 'tmr', 3) returning id into d_tmr;

  insert into projects (workspace_id, domain_id, name, emoji, sort_order) values
    (ws, d_personal, 'Kids & Family', '👨‍👩‍👧', 1),
    (ws, d_personal, 'Elianna', '🌸', 2),
    (ws, d_personal, 'Admin & Health', '📄', 3),
    (ws, d_nevonah, 'Clients', '🤝', 1),
    (ws, d_nevonah, 'Business Dev', '🚀', 2),
    (ws, d_nevonah, 'Team & Hiring', '👥', 3),
    (ws, d_tmr, 'Salesforce & Automations', '⚙️', 1),
    (ws, d_tmr, 'Finance & Payments', '💰', 2),
    (ws, d_tmr, 'Other', '📬', 3);

  insert into people (workspace_id, name, type, user_id) values (ws, 'Me', 'me', uid) returning id into p;
  insert into people_domains (workspace_id, person_id, domain_id)
    select ws, p, d.id from domains d where d.workspace_id = ws;

  insert into people (workspace_id, name, type) values (ws, 'Claude', 'ai') returning id into p;
  insert into people_domains (workspace_id, person_id, domain_id)
    select ws, p, d.id from domains d where d.workspace_id = ws;

  insert into people (workspace_id, name, type) values (ws, 'ChatGPT', 'ai') returning id into p;
  insert into people_domains (workspace_id, person_id, domain_id)
    select ws, p, d.id from domains d where d.workspace_id = ws;

  return ws;
end;
$$;

revoke all on function public.bootstrap_workspace() from public, anon;
grant execute on function public.bootstrap_workspace() to authenticated;
