"use client";

import { motion } from "framer-motion";

interface NewPlayerModalProps {
  onStartTutorial: () => void;
  onSkip: () => void;
}

/**
 * Shown when a first-time player clicks Daily Challenge or Custom Game.
 * Offers a tutorial or lets them skip straight into the game.
 */
export default function NewPlayerModal({ onStartTutorial, onSkip }: NewPlayerModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.9)" }}
    >
      <motion.div
        className="flex flex-col items-center text-center"
        style={{
          width: "min(380px, 92vw)",
          background: "var(--ink)",
          border: "3px solid var(--paper)",
          padding: "32px 28px",
          boxShadow: "8px 8px 0 var(--blood)",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        {/* Icon */}
        <div className="font-mono font-black tracking-widest mb-1" style={{ fontSize: 48, lineHeight: 1 }}>
          🏏
        </div>

        <div className="brut-data-xl uppercase mb-3" style={{ fontSize: 24, color: "var(--blood)", letterSpacing: "0.12em" }}>
          FIRST TIME?
        </div>

        <hr className="brut-rule" style={{ width: "60%", marginBottom: 16 }} />

        <p className="font-mono text-xs leading-relaxed mb-6" style={{ color: "var(--muted)", maxWidth: 300 }}>
          Death over bowling is all about fielding strategy and outfoxing the AI.
          The 2-minute tutorial shows you everything you need to play.
        </p>

        {/* CTA buttons */}
        <button onClick={onStartTutorial} className="brut-btn brut-btn--primary w-full text-sm mb-3">
          YES — TEACH ME
        </button>

        <button
          onClick={onSkip}
          className="w-full py-2.5 font-mono font-bold text-xs tracking-widest uppercase"
          style={{
            border: "2px solid var(--faint)",
            color: "var(--muted)",
            background: "var(--ink)",
            cursor: "pointer",
          }}
        >
          Skip — I know cricket
        </button>

        <p className="font-mono text-[10px] mt-4 uppercase tracking-wide" style={{ color: "var(--faint)" }}>
          You can always access the tutorial via &quot;HOW TO PLAY&quot; on the home screen.
        </p>
      </motion.div>
    </div>
  );
}
