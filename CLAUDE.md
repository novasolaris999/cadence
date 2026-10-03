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
- Vercel hosting (GitHub repo connected; every branch push gets a preview URL, `main` is production).
  Production address: **https://cadence-nova.vercel.app** (public; previews are behind Vercel login).
  Supabase project ref: `chkcbhabkqwguykzdzaf`
- Installable PWA via `vite-plugin-pwa` (manifest + Workbox service worker, auto-update). Icons are
  rendered from `scripts/app-icon.svg` by `scripts/gen-pwa-icons.mjs` (uses the container's Chromium)
- Fonts self-hosted: Plus Jakarta Sans (headings, metrics), Inter (body, labels)

## Secrets and environment

- Never commit secrets or `.env` files. Only `.env.example` with empty values is committed.
- Browser-side env vars (set in Vercel > Project > Settings > Environment Variables):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`; never a secret / service role key).
    `VITE_SUPABASE_ANON_KEY` is still read as a fallback.
- The publishable key is public by design. Security comes from row level security, not from hiding it.
- Without these vars the app always runs on in-memory demo data (`src/data/sampleApi.ts`) and shows a
  "Demo" badge. This is how screenshot checks run in the build container.
- One-time Supabase setup steps for the owner: `docs/supabase-setup.md`. Google sign-in: `docs/google-signin-setup.md`.

## Conventions

### Design
- `design/*.html` are visual references only. Never import, copy, or serve them.
- Colors only through tokens (`src/styles/tokens.css`). No raw hex values and no Tailwind palette
  colors (`slate-500`, `emerald-50`) in components. Every token has a light and a dark value.
- Every screen must work in both themes. Theme defaults to the system setting.
- One size per role, whatever a block's length: every timeline and Weekly title is 13px semibold
  (`text-label-lg font-semibold`), and every check circle is the same 18px circle (`CheckButton`, `CHECK_SIZE`,
  also used by routine checklists) inside a 32px tap area. Long blocks get more room, never bigger text.
- Mockup copy that implies out-of-scope features (biometric sync, notifications, search,
  AI suggestions, "optimized") is dropped, not faked.

### Dates and times
- Store local date (`date`, `YYYY-MM-DD`) plus local time (`time`, `HH:MM`). Never convert schedule
  data to UTC. A 07:30 routine stays 07:30 in any time zone.
- In app code, dates are `YYYY-MM-DD` strings and times are minutes since midnight. Never use
  `toISOString()` to produce a date (it converts to UTC and can shift the day).
- Weeks start on Monday. Weekdays use ISO numbering: 1 = Monday ... 7 = Sunday.
- The timeline grid is 15 minutes. Start times and durations are multiples of 15. Exceptions: quick habits are
  0 minutes, and habits inside a routine may use 5-minute steps; the routine's card is rounded up to the grid.

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
  which call `getApi()` (`src/data/index.ts`) at request time: `supabaseApi`, or `sampleApi` when Supabase
  is not configured or Demo mode is on. Both implement `DataApi` (`src/data/api.ts`); add new storage
  operations to all three. Every query key starts with the mode ('supabase' | 'demo').
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
- [x] Phase 2.5 (owner approved, pulled forward from 7): installable PWA, Google sign-in, production on `main`
- [x] Phase 3: Today against the database, including generating this week's blocks from targets, daily toggle, NEW glow (approved and published to production)
- [x] Phase 4: Weekly on real data (drag between days, Re-run with preview) (approved and published to production)
- [x] Phase 4.5 (owner approved, before phase 5): Routines (supersets of habits), quick habits, Habit naming,
  migration 0002 (0002 applied by owner; approved and published to production)
- [x] Phase 5: Goals history views: habit and routine history, routine grids on the Habits tab, paged reads (approved and published to production)
- [x] Phase 6: Insights on real data: rolling windows, Routines section, Time/Done balance, honest empty states, editable on-time window (approved and published to production)
- [x] Phase 7: Polish and final production check: accessibility (axe clean), security headers + CSP, offline copy and offline-safe saves, per-tab code loading (built; awaiting owner review, then publish to `main`)

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
- Sign-in: magic link. The owner uses Android (Pixel 11 Pro Fold), where the installed app shares
  Chrome's login, so the link is enough. The app also accepts a code (folded behind "The email has a
  code instead?"), but Supabase only allows adding `{{ .Token }}` to templates after custom SMTP is
  set up, so the default emails contain only the link.
- Out-of-scope mockup content is dropped: biometric sync, notification settings, search,
  suggested fixes / "apply slot adjustment", buffer slider, fluidity mode, volume tracking.
- Mockup copy names ("Telemetry Engine", "Friction Detector") replaced with plain labels.
- React 19 (owner approved the switch from SPEC's React 18 before phase 2), with React Router 8.
- Struggle rule: rate below 70% with at least 2 resolved occurrences, lowest first, max 3.
  Weekday cluster: >= 2 misses on that weekday and >= 50% of that weekday's occurrences missed,
  over the last 8 weeks.
- Win rule: 100% with at least 2 hits in the range, or a current streak of 7+.
- Block generation (`src/domain/schedule.ts`, orchestrated in `src/data/scheduling.ts`):
  - `ensureWeek` runs when Today or Weekly first shows a week (current or future, never past): it creates
    the missing upcoming slots of every active target, then marks the week in `week_plans`. Marking
    happens after the insert, so a failed save retries next time instead of leaving an empty week; once
    marked, deleted blocks stay deleted.
  - Only upcoming slots are created (later day, or today at or after now): no instant misses.
  - A slot is (target, scheduled_for). It is never created twice; the DB unique index backs this up, and
    `insertBlocks` retries one by one on a duplicate (two tabs).
  - Saving a target runs `syncTarget` across this and already-planned weeks: it removes upcoming,
    unmoved, still-planned generated blocks that no longer match the rules and fills what is missing.
    Moved, done, and skipped blocks are kept. A rename changes nothing.
- Saving a target also ensures this week and next week exist (`afterTargetSaved`), so a routine created
  late in the week still shows up next week. A new routine gets a confirmation toast with its first
  block ("Gym added: first block Mon, Oct 5 at 18:00").
- "New" highlight: targets created today or yesterday (local date of `created_at`) glow (`glow-new`
  utility, pulse disabled for reduced motion) and carry a NEW tag on Goals cards, Today blocks, and
  Weekly cards. Rule in `src/domain/novelty.ts`.
- Make it daily: the add sheet's "Just this day" tab has a "Make it daily" switch that creates a 7-day
  routine directly; the routine form has an "Every day" button that selects all seven days.
- Wake/sleep chips: "Woke" logs today's wake time. Before 12:00 the sleep chip reads "Slept last night"
  and logs against yesterday's date (the night it started).
- Failed saves show a short notice (`src/components/Toaster.tsx`, via the QueryClient mutation cache);
  the optimistic change is rolled back.
- Today falls back to default anchors (07:00 / 23:00) if settings have not loaded, so it never goes blank.
- Publishing: the owner approved Claude pushing approved versions to `main` (production, the stable
  address the installed app uses). Work happens on the feature branch; previews remain the test track.
  `main` is updated only after the owner approves a change on its preview.
- Phase order change (owner approved): weekly block generation from targets moves into phase 3 so Today
  shows real routines; Weekly drag-between-days and Re-run stay in phase 4. PWA + production moved to
  phase 2.5.
- Google sign-in: "Continue with Google" shows only when Google is enabled in Supabase (the app reads
  `/auth/v1/settings`). Email link stays as a fallback. The Google "G" mark uses Google's brand hex
  colors: the one allowed exception to the tokens-only color rule.
- Google sign-in setup is deferred by the owner (code is ready; button stays hidden until enabled).
- Sessions: Supabase refresh tokens do not expire on the free plan, so a sign-in lasts until sign-out or
  cleared site data. Each web address (preview vs production) keeps its own sign-in.
- Demo mode (owner request): a switch in Settings, remembered per device. On: every read and write goes
  to the in-memory sample data; nothing is sent to Supabase (verified in a browser test that records
  requests). Edits made in demo mode vanish on reload. Off: real data, untouched. The "Demo" badge in
  the header opens Settings. Switching rebuilds the screen area (`<main key={mode}>`). First-sign-in
  setup always targets the real account, and theme syncing is skipped while in demo mode.
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

- Re-run (owner chose option 1: moved blocks always stay where you put them; no "reset moved" option).
  `planRerun` in `src/domain/schedule.ts`, one week at a time, upcoming slots only. It resets unmoved
  scheduler blocks that drifted from their target's rules, removes days no longer in the rules (or of
  archived targets), and restores missing slots, so deleted blocks come back (a normal visit keeps
  deletions). Never touches past slots, done/skipped, moved, or one-off blocks. Protected targets' blocks
  are never changed, but their missing slots are restored. Tapping Re-run shows a preview list first;
  applying recomputes from fresh data. Disabled for past weeks. The scheduler card shows the live count of
  differences.
- Editing one block's length marks it moved (a change by hand), so Re-run keeps it.
- Weekly drag between days: drop on a day ring, into another day's column (768px+), or on phones on the
  "Drop on a day" strip pinned to the top during a drag. Routine blocks still planned ask: "Only this week"
  (marked moved) or "Every week from now on" (swaps that weekday in the target's days; the block takes the
  new slot and later weeks follow via `syncTarget`). "Every week" is off when the target already uses the
  new weekday. One-off and finished blocks just move. Dragging a block back to its own day and time
  clears the moved mark. Rules in `planDayMove` (`src/domain/moves.ts`).

- Names (owner decision): the recurring thing is a **Habit** (code and DB keep `target`/`targets`); a group of
  habits done together is a **Routine** (table `routines`). The Goals tab is labeled Habits (URL stays `/goals`).
  A "Quick" habit takes no time (duration 0). One-off blocks stay "one-off".
- Routines (`src/domain/routines.ts`, migration 0002): the routine owns days, start, protected, active; saving it
  (`saveRoutine` in `src/data/scheduling.ts`) copies them onto each habit (`withRoutine`), then syncs each habit,
  so every habit keeps its own blocks, streak, and rate and the scheduler/Re-run work unchanged. Habits taken out
  of a routine are archived. Existing habits can be brought into a routine (history kept). Archiving a routine
  archives its habits; restoring brings them back.
- Routine cards: a routine's habit blocks that share a day and start are drawn as one card (`groupByRoutine`,
  `useDayItems` in `src/components/blockView.ts`, a stand-in block with id `routine:...`). The card is a superset:
  header with icon, name, one progress pip per habit, then a checklist joined by a rail; tap a habit to tick it,
  tap the header for the full sheet (`RoutineSheet`, with Complete all). Dragging a card moves every habit
  (`planGroupMove`, `planGroupDayMove`), with the same scope questions as single blocks.
- Stretched timeline (owner idea): where a routine card needs more room than its minutes give, those rows grow
  (`rowHeights`/`place` in `src/routes/today/layout.ts`); time labels stay the same. Everything else keeps 32 px
  per 15 minutes.
- Anytime habits: quick habits outside a routine have no time (stored start 00:00). Today lists them in an
  "Anytime" checklist above the timeline; Weekly in an "Anytime" section. Today's slot is created all day.
- Starter routines (Morning, Sleep, Workday start) are fixed, hand-written templates in `ROUTINE_TEMPLATES`, edited
  before saving. Not AI suggestions.
- Fast adding (owner request): "Duplicate" on every habit and routine page opens a new form copied from it, name
  pre-selected to type over (`/goals/new?copy=<id>`, `/goals/routine/new?copy=<id>`; rules `copyHabit`,
  `copyRoutine`). A habit copied out of a routine becomes its own habit with the routine's days and time. The
  new-habit form has "Save & add another": saves, keeps every setting, clears only the name. (Published to production.)
- Before 0002 is applied, the app still works without routines: reads fall back (missing column/table codes) and
  saving a routine shows "Database update needed".

- History (phase 5, rules in `src/domain/history.ts`): each habit's page opens with History (scope + arrows,
  rate, change vs previous period, current and best streak, period grid, rate over the last 8 periods, rate by
  weekday over the last 12 weeks with the weakest named, latest 8 results). Each routine's page opens with
  History (completion, all-done days, streak of days with nothing missed, change; a whole-routine grid where a
  day is all done / partial / missed; one strip per habit, days for week and month, weeks for quarter and year).
  Routine cards on the Habits tab carry the whole-routine grid. Charts are single-series bars (`RateBars`), tap or
  hover to read a bar. Default scope is monthly.
- Supabase returns at most 1000 rows per request: `listBlocks` and `listTargetBlocks` page through with
  `.range()` and a stable order (`readAll` in `supabaseApi.ts`). History pages read a habit's whole history.
- On existing habits and routines, the floating Save button appears only after an edit, so it never covers history.

- Insights (phase 6): windows are rolling, "Last 7 days" / "Last 30 days", each compared with the same length
  just before (`rollingWindow`), so a Monday is never empty. The regularity chart is always the last 7 days,
  today on the right. A Routines section shows all-done days per routine with a strip of days. Wins and
  struggles open the habit's page and name its routine. A struggle whose misses cluster on 4+ weekdays reads
  "Missed on most days" (`missPattern`), not a weekday list. Category balance has Time (minutes) and Done
  (count of completed habits, so quick habits show). Empty states say what to do, and Struggles says "Not enough
  results yet" until some habit has 2 finished days, never a false all-clear. Settings falls back to defaults.
- On-time window is editable in Settings (15 / 30 / 45 / 60 min; stored in `settings.on_time_tolerance_min`).

- Accessibility (phase 7): axe-core reports zero violations on every screen in both themes. Text tokens were
  darkened (light faint #636a7f, muted #525a6d, warn-ink #92400e; dark faint #8f96b0) to reach 4.5:1; never fade
  text with opacity, use the muted token. Cards are containers, not buttons: an invisible `OpenOverlay` button is
  the keyboard/screen-reader way to open them (pointer taps pass through), so check buttons are never nested in
  a button. Charts carry an aria-label listing every value.
- Security headers (vercel.json): CSP (scripts only from the app plus the index.html theme script pinned by SHA-256;
  connect only to self and *.supabase.co; fonts self and data:; no framing), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy. `tests/securityHeaders.test.ts` fails if the theme script changes without
  its hash. Any new outside resource (a host, a font CDN) must be added to the CSP. Node-side tests live in
  `tests/` (outside src, like supabase/migrations.test.ts).
- Offline (phase 7): `src/data/offlineCache.ts` keeps a copy of recent real data in localStorage (settings,
  categories, habits, routines, setup flag, blocks and logs for windows up to 3 weeks; never demo data; cleared on
  sign-out; dropped after 30 days or when OFFLINE_CACHE_VERSION changes). Ticks, Complete all, and wake/sleep logs
  are offline-safe saves (`OFFLINE_KEYS`, `registerOfflineSaves` in queries.ts): kept on the device while waiting
  and sent on reconnect even after a restart, with the original tick time. Other edits wait in memory only. An
  Offline banner explains what is happening. `onlineManager.setOnline(navigator.onLine)` at startup is required,
  or saves restored while offline are sent, fail, and are lost.
- Code loading: Today is in the main bundle; Weekly, Habits pages, and Insights load on first visit (router `lazy`).

## Visual check workflow

The owner cannot preview locally. Before each push, build, run `vite preview`, and screenshot every
changed screen in light and dark at 390px wide (and 1280px for Weekly) with the preinstalled
Chromium (`/opt/pw-browsers`, Playwright via `/opt/node-tools/node_modules`). Use a fixed clock and
`timezoneId` so the "now" line and today's blocks are visible.
