/**
 * Self-check for the commentary/tracer invariant.
 *
 * The bug this exists to catch: feedback.ts naming one fielder while the ball
 * tracer draws a line to a different one. Run with:
 *
 *   node engine/dismissal.check.mjs
 *
 * No test framework — Node 24 strips the TypeScript itself; the resolve hook
 * below is only here to teach it the "@/" path alias from tsconfig.
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      return next(pathToFileURL(join(ROOT, spec.slice(2)) + ".ts").href, ctx);
    }
    return next(spec, ctx);
  },
});

const { calculateDeliveryOutcome } = await import("@/engine/simulation");
const { cartesianToPolar, recomputeFielderMeta, mirrorAngle, mirrorFielders } =
  await import("@/engine/fieldMapping");
const { classifyDismissal, KEEPER_ANGLE } = await import("@/engine/dismissal");
const { BATSMAN_PROFILES } = await import("@/engine/batsmanAI");
const { BOWLERS, getBowler } = await import("@/engine/bowlers");

const PACE = getBowler("death_specialist");
const SPIN = getBowler("mystery_spinner");

// Same nine positions gameStore.buildDefaultFielders() lays out.
const FIELDERS = recomputeFielderMeta(
  [
    { x: 29, y: 12 }, { x: 76, y: 16 }, { x: 30, y: 46 },
    { x: 70, y: 42 }, { x: 33, y: 75 }, { x: 63, y: 77 },
    { x: 35, y: 55 }, { x: 79, y: 65 }, { x: 55, y: 61 },
  ].map((position, i) => ({ id: i + 1, position, zone: "straight_inner", label: "" }))
);

/** Must match feedback.ts getNearestFielderData() exactly, tie-breaking included. */
function nearestFielderLabel(targetAngle, fielders = FIELDERS) {
  let name = "fielder";
  let minDiff = Infinity;
  for (const f of fielders) {
    const { angle } = cartesianToPolar(f.position.x, f.position.y);
    const diff = Math.min(Math.abs(angle - targetAngle), 360 - Math.abs(angle - targetAngle));
    if (diff < minDiff) {
      minDiff = diff;
      name = f.label || "fielder";
    }
  }
  return name;
}

/** Centre of the WK marker rect drawn in CricketField.tsx:230 (x 48.5, y 30.5, 3x3) */
const WK = { cx: 50, cy: 32 };

/** Exactly the polar→SVG conversion BallTracer.tsx:31-35 uses to place the ball. */
function tracerEndpoint({ angle, distance }) {
  const rad = (angle * Math.PI) / 180;
  const d = distance * 47; // BOUNDARY_R
  return { x: 50 + Math.sin(rad) * d, y: 50 + Math.cos(rad) * d };
}

const LENGTHS = ["yorker", "full", "good_length", "short", "bouncer"];
const LINES = ["wide_outside_off", "off", "middle", "leg", "wide_outside_leg"];
const HANDS = ["right", "left"];

// Commentary is always batsman-relative, so for a left-hander the fielder the
// narrative names is the one in MIRRORED space. Same set, mirrored labels.
const MIRRORED_FIELDERS = mirrorFielders(FIELDERS);

let wickets = 0, caughtInField = 0, caughtBehind = 0, spectacular = 0, notOut = 0, stumpings = 0;

