import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

// Stage 2 placeholder: proves login + database + security work end to end.
// The real Home (Up Next per bucket) arrives in stage 3.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Foundation is ready ✨</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your buckets…</p>}>
        <Buckets />
      </Suspense>
    </main>
  );
}

async function Buckets() {
  const supabase = await createClient();
  const { error: bootError } = await supabase.rpc("bootstrap_workspace");

  const { data: domains, error } = await supabase
    .from("domains")
    .select("id, name, emoji, projects(name, emoji, sort_order)")
    .order("sort_order");

  const failure = bootError ?? error;
  if (failure) {
    return (
      <p role="alert" className="rounded-2xl bg-card p-4 text-sm">
        Database not reachable yet: {failure.message}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {domains?.map((d) => (
        <section key={d.id} className="rounded-2xl bg-card p-4">
          <h2 className="font-semibold">
            {d.emoji} {d.name}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {[...(d.projects ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((p) => (
                <li key={p.name}>
                  {p.emoji} {p.name}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
