// Cadence capture: reads one typed or dictated request and proposes what to add.
//
// A Vercel Function (Node.js), deployed with the app on every push: POST /api/capture. It holds the Claude API
// key (environment variable ANTHROPIC_API_KEY, server-side only), so the key never reaches the browser or the
// repository. It only PROPOSES actions: the app shows them as preview cards and saves nothing until the owner
// confirms, through its normal data paths (row level security applies as usual).
//
// Environment variables (Vercel > Project > Settings > Environment Variables, Production and Preview):
//   ANTHROPIC_API_KEY       required. A Claude API key (mark it Sensitive).
//   CAPTURE_ALLOWED_EMAILS  required. Comma-separated emails allowed to use capture. Anyone else who signs in
//                           gets a 403, so nobody else can spend the API budget.
//   CAPTURE_MODEL           optional. Defaults to claude-sonnet-5-5.
// Already set for the app: VITE_SUPABASE_URL (used here only to check who is signed in).

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TEXT = 1000;
const MAX_TURNS = 6;

// ---------- Tools: each one is a kind of proposal the app knows how to preview and save ----------

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });
const date = { type: 'string', description: 'Local date, YYYY-MM-DD.' };
const time = { type: 'string', description: 'Local time, HH:MM, 24-hour, on a 15-minute step (07:00, 07:15 ...).' };
const days = {
  type: 'array',
  items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
  description: 'ISO weekdays: 1 = Monday ... 7 = Sunday. Every day = [1,2,3,4,5,6,7]. Empty = any days.',
};

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'add_todo',
    description:
      'Propose a to-do: something to get done once (a purchase, an errand, a call). Use one call per to-do. ' +
      'Leave the day empty unless the user gave one. Give a time only if the user gave one.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'list', 'due_date', 'due_time', 'duration_min', 'starred', 'note'],
      properties: {
        title: { type: 'string', description: 'Short, as the user would write it: "Oat milk", "Call Mom".' },
        list: nullable({ type: 'string', description: 'One of the existing list names, the best fit by meaning.' }),
        due_date: nullable(date),
        due_time: nullable(time),
        duration_min: nullable({ type: 'integer', description: 'Minutes, when a time is given. Default 30.' }),
        starred: { type: 'boolean', description: 'True only if the user says it is urgent or important.' },
        note: nullable({ type: 'string', description: 'Extra detail the user gave (size, brand, address).' }),
      },
    },
  },
  {
    name: 'add_habit',
    description:
      'Propose a habit: something repeated every week on certain days, like "Vitamin D every day at 9am" or ' +
      '"Gym Mon Wed Fri 6pm for an hour". A habit that takes no time slot (a pill, a glass of water) is quick: ' +
      'duration_min 0.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'days', 'times_per_week', 'start_time', 'duration_min', 'category', 'routine'],
      properties: {
        name: { type: 'string' },
        days,
        times_per_week: nullable({
          type: 'integer',
          description: 'Only when no days are given ("3 times a week"); otherwise null.',
        }),
        start_time: nullable({
          ...time,
          description: time.description + ' Null only for a quick habit with no time ("anytime").',
        }),
        duration_min: { type: 'integer', description: 'Minutes; 0 for a quick habit. Otherwise a multiple of 15.' },
        category: nullable({ type: 'string', description: 'One of the existing category names, or null.' }),
        routine: nullable({
          type: 'string',
          description: 'Name of an existing routine to add this habit to, only if the user said so. Null otherwise.',
        }),
      },
    },
  },
  {
    name: 'add_routine',
    description:
      'Propose a new routine: several habits done together, in order, at one time ("a morning routine of ' +
      'stretching, vitamins and journaling at 7").',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'days', 'start_time', 'category', 'habits'],
      properties: {
        name: { type: 'string' },
        days,
        start_time: time,
        category: nullable({ type: 'string', description: 'One of the existing category names, or null.' }),
        habits: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'duration_min'],
            properties: {
              name: { type: 'string' },
              duration_min: { type: 'integer', description: 'Minutes in 5-minute steps; 0 for a quick tick.' },
            },
          },
        },
      },
    },
  },
  {
    name: 'add_block',
    description:
      'Propose a one-off block: time set aside on one day only, like "dentist Tuesday 3pm for an hour". ' +
      'Use this for appointments and events; use add_todo for errands without a fixed time.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'date', 'start_time', 'duration_min', 'category', 'note'],
      properties: {
        title: { type: 'string' },
        date,
        start_time: time,
        duration_min: { type: 'integer', description: 'Minutes, a multiple of 15. Default 60 if not said.' },
        category: nullable({ type: 'string', description: 'One of the existing category names, or null.' }),
        note: nullable({ type: 'string' }),
      },
    },
  },
  {
    name: 'ask_followup',
    description:
      'Ask the user one short question when something needed is missing or unclear. Call it alone: no other ' +
      'tool in the same reply. Offer 2 to 4 short answer options when the answers are predictable.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['question', 'options'],
      properties: {
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

// Stable text first (cacheable); the day and the user's own data go in the user message.
export const SYSTEM = `You turn one short request into entries for Cadence, a personal planner. You only record what the user asked for: never suggest extra tasks, habits, or changes.

What Cadence holds:
- To-do: done once. Lives in a list (Shopping, Errands, People, or the user's own). May have a day, and a time.
- Habit: repeats every week on chosen days, at a start time, for a number of minutes. Quick habits take 0 minutes (a pill, a glass of water). A habit can belong to a routine.
- Routine: several habits done together, in order, starting at one time on chosen days.
- One-off block: time reserved on a single day (appointments, events).

How to answer:
- Reply only by calling tools. Several things in one request mean several calls.
- Resolve relative dates ("tomorrow", "Saturday", "next week") from today's date given below. Weekdays are ISO, 1 = Monday.
- Round times to 15 minutes.
- A quick habit (0 minutes) on its own has no time in Cadence. If the user gives a time for something quick and not in a routine (a pill at 9am), use 15 minutes at that time so it sits on the timeline.
- A habit added to an existing routine takes the routine's days and time: leave days empty and start_time null. "Morning" without a time is not a time: ask.
- Pick the list or category by meaning from the names provided; use null if none fits.
- If something essential is missing or two readings are equally likely, call ask_followup alone instead of guessing. Essentials: a habit's days and its start time (quick habits may be anytime); a one-off block's day and time. A to-do never needs a day.
- When a new habit's time is within an hour of an existing routine's start on overlapping days, and the user did not say whether it belongs to that routine, ask whether to add it to that routine (options like "Add to Morning routine", "Keep it separate").
- The conversation may include earlier questions and the user's answers: use them, and propose the complete result for the original request.
- If the request is not something to add (a question, a greeting), reply in one short sentence saying what you can add, and call no tool.`;

// ---------- Request handling ----------

interface CaptureRequest {
  text: string;
  /** Earlier turns of this capture: the user's words and the questions asked. */
  transcript?: { role: 'user' | 'assistant'; text: string }[];
  now: { date: string; time: string; weekday: number };
  context: {
    lists: string[];
    categories: string[];
    routines: { name: string; days: number[]; start: string }[];
    habits: string[];
  };
}

export interface CaptureResponse {
  actions: { tool: string; input: unknown }[];
  question: { text: string; options: string[] } | null;
  message: string | null;
  model: string;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const strList = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x: string) => x.slice(0, max)) : [];

/** Keeps only the expected fields, with length caps, whatever the browser sent. */
export function cleanRequest(body: unknown): CaptureRequest | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = str(b.text, MAX_TEXT + 1).trim();
  if (!text) return 'Type what you want to add.';
  if (text.length > MAX_TEXT) return `That is too long; keep it under ${MAX_TEXT} characters.`;
  const now = (b.now ?? {}) as Record<string, unknown>;
  const today = str(now.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'Missing the date.';
  const ctx = (b.context ?? {}) as Record<string, unknown>;
  const transcript = (Array.isArray(b.transcript) ? b.transcript : [])
    .slice(-MAX_TURNS)
    .map((t) => t as Record<string, unknown>)
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => ({ role: t.role as 'user' | 'assistant', text: str(t.text, MAX_TEXT) }));
  return {
    text,
    transcript,
    now: { date: today, time: str(now.time, 5), weekday: Number(now.weekday) || 0 },
    context: {
      lists: strList(ctx.lists, 30, 40),
      categories: strList(ctx.categories, 30, 40),
      routines: (Array.isArray(ctx.routines) ? ctx.routines : []).slice(0, 30).map((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        return {
          name: str(o.name, 80),
          days: Array.isArray(o.days) ? o.days.filter((d) => Number.isInteger(d)).slice(0, 7) : [],
          start: str(o.start, 5),
        };
      }),
      habits: strList(ctx.habits, 150, 80),
    },
  };
}

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The one user message: today, the user's names (lists, routines ...), the conversation, then the request. */
export function userMessage(r: CaptureRequest): string {
  const c = r.context;
  const lines = [
    `Today is ${WEEKDAYS[r.now.weekday] ?? ''} ${r.now.date}, ${r.now.time}.`,
    `Lists: ${c.lists.join(', ') || 'none'}.`,
    `Categories: ${c.categories.join(', ') || 'none'}.`,
    `Routines: ${c.routines.map((x) => `${x.name} (days ${x.days.join(',') || 'any'}, starts ${x.start})`).join('; ') || 'none'}.`,
    `Existing habits: ${c.habits.join(', ') || 'none'}.`,
    '',
  ];
  if (r.transcript && r.transcript.length > 0) {
    lines.push('Conversation so far:');
    for (const t of r.transcript) lines.push(`${t.role === 'user' ? 'User' : 'You asked'}: ${t.text}`);
    lines.push(`User now answers: ${r.text}`);
  } else {
    lines.push(`Request: ${r.text}`);
  }
  return lines.join('\n');
}

