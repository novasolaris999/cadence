// The capture server function (api/capture.ts), end to end with stand-ins for Claude and Supabase Auth.
// The real Claude SDK is used, pointed at a fake fetch, so the exact request that would go to Claude is checked.
import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { handle, TOOLS, type Deps } from '../api/capture';

let sent: { headers: Headers; body: Record<string, unknown> } | null = null;
let reply: { status: number; body: unknown } = { status: 200, body: {} };

const claudeFetch: typeof fetch = async (_url, init) => {
  sent = { headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
};
const authFetch: typeof fetch = async (_url, init) =>
  new Headers(init?.headers).get('authorization') === 'Bearer good'
    ? Response.json({ id: 'u1', email: 'owner@example.com' })
    : new Response('{}', { status: 401 });

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

let env: Record<string, string | undefined>;
const deps = (): Deps => ({
  env,
  fetch: authFetch,
  client: new Anthropic({ apiKey: 'test-key', fetch: claudeFetch, maxRetries: 0 }),
});
const call = (b: unknown, token = 'good') =>
  handle(new Request('https://app/api/capture', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(b) }), deps());

beforeEach(() => {
  sent = null;
  reply = { status: 200, body: {} };
  env = { CAPTURE_ALLOWED_EMAILS: 'Owner@Example.com, other@example.com', VITE_SUPABASE_URL: 'https://x.supabase.co' };
});

describe('capture server', () => {
  it('needs a signed-in, allowed account', async () => {
    expect((await call(body('x'), 'bad')).status).toBe(401);
    env.CAPTURE_ALLOWED_EMAILS = 'someone@else.com';
    expect((await call(body('x'))).status).toBe(403);
    env.CAPTURE_ALLOWED_EMAILS = '';
    expect((await call(body('x'))).status).toBe(403);
  });

  it('explains a missing key instead of failing silently', async () => {
    const res = await handle(
      new Request('https://app/api/capture', { method: 'POST', headers: { authorization: 'Bearer good' }, body: '{}' }),
      { env, fetch: authFetch },
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('returns proposals and asks Claude as intended', async () => {
    reply.body = message([
      { type: 'tool_use', id: 't1', name: 'add_todo', input: { title: 'Oat milk', list: 'Shopping', due_date: null, due_time: null, duration_min: null, starred: false, note: null } },
      { type: 'tool_use', id: 't2', name: 'add_habit', input: { name: 'Vitamin D', days: [1, 2, 3, 4, 5, 6, 7], times_per_week: null, start_time: '09:00', duration_min: 15, category: 'Health', routine: null } },
    ]);
    const res = await call(body('oat milk to shopping, vitamin D every day at 9'));
    const out = await res.json();
    expect(res.status).toBe(200);
    expect(out.actions.map((a: { tool: string }) => a.tool)).toEqual(['add_todo', 'add_habit']);

    const s = sent!;
    expect(s.body.model).toBe('claude-sonnet-5-5');
    expect(s.body.output_config).toEqual({ effort: 'low' });
    expect(s.body.fallbacks).toBe('default');
    expect(s.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(s.body.tool_choice).toEqual({ type: 'auto' });
    expect((s.body.tools as { strict: boolean }[]).every((t) => t.strict)).toBe(true);
    expect((s.body.tools as unknown[]).length).toBe(TOOLS.length);
    const text = (s.body.messages as { content: string }[])[0]!.content;
    expect(text).toContain('Wednesday 2026-10-07');
    expect(text).toContain('Lists: Shopping, Errands.');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('uses another model when CAPTURE_MODEL is set', async () => {
    env.CAPTURE_MODEL = 'claude-haiku-4-5';
    reply.body = message([{ type: 'text', text: 'ok' }], 'end_turn');
    await call(body('x'));
    expect(sent!.body.model).toBe('claude-haiku-4-5');
  });

  it('returns a follow-up question on its own, and sends the conversation with the answer', async () => {
    reply.body = message([{ type: 'tool_use', id: 't3', name: 'ask_followup', input: { question: 'Add it to Morning routine?', options: ['Add to Morning routine', 'Keep it separate'] } }]);
    const out = await (await call(body('vitamin D at 7:15 every weekday'))).json();
    expect(out.question.text).toBe('Add it to Morning routine?');
    expect(out.actions).toEqual([]);

    reply.body = message([{ type: 'text', text: 'ok' }], 'end_turn');
    await call(body('Add to Morning routine', { transcript: [{ role: 'user', text: 'vitamin D at 7:15 every weekday' }, { role: 'assistant', text: 'Add it to Morning routine?' }] }));
    const convo = (sent!.body.messages as { content: string }[])[0]!.content;
    expect(convo).toContain('You asked: Add it to Morning routine?');
    expect(convo).toContain('User now answers: Add to Morning routine');
  });

  it('explains refusals and errors in plain words', async () => {
    reply.body = message([], 'refusal');
    expect((await (await call(body('x'))).json()).message).toMatch(/declined/);
    reply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
    const res = await call(body('x'));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('limits what it accepts', async () => {
    expect((await call(body('  '))).status).toBe(400);
    expect((await call(body('x'.repeat(1001)))).status).toBe(400);
    const res = await handle(new Request('https://app/api/capture', { method: 'GET' }), deps());
    expect(res.status).toBe(405);
  });
});
