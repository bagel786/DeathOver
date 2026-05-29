"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { BallOutcome } from "@/types/game";

interface BallTracerProps {
  outcome: BallOutcome;
  onComplete: () => void;
}

/**
 * Draws an animated ball trajectory from the pitch center outward in the shot direction.
 * Uses Framer Motion for reliable SVG animations in React.
 */
export default function BallTracer({ outcome, onComplete }: BallTracerProps) {
  const completedRef = useRef(false);

  const { shotDirection, runsScored, isWicket, isCaught } = outcome;

  // Bowled/LBW wickets don't produce a field trajectory — ball hits stumps, not outfield
  const isBowledOrLBW = isWicket && !isCaught;

  // Convert polar shot direction to SVG cartesian end point
  // Polar center is (50,50) but ball starts from the batsman's crease at (50,42)
  // angle: 0° = toward bowler (DOWN in SVG), clockwise
  // distance: 0-1 normalized, where 1.0 = boundary (radius 47 from center)
  const POLAR_CX = 50, POLAR_CY = 50;
  const BAT_X = 50, BAT_Y = 42; // batsman's popping crease
  const BOUNDARY_R = 47;
  const angleRad = (shotDirection.angle * Math.PI) / 180;
  const dist = shotDirection.distance * BOUNDARY_R;
  // Endpoint computed from polar center (field geometry)
  const endX = POLAR_CX + Math.sin(angleRad) * dist;
  const endY = POLAR_CY + Math.cos(angleRad) * dist;

  // Ball colour by outcome — strict palette. Boundaries/wickets bleed red;
  // everything else is stark white.
  const isBoundary = runsScored >= 4;
  const ballColor = isWicket || isBoundary ? "var(--blood)" : "var(--paper)";

  // Trajectory line length for strokeDasharray
  const dx = endX - BAT_X, dy = endY - BAT_Y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  useEffect(() => {
    completedRef.current = false; // reset for each new ball
    const timer = setTimeout(() => {
      completedRef.current = true;
      onComplete();
    }, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <g>
      {/* Trajectory + moving ball — omitted for bowled/LBW (ball hits stumps, not outfield) */}
      {!isBowledOrLBW && (
        <>
          {/* Trajectory line — hard, no glow; animates drawing via strokeDashoffset */}
          <motion.line
            x1={BAT_X} y1={BAT_Y}
            x2={endX} y2={endY}
            stroke={ballColor}
            strokeWidth="0.6"
            strokeDasharray={lineLength}
            initial={{ strokeDashoffset: lineLength, opacity: 0 }}
            animate={{
              strokeDashoffset: 0,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              strokeDashoffset: { duration: 0.5, ease: "linear" },
              opacity: { duration: 0.9, times: [0, 0.1, 0.7, 1] },
            }}
          />

          {/* Moving ball — a square, not a glowing dot */}
          <motion.rect
            width="2.4" height="2.4"
            fill={ballColor}
            initial={{ x: BAT_X - 1.2, y: BAT_Y - 1.2, opacity: 1 }}
            animate={{
              x: endX - 1.2,
              y: endY - 1.2,
              opacity: [1, 1, 0],
            }}
            transition={{
              x: { duration: 0.5, ease: "linear" },
              y: { duration: 0.5, ease: "linear" },
              opacity: { duration: 0.9, times: [0, 0.75, 1] },
            }}
          />
        </>
      )}

      {/* Wicket flash at batsman's stumps (y≈40) — hard red square */}
      {isWicket && (
        <motion.rect
          fill="var(--blood)"
          initial={{ x: 50, y: 40, width: 0, height: 0, opacity: 0.9 }}
          animate={{ x: [50, 42, 50], y: [40, 32, 40], width: [0, 16, 0], height: [0, 16, 0], opacity: [0.9, 0.9, 0] }}
          transition={{ duration: 0.5, delay: 0.3, ease: "linear" }}
        />
      )}

      {/* Impact flash at destination for boundaries — hard red square */}
      {isBoundary && (
        <motion.rect
          fill="var(--blood)"
          initial={{ x: endX, y: endY, width: 0, height: 0, opacity: 0 }}
          animate={{
            x: [endX, endX - (runsScored >= 6 ? 7 : 4), endX],
            y: [endY, endY - (runsScored >= 6 ? 7 : 4), endY],
            width: [0, runsScored >= 6 ? 14 : 8, 0],
            height: [0, runsScored >= 6 ? 14 : 8, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{ duration: 0.4, delay: 0.5, ease: "linear" }}
        />
      )}
    </g>
  );
}
