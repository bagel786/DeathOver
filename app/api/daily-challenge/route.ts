import { NextResponse } from "next/server";
import { getOrCreateChallenge } from "@/lib/dailyChallenge";

// Never cache — the correct challenge depends on the current UTC date
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0]; // UTC date — consistent for all players

  try {
    const challenge = await getOrCreateChallenge(today);
    return NextResponse.json(challenge);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load daily challenge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
