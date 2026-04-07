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

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .insert({
      challenge_id: body.challenge_id,
      display_name: body.display_name,
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
