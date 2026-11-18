# NEVONAH FLOW — Product Spec (v1)

A calm, ADHD-friendly command center for three areas of life. Between Todoist (too simple) and Monday/Asana (too much). Built around "Who Not How": for every task, ask *who* can do it.

Status: **draft for approval** · Last updated 2026-11-18

---

## 1. Principles

1. **Minimum input.** A task needs only a name. Everything else is optional and hidden until needed.
2. **One focused list.** "Focus Today" is the home screen. Everything else is one tap away, never in the way.
3. **Delegation is first-class.** Assigning to someone else unlocks a clear brief and a one-click email.
4. **Calm, adult-cute visuals.** Warm, soft, rounded, a few emojis — not childish, not "girly", not a spreadsheet.
5. **AI-friendly.** Claude (and later other tools) can add and update tasks for me.
6. **No notifications.** Ever, in v1.

---

## 2. Structure

### Domains (fixed, 3)
| Domain | Color | Projects |
|---|---|---|
| 💜 Personal | purple | 👨‍👩‍👧 Kids & Family · 🌸 Elianna · 📄 Admin & Health |
| 🩷 Nevonah | pink | 🤝 Clients · 🚀 Business Dev · 👥 Team & Hiring |
| 🩵 Chabad TMR | teal | ⚙️ Salesforce & Automations · 💰 Finance & Payments · 📬 Other |

- Projects are editable (add / rename / reorder / archive / pick emoji). Aim: 2–4 per domain.
- No separate "Category" field.

### People (the "Who" list)
- Fields: **Name**, **Email** (optional), **Type** (Person / Organization / AI), **Domains** (one or more), **Active / Inactive**.
- A person appears in the assignee picker **only for tasks in their domains** (the babysitter never shows up in Nevonah).
- "Me" is always available in every domain.
- Inactive people are hidden from pickers but keep their task history.
- Seeded with: Me (Neta), Claude (AI, all domains), ChatGPT (AI, all domains).

---

## 3. Task

| Field | Required | Notes |
|---|---|---|
| Name | ✅ | Hebrew or English; auto right-to-left |
| Domain + Project | defaults | Defaults to the domain/project you're viewing |
| Assignee | defaults to Me | Filtered by domain |
| Status | defaults Not Started | Not Started · In Progress · Waiting · Blocked · Done |
| Work Window | defaults This Week | Today · Tomorrow · This Week · Next Week · Someday |
| Due date | optional | Real deadline — separate from Work Window |
| Brief | optional | Shown **only when assigned to someone else** (see §5) |
| Repeat | optional | Daily · Weekly · Every 2 weeks · Monthly |
| Links | optional, many | Title + URL + auto-detected type (Claude / ChatGPT / Gemini / Google Docs / Todoist / other) |
| Notes log | optional, many | Dated entries for long text (pasted emails, instructions) |
| Waiting on | optional | A person/org I'm waiting for (separate from assignee — the task stays mine) |
| Follow-up date | optional | For delegated or waiting tasks — when to check in |

**Rules**
- Work Window ≠ Due Date.
- **Three one-click actions per task** (labels only as hover tooltips):
  - ☐ **Checkbox = ✅ All done** — always visible. Done, leaves active views (with Undo).
  - ⏳ **Waiting on others** — shown on hover (desktop) / swipe (phone). Quick "who?" picker (recent first, skippable) + optional follow-up date → status Waiting, shows in With Others; returns to my Up Next when un-waited.
  - 🌙 **Done for today** — shown on hover / swipe. One click → work window = Tomorrow, stays In Progress.
- Repeating task: when completed, the next one is created automatically with the next due date/work window.
- Work windows are relative: at the start of each day, "Tomorrow" tasks roll into "Today" (and "Next Week" into "This Week" on Sunday). Tasks are never silently pushed back.
- If a task stays in "Today" past its day (or its due date passes), it is never labelled overdue — it just asks for a new work window.

---

## 4. Screens

1. **✨ Home** — one card per bucket, side by side. On phone: bucket tabs at the top (💜 / 🩷 / 🩵), one bucket at a time, quick-add adds to the selected bucket. **Buckets are never mixed.**
   - Each card shows **Up Next**: the first 3 open tasks of that bucket (Today first, then This Week), in my drag-to-reorder order.
   - Completing a task or changing its status (e.g. to Waiting) moves it out of the 3; the next task slides up into its spot.
   - **See N more** expands the rest of that bucket's list in place.
   - **No "overdue" anywhere.** A task whose day or due date has passed shows a gentle "🗓 Its day passed — when's a better time?" with one-tap work-window buttons (Today / Tomorrow / This week / Next week).
   - Each row: checkbox, name, work window · project emoji · status, assignee avatar.
2. **Domain boards** (💜 Personal · 🩷 Nevonah · 🩵 TMR)
   - Trello-style: one column per project, tasks as cards.
   - Toggle to a simple list view.
   - Filter by work window / status / assignee.
