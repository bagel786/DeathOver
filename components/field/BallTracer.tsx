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

  // Ball colour by outcome
  const ballColor =
    isWicket ? "#ff4444"
    : runsScored >= 6 ? "#9c27b0"
    : runsScored >= 4 ? "#ff9800"
    : runsScored > 0 ? "#ffcc00"
    : "#4fc3f7";

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
          {/* Glow trail behind the trajectory line */}
          <motion.line
            x1={BAT_X} y1={BAT_Y}
            x2={endX} y2={endY}
            stroke={ballColor}
            strokeWidth="2"
            strokeDasharray="3 2"
            filter="url(#ballGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.3, 0] }}
            transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1] }}
          />

          {/* Trajectory line — animates drawing via strokeDashoffset */}
          <motion.line
            x1={BAT_X} y1={BAT_Y}
            x2={endX} y2={endY}
            stroke={ballColor}
            strokeWidth="0.5"
            strokeDasharray={lineLength}
            initial={{ strokeDashoffset: lineLength, opacity: 0 }}
            animate={{
              strokeDashoffset: 0,
              opacity: [0, 0.7, 0.7, 0],
            }}
            transition={{
              strokeDashoffset: { duration: 0.5, ease: "easeOut" },
              opacity: { duration: 0.9, times: [0, 0.1, 0.7, 1] },
            }}
          />

          {/* Moving ball dot */}
          <motion.circle
            r="1.8"
            fill={ballColor}
            filter="url(#ballGlow)"
            initial={{ cx: BAT_X, cy: BAT_Y, opacity: 1 }}
            animate={{
              cx: endX,
              cy: endY,
              opacity: [1, 1, 0],
            }}
            transition={{
              cx: { duration: 0.5, ease: "easeOut" },
              cy: { duration: 0.5, ease: "easeOut" },
              opacity: { duration: 0.9, times: [0, 0.75, 1] },
            }}
          />
        </>
      )}

      {/* Wicket flash at batsman's stumps (y≈40) */}
      {isWicket && (
        <motion.circle
          cx="50" cy="40"
          fill="#ff4444"
          initial={{ r: 0, opacity: 0.8 }}
          animate={{ r: [0, 8, 0], opacity: [0.8, 0.8, 0] }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        />
      )}

      {/* Impact flash at destination for boundaries */}
      {runsScored >= 6 && (
        <motion.circle
          cx={endX} cy={endY}
          fill={ballColor}
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: [0, 8, 0], opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
        />
      )}
      {runsScored === 4 && (
        <motion.circle
          cx={endX} cy={endY}
          fill={ballColor}
          initial={{ r: 0, opacity: 0 }}
          animate={{ r: [0, 4, 0], opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
        />
      )}
    </g>
  );
}
