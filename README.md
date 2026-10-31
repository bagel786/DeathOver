# The Death Over — Cricket Strategy Game

The Death Over is a browser-based cricket strategy game created by [Safiullah Baig](https://safiullahbaig.com/). Bowl the final over and try to outsmart an AI batsman.

You set your field, pick your delivery, and watch the simulation play out. The AI reads your field placement to guess what you're about to bowl — so the real game is deception. Fool it with an unexpected delivery and the odds shift in your favour. Get read and it'll put you away.

> **[Play The Death Over →](https://www.deathover.xyz/)**
>
> [About the game and its creator](https://www.deathover.xyz/about)
>
> [Gameplay rules, bowler guide, and strategy](https://www.deathover.xyz/how-to-play)

---

## How to Play

1. **Set your field** — Drag 9 fielders onto the SVG oval. The AI uses their positions to guess what you're planning.
2. **Choose your delivery** — Pick a type (yorker, bouncer, slower ball, leg cutter, or good length) and a line (off, middle, leg, wide outside off/leg).
3. **Bowl** — The engine resolves the outcome based on field coverage, what the AI expected, the batsman's archetype, match pressure, and a touch of chaos.
4. **Survive the over** — Keep the runs down across 6 balls to win.

If the AI correctly reads your field, it makes better contact. If you fool it, contact probability drops sharply. That's the whole game.

---

## Features

**AI Batsman Archetypes** — Four batting personalities: Power Hitter, The Wall, The Slogger, and The Rotator. Each has different shot preferences, aggression under pressure, and specific delivery weaknesses.

**Field Placement** — The SVG cricket field has 8 zones. Where you place your fielders directly changes what the AI expects you to bowl next.

**Simulation Engine** — TypeScript functions calculating contact probability, shot direction, field coverage, and ball result. Outcomes are seeded-RNG deterministic, so the daily challenge is identical for every player.

**Daily Challenge** — A new scenario every day (Supabase-backed), same seed for everyone. Comparable results, no variance from player to player.

**Leaderboard** — Submit your score after the daily challenge and see how others did.

**Shareable Results** — Wordle-style emoji grid (🟢🔴💥W) you can copy and post.

**Chaos Events** — Around 2% chance per ball of something going sideways: dropped catch, overthrow, misfield, stumping missed. Keeps long sessions from feeling deterministic.

**Custom Games** — Set your own target, over count (1–5), and batsman archetype.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 + Immer |
| Animations | Framer Motion 12 |
| Database | Supabase (PostgreSQL + RLS) |
| Deployment | Railway |

---

## Project Structure

```
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Landing / mode selection
│   ├── play/             # Custom game setup & active game
│   ├── daily/            # Daily challenge
│   ├── results/          # Post-game results & share
│   └── leaderboard/      # Global leaderboard
├── components/
│   ├── field/            # SVG cricket field & draggable fielders
│   ├── delivery/         # Delivery type/line selector & bowl button
│   ├── scoreboard/       # Match situation, batsman card, ball timeline
│   ├── feedback/         # Post-ball explanation & chaos alerts
│   └── results/          # Win/lose screen & share button
├── engine/
│   ├── simulation.ts     # Core outcome resolver
│   ├── batsmanAI.ts      # AI expectation logic & archetype profiles
│   ├── fieldMapping.ts   # Coordinate → zone mapping
│   ├── scoring.ts        # Leaderboard score calculation
│   ├── feedback.ts       # Human-readable feedback generation
│   └── rng.ts            # Seeded PRNG for deterministic chaos
├── store/
│   └── gameStore.ts      # Zustand game state & actions
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── daily.ts          # Daily challenge fetch/cache
└── types/
    └── game.ts           # All TypeScript interfaces
```

---

## Getting Started

### Prerequisites

- Node.js >= 20.9.0
- A [Supabase](https://supabase.com) project (for the daily challenge and leaderboard)

### Installation

```bash
git clone https://github.com/bagel786/DeathOver.git
cd DeathOver
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Run the migration in `supabase/migrations/` against your project, or create the two tables manually — see [Database Schema](#database-schema) below. Row Level Security is enabled with public read and insert policies on both tables.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the Simulation Works

Each delivery runs through a pipeline in `engine/simulation.ts`:

1. **Match pressure** is calculated from the required run rate.
2. **The AI reads the field** — fielder coordinates map to zones, and heuristics determine which delivery the batsman expects.
3. **Base contact probability** is set by delivery type. Yorkers are hardest to hit; good-length deliveries are easiest.
4. **Bluff modifier** — if the AI expected your delivery, contact probability increases. If you fooled it, contact probability drops significantly.
5. **Archetype modifiers** apply the batsman's vulnerability profile and aggression under pressure.
6. **Shot direction** is calculated from delivery line and batsman preference, with angular variance added.
7. **Field coverage** at the shot destination determines whether the ball is stopped or finds the gap.
8. **Outcome is rolled** — dot, single, two, three, four, six, or wicket.
9. **Chaos RNG** (~2% chance) can reverse a wicket (dropped catch), add runs (overthrow or misfield), or produce a near-miss (stumping gone).
10. **Batsman confidence** updates based on the result and carries into the next ball.

For type definitions and architecture notes, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Database Schema

Two Supabase tables:

**`daily_challenges`** — One row per day: target runs, batsman archetype, RNG seed, scenario title and description.

**`leaderboard_entries`** — One row per player per challenge: runs conceded, wickets taken, score, emoji summary, full ball log for replay.

Both tables have public read and insert policies. The migration SQL is in `supabase/migrations/`.

---

## Scoring

```
Base:       +1000 pts (win) / +500 pts (tie)
Runs saved: +50 pts each
Wickets:    +150 pts each
Economy:    +75 pts per ball remaining (win only)
```

### Synthetic leaderboard cadence

Before November 2026, daily boards received 250–500 synthetic entries, each with a seeded
arrival timestamp inside that challenge's UTC day. The leaderboard API only
returns rows whose `created_at` is at or before the server's current time and
disables caching. A board can therefore stay unchanged between activity windows
and fill gradually without a recurring job or additional database columns.
Real submissions retain their normal database timestamp and appear immediately.
Already-seeded boards are left intact.
Raw database reads include scheduled future rows; use the leaderboard API for
the board currently visible to players.

From **November 1, 2026**, `lib/botGrowth.ts` owns the activity budget:

| UTC milestone | Added AI games | Added AI profiles | Projected displayed games / profiles* |
| --- | ---: | ---: | --- |
| Nov 1, 2026 | 0 | 0 | 29,304 / 10,227 |
| Dec 1, 2026 | 2,196 | 273 | 31,500 / 10,500 |
| Apr 1, 2027 | 5,596 | 1,373 | 34,900 / 11,600 |

*Projections assume the Oct 31 recorded totals (34,804 sessions / 12,027 names)
and no additional recorded activity. A reversible reporting adjustment subtracts
5,500 games / 1,800 profiles; no historical records are deleted. Real submissions
remain additive. Until Apr 1, the synthetic contribution is limited to remaining
headroom below 35,000 displayed games; recorded activity itself is never capped.
After Apr 1, the later rate continues (about 28 games / 9 profiles per day).

Daily generation writes scheduled AI games to `game_sessions`, using reserved
`deathover-ai-v1-` profile IDs and deterministic primary keys. Repeated games
reuse profiles; only the first attempt per profile goes on the daily board.
Stats exclude future games and count distinct due AI profiles, with paginated
reads beyond the REST 1,000-row limit. AI profiles never enter the existing
`players` pool. The public game recording route rejects reserved AI IDs.
The existing daily cron and normal challenge loading both perform idempotent
seeding, including recovery after a partial failure. No database migration is needed.

Run `npm run check:growth` for milestones, March cap, later continuation,
unique identities, day boundaries, and partial-failure/concurrent retry checks.

The initial activity shape follows [WhatPulse's PC-gaming activity sample](https://whatpulse.org/research/when-people-play-games/),
which reports an evening peak and early-morning low. The model blends equal
starting weights for Chicago, London, Kolkata, and Sydney, with a small seeded
daily variation in those weights. IANA zones handle daylight saving. This is a
configurable mixed-audience assumption, not measured Death Over demographics.
Short irregular activity windows introduce bursts and gaps, consistent with the
general observation of [bursty human activity](https://www.nature.com/articles/nature03459).
The exact window sizes are design choices. These studies do not establish the
hourly submission rate for this game; tune the model using actual play data.

Run `npm run check:cadence` for deterministic scheduling, day-boundary, plateau,
and API visibility regression checks. On Node 24+, `npm run check` also runs the
existing simulation checks.

---

## Deployment

The app is configured for [Railway](https://railway.app). Set the two Supabase environment variables in your Railway project settings, then deploy from the repo. No other configuration needed.

---

## Roadmap

- [x] Simulation engine & field mapping
- [x] AI batsman archetypes & bluff mechanic
- [x] Zustand game state
- [x] SVG cricket field with draggable fielders
- [x] Daily challenge (Supabase)
- [x] Leaderboard & shareable emoji results
- [ ] Ball-by-ball field animation
- [ ] Multi-over custom games (up to 5 overs)
- [ ] Field presets & save/load
- [ ] Onboarding tutorial
- [ ] Auth & persistent user profiles

---

## License

MIT
