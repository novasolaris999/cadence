import { useEffect, useRef, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { requestCapture, useApplyCapture, useCaptureContext } from '../data/queries';
import { useDemoMode } from '../data/index';
import { buildTodo, habitIsAnytime, readProposals, type CaptureReply, type Proposal } from '../domain/capture';
import { habitLength } from '../domain/routines';
import { dueLabel } from '../domain/todos';
import { formatDayShort, formatDays, formatTime, formatTimeRange, isoWeekday } from '../domain/time';
import { useNow } from '../theme/useNow';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { toast } from './Toaster';

const EXAMPLES = ['Oat milk and batteries to shopping', 'Vitamin D every day at 9am', 'Dentist tomorrow at 3pm'];

type Turn = { role: 'user' | 'assistant'; text: string };
type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'question'; question: NonNullable<CaptureReply['question']> }
  | { kind: 'proposals'; proposals: Proposal[]; dropped: number; said: string }
  | { kind: 'message'; text: string; said: string }
  | { kind: 'error'; text: string };

/**
 * Capture: type (or dictate with the keyboard mic) what to add, in your own words. Claude reads it and proposes
 * to-dos, habits, routines, or one-off blocks as cards; nothing is saved until you tap Add. If something is
 * missing, it asks one question first.
 */
export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CaptureFlow onClose={onClose} /> : null;
}

