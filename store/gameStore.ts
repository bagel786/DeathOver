import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  GameState,
  Fielder,
  DeliveryLength,
  DeliveryVariation,
  BatsmanArchetype,
  BattingHand,
  GameResult,
} from "@/types/game";
import { BATSMAN_PROFILES } from "@/engine/batsmanAI";
import { BOWLERS, getBowler } from "@/engine/bowlers";
import { recomputeFielderMeta } from "@/engine/fieldMapping";
import { calculateDeliveryOutcome } from "@/engine/simulation";
import { createGameRng } from "@/engine/rng";

// ============================================================
// Default Starting Field (spread fielders sensibly around the boundary)
// Based on a standard death-over defensive field
// ============================================================
function buildDefaultFielders(): Fielder[] {
  // Positions computed geometrically from batsman's crease (50, 42):
  //   inner ring ~20 units out, boundary ~37 units out
  //   angles use cricket convention: 0°=straight, 90°=square leg, 270°=point
  const positions: Array<{ x: number; y: number }> = [
    { x: 29, y: 12 },  // Third Man       (215° boundary — behind square, off side)
    { x: 76, y: 16 },  // Fine Leg        (135° boundary — behind square, leg side)
    { x: 30, y: 46 },  // Cover Point     (282° inner — just forward of square, off side)
    { x: 70, y: 42 },  // Square Leg      (90°  inner — exactly square, leg side)
    { x: 33, y: 75 },  // Long Off        (333° boundary — straight off side boundary)
    { x: 63, y: 77 },  // Long On         (20°  boundary — straight leg side boundary)
    { x: 35, y: 55 },  // Cover           (310° inner — forward of square, off side)
    { x: 79, y: 65 },  // Deep Mid-Wicket (52°  boundary — forward of square, leg side)
    { x: 55, y: 61 },  // Mid On          (15°  inner — slightly leg side of straight)
  ];

  return recomputeFielderMeta(
    positions.map((pos, idx) => ({
      id: idx + 1,
      position: pos,
      zone: "straight_inner" as const, // will be overwritten by recomputeFielderMeta
      label: "",
    }))
  );
}

// ============================================================

// Default Match State
// ============================================================
function buildDefaultMatch(
  target: number,
  totalBalls: number,
  wicketsRemaining: number
) {
  return {
    target,
    runsConceded: 0,
    ballsBowled: 0,
    totalBalls,
    wicketsTaken: 0,
    wicketsRemaining,
    isComplete: false,
    result: "pending" as GameResult,
    nextBallIsFreeHit: false,
  };
}

function buildBatsman(
  archetype: BatsmanArchetype,
  confidence = 50,
  hand: BattingHand = "right"
) {
  return {
    archetype,
    name: BATSMAN_PROFILES[archetype].displayName,
    hand,
    confidence,
    ballsFaced: 0,
    runsScored: 0,
  };
}

/** Roughly a quarter of batsmen are left-handed. */
const rollHand = (rng: () => number): BattingHand => (rng() < 0.25 ? "left" : "right");

/**
 * RNG sub-sequence offsets, kept distinct so seeded rolls never collide:
 *   per-ball outcome     → rngCallCount
 *   wicket replacement   → rngCallCount * 100 + 50
 *   opening batsmen hand → 900 / 901
 */
const HAND_SEED_STRIKER = 900;
const HAND_SEED_NON_STRIKER = 901;

/** Hands for the two openers — seeded on daily challenges so everyone faces the same pair. */
function rollOpeningHands(seed: number | null): [BattingHand, BattingHand] {
  if (seed == null) return [rollHand(Math.random), rollHand(Math.random)];
  return [
    rollHand(createGameRng(seed, HAND_SEED_STRIKER)),
    rollHand(createGameRng(seed, HAND_SEED_NON_STRIKER)),
  ];
}

// ============================================================
// Initial State
// ============================================================
const INITIAL_STATE: GameState = {
  // Fixed 7 wickets for SSR — Math.random() here causes hydration mismatch.
  // Actual random wicket counts are generated in startGame / setDailyChallenge / resetGame.
  match: buildDefaultMatch(12, 6, 7),
  bowlerId: BOWLERS[0].id,
  batsman: buildBatsman("aggressive", 65),
  nonStriker: buildBatsman("accumulator"),
  field: { fielders: buildDefaultFielders() },
  currentDelivery: { length: null, variation: null, line: null },
  ballLog: [],
  daily: null,
  rngCallCount: 0,
};

// ============================================================
// Store Interface
// ============================================================
interface GameStore extends GameState {
  // Field actions
  placeFielder: (id: number, x: number, y: number) => void;

