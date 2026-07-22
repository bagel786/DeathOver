import type { DeliveryLength, DeliveryVariation } from "@/types/game";

// ============================================================
// Bowler Profiles
//
// The player picks who bowls the over. A bowler is pure data — no per-bowler
// code paths — so adding one is a table entry, not a branch.
//
// Two things vary:
//   1. Which variations they can bowl (pace and spin draw from disjoint halves
//      of the DeliveryVariation union). The STOCK BALL IS LISTED FIRST — the
//      batsman AI treats variations[0] as its default assumption.
//   2. How the five length slots behave in their hands, via lengthContactMod,
//      an additive tweak to BASE_CONTACT_LENGTH in simulation.ts.
//
// The five length slots are a fullest-to-shortest ladder and are shared by both
// types; only their names change. A spinner's "long hop" is the same slot as a
// quick's "bouncer" — the shortest ball available, and the worst one to miss.
// ============================================================

export type BowlerType = "pace" | "spin";

export interface BowlerProfile {
  id: string;
  name: string;
  type: BowlerType;
  /** One line for the picker */
  blurb: string;
  /** Variations this bowler can bowl. Stock ball first. */
  variations: DeliveryVariation[];
  /** Tooltip per variation, shown in the delivery selector */
  variationHints: Partial<Record<DeliveryVariation, string>>;
  lengthLabels: Record<DeliveryLength, string>;
  lengthHints: Record<DeliveryLength, string>;
  /** Additive tweak to BASE_CONTACT_LENGTH. Positive = easier to hit. */
  lengthContactMod: Partial<Record<DeliveryLength, number>>;
}

const PACE_VARIATIONS: DeliveryVariation[] = [
  "pace", "slower_ball", "off_cutter", "leg_cutter", "outswing", "inswing",
];

const PACE_VARIATION_HINTS: Partial<Record<DeliveryVariation, string>> = {
  pace:        "Standard — no variation",
  slower_ball: "Big pace drop, hard to time",
  off_cutter:  "Cuts back into the batsman off the pitch",
  leg_cutter:  "Cuts away off the pitch",
  outswing:    "Swings away in the air",
  inswing:     "Swings in through the air",
};

const PACE_LENGTH_LABELS: Record<DeliveryLength, string> = {
  yorker:      "Yorker",
  full:        "Full",
  good_length: "Good Length",
  short:       "Short",
  bouncer:     "Bouncer",
};

const PACE_LENGTH_HINTS: Record<DeliveryLength, string> = {
  yorker:      "Full, aimed at the feet",
  full:        "Driveable, full length",
  good_length: "Stock delivery",
  short:       "Back of a length, forces the pull",
  bouncer:     "Very short, chin music",
};

export const BOWLERS: BowlerProfile[] = [
  {
    id: "express",
    name: "Express Quick",
    type: "pace",
    blurb: "Raw speed. Nothing subtle — the short ball is a genuine weapon, but pitch it up and it disappears.",
    variations: PACE_VARIATIONS,
    variationHints: PACE_VARIATION_HINTS,
    lengthLabels: PACE_LENGTH_LABELS,
    lengthHints: PACE_LENGTH_HINTS,
    lengthContactMod: {
      short:   -0.08, // extra pace makes the pull a genuine risk
      bouncer: -0.10,
      full:    +0.06, // no margin for error when you pitch it up at that speed
      yorker:  +0.03, // hard to land consistently at full tilt
    },
  },
  {
    id: "death_specialist",
    name: "Death Specialist",
    type: "pace",
    blurb: "Built for the last over. The yorker is the best in the game — but the short ball is his tell.",
    variations: PACE_VARIATIONS,
    variationHints: PACE_VARIATION_HINTS,
    lengthLabels: PACE_LENGTH_LABELS,
    lengthHints: PACE_LENGTH_HINTS,
    lengthContactMod: {
      yorker:  -0.10, // the reason you picked him
      full:    -0.03,
      short:   +0.08, // lacks the pace to make it hurt
      bouncer: +0.06,
    },
  },
  {
    id: "mystery_spinner",
    name: "Mystery Spinner",
    type: "spin",
    blurb: "Flight and deception over pace. The googly wins overs — but drop it short and it's a free hit.",
    variations: ["off_break", "leg_break", "googly", "arm_ball", "top_spinner", "slider"],
    variationHints: {
      off_break:   "Stock ball — turns into the batsman",
      leg_break:   "Turns away off the pitch",
      googly:      "The wrong'un — turns the other way, well disguised",
      arm_ball:    "No turn, holds its line with the arm",
      top_spinner: "Overspin — dips late, jumps off the pitch",
      slider:      "Skids on flat and quick",
    },
    lengthLabels: {
      yorker:      "Tossed Up",
      full:        "Full",
      good_length: "Good Length",
      short:       "Short of Length",
      bouncer:     "Long Hop",
    },
    lengthHints: {
      yorker:      "Flighted right up, draws them forward",
      full:        "Full, inviting the drive",
      good_length: "Stock delivery",
      short:       "Dropped shorter, sits up",
      bouncer:     "Too short — the ball every batsman waits for",
    },
    lengthContactMod: {
      // Flight is a gamble, not free money: tossing it up concedes MORE runs
      // than the stock ball on average, and takes roughly twice the wickets.
      // Unlike a yorker there's no wide risk to price it, so the cost is
      // boundaries — give the batsman enough contact to punish it.
      yorker:  -0.02,
      full:    -0.02,
      short:   +0.10,
      bouncer: +0.18, // a long hop in the death over is a gift
    },
  },
];

const DEFAULT_BOWLER_ID = "death_specialist";

/** Resolve a bowler by id, falling back safely for missing or legacy values. */
export function getBowler(id: string | null | undefined): BowlerProfile {
  return (
    BOWLERS.find((b) => b.id === id) ??
    BOWLERS.find((b) => b.id === DEFAULT_BOWLER_ID)!
  );
}
