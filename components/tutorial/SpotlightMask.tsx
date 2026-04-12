"use client";

import { motion } from "framer-motion";

interface SpotlightMaskProps {
  targetRect: DOMRect | null;
  padding?: number;
  borderRadius?: number;
  onClick?: () => void;
}

const TINT = "rgba(0,0,0,0.78)";

/**
 * Full-screen dark overlay with a live hole over the target element.
 *
 * IMPORTANT: Uses four positioned divs (top/bottom/left/right strips) rather than
 * an SVG mask so the hole area has *no DOM element at all* — pointer events (drag,
 * click, touch) fall straight through to the game UI underneath.
 */
export default function SpotlightMask({
  targetRect,
  padding = 10,
  borderRadius = 10,
  onClick,
}: SpotlightMaskProps) {
  if (!targetRect) {
    // No spotlight — single full-screen tint
    return (
      <div
        className="fixed inset-0"
        style={{ zIndex: 100, background: TINT, pointerEvents: "all" }}
        onClick={onClick}
      />
    );
  }

  const hx = targetRect.left - padding;
  const hy = targetRect.top - padding;
  const hw = targetRect.width + padding * 2;
  const hh = targetRect.height + padding * 2;

  const clickProps = {
    style: { background: TINT, pointerEvents: "all" as const, cursor: "default" },
    onClick,
  };

  return (
    <>
      {/* Four strips surrounding the hole — none of them cover the hole itself */}
      {/* Top strip */}
      <div className="fixed left-0 right-0 top-0" style={{ ...clickProps.style, height: hy, zIndex: 100 }} onClick={onClick} />
      {/* Bottom strip */}
      <div className="fixed left-0 right-0 bottom-0" style={{ ...clickProps.style, top: hy + hh, zIndex: 100 }} onClick={onClick} />
      {/* Left strip (same row as hole) */}
      <div className="fixed left-0" style={{ ...clickProps.style, top: hy, width: hx, height: hh, zIndex: 100 }} onClick={onClick} />
      {/* Right strip (same row as hole) */}
      <div className="fixed right-0" style={{ ...clickProps.style, top: hy, left: hx + hw, height: hh, zIndex: 100 }} onClick={onClick} />

      {/* Animated "LOOK AT ME" ring — pointer-events none so it doesn't block the hole */}
      <motion.div
        className="fixed pointer-events-none rounded-lg"
        style={{
          zIndex: 101,
          left: hx - 2,
          top: hy - 2,
          width: hw + 4,
          height: hh + 4,
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
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
