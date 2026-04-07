import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BatsmanArchetype } from "@/types/game";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function generateChallenge(date: string) {
  // Derive a seed from the date so the same date always produces the same challenge
  const dateSeed = date.split("-").reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);
  const rng = seededRandom(dateSeed);

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
  // RNG seed for the game engine
  const rngSeed = Math.floor(rng() * 0xffffffff);

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

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Try to fetch today's challenge
  const { data: existing, error: fetchError } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("date", today)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = "no rows found" — anything else is a real error
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Generate and insert today's challenge
  const challenge = generateChallenge(today);

  const { data: inserted, error: insertError } = await supabase
    .from("daily_challenges")
    .insert(challenge)
    .select()
    .single();

  if (insertError) {
    // Race condition: another request might have inserted it
    if (insertError.code === "23505") {
      const { data: retry } = await supabase
        .from("daily_challenges")
        .select("*")
        .eq("date", today)
        .single();
      if (retry) return NextResponse.json(retry);
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted);
}
