// ============================================================
// Core Game Types — The Death Over Challenge
// ============================================================

// --- Enumerations ---

export type BatsmanArchetype = "aggressive" | "anchor" | "slogger" | "accumulator";

/** Where the ball pitches */
export type DeliveryLength =
  | "yorker"      // full, near feet
  | "full"        // full length, driveable  
  | "good_length" // stock delivery
  | "short"       // back of a length
  | "bouncer";    // very short, aimed at body/head

/** How the ball moves / pace variation */
export type DeliveryVariation =
  | "pace"        // standard, no variation
  | "slower_ball" // significant pace drop
  | "off_cutter"  // moves into right-hander off pitch
  | "leg_cutter"  // moves away from right-hander
  | "outswing"    // swings away in the air
  | "inswing";    // swings in through the air

/** Combined AI reading of expected delivery */
export interface AIExpectation {
  length: DeliveryLength;
  variation: DeliveryVariation;
}

export type DeliveryLine =
  | "wide_outside_off"
  | "off"
  | "middle"
  | "leg"
  | "wide_outside_leg";

/**
 * The 8 strategic zones the engine uses for calculations.
 * Named from the batsman's perspective (off = left for right-hander).
 */
export type FieldZone =
  | "off_inner"       // inner ring, off side (cover, point, cover point)
  | "off_outer"       // outer ring, off side (deep cover, sweeper, deep point)
  | "leg_inner"       // inner ring, leg side (mid-wicket, square leg, forward short leg)
  | "leg_outer"       // outer ring, leg side (deep mid-wicket, deep square leg)
  | "straight_inner"  // inner ring, straight (mid off, mid on)
  | "straight_outer"  // outer ring, straight (long off, long on)
  | "behind_inner"    // infield behind batsman (short fine leg, leg slip)
  | "behind_outer";   // boundary behind batsman (third man, fine leg, long stop)

export type BallResult =
  | "dot"
  | "single"
  | "two"
  | "three"
  | "four"
  | "six"
  | "wicket"
  | "wide"
  | "no_ball";

export type ChaosEvent =
  | "dropped_catch"
  | "overthrow"
  | "misfield"
  | "stumping_missed"
  | null;

export type GameResult = "pending" | "won" | "lost" | "tied";

// --- Field ---

export interface Fielder {
  id: number; // 1-9
  position: {
    x: number; // 0-100 normalized (0=left boundary, 100=right boundary)
    y: number; // 0-100 normalized (0=top/bowler end, 100=bottom/batsman end)
  };
  zone: FieldZone;
  label: string; // nearest named position (e.g. "Deep Mid-Wicket")
}

// --- Batsman ---

export interface BatsmanProfile {
  archetype: BatsmanArchetype;
  displayName: string;
  /** Shot selection weights by zone (sum should ~= 1) */
  shotPreferences: Record<FieldZone, number>;
  aggression: number;          // 0-1
  riskTolerance: number;       // 0-1
  spinVulnerability: number;   // 0-1 — weakness vs slower_ball / leg_cutter
  bounceVulnerability: number; // 0-1 — weakness vs bouncer
  yorkerVulnerability: number; // 0-1 — weakness vs yorker
  fieldReadingAbility: number; // 0-1 — how well they detect the trap
}

// --- Delivery ---

export interface Delivery {
  length: DeliveryLength | null;
  variation: DeliveryVariation | null;
  line: DeliveryLine | null;
}

// --- Ball Outcome ---

export interface BallOutcome {
  ballNumber: number;
  delivery: { length: DeliveryLength; variation: DeliveryVariation; line: DeliveryLine };
  fieldSnapshot: Fielder[];
  aiExpectation: AIExpectation;
  wasLengthBluff: boolean;
  wasVariationBluff: boolean;
  result: BallResult;
  runsScored: number;
  isWicket: boolean;
  isCaught: boolean;
  chaosEvent: ChaosEvent;
  /** Where the ball went, for animation (polar: 0° = toward bowler) */
  shotDirection: { angle: number; distance: number };
  feedbackMessage: string;
}

// --- Match ---

export interface MatchState {
  target: number;           // runs to defend
  runsConceded: number;
  ballsBowled: number;
  totalBalls: number;       // 6 for daily, 6-30 for custom
  wicketsTaken: number;     // wickets fallen so far
  wicketsRemaining: number; // wickets left in hand (1-10, random at game start)
  isComplete: boolean;
  result: GameResult;
}

// --- Batsman in Match ---

export interface BatsmanInMatch {
  archetype: BatsmanArchetype;
  name: string;
  confidence: number;   // 0-100, updated after each ball
  ballsFaced: number;
  runsScored: number;
}

// --- Root Game State ---

export interface GameState {
  match: MatchState;
  batsman: BatsmanInMatch;
  nonStriker: BatsmanInMatch;
  field: {
    fielders: Fielder[];
  };
  currentDelivery: Delivery;
  ballLog: BallOutcome[];
  daily: {
    challengeId: string;
    date: string;     // ISO date string
    seed: number;
  } | null;
  /** Increments with each ball so the RNG seed stays deterministic */
  rngCallCount: number;
}

// --- Daily Challenge (from Supabase) ---

export interface DailyChallenge {
  id: string;
  date: string;
  target_runs: number;
  total_balls: number;
  wickets_remaining: number;
  batsman_archetype: BatsmanArchetype;
  batsman_name: string;
  non_striker_archetype: BatsmanArchetype;
  non_striker_name: string;
  batsman_confidence: number;
  scenario_title: string;
  scenario_description: string | null;
  rng_seed: number;
}

// --- Leaderboard ---

export interface LeaderboardEntry {
  id: string;
  challenge_id: string;
  display_name: string;
  runs_conceded: number;
  wickets_taken: number;
  balls_used: number;
  result: GameResult;
  score: number;
  emoji_summary: string;
  ball_log: BallOutcome[];
  created_at: string;
}
