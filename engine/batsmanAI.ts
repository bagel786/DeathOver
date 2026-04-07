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
    shotPreferences: {
      off_inner: 0.08,
      off_outer: 0.18,
      leg_inner: 0.08,
      leg_outer: 0.28,
      straight_inner: 0.06,
      straight_outer: 0.22,
      behind_inner: 0.04,
      behind_outer: 0.06,
    },
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
    shotPreferences: {
      off_inner: 0.22,
      off_outer: 0.10,
      leg_inner: 0.26,
      leg_outer: 0.08,
      straight_inner: 0.16,
      straight_outer: 0.05,
      behind_inner: 0.09,
      behind_outer: 0.04,
    },
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
    shotPreferences: {
      off_inner: 0.04,
      off_outer: 0.14,
      leg_inner: 0.04,
      leg_outer: 0.38,
      straight_inner: 0.04,
      straight_outer: 0.26,
      behind_inner: 0.04,
      behind_outer: 0.06,
    },
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
    shotPreferences: {
      off_inner: 0.22,
      off_outer: 0.05,
      leg_inner: 0.26,
      leg_outer: 0.05,
      straight_inner: 0.22,
      straight_outer: 0.05,
      behind_inner: 0.12,
      behind_outer: 0.03,
    },
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
 */
export function getAIExpectation(
  fielders: Fielder[],
  batsman: BatsmanProfile,
  pressure: number,
  rng: () => number,
  lastVariation: DeliveryVariation | null = null,
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
  // Batsmen try to detect variation from: (a) previous ball, (b) archetype tendency, (c) pure noise
  const ALL_VARIATIONS: DeliveryVariation[] = ["pace", "slower_ball", "off_cutter", "leg_cutter", "outswing", "inswing"];

  const variationSignals: Record<DeliveryVariation, number> = {
    pace: 0.30,      // default assumption — bowler bowls pace
    slower_ball: 0,
    off_cutter: 0,
    leg_cutter: 0,
    outswing: 0,
    inswing: 0,
  };

  // If bowler just bowled a variation, batsman might look for it again or expect pace
  if (lastVariation && lastVariation !== "pace") {
    // Good readers: "they might repeat it" — bump the last variation
    variationSignals[lastVariation] += batsman.fieldReadingAbility * 0.25;
    // Also raises pace expectation ("they'll go back to pace to mix it up")
    variationSignals.pace += batsman.fieldReadingAbility * 0.15;
  }

  // Archetype tendency: some batsmen are more tuned to certain variations
  if (batsman.archetype === "anchor" || batsman.archetype === "accumulator") {
    variationSignals.slower_ball += 0.10;
    variationSignals.off_cutter  += 0.08;
  } else {
    // Aggressive / slogger: less attuned, just look for pace
    variationSignals.pace += 0.15;
  }

  // Add noise for variation (harder to read than length)
  const varNoise = 0.20 + pressure * 0.10;
  for (const key of ALL_VARIATIONS) {
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
  rng: () => number
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

  // Natural shot depth per delivery length — death batsmen swing BIG
  const LENGTH_DISTANCE: Record<DeliveryLength, number> = {
    yorker:      0.55, // scoops / flicks can clear the inner ring but rarely go full boundary
    full:        0.80, // slot ball → lofted drives, death batsmen go aerial
    good_length: 0.70, // standing tall, punching through the line
    short:       0.84, // pull / cut → backs away and goes hard
    bouncer:     0.90, // pull / hook → fully committed shot
  };

  const angles = SHOT_ANGLES[deliveryLength]?.[line] ?? SHOT_ANGLES.good_length.middle;
  const baseAngle = angles[Math.floor(rng() * angles.length)];
  // ±15° of random variance in shot direction
  const angle = (baseAngle + (rng() - 0.5) * 30 + 360) % 360;

  let distance = LENGTH_DISTANCE[deliveryLength];
  // Under pressure, aggressive batsmen swing harder → more elevation / depth
  if (pressure > 0.6) {
    distance = Math.min(1.0, distance + batsman.aggression * 0.18);
  }
  // A bit of random variance in depth
  distance = Math.min(1.0, Math.max(0.25, distance + (rng() - 0.5) * 0.12));

  return { angle, distance };
}
