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

  const totalLegSide = z.leg_inner + z.leg_outer;
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
 */
export function chooseShotDirection(
  batsman: BatsmanProfile,
  deliveryLength: DeliveryLength,
  line: import("@/types/game").DeliveryLine,
  pressure: number,
  rng: () => number
): { angle: number; distance: number } {

  // Natural shot angles per line (degrees):
  // 0° = toward bowler (down/straight), 90° = leg side, 180° = behind, 270° = off side
  const LINE_ANGLES: Record<string, number[]> = {
    wide_outside_off: [257, 270, 282],  // cut: backward point (257°), point (270°), cover point (282°)
    off:              [310, 325, 340],  // cover drive: cover (310°), extra cover (325°), long off (340°)
    middle:           [345, 5, 15],     // straight drive: mid-off (345°), straight (0°), mid-on (15°)
    leg:              [48, 75, 90],     // leg flick: mid-wicket (48°), fwd sq leg (75°), sq leg (90°)
    wide_outside_leg: [110, 128, 135],  // flick behind square: bkwd sq (110°), leg gully (128°), fine leg (135°)
  };

  // Natural shot depth per delivery length
  const LENGTH_DISTANCE: Record<DeliveryLength, number> = {
    yorker:     0.50, // full ball → ground-level, can't get over fielders easily
    full:       0.72, // full length → drives, can loft
    good_length: 0.65, // drives and punches
    short:      0.78, // pull / cut → can go deep
    bouncer:    0.88, // pull / hook → deep
  };

  const angles = LINE_ANGLES[line] ?? [0];
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
