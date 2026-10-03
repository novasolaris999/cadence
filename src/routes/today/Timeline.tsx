import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragStartEvent,
} from '@dnd-kit/core';
import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import type { BlockView } from '../../components/blockView';
import { clampStart } from '../../domain/moves';
import { formatDuration, formatTime } from '../../domain/time';
import type { Minutes } from '../../domain/types';
import { daySpan, HEADER_H, lanes, minuteAt, place, rowHeights, sectionLabel, segments, SLOT, yOf, type Segment } from './layout';
import { routineCardPx, TimelineBlock } from './TimelineBlock';

const GUTTER = 52; // px reserved for time labels

interface Props {
  views: BlockView[];
  wakeAnchor: Minutes;
  sleepAnchor: Minutes;
  /** Current minute when showing today, otherwise null (no now line). */
  now: Minutes | null;
  /** True when the day shown is in the past: unfinished blocks there are misses. */
  past: boolean;
  showEarly: boolean;
  showLate: boolean;
  onShowEarly: (v: boolean) => void;
  onShowLate: (v: boolean) => void;
  onToggle: (id: string) => void;
  onOpen: (view: BlockView) => void;
  onAddAt: (start: Minutes) => void;
  onDrop: (view: BlockView, newStart: Minutes) => void;
}

interface Drag {
  view: BlockView;
  /** Where the block's top is now, in timeline coordinates (follows the finger). */
  y: number;
}

/**
 * Vertical day timeline in 15-minute rows.
 * - Long empty stretches collapse into a "Free" row; tap to open.
 * - Edge toggles extend the view to 00:00 or 24:00 (remembered on this device).
 * - Tap an empty row to add a block there. Tap a block to edit it.
 * - Press and hold a block (or click and drag with a mouse) to move it in 15-minute steps.
 *   While dragging, collapsed stretches open so every 15 minutes is the same height, and the
 *   page scrolls by the same amount so the block stays under your finger.
 */
