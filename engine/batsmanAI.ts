import type {
  BatsmanArchetype,
  BatsmanProfile,
  DeliveryLength,
  DeliveryVariation,
  AIExpectation,
  FieldZone,
  Fielder,
} from "@/types/game";

// ============================================================
// Batsman Archetype Profiles
// ============================================================

export const BATSMAN_PROFILES: Record<BatsmanArchetype, BatsmanProfile> = {
  aggressive: {
    archetype: "aggressive",
    displayName: "Power Hitter",
    aggression: 0.85,
    riskTolerance: 0.80,
    spinVulnerability: 0.50,
    bounceVulnerability: 0.30,
    yorkerVulnerability: 0.45,
    fieldReadingAbility: 0.60,
  },

  anchor: {
    archetype: "anchor",
    displayName: "The Wall",
    aggression: 0.30,
    riskTolerance: 0.20,
    spinVulnerability: 0.25,
    bounceVulnerability: 0.35,
    yorkerVulnerability: 0.60,
    fieldReadingAbility: 0.80,
  },

  slogger: {
    archetype: "slogger",
    displayName: "The Slogger",
    aggression: 0.95,
    riskTolerance: 0.90,
    spinVulnerability: 0.65,
    bounceVulnerability: 0.40,
    yorkerVulnerability: 0.35,
    fieldReadingAbility: 0.35,
  },

  accumulator: {
    archetype: "accumulator",
    displayName: "The Rotator",
    aggression: 0.45,
    riskTolerance: 0.35,
    spinVulnerability: 0.40,
    bounceVulnerability: 0.55,
    yorkerVulnerability: 0.50,
    fieldReadingAbility: 0.70,
  },
};

// ============================================================
// AI Expectation Engine
// ============================================================

type ZoneCounts = Record<FieldZone, number>;

function countZones(fielders: Fielder[]): ZoneCounts {
  const counts: ZoneCounts = {
    off_inner: 0, off_outer: 0,
    leg_inner: 0, leg_outer: 0,
    straight_inner: 0, straight_outer: 0,
    behind_inner: 0, behind_outer: 0,
  };
  for (const f of fielders) counts[f.zone]++;
  return counts;
}

/**
 * AI reads the field and forms an expectation of what delivery is coming.
 * - Length: read from field placement signals
 * - Variation: guessed from heuristic (previous deliveries + archetype tendency)
 *
 * @param fielders          Current field placement
 * @param batsman           Batsman archetype profile
 * @param pressure          0-1 match pressure
 * @param rng               Seeded RNG for deterministic noise
 * @param lastVariation     Variation bowled on the previous ball (for pattern reading)
 * @param variations        What this bowler can actually bowl, stock ball first.
 *                          The batsman never expects a delivery that isn't on the menu.
 */
