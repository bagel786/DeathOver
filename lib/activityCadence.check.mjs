import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
let board = [];
const queries = [];

// Mock only external services: no credentials, network, or production writes.
const db = {
  from(table) {
    const query = { table, filters: [], columns: null, options: null, insert: null };
    queries.push(query);
    const chain = {
      select(columns, options) { query.columns = columns; query.options = options; return chain; },
      eq(column, value) { query.filters.push((row) => row[column] === value); return chain; },
      lte(column, value) { query.filters.push((row) => row[column] <= value); return chain; },
      order(column, { ascending }) { query.order = [column, ascending]; return chain; },
      range(start, end) { query.range = [start, end]; return chain; },
      insert(rows) { query.insert = rows; return chain; },
      then(resolve, reject) {
        if (query.insert) {
          board.push(...query.insert.map((row, index) => ({ ...row, id: `bot-${board.length + index}` })));
        }
        let rows = table === "players"
          ? Array.from({ length: 600 }, (_, index) => ({ display_name: `player${String(index).padStart(3, "0")}` }))
          : board;
        rows = rows.filter((row) => query.filters.every((filter) => filter(row)));
        if (query.order) {
          const [column, ascending] = query.order;
          rows = [...rows].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
        }
        const count = rows.length;
        if (query.range) rows = rows.slice(query.range[0], query.range[1] + 1);
        if (query.columns && query.columns !== "*") {
          const columns = query.columns.split(/,\s*/);
          rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
        }
        return Promise.resolve({ data: query.options?.head ? null : rows, count, error: null }).then(resolve, reject);
      },
    };
    return chain;
  },
};
globalThis.__cadenceTestDb = db;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "@/lib/supabaseAdmin") {
      return next(mockModule("export const supabaseAdmin = globalThis.__cadenceTestDb;"), ctx);
    }
    if (spec === "@supabase/supabase-js") {
      return next(mockModule("export const createClient = () => globalThis.__cadenceTestDb;"), ctx);
    }
    if (spec === "next/server") {
      return next(mockModule("export const NextResponse = Response; export class NextRequest {}"), ctx);
    }
    if (spec.startsWith("@/")) {
      return next(pathToFileURL(join(ROOT, spec.slice(2)) + ".ts").href, ctx);
    }
    return next(spec, ctx);
  },
});

const { generateBotArrivalTimes } = await import("@/lib/activityCadence");
const { seedBotsForChallenge } = await import("@/lib/leaderboardActivity");
const { GET, dynamic } = await import("@/app/api/leaderboard/route");
const DAY = 86_400_000;
const DATE = "2026-10-15";
const start = Date.parse(`${DATE}T00:00:00.000Z`);
const scheduled = generateBotArrivalTimes(DATE, 400, 12345);

assert.deepEqual(scheduled, generateBotArrivalTimes(DATE, 400, 12345));
assert.notDeepEqual(scheduled, generateBotArrivalTimes(DATE, 400, 54321));
assert.notDeepEqual(scheduled, generateBotArrivalTimes("2026-10-16", 400, 12345));
assert.deepEqual(generateBotArrivalTimes(DATE, 0, 1), []);
assert.throws(() => generateBotArrivalTimes("2026-02-30", 5, 1));
assert.throws(() => generateBotArrivalTimes(DATE, -1, 1));

// Exercise low/high populations and both hemispheres' DST transitions.
for (const date of [DATE, "2026-03-08", "2026-03-29", "2026-04-05", "2026-10-04", "2026-10-25", "2026-11-01"]) {
  const midnight = Date.parse(`${date}T00:00:00.000Z`);
  for (const count of [1, 250, 500]) {
    const arrivals = generateBotArrivalTimes(date, count, 17);
    assert.equal(arrivals.length, count);
    for (const arrival of arrivals) {
      assert.ok(Date.parse(arrival) >= midnight && Date.parse(arrival) < midnight + DAY);
    }
  }
}

const sorted = scheduled.map(Date.parse).sort((a, b) => a - b);
const gaps = sorted.slice(1).map((time, index) => time - sorted[index]);
assert.ok(Math.max(...gaps) > 20 * 60_000, "sample must include a real quiet stretch");
assert.ok(gaps.filter((gap) => gap < 60_000).length > 100, "sample must include clustered arrivals");

const challenge = { id: "cadence-regression", date: DATE, target_runs: 12, wickets_remaining: 4, total_balls: 6 };
await seedBotsForChallenge(challenge);
assert.ok(board.length >= 250 && board.length <= 500);
assert.ok(board.every((row) => row.created_at?.startsWith(DATE)), "seeding must persist scheduled timestamps");
const initialBoard = structuredClone(board);
await seedBotsForChallenge(challenge);
assert.deepEqual(board, initialBoard, "repeat seeding must preserve rows and timestamps");

// Actual GET handler: shared server clock, cutoff, immediate real submissions,
// missing-parameter behavior, and full historical boards after the day ends.
const RealDate = Date;
let now = start + 12 * 3_600_000;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
};
try {
  const request = { nextUrl: new URL(`https://example.test/api/leaderboard?challenge_id=${challenge.id}`) };
  board.push({ id: "real-player", challenge_id: challenge.id, display_name: "human", score: 99, created_at: new RealDate(now).toISOString() });
  let response = await GET(request);
  let visible = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(dynamic, "force-dynamic");
  assert.ok(visible.some((row) => row.id === "real-player"));
  assert.ok(visible.length > 1 && visible.length < board.length);
  assert.ok(visible.every((row) => RealDate.parse(row.created_at) <= now));
  assert.equal(visible.length, board.filter((row) => RealDate.parse(row.created_at) <= now).length);

  const quiet = board.map((row) => RealDate.parse(row.created_at)).sort((a, b) => a - b);
  const quietIndex = quiet.findIndex((time, index) => index > 0 && time - quiet[index - 1] > 10 * 60_000);
  assert.ok(quietIndex > 0);
  now = quiet[quietIndex - 1] + 1000;
  const first = await (await GET(request)).json();
  now = quiet[quietIndex] - 1000;
  assert.deepEqual(await (await GET(request)).json(), first, "board must stay flat inside a quiet period");

  now = start - 1;
  assert.deepEqual(await (await GET(request)).json(), []);
  now = start + DAY;
  response = await GET(request);
  visible = await response.json();
  assert.equal(visible.length, board.length);
  assert.ok(visible.every((row, index) => index === 0 || visible[index - 1].score >= row.score));
  assert.equal((await GET({ nextUrl: new URL("https://example.test/api/leaderboard") })).status, 400);
} finally {
  globalThis.Date = RealDate;
  delete globalThis.__cadenceTestDb;
}

const hourly = Array.from({ length: 24 }, (_, hour) => scheduled.filter((time) => Number(time.slice(11, 13)) === hour).length);
console.log("Cadence checks passed: stable schedules, UTC/DST boundaries, bursts, quiet periods, idempotent seeding, and API visibility.");
console.log("Example UTC hourly arrivals:", hourly.join(", "));
