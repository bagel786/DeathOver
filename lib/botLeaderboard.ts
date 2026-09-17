/**
 * Rotating bot leaderboard — seeds each daily challenge with 250-500
 * synthetic entries so the board always looks like a real crowd.
 *
 * Determinism: everything derives from mulberry32 seeded with the challenge
 * id, so re-running for the same challenge produces the exact same rows
 * (combined with the (challenge_id, display_name) unique index this makes
 * seeding idempotent and race-safe).
 */

import type { DailyChallenge, BallOutcome, BallResult, ChaosEvent, DeliveryLength, DeliveryVariation, DeliveryLine, AIExpectation, BattingHand } from "@/types/game";
import { mulberry32 } from "@/engine/rng";
import { calculateScore } from "@/lib/scoring";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

const MIN_BOTS = 250;
const MAX_BOTS = 500;
const INSERT_CHUNK = 200;
const PLAYER_PAGE_SIZE = 1000;

const LENGTHS: DeliveryLength[] = ["yorker", "full", "good_length", "short", "bouncer"];
const VARIATIONS: DeliveryVariation[] = ["pace", "slower_ball", "off_cutter", "leg_cutter", "outswing", "inswing"];
const LINES: DeliveryLine[] = ["wide_outside_off", "off", "middle", "leg", "wide_outside_leg"];

interface BotEntry {
  challenge_id: string;
  display_name: string;
  runs_conceded: number;
  wickets_taken: number;
  balls_used: number;
  result: "won" | "lost" | "tied";
  score: number;
  emoji_summary: string;
  ball_log: BallOutcome[];
}

/** Fetch every username from the players pool (paginated — REST caps at 1000/request). */
async function fetchPlayerNames(): Promise<string[]> {
  const names: string[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("players")
      .select("display_name")
      .range(page * PLAYER_PAGE_SIZE, (page + 1) * PLAYER_PAGE_SIZE - 1);
    if (error) throw new Error(`players fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    names.push(...data.map((r) => (r as { display_name: string }).display_name));
    if (data.length < PLAYER_PAGE_SIZE) break;
  }
  return names;
}

function makeBotBallLog(rng: () => number, balls: number, wickets: number, runs: number): BallOutcome[] {
  // A wicket needs a ball — clamp so the scatter loop below always terminates
  const wicketsToScatter = Math.min(wickets, balls);
  const wicketBalls = new Set<number>();
  while (wicketBalls.size < wicketsToScatter) wicketBalls.add(1 + Math.floor(rng() * balls));

  const log: BallOutcome[] = [];
  let runsLeft = runs;
  for (let b = 1; b <= balls; b++) {
    const isWicket = wicketBalls.has(b);
    let runsScored = 0;
    if (!isWicket && runsLeft > 0) {
      const options: Array<{ result: BallResult; runs: number; weight: number }> = [
        { result: "dot", runs: 0, weight: runsLeft > 3 ? 1 : 2 },
        { result: "single", runs: 1, weight: 5 },
        { result: "two", runs: 2, weight: 3 },
        { result: "four", runs: 4, weight: runsLeft >= 4 ? 3 : 0 },
        { result: "six", runs: 6, weight: runsLeft >= 6 ? 1 : 0 },
      ];
      const total = options.reduce((s, o) => s + o.weight, 0);
      let pick = rng() * total;
      let chosen = options[0];
      for (const o of options) {
        pick -= o.weight;
        if (pick <= 0) { chosen = o; break; }
      }
      runsScored = Math.min(chosen.runs, runsLeft);
      runsLeft -= runsScored;
    }
    const length = LENGTHS[Math.floor(rng() * LENGTHS.length)];
    const variation = VARIATIONS[Math.floor(rng() * VARIATIONS.length)];
    const line = LINES[Math.floor(rng() * LINES.length)];
    const angle = rng() * 360;
    const ball: BallOutcome = {
      ballNumber: b,
      delivery: { length, variation, line },
      fieldSnapshot: [],
      aiExpectation: { length, variation } as AIExpectation,
      wasLengthBluff: false,
      wasVariationBluff: false,
      result: isWicket ? "wicket" : runsScored === 0 ? "dot" : runsScored === 4 ? "four" : runsScored === 6 ? "six" : runsScored === 2 ? "two" : runsScored === 3 ? "three" : "single",
      runsScored,
      isWicket,
      isCaught: isWicket && rng() < 0.7,
      chaosEvent: null as ChaosEvent,
      shotDirection: { angle, distance: 20 + rng() * 80 },
      feedbackMessage: "",
      isExtraDelivery: false,
      triggersFreeHit: false,
      battingHand: "right" as BattingHand,
    };
    log.push(ball);
  }
  return log;
}

function generateBotEntries(rng: () => number, challenge: DailyChallenge, names: string[]): BotEntry[] {
  const target = challenge.target_runs;
  const wicketsRemaining = challenge.wickets_remaining;

  // Fisher-Yates over a copy — take the first N as today's unique player set
  const pool = [...names];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = MIN_BOTS + Math.floor(rng() * (MAX_BOTS - MIN_BOTS + 1));
  const picked = pool.slice(0, Math.min(count, pool.length));

  return picked.map((display_name) => {
    const roll = rng();
    const result: "won" | "lost" | "tied" = roll < 0.3 ? "won" : roll < 0.35 ? "tied" : "lost";

    let runs_conceded: number;
    let wickets_taken: number;
    let balls_used: number;

    if (result === "won") {
      const allOut = wicketsRemaining <= 6 && rng() < 0.25;
      if (allOut) {
        wickets_taken = wicketsRemaining;
        balls_used = wicketsRemaining + Math.floor(rng() * (7 - wicketsRemaining));
      } else {
        wickets_taken = Math.floor(rng() * Math.min(wicketsRemaining, 4));
        balls_used = 6;
      }
      runs_conceded = Math.floor(rng() * target); // defended: 0..target-1
    } else if (result === "tied") {
      runs_conceded = target;
      wickets_taken = Math.floor(rng() * Math.min(wicketsRemaining, 4));
      balls_used = 6;
    } else {
      runs_conceded = target + Math.floor(rng() * 10); // chase got there
      balls_used = 1 + Math.floor(rng() * 6);
      // Wickets taken must be < remaining (else they'd be bowled out = won)
      // and can never exceed the balls actually bowled.
      wickets_taken = Math.floor(rng() * (Math.min(balls_used, wicketsRemaining - 1) + 1));
    }

    const score = calculateScore(target, runs_conceded, wickets_taken, balls_used, challenge.total_balls ?? 6, result);

    return {
      challenge_id: challenge.id,
      display_name,
      runs_conceded,
      wickets_taken,
      balls_used,
      result,
      score,
      emoji_summary: `🏏 Death Over Challenge — ${challenge.date}\n${result === "won" ? "DEFENDED ✅" : result === "tied" ? "TIED 🤝" : "CHASED DOWN ❌"}\n\n#DeathOverChallenge`,
      ball_log: makeBotBallLog(rng, balls_used, wickets_taken, runs_conceded),
    };
  });
}

