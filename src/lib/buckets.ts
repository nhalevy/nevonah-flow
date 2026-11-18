import type { BucketSlug } from "./types";

// Full class strings so Tailwind can see them.
export const BUCKET_STYLE: Record<
  BucketSlug,
  { dot: string; border: string; tint: string; ink: string; ring: string; solid: string }
> = {
  personal: {
    dot: "bg-personal",
    border: "border-personal",
    tint: "bg-personal-tint",
    ink: "text-personal-ink",
    ring: "focus-visible:ring-personal",
    solid: "bg-personal text-white dark:text-background",
  },
  nevonah: {
    dot: "bg-nevonah",
    border: "border-nevonah",
    tint: "bg-nevonah-tint",
    ink: "text-nevonah-ink",
    ring: "focus-visible:ring-nevonah",
    solid: "bg-nevonah text-white dark:text-background",
  },
  tmr: {
    dot: "bg-tmr",
    border: "border-tmr",
    tint: "bg-tmr-tint",
    ink: "text-tmr-ink",
    ring: "focus-visible:ring-tmr",
    solid: "bg-tmr text-white dark:text-background",
  },
};

export function detectProvider(url: string): { provider: string; label: string } {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { provider: "other", label: "Link" };
  }
  if (host.endsWith("claude.ai")) return { provider: "claude", label: "Claude" };
  if (host.endsWith("chatgpt.com") || host.endsWith("chat.openai.com")) return { provider: "chatgpt", label: "ChatGPT" };
  if (host.endsWith("gemini.google.com")) return { provider: "gemini", label: "Gemini" };
  if (host.endsWith("perplexity.ai")) return { provider: "perplexity", label: "Perplexity" };
  if (host === "docs.google.com") return { provider: "gdocs", label: "Google Docs" };
  if (host === "drive.google.com") return { provider: "gdrive", label: "Google Drive" };
  if (host.endsWith("todoist.com")) return { provider: "todoist", label: "Todoist" };
  if (host.includes("force.com") || host.includes("salesforce.com")) return { provider: "salesforce", label: "Salesforce" };
  return { provider: "other", label: host };
}
