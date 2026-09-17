/**
 * Leaderboard Score Calculator — shared by the client engine and server
 * (bot seeding) so both always compute identical scores.
 */

export type ScoreResult = "won" | "lost" | "tied";

export function calculateScore(
  target: number,
  runsConceded: number,
  wicketsTaken: number,
  ballsUsed: number,
  totalBalls: number,
  result: ScoreResult
): number {
  let score = 0;

  if (result === "won") score += 1000;
  if (result === "tied") score += 500;

  const runsSaved = target - runsConceded;
  score += runsSaved * 50;
  score += wicketsTaken * 150;

  if (result === "won") {
    const ballsRemaining = totalBalls - ballsUsed;
    score += ballsRemaining * 75;
  }

  return Math.max(0, score);
}
