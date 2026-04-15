# 🏏 Death Over

A tactical cricket browser game where you bowl the final over and try to outsmart an AI batsman.

You set your field, pick your delivery, and watch the simulation play out. The AI reads your field placement to guess what you're about to bowl — so the real game is deception. Fool it with an unexpected delivery and the odds shift in your favour. Get read and it'll put you away.

> **[Play the daily challenge →](https://death-over.up.railway.app)

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
