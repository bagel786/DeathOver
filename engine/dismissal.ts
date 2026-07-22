import type { DeliveryLength, DeliveryLine } from "@/types/game";

/**
 * Single source of truth for HOW a wicket falls, given the delivery.
 *
 * Both the simulation (which aims the ball tracer) and the feedback narrative
 * (which describes the dismissal) read this table. When they each kept their
 * own copy they drifted, and the commentary named a fielder the tracer never
 * pointed at.
 */
export type DismissalKind = "bowled" | "lbw" | "caught_behind" | "caught_field" | "stumped";

export interface Dismissal {
  kind: DismissalKind;
  /** Polar angle the ball travels to. Only meaningful for "caught_field". */
  catchAngle: number;
}

// Wicket-keeper's marker sits at SVG (50, 32) — 18 units behind the polar centre.
// Divided by 47, not 50: BallTracer denormalises with BOUNDARY_R = 47, while
// fieldMapping's cartesianToPolar normalises with FIELD_RADIUS = 50. Using 50 here
// drops the ball 1.1 units low, half off the marker.
export const KEEPER_ANGLE = 180;
export const KEEPER_DISTANCE = 18 / 47;

const BOWLED: Dismissal = { kind: "bowled", catchAngle: 0 };
const LBW: Dismissal = { kind: "lbw", catchAngle: 0 };
const BEHIND: Dismissal = { kind: "caught_behind", catchAngle: KEEPER_ANGLE };
/** Beaten in the flight, dragged out of the crease — the keeper does the rest. */
const STUMPED: Dismissal = { kind: "stumped", catchAngle: KEEPER_ANGLE };
const field = (catchAngle: number): Dismissal => ({ kind: "caught_field", catchAngle });

// Angles: 55°=mid-wicket, 90°=square leg, 135°=fine leg, 180°=keeper,
//         195°=slip, 212°=gully, 270°=point, 345°=mid-off
const TABLE: Record<DeliveryLength, Record<DeliveryLine, Dismissal>> = {
  yorker: {
    wide_outside_off: field(270), // jammed out to point
    off:              BOWLED,
    middle:           BOWLED,
    leg:              BOWLED,
    wide_outside_leg: BOWLED,     // inside edge onto the stumps
  },
  full: {
    wide_outside_off: BEHIND,     // reaching for the drive, thick edge
    off:              field(195), // edged to slip
    middle:           field(345), // driven uppishly to mid-off
    leg:              field(55),  // miscued flick to mid-wicket
    wide_outside_leg: field(55),
  },
  good_length: {
    wide_outside_off: field(212), // nipped away, edge to gully
    off:              BEHIND,
    middle:           BOWLED,
    leg:              LBW,
    wide_outside_leg: LBW,
  },
  short: {
    wide_outside_off: field(212), // cut in the air to gully
    off:              field(212),
    middle:           field(90),  // mistimed pull to square leg
    leg:              field(90),
    wide_outside_leg: BEHIND,     // gloved trying to duck
  },
  bouncer: {
    wide_outside_off: field(212), // fended to gully
    off:              field(212),
    middle:           field(135), // top edge toward fine leg
    leg:              field(135),
    wide_outside_leg: BEHIND,
  },
};

// Spin dismisses differently. The tossed-up ball drags the batsman out of the
// crease (stumped) or is driven in the air; the short stuff is only ever
// mistimed into the field. No edges-to-slip off pace, no gloved bouncers.
const SPIN_TABLE: Record<DeliveryLength, Record<DeliveryLine, Dismissal>> = {
  // Tossed up — the flight does the work. Stumping is the signature wicket.
  yorker: {
    wide_outside_off: STUMPED,     // chased the drive, never got back
    off:              STUMPED,
    middle:           BOWLED,      // beaten in the flight, through the gate
    leg:              field(20),   // miscued the loft to long-on
    wide_outside_leg: STUMPED,     // missed the sweep, dragged across
  },
  // Full — driven, so caught in front of the wicket.
  full: {
    wide_outside_off: field(310),  // driven straight to cover
    off:              field(328),  // extra cover
    middle:           field(0),    // straight to long-off / long-on
    leg:              field(52),   // miscued loft to deep mid-wicket
    wide_outside_leg: field(85),   // top-edged sweep to square leg
  },
  // Good length — the stock ball. Beaten, trapped, or edged.
  good_length: {
    wide_outside_off: BEHIND,      // edged trying to cut
    off:              BEHIND,
    middle:           BOWLED,
    leg:              LBW,         // turned back into the pad
    wide_outside_leg: field(90),   // top-edged sweep
  },
  // Short of a length — cut and pulled, mistimed into the ring.
  short: {
    wide_outside_off: field(270),  // cut straight to point
    off:              field(248),  // backward point
    middle:           field(85),   // pulled to square leg
    leg:              field(90),
    wide_outside_leg: field(110),  // top-edged sweep behind square
  },
  // Long hop — same shots, hit harder and squarer.
  bouncer: {
    wide_outside_off: field(270),
    off:              field(262),
    middle:           field(75),   // pulled in the air
    leg:              field(90),
    wide_outside_leg: field(105),
  },
};

export function classifyDismissal(
  length: DeliveryLength,
  line: DeliveryLine,
  bowlerType: "pace" | "spin" = "pace"
): Dismissal {
  return (bowlerType === "spin" ? SPIN_TABLE : TABLE)[length][line];
}
