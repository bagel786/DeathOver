"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useTutorialStore } from "@/store/tutorialStore";
import CricketField from "@/components/field/CricketField";
import DeliverySelector from "@/components/delivery/DeliverySelector";
import BowlButton from "@/components/delivery/BowlButton";
import MatchSituation from "@/components/scoreboard/MatchSituation";
import FeedbackPanel from "@/components/feedback/FeedbackPanel";
import ResultScreen from "@/components/results/ResultScreen";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import TutorialHint from "@/components/tutorial/TutorialHint";
import type { BallOutcome } from "@/types/game";

export default function PlayPage() {
  const router = useRouter();
  const bowlDelivery = useGameStore((s) => s.bowlDelivery);
  const isComplete = useGameStore((s) => s.match.isComplete);
  const tutorialActive = useTutorialStore((s) => s.active);
  const completeTutorial = useTutorialStore((s) => s.completeTutorial);

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

  // Complete the tutorial when the game ends (if tutorial was active)
  useEffect(() => {
    if (isComplete && tutorialActive) {
      completeTutorial();
    }
  }, [isComplete, tutorialActive, completeTutorial]);

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
      style={{ background: "var(--ink)" }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "2px solid var(--paper)" }}
      >
        <button
          className="font-mono font-bold tracking-widest text-sm uppercase transition-colors"
          style={{ color: "var(--blood)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={() => router.push("/")}
        >
          ◄ DEATH OVER
        </button>
        <span className="hidden sm:block brut-label">
          CHALLENGE MODE
        </span>
        <button
          className="font-mono font-bold text-xs px-3 py-1.5 uppercase tracking-widest"
          style={{ border: "2px solid var(--paper)", color: "var(--paper)", background: "var(--ink)", cursor: "pointer" }}
          onClick={() => useGameStore.getState().resetGame()}
        >
          RESET
        </button>
      </header>

      {/* Mobile tab bar — hidden on lg+ */}
      <div className="lg:hidden flex" style={{ borderBottom: "2px solid var(--paper)" }}>
        <button
          className="flex-1 py-2 font-mono font-bold text-xs tracking-widest uppercase transition-colors"
          style={{
            color: mobileTab === 'delivery' ? 'var(--paper)' : 'var(--muted)',
            background: mobileTab === 'delivery' ? 'var(--blood)' : 'var(--ink)',
            borderRight: '2px solid var(--paper)',
          }}
          onClick={() => setMobileTab('delivery')}
        >
          BOWL
        </button>
        <button
          className="flex-1 py-2 font-mono font-bold text-xs tracking-widest uppercase transition-colors"
          style={{
            color: mobileTab === 'scoreboard' ? 'var(--paper)' : 'var(--muted)',
            background: mobileTab === 'scoreboard' ? 'var(--blood)' : 'var(--ink)',
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
            className="hidden lg:block p-3 text-xs font-mono"
            style={{
              background: "var(--ink)",
              border: "2px solid var(--faint)",
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            <p className="brut-label mb-1" style={{ color: "var(--blood)" }}>// TIP</p>
            Drag the <span style={{ color: "var(--paper)" }}>numbered squares</span> to place your 9
            fielders. The AI reads your field — try to bluff it.
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

      {/* Tutorial system */}
      <TutorialOverlay onForceMobileTab={setMobileTab} />
      {tutorialActive && <TutorialHint />}

      <AnimatePresence>
        {chaosFlash && (
          <motion.div
            key={chaosFlash + Date.now()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
            style={{ background: "var(--blood-wash)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.05, opacity: 0 }}
              transition={{ duration: 0.12, ease: "linear" }}
              className="font-mono font-black tracking-widest text-center px-8 py-4 uppercase"
              style={{
                background: "var(--ink)",
                border: "3px solid var(--blood)",
                color: "var(--blood)",
                fontSize: "clamp(16px, 3vw, 24px)",
                boxShadow: "8px 8px 0 var(--blood)",
              }}
            >
              ! CHAOS EVENT
              <div className="text-sm mt-1" style={{ color: "var(--paper)" }}>
                {chaosFlash.replace(/_/g, " ").toUpperCase()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
