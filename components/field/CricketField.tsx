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
    <div className="relative w-full aspect-square select-none">
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="w-full h-full cursor-default"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* ── Field Base ── */}
        <defs>
          <radialGradient id="fieldGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a4a2e" />
            <stop offset="80%" stopColor="#152e1e" />
            <stop offset="100%" stopColor="#0d1f14" />
          </radialGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="#0a0f0d" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a0f0d" stopOpacity="0.6" />
          </radialGradient>
          <filter id="fielderGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#00d4ff" floodOpacity="0.9" />
          </filter>
          <filter id="ballGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffcc00" floodOpacity="1" />
          </filter>
        </defs>

        {/* Outer boundary */}
        <ellipse
          cx="50" cy="50" rx="47" ry="47"
          fill="url(#fieldGrad)"
          stroke="#2d6a45"
          strokeWidth="0.8"
        />

        {/* Outer glow ring just inside boundary */}
        <ellipse
          cx="50" cy="50" rx="47" ry="47"
          fill="none"
          stroke="#00d4ff"
          strokeWidth="0.3"
          opacity="0.12"
        />

        {/* 8 faint radial sector lines from center to boundary (every 45°) */}
        {/* Cricket polar: 0°=bowler/bottom, 90°=leg/right, 180°=keeper/top, 270°=off/left */}
        {/* Endpoints: x = 50 + 47*sin(α°), y = 50 + 47*cos(α°) */}
        <g opacity="0.35">
          {/* 0° → bowler end (50, 97) */}
          <line x1="50" y1="50" x2="50" y2="97" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 45° → mid-wicket (83.23, 83.23) */}
          <line x1="50" y1="50" x2="83.23" y2="83.23" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 90° → leg side (97, 50) */}
          <line x1="50" y1="50" x2="97" y2="50" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 135° → fine leg (83.23, 16.77) */}
          <line x1="50" y1="50" x2="83.23" y2="16.77" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 180° → keeper end (50, 3) */}
          <line x1="50" y1="50" x2="50" y2="3" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 225° → gully / third man (16.77, 16.77) */}
          <line x1="50" y1="50" x2="16.77" y2="16.77" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 270° → off side (3, 50) */}
          <line x1="50" y1="50" x2="3" y2="50" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
          {/* 315° → cover / long off (16.77, 83.23) */}
          <line x1="50" y1="50" x2="16.77" y2="83.23" stroke="#2a4a35" strokeWidth="0.3" opacity="0.4" />
        </g>

        {/* 30-yard inner circle */}
        <ellipse
          cx="50" cy="50" rx="28" ry="28"
          fill="none"
          stroke="#2d6a45"
          strokeWidth="0.4"
          strokeDasharray="2 2"
          opacity="0.6"
        />

        {/* Subtle glow at center */}
        <ellipse
          cx="50" cy="50" rx="28" ry="28"
          fill="url(#glowGrad)"
          opacity="0.3"
        />

        {/* "KEEPER'S END" label (top — behind batsman, slip/keeper region) */}
        <text
          x="50" y="1.75"
          textAnchor="middle"
          fontSize="2.2"
          fill="#6b8c76"
          letterSpacing="0.3"
          fontFamily="monospace"
        >
          KEEPER&apos;S END
        </text>

        {/* "BOWLER'S END" label (bottom) */}
        <text
          x="50" y="100"
          textAnchor="middle"
          fontSize="2.2"
          fill="#6b8c76"
          letterSpacing="0.3"
          fontFamily="monospace"
        >
          BOWLER&apos;S END
        </text>

        {/* OFF SIDE / LEG SIDE labels */}
        <text x="5" y="52" fontSize="2" fill="#4a7a5a" fontFamily="monospace" opacity="0.7">
          OFF
        </text>
        <text x="88" y="52" fontSize="2" fill="#4a7a5a" fontFamily="monospace" opacity="0.7">
          LEG
        </text>

        {/* Pitch */}
        <PitchStrip />

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

        {/* Vignette overlay (after all field elements, before fielders) */}
        <ellipse cx="50" cy="50" rx="47" ry="47" fill="url(#vignetteGrad)" />

        {/* Fielders — wrapped in glow filter group */}
        <g filter="url(#fielderGlowFilter)">
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
        <g opacity="0.7">
          <circle cx="50" cy="32" r="1.4" fill="#888" stroke="#aaa" strokeWidth="0.3" />
          <text x="50" y="29.5" textAnchor="middle" fontSize="1.8" fill="#888" fontFamily="monospace">
            WK
          </text>
        </g>

        {/* Bowler (fixed, bottom — bowler's end) */}
        <g opacity="0.5">
          <circle cx="50" cy="68" r="1.2" fill="#666" stroke="#888" strokeWidth="0.3" />
          <text x="50" y="71.65" textAnchor="middle" fontSize="1.8" fill="#666" fontFamily="monospace">
            BWL
          </text>
        </g>

      </svg>

      {/* Outside-circle counter — positioned outside the field diagram */}
      <div
        className="absolute bottom-1 right-1 px-2 py-0.5 rounded text-xs font-mono font-bold tracking-wide"
        style={{
          background: atLimit ? "#ff444422" : "#00000066",
          border: `1px solid ${atLimit ? "#ff4444" : "#2d6a45"}`,
          color: atLimit ? "#ff4444" : "#6b8c76",
        }}
      >
        {outerCount}/5 OUT
      </div>

      {/* Hover label tooltip */}
      {hoverLabel && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-xs font-mono pointer-events-none z-10"
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "#00d4ff",
            border: "1px solid #00d4ff33",
          }}
        >
          {hoverLabel}
        </div>
      )}
    </div>
  );
}
