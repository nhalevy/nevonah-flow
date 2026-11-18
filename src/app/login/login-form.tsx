"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 rounded-xl border border-input bg-background px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) setError("Couldn't send the email. Please try again in a minute.");
    else setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("That code didn't work. Check it, or request a new email.");
    else router.replace("/");
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="mt-6 flex flex-col gap-3">
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
          📬 Check <strong>{email}</strong>. Click the link in the email, or type the code here.
        </p>
        <label htmlFor="code" className="text-sm font-medium">
          Code from the email
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${inputClass} tracking-[0.3em]`}
        />
        <Button type="submit" disabled={busy} className="h-11 rounded-xl text-[15px] font-semibold">
          {busy ? "Checking…" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={sendLink} className="mt-6 flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <Button type="submit" disabled={busy} className="h-11 rounded-xl text-[15px] font-semibold">
        {busy ? "Sending…" : "Email me a link"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
