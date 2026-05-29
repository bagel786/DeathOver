/**
 * Shared brutalist encoding for ball outcomes.
 *
 * Strict palette — pure black (--ink), pure white (--paper), one accent
 * (--blood, cricket-ball red). Outcomes are distinguished by FILL INVERSION
 * and red, never a rainbow:
 *   - dot            → outlined cell, white border, "·"
 *   - 1/2/3 runs     → solid white fill, black digit
 *   - four / six     → solid red fill, white digit (boundary = the threat)
 *   - wicket         → inverted solid white block, black "W"
 *   - chaos (wide / no-ball / drop / overthrow) → red outline + label
 *
 * Used by MatchSituation, FeedbackPanel, and ResultScreen so the three views
 * never diverge.
 */

const INK = "var(--ink)";
const PAPER = "var(--paper)";
const BLOOD = "var(--blood)";

export interface OutcomeCell {
  /** short glyph/text shown inside the cell */
  label: string;
  /** background fill */
  fill: string;
  /** text color */
  text: string;
  /** border color */
  border: string;
  /** longer human label for badges (e.g. "FOUR", "WICKET") */
  longLabel: string;
}

/** Minimal shape we read off a BallOutcome. */
export interface OutcomeLike {
  isWicket: boolean;
  runsScored: number;
  chaosEvent?: string | null;
}

/** Empty ball slot (not yet bowled). */
export const EMPTY_CELL: OutcomeCell = {
  label: "",
  fill: INK,
  text: "var(--faint)",
  border: "var(--faint)",
  longLabel: "—",
};

export function getOutcomeCell(ball: OutcomeLike): OutcomeCell {
  // Extras get a red outline + compact label.
  if (ball.chaosEvent === "no_ball") {
    return {
      label: `NB${ball.runsScored}`,
      fill: INK,
      text: BLOOD,
      border: BLOOD,
      longLabel: "NO BALL",
    };
  }
  if (ball.chaosEvent === "wide") {
    return {
      label: `WD${ball.runsScored}`,
      fill: INK,
      text: BLOOD,
      border: BLOOD,
      longLabel: "WIDE",
    };
  }

  // Wicket — inverted solid white block, black "W".
  if (ball.isWicket) {
    return {
      label: "W",
      fill: PAPER,
      text: INK,
      border: PAPER,
      longLabel: "WICKET",
    };
  }

  // Boundaries — solid red fill, the only thing that "bleeds".
  if (ball.runsScored >= 6) {
    return { label: "6", fill: BLOOD, text: PAPER, border: BLOOD, longLabel: "SIX" };
  }
  if (ball.runsScored >= 4) {
    return { label: "4", fill: BLOOD, text: PAPER, border: BLOOD, longLabel: "FOUR" };
  }

  // 1–3 runs — solid white fill, black digit.
  if (ball.runsScored > 0) {
    return {
      label: String(ball.runsScored),
      fill: PAPER,
      text: INK,
      border: PAPER,
      longLabel:
        ball.runsScored === 1 ? "SINGLE" : ball.runsScored === 2 ? "TWO" : "THREE",
    };
  }

  // Dot — outlined cell.
  return {
    label: "·", // ·
    fill: INK,
    text: PAPER,
    border: PAPER,
    longLabel: "DOT",
  };
}

/** Non-extra chaos flag (dropped catch, overthrow, misfield, etc.). */
export function isNotableChaos(chaosEvent?: string | null): boolean {
  return (
    !!chaosEvent &&
    chaosEvent !== "wide" &&
    chaosEvent !== "no_ball"
  );
}
