/**
 * Daily challenge generation — shared by the public GET route and the
 * cron endpoint so both produce identical challenges.
 */

import type { BatsmanArchetype, DailyChallenge } from "@/types/game";
import { mulberry32 } from "@/engine/rng";
import { seedBotsForChallenge } from "@/lib/botLeaderboard";
import { supabase } from "@/lib/supabase";

const ARCHETYPES: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];

const BATSMAN_NAMES: Record<BatsmanArchetype, string[]> = {
  aggressive: ["Hardik Pandya", "Andre Russell", "Glenn Maxwell", "Liam Livingstone"],
  anchor: ["MS Dhoni", "Kane Williamson", "Joe Root", "Virat Kohli"],
  slogger: ["Kieron Pollard", "Nicholas Pooran", "Tim David", "Heinrich Klaasen"],
  accumulator: ["AB de Villiers", "Jos Buttler", "Faf du Plessis", "David Miller"],
};

const SCENARIOS = [
  { title: "Last-Over Heist", description: "The batsman is set and swinging hard." },
  { title: "Backs Against the Wall", description: "Your team needs you to hold your nerve." },
  { title: "Crunch Time", description: "One over separates glory from defeat." },
  { title: "The Decider", description: "The crowd is roaring. Defend this." },
  { title: "Final Frontier", description: "Six balls. Your reputation on the line." },
  { title: "Under Pressure", description: "They need runs, you need wickets." },
];

export function generateChallenge(date: string): Omit<DailyChallenge, "id"> {
  // Derive a seed from the date so the same date always produces the same challenge
  const dateSeed = date.split("-").reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);
  const rng = mulberry32(dateSeed);

  const batsmanArchetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const nonStrikerArchetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];

  const batsmanNames = BATSMAN_NAMES[batsmanArchetype];
  const nonStrikerNames = BATSMAN_NAMES[nonStrikerArchetype];

  const scenario = SCENARIOS[Math.floor(rng() * SCENARIOS.length)];

  // Target between 8 and 20 runs to defend
  const target = 8 + Math.floor(rng() * 13);
  // Wickets remaining: 1-10 (seeded so every player gets the same challenge)
  const wicketsRemaining = 1 + Math.floor(rng() * 10);
  // Confidence between 50-80
  const confidence = 50 + Math.floor(rng() * 31);
  // RNG seed for the game engine — capped to PostgreSQL integer max (2^31 - 1)
  const rngSeed = Math.floor(rng() * 0x7fffffff);

  return {
    date,
    target_runs: target,
    total_balls: 6,
    wickets_remaining: wicketsRemaining,
    batsman_archetype: batsmanArchetype,
    batsman_name: batsmanNames[Math.floor(rng() * batsmanNames.length)],
    non_striker_archetype: nonStrikerArchetype,
    non_striker_name: nonStrikerNames[Math.floor(rng() * nonStrikerNames.length)],
    batsman_confidence: confidence,
    scenario_title: scenario.title,
    scenario_description: scenario.description,
    rng_seed: rngSeed,
  };
}

/**
 * Fetches today's challenge, creating (and bot-seeding) it if missing.
 * The bot seeding doubles as a self-heal if a previous seed run failed.
 */
export async function getOrCreateChallenge(date: string): Promise<DailyChallenge> {
  // Try to fetch today's challenge
  const { data: existing, error: fetchError } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("date", date)
    .single();

  if (existing) {
    // Self-heal an unseeded board (early-returns once seeded)
    await seedBotsForChallenge(existing);
    return existing as DailyChallenge;
  }

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = "no rows found" — anything else is a real error
    throw new Error(fetchError.message);
  }

  // Generate and insert today's challenge
  const challenge = generateChallenge(date);

  const { data: inserted, error: insertError } = await supabase
    .from("daily_challenges")
    .insert(challenge)
    .select()
    .single();

  if (insertError) {
    // Race condition: another request might have inserted it
    if (insertError.code === "23505") {
      const { data: retry, error: retryError } = await supabase
        .from("daily_challenges")
        .select("*")
        .eq("date", date)
        .single();
      if (retry) {
        await seedBotsForChallenge(retry);
        return retry as DailyChallenge;
      }
      throw new Error(retryError?.message ?? "challenge insert race lost");
    }
    throw new Error(insertError.message);
  }

  await seedBotsForChallenge(inserted as DailyChallenge);
  return inserted as DailyChallenge;
}
