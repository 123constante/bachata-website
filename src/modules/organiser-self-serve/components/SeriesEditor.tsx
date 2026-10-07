import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, ExternalLink, Info, Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
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
import { UNSAVED_MESSAGE, confirmCopy, leaveGuardEnabled, publicEventPath } from '../editorGuards';
import {
  LIFECYCLE_NOTE,
  basicsFormFromSeries,
  dateLabel,
  formToDraft,
  instagramUrlOk,
  isCancelledDate,
  isRuleDate,
  keepsOwnChanges,
  lifecycleActions,
  localAsZTime,
  newPassRow,
  passRowsProblem,
  removedUpcoming,
  scheduleSummary,
  scopeNote,
  upcomingDates,
  type BasicsForm,
  type LifecycleAction,
  type PassRow,
  type SeriesWorkspace,
  type WorkspaceDate,
} from '../seriesModel';
import { ConfirmPanel } from './ConfirmPanel';
import { DateActionSheet } from './DateActionSheet';
import { FlyerUpload } from './FlyerUpload';
import { ReviewStrip } from './ReviewStrip';
import { useOwnerCommand } from './useOwnerCommand';
import { VenuePicker } from './VenuePicker';

/**
 * The organiser's series page (Lever 2 W4, mockup 04-A): scope is chosen by
 * WHERE you are. The basics form edits every future date ("Save for every
 * date") and says which dates keep their own changes; one date is changed
 * from its row in the date list, through the 03-A action sheet (W5).
 */

/** Same values, ignoring only the spaces the server trims (a cleared field still counts). */
const trimmed = (f: BasicsForm) => JSON.stringify(f, (_k, v: unknown) => (typeof v === 'string' ? v.trim() : v));
const sameForm = (a: BasicsForm, b: BasicsForm) => trimmed(a) === trimmed(b);

/**
 * There is no ticketing system yet, so organisers do not set prices, and
 * Instagram belongs on the organiser's own profile. Hidden, not deleted: values
 * already saved are untouched and an untouched field is never sent. Flip to
 * true to show both again.
 */
const SHOW_PRICE_AND_EVENT_INSTAGRAM = false;

