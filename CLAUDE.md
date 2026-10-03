# CLAUDE.md

Cadence is a personal daily routine and goal tracker for one user.
**Read SPEC.md first.** It is the original brief and defines scope, data principles, and build order.

## Working with the owner

- The owner is experienced in tech and product but new to writing code. Explain the "why" behind
  each architectural choice. Lead with the answer, then the reasoning. No filler, no em-dashes.
- The owner uses Claude Code on the web: no local terminal, no local preview.
  **Never ask the owner to run commands.** Run typecheck, tests, and builds yourself in the container.
- Each session starts from a fresh clone. Anything not committed is lost. Keep this file and the
  "Build status" section below current.
- After each build phase: push the branch, say exactly what to check on the Vercel preview link,
  and wait for a go-ahead before starting the next phase.
- When the owner must click through a web UI (Vercel, Supabase), give numbered steps and say why
  the order matters.

## Stack

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS, installed as a build dependency (never the CDN). Theme values come from CSS variables.
- React Router 8 for the four tabs and the goal detail route
- TanStack Query for server state (caching, optimistic updates)
- Supabase: Postgres, magic-link auth, row level security
- dnd-kit for drag and drop
- Hand-written SVG for all charts. No chart library.
- Vitest for unit tests of pure domain logic, plus `supabase/migrations.test.ts`, which applies every
  migration to PGlite (Postgres in WebAssembly) and checks row level security and constraints
- Vercel hosting (GitHub repo connected; every branch push gets a preview URL, `main` is production); PWA in phase 7
- Fonts self-hosted: Plus Jakarta Sans (headings, metrics), Inter (body, labels)

## Secrets and environment

