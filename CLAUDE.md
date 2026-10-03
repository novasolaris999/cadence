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

- React 18 + TypeScript (strict) + Vite
- Tailwind CSS, installed as a build dependency (never the CDN). Theme values come from CSS variables.
- React Router for the four tabs and the goal detail route
- TanStack Query for server state (caching, optimistic updates)
- Supabase: Postgres, magic-link auth, row level security
- dnd-kit for drag and drop
- Hand-written SVG for all charts. No chart library.
- Vitest for unit tests of pure domain logic
- Vercel hosting; PWA (installable) in phase 7
- Fonts self-hosted: Plus Jakarta Sans (headings, metrics), Inter (body, labels)

## Secrets and environment

- Never commit secrets or `.env` files. Only `.env.example` with empty values is committed.
- Browser-side env vars (set in Vercel > Project > Settings > Environment Variables):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (the publishable/anon key, never the service role / secret key)
- The anon key is public by design. Security comes from row level security, not from hiding the key.

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
- `src/data/` is the only folder that talks to Supabase.
- Screens live in `src/routes/<screen>/`. Shared UI lives in `src/components/`. SVG charts in `src/charts/`.

### Before every push
- `npm run typecheck`, `npm test`, and `npm run build` must pass.

## Out of scope for v1 (leave seams, build nothing)

Optimizing auto-scheduler, WHOOP or biometric sync, push notifications, calendar sync,
AI-generated suggestions, search, multiple users.

## Build status

- [x] Phase 0: SPEC.md and CLAUDE.md committed, mockups reviewed, plan proposed (awaiting approval)
- [ ] Phase 1: Scaffold, tokens, theme toggle, four-tab shell, sample data, Vercel connected
- [ ] Phase 2: Supabase schema, auth, RLS, target create/edit/archive
- [ ] Phase 3: Today against the database
- [ ] Phase 4: Weekly and block generation
- [ ] Phase 5: Goals history views
- [ ] Phase 6: Insights
- [ ] Phase 7: PWA and production deploy

## Decisions log

Record owner decisions here as they are made, so future sessions do not re-ask.

- (none yet)
