"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useTutorialStore } from "@/store/tutorialStore";

interface HintDef {
  id: string;
  /** Returns true when this hint should appear */
  shouldShow: () => boolean;
  text: string;
}

// Context-sensitive hints shown during free-play phase
const HINTS: HintDef[] = [
  {
    id: "hint_yorker",
    shouldShow: () => {
      const gs = useGameStore.getState();
      return (
        gs.match.ballsBowled === 1 &&
        gs.match.runsConceded >= 4
      );
    },
    text: "Try a Yorker — it's the hardest length to score off in the death.",
  },
  {
    id: "hint_bluff_reminder",
    shouldShow: () => {
      const gs = useGameStore.getState();
      const log = gs.ballLog;
      if (log.length === 0) return false;
      const last = log[log.length - 1];
      return !last.wasLengthBluff && !last.wasVariationBluff;
    },
    text: "AI read you! Move fielders to suggest a different delivery next ball.",
  },
  {
    id: "hint_slower_ball",
    shouldShow: () => {
      const gs = useGameStore.getState();
      const log = gs.ballLog.filter((b) => !b.isExtraDelivery);
      if (log.length < 3) return false;
      return log.slice(-3).every((b) => b.delivery.variation === "pace");
    },
    text: "You've bowled pace 3 times in a row — try a Slower Ball to keep the AI guessing.",
  },
  {
    id: "hint_pressure",
    shouldShow: () => {
      const gs = useGameStore.getState();
      const runsNeeded = gs.match.target - gs.match.runsConceded;
      const ballsLeft = gs.match.totalBalls - gs.match.ballsBowled;
      // High pressure — batsman needs lots of runs, few balls left
      return ballsLeft <= 2 && runsNeeded <= 6 && runsNeeded > 0;
    },
    text: "Pressure is ON! Bowl a Yorker on Off Stump — keep it tight.",
  },
];

export default function TutorialHint() {
  const phase = useTutorialStore((s) => s.phase);
  const ballLog = useGameStore((s) => s.ballLog);
  const [activeHint, setActiveHint] = useState<HintDef | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (phase !== "free_play") return;

    // Check hints after each ball
    for (const hint of HINTS) {
      if (dismissedIds.has(hint.id)) continue;
      if (hint.shouldShow()) {
        setActiveHint(hint);
        return;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ballLog.length, phase]);

  const dismiss = () => {
    if (!activeHint) return;
    setDismissedIds((prev) => new Set([...prev, activeHint.id]));
    setActiveHint(null);
  };

  if (phase !== "free_play") return null;

  return (
    <AnimatePresence>
      {activeHint && (
        <motion.div
          key={activeHint.id}
          className="fixed pointer-events-auto"
          style={{
            zIndex: 50,
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: 320,
            background: "var(--ink)",
            border: "2px solid var(--blood)",
            padding: "10px 12px",
            boxShadow: "4px 4px 0 var(--blood)",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: "linear" }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--paper)" }}>
              <span style={{ color: "var(--blood)", fontWeight: 700 }}>{"// TIP  "}</span>
              {activeHint.text}
            </p>
            <button
              onClick={dismiss}
              className="font-mono text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ color: "var(--blood)" }}
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
