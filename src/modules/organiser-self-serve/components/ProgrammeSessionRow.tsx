import { useEffect, useRef } from 'react';
import { Moon, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  LEVEL_KEYS,
  LEVEL_LABEL,
  SESSION_TYPES,
  TYPE_LABEL,
  endsNextDay,
  type DraftSession,
  type RowProblem,
} from '../programmeModel';
import { LineupRow } from './LineupRow';

/**
 * One session of a date's programme. The kind (class, Party, ...) is fixed on
 * a session that already exists (only the team can change it) and chosen on a
 * new one. Times are the browser's own time picker, which always hands back
 * 24h HH:MM whatever the phone shows. A removed session folds to one line with
 * "Put back" until the save.
 */
export function ProgrammeSessionRow({ row, problems, focusToken, live = false, failed = false, onChange, onRemove, onRestore }: {
  row: DraftSession;
  problems: RowProblem[];
  /** Changes each time the screen wants this row's name field focused (added, or first with a problem). */
  focusToken: string | null;
  /** The date is live: the line-up sheet repeats that a save shows at once. */
  live?: boolean;
  /** The last save was refused for this row: it shakes once. */
  failed?: boolean;
  onChange: (patch: Partial<DraftSession>) => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusToken && !row.removed) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new token moves the focus
  }, [focusToken]);
  // Remove and Put back swap the row's buttons; keep the focus on the row, not lost to the page.
  const wasRemoved = useRef(row.removed);
  useEffect(() => {
    if (wasRemoved.current === row.removed) return;
    wasRemoved.current = row.removed;
    if (row.removed) restoreRef.current?.focus();
    else titleRef.current?.focus();
  }, [row.removed]);

  const id = `prog-${row.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const problem = (field: RowProblem['field']) => problems.find((p) => p.field === field)?.message ?? null;
  const name = row.title.trim() || (row.original ? 'this session' : 'the new session');
  const typeLabel = row.type ? TYPE_LABEL[row.type] ?? row.type : 'Session';

  if (row.removed) {
    const wasOff = row.original?.removed === true;
    return (
      <li className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm" data-testid="programme-row-removed">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-muted-foreground line-through">{row.title || typeLabel}</span>
          <span className="block text-xs text-muted-foreground">{wasOff ? 'Not on this date.' : 'Removed. Not saved yet.'}</span>
        </span>
        <Button ref={restoreRef} type="button" size="sm" variant="outline" className="min-h-[44px]" onClick={onRestore} data-testid="programme-restore">
          <RotateCcw className="w-4 h-4" aria-hidden="true" /> Put back<span className="sr-only"> {name}</span>
        </Button>
      </li>
    );
  }

  const titleProblem = problem('title');
  const timesProblem = problem('times');
  const typeProblem = problem('type');
  const levelsProblem = problem('levels');
  // The hint only for an end truly before the start: equal times are an error, not an overnight.
  const overnight = endsNextDay(row.start || null, row.end || null) && row.start !== row.end;
  // A stored session may have no times; a new one must have them, which Save says when it is tried.
  const noTimes = !!row.original && !row.start && !row.end && !timesProblem;
  // Shared by every field: red edge when the field has a problem, 16px text on every width (no iOS/iPad zoom).
  const field = 'min-h-[44px] text-[16px] md:text-[16px] aria-[invalid=true]:border-destructive';

  return (
    <li
      className={cn(
        'space-y-2 rounded-md border p-3',
        problems.length > 0 || failed ? 'border-destructive' : 'border-border',
        failed && 'animate-[shake_0.3s_ease-in-out] motion-reduce:animate-none',
      )}
      data-testid="programme-row"
      data-failed={failed ? 'true' : undefined}
    >
      <div className="flex items-center gap-2">
        {row.original ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium" data-testid="programme-type">{typeLabel}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Label htmlFor={`${id}-type`} className="text-sm">Kind</Label>
            <select
              id={`${id}-type`}
              value={row.type ?? ''}
              onChange={(e) => onChange({ type: e.target.value })}
              className={cn('rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background', field)}
              aria-invalid={!!typeProblem}
              aria-describedby={typeProblem ? `${id}-type-error` : undefined}
              data-testid="programme-type-select"
            >
              {SESSION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
        )}
        <Button type="button" size="sm" variant="ghost" className="ms-auto min-h-[44px] text-destructive" onClick={onRemove} data-testid="programme-remove">
          <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove<span className="sr-only"> {name}</span>
        </Button>
      </div>
      {typeProblem && <p id={`${id}-type-error`} className="text-sm text-destructive" data-testid="programme-row-error">{typeProblem}</p>}

      <div className="space-y-1">
        <Label htmlFor={`${id}-title`} className="text-sm">Name</Label>
        <Input
          ref={titleRef}
          id={`${id}-title`}
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={row.type === 'party' ? 'For example, Bachata Party' : 'For example, Beginners Bachata'}
          className={field}
          aria-invalid={!!titleProblem}
          aria-describedby={titleProblem ? `${id}-title-error` : undefined}
          data-testid="programme-title"
        />
        {titleProblem && <p id={`${id}-title-error`} className="text-sm text-destructive" data-testid="programme-row-error">{titleProblem}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-start`} className="text-sm">Starts</Label>
          <Input
            id={`${id}-start`}
            type="time"
            value={row.start}
            onChange={(e) => onChange({ start: e.target.value.slice(0, 5) })}
            className={field}
            aria-invalid={!!timesProblem}
            aria-describedby={timesProblem ? `${id}-times-error` : noTimes ? `${id}-no-times` : undefined}
            data-testid="programme-start"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-end`} className="text-sm">Ends</Label>
          <Input
            id={`${id}-end`}
            type="time"
            value={row.end}
            onChange={(e) => onChange({ end: e.target.value.slice(0, 5) })}
            className={field}
            aria-invalid={!!timesProblem}
            aria-describedby={[timesProblem ? `${id}-times-error` : '', overnight ? `${id}-overnight` : '', noTimes ? `${id}-no-times` : ''].filter(Boolean).join(' ') || undefined}
            data-testid="programme-end"
          />
        </div>
      </div>
      {overnight && (
        <p id={`${id}-overnight`} className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="programme-overnight">
          <Moon className="w-4 h-4" aria-hidden="true" /> Finishes after midnight
        </p>
      )}
      {noTimes && (
        <p id={`${id}-no-times`} className="text-sm text-muted-foreground" data-testid="programme-no-times">No times set for this session.</p>
      )}
      {timesProblem && <p id={`${id}-times-error`} className="text-sm text-destructive" data-testid="programme-row-error">{timesProblem}</p>}

      <fieldset className="space-y-1" aria-describedby={levelsProblem ? `${id}-levels-error` : undefined}>
        <legend className="text-sm font-medium">Level</legend>
        <div className="flex flex-wrap gap-2">
          {LEVEL_KEYS.map((level) => {
            const on = row.levels.includes(level);
            return (
              <button
                key={level}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ levels: on ? row.levels.filter((l) => l !== level) : [...row.levels, level] })}
                className={cn(
                  'min-h-[44px] rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                  on ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                )}
                data-testid={`programme-level-${level}`}
              >
                {LEVEL_LABEL[level]}
              </button>
            );
          })}
        </div>
        {levelsProblem && <p id={`${id}-levels-error`} className="text-sm text-destructive" data-testid="programme-row-error">{levelsProblem}</p>}
      </fieldset>

      <LineupRow
        row={row}
        sessionName={row.title.trim() || typeLabel}
        live={live}
        problem={problem('people')}
        onChange={(people) => onChange({ people })}
      />
    </li>
  );
}
