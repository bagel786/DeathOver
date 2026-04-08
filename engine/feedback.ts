import type {
  DeliveryLength,
  DeliveryVariation,
  DeliveryLine,
  BallResult,
  ChaosEvent,
  BatsmanProfile,
  AIExpectation,
  Fielder,
} from "@/types/game";
import { angleToDirectionLabel, cartesianToPolar } from "@/engine/fieldMapping";

interface FeedbackParams {
  deliveryLength: DeliveryLength;
  deliveryVariation: DeliveryVariation;
  deliveryLine: DeliveryLine;
  aiExpectation: AIExpectation;
  wasLengthBluff: boolean;
  wasVariationBluff: boolean;
  result: BallResult;
  runsScored: number;
  isWicket: boolean;
  coverage: number; // 0-1
  shotAngle: number;
  chaosEvent: ChaosEvent;
  batsman: BatsmanProfile;
  fielders: Fielder[];
}

const LENGTH_NAMES: Record<DeliveryLength, string> = {
  yorker:     "yorker",
  full:       "full delivery",
  good_length: "good-length delivery",
  short:      "short-pitched ball",
  bouncer:    "bouncer",
};

const VARIATION_NAMES: Record<DeliveryVariation, string> = {
  pace:       "",           // empty — no qualifier needed for standard pace
  slower_ball: "slower ball",
  off_cutter:  "off cutter",
  leg_cutter:  "leg cutter",
  outswing:    "outswinger",
  inswing:     "inswinger",
};

const LINE_NAMES: Record<DeliveryLine, string> = {
  wide_outside_off: "wide outside off stump",
  off:              "off stump",
  middle:           "middle stump",
  leg:              "leg stump",
  wide_outside_leg: "down leg",
};

const CHAOS_MESSAGES: Record<NonNullable<ChaosEvent>, string> = {
  dropped_catch:   "But the fielder grassed it! A massive reprieve for the batting side.",
  overthrow:       "The fielder's throw deflects off the stumps — overthrow! An extra run sneaks through.",
  misfield:        "A misfield in the ring lets them steal a run from nothing.",
  stumping_missed: "The batsman was lured out of the crease but the keeper couldn't collect cleanly — a narrow escape!",
  wide:            "Wide! The umpire's arm extends — an extra run is added and you must bowl this ball again.",
  no_ball:         "No-ball! Foot over the crease — a free run is added and the next delivery is a FREE HIT.",
};


/** Combine length + variation into a natural description, e.g. "yorker slower ball" */
function describeDelivery(length: DeliveryLength, variation: DeliveryVariation): string {
  const lenName = LENGTH_NAMES[length];
  const varName = VARIATION_NAMES[variation];
  return varName ? `${lenName} ${varName}` : lenName;
}

/** Returns true when two lengths are both short-pitched — too similar to call a meaningful bluff */
function areSimilarLengths(a: DeliveryLength, b: DeliveryLength): boolean {
  const shortPitched: DeliveryLength[] = ["bouncer", "short"];
  return shortPitched.includes(a) && shortPitched.includes(b);
}

/** Shot verb appropriate to the delivery — used in run descriptions */
function shotVerb(length: DeliveryLength, line: DeliveryLine): string {
  const isLeg = line === "leg" || line === "wide_outside_leg";
  const isOff = line === "off" || line === "wide_outside_off";
  if (length === "yorker")                          return "squeezed";
  if (length === "bouncer" || length === "short") {
    if (isLeg)  return "glanced";
    if (isOff)  return "cut";
    return "slapped";
  }
  if (length === "full")  return isLeg ? "flicked" : "driven";
  return "nudged"; // good_length
}

