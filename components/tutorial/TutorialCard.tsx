"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTutorialStore, getTotalStepsInChapter } from "@/store/tutorialStore";
import { CHAPTER_DEFS, ALL_STEPS } from "@/lib/tutorial/steps";
import type { TutorialStep, ArrowPosition } from "@/lib/tutorial/steps";
import { speak, stopSpeech } from "@/lib/tutorial/voice";

interface TutorialCardProps {
  step: TutorialStep;
  targetRect: DOMRect | null;
}

function ArrowIndicator({ direction, targetRect }: { direction: ArrowPosition; targetRect: DOMRect | null }) {
  if (direction === "none" || !targetRect) return null;

  // Arrow is a pulsing chevron pointing toward the spotlight
  const arrowStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 103,
    pointerEvents: "none",
    color: "var(--blood)",
    fontSize: 28,
    fontWeight: "bold",
  };

  let left = 0, top = 0, symbol = "▶";

  switch (direction) {
    case "right":
      left = targetRect.left - 48;
      top = targetRect.top + targetRect.height / 2 - 14;
      symbol = "▶";
      break;
    case "left":
      left = targetRect.right + 16;
      top = targetRect.top + targetRect.height / 2 - 14;
      symbol = "◀";
      break;
    case "top":
      left = targetRect.left + targetRect.width / 2 - 14;
      top = targetRect.bottom + 10;
      symbol = "▲";
      break;
    case "bottom":
      left = targetRect.left + targetRect.width / 2 - 14;
      top = targetRect.top - 42;
      symbol = "▼";
      break;
  }

  return (
    <motion.div
      style={{ ...arrowStyle, left, top }}
      animate={{
        scale: [1, 1.3, 1],
        opacity: [0.7, 1, 0.7],
        x: direction === "right" ? [0, -6, 0] : direction === "left" ? [0, 6, 0] : 0,
        y: direction === "top" ? [0, -6, 0] : direction === "bottom" ? [0, 6, 0] : 0,
      }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
    >
      {symbol}
    </motion.div>
  );
}

