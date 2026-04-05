"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { generateEmojiSummary } from "@/engine/simulation";

export default function ResultScreen() {
  const match = useGameStore((s) => s.match);
  const ballLog = useGameStore((s) => s.ballLog);
  const daily = useGameStore((s) => s.daily);
  const resetGame = useGameStore((s) => s.resetGame);
  const [copied, setCopied] = useState(false);

  const result = match.result as "won" | "lost" | "tied";
  const date = daily?.date ?? new Date().toISOString().split("T")[0];
  const emoji = generateEmojiSummary(ballLog, result, date);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emoji);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const titleMap = {
    won:  { text: "DEFENDED!", color: "#00d4ff", sub: "You kept them out. Well bowled, captain." },
    lost: { text: "CHASED DOWN", color: "#ff4444", sub: "They got there. Review your field next time." },
    tied: { text: "TIED!", color: "#ffcc00", sub: "One run either way. What a finish." },
  };
  const { text, color, sub } = titleMap[result];

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "#0a0f0d" }}
    >
      {/* Result heading */}
      <div className="text-center">
        <h1
          className="font-mono font-black tracking-widest"
          style={{ fontSize: "clamp(36px, 8vw, 64px)", color }}
        >
          {text}
        </h1>
        <p className="font-mono mt-2" style={{ color: "#6b8c76" }}>{sub}</p>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-3 gap-4 p-6 rounded-2xl"
        style={{ background: "#111a14", border: "1px solid #1e3d2a", minWidth: 320 }}
      >
        <StatCard label="RUNS GIVEN" value={match.runsConceded} />
        <StatCard label="WICKETS" value={match.wicketsTaken} />
        <StatCard label="BALLS" value={match.ballsBowled} />
      </div>

      {/* Emoji grid */}
      <div
        className="p-4 rounded-xl font-mono text-sm whitespace-pre text-center"
        style={{
          background: "#111a14",
          border: "1px solid #1e3d2a",
          color: "#e8f5ee",
          lineHeight: 1.8,
        }}
      >
        {emoji}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={handleCopy}
          className="px-6 py-2.5 rounded-xl font-mono font-bold text-sm tracking-widest transition-all"
          style={{
            background: copied ? "#00d4ff33" : "#00d4ff22",
            border: "1px solid #00d4ff",
            color: "#00d4ff",
          }}
        >
          {copied ? "COPIED! ✓" : "SHARE RESULT"}
        </button>

        <button
          onClick={resetGame}
          className="px-6 py-2.5 rounded-xl font-mono text-sm tracking-widest transition-all"
          style={{
            background: "#ffffff08",
            border: "1px solid #1e3d2a",
            color: "#6b8c76",
          }}
        >
          PLAY AGAIN
        </button>

        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl font-mono text-sm tracking-widest"
          style={{
            background: "#ffffff05",
            border: "1px solid #1a2e20",
            color: "#4a7a5a",
          }}
        >
          HOME
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-mono font-black"
        style={{ fontSize: "clamp(24px, 5vw, 36px)", color: "#e8f5ee" }}
      >
        {value}
      </span>
      <span className="text-xs font-mono tracking-widest" style={{ color: "#4a7a5a" }}>
        {label}
      </span>
    </div>
  );
}
