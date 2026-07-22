import type {
  DeliveryLength,
  DeliveryVariation,
  DeliveryLine,
  ChaosEvent,
  AIExpectation,
  Fielder,
} from "@/types/game";
import { angleToDirectionLabel, cartesianToPolar } from "@/engine/fieldMapping";
import { classifyDismissal } from "@/engine/dismissal";
import type { BowlerType } from "@/engine/bowlers";

interface FeedbackParams {
  deliveryLength: DeliveryLength;
  deliveryVariation: DeliveryVariation;
  deliveryLine: DeliveryLine;
  aiExpectation: AIExpectation;
  wasLengthBluff: boolean;
  wasVariationBluff: boolean;
  runsScored: number;
  isWicket: boolean;
  coverage: number; // 0-1
  shotAngle: number;
  chaosEvent: ChaosEvent;
  fielders: Fielder[];
  /** How the ball made contact — drives shot description in the feedback narrative */
  contactType: string;
  /** Pace or spin — decides what the lengths and shots are called */
  bowlerType: BowlerType;
}

/**
 * The five length slots are shared by pace and spin, but they're called
 * different things and describing a spinner's long hop as a "bouncer" reads as
 * a bug to anyone who watches cricket.
 */
const LENGTH_NAMES: Record<BowlerType, Record<DeliveryLength, string>> = {
  pace: {
    yorker:      "yorker",
    full:        "full delivery",
    good_length: "good-length delivery",
    short:       "short-pitched ball",
    bouncer:     "bouncer",
  },
  spin: {
    yorker:      "tossed-up delivery",
    full:        "full delivery",
    good_length: "good-length delivery",
    short:       "delivery dropped short",
    bouncer:     "long hop",
  },
};

