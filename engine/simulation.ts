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
import { getZoneCoverage, cartesianToPolar } from "@/engine/fieldMapping";
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
  /** How many of the last 4 legal deliveries were yorkers — batsman "sets" to repeated yorkers */
  recentYorkerCount: number;
  /** True when the previous ball was a no-ball — batsman cannot be dismissed this delivery */
  isFreeHit: boolean;
}

// ==============================================================
// LENGTH — base contact probability (how easy is it to hit?)
// ==============================================================
const BASE_CONTACT_LENGTH: Record<DeliveryLength, number> = {
  yorker:     0.42, // hard to time, but death batsmen practice scoops/flicks
  full:       0.70, // slot ball in death overs — hittable but not automatic contact
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
    recentYorkerCount,
    isFreeHit,
  } = input;

  // Create a deterministic RNG for this ball
  const seed = baseSeed !== null ? baseSeed : Math.floor(Math.random() * 0xffffffff);
  const rng = createGameRng(seed, rngCallCount);

  // ==============================================================
  // PRE-CHECK A: Wide (bowling error — happens before batsman plays)
  // Probability depends on chosen line and length. Risky lines (leg-side, extreme off)
  // and yorker/bouncer attempts increase the chance of a wide being called.
  // ==============================================================
  const WIDE_LINE_PROB: Record<DeliveryLine, number> = {
    wide_outside_off: 0.05,  // deliberately extreme line — umpire watches closely
    off:              0.015,
    middle:           0.008, // very unlikely on middle stump
    leg:              0.025,
    wide_outside_leg: 0.09,  // high — any height/deviation down leg = wide
  };
  const wideLengthMod =
    deliveryLength === "yorker"  ? 1.5 : // precise execution required
    deliveryLength === "bouncer" ? 1.3 : // height + line both scrutinised
    1.0;
  const wideProb = WIDE_LINE_PROB[deliveryLine] * wideLengthMod;
  const wideRoll = rng();

  if (wideRoll < wideProb) {
    const lineNames: Record<DeliveryLine, string> = {
      wide_outside_off: "wide outside off",
      off:              "off stump line",
      middle:           "middle stump",
      leg:              "leg stump",
      wide_outside_leg: "down leg",
    };

    // Bye runs off a wide: ball beats keeper → batsmen can run.
    // Only byes allowed (no bat involved), not additional wides.
    // ~15% chance of 1 bye, ~5% chance of 2 byes.
    const byeRoll = rng();
    const byeRuns = byeRoll < 0.05 ? 2 : byeRoll < 0.20 ? 1 : 0;
    const totalWideRuns = 1 + byeRuns;

    const wideFeedback = deliveryLength === "yorker"
      ? `Wide! The yorker attempt on ${lineNames[deliveryLine]} went too far — umpire signals immediately.${byeRuns > 0 ? ` Ball beats the keeper — ${byeRuns} bye${byeRuns > 1 ? "s" : ""} taken. ${totalWideRuns} runs, bowl again.` : " Extra run, bowl again."}`
      : deliveryLength === "bouncer"
      ? `Wide! The bouncer on ${lineNames[deliveryLine]} was called wide — too far down leg or climbing past the batsman.${byeRuns > 0 ? ` Ball goes past the keeper — ${byeRuns} bye${byeRuns > 1 ? "s" : ""} added. ${totalWideRuns} runs, bowl again.` : " Extra run, bowl again."}`
      : byeRuns > 0
      ? `Wide called on ${lineNames[deliveryLine]}! Ball beats the keeper — ${byeRuns} bye${byeRuns > 1 ? "s" : ""} taken. ${totalWideRuns} runs total, bowl again.`
      : `Wide called on ${lineNames[deliveryLine]}! An extra run is added and you must bowl this ball again.`;

    return {
      ballNumber,
      delivery:        { length: deliveryLength, variation: deliveryVariation, line: deliveryLine },
      fieldSnapshot:   fielders,
      aiExpectation:   { length: deliveryLength, variation: deliveryVariation },
      wasLengthBluff:  false,
      wasVariationBluff: false,
      result:          byeRuns >= 2 ? "two" : byeRuns === 1 ? "single" : "dot",
      runsScored:      totalWideRuns,
      isWicket:        false,
      isCaught:        false,
      chaosEvent:      "wide",
      shotDirection:   { angle: 180, distance: 0.30 }, // drifts behind keeper
      feedbackMessage: wideFeedback,
      isExtraDelivery: true,
      triggersFreeHit: false,
    };
  }

  // ==============================================================
  // PRE-CHECK B: No-ball (foot fault — delivery still bowled)
  // Batsman cannot be dismissed this ball (except run out, which we don't model).
  // +1 run automatically added; next ball is a free hit.
  // ==============================================================
  const isNoBall = rng() < 0.015; // ~1.5% per delivery

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
  // STEP 5b: Yorker adaptation — batsman "gets set" to repeated yorkers
  // First yorker is hardest; each recent repeat is slightly easier to read.
  // Effect is subtle — a yorker is always difficult, just less of a surprise.
  // Max +0.08 so even a fully-set batsman still faces a hard delivery.
  // ==============================================================
  if (deliveryLength === "yorker" && recentYorkerCount > 0) {
    contactProb += Math.min(recentYorkerCount * 0.04, 0.08);
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

  // ==============================================================
  // STEP 8b: Free hit — batsman knows they can't get out, swings harder
  // Higher contact probability (more committed) and boosted desperation
  // threshold so they attempt big shots more freely.
  // ==============================================================
  if (isFreeHit) {
    contactProb += 0.10;
  }

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
  // Desperation swing only when pressure builds — low base ensures it's not triggered randomly.
  // On a free hit the batsman has zero fear of dismissal, so the threshold jumps significantly.
  const desperationThreshold = 0.10 + pressure * batsman.riskTolerance * batsman.aggression * 0.60
    + (isFreeHit ? 0.18 : 0);
  const isDesperationSwing = desperationRoll < desperationThreshold;

  // ==============================================================
  // STEP 12: Primary outcome roll
  // ==============================================================
  const roll = rng();

  let result: BallResult = "dot";
  let runsScored = 0;
  let isWicket = false;
  // How the ball was struck — used by feedback to describe the shot accurately
  // "clean" | "edged_off" | "edged_leg" | "top_edge" | "scoop" | "pull" | "upper_cut" | "lofted_slog"
  let contactType = "clean";

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
      // Desperation swing on poor contact: high dismissal risk — this is a gamble, not a guarantee
      // 45% wicket | 15% six | 40% four — swinging hard when out of position usually ends badly
      if (missRoll < 0.45) {
        result = "wicket"; runsScored = 0; isWicket = true;
      } else if (missRoll < 0.60) {
        result = "six"; runsScored = 6;
        // Angle must be realistic for the delivery length:
        // Yorker → scoop over fine leg (128°-165°) or ramp over keeper (165°-210°); no slog sweeps
        // Bouncer/short → pull/hook leg side (70°-135°) or upper-cut off side (200°-240°)
        // Full/good length → lofted leg-side slog (20°-80°) or straight (340°-20°)
        if (deliveryLength === "yorker") {
          shotAngle = 128 + rng() * 82; // scoop / ramp: fine leg through keeper area
          contactType = "scoop";
        } else if (deliveryLength === "bouncer" || deliveryLength === "short") {
          if (rng() < 0.75) {
            shotAngle = 70 + rng() * 65;   // pull/hook: mid-wicket through fine leg
            contactType = "pull";
          } else {
            shotAngle = 200 + rng() * 40;  // upper-cut: third man / gully
            contactType = "upper_cut";
          }
        } else {
          shotAngle = rng() < 0.5 ? (340 + rng() * 40) % 360 : 20 + rng() * 60; // straight or leg-side slog
          contactType = "lofted_slog";
        }
        shotDistance = 1.0;
      } else {
        result = "four"; runsScored = 4;
        if (deliveryLength === "yorker") {
          shotAngle = 128 + rng() * 82; // scoop / ramp to the boundary
          contactType = "scoop";
        } else if (deliveryLength === "bouncer" || deliveryLength === "short") {
          if (rng() < 0.75) {
            shotAngle = 70 + rng() * 65;
            contactType = "pull";
          } else {
            shotAngle = 200 + rng() * 40;
            contactType = "upper_cut";
          }
        } else {
          shotAngle = rng() < 0.5 ? (340 + rng() * 40) % 360 : 20 + rng() * 60;
          contactType = "lofted_slog";
        }
        shotDistance = 0.90 + rng() * 0.08;
      }
    } else if (missRoll < wicketChance) {
      // Bowled / caught
      result = "wicket";
      runsScored = 0;
      isWicket = true;
    } else if (missRoll < wicketChance + 0.10) {
      // Outside / top edge — deflects to the boundary (less common than pure fortune would suggest)
      result = "four";
      runsScored = 4;
      if (isOffSideDelivery) {
        shotAngle = 205 + rng() * 25;  // gully / third man (205°-230°) — stays behind square on the off side
        contactType = "edged_off";
      } else {
        shotAngle = 120 + rng() * 30;  // fine leg region (120°-150°)
        contactType = "edged_leg";
      }
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
      // GAP — no fielder in this zone. Gaps produce runs, mostly fours.
      // A six requires clearing the rope AND the ball being in the air — gaps alone don't guarantee maximums.
      const gapRoll = rng();
      const aggBonus = batsman.aggression * 0.18;
      const sixProb  = 0.22 + aggBonus;           // 22–40% six in a gap (needs real aggression)
      const fourProb = sixProb + 0.38;             // next 38% = four (most gaps = boundary run)
      // boundaryProb 60–78% — leaving gaps in death is still costly, but not automatic maximums

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
  // STEP 12a: Free hit / no-ball — batsman CANNOT be dismissed (run out aside)
  // If this ball is a free hit (previous ball was no-ball) or IS a no-ball,
  // cancel any wicket and treat it as a dot (ball reached fielder, not out).
  // ==============================================================
  if ((isFreeHit || isNoBall) && isWicket) {
    isWicket = false;
    result = "dot";
    runsScored = 0;
    // isCaught defaults to false (declared below) and won't be set since isWicket is now false
  }

  // ==============================================================
  // STEP 12b: Adjust shot direction to match the outcome visually
  // The initial shotAngle/shotDistance from chooseShotDirection() was computed
  // before the outcome — now we nudge it so dots go toward fielders,
  // boundaries go into gaps, etc.
  // All searches are constrained to the neighbourhood of the original
  // shot direction so the visual stays consistent with the delivery line.
  // ==============================================================

  // Helper: angular difference (0–180)
  const angDiff = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  const originalAngle = shotAngle; // preserve for neighbourhood search

  // Determine if a wicket is a catch (vs bowled / LBW)
  // Uses the same delivery line + length logic as feedback.ts
  let isCaught = false;
  if (isWicket) {
    const isBowled =
      (deliveryLength === "yorker" && (deliveryLine === "off" || deliveryLine === "middle" || deliveryLine === "leg" || deliveryLine === "wide_outside_leg")) ||
      (deliveryLength === "good_length" && deliveryLine === "middle");
    const isLBW =
      deliveryLength === "good_length" && (deliveryLine === "leg" || deliveryLine === "wide_outside_leg");
    isCaught = !isBowled && !isLBW;
  }

  // For caught wickets, point the shot direction toward the catching fielder
  if (isWicket && isCaught) {
    const fielderPolars = fielders.map((f) => cartesianToPolar(f.position.x, f.position.y));
    // Determine target catching angle based on delivery (matches feedback.ts logic)
    let catchAngle = originalAngle;
    if (deliveryLength === "yorker" && deliveryLine === "wide_outside_off") {
      catchAngle = 270; // point area
    } else if (deliveryLength === "bouncer" && (deliveryLine === "wide_outside_off" || deliveryLine === "off")) {
      catchAngle = 212; // gully
    } else if (deliveryLength === "bouncer" && (deliveryLine === "middle" || deliveryLine === "leg")) {
      catchAngle = 135; // fine leg / deep square
    } else if (deliveryLength === "full" && deliveryLine === "wide_outside_off") {
      catchAngle = 195; // behind wicket, off side (keeper area)
    } else if (deliveryLength === "full" && deliveryLine === "off") {
      catchAngle = 195; // slip area
    } else if (deliveryLength === "full" && deliveryLine === "middle") {
      catchAngle = 345; // mid-off
    } else if (deliveryLength === "full" && (deliveryLine === "leg" || deliveryLine === "wide_outside_leg")) {
      catchAngle = 55; // mid-wicket
    } else if (deliveryLength === "good_length" && deliveryLine === "wide_outside_off") {
      catchAngle = 212; // gully
    } else if (deliveryLength === "short" && (deliveryLine === "wide_outside_off" || deliveryLine === "off")) {
      catchAngle = 212; // gully
    } else if (deliveryLength === "short" && deliveryLine === "wide_outside_leg") {
      catchAngle = 180; // keeper area
    } else if (deliveryLength === "short" && (deliveryLine === "middle" || deliveryLine === "leg")) {
      catchAngle = 90; // square leg
    }

    // Find the nearest fielder to the catch angle
    let bestIdx = -1;
    let bestAngleDiff = 180;
    for (let i = 0; i < fielderPolars.length; i++) {
      const diff = angDiff(fielderPolars[i].angle, catchAngle);
      if (diff < bestAngleDiff) {
        bestAngleDiff = diff;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const nearest = fielderPolars[bestIdx];
      shotAngle = nearest.angle;
      // Ball carries to the fielder (slightly short so it looks like a catch)
      shotDistance = nearest.distance * 0.92;
    }
  }

  if (!isWicket) {
    const fielderPolars = fielders.map((f) => cartesianToPolar(f.position.x, f.position.y));

    if (result === "dot" || result === "single" || result === "two" || result === "three") {
      // Find the nearest fielder within ±90° of the original shot direction
      let bestIdx = -1;
      let bestAngleDiff = 90; // only consider fielders within this window
      for (let i = 0; i < fielderPolars.length; i++) {
        const diff = angDiff(fielderPolars[i].angle, originalAngle);
        if (diff < bestAngleDiff) {
          bestAngleDiff = diff;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        const nearest = fielderPolars[bestIdx];
        shotAngle = nearest.angle;
        if (result === "dot") {
          // Ball stopped by the fielder — land short of them
          shotDistance = nearest.distance * 0.85;
        } else if (result === "single") {
          // Slightly past / beside the fielder
          shotDistance = Math.min(0.70, nearest.distance * 1.05);
          shotAngle = (shotAngle + (rng() < 0.5 ? 8 : -8) + 360) % 360;
        } else {
          // Two/three — further past, wider offset
          shotDistance = Math.min(0.82, nearest.distance * 1.15);
          shotAngle = (shotAngle + (rng() < 0.5 ? 12 : -12) + 360) % 360;
        }
      }
      // If no fielder within ±90°, keep the original angle (rare but possible)

    } else if (result === "four") {
      // Edges have their own physics — the ball deflects to a fixed zone determined by
      // where bat met ball, not by where the gap is. Skip gap-finding for edges so the
      // tracer line and direction label stay in the correct region (gully/third man for
      // edged_off; fine leg for edged_leg) rather than being pulled to wherever the
      // nearest open space happens to be (e.g., point or the covers).
      const isEdge = contactType === "edged_off" || contactType === "edged_leg";
      if (!isEdge) {
        // Find the largest gap near the original shot direction (within ±90°)
        // so the four goes in a realistic direction relative to the delivery line
        const nearbyAngles = fielderPolars
          .map((p) => p.angle)
          .filter((a) => angDiff(a, originalAngle) < 90);

        if (nearbyAngles.length >= 2) {
          // Sort and find gaps within this neighbourhood
          nearbyAngles.sort((a, b) => a - b);
          let bestGapCenter = originalAngle;
          let bestGapSize = 0;
          for (let i = 0; i < nearbyAngles.length; i++) {
            const curr = nearbyAngles[i];
            const next = nearbyAngles[(i + 1) % nearbyAngles.length];
            const gap = ((next - curr + 360) % 360);
            const gapCenter = (curr + gap / 2) % 360;
            // Only use this gap if its center is also near the original direction
            if (gap > bestGapSize && angDiff(gapCenter, originalAngle) < 90) {
              bestGapSize = gap;
              bestGapCenter = gapCenter;
            }
          }
          shotAngle = bestGapCenter;
        }
        // else: fewer than 2 fielders nearby, keep original angle (it's already a gap)
      }
      shotDistance = 0.95 + rng() * 0.05; // reaches the boundary

    } else if (result === "six") {
      shotDistance = 1.0; // clears the boundary
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
  // STEP 13b: Spectacular catch on the rope (~6% of sixes)
  // A ball heading over the boundary is taken by a deep fielder at the rope.
  // Fires independently of the main chaos window — sixes are already rare enough.
  // Does not trigger on free hits or no-balls (batsman protected).
  // ==============================================================
  if (result === "six" && !isFreeHit && !isNoBall && !chaosEvent) {
    const catchRoll = rng();
    if (catchRoll < 0.06) {
      chaosEvent = "spectacular_catch";
      result = "wicket";
      runsScored = 0;
      isWicket = true;
      isCaught = true;
      // Direct the animation toward the nearest deep fielder on the rope
      const deepFielderPolars = fielders
        .map((f) => cartesianToPolar(f.position.x, f.position.y))
        .filter((f) => f.distance > 0.65);
      if (deepFielderPolars.length > 0) {
        const nearest = deepFielderPolars.reduce((best, f) =>
          angDiff(f.angle, shotAngle) < angDiff(best.angle, shotAngle) ? f : best
        );
        shotAngle = nearest.angle;
        shotDistance = nearest.distance * 0.97; // ball reaches the fielder on the rope
      } else {
        shotDistance = 0.95; // no deep fielder placed, ball lands on the rope anyway
      }
    }
  }

  // ==============================================================
  // STEP 13d: No-ball post-processing
  // Foot fault adds 1 penalty run on top of whatever was scored.
  // chaosEvent becomes "no_ball" so feedback/UI shows the correct narrative.
  // ==============================================================
  let isExtraDelivery = false;
  let triggersFreeHit = false;

  if (isNoBall) {
    runsScored += 1;
    // Update result label to reflect new total
    if (runsScored >= 6) result = "six";
    else if (runsScored >= 4) result = "four";
    else if (runsScored === 3) result = "three";
    else if (runsScored === 2) result = "two";
    else if (runsScored === 1) result = "single";
    chaosEvent = "no_ball";
    isExtraDelivery = true;
    triggersFreeHit = true;
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
    contactType,
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
    isCaught,
    chaosEvent,
    shotDirection: { angle: shotAngle, distance: shotDistance },
    feedbackMessage,
    isExtraDelivery,
    triggersFreeHit,
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
    if (ball.chaosEvent === "wide") return "📣";
    if (ball.chaosEvent === "no_ball") return "🚫";
    if (ball.chaosEvent === "spectacular_catch") return "🤩";
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
