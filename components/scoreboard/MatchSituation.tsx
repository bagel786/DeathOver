"use client";

import { useGameStore } from "@/store/gameStore";
import { getOutcomeCell, EMPTY_CELL } from "@/lib/outcomeStyle";

export default function MatchSituation() {
  const match = useGameStore((s) => s.match);
  const batsman = useGameStore((s) => s.batsman);
  const nonStriker = useGameStore((s) => s.nonStriker);

  const runsNeeded = Math.max(0, match.target - match.runsConceded);
  const ballsLeft = match.totalBalls - match.ballsBowled;
  const wktsLeft = match.wicketsRemaining;
  const rro = ballsLeft > 0 ? (runsNeeded / ballsLeft) * 6 : 0;
  const isHigh = rro > 10;
  const isMed = rro > 7;

  // Pressure / danger only ever expressed in red vs white — no rainbow.
  const danger = isHigh || wktsLeft <= 1;

  return (
    <div
      data-tutorial="match-situation"
      className="flex flex-col"
      style={{ background: "var(--ink)", border: "2px solid var(--paper)", minWidth: 220 }}
    >
      {/* Header bar */}
      <div
        className="flex justify-between items-center px-3 py-2"
        style={{ borderBottom: "2px solid var(--paper)" }}
      >
        <span className="brut-label">MATCH // SITUATION</span>
        <span className="brut-label" style={{ color: "var(--blood)" }}>FINAL OVER</span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* Main readout: RUNS off BALLS */}
        <div className="flex items-baseline gap-2">
          <span className="brut-data-xl" style={{ fontSize: "clamp(34px, 6vw, 52px)", color: "var(--paper)" }}>
            {String(runsNeeded).padStart(2, "0")}
          </span>
          <span className="brut-label" style={{ alignSelf: "flex-end", marginBottom: 4 }}>RNS</span>
          <span className="brut-label" style={{ alignSelf: "flex-end", marginBottom: 4, color: "var(--faint)" }}>OFF</span>
          <span
            className="brut-data-xl"
            style={{ fontSize: "clamp(24px, 4.5vw, 36px)", color: danger ? "var(--blood)" : "var(--paper)" }}
          >
            {ballsLeft}
          </span>
          <span className="brut-label" style={{ alignSelf: "flex-end", marginBottom: 4 }}>BLS</span>
        </div>

        {/* Wickets remaining */}
        <div className="flex items-baseline gap-2">
          <span
            className="brut-data-xl"
            style={{ fontSize: "clamp(18px, 3.5vw, 26px)", color: wktsLeft <= 1 ? "var(--blood)" : "var(--paper)" }}
          >
            {wktsLeft}
          </span>
          <span className="brut-label">WKT{wktsLeft !== 1 ? "S" : ""} IN HAND</span>
          {match.wicketsTaken > 0 && (
            <span className="brut-label ml-auto" style={{ color: "var(--blood)" }}>
              {match.wicketsTaken} TAKEN
            </span>
          )}
        </div>

        <hr className="brut-rule brut-rule--dashed" />

        {/* Required run rate */}
        <div className="flex items-center gap-2">
          <span className="brut-label">RRR</span>
          <span
            className="font-mono font-bold text-sm"
            style={{ color: danger ? "var(--blood)" : "var(--paper)", fontVariantNumeric: "tabular-nums" }}
          >
            {rro > 0 ? rro.toFixed(1) : "—"}
          </span>
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-widest"
            style={{
              background: danger ? "var(--blood)" : "var(--ink)",
              border: `2px solid ${danger ? "var(--blood)" : "var(--paper)"}`,
              color: danger ? "var(--paper)" : "var(--paper)",
            }}
          >
            {isHigh ? "HIGH" : isMed ? "MED" : "LOW"}
          </span>
          <span className="brut-label" style={{ color: "var(--faint)" }}>PER OVER</span>
        </div>

        {/* Ball log */}
        <BallDots />

        <hr className="brut-rule" />

        {/* Batsmen */}
        <BatsmanLine name={batsman.name} hand={batsman.hand} runs={batsman.runsScored} balls={batsman.ballsFaced} isStriker />
        <BatsmanLine name={nonStriker.name} hand={nonStriker.hand} runs={nonStriker.runsScored} balls={nonStriker.ballsFaced} />
      </div>
    </div>
  );
}

function BallDots() {
  const ballLog = useGameStore((s) => s.ballLog);
  const totalBalls = useGameStore((s) => s.match.totalBalls);
  const ballsBowled = useGameStore((s) => s.match.ballsBowled);

  const emptySlots = totalBalls - ballsBowled;
  const totalSlots = ballLog.length + emptySlots;

  return (
    <div className="flex flex-col gap-1" data-tutorial="ball-dots">
      <span className="brut-label" style={{ color: "var(--faint)" }}>OVER LOG</span>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const ball = ballLog[i];
          const cell = ball ? getOutcomeCell(ball) : EMPTY_CELL;
          const isExtra = !!ball && (ball.chaosEvent === "wide" || ball.chaosEvent === "no_ball");
          return (
            <div
              key={i}
              className={`h-6 flex items-center justify-center text-[11px] font-bold font-mono ${isExtra ? "px-1" : "w-6"}`}
              style={{ background: cell.fill, border: `2px solid ${cell.border}`, color: cell.text }}
            >
              {cell.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BatsmanLine({
  name,
  hand,
  runs,
  balls,
  isStriker = false,
}: {
  name: string;
  hand: import("@/types/game").BattingHand;
  runs: number;
  balls: number;
  isStriker?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs font-mono font-bold"
          style={{ color: isStriker ? "var(--blood)" : "transparent" }}
        >
          {">"}
        </span>
        <span
          className="text-sm font-mono font-bold uppercase tracking-wide"
          style={{ color: isStriker ? "var(--paper)" : "var(--muted)" }}
        >
          {name}
        </span>
        <span
          className="text-[0.55rem] font-mono font-bold px-1 py-0.5 leading-none"
          style={{
            color: hand === "left" ? "var(--blood)" : "var(--muted)",
            border: `1px solid ${hand === "left" ? "var(--blood)" : "var(--faint)"}`,
          }}
          title={hand === "left" ? "Left-handed batsman" : "Right-handed batsman"}
        >
          {hand === "left" ? "LHB" : "RHB"}
        </span>
      </div>
      <span
        className="text-xs font-mono"
        style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}
      >
        {runs} ({balls})
      </span>
    </div>
  );
}
