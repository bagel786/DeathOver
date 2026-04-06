/**
 * The Simulation Engine — calculateDeliveryOutcome()
 *
 * Pure function: same inputs + same RNG seed → same output.
 * No side effects; all state mutations happen in the Zustand store.
 */

import type {
  DeliveryLength,
  DeliveryVariation,
  DeliveryLine,
  Fielder,
  BatsmanProfile,
  BallResult,
  ChaosEvent,
  BallOutcome,
  AIExpectation,
} from "@/types/game";
import { getZoneCoverage } from "@/engine/fieldMapping";
import { getAIExpectation, chooseShotDirection } from "@/engine/batsmanAI";
import { generateFeedbackMessage } from "@/engine/feedback";
import { createGameRng } from "@/engine/rng";

export interface DeliveryInput {
  ballNumber: number;
  deliveryLength: DeliveryLength;
  deliveryVariation: DeliveryVariation;
  deliveryLine: DeliveryLine;
  fielders: Fielder[];
  batsman: BatsmanProfile;
  batsmanConfidence: number;
  matchSituation: {
    runsNeeded: number;
    ballsRemaining: number;
    wicketsInHand: number;
  };
  /** Base seed for daily challenges (deterministic). Null → truly random. */
  baseSeed: number | null;
  /** Global RNG call count so each ball gets a fresh sub-sequence */
  rngCallCount: number;
  /** Last variation bowled (for AI pattern reading) */
  lastVariation: DeliveryVariation | null;
}

// ==============================================================
// LENGTH — base contact probability (how easy is it to hit?)
// ==============================================================
const BASE_CONTACT_LENGTH: Record<DeliveryLength, number> = {
  yorker:     0.42, // hard to time, but death batsmen practice scoops/flicks
  full:       0.75, // slot ball in death overs — batsmen feast on full
  good_length: 0.65, // hittable with intent, not a safe option in death
  short:      0.70, // pull/cut — death batsmen attack short balls hard
  bouncer:    0.55, // risky pull, but experienced death batsmen take it on
};

// ==============================================================
// VARIATION — modifier to contact probability
// Positive = easier to hit (batsman expects it or it's slower)
// Negative = harder to hit (unexpected movement)
// ==============================================================
const VARIATION_CONTACT_MOD: Record<DeliveryVariation, number> = {
  pace:        +0.10, // stock ball — batsman ready for it, very hittable
  slower_ball: -0.18, // pace drop — effective but batsmen in death expect it
  off_cutter:  -0.12, // seam movement, but batsmen power through it
  leg_cutter:  -0.12, // away movement, but less effective at death
  outswing:    -0.08, // late swing, but batsmen plant front foot anyway
  inswing:     -0.06, // swings in, batsmen use the pace
};

// ==============================================================
// VARIATION — which vulnerability stat applies
// ==============================================================
const VARIATION_VULNERABILITY: Partial<Record<
  DeliveryVariation,
  keyof Pick<BatsmanProfile, "yorkerVulnerability" | "bounceVulnerability" | "spinVulnerability">
>> = {
  slower_ball: "spinVulnerability",
  off_cutter:  "spinVulnerability",
  leg_cutter:  "spinVulnerability",
  // pace / outswing / inswing: use average vulnerability (handled below)
};

// ==============================================================
// LENGTH — which vulnerability stat applies (when variation has none)
// ==============================================================
const LENGTH_VULNERABILITY: Partial<Record<
  DeliveryLength,
  keyof Pick<BatsmanProfile, "yorkerVulnerability" | "bounceVulnerability" | "spinVulnerability">
>> = {
  yorker:  "yorkerVulnerability",
  bouncer: "bounceVulnerability",
};

