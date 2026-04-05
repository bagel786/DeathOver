"use client";
import React from "react";
import { useGameStore } from "@/store/gameStore";
interface BowlButtonProps { onBowl: () => void; isAnimating: boolean; }
export default function BowlButton({ onBowl, isAnimating }: BowlButtonProps) {
  const length    = useGameStore((s) => s.currentDelivery.length);
  const variation = useGameStore((s) => s.currentDelivery.variation);
  const line      = useGameStore((s) => s.currentDelivery.line);
  const isComplete = useGameStore((s) => s.match.isComplete);
  const canBowl = !!length && !!variation && !!line && !isComplete && !isAnimating;
  return (
    <>
      <style>{`
        @keyframes bowlPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(0,212,255,0.2); }
          50% { box-shadow: 0 0 32px rgba(0,212,255,0.5); }
        }
        .bowl-btn-ready {
          animation: bowlPulse 2s ease-in-out infinite;
        }
      `}</style>
      <button
        disabled={!canBowl}
        onClick={onBowl}
        className={`w-full py-3.5 rounded-xl font-mono font-bold tracking-widest text-sm transition-all duration-200${canBowl ? " bowl-btn-ready" : ""}`}
        style={{
          background: canBowl
            ? "linear-gradient(135deg, #00d4ff18, #00d4ff35)"
            : "rgba(255,255,255,0.03)",
          border: canBowl ? "1px solid #00d4ff" : "1px solid #1e3d2a",
          color: canBowl ? "#00d4ff" : "#2d4a35",
          cursor: canBowl ? "pointer" : "not-allowed",
        }}
      >
        {isAnimating ? "BOWLING..." : isComplete ? "MATCH OVER" : "BOWL DELIVERY"}
      </button>
    </>
  );
}
