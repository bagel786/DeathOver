"use client";

import { useGameStore } from "@/store/gameStore";

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
  const wktColor = wktsLeft <= 1 ? "#ff4444" : wktsLeft <= 3 ? "#ffcc00" : "#4fc3f7";

  const rrColor = isHigh ? "#ff4444" : isMed ? "#ffcc00" : "#00d4ff";

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{
        background: "rgba(10,15,13,0.9)",
        border: "1px solid #1e3d2a",
        backdropFilter: "blur(8px)",
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono tracking-widest" style={{ color: "#6b8c76" }}>
          MATCH SITUATION
        </span>
        <span className="text-xs font-mono" style={{ color: "#4a7a5a" }}>
          FINAL OVER
        </span>
      </div>

      {/* Main score display: RUNS off BALLS */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono font-bold leading-none"
          style={{ fontSize: "clamp(28px, 5vw, 42px)", color: "#e8f5ee" }}
        >
          {runsNeeded}
        </span>
        <span className="font-mono text-base" style={{ color: "#6b8c76" }}>RNS</span>
        <span className="font-mono ml-1" style={{ color: "#4a7a5a", fontSize: 13 }}>OFF</span>
        <span
          className="font-mono font-bold"
          style={{ fontSize: "clamp(20px, 4vw, 30px)", color: rrColor }}
        >
          {ballsLeft}
        </span>
        <span className="font-mono text-sm" style={{ color: rrColor }}>BLS</span>
      </div>

      {/* Wickets remaining — own line */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono font-bold"
          style={{ fontSize: "clamp(18px, 3.5vw, 26px)", color: wktColor }}
        >
          {wktsLeft}
        </span>
        <span className="font-mono text-sm" style={{ color: wktColor }}>WKT{wktsLeft !== 1 ? "S" : ""}</span>
      </div>

      {/* Required run rate + fallen wickets */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono" style={{ color: "#4a7a5a" }}>RRR</span>
        <span className="text-sm font-mono font-bold" style={{ color: rrColor }}>
          {rro > 0 ? rro.toFixed(1) : "—"}
        </span>
        <span className="text-xs font-mono" style={{ color: "#4a7a5a" }}>per over</span>
        {match.wicketsTaken > 0 && (
          <span className="ml-auto text-xs font-mono" style={{ color: "#ff444488" }}>
            {match.wicketsTaken} fallen
          </span>
        )}
      </div>

      {/* Ball dots */}
      <BallDots />

      {/* Divider */}
      <div style={{ borderTop: "1px solid #1e3d2a" }} />

      {/* Batsmen */}
      <BatsmanLine name={batsman.name} runs={batsman.runsScored} balls={batsman.ballsFaced} isStriker />
      <BatsmanLine name={nonStriker.name} runs={nonStriker.runsScored} balls={nonStriker.ballsFaced} />
    </div>
  );
}

function BallDots() {
  const ballLog = useGameStore((s) => s.ballLog);
  const totalBalls = useGameStore((s) => s.match.totalBalls);

  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: totalBalls }).map((_, i) => {
        const ball = ballLog[i];
        if (!ball) {
          return (
            <div
              key={i}
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "#1a2e20", border: "1px solid #2d4a35" }}
            />
          );
        }
        const color =
          ball.isWicket ? "#ff4444"
          : ball.runsScored >= 6 ? "#9c27b0"
          : ball.runsScored >= 4 ? "#ff9800"
          : ball.runsScored > 0 ? "#ffcc00"
          : "#2d6a45";
        const label =
          ball.isWicket ? "W"
          : ball.runsScored >= 6 ? "6"
          : ball.runsScored >= 4 ? "4"
          : ball.runsScored === 0 ? "•"
          : String(ball.runsScored);

        return (
          <div
            key={i}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            style={{ background: color + "33", border: `1px solid ${color}`, color }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function BatsmanLine({
  name,
  runs,
  balls,
  isStriker = false,
}: {
  name: string;
  runs: number;
  balls: number;
  isStriker?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {isStriker && (
          <span className="text-xs" style={{ color: "#00d4ff" }}>▶</span>
        )}
        <span
          className="text-sm font-mono font-semibold"
          style={{ color: isStriker ? "#e8f5ee" : "#6b8c76" }}
        >
          {name}
        </span>
      </div>
      <span className="text-xs font-mono" style={{ color: "#6b8c76" }}>
        {runs} ({balls})
      </span>
    </div>
  );
}
