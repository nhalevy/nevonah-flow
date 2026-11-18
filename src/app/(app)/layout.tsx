import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/load";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { TaskPanel } from "@/components/task-panel";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <Loaded>{children}</Loaded>
    </Suspense>
  );
}

async function Loaded({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  let data;
  try {
    data = await loadWorkspace(supabase);
  } catch (e) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <p role="alert" className="rounded-2xl bg-card p-5 text-sm">
          Couldn&apos;t load your tasks: {(e as Error).message}
        </p>
      </main>
    );
  }

  return (
    <StoreProvider initial={data}>
      <AppShell>{children}</AppShell>
      <TaskPanel />
      <Toaster position="bottom-center" offset={88} mobileOffset={88} />
    </StoreProvider>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground" aria-live="polite">
      Getting your day ready… ☕
    </div>
  );
}
