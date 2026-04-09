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
  /** How the ball made contact — drives shot description in the feedback narrative */
  contactType: string;
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
  dropped_catch:     "But the fielder grassed it! A massive reprieve for the batting side.",
  overthrow:         "The fielder's throw deflects off the stumps — overthrow! An extra run sneaks through.",
  misfield:          "A misfield in the ring lets them steal a run from nothing.",
  stumping_missed:   "The batsman was lured out of the crease but the keeper couldn't collect cleanly — a narrow escape!",
  spectacular_catch: "TAKEN ON THE ROPE! The fielder leapt at the boundary and clung on — that was heading for six but it's a stunning dismissal!",
  wide:              "Wide! The umpire's arm extends — an extra run is added and you must bowl this ball again.",
  no_ball:           "No-ball! Foot over the crease — a free run is added and the next delivery is a FREE HIT.",
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

/** Shot verb derived from delivery type and direction — fallback for clean contact */
function shotVerbFromDelivery(length: DeliveryLength, line: DeliveryLine, angle?: number): string {
  const isLeg = line === "leg" || line === "wide_outside_leg";
  const isOff = line === "off" || line === "wide_outside_off";

  if (angle !== undefined) {
    // Ball went to the fine/keeper zone — always a glance regardless of delivery or line
    // (flicks and drives don't reach behind the wicket with clean contact)
    const isVeryFine = angle >= 157.5 && angle < 202.5;
    if (isVeryFine) return isLeg ? "glanced" : "edged";

    // Behind square on leg side (fine leg area): leg-side delivery = glance, not a flick
    const isBehindSquareLeg = angle >= 112.5 && angle < 157.5;
    if (isBehindSquareLeg && isLeg && (length === "full" || length === "good_length")) {
      return "glanced";
    }

    // Bouncer off-stump into the gully / third man zone = upper cut, not a regular cut
    const isGullyZone = angle >= 202.5 && angle < 247.5;
    if (length === "bouncer" && isOff && isGullyZone) return "upper cut";

    // Short/bouncer pull/hook zone (mid-wicket → square leg)
    const isPullZone = angle >= 22.5 && angle < 112.5;
    if ((length === "bouncer" || length === "short") && isPullZone) {
      return length === "bouncer" ? "hooked" : "pulled";
    }

    // Good-length on middle stump — use shot direction to pick a meaningful verb
    // instead of the generic "nudged" which fits neither a boundary nor a flick
    if (length === "good_length" && !isOff && !isLeg) {
      // Off-side or straight trajectory: driven/pushed through the line
      if (angle >= 202.5 || angle < 22.5) return "driven";
      // Leg-side trajectory: worked or tucked away
      return "worked";
    }
  }

  if (length === "yorker") return "squeezed";
  if (length === "bouncer" || length === "short") {
    if (isLeg) return "glanced";
    if (isOff) return "cut";
    return "slapped";
  }
  if (length === "full") return isLeg ? "flicked" : "driven";
  // good_length — distinguish by line (angle unavailable fallback)
  if (isOff) return "driven";
  if (isLeg) return "worked";
  return "nudged"; // middle stump, no angle info
}

/** Zone-aware tactical tip mapping a shot angle to the specific fielder that would plug the gap */
function zoneTacticalTip(angle: number, deep: boolean): string {
  const d = deep ? "deep " : "";
  if (angle < 22.5 || angle >= 337.5)
    return `Tip: Straight boundary was exposed — a ${d}long-on or long-off would plug that gap.`;
  if (angle < 67.5)
    return `Tip: Mid-wicket was the gap — a ${d}mid-wicket or wider mid-on would have cut that off.`;
  if (angle < 112.5)
    return `Tip: Square leg was exposed — a ${d}square leg or backward square leg would have saved that.`;
  if (angle < 157.5)
    return `Tip: Fine leg region was unguarded — a ${d}fine leg or deep backward square leg covers there.`;
  if (angle < 180)
    return `Tip: Fine leg was the gap — a ${d}fine leg would have saved those runs.`;
  if (angle < 202.5)
    return `Tip: Third man was vacant — a ${d}third man or deep gully would cut off balls going there.`;
  if (angle < 247.5)
    return `Tip: Gully / third man region was exposed — a ${d}third man or backward point would have cut that off.`;
  if (angle < 292.5)
    return `Tip: Point was the gap — a ${d}point or backward point would have cut that off.`;
  return `Tip: Cover drive region was open — a ${d}cover or extra cover would have saved that.`;
}

