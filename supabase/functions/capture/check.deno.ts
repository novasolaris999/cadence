// Runs the capture function end to end in Deno against stand-ins for Claude and Supabase Auth.
// No real key or network is used. Run from any folder without a package.json:
//   npx deno run --allow-net --allow-env check.deno.ts   (or: deno run -A check.deno.ts)

Deno.env.set('CAPTURE_TEST', '1');
Deno.env.set('ANTHROPIC_API_KEY', 'test-key');
Deno.env.set('CAPTURE_ALLOWED_EMAILS', 'Owner@Example.com, other@example.com');

let lastClaudeRequest: { headers: Headers; body: Record<string, unknown> } | null = null;
let claudeReply: Record<string, unknown> = {};
let claudeStatus = 200;

// Stand-in for the Claude API.
const claude = Deno.serve({ port: 0, onListen() {} }, async (req) => {
  lastClaudeRequest = { headers: req.headers, body: await req.json() };
  return new Response(JSON.stringify(claudeReply), { status: claudeStatus, headers: { 'content-type': 'application/json' } });
});
// Stand-in for Supabase Auth: one valid token.
const auth = Deno.serve({ port: 0, onListen() {} }, (req) =>
  req.headers.get('authorization') === 'Bearer good'
    ? Response.json({ id: 'u1', email: 'owner@example.com' })
    : new Response('{}', { status: 401 }),
);
Deno.env.set('ANTHROPIC_BASE_URL', `http://localhost:${claude.addr.port}`);
Deno.env.set('SUPABASE_URL', `http://localhost:${auth.addr.port}`);

const { handle, TOOLS } = await import('./index.ts');

const message = (content: unknown[], stop_reason = 'tool_use') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content, stop_reason,
  stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
});
const body = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  now: { date: '2026-10-07', time: '12:40', weekday: 3 },
  context: { lists: ['Shopping', 'Errands'], categories: ['Health'], routines: [{ name: 'Morning routine', days: [1, 2, 3, 4, 5], start: '07:00' }], habits: ['Gym'] },
  ...extra,
});
const call = (b: unknown, token = 'good', origin = 'https://cadence-nova.vercel.app') =>
  handle(new Request('http://fn/capture', { method: 'POST', headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' }, body: JSON.stringify(b) }));

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};

// 1. Not signed in / not allowed
check('no token -> 401', (await call(body('x'), 'bad')).status === 401);

// 2. Proposals come back, request is shaped as intended
claudeReply = message([
  { type: 'tool_use', id: 't1', name: 'add_todo', input: { title: 'Oat milk', list: 'Shopping', due_date: null, due_time: null, duration_min: null, starred: false, note: null } },
  { type: 'tool_use', id: 't2', name: 'add_habit', input: { name: 'Vitamin D', days: [1, 2, 3, 4, 5, 6, 7], times_per_week: null, start_time: '09:00', duration_min: 0, category: 'Health', routine: null } },
]);
let res = await call(body('oat milk to shopping, vitamin D every day at 9'));
let out = await res.json();
check('proposals -> 200', res.status === 200, out);
check('two actions', out.actions?.length === 2 && out.actions[0].tool === 'add_todo' && out.actions[1].input.name === 'Vitamin D', out);
const sent = lastClaudeRequest!.body;
check('model defaults to Sonnet 5.5', sent.model === 'claude-sonnet-5-5', sent.model);
check('low effort', (sent.output_config as { effort: string }).effort === 'low');
check('fallbacks default + beta header', sent.fallbacks === 'default' && (lastClaudeRequest!.headers.get('anthropic-beta') ?? '').includes('server-side-fallback-2026-07-01'));
check('tool_choice auto', (sent.tool_choice as { type: string }).type === 'auto');
check('all tools strict', (sent.tools as { strict: boolean }[]).every((t) => t.strict) && (sent.tools as unknown[]).length === TOOLS.length);
check('api key sent', lastClaudeRequest!.headers.get('x-api-key') === 'test-key');
const userText = ((sent.messages as { content: string }[])[0]).content;
check('user message has today and lists', userText.includes('Wednesday 2026-10-07') && userText.includes('Lists: Shopping, Errands'), userText);
check('CORS echoes the app origin', res.headers.get('access-control-allow-origin') === 'https://cadence-nova.vercel.app');

// 3. A follow-up question replaces any partial actions
claudeReply = message([{ type: 'tool_use', id: 't3', name: 'ask_followup', input: { question: 'Add it to Morning routine?', options: ['Add to Morning routine', 'Keep it separate'] } }]);
out = await (await call(body('vitamin D at 7:15 every weekday'))).json();
check('question returned', out.question?.text === 'Add it to Morning routine?' && out.actions.length === 0, out);

// 4. The answer is sent with the conversation so far
claudeReply = message([{ type: 'text', text: 'ok' }], 'end_turn');
await call(body('Add to Morning routine', { transcript: [{ role: 'user', text: 'vitamin D at 7:15 every weekday' }, { role: 'assistant', text: 'Add it to Morning routine?' }] }));
const convo = ((lastClaudeRequest!.body.messages as { content: string }[])[0]).content;
check('transcript included', convo.includes('You asked: Add it to Morning routine?') && convo.includes('User now answers: Add to Morning routine'), convo);

// 5. Refusal and errors are explained, not thrown
claudeReply = message([], 'refusal');
out = await (await call(body('x'))).json();
check('refusal -> message', /declined/.test(out.message ?? ''), out);
claudeStatus = 401;
claudeReply = { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } };
res = await call(body('x'));
out = await res.json();
check('bad key -> 502 with a clear reason', res.status === 502 && /ANTHROPIC_API_KEY/.test(out.error), out);
claudeStatus = 200;

// 6. Input limits
check('empty text -> 400', (await call(body('  '))).status === 400);
check('too long -> 400', (await call(body('x'.repeat(1001)))).status === 400);

// 7. Only allowed accounts
Deno.env.set('CAPTURE_ALLOWED_EMAILS', 'someone@else.com');
check('other account -> 403', (await call(body('x'))).status === 403);

await claude.shutdown();
await auth.shutdown();
console.log(failures ? `${failures} failed` : 'all passed');
Deno.exit(failures ? 1 : 0);
