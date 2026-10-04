import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, ExternalLink, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { LIFECYCLE_LABEL } from '../selfServeApi';
import {
  addDateCommand,
  basicsPayload,
  hasBasicsChanges,
  lifecycleCommand,
  unskipDateCommand,
  upsertCommand,
} from '../seriesCommands';
import { commandErrorMessage } from '../selfServeErrors';
import {
  LEVEL_OPTIONS,
  basicsFormFromSeries,
  dateLabel,
  formToDraft,
  isCancelledDate,
  isRuleDate,
  keepsOwnChanges,
  lifecycleActions,
  localAsZTime,
  removedUpcoming,
  scheduleSummary,
  scopeNote,
  upcomingDates,
  type BasicsForm,
  type LifecycleAction,
  type SeriesWorkspace,
  type WorkspaceDate,
} from '../seriesModel';
import { DateActionSheet } from './DateActionSheet';
import { useOwnerCommand } from './useOwnerCommand';
import { VenuePicker } from './VenuePicker';

/**
 * The organiser's series page (Lever 2 W4, mockup 04-A): scope is chosen by
 * WHERE you are. The basics form edits every future date ("Save for every
 * date") and says which dates keep their own changes; one date is changed
 * from its row in the date list, through the 03-A action sheet (W5).
 */

const sameForm = (a: BasicsForm, b: BasicsForm) => JSON.stringify(a) === JSON.stringify(b);

