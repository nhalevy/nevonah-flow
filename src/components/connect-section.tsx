"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

interface KeyRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

const card = "flex flex-col gap-3 rounded-[20px] bg-card p-5 shadow-[0_1px_2px_rgba(35,33,43,.05)]";

/** API keys for Claude / automations, plus the desktop bookmark button. */
export function ConnectSection() {
  const supabase = useMemo(() => createClient(), []);
  const { workspace } = useStore();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [name, setName] = useState("Claude");
  const [fresh, setFresh] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const bookmarkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("api_keys")
      .select("id, name, created_at, last_used_at")
      .eq("workspace_id", workspace.id)
      .order("created_at")
      .then(({ data }) => alive && setKeys((data as KeyRow[]) ?? []));
    return () => {
      alive = false;
    };
  }, [supabase, workspace.id]);

  useEffect(() => {
    const o = window.location.origin;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page origin is only known in the browser
    setOrigin(o);
    // React refuses javascript: URLs as props, so the bookmarklet is set on the element directly.
    const code = `javascript:(()=>{window.open('${o}/share?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank')})()`;
    bookmarkRef.current?.setAttribute("href", code);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_api_key", { p_name: name });
    if (error) return toast.error(`Couldn't create key: ${error.message}`);
    setFresh(data as string);
    const { data: list } = await supabase
      .from("api_keys")
      .select("id, name, created_at, last_used_at")
      .eq("workspace_id", workspace.id)
      .order("created_at");
    setKeys((list as KeyRow[]) ?? []);
  }

  async function revoke(id: string) {
    if (!window.confirm("Remove this key? Anything using it will stop working.")) return;
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setKeys((k) => (k ?? []).filter((x) => x.id !== id));
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast("📋 Copied");
  }

  const connectorUrl = fresh ? `${origin}/api/mcp/${fresh}` : null;
  const isLocal = origin.includes("localhost");

  return (
    <>
      <section className={card}>
        <h2 className="text-sm font-bold">🤖 Connect Claude &amp; other tools</h2>
        <p className="text-[13px] text-muted-foreground">
          Create a key, then add the connector address in Claude (Settings → Connectors → Add custom connector). Claude can then add, change and complete
          tasks for you, and attach chat links.
        </p>

        {fresh && connectorUrl && (
          <div className="flex flex-col gap-2 rounded-2xl bg-tmr-tint p-4 text-tmr-ink">
            <p className="text-[13px] font-semibold">Copy these now. The key is shown only once.</p>
            <CopyLine label="Claude connector address" value={connectorUrl} onCopy={copy} />
            <CopyLine label="API key (for Make.com etc.)" value={fresh} onCopy={copy} />
            {isLocal && (
              <p className="text-xs">
                This address is on your computer (localhost), so Claude.ai can&apos;t reach it yet. It will work once the app is online. Create the key again
                from the online app then.
              </p>
            )}
          </div>
        )}

        {keys && keys.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 rounded-xl bg-accent px-3 py-2 text-sm">
                <span className="font-semibold">🔑 {k.name}</span>
                <span className="text-xs text-muted-foreground">
                  {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : "never used"}
                </span>
                <button type="button" onClick={() => revoke(k.id)} className="ml-auto text-xs font-semibold text-destructive">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="flex flex-wrap gap-2">
          <label htmlFor="key-name" className="sr-only">
            Key name
          </label>
          <input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is it for? e.g. Claude"
            className="h-10 min-w-48 flex-1 rounded-xl bg-accent px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="submit" className="rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">
            Create key
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">🔖 Save any page to a task (computer)</h2>
        <p className="text-[13px] text-muted-foreground">
          Drag this button to your bookmarks bar. When you&apos;re in a Claude or ChatGPT chat, click it to attach that chat to a task, or to make a new one.
        </p>
        <a
          ref={bookmarkRef}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            toast("Drag it to your bookmarks bar instead of clicking 🙂");
          }}
          className="self-start rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
        >
          ＋ Save to NEVONAH FLOW
        </a>
        <p className="text-xs text-muted-foreground">
          📱 On Android: once the app is online, open it in Chrome → ⋮ → <em>Add to Home screen</em>. Then in the Claude app tap Share → NEVONAH FLOW.
        </p>
      </section>
    </>
  );
}

function CopyLine({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2.5 py-1.5 text-xs text-foreground">{value}</code>
        <button type="button" onClick={() => onCopy(value)} className="rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground">
          Copy
        </button>
      </div>
    </div>
  );
}
