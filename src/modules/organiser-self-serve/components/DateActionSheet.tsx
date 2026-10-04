import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CalendarX2, Check, ChevronLeft, Clock, ExternalLink, Image as ImageIcon, Loader2, MapPin, PenLine, RotateCcw, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  dateDetailQueryKey,
  fetchCancellationReasons,
  fetchDateDetail,
} from '../selfServeApi';
import {
  cancelCommand,
  overrideCommand,
  removeDateCommand,
  resetTimeCommand,
  setTimeCommand,
  skipDateCommand,
  uncancelCommand,
  type OverridePatch,
  type OwnerCommand,
} from '../seriesCommands';
import { commandErrorMessage } from '../selfServeErrors';
import {
  dateLabel,
  durationMinutes,
  endTime,
  isRuleDate,
  setTimeDoneCopy,
  type WorkspaceDate,
  type WorkspaceSeries,
} from '../seriesModel';
import { useOwnerCommand } from './useOwnerCommand';
import { VenuePicker } from './VenuePicker';
import { usePublicVenues, venueName } from './publicVenues';

/**
 * Change one date (Lever 2 W5, mockup 03-A): an action sheet of named
 * exceptions on ONE date. "Change the time" and "Change the venue" open
 * 03-C's field layout inside the sheet. Every action saves explicitly through
 * occurrence_command_p5 (or series_command_p5 for a break or a removal); the
 * series is never edited from here.
 */

type View = 'menu' | 'cancel' | 'time' | 'venue' | 'note' | 'media' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  series: WorkspaceSeries;
  date: WorkspaceDate;
  hasSessions: boolean;
  today: string;
}

const cancellationReasonsQueryKey = ['cancellation-reasons'] as const;

function MenuItem({ icon, title, hint, onClick, disabled, testId, tone }: {
  icon: ReactNode; title: string; hint?: string | null; onClick: () => void; disabled?: boolean; testId: string; tone?: 'danger';
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        className={cn(
          'w-full text-left flex items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40 disabled:opacity-60 disabled:hover:bg-transparent',
          tone === 'danger' && 'border-destructive/40',
        )}
      >
        <span className={cn('mt-0.5 shrink-0 text-muted-foreground', tone === 'danger' && 'text-destructive')} aria-hidden="true">{icon}</span>
        <span className="min-w-0">
          <span className={cn('block text-sm font-medium', tone === 'danger' && 'text-destructive')}>{title}</span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
      </button>
    </li>
  );
}

