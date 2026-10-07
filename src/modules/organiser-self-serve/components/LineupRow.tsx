import { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lineupSummary, type DraftPerson, type DraftSession } from '../programmeModel';
import { LineupSheet } from './LineupSheet';

/**
 * The "Line-up" summary row inside a session: who teaches or DJs it, and the
 * way into the line-up sheet. The sheet edits the draft; the programme's own
 * Save sends it.
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = lineupSummary(row.people);
  const pending = (row.people ?? []).some((p) => p.removed || p.origin === 'added');
  const errorId = `lineup-error-${row.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  return (
    <div className="space-y-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-describedby={problem ? errorId : undefined}
        className={cn(
          'flex min-h-[48px] w-full items-center gap-3 rounded-md border px-3 text-left text-sm transition-colors duration-300 ease-in-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
          problem ? 'border-destructive' : 'border-border',
        )}
        data-testid="lineup-row"
      >
        <span className="shrink-0 font-medium">Line-up</span>
        <span className={cn('min-w-0 flex-1 truncate text-right', !summary && 'text-muted-foreground')} data-testid="lineup-row-value">
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
