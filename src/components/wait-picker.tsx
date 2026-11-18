"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Avatar } from "./avatar";

/** "Waiting on others": pick who (optional), optional follow-up date. */
export function WaitPicker({ task, onDone }: { task: Task; onDone: () => void }) {
  const { domainOfTask, peopleForDomain, waitOn, addPerson } = useStore();
  const domain = domainOfTask(task);
  const people = domain ? peopleForDomain(domain.id).filter((p) => p.type !== "me") : [];
  const [followUp, setFollowUp] = useState("");
  const [newName, setNewName] = useState("");

  async function pick(personId: string | null) {
    await waitOn(task.id, personId, followUp || null);
    onDone();
  }

  async function addAndPick(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !domain) return;
    const person = await addPerson({ name: newName, type: "person", domainIds: [domain.id] });
    if (person) await pick(person.id);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">⏳ WAITING ON…</p>
      <div className="flex max-h-56 flex-col overflow-y-auto">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <Avatar person={p} />
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => pick(null)}
          className="rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
        >
          Skip — I&apos;ll add who later
        </button>
      </div>
      <form onSubmit={addAndPick} className="flex gap-1.5 border-t pt-2">
        <label htmlFor={`new-${task.id}`} className="sr-only">
          Someone new
        </label>
        <input
          id={`new-${task.id}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Someone new…"
          className="h-8 min-w-0 flex-1 rounded-lg bg-muted px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" className="h-8 rounded-lg bg-secondary px-2.5 text-xs font-semibold">
          Add
        </button>
      </form>
      <label className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        Follow up on
        <input
          type="date"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          className="h-8 rounded-lg bg-muted px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
    </div>
  );
}
