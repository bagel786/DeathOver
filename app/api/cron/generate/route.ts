/**
 * /api/cron/generate — called daily by the Railway cron service so the
 * challenge + bot leaderboard exist regardless of player traffic.
 *
 * POST with header:  Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrCreateChallenge } from "@/lib/dailyChallenge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // UTC date

  try {
    const challenge = await getOrCreateChallenge(today);
    return NextResponse.json({ ok: true, challenge_id: challenge.id, date: challenge.date });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate daily challenge";
    console.error("[cron/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