export function getAIExpectation(
  fielders: Fielder[],
  batsman: BatsmanProfile,
  pressure: number,
  rng: () => number,
  lastVariation: DeliveryVariation | null = null,
  variations: DeliveryVariation[] = ["pace", "slower_ball", "off_cutter", "leg_cutter", "outswing", "inswing"],
): AIExpectation {
  const z = countZones(fielders);

  // --- LENGTH signals ---
  const lengthSignals: Record<DeliveryLength, number> = {
    yorker: 0,
    full: 0,
    good_length: 0,
    short: 0,
    bouncer: 0,
  };

  const totalDeep = z.off_outer + z.leg_outer + z.straight_outer + z.behind_outer;
  const totalInner = z.off_inner + z.leg_inner + z.straight_inner + z.behind_inner;

  // Deep fielders behind square (fine leg, third man) + deep square leg → signals short/bouncer trap
  const deepBehindSquare = z.behind_outer + (z.leg_outer >= 1 ? 1 : 0);
  if (deepBehindSquare >= 2) {
    lengthSignals.bouncer += 0.35 + (deepBehindSquare - 2) * 0.15;
    lengthSignals.short   += 0.25 + (deepBehindSquare - 2) * 0.10;
  }
  // 5+ deep fielders → classic death-over yorker setup
  if (totalDeep >= 5) {
    lengthSignals.yorker += 0.35 + (totalDeep - 5) * 0.08;
    lengthSignals.full   += 0.15;
  }
  // Packed inner ring → good length / full (bowler looking for nip off the deck)
  if (totalInner >= 5) {
    lengthSignals.good_length += 0.30;
    lengthSignals.full        += 0.15;
  }
  // just behind_outer (no deep square leg) still signals short
  if (z.behind_outer >= 2 && deepBehindSquare < 2) {
    lengthSignals.short   += 0.20;
    lengthSignals.bouncer += 0.10;
  }

  // Scale by field-reading ability
  for (const key of Object.keys(lengthSignals) as DeliveryLength[]) {
    lengthSignals[key] *= batsman.fieldReadingAbility;
  }

  // Add noise: high pressure → more noise
  const noiseAmplitude = 0.08 + pressure * 0.12;
  for (const key of Object.keys(lengthSignals) as DeliveryLength[]) {
    lengthSignals[key] += (rng() - 0.5) * noiseAmplitude;
    lengthSignals[key] = Math.max(0, lengthSignals[key]);
  }

  const totalLengthSignal = Object.values(lengthSignals).reduce((a, b) => a + b, 0);
  let expectedLength: DeliveryLength;
  if (totalLengthSignal < 0.1) {
    const defaults: Record<BatsmanArchetype, DeliveryLength> = {
      aggressive: "bouncer",
      slogger: "good_length",
      anchor: "yorker",
      accumulator: "good_length",
    };
    expectedLength = defaults[batsman.archetype];
  } else {
    expectedLength = (Object.entries(lengthSignals) as [DeliveryLength, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  // --- VARIATION heuristic ---
  // Batsmen try to detect variation from: (a) previous ball, (b) archetype tendency, (c) pure noise.
  // Only what this bowler can actually bowl is considered — no one waits for a
  // googly from a seamer.
  const stockBall = variations[0]; // profiles list the stock ball first
  const variationSignals = {} as Record<DeliveryVariation, number>;
  for (const key of variations) variationSignals[key] = 0;

  variationSignals[stockBall] = 0.30; // default assumption — they bowl their stock ball

  // If bowler just bowled a variation, batsman might look for it again or expect the stock ball
  if (lastVariation && lastVariation !== stockBall && variationSignals[lastVariation] !== undefined) {
    // Good readers: "they might repeat it" — bump the last variation
    variationSignals[lastVariation] += batsman.fieldReadingAbility * 0.25;
    // Also raises stock-ball expectation ("they'll go back to it to mix things up")
    variationSignals[stockBall] += batsman.fieldReadingAbility * 0.15;
  }

  // Archetype tendency: patient batsmen watch for the deceptive balls, hitters
  // just sit on the stock delivery and swing.
  if (batsman.archetype === "anchor" || batsman.archetype === "accumulator") {
    // The two most deceptive balls on this bowler's menu — for pace that's the
    // slower ball and the off cutter, for spin the googly and the top spinner.
    for (const key of variations.slice(1, 3)) variationSignals[key] += 0.10;
  } else {
    variationSignals[stockBall] += 0.15;
  }

  // Add noise for variation (harder to read than length)
  const varNoise = 0.20 + pressure * 0.10;
  for (const key of variations) {
    variationSignals[key] += rng() * varNoise;
    variationSignals[key] = Math.max(0, variationSignals[key]);
  }

  const expectedVariation = (Object.entries(variationSignals) as [DeliveryVariation, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  return { length: expectedLength, variation: expectedVariation };
}

// ============================================================
// Shot Direction Selection
// ============================================================

/**
 * Given the delivery and batsman's tendencies, choose a target shot direction.
 * Returns polar angle (0°=toward bowler) and normalized distance (0-1).
 *
 * Shot angles are keyed by BOTH length and line so the result is physically
 * plausible — e.g. a yorker cannot be cover-driven, a bouncer cannot be flicked
 * straight, a scoop behind square only works on full/yorker deliveries, etc.
 */
export function chooseShotDirection(
  batsman: BatsmanProfile,
  deliveryLength: DeliveryLength,
  line: import("@/types/game").DeliveryLine,
  pressure: number,
  rng: () => number,
  bowlerType: "pace" | "spin" = "pace"
): { angle: number; distance: number } {

  // Angle reference (polar, 0° = toward bowler, clockwise):
  //   0°  = straight (long-on / long-off corridor)
  //  55°  = mid-wicket
  //  90°  = square leg
  // 135°  = fine leg
  // 180°  = behind wicket (keeper / fine leg region)
  // 212°  = gully
  // 248°  = backward point
  // 270°  = point
  // 282°  = cover point
  // 310°  = cover
  // 333°  = long off

  // 2-D matrix: realistic shot angles keyed by [length][line]
  const SHOT_ANGLES: Record<DeliveryLength, Record<string, number[]>> = {

    // ── YORKER ────────────────────────────────────────────────────────────────
    // The ball is at the batsman's feet. Drives are nearly impossible; realistic
    // options are: squirt/squeeze through covers, straight dig-out, leg flick,
    // scoop/ramp over fine leg or keeper.
    yorker: {
      wide_outside_off: [215, 232, 248], // squirt to third man / backward point
      off:              [248, 265, 280], // squeezed to point / cover-point at best
      middle:           [350, 0, 10],   // dug straight: mid-off / straight / mid-on
      leg:              [30, 55, 75],   // flicked through mid-wicket
      wide_outside_leg: [110, 128, 148], // scooped to fine leg / behind square
    },

    // ── FULL ──────────────────────────────────────────────────────────────────
    // Pitching up — the classic slot ball. Batsmen can drive freely through all
    // parts of the ground; flicks on leg, lofted drives off.
    full: {
      wide_outside_off: [257, 270, 282], // cut / cover-drive: point through cover-point
      off:              [295, 312, 328], // cover drive: cover / extra cover
      middle:           [342, 355, 15],  // straight drive: mid-off to mid-on corridor
      leg:              [30, 50, 68],    // leg flick: straight-mid-on through mid-wicket
      wide_outside_leg: [60, 80, 100],  // sweep / whip through sq leg / mid-wicket
    },

    // ── GOOD LENGTH ───────────────────────────────────────────────────────────
    // Batsman can drive or pull depending on line; less free than full.
    good_length: {
      wide_outside_off: [240, 257, 272], // cut or push through backward point / point
      off:              [280, 300, 318], // push/drive: cover-point through cover
      middle:           [338, 352, 18],  // nudge or drive straight
      leg:              [35, 55, 75],   // work through mid-wicket / leg side
      wide_outside_leg: [75, 92, 112],  // push / sweep to sq leg / behind square
    },

    // ── SHORT ─────────────────────────────────────────────────────────────────
    // Chest/shoulder height. Options: cut (off side), pull (leg side). No drives.
    short: {
      wide_outside_off: [225, 245, 260], // cut: gully through backward point
      off:              [212, 232, 250], // upper-cut / cut: third man through backward point
      middle:           [60, 80, 100],  // pull: mid-wicket through sq leg
      leg:              [80, 100, 120], // pull / hook: sq leg to backward sq leg
      wide_outside_leg: [100, 120, 138], // hook behind square / fine leg
    },

    // ── BOUNCER ───────────────────────────────────────────────────────────────
    // Head height. Only realistic shots are the pull (leg-side, sq to fine leg)
    // and the upper-cut / fend (off-side, gully / third man). No drives, no flicks.
    bouncer: {
      wide_outside_off: [200, 218, 235], // upper-cut: third man / gully region
      off:              [208, 225, 245], // fend / upper-cut: gully through backward point
      middle:           [55, 78, 100],  // pull: mid-wicket through sq leg
      leg:              [80, 105, 125], // hook / pull: sq leg through backward sq leg
      wide_outside_leg: [105, 128, 148], // hook behind square / fine leg (or duck)
    },
  };

  // ── SPIN ────────────────────────────────────────────────────────────────────
  // Spin is a different shot vocabulary entirely. There is no scoop, no upper
  // cut, no hook. What there is: the drive (against a ball you can reach), the
  // sweep and slog sweep (against anything on or outside leg), and the cut
  // (against anything short and wide). The tossed-up ball is the MOST driveable
  // delivery in cricket — get to the pitch of it and it goes over long-on.
  const SPIN_SHOT_ANGLES: Record<DeliveryLength, Record<string, number[]>> = {

    // ── TOSSED UP ─────────────────────────────────────────────────────────────
    // Flighted, inviting the drive. Batsman comes down the track and hits with
    // the spin through the line, or sweeps if it's on the pads.
    yorker: {
      wide_outside_off: [295, 312, 330], // driven inside-out through extra cover
      off:              [310, 328, 345], // cover drive / long-off
      middle:           [340, 355, 12],  // straight down the ground — long-off to long-on
      leg:              [10, 30, 55],    // driven / whipped: long-on through mid-wicket
      wide_outside_leg: [45, 68, 92],   // slog swept: cow corner through square leg
    },

    // ── FULL ──────────────────────────────────────────────────────────────────
    // Still driveable, slightly less time to get to the pitch.
    full: {
      wide_outside_off: [285, 302, 320],
      off:              [300, 318, 336],
      middle:           [345, 358, 15],
      leg:              [18, 40, 62],
      wide_outside_leg: [50, 72, 95],   // sweep / slog sweep
    },

    // ── GOOD LENGTH ───────────────────────────────────────────────────────────
    // The stock ball — worked around, swept, or pushed for one.
    good_length: {
      wide_outside_off: [258, 275, 292], // cut / dabbed square of the wicket
      off:              [292, 310, 328],
      middle:           [340, 355, 15],
      leg:              [30, 52, 75],   // worked through mid-wicket
      wide_outside_leg: [62, 85, 110],  // swept square
    },

    // ── SHORT OF LENGTH ───────────────────────────────────────────────────────
    // Sits up. Cut on the off side, pulled or swept on the leg side.
    short: {
      wide_outside_off: [252, 268, 285], // cut square: backward point through point
      off:              [245, 262, 280], // cut behind square
      middle:           [50, 72, 95],   // rocked back and pulled
      leg:              [62, 85, 108],  // pulled / swept square
      wide_outside_leg: [78, 100, 125], // swept behind square
    },

    // ── LONG HOP ──────────────────────────────────────────────────────────────
    // The worst ball in cricket. Sits up begging. Everything is on.
    bouncer: {
      wide_outside_off: [255, 272, 290], // carved square through point
      off:              [248, 266, 285], // cut hard
      middle:           [45, 70, 95],   // pulled into the stands
      leg:              [58, 82, 105],  // slog swept
      wide_outside_leg: [72, 95, 120],  // slog swept behind square
    },
  };

  // Natural shot depth per delivery length — death batsmen swing BIG
  const LENGTH_DISTANCE: Record<DeliveryLength, number> = {
    yorker:      0.55, // scoops / flicks can clear the inner ring but rarely go full boundary
    full:        0.80, // slot ball → lofted drives, death batsmen go aerial
    good_length: 0.70, // standing tall, punching through the line
    short:       0.84, // pull / cut → backs away and goes hard
    bouncer:     0.90, // pull / hook → fully committed shot
  };

  // Spin depth is nearly inverted at the full end: flight buys the bowler
  // deception, but if the batsman gets to the pitch of it the ball travels
  // further than anything else. Flight is a gamble, not free money.
  const SPIN_LENGTH_DISTANCE: Record<DeliveryLength, number> = {
    yorker:      0.88, // got to the pitch and launched it over long-on
    full:        0.82,
    good_length: 0.66, // the stock ball — hardest to get away
    short:       0.80,
    bouncer:     0.92, // long hop: dispatched
  };

  const isSpin = bowlerType === "spin";
  const table = isSpin ? SPIN_SHOT_ANGLES : SHOT_ANGLES;
  const angles = table[deliveryLength]?.[line] ?? table.good_length.middle;
  const baseAngle = angles[Math.floor(rng() * angles.length)];
  // ±15° of random variance in shot direction
  const angle = (baseAngle + (rng() - 0.5) * 30 + 360) % 360;

  let distance = (isSpin ? SPIN_LENGTH_DISTANCE : LENGTH_DISTANCE)[deliveryLength];
  // Under pressure, aggressive batsmen swing harder → more elevation / depth
  if (pressure > 0.6) {
    distance = Math.min(1.0, distance + batsman.aggression * 0.18);
  }
  // A bit of random variance in depth
  distance = Math.min(1.0, Math.max(0.25, distance + (rng() - 0.5) * 0.12));

  return { angle, distance };
}
