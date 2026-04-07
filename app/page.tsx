"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { DailyChallenge } from "@/types/game";

function IconUsers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b8c76" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffcc00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const setDailyChallenge = useGameStore((s) => s.setDailyChallenge);
  const startGame = useGameStore((s) => s.startGame);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDailyChallenge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-challenge");
      if (!res.ok) throw new Error("Failed to fetch daily challenge");
      const challenge: DailyChallenge = await res.json();
      setDailyChallenge(challenge);
      router.push("/play");
    } catch {
      setError("Could not load today's challenge. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGame = () => {
    startGame({
      target: 12,
      totalBalls: 6,
      batsmanArchetype: "aggressive",
      batsmanName: "Power Hitter",
      nonStrikerArchetype: "accumulator",
      nonStrikerName: "The Rotator",
    });
    router.push("/play");
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
      style={{ background: "#000000" }}
    >
      {/* Title */}
      <div className="text-center">
        <h1
          style={{
            fontFamily: "var(--font-anton), Impact, sans-serif",
            fontSize: "clamp(56px, 12vw, 120px)",
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: "#ffffff",
            textTransform: "uppercase",
          }}
        >
          THE DEATH OVER
          <br />
          <span style={{ color: "#00d4ff" }}>CHALLENGE</span>
        </h1>
        <p className="font-mono text-sm mt-4" style={{ color: "#6b8c76", maxWidth: 480, margin: "16px auto 0" }}>
          Set your field. Pick your delivery. Bluff the batsman.
          <br />
          Defend your total in the final over — or watch it slip away.
        </p>
      </div>

      {/* Mode buttons */}
      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 400 }}>
        <button
          onClick={handleDailyChallenge}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-mono font-bold text-sm tracking-widest text-center transition-all"
          style={{
            background: "linear-gradient(135deg, #00d4ff18, #00d4ff30)",
            border: "1px solid #00d4ff",
            color: "#00d4ff",
            boxShadow: "0 0 30px rgba(0,212,255,0.1)",
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "LOADING..." : "DAILY CHALLENGE"}
          <span className="block text-xs font-normal mt-0.5" style={{ color: "#00d4ff88" }}>
            Defend a new total every day!
          </span>
        </button>

        {error && (
          <p className="text-xs font-mono text-center" style={{ color: "#ff4444" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleCustomGame}
          className="w-full py-3.5 rounded-2xl font-mono text-sm tracking-widest text-center"
          style={{
            background: "#ffffff05",
            border: "1px solid #1e3d2a",
            color: "#6b8c76",
            cursor: "pointer",
          }}
        >
          CUSTOM GAME
          <span className="block text-xs mt-0.5" style={{ color: "#4a7a5a" }}>
            Set your own target and overs
          </span>
        </button>
      </div>

      {/* How it works */}
      <div
        className="grid grid-cols-3 gap-6 p-5 rounded-2xl font-mono"
        style={{
          background: "#0d0d0d",
          border: "1px solid #1a2e20",
          maxWidth: 480,
          width: "100%",
        }}
      >
        {[
          { Icon: IconUsers, title: "PLACE 9", sub: "Drag fielders into position" },
          { Icon: IconTarget, title: "DECEIVE", sub: "Bluff the AI batsman" },
          { Icon: IconTrophy, title: "DEFEND", sub: "Keep the runs down" },
        ].map(({ Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-center text-center gap-2">
            <Icon />
            <span className="text-xs font-bold tracking-widest" style={{ color: "#e8f5ee" }}>
              {title}
            </span>
            <span className="text-[10px]" style={{ color: "#4a7a5a" }}>{sub}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