const VARIATION_NAMES: Record<DeliveryVariation, string> = {
  pace:       "",           // empty — no qualifier needed for standard pace
  slower_ball: "slower ball",
  off_cutter:  "off cutter",
  leg_cutter:  "leg cutter",
  outswing:    "outswinger",
  inswing:     "inswinger",

  off_break:   "off break",
  leg_break:   "leg break",
  googly:      "googly",
  arm_ball:    "arm ball",
  top_spinner: "top spinner",
  slider:      "slider",
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
function describeDelivery(length: DeliveryLength, variation: DeliveryVariation, bowlerType: BowlerType): string {
  const lenName = LENGTH_NAMES[bowlerType][length];
  const varName = VARIATION_NAMES[variation];
  return varName ? `${lenName} ${varName}` : lenName;
}

/** Returns true when two lengths are both short-pitched — too similar to call a meaningful bluff */
function areSimilarLengths(a: DeliveryLength, b: DeliveryLength): boolean {
  const shortPitched: DeliveryLength[] = ["bouncer", "short"];
  return shortPitched.includes(a) && shortPitched.includes(b);
}

/** Shot verb derived from delivery type and direction — fallback for clean contact */
function shotVerbFromDelivery(length: DeliveryLength, line: DeliveryLine, bowlerType: BowlerType, angle?: number): string {
  const isLeg = line === "leg" || line === "wide_outside_leg";
  const isOff = line === "off" || line === "wide_outside_off";

  // Spin has its own shot vocabulary: you sweep a spinner, you don't hook one,
  // and the off-side shot off a short ball is a cut, never an upper cut.
  if (bowlerType === "spin" && angle !== undefined) {
    const isShortish = length === "bouncer" || length === "short" || length === "yorker";
    if (isShortish) {
      const isSweepZone = angle >= 22.5 && angle < 157.5;
      if (isSweepZone) return length === "bouncer" ? "slog swept" : "swept";
      const isOffSideZone = angle >= 202.5 && angle < 315;
      if (isOffSideZone) return "cut";
    }
  }

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

/** How the ball was struck on a wicket caught in the field — flavour only, no fielder named */
function caughtShotDescription(length: DeliveryLength, line: DeliveryLine, bowlerType: BowlerType): string {
  const offSide = line === "wide_outside_off" || line === "off";
  if (bowlerType === "spin") {
    switch (length) {
      case "yorker":  return "Lured down the pitch by the flight — got under it and skied it";
      case "bouncer": return offSide
        ? "A long hop outside off — carved it straight up in the air"
        : "A long hop begging to be hit — dragged the slog sweep off the top edge";
      case "short":   return offSide
        ? "Dropped short outside off — cut it in the air"
        : "Rocked back to pull the short one and got it high on the bat";
      case "good_length": return "Good length turning away — thick outside edge off the drive";
      default: // full
        return line === "off"    ? "Went for the drive against the turn — leading edge"
          : line === "middle"    ? "Drove it uppishly against the spin"
          : "Swept it straight up off the top edge";
    }
  }
  switch (length) {
    case "yorker":  return "Jammed onto the outside edge trying to dig it out";
    case "bouncer": return offSide
      ? "The bouncer climbed sharply outside off — fended it off the glove"
      : "The bouncer got the top edge — straight up in the air";
    case "short":   return offSide
      ? "The short ball climbed outside off — cut it straight up"
      : "Mistimed the pull shot";
    case "good_length": return "Good length outside off, nipped away — thick outside edge";
    default: // full
      return line === "off"    ? "Tried to drive through cover — thick outside edge"
        : line === "middle"    ? "Full and straight — drove it uppishly"
        : "Miscued the flick to leg";
  }
}

/** Shot verb that reflects HOW the ball was actually struck */
function shotVerb(contactType: string, length: DeliveryLength, line: DeliveryLine, bowlerType: BowlerType, angle?: number): string {
  switch (contactType) {
    case "edged_off":   return "edged";
    case "edged_leg":   return "inside edged";
    case "top_edge":    return "top edged";
    case "scoop":       return "scooped";
    case "pull":        return "pulled";
    case "upper_cut":   return "upper cut";
    case "slog_sweep":  return "slog swept";
    case "cut":         return "cut";
    case "lofted_slog": return "heaved";
    default:            return shotVerbFromDelivery(length, line, bowlerType, angle);
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
    bowlerType,
  } = params;

  const lengthName = (l: DeliveryLength) => LENGTH_NAMES[bowlerType][l];

  // Wide / no-ball: skip the tactical bluff/expectation narrative entirely
  if (chaosEvent === "wide") {
    const lName = LINE_NAMES[deliveryLine];
    return deliveryLength === "yorker"
      ? `Wide! The ${lengthName(deliveryLength)} on ${lName} strayed too far — umpire's arm goes out. Extra run, bowl again.`
      : deliveryLength === "bouncer"
      ? `Wide! The ${lengthName(deliveryLength)} on ${lName} was adjudged wide — too far from the batsman's body. Extra run, bowl again.`
      : `Wide called on ${lName}! The ball drifted outside the tramline. Extra run, bowl again.`;
  }
  if (chaosEvent === "no_ball") {
    const dName = describeDelivery(deliveryLength, deliveryVariation, bowlerType);
    const lName = LINE_NAMES[deliveryLine];
    return `No-ball! The ${dName} on ${lName} — foot over the crease. Free run added. Next delivery is a FREE HIT — the batsman cannot be dismissed!`;
  }

  const parts: string[] = [];
  const dName       = describeDelivery(deliveryLength, deliveryVariation, bowlerType);
  const lName       = LINE_NAMES[deliveryLine];
  const expName     = describeDelivery(aiExpectation.length, aiExpectation.variation, bowlerType);
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
      `Length surprise! The batsman expected a ${lengthName(aiExpectation.length)} but you bowled a ${dName} on ${lName}.`
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
    // How the wicket falls comes from the shared table, not a second copy of the
    // rules — so the narrative can't claim a catch the tracer never drew.
    const { kind } = classifyDismissal(deliveryLength, deliveryLine, bowlerType);
    let wicketDesc: string;

    if (chaosEvent === "spectacular_catch") {
      // Boundary catch — the batsman middled it. Any "edged / fended / mistimed"
      // narrative would contradict the chaos line that follows.
      wicketDesc = `Launched ${direction} and it was sailing over the rope — but ${getNearestFielder(shotAngle)} was underneath it.`;
    } else if (kind === "bowled") {
      const isSpin = bowlerType === "spin";
      wicketDesc =
        deliveryLength === "good_length"  ? (isSpin
            ? "Skidded on through the gate — bowled middle stump!"
            : "Kept low through the gate — bowled middle stump!")
        : deliveryLine === "off"          ? (isSpin
            ? "Tossed up on off stump — drawn forward, beaten in the flight. Bowled!"
            : "Yorker on off stump — too full and too straight to dig out. Bowled!")
        : deliveryLine === "middle"       ? (isSpin
            ? "Dragged forward and beaten — the ball spun through the gap and took middle. Clean bowled!"
            : "Pinned to the crease — the yorker uprooted middle stump. Clean bowled!")
        : deliveryLine === "leg"          ? (isSpin
            ? "Pitched on leg and turned past the pad — bowled behind the legs!"
            : "Toe-crushing yorker on leg stump — batsman missed, bowled behind the legs!")
        : (isSpin
            ? "Turned back in off the pitch, caught the inside edge — deflects onto the stumps. Bowled!"
            : "The yorker angling in caught the inside edge — deflects onto the stumps. Bowled!");
    } else if (kind === "stumped") {
      wicketDesc =
        deliveryLine === "wide_outside_leg"
          ? "Went for the sweep, missed it, and the momentum carried them past the line — the keeper whips the bails off. Stumped!"
          : deliveryLine === "wide_outside_off"
          ? "Dragged wide of off stump and chased it — beaten in the flight, and the keeper has the bails off in a flash. Stumped!"
          : "Drawn out of the crease by the flight and beaten — the keeper does the rest. Stumped!";
    } else if (kind === "lbw") {
      wicketDesc = bowlerType === "spin"
        ? "Spun back into the pad — struck plumb in front of middle. LBW!"
        : "Nipped back sharply — rapped on the front pad in front of middle. LBW!";
    } else if (kind === "caught_behind") {
      wicketDesc =
        deliveryLength === "full"         ? "Reached for the drive on the up — thick outside edge carries through. Caught behind!"
        : deliveryLength === "good_length" ? "Good length on off stump — edged through to the keeper. Caught behind!"
        : bowlerType === "spin"            ? "Went back to cut and got a thin edge through to the keeper. Caught behind!"
        : "Tried to duck out of the way — gloved it through to the keeper. Caught behind!";
    } else {
      // Caught in the field — name the fielder the tracer actually points at
      const catcher = getNearestFielderData(shotAngle);
      const where = catcher.isDeep ? "in the deep" : "in the circle";
      wicketDesc = `${caughtShotDescription(deliveryLength, deliveryLine, bowlerType)} — caught ${where} by ${catcher.name}!`;
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
      case "slog_sweep":
        parts.push(`Slog swept into the stands over the leg side — went down on one knee and launched it. Six!`);
        break;
      case "cut":
        parts.push(`Rocked back and carved it over the off side — beat the rope comfortably. Six!`);
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
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, bowlerType, shotAngle);
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
      case "slog_sweep":
        parts.push(`Slog swept ${direction} — got right underneath it and found the rope. Four runs.`);
        break;
      case "cut":
        parts.push(`Carved ${direction} off the back foot — raced away. Four runs.`);
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
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, bowlerType, shotAngle);
    parts.push(
      coverage > 0.5
        ? `Good fielding restricted it to ${runsScored} — well set but couldn't prevent the run.`
        : contactType !== "clean"
        ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${direction} — ${runsScored} runs.`
        : `The ball bisected the fielders — ${runsScored} runs.`
    );
  } else if (runsScored === 1) {
    const verb = shotVerb(contactType, deliveryLength, deliveryLine, bowlerType, shotAngle);
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
    } else if (contactType === "pull" || contactType === "slog_sweep") {
      const shot = contactType === "pull" ? "Pull shot" : "Slog sweep";
      parts.push(`Tip: ${shot} found the gap — a ${isSix ? "deep " : ""}mid-wicket or square leg would threaten that shot next time.`);
    } else if (contactType === "cut") {
      parts.push(`Tip: The cut beat the off side — a ${isSix ? "deep " : ""}point or backward point would have cut that off.`);
    } else if (contactType === "top_edge") {
      parts.push(`Tip: Top edge sailed over the keeper — a fine leg or long stop would have saved those runs.`);
    } else {
      parts.push(zoneTacticalTip(shotAngle, isSix));
    }
  }

  return parts.join(" ");
}
