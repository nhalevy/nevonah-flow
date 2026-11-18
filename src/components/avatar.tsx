import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

export function initials(person: Person): string {
  if (person.type === "me") return "Me";
  if (person.type === "ai") return "AI";
  const parts = person.name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ person, className }: { person: Person | undefined; className?: string }) {
  if (!person) return null;
  const tone =
    person.type === "ai"
      ? "bg-ai-tint text-ai-ink"
      : person.type === "org"
        ? "bg-secondary text-secondary-foreground rounded-lg"
        : "bg-secondary text-secondary-foreground";
  return (
    <span
      title={person.name}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        tone,
        className,
      )}
    >
      {initials(person)}
    </span>
  );
}
