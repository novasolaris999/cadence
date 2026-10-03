import { useApplyMove, useHabitsBlocks, useTargetBlocks, useTargets } from '../data/queries';
import { planGroupMove, planMove, siblingsInScope, type MoveScope } from '../domain/moves';
import { targetDays } from '../domain/schedule';
import { formatDayShort, formatDays, formatTime, weekdayShort } from '../domain/time';
import type { Block, Minutes, Routine, Target } from '../domain/types';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';

export interface PendingMove {
  block: Block;
  target: Target | null;
  newStart: Minutes;
  /** Set when a whole routine card moved: `block` is the card's stand-in, `members` its habits' blocks. */
  group?: { routine: Routine; members: Block[] };
}

/**
 * After you drag a target's block (or change its time), ask how far the change reaches.
 * One-off blocks never get here: they just move.
 */
export function MoveScopeSheet({ pending, onDone }: { pending: PendingMove | null; onDone: () => void }) {
  if (pending?.group) return <GroupMoveSheet pending={pending} group={pending.group} onDone={onDone} />;
  return <SingleMoveSheet pending={pending} onDone={onDone} />;
}

function SingleMoveSheet({ pending, onDone }: { pending: PendingMove | null; onDone: () => void }) {
  const { data: targetBlocks = [] } = useTargetBlocks(pending?.target?.id ?? null, pending?.block.date ?? '');
  const apply = useApplyMove();
  if (!pending || !pending.target) return null;
  const { block, target, newStart } = pending;

  const choose = (scope: MoveScope) =>
    apply.mutate(planMove(block, newStart, scope, targetBlocks, target), { onSuccess: onDone });

  const weekCount = siblingsInScope(block, targetBlocks, 'week').length;
  const futureCount = siblingsInScope(block, targetBlocks, 'future').length;

  return (
    <Sheet open onClose={onDone} title={`Move to ${formatTime(newStart)}?`}>
      <p className="-mt-1 mb-3 text-body-sm text-muted">
        {target.name}, {formatDayShort(block.date)} at {formatTime(block.start)}
      </p>
      <div className="flex flex-col gap-2">
        <ScopeOption icon="event" title="Only this day" detail={formatDayShort(block.date)} onClick={() => choose('day')} />
        <ScopeOption
          icon="date_range"
          title="Rest of this week"
          detail={weekCount ? `This one and ${weekCount} more through Sunday` : 'No other blocks left this week'}
          disabled={weekCount === 0}
          onClick={() => choose('week')}
        />
        <ScopeOption
          icon="repeat"
          title="This and all future"
          detail={`${futureCount + 1} block${futureCount ? 's' : ''}, and new weeks start at ${formatTime(newStart)}${
            target.preferredDays.length ? ` on ${target.preferredDays.map(weekdayShort).join(', ')}` : ''
          }`}
          onClick={() => choose('future')}
        />
        <button type="button" onClick={onDone} className="mt-1 rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-label-sm text-faint">
        Earlier days and blocks already done or skipped never change.
      </p>
    </Sheet>
  );
}

/** Moving a routine card: the same three scopes, applied to every habit in it. */
function GroupMoveSheet({
  pending,
  group,
  onDone,
}: {
  pending: PendingMove;
  group: NonNullable<PendingMove['group']>;
  onDone: () => void;
}) {
  const { data: targets = [] } = useTargets();
  const ids = group.members.map((b) => b.targetId).filter((id): id is string => id !== null);
  const all = useHabitsBlocks(ids, pending.block.date);
  const apply = useApplyMove();
  const { routine, members } = group;
  const { newStart, block } = pending;
  const first = members[0]!;

  const choose = (scope: MoveScope) =>
    apply.mutate(planGroupMove(members, newStart, scope, all, targets, routine), { onSuccess: onDone });

  // Every habit in the routine shares its days, so the first habit's later blocks count the later cards.
  const weekCount = siblingsInScope(first, all, 'week').length;
  const futureCount = siblingsInScope(first, all, 'future').length;

  return (
    <Sheet open onClose={onDone} title={`Move to ${formatTime(newStart)}?`}>
      <p className="-mt-1 mb-3 text-body-sm text-muted">
        {routine.name} ({members.length} habits), {formatDayShort(block.date)} at {formatTime(block.start)}
      </p>
      <div className="flex flex-col gap-2">
        <ScopeOption icon="event" title="Only this day" detail={formatDayShort(block.date)} onClick={() => choose('day')} />
        <ScopeOption
          icon="date_range"
          title="Rest of this week"
          detail={weekCount ? `This one and ${weekCount} more through Sunday` : 'No other days left this week'}
          disabled={weekCount === 0}
          onClick={() => choose('week')}
        />
        <ScopeOption
          icon="repeat"
          title="This and all future"
          detail={`${futureCount + 1} day${futureCount ? 's' : ''}, and from now on it starts at ${formatTime(newStart)} (${formatDays(targetDays(routine), routine.frequencyPerWeek)})`}
          onClick={() => choose('future')}
        />
        <button type="button" onClick={onDone} className="mt-1 rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-label-sm text-faint">Earlier days and habits already done or skipped never change.</p>
    </Sheet>
  );
}

/** One choice in a scope sheet: icon, title, and what it will do. */
export function ScopeOption({
  icon,
  title,
  detail,
  disabled,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left hover:border-primary disabled:opacity-40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-label-lg font-semibold">{title}</span>
        <span className="text-body-sm text-muted">{detail}</span>
      </span>
    </button>
  );
}