function BasicsSection({ workspace, onSaved }: { workspace: SeriesWorkspace; onSaved: (text: string) => void }) {
  const { series } = workspace;
  const initial = useMemo(() => basicsFormFromSeries(series), [series]);
  const [form, setForm] = useState<BasicsForm>(initial);
  const baseline = useRef<BasicsForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const command = useOwnerCommand(series.id);

  // Fresh server values replace the form only when the organiser has not typed
  // over it; after a version_conflict their input stays and the next save
  // diffs against the reloaded values.
  useEffect(() => {
    setForm((current) => (sameForm(current, baseline.current) ? initial : current));
    baseline.current = initial;
  }, [initial]);

  const set = <K extends keyof BasicsForm>(key: K, value: BasicsForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const draft = formToDraft(form);
  const before = formToDraft(baseline.current);
  const dirty = hasBasicsChanges(before, draft);
  const valid = form.name.trim().length > 0 && /^\d{2}:\d{2}$/.test(form.startTime);

  const save = async () => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: upsertCommand(basicsPayload(before, draft)) });
      onSaved('Saved for every future date. Dates with their own changes keep them.');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  return (
    <section className="rounded-md border border-border p-3 space-y-3" data-testid="series-basics" aria-labelledby="basics-heading">
      <h2 id="basics-heading" className="text-base font-semibold">Edit the series</h2>
      <div className="space-y-1">
        <Label htmlFor="series-name" className="text-xs">Name</Label>
        <Input id="series-name" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} className="h-9 text-sm" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="series-start" className="text-xs">Starts</Label>
          <Input id="series-start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="h-9 text-sm" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="series-end" className="text-xs">Ends</Label>
          <Input id="series-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-venue" className="text-xs">Venue</Label>
        <VenuePicker id="series-venue" value={form.venueId} onChange={(id) => set('venueId', id)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-level" className="text-xs">Level</Label>
        <select
          id="series-level"
          value={form.level}
          onChange={(e) => set('level', e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Not set</option>
          {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {form.level && !LEVEL_OPTIONS.some((o) => o.value === form.level) && <option value={form.level}>{form.level}</option>}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-description" className="text-xs">Description</Label>
        <Textarea id="series-description" value={form.description} rows={4} maxLength={4000} onChange={(e) => set('description', e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-ticket" className="text-xs">Ticket or booking link</Label>
        <Input id="series-ticket" type="url" inputMode="url" placeholder="https://" value={form.ticketUrl} onChange={(e) => set('ticketUrl', e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-cover" className="text-xs">Cover picture link</Label>
        <Input id="series-cover" type="url" inputMode="url" placeholder="https://" value={form.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} className="h-9 text-sm" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Price, Instagram and the class programme are set by the Bachata Calendar team for now.
      </p>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="basics-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={!dirty || command.isPending} onClick={() => { setForm(baseline.current); setError(null); }}>
          Discard
        </Button>
        <Button type="button" size="sm" disabled={!dirty || !valid || command.isPending} onClick={() => void save()} data-testid="basics-save">
          {command.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save for every date
        </Button>
      </div>
    </section>
  );
}

function DateRow({ date, today, onOpen }: { date: WorkspaceDate; today: string; onOpen: () => void }) {
  const cancelled = isCancelledDate(date);
  const time = localAsZTime(date.materialised_start_utc);
  return (
    <li className="flex items-center gap-2 py-2 text-sm" data-testid="series-date-row" data-date={date.occurrence_date}>
      <span className={cn('w-24 shrink-0 font-medium', date.occurrence_date === today && 'text-primary')}>{dateLabel(date.occurrence_date, today)}</span>
      {cancelled ? (
        <span className="text-destructive text-xs font-medium" data-testid="row-cancelled">Cancelled</span>
      ) : (
        <span className="text-muted-foreground text-xs" data-testid="row-time">{time ?? 'Time to be confirmed'}</span>
      )}
      {!cancelled && keepsOwnChanges(date) && (
        <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Own changes</span>
      )}
      <Button type="button" size="sm" variant="outline" className="ml-auto h-8" onClick={onOpen} data-testid="date-open">
        Change
      </Button>
    </li>
  );
}

const PAGE = 10;

function DatesSection({ workspace, today, onSaved }: { workspace: SeriesWorkspace; today: string; onSaved: (text: string) => void }) {
  const { series } = workspace;
  const upcoming = useMemo(() => upcomingDates(workspace.dates, today), [workspace.dates, today]);
  const removed = useMemo(() => removedUpcoming(series, today), [series, today]);
  const [showAll, setShowAll] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<WorkspaceDate | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const command = useOwnerCommand(series.id);
  const shown = showAll ? upcoming : upcoming.slice(0, PAGE);
  const liveSheetDate = sheetDate ? workspace.dates.find((d) => d.id === sheetDate.id) ?? sheetDate : null;
  const taken = new Set(upcoming.map((d) => d.occurrence_date));

  const runSeries = async (cmd: Parameters<typeof command.mutateAsync>[0]['command'], text: string) => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: cmd });
      onSaved(text);
      return true;
    } catch (err) {
      setError(commandErrorMessage(err));
      return false;
    }
  };

  return (
    <section className="space-y-3" data-testid="series-dates" aria-labelledby="dates-heading">
      <div>
        <h2 id="dates-heading" className="text-base font-semibold">Dates</h2>
        <p className="text-xs text-muted-foreground">
          {upcoming.length} upcoming &middot; to change one date, open it from the list
        </p>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-3" data-testid="dates-empty">
          No upcoming dates. Add one below.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border px-3" aria-label="Upcoming dates">
          {shown.map((d) => (
            <DateRow key={d.id} date={d} today={today} onOpen={() => { setSheetDate(d); setSheetOpen(true); }} />
          ))}
        </ul>
      )}
      {upcoming.length > PAGE && (
        <button type="button" className="text-xs text-primary" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${upcoming.length} dates`}
        </button>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newDate) return;
          void runSeries(addDateCommand(newDate), `${dateLabel(newDate, today)} is added.`).then((ok) => ok && setNewDate(''));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="add-date" className="text-xs">Add a date</Label>
          <Input id="add-date" type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-9 text-sm w-44" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={!newDate || newDate < today || taken.has(newDate) || command.isPending} data-testid="add-date-submit">
          <CalendarPlus className="w-4 h-4" aria-hidden="true" /> Add
        </Button>
        {newDate && taken.has(newDate) && <p className="text-xs text-muted-foreground w-full">That date is already on the list.</p>}
      </form>

      {removed.length > 0 && (
        <div className="space-y-1" data-testid="dates-removed">
          <p className="text-xs font-medium">Dates taken off</p>
          <ul className="space-y-1">
            {removed.map((date) => (
              <li key={date} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">{dateLabel(date, today)}</span>
                <button
                  type="button"
                  className="text-xs text-primary"
                  disabled={command.isPending}
                  data-testid="date-put-back"
                  onClick={() => void runSeries(
                    isRuleDate(date, series) ? unskipDateCommand(date) : addDateCommand(date),
                    `${dateLabel(date, today)} is back on.`,
                  )}
                >
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-destructive" role="alert" data-testid="dates-error">{error}</p>}

      {liveSheetDate && (
        <DateActionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          seriesId={series.id}
          series={series}
          date={liveSheetDate}
          hasSessions={workspace.hasSessions}
          today={today}
        />
      )}
    </section>
  );
}

const LIFECYCLE_NOTE: Record<string, string> = {
  live: 'Pausing keeps the page but lists no dates. Archiving hides it; the team can restore it.',
  paused: 'Paused: the page stays up but lists no dates. Resume to list them again.',
  draft: 'Not public yet. Archiving removes this draft from your list.',
};

function StatusSection({ workspace, onSaved }: { workspace: SeriesWorkspace; onSaved: (text: string) => void }) {
  const { series } = workspace;
  const actions = lifecycleActions(series.lifecycle_status);
  const [confirming, setConfirming] = useState<LifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const command = useOwnerCommand(series.id);

  const apply = async (action: LifecycleAction) => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: lifecycleCommand(action.to) });
      setConfirming(null);
      onSaved(action.to === 'paused' ? 'Paused. Dancers no longer see its dates.' : action.to === 'live' ? 'Live again. Its dates are listed.' : 'Archived.');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  if (actions.length === 0) return null;
  return (
    <section className="rounded-md border border-border p-3 space-y-2" data-testid="series-status" aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-base font-semibold">Status</h2>
      <p className="text-xs text-muted-foreground">{LIFECYCLE_NOTE[series.lifecycle_status] ?? ''}</p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="archive-confirm">
          <p className="text-sm w-full">Archive {series.name}? It disappears from Bachata Calendar.</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={command.isPending}>Keep it</Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => void apply(confirming)} disabled={command.isPending}>
            {command.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Archive
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.to}
              type="button"
              size="sm"
              variant={a.confirm ? 'outline' : 'secondary'}
              disabled={command.isPending}
              data-testid={`lifecycle-${a.to}`}
              onClick={() => (a.confirm ? setConfirming(a) : void apply(a))}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive" role="alert" data-testid="status-error">{error}</p>}
    </section>
  );
}

export function SeriesEditor({ workspace, today }: { workspace: SeriesWorkspace; today: string }) {
  const { series } = workspace;
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const upcoming = useMemo(() => upcomingDates(workspace.dates, today), [workspace.dates, today]);
  const scope = scopeNote(upcoming, today);
  const live = series.lifecycle_status === 'live';

  return (
    <div className="space-y-4" data-testid="series-editor">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight" data-testid="series-title">{series.name}</h1>
          <p className="text-xs text-muted-foreground">{scheduleSummary(series)}</p>
          {live && (
            <Link to={`/event/${series.slug ?? series.id}`} className="text-xs text-primary inline-flex items-center gap-1 mt-1" data-testid="series-view-as-dancer">
              View as a dancer <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          )}
        </div>
        <Badge variant={live ? 'default' : 'secondary'} className="text-[11px] shrink-0" data-testid="series-lifecycle">
          {LIFECYCLE_LABEL[series.lifecycle_status] ?? series.lifecycle_status}
        </Badge>
      </header>

      {confirmation && (
        <p className="text-sm text-primary flex items-start gap-2" role="status" data-testid="series-confirmation">
          <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {confirmation}
        </p>
      )}

      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs flex items-start gap-2" data-testid="scope-note">
        <Info className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{scope.text}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <BasicsSection workspace={workspace} onSaved={setConfirmation} />
        </div>
        <div className="space-y-4">
          <DatesSection workspace={workspace} today={today} onSaved={setConfirmation} />
          <StatusSection workspace={workspace} onSaved={setConfirmation} />
        </div>
      </div>
    </div>
  );
}
