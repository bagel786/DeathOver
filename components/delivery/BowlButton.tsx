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
    <button
      disabled={!canBowl}
      onClick={onBowl}
      data-tutorial="bowl-button"
      className={`brut-btn w-full text-sm py-4${canBowl ? " brut-btn--primary brut-armed" : ""}`}
      style={{ letterSpacing: "0.2em" }}
    >
      {isAnimating ? "BOWLING..." : isComplete ? "MATCH OVER" : "BOWL DELIVERY"}
    </button>
  );
}