/**
 * Seeds bots for a challenge if the board has fewer than MIN_BOTS entries.
 * Deterministic generation + a dedupe pass makes this idempotent without a
 * DB unique constraint (the live table has none): re-runs skip existing
 * names and any racing double-seed gets cleaned up.
 */
export async function seedBotsForChallenge(challenge: DailyChallenge): Promise<void> {
  const { count } = await supabase
    .from("leaderboard_entries")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);

  if ((count ?? 0) >= MIN_BOTS) return;

  const names = await fetchPlayerNames();
  if (names.length === 0) {
    console.error("[botLeaderboard] players table is empty — nothing to seed");
    return;
  }

  const rng = mulberry32(hashSeed(challenge.id));
  const entries = generateBotEntries(rng, challenge, names);

  // Skip names already on the board (real players may have submitted first)
  const { data: existingNames } = await supabase
    .from("leaderboard_entries")
    .select("display_name")
    .eq("challenge_id", challenge.id);
  const taken = new Set((existingNames ?? []).map((r) => (r as { display_name: string }).display_name));
  const fresh = entries.filter((e) => !taken.has(e.display_name));

  for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
    const chunk = fresh.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("leaderboard_entries").insert(chunk);
    if (error) console.error(`[botLeaderboard] chunk insert failed: ${error.message}`);
  }

  await dedupeChallenge(challenge.id);
}

/**
 * Removes duplicate rows per (challenge_id, display_name) — protects against
 * concurrent seeding since the table has no unique index on that pair.
 */
async function dedupeChallenge(challengeId: string): Promise<void> {
  const { data } = await supabase
    .from("leaderboard_entries")
    .select("id, display_name")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  if (!data) return;
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const row of data as Array<{ id: string; display_name: string }>) {
    if (seen.has(row.display_name)) toDelete.push(row.id);
    else seen.add(row.display_name);
  }
  for (let i = 0; i < toDelete.length; i += INSERT_CHUNK) {
    const { error } = await supabase
      .from("leaderboard_entries")
      .delete()
      .in("id", toDelete.slice(i, i + INSERT_CHUNK));
    if (error) console.error(`[botLeaderboard] dedupe delete failed: ${error.message}`);
  }
}

/** FNV-1a — turns a uuid into a 32-bit seed for mulberry32. */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