3. **🤝 With Others** — everything delegated *or waiting on someone*, grouped by person/org, showing follow-up dates and status.
4. **🗂 All Tasks** — search + filter + sort (domain, project, status, assignee, work window, due date).
5. **👥 People** — the Who list.
6. **⚙️ Settings** — projects, "send from" email, density (comfortable / compact), API key for AI tools.

**Task detail** opens as a side panel (desktop) or bottom sheet (phone). Secondary sections are collapsible.

**Quick add** is always available (button + keyboard shortcut `N`): type a name, press Enter, done.

---

## 5. Delegation: Brief + Email

When the assignee is not Me, a **Brief** box appears with a prompt template (based on my own 4-part brief):

```
🎯 Success looks like:
💡 Why it matters:
📎 Context you'll need:
🚧 Please don't change / touch:
✅ How we'll know it's done:
```

Buttons:
- **📧 Email** — opens a pre-written email (task name, brief, due date, links) in Gmail, sent from the address in Settings (`contact@netahalevy.com`). I review and press Send. No email-account connection required in v1.
  - If that address isn't a Google account, falls back to the phone/computer's default email app.
- **📋 Copy as prompt** (AI assignees) — copies the brief formatted as a prompt to paste into Claude / ChatGPT.

---

## 6. AI & quick capture

- **Claude connector (MCP)**: from any Claude chat (desktop, web, phone): "add a TMR task…", "move X to tomorrow", "mark X done", "attach this link to X", "what's on today?".
- **Private API** with a secret key, so Make.com or other tools (e.g. Instinct later) can connect.
- **Android share target**: in the Claude / ChatGPT app → Share → NEVONAH FLOW → attach to an existing task or create a new one. (iPhone: Shortcut later.)
- **Desktop bookmark button**: saves the current page (e.g. a chat) to a task.
- AI links are references only — the app does not read chat contents.

---

## 7. Look & feel ("adult cute")

- Warm off-white background, soft muted domain colors (purple / rose / teal), deep ink text.
- Rounded cards, gentle shadows, almost no borders.
- One emoji per project and per domain; friendly illustrated empty states ("Nothing for today — enjoy the quiet ☕").
- Clear, medium-size type; comfortable + compact density.
- Subtle motion only (checkbox completion, card move). No confetti spam.
- Dark mode supported.
- Mobile-first layout; installable on the phone home screen.

---

## 8. Tech

- Next.js + TypeScript, Tailwind CSS, shadcn/ui
- Supabase (Postgres + auth + row-level security)
- Vercel hosting · GitHub repo · code lives in `C:\dev\nevonah-flow`

### Data model (multi-user-ready)

Every table belongs to a **workspace**; v1 has one workspace with one member (me). Adding teammates later = adding workspace members, no restructuring.

```
workspaces        id, name, created_at
workspace_members workspace_id, user_id, role (owner/member), created_at
domains           id, workspace_id, name, emoji, color, sort_order
projects          id, workspace_id, domain_id, name, emoji, sort_order, archived_at
people            id, workspace_id, name, email, type (person/org/ai), is_active, user_id (nullable – if they become an app user)
people_domains    person_id, domain_id
tasks             id, workspace_id, project_id, assignee_id (people), waiting_on_id (people, nullable), title, status, work_window,
                  due_date, follow_up_date, brief, repeat_rule, sort_order (my manual order within a bucket),
                  completed_at, created_by, created_at, updated_at
task_links        id, task_id, title, url, provider, created_at
task_notes        id, task_id, author_id, body, created_at
api_keys          id, workspace_id, name, key_hash, last_used_at, created_at
```

- Foreign keys, indexes on (workspace_id, work_window, status), (project_id), (assignee_id).
- Row-level security: you can only read/write rows in workspaces you're a member of.

---

## 9. Import (one-time, from `Who_Not_How_Compact_Live_Focus.xlsm`)

- Sheets **Personal / Nevonah / Chabad TMR** → domains.
- Category → mapped to the projects above (mapping shown for review before import).
- Assignee Neta → Me; Claude / ChatGPT → AI people.
- Desired Outcome + Why It Matters + Definition of Done + Next Action → combined into **Brief** (only where filled).
- Chat / Project Link + AI Tool → **Links**.
- Other Notes → a **Notes log** entry.
- **Completed tasks are skipped.**
- Duplicate detection; preview before anything is saved; nothing invented.
- "AI Chat Links" saved conversations → links (only those with URLs).

A general CSV/Excel import screen is **not** in v1 (one-time import only).

---

## 10. Not in v1

Notifications · Todoist sync · SMS/WhatsApp sending · sending email directly from the server · teammates logging in · Hebrew interface · general import screen · iPhone Shortcut.

---

## 11. Build stages

1. **Design** — 2–3 visual mockups → pick one.
2. **Foundation** — project setup, Supabase schema + security, login, GitHub repo.
3. **Core tasks** — quick add, detail panel, Focus Today, domain boards, All Tasks, People.
4. **Delegation** — Brief, email, With Others view.
5. **Import** — workbook import with preview.
6. **AI & capture** — API, Claude connector, Android share, bookmark button.
7. **Polish & deploy** — mobile testing, dark mode, deploy to Vercel, setup guide.

Each stage ends with something I can open and try.