/** Turns Claude's reply into proposals for the app. */
export function shape(message: Anthropic.Beta.BetaMessage, model: string): CaptureResponse {
  const actions: CaptureResponse['actions'] = [];
  let question: CaptureResponse['question'] = null;
  const text: string[] = [];
  for (const block of message.content) {
    if (block.type === 'tool_use') {
      if (block.name === 'ask_followup') {
        const q = block.input as { question?: unknown; options?: unknown };
        question = { text: str(q.question, 300), options: strList(q.options, 4, 60) };
      } else actions.push({ tool: block.name, input: block.input });
    } else if (block.type === 'text' && block.text.trim()) text.push(block.text.trim());
  }
  // A question means something is missing: show it instead of half the result.
  if (question) return { actions: [], question, message: null, model };
  return { actions, question: null, message: text.join(' ') || null, model };
}

// ---------- HTTP ----------

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export interface Deps {
  env: Record<string, string | undefined>;
  /** For the sign-in check against Supabase Auth. */
  fetch: typeof fetch;
  /** A Claude client; built from ANTHROPIC_API_KEY when not given (tests pass a stand-in). */
  client?: Anthropic;
}

/** Who is signed in, checked with Supabase Auth (not just decoded), or null. */
async function signedInEmail(req: Request, deps: Deps): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const url = deps.env.VITE_SUPABASE_URL ?? deps.env.SUPABASE_URL;
  // The app's public (publishable) key: sent by the app, and also set in Vercel for the build.
  const key = req.headers.get('apikey') ?? deps.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? deps.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!token || !url) return null;
  try {
    const res = await deps.fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: key } });
    if (!res.ok) return null;
    const user = (await res.json()) as { email?: string };
    return user.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const email = await signedInEmail(req, deps);
  if (!email) return json(401, { error: 'Sign in to use capture.' });
  const allowed = (deps.env.CAPTURE_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) return json(403, { error: 'Capture is not enabled for this account.' });
  if (!deps.client && !deps.env.ANTHROPIC_API_KEY) {
    return json(500, { error: 'Capture is not set up: the ANTHROPIC_API_KEY setting is missing in Vercel.' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Could not read the request.' });
  }
  const request = cleanRequest(body);
  if (typeof request === 'string') return json(400, { error: request });

  const model = deps.env.CAPTURE_MODEL || DEFAULT_MODEL;
  const anthropic = deps.client ?? new Anthropic({ apiKey: deps.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 25_000 });
  try {
    const message = await anthropic.beta.messages.create({
      model,
      max_tokens: 4000,
      // Reading a short request is light work: low effort keeps it quick and cheap.
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      // If a safety check declines the request, the API retries it on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: userMessage(request) }],
    });
    if (message.stop_reason === 'refusal') {
      return json(200, { actions: [], question: null, message: 'Claude declined to read that one. Try wording it differently.', model });
    }
    if (message.stop_reason === 'max_tokens') {
      return json(200, { actions: [], question: null, message: 'That was too much at once. Try fewer things per message.', model });
    }
    return json(200, shape(message, model));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(502, { error: 'The Claude API key was not accepted. Check ANTHROPIC_API_KEY in Vercel.' });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: 'Claude is busy or the monthly limit was reached. Try again later.' });
    if (e instanceof Anthropic.BadRequestError) return json(502, { error: `Claude could not take the request: ${e.message}` });
    if (e instanceof Anthropic.APIError) return json(502, { error: `Claude is not reachable right now (${e.status ?? 'network'}). Try again.` });
    return json(500, { error: 'Something went wrong while reading that.' });
  }
}

/** Vercel calls this for POST /api/capture. */
export function POST(req: Request): Promise<Response> {
  return handle(req, { env: process.env, fetch });
}