export function calculateDeliveryOutcome(input: DeliveryInput): BallOutcome {
  const {
    ballNumber,
    deliveryLength,
    deliveryVariation,
    deliveryLine,
    fielders,
    batsman,
    batsmanConfidence,
    matchSituation,
    baseSeed,
    rngCallCount,
    lastVariation,
  } = input;

  // Create a deterministic RNG for this ball
  const seed = baseSeed !== null ? baseSeed : Math.floor(Math.random() * 0xffffffff);
  const rng = createGameRng(seed, rngCallCount);

  // ==============================================================
  // STEP 1: Match pressure (0=calm, 1=desperate)
  // ==============================================================
  const requiredRate =
    matchSituation.runsNeeded / Math.max(matchSituation.ballsRemaining, 1);
  const pressure = Math.min(requiredRate / 12, 1); // 12 RPO = maximum pressure

  // ==============================================================
  // STEP 2: AI expectation (field-read for length + heuristic for variation)
  // ==============================================================
  const aiExpectation: AIExpectation = getAIExpectation(fielders, batsman, pressure, rng, lastVariation);
  const wasLengthBluff    = deliveryLength    !== aiExpectation.length;
  const wasVariationBluff = deliveryVariation !== aiExpectation.variation;

  // ==============================================================
  // STEP 3: Base contact probability (from length)
  // ==============================================================
  let contactProb = BASE_CONTACT_LENGTH[deliveryLength];

  // ==============================================================
  // STEP 4: Variation modifier (movement / pace change)
  // ==============================================================
  contactProb += VARIATION_CONTACT_MOD[deliveryVariation];

  // ==============================================================
  // STEP 5: Bluff modifiers (more nuanced — each dimension counts separately)
  // Length bluff: harder to read from field, bigger effect
  // Variation bluff: partially probabilistic — some batsmen still pick it up
  // ==============================================================
  if (wasLengthBluff) {
    contactProb -= 0.08; // bowled differently than expected, but death batsmen adapt fast
  } else {
    contactProb += 0.12; // AI read the length — batsman ready, free hit territory
  }

  if (wasVariationBluff) {
    // Variation surprise — some penalty, but death batsmen muscle through
    const variationPenalty = 0.05 * (1 - batsman.aggression * 0.5);
    contactProb -= variationPenalty;
  } else {
    contactProb += 0.08; // Batsman picked the variation — sitting on it
  }

  // ==============================================================
  // STEP 6: Archetype vulnerability
  // ==============================================================
  const variationVulnKey = VARIATION_VULNERABILITY[deliveryVariation];
  const lengthVulnKey    = LENGTH_VULNERABILITY[deliveryLength];
  const vulnKey          = variationVulnKey ?? lengthVulnKey;

  const vulnerability = vulnKey
    ? (batsman[vulnKey] as number)
    : (batsman.yorkerVulnerability + batsman.bounceVulnerability + batsman.spinVulnerability) / 3;

  contactProb -= vulnerability * 0.08; // vulnerability matters less in death — batsmen commit fully

  // ==============================================================
  // STEP 7: Aggression / pressure modifier
  // ==============================================================
  if (pressure > 0.6) {
    contactProb += batsman.aggression * 0.14; // death batsmen thrive under pressure — this is what they train for
  }

  // ==============================================================
  // STEP 8: Confidence modifier (-10% to +10%)
  // ==============================================================
  contactProb += (batsmanConfidence - 50) / 500;

  // Clamp to playable range
  contactProb = Math.max(0.05, Math.min(0.90, contactProb));

  // ==============================================================
  // STEP 9: Shot direction
  // ==============================================================
  const shotDir = chooseShotDirection(batsman, deliveryLength, deliveryLine, pressure, rng);
  let { angle: shotAngle, distance: shotDistance } = shotDir;

  // ==============================================================
  // STEP 10: Field coverage at shot destination
  // ==============================================================
  const coverage = getZoneCoverage(fielders, shotAngle, shotDistance);

  // ==============================================================
  // STEP 11: Desperation big-hit attempt (aggressive batsmen under pressure)
  // Even on iffy contact, an aggressive slogger might just swing for the boundary.
  // This can result in a 6, 4, or get them out.
  // ==============================================================
  const desperationRoll = rng();
  // Death batsmen are always looking to swing — threshold raised significantly
  const desperationThreshold = 0.25 + pressure * batsman.riskTolerance * batsman.aggression * 0.60;
  const isDesperationSwing = desperationRoll < desperationThreshold;

  // ==============================================================
  // STEP 12: Primary outcome roll
  // ==============================================================
  const roll = rng();

  let result: BallResult = "dot";
  let runsScored = 0;
  let isWicket = false;

  if (roll > contactProb) {
    // --- Poor contact / miss ---
    const missRoll = rng();
    // Wicket probability: lower in death overs — batsmen are set, know their game
    const wicketChance =
      (1 - contactProb) * 0.22 +
      (pressure > 0.6 ? batsman.riskTolerance * 0.05 : 0);

    const isOffSideDelivery =
      deliveryLine === "wide_outside_off" || deliveryLine === "off";

    if (isDesperationSwing) {
      // Desperation swing on poor contact: death batsmen live for this — more reward than risk
      if (missRoll < 0.28) {
        result = "wicket"; runsScored = 0; isWicket = true;
      } else if (missRoll < 0.58) {
        result = "six"; runsScored = 6;
        shotAngle = (rng() < 0.5 ? 355 + rng() * 30 : 70 + rng() * 60);
        shotDistance = 1.0;
      } else {
        result = "four"; runsScored = 4;
        shotAngle = (rng() < 0.5 ? 355 + rng() * 30 : 70 + rng() * 60);
        shotDistance = 0.90 + rng() * 0.08;
      }
    } else if (missRoll < wicketChance) {
      // Bowled / caught
      result = "wicket";
      runsScored = 0;
      isWicket = true;
    } else if (missRoll < wicketChance + 0.18) {
      // Outside / top edge — deflects to the boundary (common in death overs with hard swings)
      result = "four";
      runsScored = 4;
      shotAngle = isOffSideDelivery
        ? 200 + rng() * 30  // third man region (200°-230°)
        : 120 + rng() * 30; // fine leg region (120°-150°)
      shotDistance = 0.88 + rng() * 0.08;
    } else if (missRoll < wicketChance + 0.55) {
      // Squeezed / dug out for a single or two — batsmen in death always look to rotate
      const squeezeRoll = rng();
      if (squeezeRoll < 0.35) {
        result = "two"; runsScored = 2;
      } else {
        result = "single"; runsScored = 1;
      }
      shotAngle = (rng() < 0.5 ? 5 : 355) + (rng() - 0.5) * 20;
      shotDistance = 0.40 + rng() * 0.15;
    } else {
      result = "dot";
      runsScored = 0;
    }
  } else {
    // --- Good contact made ---
    if (coverage > 0.75) {
      // Fielder RIGHT on the line — field placement is working, reward the bowler
      const fieldRoll = rng();
      if (fieldRoll < coverage * 0.55) {
        result = "dot"; runsScored = 0;
      } else if (fieldRoll < coverage * 0.85) {
        result = "single"; runsScored = 1;
      } else if (fieldRoll < coverage * 0.97) {
        result = "two"; runsScored = 2;
      } else {
        // Cleared the rope despite a fielder directly there — rare
        result = "six"; runsScored = 6;
      }
    } else if (coverage > 0.40) {
      // Fielder has to dive / sprint — death batsmen back themselves to beat the field
      const runRoll = rng();
      const sixChance = batsman.aggression * batsman.riskTolerance * 0.18;
      if (runRoll < sixChance) {
        result = "six"; runsScored = 6;
      } else if (runRoll < sixChance + 0.03) {
        result = "dot"; runsScored = 0;
      } else if (runRoll < sixChance + 0.15) {
        result = "single"; runsScored = 1;
      } else if (runRoll < sixChance + 0.42) {
        result = "two"; runsScored = 2;
      } else {
        result = "four"; runsScored = 4;
      }
    } else {
      // GAP — no fielder in this zone, death batsmen DESTROY gaps
      const gapRoll = rng();
      const aggBonus = batsman.aggression * 0.25;
      const sixProb  = 0.40 + aggBonus;           // 40–65% six in a gap
      const fourProb = sixProb + 0.30;             // next 30% = four
      // boundaryProb ~70–95% — leaving gaps in death is suicide

      if (gapRoll < sixProb) {
        result = "six"; runsScored = 6;
      } else if (gapRoll < fourProb) {
        result = "four"; runsScored = 4;
      } else if (gapRoll < fourProb + 0.06) {
        result = "three"; runsScored = 3;
      } else {
        result = "two"; runsScored = 2;
      }
    }
  }

  // ==============================================================
  // STEP 13: Chaos RNG (~2% per delivery, context-gated)
  // ==============================================================
  let chaosEvent: ChaosEvent = null;
  const chaosRoll = rng();

  if (chaosRoll < 0.02) {
    const chaosType = rng();

    // Determine the nature of the wicket for correct chaos gating:
    // A yorker on middle/off stump is bowled, not caught — no dropped catch.
    // A desperation-swing wicket is usually a top-edge catch or clean bowled — borderline.
    const isYorkerBowled =
      isWicket && deliveryLength === "yorker" &&
      (deliveryLine === "middle" || deliveryLine === "off");
    // Caught-behind / edge scenario: variation ball hit edge, or full/good-length off-side delivery
    const isCatchableWicket =
      isWicket &&
      !isYorkerBowled &&
      (deliveryLine === "off" || deliveryLine === "wide_outside_off" || deliveryLine === "middle");
    // Stumping only makes sense on slower variations (batsman overbalances stepping out)
    const isStumpingCandidate =
      !isWicket &&
      runsScored === 0 && // ball wasn't properly hit
      (deliveryVariation === "slower_ball" ||
        deliveryVariation === "off_cutter" ||
        deliveryVariation === "leg_cutter");
    // Overthrow / misfield only when ball actually reached the field (not a wicket)
    const ballInField = !isWicket;

    if (isCatchableWicket && chaosType < 0.45) {
      // Dropped catch — reverses the wicket
      chaosEvent = "dropped_catch";
      isWicket = false;
      result = "dot";
      runsScored = 0;
    } else if (isStumpingCandidate && chaosType < 0.20) {
      // Stumping chance — batsman was drawn forward and nearly out of crease
      chaosEvent = "stumping_missed";
      // No numerical change — keeper tried but missed, ball stays as dot
    } else if (ballInField && runsScored > 0 && chaosType < 0.65) {
      // Overthrow — fielder's throw deflects for an extra
      chaosEvent = "overthrow";
      const extra = 1 + Math.floor(rng() * 2);
      runsScored += extra;
      if (runsScored >= 6) result = "six";
      else if (runsScored >= 4) result = "four";
      else if (runsScored === 3) result = "three";
      else if (runsScored === 2) result = "two";
      else result = "single";
    } else if (ballInField && chaosType < 0.85) {
      // Misfield — a dot becomes 1-2 runs, or an existing hit goes further
      chaosEvent = "misfield";
      if (runsScored === 0) {
        runsScored = 1 + Math.floor(rng() * 2);
        result = runsScored === 1 ? "single" : "two";
      }
    }
    // else: no chaos fires — a valid chaos roll that didn't meet any condition
  }


  // ==============================================================
  // STEP 14: Feedback message
  // ==============================================================
  const feedbackMessage = generateFeedbackMessage({
    deliveryLength,
    deliveryVariation,
    deliveryLine,
    aiExpectation,
    wasLengthBluff,
    wasVariationBluff,
    result,
    runsScored,
    isWicket,
    coverage,
    shotAngle,
    chaosEvent,
    batsman,
    fielders,
  });

  return {
    ballNumber,
    delivery: { length: deliveryLength, variation: deliveryVariation, line: deliveryLine },
    fieldSnapshot: fielders,
    aiExpectation,
    wasLengthBluff,
    wasVariationBluff,
    result,
    runsScored,
    isWicket,
    chaosEvent,
    shotDirection: { angle: shotAngle, distance: shotDistance },
    feedbackMessage,
  };
}

