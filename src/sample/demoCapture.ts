// Demo-mode stand-in for capture. A few fixed patterns, no AI, nothing leaves the device. It exists so the
// capture flow (preview cards, follow-up question, confirm) can be tried and tested in demo mode; the real
// reading is done by Claude through the capture Edge Function.

import type { CaptureReply, CaptureRequest } from '../domain/capture';
import { addDays } from '../domain/time';

const DAYS: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };

/** "9am", "9:30 pm", "18:00" to "HH:MM", or null. */
function clock(s: string): string | null {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  let h = Number(m[1]);
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
  return h > 23 ? null : `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

const reply = (actions: CaptureReply['actions'], question: CaptureReply['question'] = null): CaptureReply => ({
  actions,
  question,
  message: null,
  model: 'demo',
});

const todo = (title: string, list: string | null, due_date: string | null = null) => ({
  tool: 'add_todo',
  input: { title, list, due_date, due_time: null, duration_min: null, starred: false, note: null },
});

export async function demoCapture(req: CaptureRequest): Promise<CaptureReply> {
  await new Promise((r) => setTimeout(r, 500)); // feels like a request, so the loading state shows
  const today = req.now.date;
  const original = req.transcript.find((t) => t.role === 'user')?.text ?? req.text;

  // An answer to "Is this a to-do, a habit, or a one-off block?"
  if (req.transcript.length > 0) {
    const a = req.text.toLowerCase();
    if (a.includes('habit')) {
      return reply([{ tool: 'add_habit', input: { name: original, days: [1, 2, 3, 4, 5, 6, 7], times_per_week: null, start_time: null, duration_min: 0, category: null, routine: null } }]);
    }
    if (a.includes('block')) {
      return reply([{ tool: 'add_block', input: { title: original, date: addDays(today, 1), start_time: '10:00', duration_min: 60, category: null, note: null } }]);
    }
    return reply([todo(original, null)]);
  }

  const text = req.text.trim().replace(/[.!]+$/, '');
  const lists = req.context.lists;

  // "oat milk and batteries to shopping"
  const toList = /^(?:add\s+)?(.+?)\s+to\s+(?:my\s+|the\s+)?(\w+)(?:\s+list)?$/i.exec(text);
  const list = toList && lists.find((l) => l.toLowerCase() === toList[2]!.toLowerCase());
  if (toList && list) {
    const items = toList[1]!.split(/\s*,\s*|\s+and\s+/i).filter(Boolean);
    return reply(items.map((i) => todo(i.charAt(0).toUpperCase() + i.slice(1), list)));
  }

  // "vitamin D every day at 9am", "gym every monday at 6pm"
  const repeat = /^(?:add\s+)?(.+?)\s+(?:every\s*day|daily|every\s+(\w+day))\b(.*)$/i.exec(text);
  if (repeat) {
    const time = clock(repeat[3] ?? '');
    const day = repeat[2] ? DAYS[repeat[2].toLowerCase()] : undefined;
    if (!time) return reply([], { text: `What time should ${repeat[1]} be?`, options: ['Morning, 8:00', 'Noon', 'Evening, 19:00'] });
    return reply([{ tool: 'add_habit', input: { name: repeat[1], days: day ? [day] : [1, 2, 3, 4, 5, 6, 7], times_per_week: null, start_time: time, duration_min: 15, category: null, routine: null } }]);
  }

  // "dentist tomorrow at 3pm"
  const when = /^(?:add\s+)?(.+?)\s+(today|tomorrow)\b(.*)$/i.exec(text);
  if (when) {
    const date = when[2]!.toLowerCase() === 'today' ? today : addDays(today, 1);
    const time = clock(when[3] ?? '');
    if (time) return reply([{ tool: 'add_block', input: { title: when[1], date, start_time: time, duration_min: 60, category: null, note: null } }]);
    return reply([todo(when[1]!, null, date)]);
  }

  return reply([], { text: 'Is this a to-do, a habit, or a one-off block?', options: ['To-do', 'Habit', 'One-off block'] });
}