/** Compute the card position so it doesn't overlap the spotlight */
function getCardPosition(targetRect: DOMRect | null, arrowPosition: ArrowPosition): React.CSSProperties {
  const CARD_W = 300;
  const CARD_H = 220; // approx
  const MARGIN = 16;

  if (!targetRect) {
    // Center the card
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /** Fall back to bottom-center if there's no room on the preferred side. */
  const bottomCenter = (): React.CSSProperties => ({
    left: Math.max(MARGIN, vw / 2 - CARD_W / 2),
    top: Math.max(MARGIN, vh - CARD_H - 24),
  });

  // Arrow points right → card to the LEFT of the spotlight
  if (arrowPosition === "right" || arrowPosition === "none") {
    const left = targetRect.left - CARD_W - 60;
    if (left < MARGIN) return bottomCenter(); // not enough room left — go bottom
    const top = Math.min(
      Math.max(MARGIN, targetRect.top + targetRect.height / 2 - CARD_H / 2),
      vh - CARD_H - MARGIN
    );
    return { left: Math.max(MARGIN, left), top };
  }

  // Arrow points left → card to the RIGHT of the spotlight
  if (arrowPosition === "left") {
    const left = targetRect.right + 60;
    if (left + CARD_W > vw - MARGIN) return bottomCenter(); // not enough room right
    const top = Math.min(
      Math.max(MARGIN, targetRect.top + targetRect.height / 2 - CARD_H / 2),
      vh - CARD_H - MARGIN
    );
    return { left, top };
  }

  // Arrow points up (▲ below target) → card below the spotlight
  if (arrowPosition === "top") {
    const left = Math.min(
      Math.max(MARGIN, targetRect.left + targetRect.width / 2 - CARD_W / 2),
      vw - CARD_W - MARGIN
    );
    const top = Math.min(targetRect.bottom + 60, vh - CARD_H - MARGIN);
    return { left, top };
  }

  // Arrow points down (▼ above target) → card above the spotlight
  if (arrowPosition === "bottom") {
    const left = Math.min(
      Math.max(MARGIN, targetRect.left + targetRect.width / 2 - CARD_W / 2),
      vw - CARD_W - MARGIN
    );
    const top = Math.max(MARGIN, targetRect.top - CARD_H - 60);
    return { left, top };
  }

  return { left: MARGIN, top: MARGIN };
}

export default function TutorialCard({ step, targetRect }: TutorialCardProps) {
  const advanceStep   = useTutorialStore((s) => s.advanceStep);
  const goBack        = useTutorialStore((s) => s.goBack);
  const skipChapter   = useTutorialStore((s) => s.skipChapter);
  const skipAll       = useTutorialStore((s) => s.skipAll);
  const toggleVoice   = useTutorialStore((s) => s.toggleVoice);
  const canAdvance    = useTutorialStore((s) => s.canAdvance);
  const voiceEnabled  = useTutorialStore((s) => s.voiceEnabled);
  const chapterIndex  = useTutorialStore((s) => s.chapterIndex);
  const stepIndex     = useTutorialStore((s) => s.stepIndex);
  const globalIndex   = useTutorialStore((s) => s.globalStepIndex);
  const demoPlaying   = useTutorialStore((s) => s.demoPlaying);

  const totalInChapter = getTotalStepsInChapter(chapterIndex);
  const chapterDef = CHAPTER_DEFS[chapterIndex];
  const isFirstStep = globalIndex === 0;

  // Play voice when step changes
  const prevStepId = useRef<string | null>(null);
  useEffect(() => {
    if (prevStepId.current === step.id) return;
    prevStepId.current = step.id;

    if (voiceEnabled) {
      speak(step.voiceText);
    }
  }, [step.id, step.voiceText, voiceEnabled]);

  // Stop speech on unmount
  useEffect(() => () => stopSpeech(), []);

  const cardPos = getCardPosition(targetRect, step.arrowPosition);

  // The card breathes when waiting for a required action
  const waitingForAction = step.requiresAction !== null && !canAdvance && !demoPlaying;

  return (
    <>
      {/* Arrow pointing to the spotlight */}
      <ArrowIndicator direction={step.arrowPosition} targetRect={targetRect} />

      {/* The card itself */}
      <motion.div
        key={step.id}
        className="fixed"
        style={{
          ...cardPos,
          zIndex: 102,
          width: 300,
          background: "var(--ink)",
          border: "3px solid var(--paper)",
          boxShadow: "6px 6px 0 var(--blood)",
          overflow: "hidden",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={
          waitingForAction
            ? {
                opacity: 1,
                y: 0,
                borderColor: ["#ffffff", "#ffffff", "#ff0033", "#ff0033"],
              }
            : { scale: 1, opacity: 1, y: 0, borderColor: "#ffffff" }
        }
        transition={
          waitingForAction
            ? { duration: 1.1, repeat: Infinity, ease: "linear", times: [0, 0.49, 0.5, 1] }
            : { type: "spring", stiffness: 400, damping: 28 }
        }
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "2px solid var(--paper)", background: "var(--ink)" }}
        >
          <span className="font-mono font-bold text-[10px] tracking-widest uppercase" style={{ color: "var(--blood)" }}>
            CH {chapterIndex + 1}/4 // {chapterDef?.title ?? ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVoice}
              title={voiceEnabled ? "Mute voice" : "Enable voice"}
              className="font-mono text-xs px-1.5 py-0.5 transition-colors"
              style={{
                color: "var(--paper)",
                border: `2px solid ${voiceEnabled ? "var(--blood)" : "var(--faint)"}`,
                background: "var(--ink)",
              }}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>
            <button
              onClick={skipAll}
              className="font-mono font-bold text-[10px] px-2 py-1 tracking-widest uppercase"
              style={{ color: "var(--muted)", border: "2px solid var(--faint)", background: "var(--ink)" }}
            >
              SKIP ALL ▸
            </button>
          </div>
        </div>

        {/* Step title */}
        <div className="px-4 pt-3 pb-0.5">
          <span className="font-mono font-bold text-sm tracking-wide uppercase" style={{ color: "var(--paper)" }}>
            {step.title}
          </span>
        </div>

        {/* Body text */}
        <div className="px-4 py-3">
          <p
            className="font-mono text-xs leading-relaxed whitespace-pre-line"
            style={{ color: "var(--muted)" }}
          >
            {step.text}
          </p>
        </div>

        {/* Footer: nav + progress dots */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "2px solid var(--paper)" }}
        >
          {/* Back button */}
          <button
            onClick={goBack}
            disabled={isFirstStep}
            className="font-mono font-bold text-xs px-3 py-1.5 uppercase tracking-wide"
            style={{
              color: isFirstStep ? "var(--faint)" : "var(--paper)",
              border: `2px solid ${isFirstStep ? "var(--hair)" : "var(--faint)"}`,
              background: "var(--ink)",
              cursor: isFirstStep ? "default" : "pointer",
            }}
          >
            ← BACK
          </button>

          {/* Step progress squares */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalInChapter }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-150"
                style={{
                  width: i === stepIndex ? 9 : 6,
                  height: i === stepIndex ? 9 : 6,
                  background: i === stepIndex ? "var(--blood)" : i < stepIndex ? "var(--paper)" : "var(--faint)",
                }}
              />
            ))}
          </div>

          {/* Next / Try It / Skip Chapter */}
          <div className="flex items-center gap-1.5">
            {step.skippable && (
              <button
                onClick={skipChapter}
                className="font-mono font-bold text-[10px] px-2 py-1 uppercase tracking-wide"
                style={{ color: "var(--muted)", border: "2px solid var(--faint)", background: "var(--ink)" }}
              >
                SKIP CH ▸
              </button>
            )}
            <button
              onClick={advanceStep}
              disabled={!canAdvance}
              className={`font-mono text-xs font-bold px-4 py-1.5 tracking-widest uppercase${canAdvance ? " brut-armed" : ""}`}
              style={{
                background: canAdvance ? "var(--blood)" : "var(--ink)",
                border: canAdvance ? "2px solid var(--blood)" : "2px solid var(--faint)",
                color: canAdvance ? "var(--paper)" : "var(--faint)",
                cursor: canAdvance ? "pointer" : "not-allowed",
              }}
            >
              {step.isHandOn && !canAdvance ? "TRY IT" : "NEXT →"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
