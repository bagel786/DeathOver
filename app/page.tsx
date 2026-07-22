"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { useTutorialStore } from "@/store/tutorialStore";
import NewPlayerModal from "@/components/tutorial/NewPlayerModal";
import type { DailyChallenge } from "@/types/game";
import { BOWLERS } from "@/engine/bowlers";

function IconUsers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blood)" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">
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
  const startTutorial = useTutorialStore((s) => s.startTutorial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customTarget, setCustomTarget] = useState(12);
  const [customWickets, setCustomWickets] = useState(3);
  const [bowlerId, setBowlerId] = useState(BOWLERS[0].id);
  const [stats, setStats] = useState<{ total_plays: number; unique_users: number } | null>(null);

  // New player modal state
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState<DailyChallenge | null>(null);
  const [pendingGameType, setPendingGameType] = useState<"daily" | "custom" | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  /** Check if this is a first-time player. Returns true if we showed the modal. */
  const checkNewPlayer = (type: "daily" | "custom"): boolean => {
    if (typeof window === "undefined") return false;
    if (localStorage.getItem("deathover_has_played")) return false;
    setPendingGameType(type);
    setShowNewPlayerModal(true);
    return true;
  };

  /** Execute the pending game after modal interaction */
  const executePendingGame = () => {
    if (pendingGameType === "daily" && pendingChallenge) {
      setDailyChallenge(pendingChallenge, bowlerId);
      router.push("/play");
    } else if (pendingGameType === "custom") {
      startGame({
        target: customTarget,
        totalBalls: 6,
        wicketsRemaining: customWickets,
        batsmanArchetype: "aggressive",
        batsmanName: "Power Hitter",
        nonStrikerArchetype: "accumulator",
        nonStrikerName: "The Rotator",
        bowlerId,
      });
      router.push("/play");
    }
  };

  const handleNewPlayerTutorial = () => {
    useGameStore.setState({ bowlerId: BOWLERS[0].id }); // tutorial copy assumes pace
    setShowNewPlayerModal(false);
    startTutorial("new_player_prompt");
    router.push("/play");
  };

  const handleNewPlayerSkip = () => {
    localStorage.setItem("deathover_has_played", "1");
    setShowNewPlayerModal(false);
    executePendingGame();
  };

  const handleDailyChallenge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-challenge", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch daily challenge");
      const challenge: DailyChallenge = await res.json();
      setPendingChallenge(challenge);
      if (checkNewPlayer("daily")) {
        setLoading(false);
        return;
      }
      setDailyChallenge(challenge, bowlerId);
      router.push("/play");
    } catch {
      setError("Could not load today's challenge. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGame = () => {
    if (checkNewPlayer("custom")) return;
    startGame({
      target: customTarget,
      totalBalls: 6,
      wicketsRemaining: customWickets,
      batsmanArchetype: "aggressive",
      batsmanName: "Power Hitter",
      nonStrikerArchetype: "accumulator",
      nonStrikerName: "The Rotator",
      bowlerId,
    });
    router.push("/play");
  };

  const handleHowToPlay = () => {
    // The tutorial copy names yorkers and slower balls, so it only makes sense
    // with a pace bowler in hand.
    useGameStore.setState({ bowlerId: BOWLERS[0].id });
    startTutorial("home_button");
    router.push("/play");
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-6"
      style={{ background: "var(--ink)" }}
    >
      {showNewPlayerModal && (
        <NewPlayerModal
          onStartTutorial={handleNewPlayerTutorial}
          onSkip={handleNewPlayerSkip}
        />
      )}

      {/* Title */}
      <div className="text-center w-full" style={{ maxWidth: 720 }}>
        <p className="brut-label" style={{ color: "var(--blood)", marginBottom: 12 }}>
          ▚▚ TACTICAL CRICKET SIMULATOR ▚▚
        </p>
        <h1
          className="brut-data-xl"
          style={{
            fontSize: "clamp(48px, 11vw, 110px)",
            lineHeight: 0.92,
            color: "var(--paper)",
            textTransform: "uppercase",
          }}
        >
          THE DEATH OVER
          <br />
          <span style={{ color: "var(--blood)" }}>CHALLENGE</span>
        </h1>
        <hr className="brut-rule" style={{ margin: "20px auto", maxWidth: 480 }} />
        <p className="font-mono text-sm" style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto" }}>
          Set your field. Pick your delivery. Bluff the batsman.
          <br />
          Defend your total in the final over — or watch it slip away.
        </p>
      </div>

      {/* Bowler pick — applies to whichever mode you start */}
      <div className="w-full flex flex-col gap-2" style={{ maxWidth: 400 }}>
        <p className="brut-label" style={{ color: "var(--muted)" }}>WHO BOWLS THE OVER</p>
        <div className="flex flex-col gap-1.5">
          {BOWLERS.map((b) => {
            const active = bowlerId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setBowlerId(b.id)}
                className="px-3 py-2.5 text-left"
                style={{
                  background: "var(--ink)",
                  border: `2px solid ${active ? "var(--blood)" : "var(--faint)"}`,
                  cursor: "pointer",
                  transition: "border-color 80ms steps(2)",
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-mono font-bold text-xs uppercase tracking-widest"
                    style={{ color: active ? "var(--blood)" : "var(--paper)" }}
                  >
                    {b.name}
                  </span>
                  <span
                    className="font-mono text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--faint)" }}
                  >
                    {b.type}
                  </span>
                </span>
                <span
                  className="block font-mono text-[10px] mt-1 leading-snug"
                  style={{ color: "var(--muted)" }}
                >
                  {b.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode buttons */}
      <div className="flex flex-col gap-4 w-full" style={{ maxWidth: 400 }}>
        <button
          onClick={handleDailyChallenge}
          disabled={loading}
          className="brut-btn brut-btn--primary w-full text-sm"
          style={{ padding: "1rem", letterSpacing: "0.2em", opacity: loading ? 0.6 : 1, cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "LOADING..." : "DAILY CHALLENGE"}
          <span className="block text-[10px] font-normal mt-1" style={{ opacity: 0.85 }}>
            DEFEND A NEW TOTAL EVERY DAY
          </span>
        </button>

        {error && (
          <p className="text-xs font-mono font-bold text-center uppercase tracking-widest" style={{ color: "var(--blood)" }}>
            {error}
          </p>
        )}

        <div className="w-full" style={{ border: "2px solid var(--paper)" }}>
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="w-full py-3.5 font-mono font-bold text-sm tracking-widest text-center uppercase"
            style={{ color: "var(--paper)", cursor: "pointer", background: "var(--ink)", border: "none" }}
          >
            CUSTOM GAME
            <span className="block text-[10px] mt-1" style={{ color: "var(--muted)" }}>
              {showCustom ? "[ − ] HIDE OPTIONS" : "[ + ] SET YOUR OWN TARGET"}
            </span>
          </button>

          {showCustom && (
            <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: "2px solid var(--paper)" }}>
              {/* Target runs */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex justify-between items-center brut-label">
                  <span>RUNS TO DEFEND</span>
                  <span className="brut-data-xl" style={{ color: "var(--blood)", fontSize: 22 }}>{customTarget}</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={36}
                  value={customTarget}
                  onChange={(e) => setCustomTarget(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--blood)" }}
                />
                <div className="flex justify-between font-mono text-[10px]" style={{ color: "var(--faint)" }}>
                  <span>6</span><span>36</span>
                </div>
              </div>

              {/* Wickets remaining */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center brut-label">
                  <span>WICKETS IN HAND</span>
                  <span className="brut-data-xl" style={{ color: "var(--blood)", fontSize: 22 }}>{customWickets}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={customWickets}
                  onChange={(e) => setCustomWickets(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--blood)" }}
                />
                <div className="flex justify-between font-mono text-[10px]" style={{ color: "var(--faint)" }}>
                  <span>1</span><span>10</span>
                </div>
              </div>

              <button onClick={handleCustomGame} className="brut-btn w-full text-sm">
                START GAME
              </button>
            </div>
          )}
        </div>
      </div>

      {/* HOW TO PLAY — always accessible tutorial entry */}
      <button
        onClick={handleHowToPlay}
        className="font-mono font-bold text-xs tracking-widest py-2 px-5 uppercase"
        style={{
          border: "2px solid var(--faint)",
          color: "var(--muted)",
          background: "var(--ink)",
          cursor: "pointer",
        }}
      >
        HOW TO PLAY →
      </button>

      {/* Play stats */}
      {stats && (
        <p className="font-mono text-xs text-center uppercase tracking-widest" style={{ color: "var(--faint)" }}>
          <span style={{ color: "var(--paper)" }}>{stats.total_plays.toLocaleString()}</span> GAMES
          {" // "}
          <span style={{ color: "var(--paper)" }}>{stats.unique_users.toLocaleString()}</span> PLAYERS
        </p>
      )}

      {/* How it works */}
      <div
        className="grid grid-cols-3 font-mono w-full"
        style={{ border: "2px solid var(--paper)", maxWidth: 480 }}
      >
        {[
          { Icon: IconUsers, title: "PLACE 9", sub: "Drag fielders into position", n: "01" },
          { Icon: IconTarget, title: "DECEIVE", sub: "Bluff the AI batsman", n: "02" },
          { Icon: IconTrophy, title: "DEFEND", sub: "Keep the runs down", n: "03" },
        ].map(({ Icon, title, sub, n }, i) => (
          <div
            key={title}
            className="flex flex-col items-center text-center gap-2 p-4"
            style={{ borderLeft: i === 0 ? "none" : "2px solid var(--paper)" }}
          >
            <span className="brut-label" style={{ color: "var(--blood)" }}>{n}</span>
            <Icon />
            <span className="text-xs font-bold tracking-widest" style={{ color: "var(--paper)" }}>
              {title}
            </span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{sub}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
