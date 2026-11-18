"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { BUCKET_STYLE } from "@/lib/buckets";
import { cn } from "@/lib/utils";
import type { Person, PersonType } from "@/lib/types";
import { Avatar } from "./avatar";

const TYPE_LABEL: Record<Exclude<PersonType, "me">, string> = { person: "👤 Person", org: "🏢 Organization", ai: "🤖 AI" };
const input =
  "h-9 rounded-[10px] bg-accent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PeopleView() {
  const { people } = useStore();
  const [showInactive, setShowInactive] = useState(false);
  const others = people.filter((p) => p.type !== "me");
  const visible = others.filter((p) => showInactive || p.is_active);
  const inactiveCount = others.length - others.filter((p) => p.is_active).length;

  return (
    <main className="flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-10 md:px-8 md:pt-9 md:pl-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">👥 People</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Your “Who” list. Each person only shows up in the buckets you choose.</p>
      </header>

      <AddPerson />

      <div className="flex flex-col gap-2">
        {visible.map((p) => (
          <PersonRow key={p.id} person={p} />
        ))}
      </div>

      {inactiveCount > 0 && (
        <button type="button" onClick={() => setShowInactive((v) => !v)} className="self-start text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          {showInactive ? "Hide inactive" : `Show ${inactiveCount} inactive`}
        </button>
      )}
    </main>
  );
}

function DomainToggles({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { domains } = useStore();
  return (
    <div role="group" aria-label="Buckets" className="flex flex-wrap gap-1.5">
      {domains.map((d) => {
        const on = value.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d.id) : [...value, d.id])}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              on ? cn(BUCKET_STYLE[d.slug].tint, BUCKET_STYLE[d.slug].ink) : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
            )}
          >
            {d.emoji} {d.name}
          </button>
        );
      })}
    </div>
  );
}

function AddPerson() {
  const { addPerson, domains } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<Exclude<PersonType, "me">>("person");
  const [domainIds, setDomainIds] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await addPerson({ name, email, type, domainIds: domainIds.length ? domainIds : domains.map((d) => d.id) });
    if (created) {
      setName("");
      setEmail("");
      setDomainIds([]);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[0_1px_2px_rgba(35,33,43,.05)]">
      <h2 className="text-sm font-bold">＋ Add someone</h2>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="p-name">
          Name
        </label>
        <input id="p-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={cn(input, "min-w-40 flex-1")} />
        <label className="sr-only" htmlFor="p-email">
          Email
        </label>
        <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={cn(input, "min-w-48 flex-1")} />
        <label className="sr-only" htmlFor="p-type">
          Type
        </label>
        <select id="p-type" value={type} onChange={(e) => setType(e.target.value as Exclude<PersonType, "me">)} className={input}>
          {(Object.keys(TYPE_LABEL) as Exclude<PersonType, "me">[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Shows up in:</span>
        <DomainToggles value={domainIds} onChange={setDomainIds} />
        <button type="submit" className="ml-auto rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">
          Add
        </button>
      </div>
      {domainIds.length === 0 && name.trim() && <p className="text-xs text-muted-foreground">No bucket picked → they&apos;ll show up in all three.</p>}
    </form>
  );
}

function PersonRow({ person }: { person: Person }) {
  const { peopleDomains, updatePerson, setPersonDomains } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email ?? "");
  const domainIds = peopleDomains.filter((pd) => pd.person_id === person.id).map((pd) => pd.domain_id);

  return (
    <div className={cn("rounded-2xl bg-card px-4 py-3 shadow-[0_1px_2px_rgba(35,33,43,.05)]", !person.is_active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar person={person} />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 flex-col text-left">
          <span dir="auto" className="text-sm font-semibold">
            {person.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABEL[person.type as Exclude<PersonType, "me">]}
            {person.email ? ` · ${person.email}` : ""}
          </span>
        </button>
        <DomainToggles value={domainIds} onChange={(ids) => setPersonDomains(person.id, ids)} />
        <button
          type="button"
          aria-pressed={person.is_active}
          onClick={() => updatePerson(person.id, { is_active: !person.is_active })}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            person.is_active ? "bg-tmr-tint text-tmr-ink" : "bg-muted text-muted-foreground",
          )}
        >
          {person.is_active ? "Active" : "Inactive"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <label className="sr-only" htmlFor={`n-${person.id}`}>
            Name
          </label>
          <input
            id={`n-${person.id}`}
            dir="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== person.name && updatePerson(person.id, { name: name.trim() })}
            className={cn(input, "min-w-40 flex-1")}
          />
          <label className="sr-only" htmlFor={`e-${person.id}`}>
            Email
          </label>
          <input
            id={`e-${person.id}`}
            type="email"
            value={email}
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email !== (person.email ?? "") && updatePerson(person.id, { email: email.trim() || null })}
            className={cn(input, "min-w-48 flex-1")}
          />
          <label className="sr-only" htmlFor={`t-${person.id}`}>
            Type
          </label>
          <select
            id={`t-${person.id}`}
            value={person.type}
            onChange={(e) => updatePerson(person.id, { type: e.target.value as PersonType })}
            className={input}
          >
            {(Object.keys(TYPE_LABEL) as Exclude<PersonType, "me">[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
