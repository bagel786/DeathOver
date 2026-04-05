import type { Fielder, FieldZone } from "@/types/game";

// ============================================================
// Coordinate System:
//   Polar angle 0° = straight toward bowler (DOWN/bottom of SVG)
//   Clockwise rotation:
//      0°  = straight (mid-on / mid-off direction)
//     55°  = mid-wicket (leg side, toward bowler)
//     90°  = square leg (pure leg side)
//    135°  = fine leg (leg side, toward keeper)
//    180°  = wicket-keeper (TOP / behind batsman)
//    212°  = gully (off side, behind square)
//    248°  = backward point (off side, behind square)
//    270°  = point (pure square off side)
//    282°  = cover point (off side, just forward of square)
//    310°  = cover (off side, toward bowler)
//    333°  = long off (deep, off side of straight)
//    345°  = mid-off (off side, nearly straight)
//   Off side = LEFT (~270°)   Leg side = RIGHT (~90°)
// ============================================================

const CX = 50;
const CY = 50;          // field center — used for zones and coverage calculations
const CY_LABEL = 42;    // batsman's popping crease — used for position label angles
const FIELD_RADIUS = 50;

export interface PolarPosition {
  angle: number;    // degrees, 0 = toward bowler (down), clockwise
  distance: number; // 0 = pitch center, 1 = boundary
}

export function cartesianToPolar(x: number, y: number): PolarPosition {
  const dx = x - CX;
  const dy = y - CY; // positive Y = toward bowler (down in SVG)
  const rawDistance = Math.sqrt(dx * dx + dy * dy);
  const distance = Math.min(rawDistance / FIELD_RADIUS, 1);
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return { angle, distance };
}

const INNER_BOUNDARY = 0.55;

export function getFieldZone(x: number, y: number): FieldZone {
  const { angle, distance } = cartesianToPolar(x, y);
  const isInner = distance < INNER_BOUNDARY;

  // Sector boundaries (per authoritative angle map):
  //   0°–45° and 315°–360° → Straight (mid-on/off, long-on/off)
  //   45°–125°              → Leg side (mid-wicket through backward square)
  //  125°–225°              → Behind batsman (fine leg, keeper, slips, gully)
  //  225°–315°              → Off side (cover through point / sweeper)

  if (angle < 45 || angle >= 315) {
    return isInner ? "straight_inner" : "straight_outer";
  }
  if (angle < 125) {
    return isInner ? "leg_inner" : "leg_outer";
  }
  if (angle < 225) {
    return isInner ? "behind_inner" : "behind_outer";
  }
  return isInner ? "off_inner" : "off_outer";
}

// ============================================================
// Named position catalogue — angles from authoritative reference:
//   0°=straight, 55°=mid-wkt, 90°=sq leg, 135°=fine leg,
//   180°=keeper, 248°=backward-point, 270°=point, 282°=cover-point,
//   310°=cover, 333°=long-off, 345°=mid-off
//
// Scoring: score = angleDiff/45 + distDiff*1.5  (lower = better)
// ============================================================
const NAMED_POSITIONS: ReadonlyArray<{
  name: string;
  angle: number;
  distance: number;
}> = [
  // --- Straight toward bowler (0°) ---
  { name: "Silly Mid On",         angle: 15,  distance: 0.12 },
  { name: "Silly Mid Off",        angle: 345, distance: 0.12 },
  { name: "Mid On",               angle: 15,  distance: 0.42 },  // 10°–20°
  { name: "Mid Off",              angle: 345, distance: 0.42 },  // 340°–350°
  { name: "Long On",              angle: 20,  distance: 0.88 },  // 10°–30°
  { name: "Long Off",             angle: 333, distance: 0.88 },  // 329°–360°

  // --- Leg side (45°–125°) ---
  // Mid-wicket: 35°–72° inner
  { name: "Short Mid-Wicket",     angle: 45,  distance: 0.25 },
  { name: "Mid-Wicket",           angle: 55,  distance: 0.42 },  // 35°–72°
  // Deep leg: 40°–75° outer
  { name: "Deep Mid-Wicket",      angle: 52,  distance: 0.88 },  // 40°–65°
  { name: "Cow Corner",           angle: 65,  distance: 0.88 },  // 55°–75°
  // Square leg: 72°–105° inner
  { name: "Square Leg",           angle: 90,  distance: 0.42 },  // 72°–105° inner
  { name: "Deep Square Leg",      angle: 90,  distance: 0.88 },  // 72°–105° outer
  // Backward square: 105°–130°
  { name: "Backward Square Leg",  angle: 120, distance: 0.42 },
  { name: "Deep Backward Sq Leg", angle: 120, distance: 0.88 },
  // Close in leg
  { name: "Short Mid-On",         angle: 30,  distance: 0.12 },  // very close, straight
  { name: "Short Leg",            angle: 163, distance: 0.14 },  // 160°–170°, backward close in

  // --- Behind batsman (125°–225°) ---
  // Fine leg: 120°–150° outer / short fine leg inner
  { name: "Leg Gully",            angle: 128, distance: 0.35 },  // backward boundary of leg zone
  { name: "Deep Leg Gully",       angle: 128, distance: 0.88 },
  { name: "Fine Leg",             angle: 135, distance: 0.88 },  // 120°–150°
  { name: "Short Fine Leg",       angle: 140, distance: 0.28 },  // 130°–150° inner
  // Keeper area
  { name: "Leg Slip",             angle: 168, distance: 0.18 },  // 160°–175°
  { name: "Long Stop",            angle: 180, distance: 0.88 },
  // Slip cordon (off side behind batsman)
  { name: "First Slip",           angle: 190, distance: 0.16 },  // 185°–195°
  { name: "Slips",                angle: 198, distance: 0.20 },  // 190°–205°
  { name: "Gully",                angle: 212, distance: 0.35 },  // 205°–220°
  // Third man: 200°–230° outer
  { name: "Third Man",            angle: 215, distance: 0.88 },

  // --- Off side ---
  // Behind square (248°–270°): backward point
  { name: "Backward Point",       angle: 248, distance: 0.42 },  // 232°–259°
  { name: "Deep Backward Point",  angle: 248, distance: 0.88 },
  // Square off (270°)
  { name: "Silly Point",          angle: 265, distance: 0.12 },
  { name: "Point",                angle: 270, distance: 0.42 },  // 259°–276° pure square off
  { name: "Deep Point",           angle: 270, distance: 0.88 },
  // Forward off side (276°–333°): cover drive region
  { name: "Cover Point",          angle: 282, distance: 0.42 },  // 276°–296°
  { name: "Cover",                angle: 310, distance: 0.42 },  // 296°–320°
  { name: "Deep Cover",           angle: 310, distance: 0.88 },
  { name: "Extra Cover",          angle: 325, distance: 0.42 },  // 320°–329°
  { name: "Deep Extra Cover",     angle: 325, distance: 0.88 },
  { name: "Sweeper (Off)",        angle: 300, distance: 0.88 },  // deep off-side boundary
];

