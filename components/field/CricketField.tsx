"use client";

import React, { useRef, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import FielderToken from "./FielderToken";
import PitchStrip from "./PitchStrip";
import BallTracer from "./BallTracer";
import type { BallOutcome, BallResult } from "@/types/game";

/**
 * Find the nearest fielder to the shot endpoint.
 * Only returns a fielder for non-boundary, non-wicket results (dot/single/two/three).
 */
function findNearestFielderId(outcome: BallOutcome): number | null {
  const { shotDirection, result, isWicket, fieldSnapshot } = outcome;

  // Highlight for stops and caught wickets — not boundaries or non-catch wickets
  const stoppableResults: BallResult[] = ["dot", "single", "two", "three"];
  const isCatchWicket = isWicket && outcome.isCaught;
  if (!isCatchWicket && (isWicket || !stoppableResults.includes(result))) return null;

  // Endpoint uses same polar→cartesian as BallTracer (center at 50,50, radius 47)
  const POLAR_CX = 50, POLAR_CY = 50, BOUNDARY_R = 47;
  const angleRad = (shotDirection.angle * Math.PI) / 180;
  const dist = shotDirection.distance * BOUNDARY_R;
  const endX = POLAR_CX + Math.sin(angleRad) * dist;
  const endY = POLAR_CY + Math.cos(angleRad) * dist;

  let bestId: number | null = null;
  let bestDist = 18; // max radius threshold — don't highlight if too far

  for (const f of fieldSnapshot) {
    const dx = f.position.x - endX;
    const dy = f.position.y - endY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      bestId = f.id;
    }
  }

  return bestId;
}

interface CricketFieldProps {
  lastOutcome?: BallOutcome | null;
  isAnimating: boolean;
  onAnimationComplete: () => void;
}

