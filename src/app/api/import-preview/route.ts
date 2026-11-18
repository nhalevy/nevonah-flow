import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// One-time workbook import: serves the locally converted file (import/workbook-tasks.json, never committed).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const raw = await readFile(path.join(process.cwd(), "import", "workbook-tasks.json"), "utf8");
    return new NextResponse(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
  } catch {
    return NextResponse.json({ error: "No import file on this computer." }, { status: 404 });
  }
}