- Never commit secrets or `.env` files. Only `.env.example` with empty values is committed.
- Browser-side env vars (set in Vercel > Project > Settings > Environment Variables):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`; never a secret / service role key).
    `VITE_SUPABASE_ANON_KEY` is still read as a fallback.
- The publishable key is public by design. Security comes from row level security, not from hiding it.
- Without these vars the app runs on in-memory demo data (`src/data/sampleApi.ts`) and shows a
  "Demo data" badge. This is how screenshot checks run in the build container.
- One-time Supabase setup steps for the owner: `docs/supabase-setup.md`.

## Conventions

### Design
- `design/*.html` are visual references only. Never import, copy, or serve them.
- Colors only through tokens (`src/styles/tokens.css`). No raw hex values and no Tailwind palette
  colors (`slate-500`, `emerald-50`) in components. Every token has a light and a dark value.
- Every screen must work in both themes. Theme defaults to the system setting.
- Mockup copy that implies out-of-scope features (biometric sync, notifications, search,
  AI suggestions, "optimized") is dropped, not faked.

### Dates and times
- Store local date (`date`, `YYYY-MM-DD`) plus local time (`time`, `HH:MM`). Never convert schedule
  data to UTC. A 07:30 routine stays 07:30 in any time zone.
- In app code, dates are `YYYY-MM-DD` strings and times are minutes since midnight. Never use
  `toISOString()` to produce a date (it converts to UTC and can shift the day).
- Weeks start on Monday. Weekdays use ISO numbering: 1 = Monday ... 7 = Sunday.
- The timeline grid is 15 minutes. Start times and durations are multiples of 15.

### Data
- Never store percentages, streaks, or hit/miss counts. Derive them from `blocks` at read time.
- A planned block on a past date that is not done counts as a miss.
- Every table has `user_id` with a row level security policy `user_id = auth.uid()`.
- Every schema change is a new numbered file in `supabase/migrations/`. Never edit a migration
  that has already been applied. Give the owner the SQL to paste into the Supabase SQL editor.

### Code layout
- `src/domain/` holds pure functions (scheduling rules, metrics, insights). No React, no Supabase.
  Every rule here has a unit test.
- `src/data/` is the only folder that talks to Supabase. Screens use the hooks in `src/data/queries.ts`,
  which call `api` (`src/data/index.ts`): `supabaseApi` when configured, `sampleApi` otherwise. Both
  implement `DataApi` (`src/data/api.ts`); add new storage operations to all three.
- Screens live in `src/routes/<screen>/`. Shared UI lives in `src/components/`. SVG charts in `src/charts/`.

### Before every push
- `npm run typecheck`, `npm test`, and `npm run build` must pass.

## Out of scope for v1 (leave seams, build nothing)

Optimizing auto-scheduler, WHOOP or biometric sync, push notifications, calendar sync,
AI-generated suggestions, search, multiple users.

## Build status

- [x] Phase 0: SPEC.md and CLAUDE.md committed, mockups reviewed, plan approved
- [x] Phase 1: Scaffold, tokens, theme toggle, four-tab shell, sample data, Vercel connected (awaiting owner review of the preview)
- [x] Phase 2: Supabase schema, auth, RLS, target create/edit/archive (built; awaiting owner's Supabase setup and review)
- [ ] Phase 3: Today against the database
- [ ] Phase 4: Weekly and block generation
- [ ] Phase 5: Goals history views
- [ ] Phase 6: Insights
- [ ] Phase 7: PWA and production deploy

## Decisions log

Record owner decisions here as they are made, so future sessions do not re-ask.

- Skipped blocks count as misses in every rate; the grid draws them differently from plain misses.
- Frequency vs days: picked days decide the frequency. With no days picked, frequency is set by hand
  and spread with the fixed table in `src/domain/schedule.ts` (3x = Mon/Wed/Fri, 4x = Mon/Tue/Thu/Fri ...).
- Wake and sleep are logged from two tap-to-log chips on Today (above and below the timeline).
- On time = within `settings.on_time_tolerance_min` (default 30) of the anchor. Bedtimes before 12:00
  belong to the previous night.
- Goals grid: weekday columns for weekly/monthly; GitHub-style (weekday rows, week columns) for
  quarterly/yearly. Arrows step back through past periods.
- Protected blocks can be dragged by hand; only the scheduler (Re-run) never touches them.
- Desktop: centered single column everywhere except Weekly, which becomes 7 columns at >= 1024px.
- Sign-in: magic link plus a 6-digit code in the same email, because iOS home-screen apps do not
  share storage with Safari.
- Out-of-scope mockup content is dropped: biometric sync, notification settings, search,
  suggested fixes / "apply slot adjustment", buffer slider, fluidity mode, volume tracking.
- Mockup copy names ("Telemetry Engine", "Friction Detector") replaced with plain labels.
- React 19 (owner approved the switch from SPEC's React 18 before phase 2), with React Router 8.
- Struggle rule: rate below 70% with at least 2 resolved occurrences, lowest first, max 3.
  Weekday cluster: >= 2 misses on that weekday and >= 50% of that weekday's occurrences missed,
  over the last 8 weeks.
- Win rule: 100% with at least 2 hits in the range, or a current streak of 7+.
- IDs are generated in the browser (`crypto.randomUUID()`), so new rows can appear instantly.
- Archived targets always appear in a folded "Archived (n)" section on Goals, so they can be restored.
- Category editing lives in the Settings sheet (avatar): tap the dot to recolor, edit the name in place,
  tap delete twice. Default categories (Fitness, Health, People, Mind) are created on first sign-in.
- Theme preference is saved in settings (follows you across devices) and cached in localStorage
  (applied before first paint). On load the saved value wins once.
- Sheets render through a portal on `document.body`: the header's backdrop blur would otherwise trap
  fixed-position children.
- Today edge toggles: subtle controls at the top and bottom of the timeline extend it to 00:00 / 24:00.
  Each is remembered per device (localStorage, not the database: it is a view preference). A coral dot
  on a collapsed toggle means the current time is hidden inside it.
- Adding: the + button and tapping an empty timeline row open one sheet with "Just this day" (one-off
  block) or "Repeats weekly" (hands off to the new-target form, prefilled via URL params).
- Dragging on Today: hold 250 ms on touch (or drag 6 px with a mouse). Collapsed stretches open during
  the drag so every 15 minutes has the same height; the page scroll is corrected so the block stays under
  the finger. Target blocks then ask for a scope: only this day, rest of this week, or this and all
  future (which also moves the target's preferred time). One-off and finished blocks just move.
  dnd-kit's own layout-shift scroll compensation and the browser's scroll anchoring are both off,
  because the timeline does that correction itself.
- Weekly: tapping a day ring highlights that day (no page jump). Under 768px the days are a sideways
  swipe row with one day per screen; from 768px (Pixel Fold inner screen, tablets, desktop) all seven
  sit side by side.

## Visual check workflow

The owner cannot preview locally. Before each push, build, run `vite preview`, and screenshot every
changed screen in light and dark at 390px wide (and 1280px for Weekly) with the preinstalled
Chromium (`/opt/pw-browsers`, Playwright via `/opt/node-tools/node_modules`). Use a fixed clock and
`timezoneId` so the "now" line and today's blocks are visible.
