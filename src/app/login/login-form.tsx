"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-6 rounded-2xl bg-muted px-4 py-3 text-sm">
        📬 Check <strong>{email}</strong> for your sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
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
        className="h-11 rounded-xl border border-input bg-background px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" disabled={state === "sending"} className="h-11 rounded-xl text-[15px] font-semibold">
        {state === "sending" ? "Sending…" : "Email me a link"}
      </Button>
      {state === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
