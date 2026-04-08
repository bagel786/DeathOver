import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/leaderboard?challenge_id=xxx
export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get("challenge_id");

  if (!challengeId) {
    return NextResponse.json({ error: "challenge_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("score", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/leaderboard
export async function POST(request: NextRequest) {
  const body = await request.json();

  const required = ["challenge_id", "display_name", "runs_conceded", "wickets_taken", "balls_used", "result", "score", "emoji_summary", "ball_log"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Validate and sanitize fields
  const displayName = String(body.display_name).trim();
  if (displayName.length === 0 || displayName.length > 30) {
    return NextResponse.json({ error: "display_name must be 1–30 characters" }, { status: 400 });
  }

  if (!Number.isInteger(body.runs_conceded) || body.runs_conceded < 0 || body.runs_conceded > 150) {
    return NextResponse.json({ error: "runs_conceded must be an integer 0–150" }, { status: 400 });
  }

  if (!Number.isInteger(body.wickets_taken) || body.wickets_taken < 0 || body.wickets_taken > 10) {
    return NextResponse.json({ error: "wickets_taken must be an integer 0–10" }, { status: 400 });
  }

  if (!Number.isInteger(body.balls_used) || body.balls_used < 1 || body.balls_used > 6) {
    return NextResponse.json({ error: "balls_used must be an integer 1–6" }, { status: 400 });
  }

  if (!["won", "lost", "tied"].includes(body.result)) {
    return NextResponse.json({ error: "result must be 'won', 'lost', or 'tied'" }, { status: 400 });
  }

  if (!Number.isInteger(body.score) || body.score < 0) {
    return NextResponse.json({ error: "score must be a non-negative integer" }, { status: 400 });
  }

  if (typeof body.emoji_summary !== "string" || body.emoji_summary.length > 300) {
    return NextResponse.json({ error: "emoji_summary must be a string under 300 characters" }, { status: 400 });
  }

  if (!Array.isArray(body.ball_log) || body.ball_log.length > 10) {
    return NextResponse.json({ error: "ball_log must be an array with at most 10 items" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .insert({
      challenge_id: body.challenge_id,
      display_name: displayName,
      runs_conceded: body.runs_conceded,
      wickets_taken: body.wickets_taken,
      balls_used: body.balls_used,
      result: body.result,
      score: body.score,
      emoji_summary: body.emoji_summary,
      ball_log: body.ball_log,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
