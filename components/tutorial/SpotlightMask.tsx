"use client";

import { motion } from "framer-motion";

interface SpotlightMaskProps {
  targetRect: DOMRect | null;
  padding?: number;
  borderRadius?: number;
  onClick?: () => void;
}

/**
 * Full-screen dark overlay with a transparent "hole" punched over the target
 * element, plus an animated pulsing ring to draw the player's eye.
 */
export default function SpotlightMask({
  targetRect,
  padding = 10,
  borderRadius = 10,
  onClick,
}: SpotlightMaskProps) {
  const hasTarget = targetRect !== null;

  // The hole rect (with padding)
  const holeX = hasTarget ? targetRect!.left - padding : 0;
  const holeY = hasTarget ? targetRect!.top - padding : 0;
  const holeW = hasTarget ? targetRect!.width + padding * 2 : 0;
  const holeH = hasTarget ? targetRect!.height + padding * 2 : 0;

  return (
    <>
      {/* Dark SVG overlay with punched hole */}
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ width: "100vw", height: "100vh", zIndex: 100 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tutorial-spotlight">
            {/* White = show dark overlay */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black = transparent hole */}
            {hasTarget && (
              <rect
                x={holeX}
                y={holeY}
                width={holeW}
                height={holeH}
                rx={borderRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* The dark tint — clicking outside the hole triggers onClick */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.78)"
          mask="url(#tutorial-spotlight)"
          style={{ pointerEvents: "all", cursor: "default" }}
          onClick={onClick}
        />
      </svg>

      {/* Animated "LOOK AT ME" ring around the hole */}
      {hasTarget && (
        <motion.div
          className="fixed pointer-events-none rounded-lg"
          style={{
            zIndex: 101,
            left: holeX - 2,
            top: holeY - 2,
            width: holeW + 4,
            height: holeH + 4,
            borderRadius: borderRadius + 2,
          }}
          animate={{
            boxShadow: [
              "0 0 0px 2px #00d4ff, 0 0 16px 6px rgba(0,212,255,0.35)",
              "0 0 0px 3px #ffcc00, 0 0 24px 10px rgba(255,204,0,0.30)",
              "0 0 0px 2px #00d4ff, 0 0 16px 6px rgba(0,212,255,0.35)",
            ],
            scale: [1, 1.012, 1],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </>
  );
}
