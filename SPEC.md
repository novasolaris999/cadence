# Cadence: Product Brief

This is the original brief, saved verbatim. It is the source of truth for scope.
Decisions made after this brief are recorded in CLAUDE.md under "Decisions log".

---

You are building Cadence, a personal daily routine and goal tracker for one user (me).
I have 13 years in tech and product but I am new to writing code. Explain why you make
each architectural choice.

I am running you in Claude Code on the web, so I have no local terminal and no local
preview. Do not ask me to run commands. Commit SPEC.md and CLAUDE.md to the repo,
because every session starts from a fresh clone. Never commit secrets: Supabase keys
go in Vercel environment variables, and you tell me exactly which ones to add and
where to click.

FIRST: save this entire brief as SPEC.md, and create CLAUDE.md with the stack, the
conventions, and a pointer to SPEC.md. Then read all five files in design/. Do not
write app code until I approve your plan.

DESIGN REFERENCE
design/ holds five static HTML mockups exported from Google Stitch. They are the visual
source of truth for layout, components, and copy style. They are not code to copy:
- They use the Tailwind CDN and hotlinked images. Install Tailwind properly and replace
  the logo and avatar with local placeholders.
- The dark and light files use different fonts, spacing, and color values. Unify them
  into ONE token set (CSS variables) with a light value and a dark value per token.
  Use Plus Jakarta Sans for headings and Inter for body. Every screen must work in
  both themes, with a toggle that defaults to the system setting.
- All names, dates, and numbers in the mockups are placeholder data.

NAVIGATION (4 bottom tabs, mobile first, also usable on desktop)
1. Today: design/today-dark.html
2. Weekly: design/weekly-light.html
3. Goals: design/goals-dark.html. Tapping a goal opens its rules, using
   design/targets-light.html as the reference for that screen. There is no separate
   Targets tab.
4. Insights: design/insights-light.html

STACK
React 18, TypeScript, Vite, Tailwind, Supabase (Postgres, magic-link auth, row level
security), deployed on Vercel, installable as a PWA so it sits on my phone home screen.
dnd-kit for drag and drop. Hand-written SVG for charts, no chart library.

DATA MODEL (propose the exact schema, but keep these principles)
- categories: name, color.
- targets: the definition of a recurring routine. Name, category, duration, weekly
  frequency, preferred days, preferred start time or window, protected flag, active flag.
- blocks: one scheduled instance on one date. Optional link to a target (one-off blocks
  have none), date, start time, duration, status (planned, done, skipped), completed_at,
  note.
- day_logs: one row per date with actual wake time and actual sleep time.
- settings: wake anchor, sleep anchor, theme.
- Store dates and times as local date plus local time, not UTC timestamps. A 07:30
  routine should stay 07:30 when I travel.
- Never store percentages, streaks, or hit and miss counts. Derive them from blocks at
  read time. A planned block on a past date that is not done counts as a miss.
- Keep every schema change as a SQL migration file in the repo. You cannot reach my
  Supabase project from the cloud session, so give me the SQL to paste into the
  Supabase SQL editor.

V1 BEHAVIOR
- Today: vertical timeline in 15-minute slots, a week strip to change day, a "now"
  line, long empty stretches collapsed like the mockup, a + button to add a block,
  tap to edit, drag to move, one tap to complete, and a done count with percentage.
- Weekly: seven days grouped into morning, afternoon, and evening, category filter
  pills, drag a block to another day, completion ring per day.
- Scheduling: when a week starts, generate blocks from each target's preferred days
  and time. "Re-run" regenerates future blocks that I have not manually moved.
  Protected blocks never move. This is plain rules, no optimization and no AI.
- Goals: scope switch (weekly, monthly, quarterly, yearly), summary strip, and a
  hit, miss, rest grid per goal like the mockup. Create, edit, and archive targets here.
- Insights: on-time wake and sleep versus my anchors, the 7-day regularity chart,
  category balance, wins, and a struggle list that is rule based: lowest completion
  rate, and which weekdays the misses cluster on.

OUT OF SCOPE FOR V1 (leave clean seams, build nothing)
Optimizing auto-scheduler, WHOOP or any biometric sync, push notifications, calendar
sync, AI-generated suggestions, search, multiple users.

BUILD ORDER (after each phase, push the branch, tell me what to check on the Vercel
preview link, and wait for my go-ahead)
1. Scaffold, tokens, theme toggle, four-tab shell, all screens rendered with
   hard-coded sample data. Then walk me through connecting this GitHub repo to Vercel
   in the browser, so every later push gives me a preview link.
2. Supabase schema, auth, and security rules. Walk me through creating the Supabase
   project step by step. Then target create, edit, archive.
3. Today, fully working against the database.
4. Weekly, plus block generation from targets.
5. Goals history views.
6. Insights.
7. PWA setup and production deploy.

Start by giving me: your understanding of the five screens, the proposed schema, the
folder structure as a tree, and any questions. Then wait.
