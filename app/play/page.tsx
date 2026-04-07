"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import CricketField from "@/components/field/CricketField";
import DeliverySelector from "@/components/delivery/DeliverySelector";
import BowlButton from "@/components/delivery/BowlButton";
import MatchSituation from "@/components/scoreboard/MatchSituation";
import FeedbackPanel from "@/components/feedback/FeedbackPanel";
import ResultScreen from "@/components/results/ResultScreen";
import type { BallOutcome } from "@/types/game";

export default function PlayPage() {
  const bowlDelivery = useGameStore((s) => s.bowlDelivery);
  const isComplete = useGameStore((s) => s.match.isComplete);

  const [isAnimating, setIsAnimating] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<BallOutcome | null>(null);
  const [chaosFlash, setChaosFlash] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [mobileTab, setMobileTab] = useState<'delivery' | 'scoreboard'>('delivery');
  // Guard Framer Motion entrance animations against SSR hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Reset showResults when a new game starts (isComplete goes back to false)
  useEffect(() => {
    if (!isComplete) setShowResults(false);
  }, [isComplete]);

  const handleBowl = useCallback(() => {
    bowlDelivery();
    const log = useGameStore.getState().ballLog;
    const latest = log[log.length - 1];
    if (latest) {
      setLastOutcome(latest);
      setIsAnimating(true);
      if (latest.chaosEvent) {
        setChaosFlash(latest.chaosEvent);
        setTimeout(() => setChaosFlash(null), 1500);
      }
    }
  }, [bowlDelivery]);

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
  }, []);

  if (isComplete && showResults) {
    return <ResultScreen />;
  }

  return (
    <main
      className="min-h-screen w-full flex flex-col"
      style={{ background: "#0a0f0d" }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid #1a2e20" }}
      >
        <span className="font-mono font-bold tracking-widest text-sm" style={{ color: "#00d4ff" }}>
          DEATH OVER
        </span>
        <span className="hidden sm:block font-mono text-xs" style={{ color: "#4a7a5a" }}>
          CHALLENGE MODE
        </span>
        <button
          className="font-mono text-xs px-3 py-1 rounded"
          style={{ border: "1px solid #1e3d2a", color: "#6b8c76" }}
          onClick={() => useGameStore.getState().resetGame()}
        >
          RESET
        </button>
      </header>

      {/* Mobile tab bar — hidden on lg+ */}
      <div className="lg:hidden flex" style={{ borderBottom: "1px solid #1a2e20" }}>
        <button
          className="flex-1 py-2 font-mono text-xs tracking-widest transition-colors"
          style={{
            color: mobileTab === 'delivery' ? '#00d4ff' : '#4a7a5a',
            borderBottom: mobileTab === 'delivery' ? '2px solid #00d4ff' : '2px solid transparent',
          }}
          onClick={() => setMobileTab('delivery')}
        >
          BOWL
        </button>
        <button
          className="flex-1 py-2 font-mono text-xs tracking-widest transition-colors"
          style={{
            color: mobileTab === 'scoreboard' ? '#00d4ff' : '#4a7a5a',
            borderBottom: mobileTab === 'scoreboard' ? '2px solid #00d4ff' : '2px solid transparent',
          }}
          onClick={() => setMobileTab('scoreboard')}
        >
          SCORE
        </button>
      </div>

      {/* Main layout — flex-col on mobile, 3-col grid on lg+ */}
      <div
        className="flex-1 flex flex-col lg:grid gap-2 p-2 lg:gap-4 lg:p-4"
        style={{ gridTemplateColumns: "260px 1fr 260px" }}
      >
        {/* CENTER — Field (first in DOM for mobile scroll order) */}
        <motion.div
          className="flex items-center justify-center lg:col-start-2"
          initial={mounted ? { opacity: 0, scale: 0.97 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div style={{ maxWidth: 520, width: "100%" }}>
            <CricketField
              lastOutcome={lastOutcome}
              isAnimating={isAnimating}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>
        </motion.div>

        {/* LEFT — Delivery panel */}
        <motion.div
          className={`flex-col gap-3 lg:col-start-1 lg:row-start-1 ${mobileTab === 'delivery' ? 'flex' : 'hidden'} lg:flex`}
          initial={mounted ? { x: -20, opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <DeliverySelector />
          <BowlButton onBowl={handleBowl} isAnimating={isAnimating} />

          {/* Quick tip — desktop only */}
          <div
            className="hidden lg:block p-3 rounded-lg text-xs font-mono"
            style={{
              background: "rgba(0,212,255,0.04)",
              border: "1px solid #00d4ff22",
              color: "#4a7a5a",
              lineHeight: 1.6,
            }}
          >
            <p className="mb-1" style={{ color: "#00d4ff88" }}>TIP</p>
            Drag the <span style={{ color: "#4fc3f7" }}>blue dots</span> to place your 9 fielders.
            The AI reads your field — try to bluff it!
          </div>
        </motion.div>

        {/* RIGHT — Scoreboard + Feedback */}
        <motion.div
          className={`flex-col gap-3 lg:col-start-3 lg:row-start-1 ${mobileTab === 'scoreboard' ? 'flex' : 'hidden'} lg:flex`}
          initial={mounted ? { x: 20, opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          <MatchSituation />
          <FeedbackPanel onShowResults={isComplete ? () => setShowResults(true) : undefined} />
        </motion.div>
      </div>

      <AnimatePresence>
        {chaosFlash && (
          <motion.div
            key={chaosFlash + Date.now()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
            style={{ background: "rgba(156,39,176,0.08)" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="font-mono font-black tracking-widest text-center px-8 py-4 rounded-2xl"
              style={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid #9c27b0",
                color: "#ce93d8",
                fontSize: "clamp(16px, 3vw, 24px)",
                boxShadow: "0 0 40px rgba(156,39,176,0.4)",
              }}
            >
              ⚡ CHAOS EVENT
              <div className="text-sm mt-1" style={{ color: "#9c27b0" }}>
                {chaosFlash.replace(/_/g, " ").toUpperCase()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
