"use client";
import React from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  dot:    { label: "DOT",     color: "#2d6a45" },
  single: { label: "1 RUN",   color: "#ffcc00" },
  two:    { label: "2 RUNS",  color: "#ffcc00" },
  three:  { label: "3 RUNS",  color: "#ff9800" },
  four:   { label: "FOUR",    color: "#ff9800" },
  six:    { label: "SIX!",    color: "#9c27b0" },
  wicket: { label: "WICKET!", color: "#ff4444" },
  wide:   { label: "WIDE",    color: "#ff9800" },
  no_ball:{ label: "NO BALL", color: "#ff9800" },
};

interface FeedbackPanelProps {
  onShowResults?: () => void;
}

export default function FeedbackPanel({ onShowResults }: FeedbackPanelProps) {
  const ballLog   = useGameStore((s) => s.ballLog);
  const isComplete = useGameStore((s) => s.match.isComplete);

  if (ballLog.length === 0) {
    return (
      <div
        className="p-4 rounded-xl"
        style={{
          background: "rgba(10,15,13,0.9)",
          border: "1px solid #1e3d2a",
          backdropFilter: "blur(8px)",
          minHeight: 100,
        }}
      >
        <p className="text-xs font-mono tracking-widest mb-2" style={{ color: "#6b8c76" }}>
          TACTICAL INSIGHT
        </p>
        <p className="text-xs font-mono" style={{ color: "#4a7a5a" }}>
          Set your field, choose your delivery, and bowl. The engine will explain what happened and why.
        </p>
      </div>
    );
  }

  const last = ballLog[ballLog.length - 1];
  const rl   = RESULT_LABELS[last.result] ?? { label: last.result, color: "#e8f5ee" };

  const bothBluff    = last.wasLengthBluff && last.wasVariationBluff;
  const neitherBluff = !last.wasLengthBluff && !last.wasVariationBluff;

  const expLengthLabel    = last.aiExpectation.length.replace(/_/g, " ");
  const expVariationLabel = last.aiExpectation.variation.replace(/_/g, " ");

  return (
    <motion.div
      key={ballLog.length}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="p-4 rounded-xl flex flex-col gap-2"
      style={{
        background: "rgba(10,15,13,0.9)",
        border: "1px solid #1e3d2a",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono tracking-widest" style={{ color: "#6b8c76" }}>
          TACTICAL INSIGHT
        </span>
        <span
          className="text-sm font-mono font-bold px-2 py-0.5 rounded"
          style={{
            background: rl.color + "22",
            border: `1px solid ${rl.color}55`,
            color: rl.color,
          }}
        >
          {rl.label}
        </span>
      </div>

      {/* Bluff / read indicators */}
      <div className="flex flex-col gap-1">
        {/* Length bluff */}
        <div
          className="text-xs font-mono px-2 py-1 rounded"
          style={
            last.wasLengthBluff
              ? { background: "#00d4ff11", border: "1px solid #00d4ff33", color: "#00d4ff" }
              : { background: "#ff444411", border: "1px solid #ff444433", color: "#ff7777" }
          }
        >
          {last.wasLengthBluff
            ? `✓ LENGTH SURPRISE — AI expected ${expLengthLabel}`
            : `✗ LENGTH READ — Batsman anticipated ${expLengthLabel}`}
        </div>

        {/* Variation bluff */}
        <div
          className="text-xs font-mono px-2 py-1 rounded"
          style={
            last.wasVariationBluff
              ? { background: "#00d4ff0d", border: "1px solid #00d4ff22", color: "#7ee8ff" }
              : { background: "#ff440008", border: "1px solid #ff444422", color: "#ff9999" }
          }
        >
          {last.wasVariationBluff
            ? `✓ VARIATION SURPRISE — AI expected ${expVariationLabel}`
            : `✗ VARIATION PICKED — Batsman read ${expVariationLabel}`}
        </div>
      </div>

      {/* Chaos event */}
      {last.chaosEvent && (
        <div
          className="text-xs font-mono px-2 py-1 rounded"
          style={{ background: "#9c27b011", border: "1px solid #9c27b055", color: "#ce93d8" }}
        >
          ⚡ CHAOS: {last.chaosEvent.replace(/_/g, " ").toUpperCase()}
        </div>
      )}

      {/* Main feedback */}
      <p className="text-xs font-mono leading-relaxed" style={{ color: "#8aad96" }}>
        {last.feedbackMessage}
      </p>

      {/* Ball history mini row */}
      {ballLog.length > 1 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {ballLog.slice(0, -1).map((ball, i) => {
            const info = RESULT_LABELS[ball.result];
            return (
              <span
                key={i}
                className="text-[10px] font-mono px-1 rounded"
                style={{ background: info.color + "22", color: info.color }}
              >
                {info.label}
              </span>
            );
          })}
        </div>
      )}

      {/* See Results button — only after the final ball */}
      {isComplete && onShowResults && (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          onClick={onShowResults}
          className="mt-2 w-full py-2.5 rounded-xl font-mono font-bold tracking-widest text-sm transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #00d4ff18, #00d4ff35)",
            border: "1px solid #00d4ff",
            color: "#00d4ff",
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(0,212,255,0.15)",
          }}
        >
          SEE RESULTS →
        </motion.button>
      )}
    </motion.div>
  );
}
