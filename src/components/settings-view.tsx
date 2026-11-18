"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectSection } from "./connect-section";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

export function SettingsView() {
  const { workspace, updateWorkspace } = useStore();
  const [sendFrom, setSendFrom] = useState(workspace.send_from_email ?? "");

  async function signOut() {
    await createClient().auth.signOut();
    window.location.replace("/login");
  }

  return (
    <main className="flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-10 md:px-8 md:pt-9 md:pl-4">
      <h1 className="text-2xl font-bold tracking-tight">⚙️ Settings</h1>

      <section className="flex flex-col gap-3 rounded-[20px] bg-card p-5 shadow-[0_1px_2px_rgba(35,33,43,.05)]">
        <label htmlFor="send-from" className="text-sm font-bold">
          📧 Send briefs from
        </label>
        <p className="text-[13px] text-muted-foreground">
          The 📧 Email button opens Gmail signed in as this address (it must be a Google account you&apos;re signed in to).
        </p>
        <input
          id="send-from"
          type="email"
          value={sendFrom}
          placeholder="contact@netahalevy.com"
          onChange={(e) => setSendFrom(e.target.value)}
          onBlur={() => sendFrom !== (workspace.send_from_email ?? "") && updateWorkspace({ send_from_email: sendFrom.trim() || null })}
          className="h-10 rounded-xl bg-accent px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </section>

      <ConnectSection />

      <section className="flex flex-col gap-2 rounded-[20px] bg-card p-5 shadow-[0_1px_2px_rgba(35,33,43,.05)]">
        <h2 className="text-sm font-bold">📥 Import</h2>
        <p className="text-[13px] text-muted-foreground">Bring in tasks from your Who-Not-How workbook (preview first).</p>
        <Link href="/import" className="self-start rounded-xl bg-secondary px-4 py-2 text-[13px] font-semibold">
          Open import
        </Link>
      </section>

      <button type="button" onClick={signOut} className="self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-card">
        Sign out
      </button>
    </main>
  );
}
