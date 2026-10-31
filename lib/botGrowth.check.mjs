import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const db = { game_sessions: [], leaderboard_entries: [] };
let failBoard = false;
const mock = { from(table) {
  let rows; let error = null;
  return {
    upsert(values) {
      if (table === "leaderboard_entries" && failBoard) error = { message: "transient outage" };
      else for (const row of values) if (!db[table].some((other) => other.id === row.id)) db[table].push(row);
      return Promise.resolve({ error });
    },
  };
} };
globalThis.__growthDb = mock;
registerHooks({ resolve(spec, ctx, next) {
  if (spec === "@/lib/supabaseAdmin") return next(`data:text/javascript,${encodeURIComponent("export const supabaseAdmin = globalThis.__growthDb;")}`, ctx);
  if (spec.startsWith("@/")) return next(pathToFileURL(resolve(spec.slice(2) + ".ts")).href, ctx);
  return next(spec, ctx);
} });

const { dailyBotActivity, growthBudget, reportedTotals, botHandle, CAP_END } = await import("@/lib/botGrowth");
const { seedBotsForChallenge } = await import("@/lib/botLeaderboard");
const nov1 = Date.parse("2026-11-01T00:00:00Z");
const dec1 = Date.parse("2026-12-01T00:00:00Z");
assert.deepEqual(growthBudget(nov1), { games: 0, profiles: 0 });
assert.deepEqual(growthBudget(dec1), { games: 2196, profiles: 273 });
assert.deepEqual(growthBudget(CAP_END), { games: 5596, profiles: 1373 });
assert.equal(reportedTotals(34804, 12027, 2196, 273, dec1).total_plays, 31500);
assert.equal(reportedTotals(34804, 12027, 2196, 273, dec1).unique_users, 10500);

const games = [], identities = new Set();
for (let time = nov1; time < CAP_END; time += 86400000) {
  const date = new Date(time).toISOString().slice(0, 10);
  const day = dailyBotActivity(date);
  assert.deepEqual(day, dailyBotActivity(date));
  for (const game of day) {
    assert.ok(Date.parse(game.created_at) >= time && Date.parse(game.created_at) < time + 86400000);
    assert.ok(game.display_name.endsWith(" [AI]") && game.display_name.length <= 30);
    identities.add(game.anonymous_user_id);
    games.push(game);
  }
  const budget = growthBudget(time + 86400000);
  assert.equal(games.length, budget.games);
  assert.equal(identities.size, budget.profiles);
  const totals = reportedTotals(34804, 12027, games.length, identities.size, time + 86399999);
  assert.ok(totals.total_plays < 35000);
}
assert.equal(new Set(games.map((game) => game.id)).size, games.length);
assert.equal(new Set(Array.from({ length: 1400 }, (_, i) => botHandle(i))).size, 1400);
assert.ok(reportedTotals(34804, 12027, growthBudget(CAP_END + 4 * 86400000).games, 1400, CAP_END + 4 * 86400000).total_plays > 35000);
assert.equal(reportedTotals(39000, 12027, 5596, 1373, CAP_END - 1).total_plays, 34999);
assert.equal(reportedTotals(41000, 12027, 5596, 1373, CAP_END - 1).total_plays, 35500, "Recorded activity must never be hidden by the synthetic cap");
assert.throws(() => dailyBotActivity("2026-11-31"));
assert.deepEqual(dailyBotActivity("2026-10-31"), []);

const challenge = { id: "growth-integration", date: "2026-11-01", target_runs: 14, wickets_remaining: 8, total_balls: 6 };
failBoard = true;
await assert.rejects(seedBotsForChallenge(challenge), /transient outage/);
assert.equal(db.game_sessions.length, 73);
failBoard = false;
await seedBotsForChallenge(challenge);
const snapshot = JSON.stringify(db);
await Promise.all([seedBotsForChallenge(challenge), seedBotsForChallenge(challenge)]);
assert.equal(JSON.stringify(db), snapshot, "Retry after partial failure and concurrent calls must not duplicate games or scores");
assert.equal(new Set(db.game_sessions.map((game) => game.anonymous_user_id)).size, 9);
assert.equal(db.leaderboard_entries.length, 9);
assert.ok(db.leaderboard_entries.every((entry) => entry.display_name.endsWith(" [AI]")));
for (const entry of db.leaderboard_entries) {
  if (entry.result === "tied") assert.equal(entry.runs_conceded, challenge.target_runs - 1);
  if (entry.result === "won") assert.ok(entry.runs_conceded < challenge.target_runs - 1 || entry.wickets_taken === challenge.wickets_remaining);
}
console.log("Growth checks passed: Dec 1 milestones, March cap, natural continuation, unique AI identities, timestamp boundaries, and retry/concurrency safety.");
