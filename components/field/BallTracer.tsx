"use client";

import { useEffect, useRef } from "react";
import type { BallOutcome } from "@/types/game";

interface BallTracerProps {
  outcome: BallOutcome;
  onComplete: () => void;
}

/**
 * Draws an animated line from the pitch center outward in the shot direction.
 * The line extends further for boundaries/sixes, stays short for dots.
 */
export default function BallTracer({ outcome, onComplete }: BallTracerProps) {
  const lineRef = useRef<SVGLineElement>(null);
  const completedRef = useRef(false);

  const { shotDirection, runsScored, isWicket } = outcome;

  // Convert polar shot direction to SVG cartesian end point
  // angle: 0° = toward bowler (DOWN in SVG), clockwise
  const CX = 50, CY = 50;
  const angleRad = (shotDirection.angle * Math.PI) / 180;
  const maxDist = runsScored >= 6 ? 44 : runsScored >= 4 ? 40 : isWicket ? 15 : 28;
  const dist = shotDirection.distance * maxDist;
  const endX = CX + Math.sin(angleRad) * dist;
  const endY = CY + Math.cos(angleRad) * dist; // +cos because 0° is DOWN

  // Ball colour by outcome
  const ballColor =
    isWicket ? "#ff4444"
    : runsScored >= 6 ? "#9c27b0"
    : runsScored >= 4 ? "#ff9800"
    : runsScored > 0 ? "#ffcc00"
    : "#4fc3f7";

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <g>
      {/* Glow trail behind the trajectory line */}
      <line
        x1={CX} y1={CY}
        x2={endX} y2={endY}
        stroke={ballColor}
        strokeWidth="2"
        strokeDasharray="3 2"
        opacity="0"
        filter="url(#ballGlow)"
      >
        <animate attributeName="opacity" values="0;0.3;0.3;0" dur="0.9s" fill="freeze" />
      </line>

      {/* Trajectory line */}
      <line
        ref={lineRef}
        x1={CX} y1={CY}
        x2={endX} y2={endY}
        stroke={ballColor}
        strokeWidth="0.5"
        strokeDasharray="3 2"
        opacity="0.7"
      >
        <animate attributeName="opacity" values="0;0.7;0.7;0" dur="0.9s" fill="freeze" />
      </line>

      {/* Moving ball dot */}
      <circle r="1.8" fill={ballColor} filter="url(#ballGlow)">
        <animateMotion
          dur="0.5s"
          path={`M ${CX} ${CY} L ${endX} ${endY}`}
          fill="freeze"
        />
        <animate attributeName="opacity" values="1;1;0" dur="0.9s" fill="freeze" />
      </circle>

      {/* Wicket flash at batsman's stumps (top of pitch, y≈40) */}
      {isWicket && (
        <circle cx="50" cy="40" r="0" fill="#ff4444" opacity="0.8">
          <animate attributeName="r" values="0;8;0" begin="0.3s" dur="0.5s" fill="freeze" />
          <animate attributeName="opacity" values="0.8;0" begin="0.3s" dur="0.5s" fill="freeze" />
        </circle>
      )}

      {/* Impact flash at destination for boundaries */}
      {runsScored >= 4 && (
        <circle cx={endX} cy={endY} r="2" fill={ballColor} opacity="0">
          {runsScored >= 6 ? (
            <>
              <animate attributeName="r" values="0;8;0" begin="0.5s" dur="0.4s" fill="freeze" />
              <animate attributeName="opacity" values="0;0.7;0" begin="0.5s" dur="0.4s" fill="freeze" />
            </>
          ) : (
            <>
              <animate attributeName="r" values="0;4;0" begin="0.5s" dur="0.4s" fill="freeze" />
              <animate attributeName="opacity" values="0;0.5;0" begin="0.5s" dur="0.4s" fill="freeze" />
            </>
          )}
        </circle>
      )}
    </g>
  );
}
