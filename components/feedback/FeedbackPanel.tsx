"use client";
import React from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { getOutcomeCell, type OutcomeLike } from "@/lib/outcomeStyle";

interface FeedbackPanelProps {
  onShowResults?: () => void;
}

const PANEL_STYLE: React.CSSProperties = {
  background: "var(--ink)",
  border: "2px solid var(--paper)",
};

export default function FeedbackPanel({ onShowResults }: FeedbackPanelProps) {
  const ballLog   = useGameStore((s) => s.ballLog);
  const isComplete = useGameStore((s) => s.match.isComplete);

  if (ballLog.length === 0) {
    return (
      <div data-tutorial="feedback-panel" className="flex flex-col" style={{ ...PANEL_STYLE, minHeight: 100 }}>
        <div className="px-3 py-2" style={{ borderBottom: "2px solid var(--paper)" }}>
          <span className="brut-label">TACTICAL // READOUT</span>
        </div>
        <p className="text-xs font-mono leading-relaxed p-3" style={{ color: "var(--muted)" }}>
          {"> "}Set your field, choose your delivery, and bowl. The engine will explain what happened
          and why.
          <span className="brut-blink">_</span>
        </p>
      </div>
    );
  }

  const last = ballLog[ballLog.length - 1];
  const cell = getOutcomeCell(last as OutcomeLike);

  const expLengthLabel    = last.aiExpectation.length.replace(/_/g, " ");
  const expVariationLabel = last.aiExpectation.variation.replace(/_/g, " ");

  return (
    <motion.div
      key={ballLog.length}
      data-tutorial="feedback-panel"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "linear" }}
      className="flex flex-col"
      style={PANEL_STYLE}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "2px solid var(--paper)" }}>
        <span className="brut-label">TACTICAL // READOUT</span>
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 uppercase tracking-widest"
          style={{ background: cell.fill, border: `2px solid ${cell.border}`, color: cell.text }}
        >
          {cell.longLabel}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* Bluff / read indicators */}
        <BluffTag
          surprise={last.wasLengthBluff}
          surpriseText={`LENGTH SURPRISE — AI EXPECTED ${expLengthLabel.toUpperCase()}`}
          readText={`LENGTH READ — BATSMAN ANTICIPATED ${expLengthLabel.toUpperCase()}`}
        />
        <BluffTag
          surprise={last.wasVariationBluff}
          surpriseText={`VARIATION SURPRISE — AI EXPECTED ${expVariationLabel.toUpperCase()}`}
          readText={`VARIATION PICKED — BATSMAN READ ${expVariationLabel.toUpperCase()}`}
        />

        {/* Chaos event */}
        {last.chaosEvent && (
          <div
            className="text-[11px] font-mono font-bold px-2 py-1 uppercase tracking-wide brut-blink"
            style={{ background: "var(--ink)", border: "2px solid var(--blood)", color: "var(--blood)" }}
          >
            ! CHAOS: {last.chaosEvent.replace(/_/g, " ").toUpperCase()}
          </div>
        )}

        {/* Main feedback */}
        <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--paper)" }}>
          <span style={{ color: "var(--blood)" }}>{"> "}</span>
          {last.feedbackMessage}
        </p>

        {/* Ball history mini row */}
        {ballLog.length > 1 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {ballLog.slice(0, -1).map((ball, i) => {
              const c = getOutcomeCell(ball as OutcomeLike);
              return (
                <span
                  key={i}
                  className="text-[10px] font-mono font-bold w-5 h-5 flex items-center justify-center"
                  style={{ background: c.fill, border: `1px solid ${c.border}`, color: c.text }}
                >
                  {c.label}
                </span>
              );
            })}
          </div>
        )}

        {/* See Results button — only after the final ball */}
        {isComplete && onShowResults && (
          <button onClick={onShowResults} className="brut-btn brut-btn--primary w-full mt-2 text-sm">
            SEE RESULTS →
          </button>
        )}
      </div>
    </motion.div>
  );
}

function BluffTag({
  surprise,
  surpriseText,
  readText,
}: {
  surprise: boolean;
  surpriseText: string;
  readText: string;
}) {
  // Surprise (good) = solid red block. Read (bad) = outlined.
  return (
    <div
      className="text-[11px] font-mono font-bold px-2 py-1 uppercase tracking-wide"
      style={
        surprise
          ? { background: "var(--blood)", border: "2px solid var(--blood)", color: "var(--paper)" }
          : { background: "var(--ink)", border: "2px solid var(--faint)", color: "var(--muted)" }
      }
    >
      {surprise ? `[x] ${surpriseText}` : `[ ] ${readText}`}
    </div>
  );
}
