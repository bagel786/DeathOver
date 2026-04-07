import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  GameState,
  Fielder,
  DeliveryLength,
  DeliveryVariation,
  BatsmanArchetype,
  GameResult,
} from "@/types/game";
import { BATSMAN_PROFILES } from "@/engine/batsmanAI";
import { recomputeFielderMeta } from "@/engine/fieldMapping";
import { calculateDeliveryOutcome } from "@/engine/simulation";

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
  };
}

function buildBatsman(archetype: BatsmanArchetype, confidence = 50) {
  return {
    archetype,
    name: BATSMAN_PROFILES[archetype].displayName,
    confidence,
    ballsFaced: 0,
    runsScored: 0,
  };
}

// ============================================================
// Initial State
// ============================================================
const INITIAL_STATE: GameState = {
  // Fixed 7 wickets for SSR — Math.random() here causes hydration mismatch.
  // Actual random wicket counts are generated in startGame / setDailyChallenge / resetGame.
  match: buildDefaultMatch(12, 6, 7),
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
  setDailyChallenge: (challenge: import("@/types/game").DailyChallenge) => void;
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

      const outcome = calculateDeliveryOutcome({
        ballNumber: match.ballsBowled + 1,
        deliveryLength,
        deliveryVariation,
        deliveryLine,
        fielders: field.fielders,
        batsman: batsmanProfile,
        batsmanConfidence: batsman.confidence,
        matchSituation: {
          runsNeeded: match.target - match.runsConceded,
          ballsRemaining: match.totalBalls - match.ballsBowled,
          wicketsInHand: match.wicketsRemaining,
        },
        baseSeed: daily?.seed ?? null,
        rngCallCount,
        lastVariation,
      });

      set((draft) => {
        // Update ball log
        draft.ballLog.push(outcome);
        draft.rngCallCount += 1;

        // Update match state
        draft.match.runsConceded += outcome.runsScored;
        draft.match.ballsBowled += 1;

        // Update striker's stats for THIS ball before any swap
        draft.batsman.ballsFaced += 1;
        draft.batsman.runsScored += outcome.runsScored;

        if (outcome.isWicket) {
          draft.match.wicketsTaken += 1;
          draft.match.wicketsRemaining -= 1;
          // A fresh batsman comes to the crease — choose a random archetype
          const archetypes: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];
          const newArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
          // New batsman starts nervous (confidence 25-45)
          const newConfidence = 25 + Math.floor(Math.random() * 21);
          draft.batsman = buildBatsman(newArchetype, newConfidence);
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
        draft.match = buildDefaultMatch(config.target, config.totalBalls, wickets);
        draft.batsman = buildBatsman(
          config.batsmanArchetype,
          config.batsmanConfidence ?? 50
        );
        draft.nonStriker = buildBatsman(config.nonStrikerArchetype);
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
      const archetypes: BatsmanArchetype[] = ["aggressive", "anchor", "slogger", "accumulator"];
      const wickets = 1 + Math.floor(Math.random() * 10);
      const target = 8 + Math.floor(Math.random() * 13); // 8-20
      const confidence = 25 + Math.floor(Math.random() * 56); // 25-80
      const arch = archetypes[Math.floor(Math.random() * archetypes.length)];
      const nsArch = archetypes[Math.floor(Math.random() * archetypes.length)];
      set(() => ({
        match: buildDefaultMatch(target, 6, wickets),
        batsman: buildBatsman(arch, confidence),
        nonStriker: buildBatsman(nsArch),
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
    setDailyChallenge(challenge) {
      set((draft) => {
        // Use seeded wickets from the challenge so every player faces the same situation.
        // Fall back to random for legacy rows that pre-date this field.
        const wcks = challenge.wickets_remaining ?? (1 + Math.floor(Math.random() * 10));
        draft.match = buildDefaultMatch(challenge.target_runs, challenge.total_balls, wcks);
        draft.batsman = buildBatsman(
          challenge.batsman_archetype,
          challenge.batsman_confidence
        );
        draft.nonStriker = buildBatsman(challenge.non_striker_archetype);
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