/** Shot verb that reflects HOW the ball was actually struck */
function shotVerb(contactType: string, length: DeliveryLength, line: DeliveryLine, angle?: number): string {
  switch (contactType) {
    case "edged_off":   return "edged";
    case "edged_leg":   return "inside edged";
    case "top_edge":    return "top edged";
    case "scoop":       return "scooped";
    case "pull":        return "pulled";
    case "upper_cut":   return "upper cut";
    case "lofted_slog": return "heaved";
    default:            return shotVerbFromDelivery(length, line, angle);
  }
}

export function generateFeedbackMessage(params: FeedbackParams): string {
  const {
    deliveryLength,
    deliveryVariation,
    deliveryLine,
    aiExpectation,
    wasLengthBluff,
    wasVariationBluff,
    runsScored,
    isWicket,
    coverage,
    shotAngle,
    chaosEvent,
    contactType,
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
    return getNearestFielderData(targetAngle).name;
  }

  function getNearestFielderData(targetAngle: number): { name: string; isDeep: boolean } {
    let name = "fielder";
    let isDeep = false;
    let minDiff = Infinity;

    for (const f of params.fielders) {
      const fPolar = cartesianToPolar(f.position.x, f.position.y);
      const angleDiff = Math.min(
        Math.abs(fPolar.angle - targetAngle),
        360 - Math.abs(fPolar.angle - targetAngle)
      );
      if (angleDiff < minDiff) {
        minDiff = angleDiff;
        name = f.label || "fielder";
        isDeep = fPolar.distance >= 0.55;
      }
    }
    return { name, isDeep };
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
        const topEdgeFielder = getNearestFielderData(90); // square leg / fine leg area for top edge on bouncer
        const topEdgeLocation = topEdgeFielder.isDeep ? "in the deep" : "in the circle";
        wicketDesc = `The bouncer got the top edge — straight up, caught ${topEdgeLocation} by ${topEdgeFielder.name}!`;
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
        const pullFielder = getNearestFielderData(90); // square leg area
        const pullLocation = pullFielder.isDeep ? "Caught in the deep!" : "Caught inside the circle!";
        wicketDesc = `Mistimed the pull shot — straight to ${pullFielder.name}. ${pullLocation}`;
      }
    }

    parts.push(wicketDesc);
  } else if (runsScored >= 6) {
    switch (contactType) {
      case "scoop":
        parts.push(`Scooped over fine leg — brilliant improvisation! Six!`);
        break;
      case "pull":
        parts.push(`Pulled high over the leg-side boundary — right in the slot. Six!`);
        break;
      case "upper_cut":
        parts.push(`Audacious upper cut over third man — cleared the rope with ease. Six!`);
        break;
      case "lofted_slog":
        parts.push(
          coverage < 0.3
            ? `Heaved ${direction} — no fielder anywhere near that zone. Six!`
            : `Pure power — the slog cleared the boundary despite a fielder back. Six!`
        );
        break;
      case "edged_off":
        parts.push(`Outside edge flies over the keeper — a lucky six, but it counts!`);
        break;
      case "edged_leg":
        parts.push(`Inside edge ricochets over fine leg — streaky but six!`);
        break;
      default:
        parts.push(
          coverage < 0.3
            ? `A massive hit ${direction} — no fielder anywhere near that zone. Six!`
            : coverage < 0.6
            ? `The batsman got underneath it and cleared the rope over the deep fielder!`
            : `Pure power — cleared the boundary despite a well-set field.`
        );
    }
  } else if (runsScored >= 4) {
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, shotAngle);
    switch (contactType) {
      case "edged_off":
        if (deliveryLength === "yorker") {
          parts.push(`Dug out onto the outside edge — races away ${direction} to the boundary. A lucky four!`);
        } else if (deliveryLength === "good_length" || deliveryLength === "short") {
          parts.push(`Outside edge flies ${direction} — a fortuitous four to the boundary.`);
        } else {
          parts.push(`Outside edge flies ${direction} — a fortunate four through to the boundary.`);
        }
        break;
      case "edged_leg": {
        let edgeLegDesc: string;
        if (shotAngle < 67.5) {
          edgeLegDesc = `Inside edge deflects through mid-wicket — a fortunate four.`;
        } else if (shotAngle < 112.5) {
          edgeLegDesc = `Inside edge deflects square on the leg side — a streaky four.`;
        } else {
          edgeLegDesc = `Inside edge deflects fine on the leg side — a streaky four.`;
        }
        parts.push(edgeLegDesc);
        break;
      }
      case "upper_cut":
        parts.push(`Audacious upper cut ${direction} — beats the fielder to the boundary. Four runs.`);
        break;
      case "scoop": {
        const scoopTarget = shotAngle < 157.5 ? "over fine leg" : "over the keeper";
        parts.push(`Scooped ${scoopTarget} — improvised perfectly. Four runs.`);
        break;
      }
      case "pull":
        parts.push(`Pulled ${direction} — timed well and it raced away. Four runs.`);
        break;
      default:
        if (coverage < 0.3) {
          parts.push(
            `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${direction} — a glaring gap and the batsman found it perfectly. Four runs.`
          );
        } else {
          parts.push(`The fielder was there but couldn't get down quickly enough. Four runs.`);
        }
    }
  } else if (runsScored >= 2) {
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, shotAngle);
    parts.push(
      coverage > 0.5
        ? `Good fielding restricted it to ${runsScored} — well set but couldn't prevent the run.`
        : contactType !== "clean"
        ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${direction} — ${runsScored} runs.`
        : `The ball bisected the fielders — ${runsScored} runs.`
    );
  } else if (runsScored === 1) {
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, shotAngle);
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
    const isSix = runsScored >= 6;
    if (contactType === "edged_off") {
      parts.push(`Tip: Outside edge flew through the off side — a slip cordon or third man would have been the answer.`);
    } else if (contactType === "edged_leg") {
      if (shotAngle < 67.5) {
        parts.push(`Tip: That inside edge deflected through mid-wicket — a mid-wicket or square leg would have been the answer.`);
      } else if (shotAngle < 112.5) {
        parts.push(`Tip: That inside edge went square on the leg side — a square leg or backward square leg would have been dangerous there.`);
      } else {
        parts.push(`Tip: That inside edge went fine — a fine leg or leg slip would have been dangerous there.`);
      }
    } else if (contactType === "upper_cut") {
      parts.push(`Tip: The batsman upper cut over backward point — a third man or deep backward point would have saved that.`);
    } else if (contactType === "scoop") {
      parts.push(`Tip: The batsman scooped over fine leg — a deeper fine leg could cut that off.`);
    } else if (contactType === "pull") {
      parts.push(`Tip: Pull shot found the gap — a ${isSix ? "deep " : ""}mid-wicket or square leg would threaten that shot next time.`);
    } else if (contactType === "top_edge") {
      parts.push(`Tip: Top edge sailed over the keeper — a fine leg or long stop would have saved those runs.`);
    } else {
      parts.push(zoneTacticalTip(shotAngle, isSix));
    }
  }

  return parts.join(" ");
}
