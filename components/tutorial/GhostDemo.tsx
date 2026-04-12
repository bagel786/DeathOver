"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTutorialStore } from "@/store/tutorialStore";
import type { DemoType } from "@/lib/tutorial/steps";

interface GhostDemoProps {
  demoType: DemoType;
  fieldRect: DOMRect | null;     // bounding rect of [data-tutorial="cricket-field"]
  targetRect: DOMRect | null;    // bounding rect of the current step's target element
}

// ── Fielder Drag Demo ─────────────────────────────────────────────
// Animates a ghost blue dot from one fielder position to another.
// Fielder #3 is at SVG position ~{x:30, y:46} (Cover Point).
// We move it ~80px to the right to suggest dragging to a new position.

function FielderDragDemo({
  fieldRect,
  onCycleComplete,
}: {
  fieldRect: DOMRect | null;
  onCycleComplete: () => void;
}) {
  const cycleCount = useRef(0);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    if (!fieldRect) return;

    // SVG coords for the fielder we'll "drag" (Cover Point: ~30,46)
    const svgX = 30, svgY = 46;
    const startX = fieldRect.left + (svgX / 100) * fieldRect.width;
    const startY = fieldRect.top + (svgY / 100) * fieldRect.height;
    const endX = startX + fieldRect.width * 0.15;
    const endY = startY - fieldRect.height * 0.08;

    setGhostPos({ x: startX, y: startY });

    let cancelled = false;

    async function runCycle() {
      if (cancelled) return;
      // Pause at start
      await delay(400);
      if (cancelled) return;

      // Drag to new position
      await animateValue(startX, endX, startY, endY, 700, setGhostPos);
      if (cancelled) return;
      setIsReturning(true);
      await delay(350);

      // Return to start
      await animateValue(endX, startX, endY, startY, 500, setGhostPos);
      if (cancelled) return;
      setIsReturning(false);
      await delay(300);

      cycleCount.current += 1;
      if (cycleCount.current < 3) {
        runCycle();
      } else {
        onCycleComplete();
      }
    }

    runCycle();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldRect]);

  if (!ghostPos) return null;

  return (
    <motion.div
      className="fixed pointer-events-none rounded-full"
      style={{
        zIndex: 105,
        left: ghostPos.x - 12,
        top: ghostPos.y - 12,
        width: 24,
        height: 24,
        background: isReturning ? "rgba(79,195,247,0.25)" : "rgba(79,195,247,0.55)",
        border: "2px solid #4fc3f7",
        boxShadow: "0 0 12px rgba(79,195,247,0.6)",
      }}
      animate={isReturning ? { scale: 0.8 } : { scale: [1, 1.15, 1] }}
      transition={isReturning ? { duration: 0.2 } : { duration: 0.6, repeat: Infinity }}
    />
  );
}

// ── Button Click Demo ─────────────────────────────────────────────
// Shows a ghost cursor moving over the target button, then "clicking" it.

function ButtonClickDemo({
  targetRect,
  onCycleComplete,
}: {
  targetRect: DOMRect | null;
  onCycleComplete: () => void;
}) {
  const cycleCount = useRef(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    if (!targetRect) return;

    // Start cursor 100px above/left of the target button
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const startX = targetX - 80;
    const startY = targetY - 60;

    setCursorPos({ x: startX, y: startY });

    let cancelled = false;

    async function runCycle() {
      if (cancelled) return;
      await delay(300);
      if (cancelled) return;

      // Move to button
      await animateValue(startX, targetX, startY, targetY, 600, setCursorPos);
      if (cancelled) return;

      // Click
      setClicking(true);
      await delay(300);
      setClicking(false);
      await delay(500);

      // Return
      await animateValue(targetX, startX, targetY, startY, 400, setCursorPos);
      if (cancelled) return;
      await delay(200);

      cycleCount.current += 1;
      if (cycleCount.current < 3) {
        runCycle();
      } else {
        onCycleComplete();
      }
    }

    runCycle();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRect]);

  if (!cursorPos) return null;

  return (
    <>
      {/* Ghost cursor */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: 105,
          left: cursorPos.x,
          top: cursorPos.y,
          width: 20,
          height: 20,
          fontSize: 20,
          lineHeight: 1,
          opacity: 0.85,
          transform: "translate(-2px, -2px)",
        }}
      >
        👆
      </div>

      {/* Click ripple */}
      {clicking && targetRect && (
        <motion.div
          className="fixed pointer-events-none rounded-full"
          style={{
            zIndex: 104,
            left: targetRect.left + targetRect.width / 2 - 20,
            top: targetRect.top + targetRect.height / 2 - 20,
            width: 40,
            height: 40,
            border: "2px solid #00d4ff",
          }}
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      )}
    </>
  );
}

// ── Utility helpers ───────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function animateValue(
  fromX: number,
  toX: number,
  fromY: number,
  toY: number,
  durationMs: number,
  setter: (v: { x: number; y: number }) => void
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
      setter({
        x: fromX + (toX - fromX) * eased,
        y: fromY + (toY - fromY) * eased,
      });
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

// ── Main component ────────────────────────────────────────────────

export default function GhostDemo({ demoType, fieldRect, targetRect }: GhostDemoProps) {
  const demoCycleComplete = useTutorialStore((s) => s.demoCycleComplete);

  if (!demoType) return null;

  if (demoType === "fielder_drag") {
    return (
      <FielderDragDemo fieldRect={fieldRect} onCycleComplete={demoCycleComplete} />
    );
  }

  if (demoType === "button_click") {
    return (
      <ButtonClickDemo targetRect={targetRect} onCycleComplete={demoCycleComplete} />
    );
  }

  return null;
}