export function Timeline(props: Props) {
  const { views, wakeAnchor, sleepAnchor, now, past, showEarly, showLate } = props;
  const [expanded, setExpanded] = useState<Set<Minutes>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const blocks = useMemo(() => views.map((v) => v.block), [views]);
  const base = useMemo(() => daySpan(blocks, wakeAnchor, sleepAnchor), [blocks, wakeAnchor, sleepAnchor]);
  const span = useMemo(
    () => daySpan(blocks, wakeAnchor, sleepAnchor, { showEarly, showLate }),
    [blocks, wakeAnchor, sleepAnchor, showEarly, showLate],
  );
  const nowInSpan = now !== null && now >= span.from && now < span.to ? now : null;
  const collapsedSegs = useMemo(() => segments(blocks, span, nowInSpan, expanded), [blocks, span, nowInSpan, expanded]);
  const segs: Segment[] = useMemo(
    () => (drag ? [{ kind: 'rows', from: span.from, to: span.to }] : collapsedSegs),
    [drag, collapsedSegs, span],
  );
  // Routine cards get the room their habits need: their rows grow, the clock labels stay the same.
  const rowH = useMemo(
    () =>
      rowHeights(
        views
          .filter((v) => v.group)
          .map((v) => ({ from: v.block.start, to: v.block.start + v.block.durationMin, minPx: routineCardPx(v.group!.members.length) })),
      ),
    [views],
  );
  const { items, height } = useMemo(() => place(segs, rowH), [segs, rowH]);
  const collapsed = useMemo(() => place(collapsedSegs, rowH).items, [collapsedSegs, rowH]);
  const laneMap = useMemo(() => lanes(blocks), [blocks]);

  // ----- Drag and drop -----
  // Touch: hold 250 ms before a drag starts, so normal swipes still scroll the page.
  // Mouse: a 6 px move starts a drag, so plain clicks still open the block.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const lastDragEnd = useRef(0);
  const pendingScroll = useRef(0);
  const inner = useRef<HTMLDivElement>(null);
  // Finger tracking, kept in refs so window listeners always see the latest values.
  const grab = useRef({ offset: 0, clientY: 0 });
  const latest = useRef<Drag | null>(null);

  const fullItems = useMemo(() => place([{ kind: 'rows', from: span.from, to: span.to }], rowH).items, [span, rowH]);

  // Opening (or re-collapsing) stretches above the block moves it on the page. Scroll by the
  // same amount before the browser paints, so nothing jumps under your finger.
  useLayoutEffect(() => {
    if (pendingScroll.current) {
      window.scrollBy(0, pendingScroll.current);
      pendingScroll.current = 0;
    }
  }, [drag !== null]);

  /** Moves the dragged block so it stays under a finger at clientY (page scroll included). */
  const follow = (clientY: number) => {
    const d = latest.current;
    const el = inner.current;
    if (!d || !el) return;
    grab.current.clientY = clientY;
    latest.current = { ...d, y: clientY - el.getBoundingClientRect().top - grab.current.offset };
    setDrag(latest.current);
  };

  // While dragging, follow the finger directly. This also covers auto-scroll near the edges.
  useEffect(() => {
    if (!drag) return;
    const onMouse = (e: globalThis.MouseEvent) => follow(e.clientY);
    const onTouch = (e: TouchEvent) => e.touches[0] && follow(e.touches[0].clientY);
    const onScroll = () => follow(grab.current.clientY);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('scroll', onScroll);
    };
  }, [drag !== null]);

  const onDragStart = (e: DragStartEvent) => {
    const view = views.find((v) => v.block.id === e.active.id);
    const el = inner.current;
    if (!view || !el) return;
    const ev = e.activatorEvent as globalThis.MouseEvent | TouchEvent;
    const clientY = 'touches' in ev ? (ev.touches[0]?.clientY ?? 0) : ev.clientY;
    const topNow = yOf(collapsed, view.block.start);
    const topExpanded = yOf(fullItems, view.block.start);
    grab.current = { offset: clientY - el.getBoundingClientRect().top - topNow, clientY };
    pendingScroll.current = topExpanded - topNow;
    latest.current = { view, y: topExpanded };
    setDrag(latest.current);
    navigator.vibrate?.(10);
  };

  /** Snapped start time for the block's current position. */
  const dropStart = (d: Drag): Minutes =>
    clampStart(Math.round(minuteAt(fullItems, d.y) / SLOT) * SLOT, d.view.block.durationMin);

  const finish = (commit: boolean) => {
    const d = latest.current;
    latest.current = null;
    if (!d) return;
    const start = commit ? dropStart(d) : d.view.block.start;
    lastDragEnd.current = Date.now();
    // When stretches collapse again, keep the block where it landed on screen.
    const after = place(
      segments(blocks.map((b) => (b.id === d.view.block.id ? { ...b, start } : b)), span, nowInSpan, expanded),
      rowH,
    ).items;
    pendingScroll.current = yOf(after, start) - yOf(fullItems, start) - (d.y - yOf(fullItems, start));
    setDrag(null);
    if (commit && start !== d.view.block.start) props.onDrop(d.view, start);
  };

  const openBlock = (v: BlockView) => {
    if (Date.now() - lastDragEnd.current < 300) return; // the click that ends a mouse drag
    props.onOpen(v);
  };

  const addAt = (e: MouseEvent<HTMLDivElement>, segFrom: Minutes, rowPx: number) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    props.onAddAt(segFrom + Math.floor(y / rowPx) * SLOT);
  };

  const hiddenNowEarly = now !== null && !showEarly && now < base.from;
  const hiddenNowLate = now !== null && !showLate && now >= base.to;
  const landing = drag ? dropStart(drag) : null;

  return (
    <DndContext sensors={sensors} autoScroll={{ layoutShiftCompensation: false }} onDragStart={onDragStart} onDragEnd={() => finish(true)} onDragCancel={() => finish(false)}>
      <div className="rounded-xl bg-surface p-2 shadow-card">
        {base.from > 0 && (
          <EdgeToggle
            open={showEarly}
            onClick={() => props.onShowEarly(!showEarly)}
            icon={showEarly ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
            label={showEarly ? `Hide before ${formatTime(base.from)}` : `00:00 – ${formatTime(base.from)}`}
            nowHidden={hiddenNowEarly}
          />
        )}

        <div ref={inner} className="relative" style={{ height }}>
          {items.map((it) =>
            it.kind === 'gap' ? (
              <button
                key={`gap-${it.from}`}
                type="button"
                onClick={() => setExpanded((s) => new Set(s).add(it.from))}
                className="absolute inset-x-0 flex items-center gap-2 text-faint hover:text-muted"
                style={{ top: it.top, height: it.height }}
                aria-label={`Show free time ${formatTime(it.from)} to ${formatTime(it.to)}`}
              >
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-label-sm uppercase tracking-wider">Free · {formatDuration(it.to - it.from)}</span>
                <span className="h-px flex-1 bg-border" />
              </button>
            ) : (
              <Rows key={`rows-${it.from}`} it={it} nowInSpan={nowInSpan} onClick={(e) => addAt(e, it.from, it.rowH)} />
            ),
          )}

          {drag && landing !== null && (
            <div
              className="pointer-events-none absolute rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
              style={{
                top: yOf(items, landing),
                height: yOf(items, landing + drag.view.block.durationMin) - yOf(items, landing),
                left: GUTTER,
                right: 4,
              }}
            />
          )}

          {views.map((v) => {
            const { lane, of } = laneMap.get(v.block.id) ?? { lane: 0, of: 1 };
            const end = v.block.start + v.block.durationMin;
            const nowIn = now !== null && now >= v.block.start && now < end ? now : null;
            const isDragged = drag?.view.block.id === v.block.id;
            return (
              <DraggableBlock
                key={v.block.id}
                id={v.block.id}
                offset={isDragged ? drag.y - yOf(items, v.block.start) : 0}
                dragging={isDragged}
                label={isDragged && landing !== null ? formatTime(landing) : null}
                onOpen={() => openBlock(v)}
                style={{
                  top: yOf(items, v.block.start),
                  height: yOf(items, end) - yOf(items, v.block.start),
                  left: `calc(${GUTTER}px + (100% - ${GUTTER + 4}px) * ${lane / of})`,
                  width: `calc((100% - ${GUTTER + 4}px) / ${of})`,
                }}
              >
                <TimelineBlock
                  view={v}
                  nowInBlock={nowIn}
                  missed={past && v.block.status === 'planned'}
                  onToggle={() => props.onToggle(v.block.id)}
                  onToggleId={props.onToggle}
                  onOpen={() => openBlock(v)}
                />
              </DraggableBlock>
            );
          })}

          {nowInSpan !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 grid items-center"
              style={{ top: yOf(items, nowInSpan) - 1, gridTemplateColumns: `${GUTTER - 4}px 1fr` }}
              aria-label={`Now, ${formatTime(nowInSpan)}`}
            >
              <span className="font-mono text-label-sm font-bold text-now">{formatTime(nowInSpan)}</span>
              <div className="relative flex h-0.5 items-center bg-now">
                <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-now" />
                <span className="ml-auto rounded-full bg-now px-1.5 font-mono text-[10px] font-semibold text-on-now">NOW</span>
              </div>
            </div>
          )}
        </div>

        {base.to < 24 * 60 && (
          <EdgeToggle
            open={showLate}
            onClick={() => props.onShowLate(!showLate)}
            icon={showLate ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            label={showLate ? `Hide after ${formatTime(base.to)}` : `${formatTime(base.to)} – 24:00`}
            nowHidden={hiddenNowLate}
          />
        )}
      </div>
    </DndContext>
  );
}

