"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { generateEmojiSummary, calculateScore } from "@/engine/simulation";
import type { BallOutcome, LeaderboardEntry } from "@/types/game";

export default function ResultScreen() {
  const match = useGameStore((s) => s.match);
  const ballLog = useGameStore((s) => s.ballLog);
  const daily = useGameStore((s) => s.daily);
  const resetGame = useGameStore((s) => s.resetGame);
  const [copied, setCopied] = useState(false);

  // Leaderboard state
  const [displayName, setDisplayName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  const result = match.result as "won" | "lost" | "tied";
  const date = daily?.date ?? new Date().toISOString().split("T")[0];
  const emoji = generateEmojiSummary(ballLog, result, date);
  const isDaily = daily !== null && daily.challengeId !== "custom";

  const score = calculateScore(
    match.target,
    match.runsConceded,
    match.wicketsTaken,
    match.ballsBowled,
    match.totalBalls,
    result
  );

  const fetchLeaderboard = useCallback(async () => {
    if (!isDaily) return;
    setLoadingBoard(true);
    try {
      const res = await fetch(`/api/leaderboard?challenge_id=${daily!.challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // silently fail — leaderboard is non-critical
    } finally {
      setLoadingBoard(false);
    }
  }, [isDaily, daily]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSubmitScore = async () => {
    if (!isDaily || !displayName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: daily!.challengeId,
          display_name: displayName.trim(),
          runs_conceded: match.runsConceded,
          wickets_taken: match.wicketsTaken,
          balls_used: match.ballsBowled,
          result,
          score,
          emoji_summary: emoji,
          ball_log: ballLog,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        fetchLeaderboard();
      } else {
        setSubmitError("Submission failed. Check your connection and try again.");
      }
    } catch {
      setSubmitError("Submission failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emoji);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = emoji;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        className="grid grid-cols-4 gap-4 p-6 rounded-2xl w-full"
        style={{ background: "#111a14", border: "1px solid #1e3d2a" }}
      >
        <StatCard label="RUNS GIVEN" value={match.runsConceded} />
        <StatCard label="WICKETS" value={match.wicketsTaken} />
        <StatCard label="BALLS" value={match.ballsBowled} />
        <StatCard label="SCORE" value={score} highlight />
      </div>

      {/* Ball-by-ball circle grid */}
      <div
        className="p-4 rounded-xl"
        style={{ background: "#111a14", border: "1px solid #1e3d2a" }}
      >
        <div className="flex gap-2 flex-wrap justify-center">
          {ballLog.map((ball, i) => (
            <BallCircle key={i} ball={ball} />
          ))}
        </div>
      </div>

      {/* Leaderboard submission (daily only) */}
      {isDaily && !submitted && (
        <div
          className="flex flex-col gap-3 items-center p-5 rounded-2xl w-full"
          style={{ background: "#111a14", border: "1px solid #1e3d2a", maxWidth: 400 }}
        >
          <p className="font-mono text-xs tracking-widest" style={{ color: "#00d4ff88" }}>
            SUBMIT YOUR SCORE
          </p>
          <input
            type="text"
            placeholder="Your name..."
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg font-mono text-sm"
            style={{
              background: "#0a0f0d",
              border: "1px solid #1e3d2a",
              color: "#e8f5ee",
              outline: "none",
            }}
          />
          <p className="self-end text-xs font-mono" style={{ color: "#4a7a5a" }}>
            {30 - displayName.length} left
          </p>
          <button
            onClick={handleSubmitScore}
            disabled={!displayName.trim() || submitting}
            className="w-full py-2.5 rounded-xl font-mono font-bold text-sm tracking-widest transition-all"
            style={{
              background: displayName.trim() ? "#00d4ff22" : "#ffffff05",
              border: `1px solid ${displayName.trim() ? "#00d4ff" : "#1e3d2a"}`,
              color: displayName.trim() ? "#00d4ff" : "#4a7a5a",
              opacity: submitting ? 0.6 : 1,
              cursor: displayName.trim() ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "SUBMITTING..." : "SUBMIT"}
          </button>
          {submitError && (
            <p className="text-xs font-mono text-center" style={{ color: "#ff4444" }}>
              {submitError}
            </p>
          )}
        </div>
      )}

      {submitted && (
        <p className="font-mono text-xs tracking-widest" style={{ color: "#00d4ff" }}>
          SCORE SUBMITTED!
        </p>
      )}

      {/* Leaderboard (daily only) */}
      {isDaily && (loadingBoard || leaderboard.length > 0) && (
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{ background: "#111a14", border: "1px solid #1e3d2a", maxWidth: 480 }}
        >
          <div className="px-5 py-3" style={{ borderBottom: "1px solid #1e3d2a" }}>
            <p className="font-mono text-xs font-bold tracking-widest" style={{ color: "#00d4ff88" }}>
              LEADERBOARD
            </p>
          </div>
          {loadingBoard && leaderboard.length === 0 ? (
            <p className="text-center py-4 font-mono text-xs" style={{ color: "#4a7a5a" }}>
              Loading leaderboard...
            </p>
          ) : (
            <div className="flex flex-col">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-5 py-2.5 font-mono text-sm"
                  style={{
                    borderBottom: i < Math.min(leaderboard.length, 10) - 1 ? "1px solid #1a2e2011" : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold"
                      style={{
                        color: i === 0 ? "#ffcc00" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#4a7a5a",
                        minWidth: 20,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "#e8f5ee" }}>{entry.display_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: "#6b8c76" }}>
                      {entry.runs_conceded}/{entry.wickets_taken} ({entry.balls_used}b)
                    </span>
                    <span className="font-bold" style={{ color: "#00d4ff" }}>
                      {entry.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loadingBoard && leaderboard.length > 0 && (
            <p className="text-center py-3 font-mono text-xs" style={{ color: "#4a7a5a" }}>
              Refreshing...
            </p>
          )}
        </div>
      )}

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
          {copied ? "COPIED!" : "SHARE RESULT"}
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

function BallCircle({ ball }: { ball: BallOutcome }) {
  let bg: string;
  let border: string;
  let label: string;
  let textColor = "#0a0f0d";

  if (ball.isWicket) {
    bg = "#c0392b";
    border = "#e74c3c";
    label = "W";
    textColor = "#fff";
  } else if (ball.chaosEvent === "dropped_catch" || ball.chaosEvent === "overthrow" || ball.chaosEvent === "misfield") {
    bg = "#e67e22";
    border = "#f39c12";
    label = String(ball.runsScored);
    textColor = "#fff";
  } else if (ball.runsScored === 0) {
    bg = "#1a3a2a";
    border = "#2e6b44";
    label = "\u2022";
    textColor = "#4caf78";
  } else if (ball.runsScored <= 2) {
    bg = "#b8860b";
    border = "#f0c030";
    label = String(ball.runsScored);
    textColor = "#fff8e0";
  } else if (ball.runsScored === 4) {
    bg = "#8b0000";
    border = "#e53935";
    label = "4";
    textColor = "#fff";
  } else if (ball.runsScored >= 6) {
    bg = "#6a0000";
    border = "#ff1744";
    label = "6";
    textColor = "#fff";
  } else {
    bg = "#b8860b";
    border = "#f0c030";
    label = String(ball.runsScored);
    textColor = "#fff8e0";
  }

  return (
    <div
      className="flex items-center justify-center rounded-full font-mono font-black select-none"
      style={{
        width: 48,
        height: 48,
        background: bg,
        border: `2px solid ${border}`,
        color: textColor,
        fontSize: label === "\u2022" ? 28 : 16,
        letterSpacing: 0,
        boxShadow: `0 0 8px ${border}55`,
      }}
    >
      {label}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-mono font-black"
        style={{ fontSize: "clamp(24px, 5vw, 36px)", color: highlight ? "#00d4ff" : "#e8f5ee" }}
      >
        {value}
      </span>
      <span className="text-xs font-mono tracking-widest" style={{ color: "#4a7a5a" }}>
        {label}
      </span>
    </div>
  );
}