// ============================================================
// Leaderboard Score Calculator
// ============================================================

export function calculateScore(
  target: number,
  runsConceded: number,
  wicketsTaken: number,
  ballsUsed: number,
  totalBalls: number,
  result: "won" | "lost" | "tied"
): number {
  let score = 0;

  if (result === "won") score += 1000;
  if (result === "tied") score += 500;

  const runsSaved = target - runsConceded;
  score += runsSaved * 50;
  score += wicketsTaken * 150;

  if (result === "won") {
    const ballsRemaining = totalBalls - ballsUsed;
    score += ballsRemaining * 75;
  }

  return Math.max(0, score);
}

// ============================================================
// Shareable Emoji Summary
// ============================================================

export function generateEmojiSummary(
  ballLog: BallOutcome[],
  result: "won" | "lost" | "tied",
  date: string
): string {
  const dateStr = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const emojis = ballLog.map((ball) => {
    if (ball.isWicket) return "🎯";
    if (ball.chaosEvent === "dropped_catch") return "⚡";
    if (ball.chaosEvent === "overthrow") return "🌀";
    if (ball.chaosEvent === "misfield") return "😬";
    if (ball.runsScored === 0) return "🟢";
    if (ball.runsScored <= 2) return "🟡";
    if (ball.runsScored === 4) return "🔴";
    if (ball.runsScored >= 6) return "💥";
    return "🟡";
  });

  const resultStr = result === "won" ? "DEFENDED ✅" : result === "tied" ? "TIED 🤝" : "CHASED DOWN ❌";
  const header = `🏏 Death Over Challenge — ${dateStr}`;
  const grid = emojis.join(" ");

  return `${header}\n${grid}\n${resultStr}\n\n#DeathOverChallenge`;
}
