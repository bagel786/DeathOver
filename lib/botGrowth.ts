import { createHash } from "node:crypto";
import { mulberry32 } from "@/engine/rng";
import { generateBotArrivalTimes } from "@/lib/botCadence";

export const AI_PREFIX = "deathover-ai-v1-";
export const REPORTING_ADJUSTMENT = { games: 5500, profiles: 1800 };
export const GROWTH_START = "2026-11-01";
const DAY = 86_400_000;
const START = Date.parse(`${GROWTH_START}T00:00:00Z`);
const DECEMBER = Date.parse("2026-12-01T00:00:00Z");
export const CAP_END = Date.parse("2027-04-01T00:00:00Z");

// Added synthetic activity, not a claim about human traffic. Nov 1 baseline:
// 34,804 - 5,500 games; 12,027 - 1,800 profiles. Real activity remains additive.
export function growthBudget(instant: number) {
  const november = Math.max(0, Math.min(30, (instant - START) / DAY));
  const later = Math.max(0, (instant - DECEMBER) / DAY);
  return {
    games: Math.floor(2196 * november / 30 + 3400 * later / 121),
    profiles: Math.floor(273 * november / 30 + 1100 * later / 121),
  };
}

export function stableId(value: string) {
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const FIRST = ["arjun", "aanya", "rohan", "ishaan", "diya", "kabir", "meera", "advait", "vihaan", "kavya", "neel", "tara", "dev", "anika", "samar", "ritika", "yash", "naina", "pranav", "sana", "rahul", "riya", "aman", "sneha"];
const PLACE = ["mumbai", "delhi", "chennai", "pune", "jaipur", "kolkata", "kochi", "surat", "indore", "blr", "lucknow", "hyderabad"];
const CRICKET = ["coverdrive", "gully", "yorker", "sillypoint", "longon", "legspin", "midwicket", "sixer", "crease", "sweep", "slip", "googly"];

/** Clearly fictional gamer handles; the stable suffix guarantees uniqueness. */
export function botHandle(profile: number) {
  const rng = mulberry32(profile + 0xdecade);
  const pick = (pool: string[]) => pool[Math.floor(rng() * pool.length)];
  const name = rng() < 0.7 ? `${pick(FIRST)}_${pick(CRICKET)}` : `${pick(PLACE)}_${pick(CRICKET)}`;
  return `${name.slice(0, 21)}${profile.toString(36)} [AI]`;
}

export function dailyBotActivity(date: string) {
  const start = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) throw new Error("Invalid bot date");
  const before = growthBudget(start);
  const after = growthBudget(start + DAY);
  const count = after.games - before.games;
  const addedProfiles = after.profiles - before.profiles;
  const rng = mulberry32(start / DAY);
  const seed = Math.floor(rng() * 0xffffffff);
  const arrivals = generateBotArrivalTimes(date, count, seed).sort();
  return arrivals.map((created_at, index) => {
    // New profiles are introduced first; every subsequent game can be a return.
    const profile = index < addedProfiles ? before.profiles + index : Math.floor(rng() * after.profiles);
    return {
      id: stableId(`game:${date}:${index}`),
      anonymous_user_id: `${AI_PREFIX}${profile}`,
      display_name: botHandle(profile),
      created_at,
    };
  });
}

export function reportedTotals(recordedGames: number, recordedProfiles: number, simulatedGames: number, simulatedProfiles: number, now = Date.now()) {
  const baseGames = Math.max(0, recordedGames - REPORTING_ADJUSTMENT.games);
  const baseProfiles = Math.max(0, recordedProfiles - REPORTING_ADJUSTMENT.profiles);
  // Throttle only synthetic contributions. Never conceal additional recorded games.
  const allowance = now < CAP_END ? Math.max(0, 34999 - baseGames) : Infinity;
  return {
    total_plays: baseGames + Math.min(simulatedGames, allowance),
    unique_users: baseProfiles + simulatedProfiles,
    simulated_plays: Math.min(simulatedGames, allowance),
    simulated_profiles: simulatedProfiles,
    reporting_adjustment: REPORTING_ADJUSTMENT,
  };
}