export default function CricketField({
  lastOutcome,
  isAnimating,
  onAnimationComplete,
}: CricketFieldProps) {
  const fielders = useGameStore((s) => s.field.fielders);
  const battingHand = useGameStore((s) => s.batsman.hand);
  const placeFielder = useGameStore((s) => s.placeFielder);
  const isComplete = useGameStore((s) => s.match.isComplete);

  // Count fielders outside the 30-yard circle (max 5 allowed)
  const outerCount = fielders.filter((f) => {
    const dx = f.position.x - 50, dy = f.position.y - 50;
    return Math.sqrt(dx * dx + dy * dy) > 27.5;
  }).length;
  const atLimit = outerCount >= 5;

  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  // Determine which fielder to highlight during animation
  const highlightedFielderId = (isAnimating && lastOutcome)
    ? findNearestFielderId(lastOutcome)
    : null;

  // Convert screen coordinates to SVG 0-100 space
  const toSvgCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 50, y: 50 };
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (draggingId === null || isComplete) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const { x, y } = toSvgCoords(e.clientX, e.clientY);
      rafRef.current = requestAnimationFrame(() => {
        placeFielder(draggingId, x, y);
        rafRef.current = null;
      });
    },
    [draggingId, isComplete, placeFielder, toSvgCoords]
  );

  const handlePointerUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDraggingId(null);
  }, []);

  return (
    <div className="relative w-full aspect-square select-none" data-tutorial="cricket-field">
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="w-full h-full cursor-default"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* ── Wireframe Field Base ── */}
        {/* Black fill, stark white vector lines only. No gradients, no glow. */}

        {/* Outer boundary — thin white circle on ink */}
        <ellipse
          cx="50" cy="50" rx="47" ry="47"
          fill="var(--ink)"
          stroke="var(--paper)"
          strokeWidth="0.5"
        />

        {/* 8 faint radial sector lines from center to boundary (every 45°) */}
        {/* Cricket polar: 0°=bowler/bottom, 90°=leg/right, 180°=keeper/top, 270°=off/left */}
        {/* Endpoints: x = 50 + 47*sin(α°), y = 50 + 47*cos(α°) */}
        <g stroke="var(--paper)" strokeWidth="0.2" opacity="0.18">
          <line x1="50" y1="50" x2="50" y2="97" />
          <line x1="50" y1="50" x2="83.23" y2="83.23" />
          <line x1="50" y1="50" x2="97" y2="50" />
          <line x1="50" y1="50" x2="83.23" y2="16.77" />
          <line x1="50" y1="50" x2="50" y2="3" />
          <line x1="50" y1="50" x2="16.77" y2="16.77" />
          <line x1="50" y1="50" x2="3" y2="50" />
          <line x1="50" y1="50" x2="16.77" y2="83.23" />
        </g>

        {/* 30-yard inner circle — white dashed */}
        <ellipse
          cx="50" cy="50" rx="28" ry="28"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="0.35"
          strokeDasharray="1.5 1.5"
          opacity="0.55"
        />

        {/* "KEEPER'S END" label (top — behind batsman, slip/keeper region) */}
        <text
          x="50" y="1.75"
          textAnchor="middle"
          fontSize="2.2"
          fill="var(--muted)"
          letterSpacing="0.4"
          fontFamily="var(--mono)"
        >
          KEEPER&apos;S END
        </text>

        {/* "BOWLER'S END" label (bottom) */}
        <text
          x="50" y="100"
          textAnchor="middle"
          fontSize="2.2"
          fill="var(--muted)"
          letterSpacing="0.4"
          fontFamily="var(--mono)"
        >
          BOWLER&apos;S END
        </text>

        {/* OFF SIDE / LEG SIDE labels — these swap sides for a left-hander */}
        <text x="5" y="52" fontSize="2.2" fill="var(--muted)" fontFamily="var(--mono)" letterSpacing="0.2">
          {battingHand === "left" ? "LEG" : "OFF"}
        </text>
        <text x="88" y="52" fontSize="2.2" fill="var(--muted)" fontFamily="var(--mono)" letterSpacing="0.2">
          {battingHand === "left" ? "OFF" : "LEG"}
        </text>

        {/* Pitch */}
        <PitchStrip battingHand={battingHand} />

        {/* Ball trajectory animation */}
        <AnimatePresence>
          {isAnimating && lastOutcome && (
            <motion.g
              key={lastOutcome.ballNumber}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <BallTracer
                outcome={lastOutcome}
                onComplete={onAnimationComplete}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* Fielders */}
        <g>
          {fielders.map((fielder) => (
            <FielderToken
              key={fielder.id}
              fielder={fielder}
              isDragging={draggingId === fielder.id}
              isDisabled={isComplete}
              isHighlighted={highlightedFielderId === fielder.id}
              onDragStart={() => {
                if (!isComplete) setDraggingId(fielder.id);
              }}
              onHover={setHoverLabel}
            />
          ))}
        </g>

        {/* Wicket keeper (fixed, top — behind batsman at keeper's end) */}
        <g opacity="0.75">
          <rect x="48.5" y="30.5" width="3" height="3" fill="none" stroke="var(--muted)" strokeWidth="0.3" />
          <text x="50" y="29.2" textAnchor="middle" fontSize="1.8" fill="var(--muted)" fontFamily="var(--mono)">
            WK
          </text>
        </g>

        {/* Bowler (fixed, bottom — bowler's end) */}
        <g opacity="0.6">
          <rect x="48.7" y="66.8" width="2.6" height="2.6" fill="none" stroke="var(--muted)" strokeWidth="0.3" />
          <text x="50" y="72.4" textAnchor="middle" fontSize="1.8" fill="var(--muted)" fontFamily="var(--mono)">
            BWL
          </text>
        </g>

      </svg>

      {/* Outside-circle counter — positioned outside the field diagram */}
      <div
        className="absolute bottom-1 right-1 px-2 py-0.5 text-xs font-mono font-bold tracking-widest uppercase"
        style={{
          background: atLimit ? "var(--blood)" : "var(--ink)",
          border: `2px solid ${atLimit ? "var(--blood)" : "var(--paper)"}`,
          color: "var(--paper)",
        }}
      >
        {outerCount}/5 OUT
      </div>

      {/* Hover label tooltip */}
      {hoverLabel && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wide pointer-events-none z-10"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "2px solid var(--paper)",
          }}
        >
          {hoverLabel}
        </div>
      )}
    </div>
  );
}