for (const length of LENGTHS) {
  for (const line of LINES) {
   for (const hand of HANDS) {
    for (const bowler of BOWLERS) {
    for (let seed = 1; seed <= 200; seed++) {
      const out = calculateDeliveryOutcome({
        ballNumber: 1,
        deliveryLength: length,
        deliveryVariation: bowler.variations[0],
        deliveryLine: line,
        fielders: FIELDERS,
        batsman: BATSMAN_PROFILES.aggressive,
        bowler,
        battingHand: hand,
        batsmanConfidence: 60,
        matchSituation: { runsNeeded: 15, ballsRemaining: 6, wicketsInHand: 7 },
        baseSeed: seed,
        rngCallCount: seed,
        lastVariation: null,
        recentYorkerCount: 0,
        isFreeHit: false,
      });

      const isLeft = hand === "left";
      // Angle as the commentary sees it, and the fielder set it names from.
      const narrativeAngle = isLeft ? mirrorAngle(out.shotDirection.angle) : out.shotDirection.angle;
      const narrativeFielders = isLeft ? MIRRORED_FIELDERS : FIELDERS;

      const where = `${length}/${line}/${hand}/${bowler.id} seed=${seed}`;
      const msg = out.feedbackMessage;

      if (!out.isWicket) { notOut++; continue; }
      wickets++;

      const { kind } = classifyDismissal(length, line, bowler.type);
      const isSpectacular = out.chaosEvent === "spectacular_catch";

      // 1. Bowled/LBW/stumped never claim a catch. A stumping still puts the
      //    ball in the keeper's gloves, so assert on the rendered endpoint.
      if (!out.isCaught) {
        assert.match(msg, /[Bb]owled|LBW|[Ss]tumped/,
          `${where}: non-catch wicket without a bowled/LBW/stumped narrative — "${msg}"`);
        if (kind === "stumped") {
          stumpings++;
          assert.match(msg, /[Ss]tumped/, `${where}: stumping without a stumped narrative — "${msg}"`);
          const { x, y } = tracerEndpoint(out.shotDirection);
          const off = Math.hypot(x - WK.cx, y - WK.cy);
          assert.ok(off < 0.25, `${where}: stumping but tracer ends ${off.toFixed(2)} units off the WK marker`);
        }
        continue;
      }

      // 2. Caught behind goes to the keeper, not to an outfielder. Assert on the
      //    rendered endpoint, not just the angle — this path had no coordinates
      //    at all before, so nothing had ever landed the ball on the WK marker.
      if (kind === "caught_behind" && !isSpectacular) {
        caughtBehind++;
        assert.equal(out.shotDirection.angle, KEEPER_ANGLE, `${where}: caught behind but tracer points elsewhere`);
        assert.match(msg, /[Cc]aught behind/, `${where}: caught behind narrative missing — "${msg}"`);
        const { x, y } = tracerEndpoint(out.shotDirection);
        const off = Math.hypot(x - WK.cx, y - WK.cy);
        assert.ok(off < 0.25, `${where}: tracer ends at (${x.toFixed(2)}, ${y.toFixed(2)}), ${off.toFixed(2)} units off the WK marker centre (${WK.cx}, ${WK.cy})`);
        continue;
      }

      // 3. THE INVARIANT: the fielder named in the commentary is the fielder the
      //    tracer's line ends on. This is what the Third Man/midwicket bug broke.
      if (isSpectacular) spectacular++; else caughtInField++;
      const named = nearestFielderLabel(narrativeAngle, narrativeFielders);
      assert.ok(
        msg.includes(named),
        `${where}: tracer points at ${named} (${narrativeAngle.toFixed(1)}°) but commentary says — "${msg}"`
      );

      // 4. A catch on the rope was a middled six, never an edge or a mistimed poke.
      if (isSpectacular) {
        assert.doesNotMatch(msg, /edge|fended|[Mm]istimed|[Jj]ammed/,
          `${where}: rope catch described as a mishit — "${msg}"`);
      }
    }
    }
   }
  }
}

assert.ok(caughtInField > 0 && caughtBehind > 0 && spectacular > 0 && stumpings > 0,
  "sample never exercised all dismissal types (incl. stumping)");
console.log(
  `ok — ${wickets} wickets over ${wickets + notOut} deliveries ` +
  `(${caughtInField} caught in field, ${caughtBehind} caught behind, ${spectacular} on the rope, ${stumpings} stumped)`
);

// ============================================================
// Mirror symmetry — the invariant that makes left-handers safe.
//
// A left-hander facing a mirrored field is the exact reflection of a
// right-hander facing the original field. Same seed → identical runs, identical
// wicket, and shot angles that are mirror images. If any table is consulted in
// the wrong coordinate space, this fails immediately.
// ============================================================
let mirrored = 0;

