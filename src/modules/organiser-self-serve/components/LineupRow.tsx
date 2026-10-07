import { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lineupSummary, type DraftPerson, type DraftSession } from '../programmeModel';
import { LineupSheet, RoleChip } from './LineupSheet';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** The summary row's frame: label left, value right and muted, chevron; 48px tall; a 3:1 edge. */
const ROW = 'flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-muted-foreground/60 bg-card px-3 text-left text-sm';

/**
 * The "Line-up" summary row inside a session: who teaches or DJs it, and the
 * way into the line-up sheet. The sheet edits the draft; the programme's own
 * Save sends it. A line-up problem found on Save shakes the row once and says
 * why under it.
 */
export function LineupRow({ row, sessionName, live, problem, onChange }: {
  row: DraftSession;
  sessionName: string;
  live: boolean;
  /** The row's line-up problem from validateProgramme, once Save has been tried. */
  problem: string | null;
  onChange: (people: DraftPerson[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const reduced = usePrefersReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = lineupSummary(row.people);
  const pending = (row.people ?? []).some((p) => p.removed || p.origin === 'added');
  const errorId = `lineup-error-${row.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  // A new problem shakes the row once (never with reduced motion): noticed while rendering, not in an effect.
  const [seenProblem, setSeenProblem] = useState(problem);
  if (problem !== seenProblem) {
    setSeenProblem(problem);
    if (problem && !reduced) setShaking(true);
  }

  return (
    <div className="space-y-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-describedby={problem ? errorId : undefined}
        onAnimationEnd={() => setShaking(false)}
        className={cn(
          ROW,
          'transition-colors duration-300 ease-in-out hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background motion-reduce:transition-none',
          problem && 'border-destructive',
          shaking && 'animate-[shake_0.3s_ease-in-out] motion-reduce:animate-none',
        )}
        data-testid="lineup-row"
        data-shake={shaking ? 'true' : undefined}
      >
        <span className="shrink-0 font-medium text-foreground">Line-up</span>
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground" data-testid="lineup-row-value">
          {summary ?? 'Add teachers & DJs'}
        </span>
        {pending && <span className="sr-only">, not saved yet</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {problem && <p id={errorId} className="text-sm text-destructive" data-testid="programme-row-error">{problem}</p>}
      <LineupSheet
        open={open}
        onOpenChange={setOpen}
        row={row}
        sessionName={sessionName}
        live={live}
        onChange={onChange}
        returnFocusRef={buttonRef}
      />
    </div>
  );
}

/**
 * The same row, read-only, for a date the organiser cannot change: every name
 * with its role chip, nothing to press. The line-up is visible wherever the
 * programme is.
 */
export function LineupReadonly({ people }: { people: DraftPerson[] }) {
  const live = people.filter((p) => !p.removed);
  return (
    <div className={cn(ROW, 'items-start py-2')} data-testid="lineup-readonly-row">
      <span className="shrink-0 py-0.5 font-medium text-foreground">Line-up</span>
      {live.length === 0 ? (
        <span className="min-w-0 flex-1 py-0.5 text-right text-muted-foreground">No teachers or DJs</span>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-wrap justify-end gap-x-3 gap-y-1" aria-label="Line-up">
          {live.map((p) => (
            <li key={`${p.id}:${p.role ?? ''}`} className="flex min-w-0 max-w-full items-center gap-1.5" data-testid="lineup-readonly-person">
              <span className="min-w-0 truncate text-muted-foreground">{p.name}</span>
              <RoleChip role={p.role} team />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