/** The price list (admin D8): a name and a price per row, up to 10; [] clears it. */
function PricesField({ rows, onChange }: { rows: PassRow[] | null; onChange: (rows: PassRow[]) => void }) {
  if (rows === null) {
    return (
      <p className="text-[11px] text-muted-foreground" data-testid="prices-team">
        The Bachata Calendar team set your prices. Ask them if you need a change.
      </p>
    );
  }
  const update = (i: number, patch: Partial<PassRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-1" data-testid="prices-field">
      {rows.length === 0 && <p className="text-[11px] text-muted-foreground">No prices added yet.</p>}
      {rows.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2" data-testid="price-row">
          <Input
            aria-label={`Price ${i + 1} name`}
            placeholder="Entry"
            value={row.name}
            maxLength={120}
            onChange={(e) => update(i, { name: e.target.value })}
            className="h-9 text-sm flex-1 min-w-0"
          />
          <Input
            aria-label={`Price ${i + 1} amount`}
            placeholder={`Price (${row.currency ?? 'GBP'})`}
            inputMode="decimal"
            value={row.price}
            onChange={(e) => update(i, { price: e.target.value })}
            className="h-9 text-sm w-24"
          />
          <Button type="button" size="sm" variant="ghost" className="h-9 px-2" aria-label={`Remove price ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      {rows.length < 10 && (
        <Button type="button" size="sm" variant="outline" className="h-8" data-testid="price-add" onClick={() => onChange([...rows, { ...newPassRow(), currency: 'GBP' }])}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add a price
        </Button>
      )}
    </div>
  );
}

function BasicsSection({ workspace, onSaved, onDirtyChange }: { workspace: SeriesWorkspace; onSaved: (text: string) => void; onDirtyChange: (dirty: boolean) => void }) {
  const { series } = workspace;
  const initial = useMemo(() => basicsFormFromSeries(series), [series]);
  const [form, setForm] = useState<BasicsForm>(initial);
  const baseline = useRef<BasicsForm>(initial);
  // The same values as state: moving only the ref never re-rendered, so after a save
  // and reload the form still read "Not saved yet" and the leave warning stayed on.
  const [savedForm, setSavedForm] = useState<BasicsForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const command = useOwnerCommand(series.id);
  const bar = useRef<HTMLDivElement>(null);
  // A field focused under the sticky save bar is scrolled clear of it: the browser counts
  // it as on screen, so on its own it would stay hidden behind the bar.
  const clearOfBar = (e: FocusEvent<HTMLElement>) => {
    const field = e.target;
    const top = bar.current?.getBoundingClientRect().top;
    // Text fields always; buttons only on keyboard focus (a click scrolled mid-press can be lost).
    if (top === undefined || !field.matches('input, textarea, :focus-visible') || bar.current?.contains(field)) return;
    if (field.getBoundingClientRect().bottom > top) field.scrollIntoView({ block: 'center' });
  };

  // Fresh server values replace the form only when the organiser has not typed
  // over it; after a version_conflict their input stays and the next save
  // diffs against the reloaded values.
  useEffect(() => {
    setForm((current) => (sameForm(current, baseline.current) ? initial : current));
    baseline.current = initial;
    setSavedForm(initial);
  }, [initial]);

  const set = <K extends keyof BasicsForm>(key: K, value: BasicsForm[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const before = formToDraft(savedForm);
  // The picture is saved by FlyerUpload on its own; this form never sends it,
  // so a stale value here cannot undo a picture saved meanwhile.
  const draft = { ...formToDraft(form), coverImageUrl: before.coverImageUrl };
  const dirty = hasBasicsChanges(before, draft);
  const pricesProblem = SHOW_PRICE_AND_EVENT_INSTAGRAM ? passRowsProblem(form.passes) : null;
  const instagramOk = SHOW_PRICE_AND_EVENT_INSTAGRAM ? instagramUrlOk(form.instagramUrl ?? '') : true;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const valid = form.name.trim().length > 0 && /^\d{2}:\d{2}$/.test(form.startTime) && !pricesProblem && instagramOk;

  const save = async () => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: upsertCommand(basicsPayload(before, draft)) });
      setSavedForm(form);
      setSaved(true);
      onSaved('Saved for every future date. A date you changed on its own keeps its own changes.');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  return (
    <section className="rounded-md border border-border p-3 space-y-3" onFocus={clearOfBar} data-testid="series-basics" aria-labelledby="basics-heading">
      <h2 id="basics-heading" className="text-base font-semibold">Edit your event</h2>
      <div className="space-y-1">
        <Label htmlFor="series-name" className="text-xs">Name</Label>
        <Input id="series-name" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} className="h-9 text-[16px] md:text-[16px]" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="series-start" className="text-xs">Starts</Label>
          <Input id="series-start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="h-9 text-[16px] md:text-[16px]" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="series-end" className="text-xs">Ends</Label>
          <Input id="series-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="h-9 text-[16px] md:text-[16px]" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-venue" className="text-xs">Venue</Label>
        <VenuePicker id="series-venue" value={form.venueId} onChange={(id) => set('venueId', id)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-description" className="text-xs">About this event</Label>
        <Textarea id="series-description" value={form.description} rows={4} maxLength={4000} onChange={(e) => set('description', e.target.value)} className="text-[16px]" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="series-ticket" className="text-xs">Where to book (link)</Label>
        <Input id="series-ticket" type="url" inputMode="url" placeholder="https://" value={form.ticketUrl} onChange={(e) => set('ticketUrl', e.target.value)} className="h-9 text-[16px] md:text-[16px]" />
      </div>
      {SHOW_PRICE_AND_EVENT_INSTAGRAM && (
        <>
          <div className="space-y-1">
            <Label htmlFor="series-instagram" className="text-xs">Instagram link</Label>
            <Input id="series-instagram" type="url" inputMode="url" placeholder="https://www.instagram.com/" value={form.instagramUrl ?? ''} onChange={(e) => set('instagramUrl', e.target.value)} className="h-9 text-sm" />
            {!instagramOk && <p className="text-[11px] text-destructive" data-testid="instagram-hint">Use an instagram.com link, like https://www.instagram.com/yourname.</p>}
          </div>
          <fieldset className="space-y-1">
            <legend className="text-xs font-medium mb-1">Prices</legend>
            <PricesField rows={form.passes ?? null} onChange={(rows) => set('passes', rows)} />
            {pricesProblem && <p className="text-[11px] text-destructive" data-testid="prices-hint">{pricesProblem}</p>}
          </fieldset>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">
        The team looks after prices, Instagram and the class programme for now.
      </p>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="basics-error">{error}</p>}
      {/* Fields above are text-[16px], not text-base: the root size is fluid (13.5px on a
          phone), so text-base is under 16px and iOS zooms in on focus. md:text-[16px] overrides the
          Input primitive's md:text-sm, which a phone in landscape (768px+) would otherwise get. */}
      {/* Stays in view above the bottom menu while the form is long (mobile first). */}
      <div
        ref={bar}
        className="[fieldset:disabled_&]:hidden sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-10 -mx-3 -mb-3 flex flex-wrap items-center justify-end gap-2 rounded-b-md border-t border-border bg-background/95 px-3 py-2 backdrop-blur"
        data-testid="basics-bar"
      >
        {dirty && <span className="mr-auto text-xs text-muted-foreground" data-testid="basics-unsaved">Not saved yet</span>}
        {!dirty && saved && (
          <span className="mr-auto inline-flex items-center gap-1 text-xs text-primary" data-testid="basics-saved">
            <Check className="w-3 h-3" aria-hidden="true" /> Saved
          </span>
        )}
        <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" disabled={!dirty || command.isPending} onClick={() => { setForm(savedForm); setError(null); }} data-testid="basics-discard">
          Undo changes
        </Button>
        <Button type="button" size="sm" className="min-h-[44px]" disabled={!dirty || !valid || command.isPending} onClick={() => void save()} data-testid="basics-save">
          {command.isPending ? <><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Saving&hellip;</> : 'Save for every date'}
        </Button>
      </div>
    </section>
  );
}

function DateRow({ date, today, onOpen }: { date: WorkspaceDate; today: string; onOpen: (() => void) | null }) {
  const cancelled = isCancelledDate(date);
  const time = localAsZTime(date.materialised_start_utc);
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm" data-testid="series-date-row" data-date={date.occurrence_date}>
      <span className={cn('w-24 shrink-0 font-medium', date.occurrence_date === today && 'text-primary')}>{dateLabel(date.occurrence_date, today)}</span>
      {cancelled ? (
        <span className="text-destructive text-xs font-medium" data-testid="row-cancelled">Cancelled</span>
      ) : (
        <span className="text-muted-foreground text-xs" data-testid="row-time">{time ?? 'Time to be confirmed'}</span>
      )}
      {!cancelled && keepsOwnChanges(date) && (
        <span className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Own changes</span>
      )}
      {onOpen && (
        <Button type="button" size="sm" variant="outline" className="ml-auto min-h-[44px]" onClick={onOpen} aria-label={`Change ${dateLabel(date.occurrence_date, today)}`} data-testid="date-open">
          Change
        </Button>
      )}
    </li>
  );
}

const PAGE = 10;

/** "Pause or archive", "Resume or archive", "Archive": only what this event offers. */
const headingFor = (actions: LifecycleAction[]) => {
  const text = actions.map((a) => a.label.toLowerCase()).join(' or ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function DatesSection({ workspace, today, onSaved, readOnly }: { workspace: SeriesWorkspace; today: string; onSaved: (text: string) => void; readOnly: boolean }) {
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
          {upcoming.length} coming up{!readOnly && <> &middot; tap Change to edit just one date</>}
        </p>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-3" data-testid="dates-empty">
          {readOnly ? 'No dates coming up.' : 'No dates coming up. Add one below.'}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border px-3" aria-label="Upcoming dates">
          {shown.map((d) => (
            <DateRow key={d.id} date={d} today={today} onOpen={readOnly ? null : () => { setSheetDate(d); setSheetOpen(true); }} />
          ))}
        </ul>
      )}
      {upcoming.length > PAGE && (
        <button type="button" className="text-xs text-primary tap-link" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${upcoming.length} dates`}
        </button>
      )}

      {!readOnly && <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newDate) return;
          void runSeries(addDateCommand(newDate), `${dateLabel(newDate, today)} has been added.`).then((ok) => ok && setNewDate(''));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="add-date" className="text-xs">Add a date</Label>
          <Input id="add-date" type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-11 text-[16px] md:text-[16px] w-44 max-w-full" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={!newDate || newDate < today || taken.has(newDate) || command.isPending} data-testid="add-date-submit">
          <CalendarPlus className="w-4 h-4" aria-hidden="true" /> Add date
        </Button>
        {newDate && taken.has(newDate) && <p className="text-xs text-muted-foreground w-full">That date is already on the list.</p>}
      </form>}

      {removed.length > 0 && (
        <div className="space-y-1" data-testid="dates-removed">
          <p className="text-xs font-medium">Dates taken off</p>
          <ul className="space-y-1">
            {removed.map((date) => (
              <li key={date} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">{dateLabel(date, today)}</span>
                {!readOnly && <button
                  type="button"
                  className="text-xs text-primary tap-link"
                  disabled={command.isPending}
                  aria-label={`Put back ${dateLabel(date, today)}`}
                  data-testid="date-put-back"
                  onClick={() => void runSeries(
                    isRuleDate(date, series) ? unskipDateCommand(date) : addDateCommand(date),
                    `${dateLabel(date, today)} is back on.`,
                  )}
                >
                  Put back
                </button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-destructive" role="alert" data-testid="dates-error">{error}</p>}

      {liveSheetDate && !readOnly && (
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

function StatusSection({ workspace, onSaved }: { workspace: SeriesWorkspace; onSaved: (text: string) => void }) {
  const { series } = workspace;
  const actions = lifecycleActions(series.lifecycle_status);
  const [confirming, setConfirming] = useState<LifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const command = useOwnerCommand(series.id);
  const box = useRef<HTMLElement>(null);
  // The button pressed unmounts when the panel opens, so focus is moved, never dropped on the page.
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    const target = confirming ? '[data-testid="confirm-keep"]' : returnTo.current && `[data-testid="lifecycle-${returnTo.current}"]`;
    if (target) box.current?.querySelector<HTMLElement>(target)?.focus();
  }, [confirming]);
  const keep = () => { returnTo.current = confirming?.to ?? null; setConfirming(null); };

  const apply = async (action: LifecycleAction) => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: lifecycleCommand(action.to) });
      returnTo.current = null;
      setConfirming(null);
      onSaved(action.to === 'paused' ? 'Paused. Dancers cannot see your event until you resume it.' : action.to === 'live' ? 'Your event is live again, with all its dates.' : 'Archived. It is off Bachata Calendar.');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  if (actions.length === 0) return null;
  return (
    <section ref={box} className="rounded-md border border-border p-3 space-y-2" data-testid="series-status" aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-base font-semibold">{headingFor(actions)}</h2>
      <p className="text-xs text-muted-foreground">{LIFECYCLE_NOTE[series.lifecycle_status] ?? ''}</p>
      {confirming ? (
        <ConfirmPanel
          testId="archive-confirm"
          copy={confirmCopy(confirming.to === 'paused' ? 'pause_series' : 'archive_series', { subject: series.name })}
          busy={command.isPending}
          onKeep={keep}
          onConfirm={() => void apply(confirming)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.to}
              type="button"
              size="sm"
              variant={a.confirm ? 'outline' : 'secondary'}
              className="min-h-[44px]"
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
  const [focusConfirmation, setFocusConfirmation] = useState(0);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [flyerDirty, setFlyerDirty] = useState(false);
  // An archived event is off Bachata Calendar and only the team brings it back, so its
  // details are shown but not editable here.
  const archived = series.lifecycle_status === 'archived';
  const live = series.lifecycle_status === 'live';
  const announceStatus = useCallback((text: string) => {
    setConfirmation(text);
    setFocusConfirmation((n) => n + 1);
  }, []);
  useEffect(() => {
    if (focusConfirmation) confirmationRef.current?.focus();
  }, [focusConfirmation]);
  // Leaving with edits not saved (a link, Back, closing the tab, a picture not saved) asks first.
  useUnsavedChangesGuard({ enabled: leaveGuardEnabled({ dirty: (dirty || flyerDirty) && !archived }), message: UNSAVED_MESSAGE });
  const upcoming = useMemo(() => upcomingDates(workspace.dates, today), [workspace.dates, today]);
  const scope = scopeNote(upcoming, today);

  return (
    <div className="space-y-4" data-testid="series-editor">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight" data-testid="series-title">{series.name}</h1>
          <p className="text-xs text-muted-foreground">{scheduleSummary(series)}</p>
        </div>
        <Badge variant={live ? 'default' : 'secondary'} className="text-[11px] shrink-0" data-testid="series-lifecycle">
          {LIFECYCLE_LABEL[series.lifecycle_status] ?? series.lifecycle_status}
        </Badge>
      </header>

      {confirmation && (
        <div ref={confirmationRef} tabIndex={-1} className="text-sm text-primary space-y-1 scroll-mt-24 focus:outline-none" role="status" data-testid="series-confirmation">
          <p className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {confirmation}
          </p>
          {/* The public page exists only while the event is live. */}
          {live && (
            <Link to={publicEventPath(series)} className="tap-link gap-1 font-medium underline" data-testid="view-on-site">
              View on the site <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* W6 (05-A): where the series is in review, the admin's message when it was
          returned, "Send for review", and "View as a dancer" once it is public. */}
      <ReviewStrip series={series} onSaved={announceStatus} />

      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs flex items-start gap-2" data-testid={archived ? 'archived-note' : 'scope-note'}>
        <Info className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{archived ? 'An archived event cannot be changed here.' : scope.text}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* disabled: every field and button in the form is switched off at once (native fieldset). */}
        <fieldset disabled={archived} className="min-w-0 space-y-4" data-testid="series-edit-area">
          {/* key: archiving starts the form afresh from the server, so typing not saved is not shown as if it were. */}
          <FlyerUpload
            key={archived ? 'archived' : 'editable'}
            series={series}
            nextDate={upcoming[0]?.occurrence_date ?? null}
            meta={scheduleSummary(series)}
            onSaved={setConfirmation}
            onDirtyChange={setFlyerDirty}
          />
          <BasicsSection key={archived ? 'archived' : 'editable'} workspace={workspace} onSaved={setConfirmation} onDirtyChange={setDirty} />
        </fieldset>
        <div className="space-y-4">
          <DatesSection workspace={workspace} today={today} onSaved={setConfirmation} readOnly={archived} />
          <StatusSection workspace={workspace} onSaved={announceStatus} />
        </div>
      </div>
    </div>
  );
}
