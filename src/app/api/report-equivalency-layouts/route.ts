import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LayoutItem = {
  key: string;
  x: number;
  y: number;
  scale: number;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const items = (body?.items ?? []) as LayoutItem[];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No layout items provided." }, { status: 400 });
  }

  const payload = items
    .filter((item) => typeof item.key === "string" && item.key.trim())
    .map((item) => ({
      key: item.key.trim(),
      x: Number.isFinite(item.x) ? item.x : null,
      y: Number.isFinite(item.y) ? item.y : null,
      scale: Number.isFinite(item.scale) ? item.scale : null,
    }));

  if (!payload.length) {
    return NextResponse.json({ error: "No valid layout items." }, { status: 400 });
  }

  const { error } = await supabase
    .from("report_equivalency_layouts")
    .upsert(payload, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}