export function generateFeedbackMessage(params: FeedbackParams): string {
  const {
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
  } = params;

  // Wide / no-ball: skip the tactical bluff/expectation narrative entirely
  if (chaosEvent === "wide") {
    const lName = LINE_NAMES[deliveryLine];
    return deliveryLength === "yorker"
      ? `Wide! The yorker on ${lName} strayed too far — umpire's arm goes out. Extra run, bowl again.`
      : deliveryLength === "bouncer"
      ? `Wide! The bouncer on ${lName} was adjudged wide — too far from the batsman's body. Extra run, bowl again.`
      : `Wide called on ${lName}! The ball drifted outside the tramline. Extra run, bowl again.`;
  }
  if (chaosEvent === "no_ball") {
    const dName = describeDelivery(deliveryLength, deliveryVariation);
    const lName = LINE_NAMES[deliveryLine];
    return `No-ball! The ${dName} on ${lName} — foot over the crease. Free run added. Next delivery is a FREE HIT — the batsman cannot be dismissed!`;
  }

  const parts: string[] = [];
  const dName       = describeDelivery(deliveryLength, deliveryVariation);
  const lName       = LINE_NAMES[deliveryLine];
  const expName     = describeDelivery(aiExpectation.length, aiExpectation.variation);
  const direction   = angleToDirectionLabel(shotAngle);

  // --- Expectation / Bluff line ---
  const bothBluff = wasLengthBluff && wasVariationBluff;
  const neitherBluff = !wasLengthBluff && !wasVariationBluff;

  if (bothBluff) {
    if (areSimilarLengths(aiExpectation.length, deliveryLength)) {
      // Both deliveries are short-pitched — the length shift is subtle, variation is the real surprise
      parts.push(
        `The batsman braced for a ${expName} — similar length but the ${VARIATION_NAMES[deliveryVariation] || "pace change"} on ${lName} was the real trick.`
      );
    } else {
      parts.push(
        `Double bluff! The batsman expected a ${expName} but you bowled a ${dName} on ${lName}.`
      );
    }
  } else if (wasLengthBluff) {
    parts.push(
      `Length surprise! The batsman expected a ${LENGTH_NAMES[aiExpectation.length]} but you bowled a ${dName} on ${lName}.`
    );
  } else if (wasVariationBluff) {
    parts.push(
      `The batsman read the length but not the variation — a ${dName} on ${lName}.`
    );
  } else {
    parts.push(
      `The batsman had you read — set for a ${expName} on ${lName}.`
    );
  }

  // --- Helper: find nearest fielder to a specific angle ---
  function getNearestFielder(targetAngle: number): string {
    let closest = "fielder";
    let minDiff = Infinity;

    for (const f of params.fielders) {
      const fPolar = cartesianToPolar(f.position.x, f.position.y);
      const angleDiff = Math.min(
        Math.abs(fPolar.angle - targetAngle),
        360 - Math.abs(fPolar.angle - targetAngle)
      );
      if (angleDiff < minDiff) {
        minDiff = angleDiff;
        closest = f.label || "fielder";
      }
    }
    return closest;
  }

  // --- Outcome line ---
  if (isWicket) {
    const wideOff  = deliveryLine === "wide_outside_off";
    const offStump = deliveryLine === "off";
    const middle   = deliveryLine === "middle";
    const legStump = deliveryLine === "leg";
    const wideLeg  = deliveryLine === "wide_outside_leg";

    let wicketDesc: string;

    if (deliveryLength === "yorker") {
      if (wideOff) {
        // Can't bowl on wide outside off — ball misses stumps; batsman jams it to fielder
        const closestFielder = getNearestFielder(270); // point area (off side, square)
        wicketDesc = `Jammed onto the outside edge trying to dig it out — caught at ${closestFielder}!`;
      } else if (offStump) {
        wicketDesc = "Yorker on off stump — too full and too straight to dig out. Bowled!";
      } else if (middle) {
        wicketDesc = "Pinned to the crease — the yorker uprooted middle stump. Clean bowled!";
      } else if (legStump) {
        wicketDesc = "Toe-crushing yorker on leg stump — batsman missed, bowled behind the legs!";
      } else {
        // wide_outside_leg — usually a wide; if wicket, unlikely bowled
        wicketDesc = "The yorker angling in caught the inside edge — deflects onto the stumps!";
      }
    } else if (deliveryLength === "bouncer") {
      if (wideOff || offStump) {
        const closestFielder = getNearestFielder(212); // gully is ~212°
        wicketDesc = `The bouncer climbed sharply outside off — fended straight to ${closestFielder}. Caught!`;
      } else if (wideLeg) {
        wicketDesc = "Tried to duck under the bouncer — gloved it through to the keeper. Caught!";
      } else {
        wicketDesc = "The bouncer got the top edge — straight up, caught in the deep!";
      }
    } else if (deliveryLength === "full") {
      if (wideOff) {
        wicketDesc = "Reached for the drive on the up — thick outside edge carries to the keeper. Caught behind!";
      } else if (offStump) {
        const closestFielder = getNearestFielder(195); // slip area (behind the batsman, off side)
        wicketDesc = `Tried to drive through cover — edged to ${closestFielder}. Caught!`;
      } else if (middle) {
        const closestFielder = getNearestFielder(345); // mid-off area
        wicketDesc = `Full and straight — drove uppishly, straight to ${closestFielder}. Caught!`;
      } else {
        // leg or wide_outside_leg
        const closestFielder = getNearestFielder(55); // mid-wicket area
        wicketDesc = `Miscued the flick to leg — caught at ${closestFielder}!`;
      }
    } else if (deliveryLength === "good_length") {
      if (wideOff) {
        const closestFielder = getNearestFielder(212); // gully area
        wicketDesc = `Good length outside off, nipped back — outside edge flies to ${closestFielder}. Caught!`;
      } else if (offStump) {
        wicketDesc = "Good length on off stump — edged through to the keeper. Caught behind!";
      } else if (middle) {
        wicketDesc = "Kept low through the gate — bowled middle stump!";
      } else {
        // leg or wide_outside_leg — LBW territory, not caught-behind
        wicketDesc = "Nipped back sharply — rapped on the front pad in front of middle. LBW!";
      }
    } else {
      // short ball
      if (wideOff) {
        const closestFielder = getNearestFielder(212); // gully area
        wicketDesc = `The short ball climbed outside off — outside edge flies to ${closestFielder}. Caught!`;
      } else if (wideLeg) {
        wicketDesc = "Tried to duck — gloved it through to the keeper. Caught!";
      } else {
        const closestFielder = getNearestFielder(90); // square leg area
        wicketDesc = `Mistimed the pull shot — straight to ${closestFielder}. Caught in the deep!`;
      }
    }

    parts.push(wicketDesc);
  } else if (runsScored >= 6) {
    parts.push(
      coverage < 0.3
        ? `A massive heave ${direction} — no fielder anywhere near that zone.`
        : coverage < 0.6
        ? `The batsman got underneath it and cleared the rope over the deep fielder!`
        : `Pure power — cleared the boundary despite a well-set field.`
    );
  } else if (runsScored >= 4) {
    const verb = shotVerb(deliveryLength, deliveryLine);
    if (coverage < 0.3) {
      parts.push(
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${direction} — a glaring gap and the batsman found it perfectly. Four runs.`
      );
    } else {
      parts.push(
        `The fielder was there but couldn't get down quickly enough. Four runs.`
      );
    }
  } else if (runsScored >= 2) {
    parts.push(
      coverage > 0.5
        ? `Good fielding restricted it to ${runsScored} — well set but couldn't prevent the run.`
        : `The ball bisected the fielders — ${runsScored} runs.`
    );
  } else if (runsScored === 1) {
    const verb = shotVerb(deliveryLength, deliveryLine);
    parts.push(
      coverage > 0.7
        ? `Excellent fielding — the batsman could only scramble a single.`
        : `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${direction} for a single.`
    );
  } else {
    // Dot ball
    if (coverage > 0.75) {
      parts.push(`Perfect field placement — fielder right on the shot line. Dot ball.`);
    } else if (neitherBluff) {
      parts.push(`The batsman read it perfectly but couldn't find the gap. Dot ball.`);
    } else if (wasVariationBluff) {
      parts.push(`The variation deceived the batsman — they couldn't connect cleanly. Dot ball.`);
    } else {
      parts.push(`Good execution of the ${dName}. Kept to a dot.`);
    }
  }

  // --- Chaos event line ---
  if (chaosEvent) {
    parts.push(CHAOS_MESSAGES[chaosEvent]);
  }

  // --- Tactical hint (only on boundaries / big hits where there was a gap) ---
  if (runsScored >= 4 && !chaosEvent && coverage < 0.35) {
    const direction2 = angleToDirectionLabel(shotAngle);
    parts.push(
      `Tip: Consider placing a fielder ${direction2} — that gap cost you dearly.`
    );
  }

  return parts.join(" ");
}