export function DateActionSheet({ open, onOpenChange, seriesId, series, date, hasSessions, today }: Props) {
  const [view, setView] = useState<View>('menu');
  const [error, setError] = useState<string | null>(null);
  const [doneText, setDoneText] = useState<{ title: string; body: string; undo?: OwnerCommand } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [picture, setPicture] = useState('');
  const [ticket, setTicket] = useState('');
  const command = useOwnerCommand(seriesId);
  const venues = usePublicVenues();

  const detail = useQuery({
    queryKey: dateDetailQueryKey(date.id),
    queryFn: () => fetchDateDetail(date.id),
    enabled: open,
  });
  const reasons = useQuery({
    queryKey: cancellationReasonsQueryKey,
    queryFn: fetchCancellationReasons,
    enabled: open,
    staleTime: 60 * 60 * 1000,
  });

  // A fresh sheet for each opening: the menu, no stale error.
  useEffect(() => {
    if (open) {
      setView('menu');
      setError(null);
      setDoneText(null);
      setReason(null);
    }
  }, [open, date.id]);

  const d = detail.data;
  const label = dateLabel(date.occurrence_date, today);
  const usualStart = series.default_local_start_time?.slice(0, 5) ?? null;
  const usualEnd = endTime(usualStart, durationMinutes(series.default_duration));
  const usualTime = usualStart ? (usualEnd ? `${usualStart}–${usualEnd}` : usualStart) : null;
  const seriesVenue = venueName(venues.data, series.default_venue_id);
  const cancelled = d ? d.cancelled : date.lifecycle_status === 'cancelled';
  // A series with no programme times: the server keeps this date's own time in a
  // date-time session it creates (admin D8), so every date can move.
  // "Usual time" also shows once such a date has its own time (its added session).
  const hasOwnTime = date.session_overrides_count > 0 || (!hasSessions && date.added_sessions_count > 0);
  const ruleDate = isRuleDate(date.occurrence_date, series);
  const live = series.lifecycle_status === 'live';

  const open3C = (next: View) => {
    setError(null);
    if (next === 'time') {
      setStart(d?.start ?? usualStart ?? '');
      setEnd(d?.end ?? usualEnd ?? '');
    }
    if (next === 'venue') setVenueId(d?.venueOverride ?? d?.venueId ?? series.default_venue_id);
    if (next === 'note') setNote(d?.descriptionOverride ?? '');
    if (next === 'media') {
      setPicture(d?.coverImageOverride ?? '');
      setTicket(d?.ticketUrlOverride ?? '');
    }
    setView(next);
  };

  type Done = { title: string; body: string; undo?: OwnerCommand };
  const run = async (cmd: OwnerCommand, done: Done | ((response: unknown) => Done)) => {
    setError(null);
    try {
      const target = cmd.kind.startsWith('series.') ? seriesId : date.id;
      const version = cmd.kind.startsWith('series.') ? series.version : d?.version ?? date.version;
      const response = await command.mutateAsync({ targetId: target, version, command: cmd });
      setDoneText(typeof done === 'function' ? done(response) : done);
      setView('done');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  /**
   * An ad-hoc date (not one the weekly rule makes) is removed the way the
   * admin editor removes it: the first series.remove_date cancels a scheduled
   * date, the second deletes it and records the date as removed.
   */
  const removeDate = async () => {
    setError(null);
    try {
      let version: number | null = series.version;
      if (!cancelled) {
        const first = await command.mutateAsync({ targetId: seriesId, version, command: removeDateCommand(date.id) });
        version = typeof first?.new_version === 'number' ? first.new_version : null;
      }
      await command.mutateAsync({ targetId: seriesId, version, command: removeDateCommand(date.id) });
      setDoneText({ title: `${label} is removed.`, body: 'It no longer shows on Bachata Calendar. You can put it back from "Dates taken off".' });
      setView('done');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  const saveOverride = (patch: OverridePatch, title: string) =>
    run(overrideCommand(patch), { title, body: `Only ${label} changes. Every other date stays as the series.` });

  const busy = command.isPending;
  const back = (
    <Button type="button" size="sm" variant="ghost" onClick={() => { setError(null); setView('menu'); }} disabled={busy}>
      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
    </Button>
  );
  const saveButton = (text: string, onClick: () => void, disabled = false, testId = 'date-save') => (
    <Button type="button" size="sm" onClick={onClick} disabled={busy || disabled} data-testid={testId}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {text}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Above the fixed BottomNav (also z-50), which would otherwise cover the sheet's buttons.
        overlayClassName="z-[90]"
        className="z-[90] max-h-[92vh] overflow-y-auto rounded-t-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:mx-auto sm:left-0 sm:right-0"
        data-testid="date-sheet"
      >
        <div className="space-y-1 pr-8">
          <SheetTitle className="text-base">{label}</SheetTitle>
          <SheetDescription className="text-xs">{series.name} &middot; this date only</SheetDescription>
        </div>

        <div className="mt-4 space-y-3">
          {detail.isLoading && view !== 'done' ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading this date…</p>
          ) : detail.isError && view !== 'done' ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm">We couldn&rsquo;t load this date.</p>
              <Button size="sm" variant="outline" onClick={() => void detail.refetch()}>Try again</Button>
            </div>
          ) : view === 'menu' ? (
            <>
              {cancelled && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm" data-testid="date-cancelled-banner">
                  Cancelled{d?.cancellationReason ? ` · ${d.cancellationReason}` : ''}. Dancers see this.
                </p>
              )}
              <ul className="space-y-2">
                {cancelled ? (
                  <MenuItem
                    icon={<RotateCcw className="w-4 h-4" />}
                    title="Un-cancel this date"
                    hint="It goes back on as usual."
                    testId="action-uncancel"
                    onClick={() => void run(uncancelCommand(), { title: `${label} is back on.`, body: 'Dancers no longer see a cancellation.' })}
                    disabled={busy}
                  />
                ) : (
                  <MenuItem icon={<Ban className="w-4 h-4" />} title="Cancel this date" hint='Dancers see "Cancelled" and your reason. You can un-cancel.' testId="action-cancel" onClick={() => open3C('cancel')} tone="danger" />
                )}
                {!cancelled && (
                  <MenuItem
                    icon={<Clock className="w-4 h-4" />}
                    title="Change the time"
                    hint={usualTime ? `Usually ${usualTime}` : null}
                    testId="action-time"
                    onClick={() => open3C('time')}
                  />
                )}
                {!cancelled && (
                  <MenuItem icon={<MapPin className="w-4 h-4" />} title="Change the venue" hint={seriesVenue ? `Usually ${seriesVenue}` : null} testId="action-venue" onClick={() => open3C('venue')} />
                )}
                <MenuItem icon={<PenLine className="w-4 h-4" />} title="Add a note for this date" hint={d?.descriptionOverride ? `Now: "${d.descriptionOverride.slice(0, 60)}"` : '"Cover teacher", "bring cash", "Halloween theme"'} testId="action-note" onClick={() => open3C('note')} />
                <MenuItem icon={<ImageIcon className="w-4 h-4" />} title="Picture or ticket link for this date" hint="A special guest, a festival promo" testId="action-media" onClick={() => open3C('media')} />
                {!cancelled && ruleDate ? (
                  <MenuItem
                    icon={<CalendarX2 className="w-4 h-4" />}
                    title="Skip this week"
                    hint="A break: the date comes off the calendar without a cancellation notice."
                    testId="action-skip"
                    onClick={() => void run(skipDateCommand(date.id), { title: `${label} is a break.`, body: 'It no longer shows on Bachata Calendar. You can put it back from "Dates taken off".' })}
                    disabled={busy}
                  />
                ) : (
                  <MenuItem
                    icon={<Trash2 className="w-4 h-4" />}
                    title={cancelled ? 'Remove it from the list' : 'Remove this date'}
                    hint={cancelled ? 'Dancers stop seeing the cancelled date.' : 'For a date added by mistake.'}
                    testId="action-remove"
                    onClick={() => void removeDate()}
                    disabled={busy}
                  />
                )}
              </ul>
              <p className="text-xs text-muted-foreground">A change here affects {label} only. To change every date, edit the series.</p>
            </>
          ) : view === 'cancel' ? (
            <div className="space-y-3" data-testid="cancel-panel">
              <div>
                <p className="text-sm font-semibold">Cancel {label}</p>
                <p className="text-xs text-muted-foreground">Only this date. The other dates keep running.</p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium mb-1">Why? Dancers see this.</legend>
                <div className="flex flex-wrap gap-2">
                  {(reasons.data ?? []).map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      role="radio"
                      aria-checked={reason === r.label}
                      onClick={() => setReason(r.label)}
                      data-testid="cancel-reason"
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm',
                        reason === r.label ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {reasons.isLoading && <p className="text-xs text-muted-foreground">Loading reasons…</p>}
              </fieldset>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={() => setView('menu')} disabled={busy}>Keep it on</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!reason || busy}
                  data-testid="cancel-confirm"
                  onClick={() => reason && void run(cancelCommand(reason), {
                    title: `${label} is cancelled.`,
                    body: `Dancers see "Cancelled · ${reason}" on the event page.`,
                    undo: uncancelCommand(),
                  })}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Cancel this date
                </Button>
              </div>
            </div>
          ) : view === 'time' ? (
            <div className="space-y-3" data-testid="time-panel">
              <p className="text-xs text-muted-foreground">
                {hasSessions ? `Every session on ${label} moves with the start time.` : `Only ${label} changes.`} Other dates stay {usualTime ?? 'as the series'}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="date-start" className="text-xs">Starts</Label>
                  <Input id="date-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 text-sm" required />
                  {usualStart && <p className="text-[11px] text-muted-foreground">Series: {usualStart}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date-end" className="text-xs">Ends</Label>
                  <Input id="date-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 text-sm" />
                  {usualEnd && <p className="text-[11px] text-muted-foreground">Series: {usualEnd}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                <div className="flex gap-2">
                  {hasOwnTime && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="time-reset"
                      onClick={() => void run(resetTimeCommand(), { title: `${label} is back to the usual time.`, body: usualTime ? `Starts ${usualStart} as the series.` : 'It follows the series again.' })}>
                      Usual time
                    </Button>
                  )}
                  {saveButton('Save the time', () => void run(setTimeCommand(start, end || null), (response) => setTimeDoneCopy(label, start, response)),
                    !/^\d{2}:\d{2}$/.test(start))}
                </div>
              </div>
            </div>
          ) : view === 'venue' ? (
            <div className="space-y-3" data-testid="venue-panel">
              <VenuePicker id="date-venue" value={venueId} onChange={setVenueId} />
              {seriesVenue && <p className="text-[11px] text-muted-foreground">Series: {seriesVenue}</p>}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                <div className="flex gap-2">
                  {d?.venueOverride && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveOverride({ venue_id: null }, `${label} is back at the series venue.`)}>
                      Series venue
                    </Button>
                  )}
                  {saveButton('Save the venue', () => venueId && void saveOverride({ venue_id: venueId }, `${label} moves to ${venueName(venues.data, venueId) ?? 'the new venue'}.`),
                    !venueId || venueId === (d?.venueOverride ?? d?.venueId ?? series.default_venue_id))}
                </div>
              </div>
            </div>
          ) : view === 'note' ? (
            <div className="space-y-3" data-testid="note-panel">
              <div className="space-y-1">
                <Label htmlFor="date-note" className="text-xs">Note for {label}</Label>
                <Textarea id="date-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={4000} className="text-sm" />
                <p className="text-[11px] text-muted-foreground">Dancers see it on this date in place of the usual description.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                <div className="flex gap-2">
                  {d?.descriptionOverride && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveOverride({ description: null }, `The note on ${label} is gone.`)}>
                      Remove note
                    </Button>
                  )}
                  {saveButton('Save the note', () => void saveOverride({ description: note }, `${label} has your note.`), !note.trim() || note.trim() === (d?.descriptionOverride ?? ''))}
                </div>
              </div>
            </div>
          ) : view === 'media' ? (
            <div className="space-y-3" data-testid="media-panel">
              <div className="space-y-1">
                <Label htmlFor="date-picture" className="text-xs">Picture link for {label}</Label>
                <Input id="date-picture" type="url" inputMode="url" value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://" className="h-9 text-sm" />
                <p className="text-[11px] text-muted-foreground">{d?.coverImageOverride ? 'Leave empty to use the series picture again.' : 'Empty uses the series picture.'}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="date-ticket" className="text-xs">Ticket or booking link for {label}</Label>
                <Input id="date-ticket" type="url" inputMode="url" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="https://" className="h-9 text-sm" />
                <p className="text-[11px] text-muted-foreground">{d?.ticketUrlOverride ? 'Leave empty to use the series link again.' : 'Empty uses the series link.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                {saveButton('Save', () => {
                  const patch: OverridePatch = {};
                  if (picture.trim() !== (d?.coverImageOverride ?? '')) patch.cover_image_url = picture;
                  if (ticket.trim() !== (d?.ticketUrlOverride ?? '')) patch.ticket_url = ticket;
                  void saveOverride(patch, `${label} has its own ${patch.cover_image_url !== undefined && patch.ticket_url !== undefined ? 'picture and link' : patch.cover_image_url !== undefined ? 'picture' : 'ticket link'}.`);
                }, picture.trim() === (d?.coverImageOverride ?? '') && ticket.trim() === (d?.ticketUrlOverride ?? ''))}
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="date-done" role="status">
              <p className="text-sm font-semibold flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" /> {doneText?.title}
              </p>
              <p className="text-xs text-muted-foreground">{doneText?.body}</p>
              <div className="flex flex-wrap items-center gap-3 justify-end">
                {live && (
                  <Link to={`/event/${series.slug ?? series.id}`} className="text-xs text-primary inline-flex items-center gap-1 mr-auto">
                    View as a dancer <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Link>
                )}
                {doneText?.undo && (
                  <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="date-undo"
                    onClick={() => doneText.undo && void run(doneText.undo, { title: `${label} is back on.`, body: 'Dancers no longer see a cancellation.' })}>
                    Undo
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => onOpenChange(false)} data-testid="date-close">Done</Button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert" data-testid="date-error">{error}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
