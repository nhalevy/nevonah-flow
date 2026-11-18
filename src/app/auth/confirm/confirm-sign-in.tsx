"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Finishes sign-in from the email link and stores the session in cookies (so the server sees it).
// Handles: #access_token (implicit link — works in any browser), ?code (PKCE), ?token_hash.
export function ConfirmSignIn() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { detectSessionInUrl: false } },
    );

    async function finish() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const tokenHash = query.get("token_hash");

      let error: { message: string } | null = null;
      if (accessToken && refreshToken) {
        ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      } else if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash) {
        ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" }));
      } else {
        error = { message: hash.get("error_description") ?? query.get("error_description") ?? "no token in link" };
      }

      if (error) {
        console.error("[auth/confirm]", error.message);
        window.location.replace("/login?error=link");
      } else {
        window.location.replace("/");
      }
    }

    finish();
  }, []);

  return <p className="text-sm text-muted-foreground">Signing you in…</p>;
}
