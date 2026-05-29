"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { generateEmojiSummary, calculateScore } from "@/engine/simulation";
import { getOutcomeCell, type OutcomeLike } from "@/lib/outcomeStyle";
import type { BallOutcome, LeaderboardEntry } from "@/types/game";

/** Returns a persistent anonymous user ID stored in localStorage. */
function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "deathoverId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // Simple UUID-v4-ish without crypto dependency
    id = "u-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(KEY, id);
  }
  return id;
}

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
  const [leaderboardError, setLeaderboardError] = useState(false);

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

  // Record this play once on mount
  useEffect(() => {
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymous_user_id: getOrCreateUserId(),
        is_daily: isDaily,
        result,
      }),
    }).catch(() => { /* non-critical — ignore failures */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    if (!isDaily) return;
    setLoadingBoard(true);
    setLeaderboardError(false);
    try {
      const res = await fetch(`/api/leaderboard?challenge_id=${daily!.challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      setLeaderboardError(true);
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
      // clipboard API unavailable — nothing to fall back to cleanly
    }
  };

  const titleMap = {
    won:  { text: "DEFENDED", color: "var(--paper)", sub: "You kept them out. Well bowled, captain." },
    lost: { text: "CHASED DOWN", color: "var(--blood)", sub: "They got there. Review your field next time." },
    tied: { text: "TIED", color: "var(--blood)", sub: "One run either way. What a finish." },
  };
  const { text, color, sub } = titleMap[result];

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "var(--ink)" }}
    >
      {/* Result heading */}
      <div className="text-center w-full" style={{ maxWidth: 560 }}>
        <p className="brut-label" style={{ color: "var(--blood)", marginBottom: 8 }}>▚▚ RESULT ▚▚</p>
        <h1 className="brut-data-xl" style={{ fontSize: "clamp(40px, 9vw, 72px)", color }}>
          {text}
        </h1>
        <hr className="brut-rule" style={{ margin: "16px auto", maxWidth: 360 }} />
        <p className="font-mono text-sm" style={{ color: "var(--muted)" }}>{sub}</p>
      </div>

      {/* Stats — white background shows through 2px gaps as grid rules */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 w-full"
        style={{ border: "2px solid var(--paper)", background: "var(--paper)", gap: 2, maxWidth: 560 }}
      >
        <StatCard label="RUNS GIVEN" value={match.runsConceded} />
        <StatCard label="WICKETS" value={match.wicketsTaken} />
        <StatCard label="BALLS" value={match.ballsBowled} />
        <StatCard label="SCORE" value={score} highlight />
      </div>

      {/* Ball-by-ball grid */}
      <div className="p-4" style={{ border: "2px solid var(--paper)" }}>
        <div className="flex gap-2 flex-wrap justify-center">
          {ballLog.map((ball, i) => (
            <BallCircle key={i} ball={ball} />
          ))}
        </div>
      </div>

      {/* Leaderboard submission (daily only) */}
      {isDaily && !submitted && (
        <div
          className="flex flex-col gap-3 items-center p-5 w-full"
          style={{ border: "2px solid var(--paper)", maxWidth: 400 }}
        >
          <p className="brut-label" style={{ color: "var(--blood)" }}>SUBMIT YOUR SCORE</p>
          <input
            type="text"
            placeholder="YOUR NAME..."
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 font-mono text-sm uppercase"
            style={{
              background: "var(--ink)",
              border: "2px solid var(--faint)",
              color: "var(--paper)",
              outline: "none",
            }}
          />
          <p className="self-end text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--faint)" }}>
            {30 - displayName.length} LEFT
          </p>
          <button
            onClick={handleSubmitScore}
            disabled={!displayName.trim() || submitting}
            className={`brut-btn w-full text-sm${displayName.trim() ? " brut-btn--primary" : ""}`}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "SUBMITTING..." : "SUBMIT"}
          </button>
          {submitError && (
            <p className="text-xs font-mono font-bold text-center uppercase tracking-wide" style={{ color: "var(--blood)" }}>
              {submitError}
            </p>
          )}
        </div>
      )}

      {submitted && (
        <p className="brut-label" style={{ color: "var(--blood)" }}>
          ✓ SCORE SUBMITTED
        </p>
      )}

      {/* Leaderboard (daily only) */}
      {isDaily && (loadingBoard || leaderboard.length > 0) && (
        <div className="w-full" style={{ border: "2px solid var(--paper)", maxWidth: 480 }}>
          <div className="px-5 py-3" style={{ borderBottom: "2px solid var(--paper)" }}>
            <p className="brut-label" style={{ color: "var(--blood)" }}>LEADERBOARD</p>
          </div>
          {loadingBoard && leaderboard.length === 0 ? (
            <p className="text-center py-4 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Loading leaderboard...
            </p>
          ) : leaderboardError && leaderboard.length === 0 ? (
            <p className="text-center py-4 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--blood)" }}>
              Failed to load leaderboard.
            </p>
          ) : (
            <div className="flex flex-col">
              {leaderboard.slice(0, 20).map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-5 py-2.5 font-mono text-sm"
                  style={{
                    borderBottom: i < Math.min(leaderboard.length, 20) - 1 ? "1px solid var(--hair)" : undefined,
                    background: i === 0 ? "var(--blood-wash)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold"
                      style={{ color: i === 0 ? "var(--blood)" : "var(--muted)", minWidth: 24, fontVariantNumeric: "tabular-nums" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="uppercase tracking-wide" style={{ color: "var(--paper)" }}>{entry.display_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {entry.runs_conceded}/{entry.wickets_taken} ({entry.balls_used}b)
                    </span>
                    <span className="font-bold" style={{ color: "var(--blood)", fontVariantNumeric: "tabular-nums" }}>
                      {entry.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loadingBoard && leaderboard.length > 0 && (
            <p className="text-center py-3 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Refreshing...
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={handleCopy} className="brut-btn brut-btn--primary text-sm">
          {copied ? "COPIED!" : "SHARE RESULT"}
        </button>

        <button onClick={resetGame} className="brut-btn text-sm">
          PLAY AGAIN
        </button>

        <Link href="/" className="brut-btn text-sm flex items-center">
          HOME
        </Link>
      </div>
    </main>
  );
}

function BallCircle({ ball }: { ball: BallOutcome }) {
  const cell = getOutcomeCell(ball as OutcomeLike);
  return (
    <div
      className="flex items-center justify-center font-mono font-black select-none"
      style={{
        width: 44,
        height: 44,
        background: cell.fill,
        border: `2px solid ${cell.border}`,
        color: cell.text,
        fontSize: cell.label === "\u00b7" ? 28 : 16,
        letterSpacing: 0,
      }}
    >
      {cell.label}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 py-5" style={{ background: "var(--ink)" }}>
      <span
        className="brut-data-xl"
        style={{ fontSize: "clamp(24px, 5vw, 36px)", color: highlight ? "var(--blood)" : "var(--paper)" }}
      >
        {value}
      </span>
      <span className="brut-label">{label}</span>
    </div>
  );
}
