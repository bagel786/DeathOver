/**
 * /api/stats — aggregate play count and unique user tracking
 *
 * Supabase table required:
 *   CREATE TABLE game_sessions (
 *     id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     anonymous_user_id text NOT NULL,
 *     is_daily         boolean NOT NULL DEFAULT false,
 *     result           text NOT NULL,       -- 'won' | 'lost' | 'tied'
 *     created_at       timestamptz DEFAULT now()
 *   );
 *
 * GET  /api/stats                → { total_plays, unique_users }
 * POST /api/stats  { anonymous_user_id, is_daily, result }
 *                                → 201 created
 *
 * Also requires:
 *   CREATE TABLE players (
 *     display_name text PRIMARY KEY   -- lowercased username, persists across daily resets
 *   );
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_PREFIX, reportedTotals } from "@/lib/botGrowth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const now = new Date().toISOString();
  const [sessionsRes, playersRes, aiGamesRes] = await Promise.all([
    supabase.from("game_sessions").select("id", { count: "exact", head: true }).not("anonymous_user_id", "like", `${AI_PREFIX}%`),
    supabase.from("players").select("display_name", { count: "exact", head: true }),
    supabase.from("game_sessions").select("id", { count: "exact", head: true }).like("anonymous_user_id", `${AI_PREFIX}%`).lte("created_at", now),
  ]);

  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  }
  if (playersRes.error) {
    return NextResponse.json({ error: playersRes.error.message }, { status: 500 });
  }

  if (aiGamesRes.error) return NextResponse.json({ error: aiGamesRes.error.message }, { status: 500 });
  const profiles = new Set<string>();
  // REST defaults to 1,000 rows; paginate rather than silently undercounting.
  for (let from = 0; from < (aiGamesRes.count ?? 0); from += 1000) {
    const { data, error } = await supabase.from("game_sessions")
      .select("anonymous_user_id").like("anonymous_user_id", `${AI_PREFIX}%`)
      .lte("created_at", now).order("id").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data ?? []) profiles.add(row.anonymous_user_id);
  }
  return NextResponse.json(reportedTotals(sessionsRes.count ?? 0, playersRes.count ?? 0, aiGamesRes.count ?? 0, profiles.size), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { anonymous_user_id, is_daily, result } = body as Record<string, unknown>;

  if (typeof anonymous_user_id !== "string" || anonymous_user_id.trim().length === 0) {
    return NextResponse.json({ error: "anonymous_user_id is required" }, { status: 400 });
  }
  if (anonymous_user_id.trim().startsWith(AI_PREFIX)) {
    return NextResponse.json({ error: "Reserved profile identifier" }, { status: 400 });
  }
  if (typeof is_daily !== "boolean") {
    return NextResponse.json({ error: "is_daily must be a boolean" }, { status: 400 });
  }
  if (!["won", "lost", "tied"].includes(result as string)) {
    return NextResponse.json({ error: "result must be 'won', 'lost', or 'tied'" }, { status: 400 });
  }

  const { error } = await supabase.from("game_sessions").insert({
    anonymous_user_id: (anonymous_user_id as string).trim(),
    is_daily,
    result,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
