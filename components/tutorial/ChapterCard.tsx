"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { CHAPTER_DEFS } from "@/lib/tutorial/steps";

interface ChapterCardProps {
  chapterIndex: number;
  onContinue: () => void;
}

/**
 * Full-screen splash card shown between chapters.
 * Auto-advances after 2.8s, or immediately on click.
 */
export default function ChapterCard({ chapterIndex, onContinue }: ChapterCardProps) {
  const def = CHAPTER_DEFS[chapterIndex];

  useEffect(() => {
    const timer = setTimeout(onContinue, 2800);
    return () => clearTimeout(timer);
  }, [chapterIndex, onContinue]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer"
      style={{
        zIndex: 110,
        background: "var(--ink)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      onClick={onContinue}
    >
      <p className="brut-label mb-4" style={{ color: "var(--blood)" }}>▚▚ CHAPTER ▚▚</p>

      {/* Chapter number */}
      <motion.div
        className="brut-data-xl mb-4"
        style={{
          fontSize: "clamp(64px, 12vw, 96px)",
          color: "var(--blood)",
          lineHeight: 1,
        }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 340, damping: 24 }}
      >
        {String(def?.number ?? chapterIndex + 1).padStart(2, "0")}
      </motion.div>

      {/* Chapter title */}
      <motion.div
        className="brut-data-xl uppercase text-center mb-3"
        style={{
          fontSize: "clamp(20px, 5vw, 36px)",
          color: "var(--paper)",
          letterSpacing: "0.12em",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.25 }}
      >
        {def?.title ?? `Chapter ${chapterIndex + 1}`}
      </motion.div>

      <hr className="brut-rule" style={{ width: "min(340px, 70vw)", margin: "4px 0 14px" }} />

      {/* Subtitle */}
      <motion.div
        className="font-mono text-center uppercase"
        style={{
          fontSize: "clamp(11px, 2vw, 15px)",
          color: "var(--muted)",
          letterSpacing: "0.12em",
          maxWidth: 340,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        {def?.subtitle ?? ""}
      </motion.div>

      {/* Tap to continue hint */}
      <div className="font-mono font-bold text-xs tracking-widest mt-10 uppercase brut-blink" style={{ color: "var(--muted)" }}>
        TAP TO CONTINUE
      </div>

      {/* Bottom progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[3px]"
        style={{ background: "var(--blood)", transformOrigin: "left" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2.8, ease: "linear" }}
      />
    </motion.div>
  );
}