for (const length of LENGTHS) {
  for (const line of LINES) {
    for (let seed = 1; seed <= 300; seed++) {
      const base = {
        ballNumber: 1,
        deliveryLength: length,
        deliveryVariation: "pace",
        deliveryLine: line,
        batsman: BATSMAN_PROFILES.aggressive,
        bowler: PACE,
        batsmanConfidence: 60,
        matchSituation: { runsNeeded: 15, ballsRemaining: 6, wicketsInHand: 7 },
        baseSeed: seed,
        rngCallCount: seed,
        lastVariation: null,
        recentYorkerCount: 0,
        isFreeHit: false,
      };

      const rh = calculateDeliveryOutcome({ ...base, fielders: FIELDERS, battingHand: "right" });
      // Mirrored field + left-hander = the same problem reflected.
      const lh = calculateDeliveryOutcome({ ...base, fielders: MIRRORED_FIELDERS, battingHand: "left" });

      const where = `${length}/${line} seed=${seed}`;
      assert.equal(lh.runsScored, rh.runsScored, `${where}: mirrored runs diverged`);
      assert.equal(lh.isWicket, rh.isWicket, `${where}: mirrored wicket diverged`);
      assert.equal(lh.result, rh.result, `${where}: mirrored result diverged`);
      assert.equal(lh.feedbackMessage, rh.feedbackMessage, `${where}: mirrored commentary diverged`);

      const expected = mirrorAngle(rh.shotDirection.angle);
      const diff = Math.min(
        Math.abs(lh.shotDirection.angle - expected),
        360 - Math.abs(lh.shotDirection.angle - expected)
      );
      assert.ok(
        diff < 1e-9,
        `${where}: LH angle ${lh.shotDirection.angle.toFixed(3)}° is not the mirror of RH ${rh.shotDirection.angle.toFixed(3)}° (expected ${expected.toFixed(3)}°)`
      );
      mirrored++;
    }
  }
}

console.log(`ok — ${mirrored} deliveries are exact left/right mirror images`);

// ============================================================
// Spin coherence — the spinner must never be described in pace vocabulary.
//
// Every length name, shot verb and dismissal narrative has a pace-flavoured
// default somewhere in feedback.ts. This sweep is what catches the one string
// that didn't get a spin branch.
// ============================================================
const PACE_ONLY = /yorker|bouncer|short-pitched|swing|seam|nipped|pace|hooked|pulled|upper cut/i;
let spinBalls = 0;

for (const length of LENGTHS) {
  for (const line of LINES) {
    for (const variation of SPIN.variations) {
      for (const hand of HANDS) {
        for (let seed = 1; seed <= 60; seed++) {
          const out = calculateDeliveryOutcome({
            ballNumber: 1,
            deliveryLength: length,
            deliveryVariation: variation,
            deliveryLine: line,
            fielders: FIELDERS,
            batsman: BATSMAN_PROFILES.aggressive,
            bowler: SPIN,
            battingHand: hand,
            batsmanConfidence: 60,
            matchSituation: { runsNeeded: 15, ballsRemaining: 6, wicketsInHand: 7 },
            baseSeed: seed,
            rngCallCount: seed,
            lastVariation: null,
            recentYorkerCount: 0,
            isFreeHit: false,
          });

          assert.doesNotMatch(
            out.feedbackMessage,
            PACE_ONLY,
            `${length}/${line}/${variation}/${hand} seed=${seed}: spinner described in pace terms — "${out.feedbackMessage}"`
          );

          // The batsman must never be shown expecting a ball this bowler can't bowl.
          assert.ok(
            SPIN.variations.includes(out.aiExpectation.variation),
            `${length}/${line}/${variation} seed=${seed}: batsman expected "${out.aiExpectation.variation}" from a spinner`
          );
          spinBalls++;
        }
      }
    }
  }
}

console.log(`ok — ${spinBalls} spin deliveries free of pace vocabulary`);
