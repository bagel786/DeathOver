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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const [sessionsRes, playersRes] = await Promise.all([
    supabase.from("game_sessions").select("id", { count: "exact", head: true }),
    supabase.from("players").select("display_name", { count: "exact", head: true }),
  ]);

  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  }
  if (playersRes.error) {
    return NextResponse.json({ error: playersRes.error.message }, { status: 500 });
  }

  const total_plays = sessionsRes.count ?? 0;
  const unique_users = playersRes.count ?? 0;

  return NextResponse.json({ total_plays, unique_users });
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
