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
    color: "#00d4ff",
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
          background: "rgba(8,14,11,0.97)",
          border: "1px solid #1e3d2a",
          borderRadius: 14,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)",
          overflow: "hidden",
        }}
        initial={{ scale: 0.88, opacity: 0, y: 10 }}
        animate={
          waitingForAction
            ? {
                scale: [1, 1.013, 1],
                opacity: 1,
                y: 0,
                boxShadow: [
                  "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)",
                  "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.25)",
                  "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)",
                ],
              }
            : { scale: 1, opacity: 1, y: 0 }
        }
        transition={
          waitingForAction
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 400, damping: 28 }
        }
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid #1e3d2a", background: "rgba(0,212,255,0.04)" }}
        >
          <span className="font-mono text-[10px] tracking-widest" style={{ color: "#00d4ff88" }}>
            CH {chapterIndex + 1}/4 — {chapterDef?.title ?? ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVoice}
              title={voiceEnabled ? "Mute voice" : "Enable voice"}
              className="font-mono text-xs px-1.5 py-0.5 rounded transition-colors"
              style={{
                color: voiceEnabled ? "#00d4ff" : "#2d4a35",
                border: `1px solid ${voiceEnabled ? "#00d4ff44" : "#1e3d2a"}`,
                background: voiceEnabled ? "rgba(0,212,255,0.07)" : "transparent",
              }}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>
            <button
              onClick={skipAll}
              className="font-mono text-[10px] px-2 py-0.5 rounded tracking-widest transition-colors"
              style={{ color: "#4a7a5a", border: "1px solid #1e3d2a" }}
            >
              SKIP ALL ▸
            </button>
          </div>
        </div>

        {/* Step title */}
        <div className="px-4 pt-3 pb-0.5">
          <span className="font-mono font-bold text-sm tracking-wide" style={{ color: "#e8f5ee" }}>
            {step.title}
          </span>
        </div>

        {/* Body text */}
        <div className="px-4 py-3">
          <p
            className="font-mono text-xs leading-relaxed whitespace-pre-line"
            style={{ color: "#8aad96" }}
          >
            {step.text}
          </p>
        </div>

        {/* Footer: nav + progress dots */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid #1a2e20" }}
        >
          {/* Back button */}
          <button
            onClick={goBack}
            disabled={isFirstStep}
            className="font-mono text-xs px-3 py-1.5 rounded transition-all duration-150"
            style={{
              color: isFirstStep ? "#1e3d2a" : "#6b8c76",
              border: `1px solid ${isFirstStep ? "#0f1e16" : "#1e3d2a"}`,
              cursor: isFirstStep ? "default" : "pointer",
            }}
          >
            ← BACK
          </button>

          {/* Step progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalInChapter }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === stepIndex ? 8 : 5,
                  height: i === stepIndex ? 8 : 5,
                  background: i === stepIndex ? "#00d4ff" : i < stepIndex ? "#1e5c2e" : "#1a2e20",
                }}
              />
            ))}
          </div>

          {/* Next / Try It / Skip Chapter */}
          <div className="flex items-center gap-1.5">
            {step.skippable && (
              <button
                onClick={skipChapter}
                className="font-mono text-[10px] px-2 py-1 rounded transition-colors"
                style={{ color: "#4a7a5a", border: "1px solid #1e3d2a" }}
              >
                SKIP CH ▸
              </button>
            )}
            <motion.button
              onClick={advanceStep}
              disabled={!canAdvance}
              className="font-mono text-xs font-bold px-4 py-1.5 rounded-lg tracking-widest transition-all duration-200"
              style={{
                background: canAdvance
                  ? "linear-gradient(135deg, #00d4ff18, #00d4ff30)"
                  : "rgba(255,255,255,0.03)",
                border: canAdvance ? "1px solid #00d4ff" : "1px solid #1e3d2a",
                color: canAdvance ? "#00d4ff" : "#2d4a35",
                cursor: canAdvance ? "pointer" : "not-allowed",
              }}
              animate={canAdvance ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={canAdvance ? { duration: 1.5, repeat: Infinity } : {}}
            >
              {step.isHandOn && !canAdvance ? "TRY IT" : "NEXT →"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
