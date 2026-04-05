# The Death Over Challenge — Technical Architecture & Development Plan

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Game State Shape](#2-game-state-shape)
3. [Field Position System](#3-field-position-system)
4. [AI Batsman Archetypes](#4-ai-batsman-archetypes)
5. [The Simulation Engine](#5-the-simulation-engine)
6. [Database Schema (Supabase)](#6-database-schema-supabase)
7. [Shareable Results System](#7-shareable-results-system)
8. [Project Structure](#8-project-structure)
9. [Development Roadmap](#9-development-roadmap)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App (Vercel)               │
│                                                       │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Field UI  │  │  Delivery    │  │  Scoreboard   │ │
│  │  (SVG)     │  │  Selector    │  │  & Feedback   │ │
│  └─────┬─────┘  └──────┬───────┘  └───────┬───────┘ │
│        │               │                   │         │
│        └───────────┬───┘───────────────────┘         │
│                    │                                  │
│           ┌────────▼────────┐                        │
│           │   Zustand Store  │                        │
│           │   (Game State)   │                        │
│           └────────┬────────┘                        │
│                    │                                  │
│           ┌────────▼────────┐                        │
│           │  Simulation     │                        │
│           │  Engine (pure   │                        │
│           │  functions)     │                        │
│           └────────┬────────┘                        │
│                    │                                  │
└────────────────────┼──────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Supabase   │
              │  (Daily +    │
              │  Leaderboard)│
              └─────────────┘
```

**State Management: Zustand over React Context.**
Why: The game state updates every ball — Context would re-render the entire tree on every state change. Zustand gives you surgical subscriptions (only the scoreboard re-renders when runs change, only the field re-renders when fielders move) with zero boilerplate. It also makes the simulation engine trivially testable since Zustand stores are just plain objects outside of React.

---

## 2. Game State Shape

```typescript
// types/game.ts

interface GameState {
  // --- Match Situation ---
  match: {
    target: number;            // runs to defend (e.g., 12)
    runsConceeded: number;     // runs given away so far
    ballsBowled: number;       // 0-6 for single over, 0-30 for 5 overs
    totalBalls: number;        // 6 for daily challenge, 6-30 for custom
    wicketsLost: number;       // 0-10
    isComplete: boolean;       // match over?
    result: 'pending' | 'won' | 'lost' | 'tied';
  };

  // --- Batsman ---
  batsman: {
    archetype: BatsmanArchetype;   // 'aggressive' | 'anchor' | 'slogger' | 'accumulator'
    name: string;                  // display name
    confidence: number;            // 0-100, shifts based on recent outcomes
    strikeRate: number;            // running SR this innings
    ballsFaced: number;
    runsScored: number;
  };

  // --- Non-Striker (for rotation tracking) ---
  nonStriker: {
    archetype: BatsmanArchetype;
    name: string;
    confidence: number;
  };

  // --- Field Placements ---
  field: {
    fielders: Fielder[];           // exactly 9 fielders
    // Keeper and bowler are implicit (fixed positions)
  };

  // --- Current Delivery (user's next input) ---
  currentDelivery: {
    type: DeliveryType | null;     // 'yorker' | 'bouncer' | 'slower_ball' | 'leg_cutter' | 'good_length'
    line: DeliveryLine | null;     // 'off' | 'middle' | 'leg' | 'wide_outside_off' | 'wide_outside_leg'
  };

  // --- Ball History ---
  ballLog: BallOutcome[];          // chronological log of every delivery

  // --- Daily Challenge Metadata ---
  daily: {
    challengeId: string;
    date: string;                  // ISO date
    seed: number;                  // RNG seed for deterministic chaos events
  } | null;
}

// --- Supporting Types ---

type BatsmanArchetype = 'aggressive' | 'anchor' | 'slogger' | 'accumulator';

type DeliveryType = 'yorker' | 'bouncer' | 'slower_ball' | 'leg_cutter' | 'good_length';

type DeliveryLine = 'off' | 'middle' | 'leg' | 'wide_outside_off' | 'wide_outside_leg';

interface Fielder {
  id: number;                      // 1-9
  position: {
    x: number;                     // 0-100 normalized coordinates on the SVG field
    y: number;                     // 0-100 (0,0 = top-left)
  };
  zone: FieldZone;                 // auto-calculated from x,y position
  label: string;                   // computed nearest named position (e.g., "Deep Mid-Wicket")
}

// The 8 strategic zones used by the engine
type FieldZone =
  | 'off_inner'         // inner ring, off side (cover, point, silly point area)
  | 'off_outer'         // outer ring, off side (deep cover, deep point, sweeper)
  | 'leg_inner'         // inner ring, leg side (mid-wicket, square leg, silly mid on)
  | 'leg_outer'         // outer ring, leg side (deep mid-wicket, deep square leg)
  | 'straight_inner'    // inner ring, straight (mid off, mid on)
  | 'straight_outer'    // outer ring, straight (long off, long on)
  | 'behind_inner'      // behind the batsman, inner (short fine leg, leg slip)
  | 'behind_outer';     // behind the batsman, outer (third man, fine leg, long stop)

interface BallOutcome {
  ballNumber: number;
  delivery: { type: DeliveryType; line: DeliveryLine };
  fieldSnapshot: Fielder[];        // field state at time of delivery
  aiExpectation: DeliveryType;     // what the AI batsman expected
  wasBluff: boolean;               // did the user trick the AI?
  result: BallResult;
  runsScored: number;
  isWicket: boolean;
  chaosEvent: ChaosEvent | null;
  feedbackMessage: string;         // human-readable explanation
}

type BallResult =
  | 'dot'
  | 'single'
  | 'two'
  | 'three'
  | 'four'
  | 'six'
  | 'wicket'
  | 'wide'
  | 'no_ball';

type ChaosEvent =
  | 'dropped_catch'
  | 'overthrow'
  | 'misfield'
  | 'umpire_error'
  | 'stumping_missed'
  | null;
```

---

## 3. Field Position System

The field is an SVG circle. The user drags fielders anywhere on it. The system maps each (x, y) position to a zone and a named label.

### Coordinate System

```
           0,0 ─────────────────── 100,0
            │    BOWLER'S END          │
            │         (top)            │
            │                          │
            │   ┌──────────┐           │
            │   │  pitch   │           │
            │   └──────────┘           │
            │                          │
            │    BATSMAN'S END         │
            │        (bottom)          │
           0,100 ────────────────── 100,100

        LEFT = OFF SIDE    RIGHT = LEG SIDE
        (for right-handed batsman facing up)
```

**IMPORTANT:** Per the fieldingpatterns.webp reference, the orientation is:
- Bowler at the top, batsman at the bottom (batsman faces upward toward bowler)
- Off-side is to the left of the batsman (viewer's left)
- Leg-side is to the right of the batsman (viewer's right)

### Zone Mapping Logic

```typescript
// engine/fieldMapping.ts

interface PolarPosition {
  angle: number;    // 0-360 degrees, 0 = straight toward bowler
  distance: number; // 0-1 normalized (0 = pitch center, 1 = boundary)
}

function cartesianToPolar(x: number, y: number): PolarPosition {
  // Center of the field (pitch center)
  const cx = 50, cy = 50;
  const dx = x - cx;
  const dy = cy - y; // invert Y so "toward bowler" = positive

  const distance = Math.sqrt(dx * dx + dy * dy) / 50; // normalize to 0-1
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);   // 0 = toward bowler
  if (angle < 0) angle += 360;

  return { angle, distance };
}

function getFieldZone(x: number, y: number): FieldZone {
  const { angle, distance } = cartesianToPolar(x, y);
  const isInner = distance < 0.55; // ~30-yard circle

  // Angle sectors (from batsman's perspective, 0 = straight down the ground toward bowler)
  // 0-45° and 315-360°: Straight (long off / long on region)
  // 45-135°: Off side (cover, point)
  // 135-225°: Behind the batsman (third man, fine leg)
  // 225-315°: Leg side (mid-wicket, square leg)

  if (angle >= 315 || angle < 45) {
    return isInner ? 'straight_inner' : 'straight_outer';
  } else if (angle >= 45 && angle < 135) {
    // Off side (left from batsman's perspective)
    return isInner ? 'off_inner' : 'off_outer';
  } else if (angle >= 135 && angle < 225) {
    // Behind the batsman
    return isInner ? 'behind_inner' : 'behind_outer';
  } else {
    // Leg side (right from batsman's perspective)
    return isInner ? 'leg_inner' : 'leg_outer';
  }
}
```

### Named Position Labels

Map each fielder's polar position to the nearest standard cricket position name for display. This is cosmetic — the engine uses zones, not names.

```typescript
const NAMED_POSITIONS: { name: string; angle: number; distance: number }[] = [
  { name: "Mid Off",            angle: 350, distance: 0.45 },
  { name: "Mid On",             angle: 10,  distance: 0.45 },
  { name: "Long Off",           angle: 345, distance: 0.85 },
  { name: "Long On",            angle: 15,  distance: 0.85 },
  { name: "Cover",              angle: 310, distance: 0.45 },
  { name: "Extra Cover",        angle: 320, distance: 0.55 },
  { name: "Deep Cover",         angle: 310, distance: 0.85 },
  { name: "Point",              angle: 270, distance: 0.45 },
  { name: "Deep Point",         angle: 270, distance: 0.85 },
  { name: "Gully",              angle: 240, distance: 0.35 },
  { name: "Third Man",          angle: 220, distance: 0.85 },
  { name: "Slip",               angle: 210, distance: 0.20 },
  { name: "Short Fine Leg",     angle: 160, distance: 0.25 },
  { name: "Fine Leg",           angle: 160, distance: 0.85 },
  { name: "Square Leg",         angle: 90,  distance: 0.45 },
  { name: "Deep Square Leg",    angle: 90,  distance: 0.85 },
  { name: "Mid-Wicket",         angle: 50,  distance: 0.45 },
  { name: "Deep Mid-Wicket",    angle: 50,  distance: 0.85 },
  { name: "Sweeper",            angle: 70,  distance: 0.90 },
  { name: "Short Leg",          angle: 130, distance: 0.15 },
  { name: "Leg Gully",          angle: 120, distance: 0.35 },
  { name: "Silly Point",        angle: 250, distance: 0.12 },
  { name: "Silly Mid On",       angle: 30,  distance: 0.12 },
  { name: "Silly Mid Off",      angle: 330, distance: 0.12 },
  { name: "Straight Hit",       angle: 180, distance: 0.90 },
  // ... more as needed
];

function getNearestPositionLabel(x: number, y: number): string {
  const pos = cartesianToPolar(x, y);
  let bestName = "Fielder";
  let bestDist = Infinity;

  for (const np of NAMED_POSITIONS) {
    const angleDiff = Math.min(
      Math.abs(pos.angle - np.angle),
      360 - Math.abs(pos.angle - np.angle)
    );
    const distDiff = Math.abs(pos.distance - np.distance);
    const score = angleDiff / 90 + distDiff; // weighted composite
    if (score < bestDist) {
      bestDist = score;
      bestName = np.name;
    }
  }
  return bestName;
}
```

### Within-Zone Variance

The zone is used for broad calculations, but the **exact polar position** within that zone adds variance to outcome probabilities. A fielder at wide long-on (angle 30°, deep) covers different gaps than one at straight long-on (angle 5°, deep), even though both are in `straight_outer`.

```typescript
// Used during outcome resolution
function getZoneCoverage(fielders: Fielder[], targetAngle: number, targetDistance: number): number {
  // Returns 0-1 indicating how well the fielders cover the shot trajectory
  let coverage = 0;
  for (const f of fielders) {
    const fPolar = cartesianToPolar(f.position.x, f.position.y);
    const angleDiff = Math.min(
      Math.abs(fPolar.angle - targetAngle),
      360 - Math.abs(fPolar.angle - targetAngle)
    );
    const distDiff = Math.abs(fPolar.distance - targetDistance);

    // A fielder within ~20° and similar depth covers the shot well
    if (angleDiff < 30 && distDiff < 0.25) {
      const proximity = 1 - (angleDiff / 30 + distDiff / 0.25) / 2;
      coverage = Math.max(coverage, proximity);
    }
  }
  return coverage; // 0 = gap wide open, 1 = fielder standing right there
}
```

---

## 4. AI Batsman Archetypes

Each archetype has a **shot preference matrix** and a **mental state model**.

```typescript
// engine/batsmanAI.ts

interface BatsmanProfile {
  archetype: BatsmanArchetype;
  name: string;

  // Shot selection weights (which zones the batsman targets)
  // Higher weight = more likely to hit there
  shotPreferences: Record<FieldZone, number>;

  // How the batsman reacts to pressure
  aggression: number;          // 0-1, base aggression level
  riskTolerance: number;       // 0-1, willingness to play risky shots
  spinVulnerability: number;   // 0-1, weakness against slower deliveries
  bounceVulnerability: number; // 0-1, weakness against short balls
  yorkerVulnerability: number; // 0-1, weakness against yorkers

  // What deliveries this batsman "looks for" (reads from field)
  fieldReadingAbility: number; // 0-1, how well they detect the trap
}

const BATSMAN_PROFILES: Record<BatsmanArchetype, BatsmanProfile> = {
  aggressive: {
    archetype: 'aggressive',
    name: 'Power Hitter',
    shotPreferences: {
      off_inner: 0.10, off_outer: 0.20,
      leg_inner: 0.10, leg_outer: 0.25,
      straight_inner: 0.05, straight_outer: 0.20,
      behind_inner: 0.05, behind_outer: 0.05,
    },
    aggression: 0.85,
    riskTolerance: 0.80,
    spinVulnerability: 0.50,
    bounceVulnerability: 0.30,
    yorkerVulnerability: 0.45,
    fieldReadingAbility: 0.60,
  },
  anchor: {
    archetype: 'anchor',
    name: 'The Wall',
    shotPreferences: {
      off_inner: 0.20, off_outer: 0.10,
      leg_inner: 0.25, leg_outer: 0.10,
      straight_inner: 0.15, straight_outer: 0.05,
      behind_inner: 0.10, behind_outer: 0.05,
    },
    aggression: 0.30,
    riskTolerance: 0.20,
    spinVulnerability: 0.25,
    bounceVulnerability: 0.35,
    yorkerVulnerability: 0.60,
    fieldReadingAbility: 0.80,
  },
  slogger: {
    archetype: 'slogger',
    name: 'The Slogger',
    shotPreferences: {
      off_inner: 0.05, off_outer: 0.15,
      leg_inner: 0.05, leg_outer: 0.35,
      straight_inner: 0.05, straight_outer: 0.25,
      behind_inner: 0.05, behind_outer: 0.05,
    },
    aggression: 0.95,
    riskTolerance: 0.90,
    spinVulnerability: 0.65,
    bounceVulnerability: 0.40,
    yorkerVulnerability: 0.35,
    fieldReadingAbility: 0.35,
  },
  accumulator: {
    archetype: 'accumulator',
    name: 'The Rotator',
    shotPreferences: {
      off_inner: 0.20, off_outer: 0.05,
      leg_inner: 0.25, leg_outer: 0.05,
      straight_inner: 0.20, straight_outer: 0.05,
      behind_inner: 0.15, behind_outer: 0.05,
    },
    aggression: 0.45,
    riskTolerance: 0.35,
    spinVulnerability: 0.40,
    bounceVulnerability: 0.55,
    yorkerVulnerability: 0.50,
    fieldReadingAbility: 0.70,
  },
};
```

### AI Mental State (What the Batsman "Expects")

The AI reads the field to form an expectation. This is where the bluff mechanic lives.

```typescript
function getAIExpectation(
  fielders: Fielder[],
  batsman: BatsmanProfile,
  matchPressure: number // 0-1, based on required run rate
): DeliveryType {
  // Count fielders in each zone
  const zoneCounts: Record<FieldZone, number> = {
    off_inner: 0, off_outer: 0,
    leg_inner: 0, leg_outer: 0,
    straight_inner: 0, straight_outer: 0,
    behind_inner: 0, behind_outer: 0,
  };
  for (const f of fielders) {
    zoneCounts[f.zone]++;
  }

  // Heuristic rules for what the field "signals"
  const signals: Record<DeliveryType, number> = {
    yorker: 0,
    bouncer: 0,
    slower_ball: 0,
    leg_cutter: 0,
    good_length: 0,
  };

  // Heavy leg-side field → expects short ball / bouncer
  const legSideCount = zoneCounts.leg_inner + zoneCounts.leg_outer;
  if (legSideCount >= 3) signals.bouncer += 0.40;

  // Deep fielders on both sides → expects full / yorker (death bowling setup)
  const deepCount = zoneCounts.off_outer + zoneCounts.leg_outer + zoneCounts.straight_outer + zoneCounts.behind_outer;
  if (deepCount >= 5) signals.yorker += 0.35;

  // Packed inner ring → expects slower ball / variation
  const innerCount = zoneCounts.off_inner + zoneCounts.leg_inner + zoneCounts.straight_inner + zoneCounts.behind_inner;
  if (innerCount >= 5) signals.slower_ball += 0.30;

  // Fine leg / third man set → expects leg cutter / back of a length
  if (zoneCounts.behind_outer >= 2) signals.leg_cutter += 0.25;

  // Strong off-side field → expects off-stump line
  const offSideCount = zoneCounts.off_inner + zoneCounts.off_outer;
  if (offSideCount >= 3) signals.good_length += 0.30;

  // Scale by batsman's field reading ability
  for (const key of Object.keys(signals) as DeliveryType[]) {
    signals[key] *= batsman.fieldReadingAbility;
  }

  // Add noise based on pressure (under pressure, batsmen misread more)
  const noise = matchPressure * 0.15;
  for (const key of Object.keys(signals) as DeliveryType[]) {
    signals[key] += (Math.random() - 0.5) * noise;
  }

  // Return highest signal as the AI's expectation
  return Object.entries(signals).sort((a, b) => b[1] - a[1])[0][0] as DeliveryType;
}
```

---

## 5. The Simulation Engine

### `calculateDeliveryOutcome()` — The Core Function

This is the heart of the game. Here's the full pseudocode with actual math.

```typescript
// engine/simulation.ts

interface DeliveryInput {
  type: DeliveryType;
  line: DeliveryLine;
  fielders: Fielder[];
  batsman: BatsmanProfile;
  batsmanConfidence: number;
  matchSituation: {
    runsNeeded: number;
    ballsRemaining: number;
    wicketsInHand: number;
  };
  rngSeed?: number; // for daily challenge determinism
}

interface DeliveryResult {
  outcome: BallResult;
  runsScored: number;
  isWicket: boolean;
  aiExpectation: DeliveryType;
  wasBluff: boolean;
  chaosEvent: ChaosEvent | null;
  shotDirection: { angle: number; distance: number }; // where the ball went (for animation)
  feedbackMessage: string;
  newBatsmanConfidence: number;
}

function calculateDeliveryOutcome(input: DeliveryInput): DeliveryResult {
  const { type, line, fielders, batsman, batsmanConfidence, matchSituation } = input;

  // ============================================================
  // STEP 1: Calculate Match Pressure (affects batsman behavior)
  // ============================================================
  const requiredRate = matchSituation.runsNeeded / Math.max(matchSituation.ballsRemaining, 1);
  const pressure = Math.min(requiredRate / 12, 1); // normalize: 12+ RPO = max pressure

  // ============================================================
  // STEP 2: AI Forms Expectation (reads the field)
  // ============================================================
  const aiExpectation = getAIExpectation(fielders, batsman, pressure);
  const wasBluff = (type !== aiExpectation);

  // ============================================================
  // STEP 3: Calculate Base Success Probability
  // ============================================================
  // "Success" here = batsman makes good contact / scores runs
  // Each delivery type has a base probability matrix

  const BASE_CONTACT: Record<DeliveryType, number> = {
    yorker:      0.35,  // hardest to score off
    bouncer:     0.45,  // moderate difficulty
    slower_ball: 0.50,  // relies on deception
    leg_cutter:  0.45,  // movement off the pitch
    good_length: 0.55,  // easiest to score off (least threatening)
  };

  let contactProb = BASE_CONTACT[type];

  // ============================================================
  // STEP 4: Apply Expectation Modifier (the bluff mechanic)
  // ============================================================
  if (!wasBluff) {
    // AI expected this delivery → batsman is pre-set for it
    contactProb += 0.20;
  } else {
    // AI was fooled → reaction penalty
    contactProb -= 0.30;
  }

  // ============================================================
  // STEP 5: Apply Batsman Archetype Modifiers
  // ============================================================

  // Vulnerability to delivery type
  const vulnerabilityMap: Record<DeliveryType, keyof BatsmanProfile> = {
    yorker:      'yorkerVulnerability',
    bouncer:     'bounceVulnerability',
    slower_ball: 'spinVulnerability',
    leg_cutter:  'spinVulnerability',
    good_length: 'yorkerVulnerability', // generic; good length is hard to exploit
  };
  const vulnerability = batsman[vulnerabilityMap[type]] as number;
  contactProb -= vulnerability * 0.15; // max -15% from vulnerability

  // Aggression boost under pressure
  if (pressure > 0.6) {
    contactProb += batsman.aggression * 0.10; // aggressive batsmen get more dangerous
    contactProb += batsman.riskTolerance * 0.05; // but also more reckless (wicket chance goes up too)
  }

  // Confidence modifier
  const confidenceMod = (batsmanConfidence - 50) / 500; // -0.1 to +0.1
  contactProb += confidenceMod;

  // Clamp
  contactProb = Math.max(0.05, Math.min(0.90, contactProb));

  // ============================================================
  // STEP 6: Determine Shot Direction (where the batsman tries to hit)
  // ============================================================
  const shotZone = chooseShotZone(batsman, type, line, pressure);
  const shotAngle = shotZone.angle + (Math.random() - 0.5) * 20; // ±10° variance
  const shotDistance = shotZone.distance;

  // ============================================================
  // STEP 7: Check Field Coverage at Shot Destination
  // ============================================================
  const coverage = getZoneCoverage(fielders, shotAngle, shotDistance);

  // ============================================================
  // STEP 8: Roll for Outcome
  // ============================================================
  const roll = seededRandom(input.rngSeed); // 0-1

  let outcome: BallResult;
  let runsScored: number;
  let isWicket = false;

  if (roll > contactProb) {
    // ------ MISS / POOR CONTACT ------
    const missRoll = seededRandom();

    // Wicket chance scales with delivery quality and batsman recklessness
    const wicketChance = (1 - contactProb) * 0.40 + (pressure > 0.6 ? batsman.riskTolerance * 0.15 : 0);

    if (missRoll < wicketChance) {
      outcome = 'wicket';
      runsScored = 0;
      isWicket = true;
    } else {
      outcome = 'dot';
      runsScored = 0;
    }
  } else {
    // ------ CONTACT MADE ------
    if (coverage > 0.75) {
      // Fielder is right there
      const fieldStopRoll = seededRandom();
      if (fieldStopRoll < coverage * 0.8) {
        outcome = 'dot'; // fielded cleanly
        runsScored = 0;
      } else if (fieldStopRoll < coverage * 0.9) {
        outcome = 'single';
        runsScored = 1;
      } else {
        outcome = 'two';
        runsScored = 2;
      }
    } else if (coverage > 0.4) {
      // Fielder has to move
      const runRoll = seededRandom();
      if (runRoll < 0.25) {
        outcome = 'dot';
        runsScored = 0;
      } else if (runRoll < 0.55) {
        outcome = 'single';
        runsScored = 1;
      } else if (runRoll < 0.80) {
        outcome = 'two';
        runsScored = 2;
      } else {
        outcome = 'four';
        runsScored = 4;
      }
    } else {
      // GAP — no fielder covering the shot
      const gapRoll = seededRandom();
      const boundaryProb = 0.30 + batsman.aggression * 0.25 + (shotDistance > 0.8 ? 0.15 : 0);

      if (gapRoll < boundaryProb * 0.4) {
        outcome = 'six';
        runsScored = 6;
      } else if (gapRoll < boundaryProb) {
        outcome = 'four';
        runsScored = 4;
      } else if (gapRoll < boundaryProb + 0.25) {
        outcome = 'two';
        runsScored = 2;
      } else if (gapRoll < boundaryProb + 0.50) {
        outcome = 'three';
        runsScored = 3;
      } else {
        outcome = 'single';
        runsScored = 1;
      }
    }
  }

  // ============================================================
  // STEP 9: Chaos RNG (1-2% per legal delivery)
  // ============================================================
  let chaosEvent: ChaosEvent | null = null;
  const chaosRoll = seededRandom();

  if (chaosRoll < 0.02) { // 2% chance
    const chaosType = seededRandom();
    if (isWicket && chaosType < 0.4) {
      // Dropped catch — reverses a wicket
      chaosEvent = 'dropped_catch';
      isWicket = false;
      outcome = 'dot';
      runsScored = 0;
    } else if (!isWicket && chaosType < 0.5) {
      // Overthrow — adds runs
      chaosEvent = 'overthrow';
      runsScored += 1 + Math.floor(seededRandom() * 2); // +1 or +2
      outcome = runsScored >= 4 ? 'four' : outcome;
    } else if (chaosType < 0.7) {
      // Misfield — dot becomes runs
      chaosEvent = 'misfield';
      if (runsScored === 0 && !isWicket) {
        runsScored = 1 + Math.floor(seededRandom() * 2);
        outcome = runsScored === 1 ? 'single' : 'two';
      }
    } else {
      // Stumping missed — near miss, no effect but dramatic
      chaosEvent = 'stumping_missed';
    }
  }

  // ============================================================
  // STEP 10: Generate Feedback Message
  // ============================================================
  const feedbackMessage = generateFeedback({
    type, line, aiExpectation, wasBluff,
    outcome, coverage, shotAngle, chaosEvent, batsman
  });

  // ============================================================
  // STEP 11: Update Batsman Confidence
  // ============================================================
  let newConfidence = batsmanConfidence;
  if (isWicket) {
    newConfidence = 0; // doesn't matter, batsman is out
  } else if (runsScored >= 4) {
    newConfidence = Math.min(100, newConfidence + 15);
  } else if (runsScored > 0) {
    newConfidence = Math.min(100, newConfidence + 5);
  } else {
    newConfidence = Math.max(0, newConfidence - 10); // dot ball lowers confidence
  }

  return {
    outcome, runsScored, isWicket,
    aiExpectation, wasBluff,
    chaosEvent,
    shotDirection: { angle: shotAngle, distance: shotDistance },
    feedbackMessage,
    newBatsmanConfidence: newConfidence,
  };
}
```

### Shot Zone Selection (where the batsman aims)

```typescript
function chooseShotZone(
  batsman: BatsmanProfile,
  deliveryType: DeliveryType,
  deliveryLine: DeliveryLine,
  pressure: number
): { angle: number; distance: number } {
  // The batsman picks a shot based on delivery type + line + their preferences

  // Delivery-line to natural shot mapping
  const LINE_ANGLES: Record<DeliveryLine, number[]> = {
    off:              [280, 300, 320],       // cover drive, square cut, point
    middle:           [0, 340, 20],          // straight drive, mid on/off
    leg:              [40, 60, 80],          // flick, pull, mid-wicket
    wide_outside_off: [260, 280, 300],       // slashing cuts
    wide_outside_leg: [60, 80, 100, 140],   // glances, fine leg
  };

  // Delivery-type to natural distance
  const TYPE_DISTANCE: Record<DeliveryType, number> = {
    yorker:      0.50,  // hard to get elevation, more ground shots
    bouncer:     0.85,  // pulls and hooks go deep
    slower_ball: 0.70,  // lofted or mistimed
    leg_cutter:  0.60,  // edges and deflections
    good_length: 0.65,  // drives
  };

  // Pick a base angle from the line options
  const angles = LINE_ANGLES[deliveryLine];
  const baseAngle = angles[Math.floor(seededRandom() * angles.length)];

  // Adjust distance based on aggression and pressure
  let distance = TYPE_DISTANCE[deliveryType];
  if (pressure > 0.6) {
    distance += batsman.aggression * 0.15; // go bigger under pressure
  }
  distance = Math.min(1.0, distance);

  return { angle: baseAngle, distance };
}
```

### Feedback Message Generator

```typescript
function generateFeedback(params: {
  type: DeliveryType;
  line: DeliveryLine;
  aiExpectation: DeliveryType;
  wasBluff: boolean;
  outcome: BallResult;
  coverage: number;
  shotAngle: number;
  chaosEvent: ChaosEvent | null;
  batsman: BatsmanProfile;
}): string {
  const { type, line, wasBluff, outcome, coverage, chaosEvent, batsman } = params;

  const parts: string[] = [];

  // Bluff feedback
  if (wasBluff) {
    parts.push(`The batsman was expecting a ${params.aiExpectation} but you bowled a ${type}. Deception bonus!`);
  } else {
    parts.push(`The batsman read the field correctly and was set for the ${type}.`);
  }

  // Coverage feedback
  if (outcome === 'four' || outcome === 'six') {
    if (coverage < 0.3) {
      const zoneName = angleToZoneName(params.shotAngle);
      parts.push(`No fielder covering ${zoneName} — the gap was wide open.`);
    } else {
      parts.push(`The fielder was close but couldn't cut it off.`);
    }
  } else if (outcome === 'dot' && coverage > 0.6) {
    parts.push(`Excellent field placement — the fielder was perfectly positioned.`);
  } else if (outcome === 'wicket') {
    parts.push(`The ${type} on ${line} stump was too good for the ${batsman.archetype} batsman.`);
  }

  // Chaos event feedback
  if (chaosEvent) {
    const CHAOS_MESSAGES: Record<ChaosEvent, string> = {
      dropped_catch: "But the fielder dropped the catch! A life for the batsman.",
      overthrow: "The throw from the deep goes wild — overthrow!",
      misfield: "A misfield in the ring lets them steal a run.",
      stumping_missed: "The keeper fumbled! Could have been a stumping.",
      umpire_error: "Questionable call by the umpire there.",
    };
    parts.push(CHAOS_MESSAGES[chaosEvent]);
  }

  return parts.join(' ');
}
```

---

## 6. Database Schema (Supabase)

### Table: `daily_challenges`

```sql
CREATE TABLE daily_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,              -- one challenge per day
  target_runs INT NOT NULL,               -- runs to defend
  total_balls INT NOT NULL DEFAULT 6,     -- always 6 for daily
  batsman_archetype TEXT NOT NULL,         -- 'aggressive' | 'anchor' | 'slogger' | 'accumulator'
  batsman_name TEXT NOT NULL,             -- display name for the scenario
  non_striker_archetype TEXT NOT NULL,
  non_striker_name TEXT NOT NULL,
  batsman_confidence INT NOT NULL DEFAULT 50,
  scenario_title TEXT NOT NULL,           -- e.g., "Defend 12 off 6 vs. Power Hitter"
  scenario_description TEXT,              -- flavor text
  rng_seed BIGINT NOT NULL,              -- deterministic seed for chaos events
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast daily lookup
CREATE INDEX idx_daily_challenges_date ON daily_challenges (date);
```

### Table: `leaderboard_entries`

```sql
CREATE TABLE leaderboard_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES daily_challenges(id) ON DELETE CASCADE,
  -- No user_id for now; will add FK to auth.users later
  display_name TEXT NOT NULL,
  runs_conceeded INT NOT NULL,
  wickets_taken INT NOT NULL,
  balls_used INT NOT NULL,
  result TEXT NOT NULL,                   -- 'won' | 'lost' | 'tied'
  score INT NOT NULL,                     -- computed ranking score
  emoji_summary TEXT NOT NULL,            -- the shareable emoji string
  ball_log JSONB NOT NULL,               -- full BallOutcome[] for replay
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for fetching today's leaderboard sorted by score
CREATE INDEX idx_leaderboard_challenge_score ON leaderboard_entries (challenge_id, score DESC);

-- Prevent spam: one entry per display_name per challenge
CREATE UNIQUE INDEX idx_leaderboard_unique_entry ON leaderboard_entries (challenge_id, display_name);
```

### Row Level Security (prep for auth)

```sql
-- For now, allow anonymous reads and inserts
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON daily_challenges FOR SELECT USING (true);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON leaderboard_entries FOR INSERT WITH CHECK (true);

-- When auth is added later, replace the insert policy:
-- CREATE POLICY "Authenticated insert" ON leaderboard_entries
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- And add a user_id column with FK to auth.users
```

### Ranking Score Formula

```typescript
// Higher score = better defense
function calculateScore(
  target: number,
  runsConceded: number,
  wicketsTaken: number,
  ballsUsed: number,
  totalBalls: number,
  result: 'won' | 'lost' | 'tied'
): number {
  let score = 0;

  // Base points for result
  if (result === 'won') score += 1000;
  if (result === 'tied') score += 500;

  // Bonus for runs saved (defending well)
  const runsSaved = target - runsConceded;
  score += runsSaved * 50;

  // Bonus per wicket taken
  score += wicketsTaken * 150;

  // Economy bonus (balls remaining if won)
  if (result === 'won') {
    const ballsRemaining = totalBalls - ballsUsed;
    score += ballsRemaining * 75;
  }

  return Math.max(0, score);
}
```

---

## 7. Shareable Results System

Generates a Wordle-style grid:

```typescript
function generateEmojiSummary(ballLog: BallOutcome[]): string {
  const header = `🏏 Death Over Challenge — ${new Date().toLocaleDateString()}\n`;

  const emojis = ballLog.map(ball => {
    if (ball.isWicket) return 'W';       // wicket
    if (ball.chaosEvent) return '⚡';     // chaos event
    if (ball.runsScored === 0) return '🟢'; // dot ball (good for bowler)
    if (ball.runsScored <= 2) return '🟡';  // 1-2 runs (okay)
    if (ball.runsScored <= 4) return '🔴';  // 4 runs (boundary)
    return '💥';                            // 6 runs
  });

  const grid = emojis.join(' ');
  const result = ballLog[ballLog.length - 1]; // determine from game state, simplified here

  return `${header}${grid}\n\n#DeathOverChallenge`;
}

// Example output:
// 🏏 Death Over Challenge — 3/30/2026
// 🟢 🔴 🟢 🟡 W 🟢
//
// #DeathOverChallenge
```

---

## 8. Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with fonts/metadata
│   ├── page.tsx                    # Landing / mode selection
│   ├── play/
│   │   ├── page.tsx                # Custom game setup
│   │   └── [id]/page.tsx           # Active game view
│   ├── daily/
│   │   └── page.tsx                # Daily challenge (fetches from Supabase)
│   ├── results/
│   │   └── page.tsx                # Post-game results + share
│   └── leaderboard/
│       └── page.tsx                # Global leaderboard
│
├── components/
│   ├── field/
│   │   ├── CricketField.tsx        # Main SVG field component
│   │   ├── FielderToken.tsx        # Draggable fielder dot
│   │   ├── PitchStrip.tsx          # The pitch/wicket in the center
│   │   └── ZoneOverlay.tsx         # Optional debug: show zone boundaries
│   ├── delivery/
│   │   ├── DeliverySelector.tsx    # Type + Line selector panel
│   │   └── BowlButton.tsx         # "Bowl Delivery" action button
│   ├── scoreboard/
│   │   ├── MatchSituation.tsx      # Runs needed, balls left, wickets
│   │   ├── BatsmanCard.tsx         # Current batsman info + confidence bar
│   │   └── BallTimeline.tsx        # Visual ball-by-ball history
│   ├── feedback/
│   │   ├── FeedbackPanel.tsx       # Post-ball tactical explanation
│   │   └── ChaosAlert.tsx          # Dramatic chaos event popup
│   ├── results/
│   │   ├── ResultScreen.tsx        # Win/lose screen
│   │   └── ShareButton.tsx         # Copy emoji grid to clipboard
│   └── ui/
│       └── ...                     # Shared primitives (buttons, cards, etc.)
│
├── engine/
│   ├── simulation.ts               # calculateDeliveryOutcome()
│   ├── batsmanAI.ts                # AI expectation + archetype profiles
│   ├── fieldMapping.ts             # Coordinate → zone mapping
│   ├── scoring.ts                  # Leaderboard score calculation
│   ├── feedback.ts                 # Feedback message generation
│   └── rng.ts                      # Seeded random number generator
│
├── store/
│   └── gameStore.ts                # Zustand store (GameState + actions)
│
├── lib/
│   ├── supabase.ts                 # Supabase client init
│   └── daily.ts                    # Fetch/cache daily challenge
│
└── types/
    └── game.ts                     # All TypeScript interfaces/types
```

---

## 9. Development Roadmap

### Sprint 1: The Engine & Field (Foundation)

**Goal:** A working simulation engine and interactive field — no Supabase, no styling polish. Prove the core loop works.

**Tasks:**

1. **Project setup**
   - `npx create-next-app@latest` with App Router, TypeScript, Tailwind
   - Install Zustand, set up the project structure above

2. **Types & constants** (`types/game.ts`)
   - Define every interface from Section 2
   - Define batsman profiles from Section 4

3. **Seeded RNG** (`engine/rng.ts`)
   - Implement a simple mulberry32 or similar PRNG so daily challenges are deterministic

4. **Field mapping** (`engine/fieldMapping.ts`)
   - `cartesianToPolar()`, `getFieldZone()`, `getNearestPositionLabel()`, `getZoneCoverage()`
   - Write unit tests: place a fielder at known coordinates, assert correct zone and label

5. **AI Expectation** (`engine/batsmanAI.ts`)
   - `getAIExpectation()` — given fielders + archetype, return expected delivery
   - Unit test: 4 deep leg-side fielders → should expect bouncer

6. **Simulation engine** (`engine/simulation.ts`)
   - Full `calculateDeliveryOutcome()` implementation
   - Unit test with fixed seed: same input → same output

7. **Zustand store** (`store/gameStore.ts`)
   - `GameState` + actions: `placeFielder()`, `setDelivery()`, `bowlDelivery()`, `resetGame()`
   - `bowlDelivery()` calls the engine, pushes to `ballLog`, updates match state

8. **Basic field UI** (`components/field/CricketField.tsx`)
   - SVG circle with pitch rectangle in center
   - 9 draggable dots (HTML5 drag or pointer events — no library needed yet)
   - Show zone label on hover

9. **Basic delivery selector** (`components/delivery/DeliverySelector.tsx`)
   - Button groups for Type and Line
   - "Bowl" button that triggers `bowlDelivery()` in the store

10. **Minimal game page** (`app/play/page.tsx`)
    - Field + delivery selector + text-only scoreboard
    - Play through a 6-ball over against a hardcoded aggressive batsman
    - Console.log the ball log at the end

**Deliverable:** You can play a full over in the browser. It won't look pretty, but the math works and you can verify outcomes make sense.

---

### Sprint 2: Game UI & Feel (Make It Look Real)

**Goal:** Transform the functional prototype into the dark-themed, polished UI from the screenshot reference. Add feedback and ball history.

**Tasks:**

1. **Dark theme & layout**
   - Global dark background, neon accent colors (cyan/blue dots, dark field green)
   - Layout: field center, delivery panel bottom-left, scoreboard top-right, feedback bottom-right

2. **Field polish**
   - Smooth SVG field with gradient green fill, boundary ring, 30-yard circle
   - Fielder dots: glow effect, snap animation when placed
   - Pitch strip with crease markings
   - Zone boundaries as subtle dashed lines (toggle-able)

3. **Scoreboard component** (`MatchSituation.tsx`)
   - Large run/ball display (like "18 RNS / 6 BLS" from the screenshot)
   - Required run rate indicator
   - Color-coded urgency (green → yellow → red)

4. **Batsman card** (`BatsmanCard.tsx`)
   - Name, archetype icon, confidence bar (animated)
   - "Batting style" indicator

5. **Ball timeline** (`BallTimeline.tsx`)
   - Horizontal strip showing each ball: color-coded circles (dot=green, 1-2=yellow, 4=red, 6=purple, W=skull)
   - Click a ball to see its feedback

6. **Feedback panel** (`FeedbackPanel.tsx`)
   - Animated text reveal after each delivery
   - Shows: what AI expected, whether you bluffed, why runs were scored/saved

7. **Chaos event alerts** (`ChaosAlert.tsx`)
   - Full-screen flash overlay for dramatic events (dropped catch, overthrow)
   - 1-2 second animation, then dismisses

8. **Ball animation**
   - After "Bowl", show a brief animation on the field: a line/arc from pitcher to the shot direction
   - Fielder dot highlights if they're involved in the stop
   - Use Framer Motion for enter/exit animations on components (keep it lightweight)

9. **Result screen** (`ResultScreen.tsx`)
   - Win: celebration animation, final score
   - Lose: "They chased it down" with the ball log
   - Tied: dramatic "TIED!" display

**Deliverable:** A visually complete single-player game you'd be proud to show in a college app.

---

### Sprint 3: Daily Challenge & Sharing (The Viral Loop)

**Goal:** Add Supabase integration, daily challenge mode, leaderboard, and shareable results.

**Tasks:**

1. **Supabase setup**
   - Create project, run the SQL from Section 6
   - Set up RLS policies
   - Install `@supabase/supabase-js`, create client in `lib/supabase.ts`

2. **Seed daily challenges**
   - Write a script or Supabase Edge Function that generates the next 30 days of challenges
   - Each challenge: random target (8-20 runs), random batsman archetype, unique RNG seed
   - Or: manually insert 30 rows to start

3. **Daily challenge page** (`app/daily/page.tsx`)
   - Fetch today's challenge from Supabase by date
   - Initialize game store with challenge config
   - Lock the RNG seed so chaos events are deterministic (same for all players)
   - Check localStorage: if already played today, show results instead

4. **Leaderboard submission**
   - On game end, prompt for display name (store in localStorage for next time)
   - Submit score, emoji summary, and ball log to `leaderboard_entries`
   - Validate on the server: prevent duplicate entries per challenge per name

5. **Leaderboard page** (`app/leaderboard/page.tsx`)
   - Fetch top 50 entries for today's challenge
   - Show: rank, name, result, score, emoji summary
   - Tab to switch between "Today" and "All Time"

6. **Share button** (`ShareButton.tsx`)
   - Generate emoji grid from ball log
   - Copy to clipboard with `navigator.clipboard.writeText()`
   - Show "Copied!" toast

7. **Landing page** (`app/page.tsx`)
   - "Daily Challenge" button (primary, prominent)
   - "Custom Game" button (secondary)
   - Today's challenge teaser: "Defend 14 off 6 vs. The Slogger"
   - Mini leaderboard preview

8. **localStorage persistence**
   - Save daily challenge completion state
   - Save display name for leaderboard
   - Save custom game history (last 5 games)

**Deliverable:** A fully functional daily game with social sharing — the core viral loop.

---

### Sprint 4: Polish, Multi-Over & Edge Cases (Ship It)

**Goal:** Multi-over custom mode, bug fixes, accessibility, performance, and deployment hardening.

**Tasks:**

1. **Multi-over custom games**
   - Game setup page: choose target runs (10-50), overs (1-5), batsman archetype
   - Handle over transitions: new ball, batsman rotation on odd runs
   - "Batting partnership" — track non-striker, swap on singles/threes

2. **Field presets**
   - Save/load field configurations (e.g., "Death Yorker Setup", "Bouncer Trap")
   - 3-4 built-in presets for new players
   - Store custom presets in localStorage

3. **Tutorial / onboarding**
   - First-time user: guided 3-ball tutorial
   - Explain the bluff mechanic: "The batsman reads your field — surprise them!"
   - Tooltip hints on the field and delivery selector

4. **Edge cases & game logic fixes**
   - Wide/no-ball handling (add to delivery outcomes, 5% chance on extreme lines)
   - Last-ball scenarios: automatic tie/win detection
   - Wicket → new batsman (different archetype, confidence reset to 50)
   - All out detection (10 wickets, though unlikely in 1 over)

5. **Accessibility**
   - Keyboard navigation for fielder placement (arrow keys to move selected fielder)
   - Screen reader labels on SVG elements
   - Sufficient color contrast on the dark theme

6. **Performance**
   - Lazy load the leaderboard page
   - Debounce fielder drag updates
   - Memoize zone calculations

7. **SEO & metadata**
   - Open Graph tags for shared links
   - Dynamic OG image: "I defended 14 off 6! Can you?"

8. **Deploy & test**
   - Vercel deployment with environment variables for Supabase
   - Test daily challenge flow end-to-end
   - Test on mobile (responsive field scaling)
   - Lighthouse audit: aim for 90+ performance

**Deliverable:** A production-ready MVP you can put on your college application with a live URL.

---

## Key Technical Decisions Summary

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| State management | Zustand | Surgical re-renders, testable outside React, minimal boilerplate |
| Field rendering | SVG | Resolution-independent, easy hit testing, lightweight for 2D |
| Drag & drop | Pointer events (native) | No library needed for 9 dots; add Framer Motion only for animations |
| Simulation engine | Pure functions | Testable, deterministic with seeded RNG, no side effects |
| Daily challenge RNG | Seeded PRNG (mulberry32) | Same seed = same chaos events for all players = fair leaderboard |
| Database | Supabase (2 tables) | Minimal schema, free tier, easy auth migration later |
| Animations | Framer Motion (Sprint 2+) | Only for UI transitions, not core gameplay |

---

## Next Step

Start Sprint 1. First file to create: `types/game.ts` with all the type definitions, then `engine/rng.ts` for the seeded random number generator. The engine is the heart of the game — get it right first, UI second.
