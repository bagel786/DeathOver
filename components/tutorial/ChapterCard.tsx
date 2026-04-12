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
        background: "rgba(6,10,8,0.97)",
        backdropFilter: "blur(4px)",
      }}
      initial={{ y: "40px", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-40px", opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      onClick={onContinue}
    >
      {/* Chapter number — counts up with a bounce */}
      <motion.div
        className="font-mono font-black tracking-widest mb-4"
        style={{
          fontSize: "clamp(64px, 12vw, 96px)",
          color: "#00d4ff",
          lineHeight: 1,
          textShadow: "0 0 40px rgba(0,212,255,0.5)",
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
      >
        {String(def?.number ?? chapterIndex + 1).padStart(2, "0")}
      </motion.div>

      {/* Chapter title */}
      <motion.div
        className="font-mono font-black tracking-widest uppercase text-center mb-3"
        style={{
          fontSize: "clamp(20px, 5vw, 36px)",
          color: "#e8f5ee",
          letterSpacing: "0.2em",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.35 }}
      >
        {def?.title ?? `Chapter ${chapterIndex + 1}`}
      </motion.div>

      {/* Subtitle */}
      <motion.div
        className="font-mono text-center"
        style={{
          fontSize: "clamp(11px, 2vw, 15px)",
          color: "#6b8c76",
          letterSpacing: "0.12em",
          maxWidth: 340,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.4 }}
      >
        {def?.subtitle ?? ""}
      </motion.div>

      {/* Tap to continue hint */}
      <motion.div
        className="font-mono text-xs tracking-widest mt-10"
        style={{ color: "#2d4a35" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ delay: 1.2, duration: 1.2, repeat: Infinity }}
      >
        TAP TO CONTINUE
      </motion.div>

      {/* Bottom progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{ background: "#00d4ff", transformOrigin: "left" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2.8, ease: "linear" }}
      />
    </motion.div>
  );
}
