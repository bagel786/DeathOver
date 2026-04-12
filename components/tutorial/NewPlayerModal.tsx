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
      style={{ zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        className="flex flex-col items-center text-center"
        style={{
          width: "min(380px, 92vw)",
          background: "rgba(8,14,11,0.98)",
          border: "1px solid #1e3d2a",
          borderRadius: 18,
          padding: "32px 28px",
          boxShadow: "0 12px 60px rgba(0,0,0,0.7)",
        }}
        initial={{ scale: 0.88, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        {/* Icon */}
        <div
          className="font-mono font-black tracking-widest mb-1"
          style={{ fontSize: 48, lineHeight: 1 }}
        >
          🏏
        </div>

        <div
          className="font-mono font-black tracking-widest mb-2"
          style={{ fontSize: 20, color: "#00d4ff", letterSpacing: "0.18em" }}
        >
          FIRST TIME?
        </div>

        <p className="font-mono text-xs leading-relaxed mb-6" style={{ color: "#6b8c76", maxWidth: 300 }}>
          Death over bowling is all about fielding strategy and outfoxing the AI.
          The 2-minute tutorial shows you everything you need to play.
        </p>

        {/* CTA buttons */}
        <motion.button
          onClick={onStartTutorial}
          className="w-full py-3.5 rounded-xl font-mono font-bold tracking-widest text-sm mb-3"
          style={{
            background: "linear-gradient(135deg, #00d4ff18, #00d4ff35)",
            border: "1px solid #00d4ff",
            color: "#00d4ff",
            cursor: "pointer",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          YES — TEACH ME
        </motion.button>

        <button
          onClick={onSkip}
          className="w-full py-2.5 rounded-xl font-mono text-xs tracking-widest transition-colors"
          style={{
            border: "1px solid #1e3d2a",
            color: "#4a7a5a",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Skip — I know cricket
        </button>

        <p className="font-mono text-[10px] mt-4" style={{ color: "#2d4a35" }}>
          You can always access the tutorial via "HOW TO PLAY" on the home screen.
        </p>
      </motion.div>
    </div>
  );
}
