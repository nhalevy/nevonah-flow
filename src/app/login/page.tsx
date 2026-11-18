import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-[0_1px_2px_rgba(35,33,43,.05),0_8px_24px_rgba(35,33,43,.06)]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 14c3-6 6 2 9-4s5-2 7-4" />
              <path d="M4 19c3-6 6 2 9-4s5-2 7-4" opacity=".5" />
            </svg>
          </span>
          <span className="text-[15px] font-bold tracking-[0.06em]">NEVONAH FLOW</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back ☕</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We&apos;ll email you a link to sign in. No password needed.
        </p>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}

async function LinkError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm">
      That link didn&apos;t work. It may have expired, or it opened in a different browser. Request a new one below and open it in this browser.
    </p>
  );
}
