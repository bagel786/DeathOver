import { mulberry32 } from "@/engine/rng";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Shape from WhatPulse's PC-gaming sample (Jun 2025–Jun 2026), not a
// measurement of Death Over players or of leaderboard submissions.
// https://whatpulse.org/research/when-people-play-games/
const HOURLY_ACTIVITY = [
  5.35, 3.81, 2.65, 1.83, 1.31, 1.03, 0.91, 0.96,
  1.19, 1.66, 2.26, 2.91, 3.44, 4.02, 4.60, 5.21,
  5.74, 6.16, 6.40, 7.02, 7.94, 8.51, 8.22, 6.87,
];

// Equal regional weights are an explicit starting assumption for a mixed
// audience. IANA zones account for daylight saving on the challenge date.
const TIME_ZONES = [
  "America/Chicago", "Europe/London", "Asia/Kolkata", "Australia/Sydney",
];
const CLOCKS = TIME_ZONES.map((timeZone) => new Intl.DateTimeFormat("en-GB", {
  timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}));

/** Stable synthetic arrival timestamps, all inside the challenge's UTC day. */
export function generateBotArrivalTimes(date: string, count: number, seed: number): string[] {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid challenge date");
  }
  if (!Number.isInteger(count) || count < 0) throw new Error("Invalid bot count");
  if (count === 0) return [];

  const rng = mulberry32(seed);
  const regionWeights = CLOCKS.map(() => 0.75 + rng() * 0.5);
  const slotSize = 5 * MINUTE;
  const cumulative: number[] = [];
  let total = 0;

  for (let offset = 0; offset < DAY; offset += slotSize) {
    const instant = new Date(start + offset + slotSize / 2);
    let activity = 0;
    for (let region = 0; region < CLOCKS.length; region++) {
      const parts = CLOCKS[region].formatToParts(instant);
      const hour = Number(parts.find((part) => part.type === "hour")!.value);
      const minute = Number(parts.find((part) => part.type === "minute")!.value);
      // Interpolate so an hour boundary does not produce an abrupt rate change.
      activity += regionWeights[region] * (
        HOURLY_ACTIVITY[hour] * (1 - minute / 60)
        + HOURLY_ACTIVITY[(hour + 1) % 24] * minute / 60
      );
    }
    total += activity;
    cumulative.push(total);
  }

  // Cluster arrivals in short activity windows. This creates uneven bursts
  // and genuine flat stretches, beyond simply adding noise to a steady rate.
  // Window lengths and cluster sizes are design parameters, not study results.
  const windowCount = Math.max(1, Math.ceil(count / (4 + rng() * 4)));
  const windows = Array.from({ length: windowCount }, () => {
    const pick = rng() * total;
    const slot = cumulative.findIndex((weight) => weight > pick);
    const offset = (slot + rng()) * slotSize;
    return { offset, duration: Math.min((2 + rng() * 10) * MINUTE, DAY - offset) };
  });

  return Array.from({ length: count }, () => {
    const window = windows[Math.floor(rng() * windows.length)];
    return new Date(start + Math.floor(window.offset + rng() * window.duration)).toISOString();
  });
}