  // Delivery selection
  setDeliveryLength: (length: DeliveryLength) => void;
  setDeliveryVariation: (variation: DeliveryVariation) => void;
  setDeliveryLine: (line: import("@/types/game").DeliveryLine) => void;

  // Core game action
  bowlDelivery: () => void;

  // Game management
  startGame: (config: GameConfig) => void;
  resetGame: () => void;
  setDailyChallenge: (challenge: import("@/types/game").DailyChallenge, bowlerId?: string) => void;
}

export interface GameConfig {
  target: number;
  totalBalls: number;
  wicketsRemaining?: number; // if omitted, random 1-10
  batsmanArchetype: BatsmanArchetype;
  batsmanName: string;
  nonStrikerArchetype: BatsmanArchetype;
  nonStrikerName: string;
  batsmanConfidence?: number;
  seed?: number;
  /** Which bowler the player picked. Falls back to the default if unset. */
  bowlerId?: string;
}

// ============================================================
// Zustand Store
// ============================================================
export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    ...INITIAL_STATE,

    // --------------------------------------------------------
    // placeFielder — drag a fielder to new x,y coordinates
    // --------------------------------------------------------
    placeFielder(id, x, y) {
      set((state) => {
        const idx = state.field.fielders.findIndex((f) => f.id === id);
        if (idx === -1) return;

        // Clamp to field boundary
        const cx = 50, cy = 50;
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = 47;
        if (dist > maxR) {
          x = cx + (dx / dist) * maxR;
          y = cy + (dy / dist) * maxR;
        }

        // Death-over fielding restriction: max 5 fielders outside 30-yard circle
        // 30-yard circle = normalised distance 0.55 = 27.5 units from center
        const INNER_RADIUS = 27.5; // 0.55 * 50
        const newDx = x - cx, newDy = y - cy;
        const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
        if (newDist > INNER_RADIUS) {
          // Count how many OTHER fielders are already outside the circle
          const outerCount = state.field.fielders.filter((f) => {
            if (f.id === id) return false;
            const fdx = f.position.x - cx, fdy = f.position.y - cy;
            return Math.sqrt(fdx * fdx + fdy * fdy) > INNER_RADIUS;
          }).length;
          if (outerCount >= 5) {
            // Snap back inside just inside the 30-yard line
            const clampR = INNER_RADIUS - 0.5;
            x = cx + (newDx / newDist) * clampR;
            y = cy + (newDy / newDist) * clampR;
          }
        }

        state.field.fielders[idx].position = { x, y };

        // Recompute zone + label for the moved fielder
        const updated = recomputeFielderMeta([state.field.fielders[idx]]);
        state.field.fielders[idx] = updated[0];
      });
    },

    // --------------------------------------------------------
    // Delivery selection
    // --------------------------------------------------------
    setDeliveryLength(length) {
      set((state) => {
        state.currentDelivery.length = length;
      });
    },

    setDeliveryVariation(variation) {
      set((state) => {
        state.currentDelivery.variation = variation;
      });
    },

    setDeliveryLine(line) {
      set((state) => {
        state.currentDelivery.line = line;
      });
    },

    // --------------------------------------------------------
    // bowlDelivery — the main game action
    // --------------------------------------------------------
    bowlDelivery() {
      const state = get();
      if (state.match.isComplete) return;
      if (!state.currentDelivery.length || !state.currentDelivery.variation || !state.currentDelivery.line) return;

      const {
        match,
        batsman,
        field,
        currentDelivery,
        daily,
        rngCallCount,
        ballLog,
      } = state;

      const batsmanProfile = BATSMAN_PROFILES[batsman.archetype];

      const deliveryLength    = currentDelivery.length!;
      const deliveryVariation = currentDelivery.variation!;
      const deliveryLine      = currentDelivery.line!;

      // Track last variation for AI heuristic
      const lastVariation = ballLog.length > 0
        ? ballLog[ballLog.length - 1].delivery.variation
        : null;

      // Count yorkers in the last 4 legal (non-extra) deliveries — batsman gets set to repeated yorkers
      const recentYorkerCount = ballLog
        .filter(b => !b.isExtraDelivery)
        .slice(-4)
        .filter(b => b.delivery.length === "yorker")
        .length;

      const outcome = calculateDeliveryOutcome({
        ballNumber: match.ballsBowled + 1,
        deliveryLength,
        deliveryVariation,
        deliveryLine,
        fielders: field.fielders,
        batsman: batsmanProfile,
        bowler: getBowler(state.bowlerId),
        battingHand: batsman.hand,
        batsmanConfidence: batsman.confidence,
        matchSituation: {
          runsNeeded: match.target - match.runsConceded,
          ballsRemaining: match.totalBalls - match.ballsBowled,
          wicketsInHand: match.wicketsRemaining,
        },
        baseSeed: daily?.seed ?? null,
        rngCallCount,
        lastVariation,
        recentYorkerCount,
        isFreeHit: match.nextBallIsFreeHit,
      });

      set((draft) => {
        // Update ball log
        draft.ballLog.push(outcome);
        draft.rngCallCount += 1;

        // Update match state
        draft.match.runsConceded += outcome.runsScored;
        // Wide / no-ball: ball is NOT consumed — bowler must re-bowl
        if (!outcome.isExtraDelivery) {
          draft.match.ballsBowled += 1;
        }
        // Track whether the next ball is a free hit. By the laws a free hit is only
        // consumed by a legal delivery — a wide or no-ball in between carries it over.
        draft.match.nextBallIsFreeHit =
          outcome.triggersFreeHit ||
          (outcome.isExtraDelivery && draft.match.nextBallIsFreeHit);

        // Extra deliveries (wide/no-ball) don't affect striker's faced count or confidence
        if (outcome.isExtraDelivery) {
          // Add the penalty run to striker's scorecard but don't count the ball faced
          draft.batsman.runsScored += outcome.runsScored;
          // Reset delivery and exit — no end-condition check needed (ball not consumed)
          draft.currentDelivery = { length: null, variation: null, line: null };
          return;
        }

        // Update striker's stats for THIS ball before any swap
        draft.batsman.ballsFaced += 1;
        draft.batsman.runsScored += outcome.runsScored;

        if (outcome.isWicket) {
          draft.match.wicketsTaken += 1;
          draft.match.wicketsRemaining -= 1;
          const archetypes: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];
          // Use seeded RNG for daily challenges so same seed always produces same replacement batsman.
          // Offset by 50 to avoid colliding with the per-ball RNG sub-sequence.
          const wicketRng = draft.daily?.seed != null
            ? createGameRng(draft.daily.seed, draft.rngCallCount * 100 + 50)
            : Math.random;
          const newArchetype = archetypes[Math.floor(wicketRng() * archetypes.length)];
          // New batsman starts nervous (confidence 25-45)
          const newConfidence = 25 + Math.floor(wicketRng() * 21);
          // wicketRng is already a seeded sequence — one more draw needs no new offset
          draft.batsman = buildBatsman(newArchetype, newConfidence, rollHand(wicketRng));
          // Non-striker stays unchanged — they don't cross on a caught/bowled
        } else {
          // Update confidence — death batsmen are fearless, build momentum fast
          if (outcome.runsScored >= 6) {
            draft.batsman.confidence = Math.min(100, draft.batsman.confidence + 20);
          } else if (outcome.runsScored >= 4) {
            draft.batsman.confidence = Math.min(100, draft.batsman.confidence + 15);
          } else if (outcome.runsScored > 0) {
            draft.batsman.confidence = Math.min(100, draft.batsman.confidence + 8);
          } else {
            draft.batsman.confidence = Math.max(0, draft.batsman.confidence - 5);
          }

          // Rotate strike on odd runs (1 or 3) — batsmen cross ends
          if (outcome.runsScored % 2 === 1) {
            const s = draft.batsman;
            const ns = draft.nonStriker;
            // Swap all fields explicitly (Immer requires direct mutation, not reassignment)
            const tmpArchetype = s.archetype; s.archetype = ns.archetype; ns.archetype = tmpArchetype;
            const tmpName = s.name; s.name = ns.name; ns.name = tmpName;
            const tmpHand = s.hand; s.hand = ns.hand; ns.hand = tmpHand;
            const tmpConf = s.confidence; s.confidence = ns.confidence; ns.confidence = tmpConf;
            const tmpBalls = s.ballsFaced; s.ballsFaced = ns.ballsFaced; ns.ballsFaced = tmpBalls;
            const tmpRuns = s.runsScored; s.runsScored = ns.runsScored; ns.runsScored = tmpRuns;
          }
        }

        // Check end conditions
        const runsRemaining = draft.match.target - draft.match.runsConceded;
        const ballsLeft = draft.match.totalBalls - draft.match.ballsBowled;
        const allOut = draft.match.wicketsRemaining <= 0;

        if (runsRemaining <= 0) {
          // Batsman reached / exceeded target — chased down, bowler loses
          draft.match.isComplete = true;
          draft.match.result = "lost";
        } else if (ballsLeft === 0 || allOut) {
          // Over complete or all out
          draft.match.isComplete = true;
          // runsRemaining === 1 means scores are level (tied)
          draft.match.result = runsRemaining === 1 ? "tied" : "won";
        }

        // Reset delivery selection for next ball
        draft.currentDelivery = { length: null, variation: null, line: null };
      });
    },

    // --------------------------------------------------------
    // startGame — configure a new custom or daily game
    // --------------------------------------------------------
    startGame(config) {
      set((draft) => {
        const wickets = config.wicketsRemaining ?? (1 + Math.floor(Math.random() * 10));
        const rawTarget = Number(config.target);
        const safeTarget = Math.min(36, Math.max(1, isNaN(rawTarget) ? 1 : rawTarget));
        const rawBalls = Number(config.totalBalls);
        const safeTotalBalls = Math.min(36, Math.max(1, isNaN(rawBalls) ? 6 : rawBalls));
        draft.match = buildDefaultMatch(safeTarget, safeTotalBalls, wickets);
        draft.bowlerId = getBowler(config.bowlerId).id;
        const [strikerHand, nonStrikerHand] = rollOpeningHands(config.seed ?? null);
        draft.batsman = buildBatsman(
          config.batsmanArchetype,
          config.batsmanConfidence ?? 50,
          strikerHand
        );
        draft.nonStriker = buildBatsman(config.nonStrikerArchetype, 50, nonStrikerHand);
        draft.field = { fielders: buildDefaultFielders() };
        draft.currentDelivery = { length: null, variation: null, line: null };

        draft.ballLog = [];
        draft.rngCallCount = 0;
        draft.daily = config.seed
          ? {
              challengeId: "custom",
              date: new Date().toISOString().split("T")[0],
              seed: config.seed,
            }
          : null;
      });
    },

    // --------------------------------------------------------
    // resetGame — go back to initial state
    // --------------------------------------------------------
    resetGame() {
      const keptBowlerId = get().bowlerId; // a reset re-runs the same over, same bowler
      const archetypes: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];
      const wickets = 1 + Math.floor(Math.random() * 10);
      const target = 8 + Math.floor(Math.random() * 13); // 8-20
      const confidence = 25 + Math.floor(Math.random() * 56); // 25-80
      const arch = archetypes[Math.floor(Math.random() * archetypes.length)];
      const nsArch = archetypes[Math.floor(Math.random() * archetypes.length)];
      const [strikerHand, nonStrikerHand] = rollOpeningHands(null);
      set(() => ({
        match: buildDefaultMatch(target, 6, wickets),
        bowlerId: keptBowlerId,
        batsman: buildBatsman(arch, confidence, strikerHand),
        nonStriker: buildBatsman(nsArch, 50, nonStrikerHand),
        field: { fielders: buildDefaultFielders() },
        currentDelivery: { length: null, variation: null, line: null },
        ballLog: [],
        daily: null,
        rngCallCount: 0,
      }));
    },

    // --------------------------------------------------------
    // setDailyChallenge — initialize from Supabase row
    // --------------------------------------------------------
    setDailyChallenge(challenge, bowlerId) {
      set((draft) => {
        draft.bowlerId = getBowler(bowlerId).id;
        // Use seeded wickets from the challenge so every player faces the same situation.
        // Fall back to random for legacy rows that pre-date this field.
        const wcks = challenge.wickets_remaining ?? (1 + Math.floor(Math.random() * 10));
        draft.match = buildDefaultMatch(challenge.target_runs, challenge.total_balls, wcks);
        const VALID_ARCHETYPES: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];
        const sanitizeArchetype = (a: unknown): BatsmanArchetype =>
          VALID_ARCHETYPES.includes(a as BatsmanArchetype) ? (a as BatsmanArchetype) : "aggressive";
        const [strikerHand, nonStrikerHand] = rollOpeningHands(challenge.rng_seed);
        draft.batsman = buildBatsman(
          sanitizeArchetype(challenge.batsman_archetype),
          challenge.batsman_confidence,
          strikerHand
        );
        draft.nonStriker = buildBatsman(
          sanitizeArchetype(challenge.non_striker_archetype),
          50,
          nonStrikerHand
        );
        draft.field = { fielders: buildDefaultFielders() };
        draft.currentDelivery = { length: null, variation: null, line: null };

        draft.ballLog = [];
        draft.rngCallCount = 0;
        draft.daily = {
          challengeId: challenge.id,
          date: challenge.date,
          seed: challenge.rng_seed,
        };
      });
    },
  }))
);