/** A run of 15-minute rows with time labels. Tapping an empty row adds a block there. */
function Rows({
  it,
  nowInSpan,
  onClick,
}: {
  it: { from: Minutes; to: Minutes; top: number; height: number; header: boolean; rowH: number };
  nowInSpan: Minutes | null;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  const rows: Minutes[] = [];
  for (let m = it.from; m < it.to; m += SLOT) rows.push(m);
  return (
    <>
      {it.header && (
        <div
          className="absolute inset-x-0 flex items-center px-1 font-mono text-label-sm uppercase tracking-wider text-faint"
          style={{ top: it.top - HEADER_H, height: HEADER_H }}
        >
          {formatTime(it.from)} · {sectionLabel(it.from)}
        </div>
      )}
      <div className="absolute inset-x-0 cursor-pointer" style={{ top: it.top, height: it.height }} onClick={onClick}>
        {rows.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 grid items-center rounded-md transition-colors hover:bg-primary/5"
            style={{ top: ((m - it.from) / SLOT) * it.rowH, height: it.rowH, gridTemplateColumns: `${GUTTER - 4}px 1fr` }}
          >
            <span
              className={cx(
                'font-mono text-label-sm',
                m % 60 === 0 ? 'text-text' : 'text-faint',
                nowInSpan !== null && Math.abs(nowInSpan - (m + SLOT / 2)) < 12 && 'invisible',
              )}
            >
              {formatTime(m)}
            </span>
            <span className={cx('h-px w-full', m % 60 === 0 ? 'bg-border' : 'bg-border/50')} />
          </div>
        ))}
      </div>
    </>
  );
}

function DraggableBlock({
  id,
  style,
  offset,
  dragging,
  label,
  onOpen,
  children,
}: {
  id: string;
  style: CSSProperties;
  /** Vertical px to follow the finger while dragging. */
  offset: number;
  dragging: boolean;
  /** New start time shown while dragging. */
  label: string | null;
  onOpen: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // A container, not a button: it holds its own buttons (open, check). Opening by keyboard goes
      // through the card's OpenOverlay; dragging is by touch or mouse.
      role="group"
      tabIndex={undefined}
      aria-roledescription="Draggable block. Press and hold to move."
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cx(
        'absolute cursor-pointer select-none p-0.5 [-webkit-touch-callout:none]',
        dragging ? 'z-30 cursor-grabbing opacity-95 drop-shadow-xl' : 'z-10',
      )}
      style={{
        ...style,
        touchAction: 'manipulation',
        transform: dragging ? `translate3d(0, ${offset}px, 0) scale(1.02)` : undefined,
      }}
    >
      {children}
      {label && (
        <span className="absolute -top-3 right-2 rounded-full bg-primary px-2 py-0.5 font-mono text-label-sm font-semibold text-on-primary shadow-float">
          {label}
        </span>
      )}
    </div>
  );
}

/** Subtle control at the top or bottom edge that shows or hides the hours outside your anchors. */
function EdgeToggle({
  open,
  onClick,
  icon,
  label,
  nowHidden,
}: {
  open: boolean;
  onClick: () => void;
  icon: 'keyboard_arrow_up' | 'keyboard_arrow_down';
  label: string;
  nowHidden: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex w-full items-center justify-center gap-1 rounded-md py-1 font-mono text-label-sm text-faint transition-colors hover:bg-surface-2 hover:text-muted"
    >
      <Icon name={icon} size={16} />
      {label}
      {nowHidden && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-now" title="The current time is in here" />}
    </button>
  );
}
