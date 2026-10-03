import { ScopeOption } from '../../components/MoveScopeSheet';
import { Sheet } from '../../components/Sheet';
import { useApplyDayMove, useApplyGroupDayMove, useTargets } from '../../data/queries';
import { canMoveRoutineWeekly, canMoveWeekly, planDayMove, planGroupDayMove, type DayScope } from '../../domain/moves';
import { targetDays } from '../../domain/schedule';
import { formatDayShort, formatDays, isoWeekday, weekdayLong, weekdayShort } from '../../domain/time';
import type { Block, ISODate, Routine, Target } from '../../domain/types';

export interface PendingDayMove {
  block: Block;
  /** The habit, or null when a whole routine card moves (see group). */
  target: Target | null;
  toDate: ISODate;
  group?: { routine: Routine; members: Block[] };
}

/**
 * After you drag a target's block to another day: just this week, or change the target's days.
 * One-off and finished blocks never get here: they just move.
 */
export function DayMoveSheet({
  pending,
  weekBlocks,
  onDone,
}: {
  pending: PendingDayMove | null;
  /** Every block in the week shown, to keep each day's slot unique. */
  weekBlocks: Block[];
  onDone: () => void;
}) {
  const move = useApplyDayMove();
  if (pending?.group) return <GroupDayMoveSheet pending={pending} group={pending.group} weekBlocks={weekBlocks} onDone={onDone} />;
  if (!pending?.target) return null;
  const { block, target, toDate } = pending;
  const own = weekBlocks.filter((b) => b.targetId === target.id);
  const choose = (scope: DayScope) => {
    move.mutate(planDayMove(block, toDate, scope, target, own));
    onDone();
  };

  const from = weekdayLong(isoWeekday(block.scheduledFor ?? block.date));
  const to = weekdayLong(isoWeekday(toDate));
  const weekly = canMoveWeekly(block, toDate, target);
  const newDays = weekly ? planDayMove(block, toDate, 'weekly', target, own).target!.preferredDays : [];
  const already = targetDays(target).includes(isoWeekday(toDate));

  return (
    <Sheet open onClose={onDone} title={`Move to ${formatDayShort(toDate)}?`}>
      <p className="-mt-1 mb-3 text-body-sm text-muted">
        {target.name}, {formatDayShort(block.date)} · {formatDays(targetDays(target), target.frequencyPerWeek)}
      </p>
      <div className="flex flex-col gap-2">
        <ScopeOption icon="event" title="Only this week" detail={`Next week it is back on ${from}`} onClick={() => choose('once')} />
        <ScopeOption
          icon="repeat"
          title="Every week from now on"
          detail={
            weekly
              ? `${target.name} moves from ${from} to ${to}: ${newDays.map(weekdayShort).join(', ')}`
              : already
                ? `${target.name} is already on ${to}s`
                : `Change the days in the habit instead`
          }
          disabled={!weekly}
          onClick={() => choose('weekly')}
        />
        <button type="button" onClick={onDone} className="mt-1 rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-label-sm text-faint">Blocks moved by hand stay put when you Re-run.</p>
    </Sheet>
  );
}

/** A routine card dragged to another day: just this week, or change the routine's days. */
function GroupDayMoveSheet({
  pending,
  group,
  weekBlocks,
  onDone,
}: {
  pending: PendingDayMove;
  group: NonNullable<PendingDayMove['group']>;
  weekBlocks: Block[];
  onDone: () => void;
}) {
  const move = useApplyGroupDayMove();
  const { data: targets = [] } = useTargets();
  const { routine, members } = group;
  const { block, toDate } = pending;
  const ids = new Set(members.map((b) => b.targetId));
  const own = weekBlocks.filter((b) => ids.has(b.targetId));
  const choose = (scope: DayScope) => {
    move.mutate(planGroupDayMove(members, toDate, scope, targets, routine, own));
    onDone();
  };
  const from = weekdayLong(isoWeekday(members[0]!.scheduledFor ?? block.date));
  const to = weekdayLong(isoWeekday(toDate));
  const weekly = canMoveRoutineWeekly(members, toDate, routine);
  const newDays = weekly ? planGroupDayMove(members, toDate, 'weekly', targets, routine, own).routine!.preferredDays : [];

  return (
    <Sheet open onClose={onDone} title={`Move to ${formatDayShort(toDate)}?`}>
      <p className="-mt-1 mb-3 text-body-sm text-muted">
        {routine.name} ({members.length} habits), {formatDayShort(block.date)} · {formatDays(targetDays(routine), routine.frequencyPerWeek)}
      </p>
      <div className="flex flex-col gap-2">
        <ScopeOption icon="event" title="Only this week" detail={`Next week it is back on ${from}`} onClick={() => choose('once')} />
        <ScopeOption
          icon="repeat"
          title="Every week from now on"
          detail={weekly ? `${routine.name} moves from ${from} to ${to}: ${newDays.map(weekdayShort).join(', ')}` : `${routine.name} is already on ${to}s`}
          disabled={!weekly}
          onClick={() => choose('weekly')}
        />
        <button type="button" onClick={onDone} className="mt-1 rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-label-sm text-faint">Every habit in the routine moves together.</p>
    </Sheet>
  );
}