function CaptureFlow({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const demo = useDemoMode();
  const ctx = useCaptureContext();
  const apply = useApplyCapture();
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const online = useOnline();

  useEffect(() => input.current?.focus(), [phase.kind === 'question']);

  const send = async (said: string) => {
    const t = said.trim();
    if (!t || phase.kind === 'reading') return;
    setPhase({ kind: 'reading' });
    try {
      const reply = await requestCapture({
        text: t,
        transcript,
        now: { date: now.today, time: formatTime(now.minutes), weekday: isoWeekday(now.today) },
        context: ctx.request,
      });
      if (reply.question) {
        // Keep the conversation so the answer is read together with the original request.
        setTranscript((tr) => [...tr, { role: 'user', text: t }, { role: 'assistant', text: reply.question!.text }]);
        setPhase({ kind: 'question', question: reply.question });
      } else {
        const { proposals, dropped } = readProposals(reply, ctx.match);
        setSkip(new Set());
        if (proposals.length > 0) setPhase({ kind: 'proposals', proposals, dropped, said: t });
        else setPhase({ kind: 'message', said: t, text: reply.message ?? (dropped ? 'That could not be turned into something to add. Try saying it differently.' : 'Nothing to add found. Try saying what and when.') });
      }
      setText('');
    } catch (e) {
      setPhase({ kind: 'error', text: e instanceof Error ? e.message : 'Capture failed. Try again.' });
    }
  };

  const reset = () => {
    setTranscript([]);
    setText('');
    setPhase({ kind: 'idle' });
    input.current?.focus();
  };

  const confirm = async (proposals: Proposal[]) => {
    const chosen = proposals.filter((_, i) => !skip.has(i));
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      await apply(chosen);
      // Habits and routines announce themselves (with their first block); say what else went in.
      const quiet = chosen.filter((p) => p.kind === 'todo' || p.kind === 'block').length;
      if (quiet === chosen.length) toast(chosen.length === 1 ? 'Added' : `Added ${chosen.length} items`, 'info');
      onClose();
    } catch {
      setSaving(false); // the failed save already shows its own notice
    }
  };

  const shown: Turn[] = phase.kind === 'proposals' || phase.kind === 'message' ? [...transcript, { role: 'user', text: phase.said }] : transcript;
  const reading = phase.kind === 'reading';
  const answering = phase.kind === 'question';
  const placeholder = answering ? 'Or type your answer' : 'What do you want to add?';

  return (
    <Sheet open onClose={onClose} title="Capture">
      <div className="flex flex-col gap-3">
        {/* The conversation so far: what you said and what Claude asked, then your latest words. */}
        {shown.length > 0 && (
          <ol className="flex flex-col gap-1.5" aria-label="Conversation">
            {shown.map((t, i) => (
              <li
                key={i}
                className={cx(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-body-md',
                  t.role === 'user' ? 'self-end rounded-br-md bg-primary/10 text-text' : 'self-start rounded-bl-md bg-surface-2 text-text',
                )}
              >
                {t.text}
              </li>
            ))}
          </ol>
        )}

        {answering && phase.question.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Answers">
            {phase.question.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => void send(o)}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-label-lg font-semibold text-primary-ink active:scale-95"
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {phase.kind !== 'proposals' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-2 p-2 focus-within:border-primary">
              <textarea
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                rows={answering ? 1 : 3}
                maxLength={1000}
                disabled={reading}
                placeholder={placeholder}
                aria-label={placeholder}
                className="min-h-10 flex-1 resize-none bg-transparent px-1.5 py-1 text-body-lg text-text outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                disabled={!text.trim() || reading || !online}
                aria-label="Send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-card active:scale-95 disabled:opacity-40"
              >
                {reading ? <Spinner /> : <Icon name="send" size={20} />}
              </button>
            </div>
            {!online && <p className="text-body-sm text-warn-ink">Capture needs a connection. You can still add things with the + button.</p>}
          </form>
        )}

        {phase.kind === 'idle' && transcript.length === 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-label-sm font-semibold uppercase tracking-wider text-muted">Try</span>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => setText(x)} className="rounded-full bg-surface-2 px-3 py-1.5 text-label-md text-muted hover:text-text">
                  {x}
                </button>
              ))}
            </div>
            <p className="text-body-sm text-muted">Tip: tap the mic on your keyboard to say it instead of typing.</p>
          </div>
        )}

        {reading && (
          <p role="status" className="text-body-sm text-muted">
            Reading…
          </p>
        )}
        {phase.kind === 'error' && (
          <p role="alert" className="rounded-xl bg-miss/10 p-3 text-body-sm text-miss-ink">
            {phase.text}
          </p>
        )}
        {phase.kind === 'message' && <p className="rounded-xl bg-surface-2 p-3 text-body-md text-text">{phase.text}</p>}

        {phase.kind === 'proposals' && (
          <>
            <p className="text-body-sm text-muted">
              Check {phase.proposals.length === 1 ? 'it' : 'them'} before adding. Tap a card to leave it out.
            </p>
            <ul className="flex flex-col gap-2">
              {phase.proposals.map((p, i) => (
                <li key={i}>
                  <ProposalCard
                    proposal={p}
                    included={!skip.has(i)}
                    onToggle={() =>
                      setSkip((s) => {
                        const next = new Set(s);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    names={ctx.match}
                    today={now.today}
                  />
                </li>
              ))}
            </ul>
            {phase.dropped > 0 && (
              <p className="text-body-sm text-warn-ink">
                {phase.dropped === 1 ? 'One part' : `${phase.dropped} parts`} could not be read clearly and {phase.dropped === 1 ? 'was' : 'were'} left out.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex shrink-0 items-center gap-1 rounded-full border border-border px-4 py-3 text-label-lg font-semibold text-muted hover:text-text"
              >
                <Icon name="refresh" size={18} /> Start over
              </button>
              <button
                type="button"
                disabled={saving || skip.size === phase.proposals.length}
                onClick={() => void confirm(phase.proposals)}
                className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98] disabled:opacity-40"
              >
                {saving ? 'Adding…' : `Add ${phase.proposals.length - skip.size === 1 ? '' : phase.proposals.length - skip.size}`.trim()}
              </button>
            </div>
          </>
        )}

        {(answering || phase.kind === 'message' || phase.kind === 'error') && transcript.length > 0 && (
          <button type="button" onClick={reset} className="self-start text-label-md font-semibold text-muted underline hover:text-text">
            Start over
          </button>
        )}

        <p className="border-t border-border pt-2 text-label-sm text-muted">
          {demo
            ? 'Demo mode: a simple stand-in on this device reads a few fixed phrases. With your real data, Claude reads it.'
            : 'What you type is sent to Claude (Anthropic) to read. Nothing is added until you tap Add.'}
        </p>
      </div>
    </Sheet>
  );
}

const KIND: Record<Proposal['kind'], { label: string; icon: IconName }> = {
  todo: { label: 'To-do', icon: 'checklist' },
  habit: { label: 'Habit', icon: 'check_circle' },
  routine: { label: 'Routine', icon: 'event_repeat' },
  block: { label: 'One-off block', icon: 'event' },
};

/** One proposal, described in the app's own words. Tap to include or leave it out. */
function ProposalCard({
  proposal: p,
  included,
  onToggle,
  names,
  today,
}: {
  proposal: Proposal;
  included: boolean;
  onToggle: () => void;
  names: ReturnType<typeof useCaptureContext>['match'];
  today: string;
}) {
  const category = 'categoryId' in p && p.categoryId ? names.categories.find((c) => c.id === p.categoryId)?.name : undefined;
  const title = p.kind === 'todo' || p.kind === 'block' ? p.title : p.name;
  const details: string[] = [];
  let extra: string | null = null;
  if (p.kind === 'todo') {
    details.push(names.lists.find((l) => l.id === p.listId)?.name ?? 'No list');
    details.push(dueLabel(buildTodo(p, '', ''), today) ?? 'No day');
    if (p.dueTime !== null && p.durationMin) details.push(habitLength(p.durationMin));
    extra = p.note;
  } else if (p.kind === 'habit') {
    const routine = p.routineId ? names.routines.find((r) => r.id === p.routineId) : undefined;
    if (routine) {
      details.push(`In ${routine.name}`, formatDays(routine.preferredDays, routine.frequencyPerWeek), formatTime(routine.preferredStart));
    } else {
      details.push(formatDays(p.days, p.timesPerWeek), habitIsAnytime(p) ? 'Anytime' : formatTime(p.start ?? 0));
    }
    details.push(habitLength(p.durationMin));
  } else if (p.kind === 'routine') {
    details.push(formatDays(p.days, p.days.length), formatTime(p.start), `${p.habits.length} habit${p.habits.length === 1 ? '' : 's'}`);
    extra = p.habits.map((h) => `${h.name} (${habitLength(h.durationMin)})`).join(', ');
  } else {
    details.push(formatDayShort(p.date), formatTimeRange(p.start, p.durationMin));
    extra = p.note;
  }
  if (category) details.push(category);
  const kind = KIND[p.kind];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={included}
      className={cx(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
        included ? 'border-primary/40 bg-surface shadow-card' : 'border-dashed border-border bg-surface-2',
      )}
    >
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', included ? 'bg-primary/10 text-primary-ink' : 'bg-surface-3 text-muted')}>
        <Icon name={kind.icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-muted">{kind.label}</span>
        <span className={cx('text-label-lg font-semibold', included ? 'text-text' : 'text-muted line-through')}>
          {title}
          {p.kind === 'todo' && p.starred && <Icon name="star" filled size={14} className="ml-1 inline align-[-2px] text-warn" title="Starred" />}
        </span>
        <span className="text-body-sm text-muted">{details.join(' · ')}</span>
        {extra && <span className="text-body-sm text-muted">{extra}</span>}
      </span>
      <span className={cx('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', included ? 'border-primary bg-primary text-on-primary' : 'border-faint')}>
        {included && <Icon name="check" size={14} />}
      </span>
    </button>
  );
}

function Spinner() {
  return <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary motion-reduce:animate-none" />;
}

/** Whether the device is online, kept current. */
function useOnline() {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
