"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { useTutorialStore } from "@/store/tutorialStore";
import { ALL_STEPS } from "@/lib/tutorial/steps";
import { initVoices } from "@/lib/tutorial/voice";
import SpotlightMask from "./SpotlightMask";
import TutorialCard from "./TutorialCard";
import ChapterCard from "./ChapterCard";
import GhostDemo from "./GhostDemo";

interface TutorialOverlayProps {
  /** Called when the tutorial needs to force the mobile tab */
  onForceMobileTab?: (tab: "delivery" | "scoreboard") => void;
}

// Selectors that live in the scoreboard panel (mobile tab: "scoreboard")
const SCOREBOARD_SELECTORS = new Set([
  '[data-tutorial="match-situation"]',
  '[data-tutorial="ball-dots"]',
  '[data-tutorial="feedback-panel"]',
]);

export default function TutorialOverlay({ onForceMobileTab }: TutorialOverlayProps) {
  const active      = useTutorialStore((s) => s.active);
  const phase       = useTutorialStore((s) => s.phase);
  const chapterIndex = useTutorialStore((s) => s.chapterIndex);
  const globalIndex = useTutorialStore((s) => s.globalStepIndex);
  const demoPlaying = useTutorialStore((s) => s.demoPlaying);
  const chapterCardDone = useTutorialStore((s) => s.chapterCardDone);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [fieldRect, setFieldRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    setMounted(true);
    initVoices();
  }, []);

  const currentStep = active && phase === "step" ? ALL_STEPS[globalIndex] ?? null : null;

  // Resolve the target element's bounding rect for spotlight + card positioning
  const resolveRects = useCallback(() => {
    // Always track the cricket field rect (for GhostDemo)
    const fieldEl = document.querySelector('[data-tutorial="cricket-field"]');
    if (fieldEl) {
      setFieldRect(fieldEl.getBoundingClientRect());
    }

    if (!currentStep?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep?.targetSelector]);

  // Re-resolve on step change, resize, and scroll
  useEffect(() => {
    if (!active) return;

    resolveRects();

    roRef.current?.disconnect();
    const ro = new ResizeObserver(resolveRects);
    roRef.current = ro;

    if (currentStep?.targetSelector) {
      const el = document.querySelector(currentStep.targetSelector);
      if (el) ro.observe(el);
    }

    window.addEventListener("resize", resolveRects, { passive: true });
    window.addEventListener("scroll", resolveRects, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resolveRects);
      window.removeEventListener("scroll", resolveRects);
    };
  }, [active, currentStep?.targetSelector, resolveRects]);

  // Force mobile tab when the tutorial spotlights something in a specific panel
  useEffect(() => {
    if (!active || !onForceMobileTab || !currentStep?.targetSelector) return;

    if (SCOREBOARD_SELECTORS.has(currentStep.targetSelector)) {
      onForceMobileTab("scoreboard");
    } else if (
      currentStep.targetSelector.includes("delivery") ||
      currentStep.targetSelector.includes("bowl") ||
      currentStep.targetSelector.includes("cricket-field")
    ) {
      onForceMobileTab("delivery");
    }
  }, [active, currentStep?.targetSelector, onForceMobileTab]);

  if (!mounted || !active) return null;

  return createPortal(
    <>
      <AnimatePresence mode="wait">
        {phase === "chapter_card" && (
          <ChapterCard
            key={`chapter-${chapterIndex}`}
            chapterIndex={chapterIndex}
            onContinue={chapterCardDone}
          />
        )}
      </AnimatePresence>

      {phase === "step" && currentStep && (
        <>
          <SpotlightMask
            targetRect={targetRect}
            onClick={() => {
              // Clicking the dark overlay while canAdvance is true advances the step
              const s = useTutorialStore.getState();
              if (s.canAdvance && !currentStep.isHandOn) {
                s.advanceStep();
              }
            }}
          />

          {demoPlaying && (
            <GhostDemo
              demoType={currentStep.demoType}
              fieldRect={fieldRect}
              targetRect={targetRect}
            />
          )}

          <TutorialCard step={currentStep} targetRect={targetRect} />
        </>
      )}
    </>,
    document.body
  );
}