function cartesianToPolarLabel(x: number, y: number): PolarPosition {
  const dx = x - CX;
  const dy = y - CY_LABEL;
  const rawDistance = Math.sqrt(dx * dx + dy * dy);
  const distance = Math.min(rawDistance / FIELD_RADIUS, 1);
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return { angle, distance };
}

export function getNearestPositionLabel(x: number, y: number): string {
  const pos = cartesianToPolarLabel(x, y);
  let bestName = "Fielder";
  let bestScore = Infinity;

  for (const np of NAMED_POSITIONS) {
    const angleDiff = Math.min(
      Math.abs(pos.angle - np.angle),
      360 - Math.abs(pos.angle - np.angle)
    );
    const distDiff = Math.abs(pos.distance - np.distance);
    const score = angleDiff / 45 + distDiff * 1.5;
    if (score < bestScore) {
      bestScore = score;
      bestName = np.name;
    }
  }
  return bestName;
}

export function getZoneCoverage(
  fielders: Fielder[],
  targetAngle: number,
  targetDistance: number
): number {
  let maxCoverage = 0;
  for (const f of fielders) {
    const fPolar = cartesianToPolar(f.position.x, f.position.y);
    const angleDiff = Math.min(
      Math.abs(fPolar.angle - targetAngle),
      360 - Math.abs(fPolar.angle - targetAngle)
    );
    const distDiff = Math.abs(fPolar.distance - targetDistance);
    const ANGLE_WINDOW = 25;
    const DIST_WINDOW = 0.22;
    if (angleDiff < ANGLE_WINDOW && distDiff < DIST_WINDOW) {
      const coverage = (1 - angleDiff / ANGLE_WINDOW) * 0.65 +
                       (1 - distDiff / DIST_WINDOW) * 0.35;
      maxCoverage = Math.max(maxCoverage, coverage);
    }
  }
  return maxCoverage;
}

export function recomputeFielderMeta(fielders: Fielder[]): Fielder[] {
  return fielders.map((f) => ({
    ...f,
    zone: getFieldZone(f.position.x, f.position.y),
    label: getNearestPositionLabel(f.position.x, f.position.y),
  }));
}

export function angleToDirectionLabel(angle: number): string {
  if (angle < 22.5 || angle >= 337.5) return "straight down the ground";
  if (angle < 67.5)  return "through mid-wicket";
  if (angle < 112.5) return "square on the leg side";
  if (angle < 157.5) return "behind square on the leg side";
  if (angle < 202.5) return "behind the wicket";
  if (angle < 247.5) return "through the covers";
  if (angle < 292.5) return "square on the off side";
  return "through the off side";
}
