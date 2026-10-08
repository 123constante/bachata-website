import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CalendarX2, Check, ChevronLeft, Clock, ExternalLink, Image as ImageIcon, ListChecks, Loader2, MapPin, PenLine, RotateCcw, Trash2 } from 'lucide-react';
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
} from '@/modules/organiser/shared/selfServeApi';
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
} from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { UNSAVED_MESSAGE, confirmCopy, publicEventPath } from '@/modules/organiser/shared/editorGuards';
import {
  dateLabel,
  durationMinutes,
  endTime,
  isRuleDate,
  setTimeDoneCopy,
  timeSpanWarning,
  type WorkspaceDate,
  type WorkspaceSeries,
} from '@/modules/organiser/shared/seriesModel';
import { ConfirmPanel } from './ConfirmPanel';
import { ProgrammeEditor } from './ProgrammeEditor';
import { useOwnerCommand } from '@/modules/organiser/shared/useOwnerCommand';
import { VenuePicker } from './VenuePicker';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';

/**
 * Change one date (Lever 2 W5, mockup 03-A): an action sheet of named
 * exceptions on ONE date. "Change the time" and "Change the venue" open
 * 03-C's field layout inside the sheet. Every action saves explicitly through
 * occurrence_command_p5 (or series_command_p5 for a break or a removal); the
 * series is never edited from here.
 */

type View = 'menu' | 'cancel' | 'cancel_confirm' | 'remove_confirm' | 'time' | 'venue' | 'note' | 'media' | 'programme' | 'done';

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
  const [longConfirmed, setLongConfirmed] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [picture, setPicture] = useState('');
  const [ticket, setTicket] = useState('');
  const [programmeDirty, setProgrammeDirty] = useState(false);
  // Focus: the sheet title on opening, the new step's first control on each step, the
  // menu item you came from on Back, the message on a failed save, and on closing the
  // control that opened the sheet (it has no Radix trigger, so nothing else returns it).
  const titleRef = useRef<HTMLHeadingElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const returnTo = useRef<string | null>(null);
  const focusedView = useRef<View>(view);
  const command = useOwnerCommand(seriesId);
  const venues = useVenueOptions();

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
      setProgrammeDirty(false);
      returnTo.current = null;
    }
  }, [open, date.id]);

  // Runs before Radix moves the focus into the sheet, so it still sees the opener.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) openerRef.current = document.activeElement;
  }, [open]);
  useEffect(() => {
    const root = viewRef.current;
    // Only a step change moves the focus (not reopening the sheet on the step it closed on).
    if (!open || !root || focusedView.current === view) return;
    focusedView.current = view;
    if (view === 'programme') return; // the programme editor moves its own focus
    if (view === 'menu') {
      if (returnTo.current) root.querySelector<HTMLElement>(`[data-testid="${returnTo.current}"]`)?.focus();
      returnTo.current = null;
      return;
    }
    root.querySelector<HTMLElement>('[data-step-focus], [data-testid="confirm-ack"], [data-testid="confirm-keep"]')?.focus();
  }, [open, view]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  // Undo stays on the done step, so a new result has to take the focus itself.
  useEffect(() => { if (doneText) viewRef.current?.querySelector<HTMLElement>('[data-step-focus]')?.focus(); }, [doneText]);

  // Closing the sheet with programme edits not saved asks first, like leaving the page does.
  const requestOpenChange = (next: boolean) => {
    if (!next && view === 'programme' && programmeDirty && !window.confirm(UNSAVED_MESSAGE)) return;
    onOpenChange(next);
  };
  const leaveProgramme = () => {
    setProgrammeDirty(false);
    returnTo.current = 'action-programme';
    setView('menu');
  };
  // Every step opened from the menu hands the focus back to its menu item on Back.
  const openStep = (next: View, from: string) => {
    returnTo.current = from;
    setError(null);
    setView(next);
  };

  const d = detail.data;
  const label = dateLabel(date.occurrence_date, today);
  const usualStart = series.default_local_start_time?.slice(0, 5) ?? null;
  const usualEnd = endTime(usualStart, durationMinutes(series.default_duration));
  const usualTime = usualStart ? (usualEnd ? `${usualStart}\u2013${usualEnd}` : usualStart) : null;
  const seriesVenue = venueName(venues.data, series.default_venue_id);
  const cancelled = d ? d.cancelled : date.lifecycle_status === 'cancelled';
  // A series with no programme times: the server keeps this date's own time in a
  // date-time session it creates (admin D8), so every date can move.
  // "Usual time" also shows once such a date has its own time (its added session).
  const hasOwnTime = date.session_overrides_count > 0 || (!hasSessions && date.added_sessions_count > 0);
  const ruleDate = isRuleDate(date.occurrence_date, series);
  const live = series.lifecycle_status === 'live';

  const open3C = (next: View) => {
    returnTo.current = `action-${next}`;
    setError(null);
    if (next === 'time') {
      setLongConfirmed(false);
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
    run(overrideCommand(patch), { title, body: `Only ${label} changes. Every other date stays as usual.` });

  const busy = command.isPending;
  const spanWarning = timeSpanWarning(start, end);
  const back = (
    <Button type="button" size="sm" variant="ghost" onClick={() => { setError(null); setView('menu'); }} disabled={busy} data-testid="date-back">
      <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
    </Button>
  );
  const stepHeading = (text: string) => (
    <h3 tabIndex={-1} data-step-focus className="text-sm font-semibold outline-none">{text}</h3>
  );
  const reasonList = reasons.data ?? [];
  // One tab stop for the reasons; the arrow keys move between them, as in any radio group.
  const reasonKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step || reasonList.length === 0) return;
    e.preventDefault();
    const at = reasonList.findIndex((r) => r.label === reason);
    const next = (at + step + reasonList.length) % reasonList.length;
    setReason(reasonList[next].label);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  const saveButton = (text: string, onClick: () => void, disabled = false, testId = 'date-save') => (
    <Button type="button" size="sm" onClick={onClick} disabled={busy || disabled} data-testid={testId}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {text}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      <SheetContent
        side="bottom"
        // Above the fixed BottomNav (also z-50), which would otherwise cover the sheet's buttons.
        overlayClassName="z-[90] motion-reduce:!animate-none"
        // The shared close button (last child) is 16px wide: give it a 44px target here only. No slide with reduced motion.
        className="tap-44 z-[90] max-h-[92vh] overflow-y-auto rounded-t-xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:mx-auto sm:left-0 sm:right-0 motion-reduce:!animate-none [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:min-w-[44px] [&>button:last-child]:items-center [&>button:last-child]:justify-center"
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
        onCloseAutoFocus={(e) => { if (openerRef.current?.isConnected) { e.preventDefault(); openerRef.current.focus(); } }}
        data-testid="date-sheet"
      >
        <div className="space-y-1 pr-10">
          <SheetTitle ref={titleRef} tabIndex={-1} className="text-base outline-none">{label}</SheetTitle>
          <SheetDescription className="text-xs">{series.name} &middot; this date only</SheetDescription>
        </div>

        <div ref={viewRef} className="mt-4 space-y-3">
          {detail.isLoading && view !== 'done' ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2" role="status"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading this date&hellip;</p>
          ) : detail.isError && view !== 'done' ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm">We couldn&rsquo;t load this date.</p>
              <Button size="sm" variant="outline" onClick={() => void detail.refetch()}>Try again</Button>
            </div>
          ) : view === 'menu' ? (
            <>
              {cancelled && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm" data-testid="date-cancelled-banner">
                  Cancelled{d?.cancellationReason ? ` \u00b7 ${d.cancellationReason}` : ''}. Dancers see this.
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
                  <MenuItem icon={<Ban className="w-4 h-4" />} title="Cancel this date" hint='Dancers see "Cancelled" and your reason. You can undo it.' testId="action-cancel" onClick={() => open3C('cancel')} tone="danger" />
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
                <MenuItem
                  icon={<ListChecks className="w-4 h-4" />}
                  title="Change the programme"
                  hint="Sessions, times and levels for this date"
                  testId="action-programme"
                  onClick={() => openStep('programme', 'action-programme')}
                />
                <MenuItem icon={<PenLine className="w-4 h-4" />} title="Add a note for this date" hint={d?.descriptionOverride ? `Now: "${d.descriptionOverride.slice(0, 60)}"` : '"Cover teacher", "bring cash", "Halloween theme"'} testId="action-note" onClick={() => open3C('note')} />
                <MenuItem icon={<ImageIcon className="w-4 h-4" />} title="Picture or booking link for this date" hint="A special guest, a festival promo" testId="action-media" onClick={() => open3C('media')} />
                {!cancelled && ruleDate ? (
                  <MenuItem
                    icon={<CalendarX2 className="w-4 h-4" />}
                    title="Skip this week"
                    hint="Takes this date off the calendar for a break. Dancers do not see a cancellation."
                    testId="action-skip"
                    onClick={() => void run(skipDateCommand(date.id), { title: `${label} is a break.`, body: 'It no longer shows on Bachata Calendar. You can put it back from "Dates taken off".' })}
                    disabled={busy}
                  />
                ) : (
                  <MenuItem
                    icon={<Trash2 className="w-4 h-4" />}
                    title={cancelled ? 'Remove it from the list' : 'Remove this date'}
                    hint={cancelled ? 'Dancers stop seeing the cancelled date.' : 'For a date you added by mistake.'}
                    testId="action-remove"
                    onClick={() => openStep('remove_confirm', 'action-remove')}
                    disabled={busy}
                    tone="danger"
                  />
                )}
              </ul>
              <p className="text-xs text-muted-foreground">A change here affects {label} only. To change every date, close this and use &ldquo;Edit your event&rdquo; on the page.</p>
            </>
          ) : view === 'programme' ? (
            <ProgrammeEditor
              occurrenceId={date.id}
              seriesId={seriesId}
              dateLabel={label}
              live={live}
              publicPath={publicEventPath(series)}
              onBack={leaveProgramme}
              onClose={() => { setProgrammeDirty(false); onOpenChange(false); }}
              onDirtyChange={setProgrammeDirty}
            />
          ) : view === 'cancel' ? (
            <div className="space-y-3" data-testid="cancel-panel">
              <div>
                {stepHeading(`Cancel ${label}`)}
                <p className="text-xs text-muted-foreground">Only this date. Your other dates carry on.</p>
              </div>
              <div className="space-y-2">
                <p id="cancel-reason-label" className="text-xs font-medium">Why? Dancers see this.</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="cancel-reason-label" onKeyDown={reasonKeys}>
                  {reasonList.map((r, i) => (
                    <button
                      key={r.key}
                      type="button"
                      role="radio"
                      aria-checked={reason === r.label}
                      tabIndex={reason === r.label || (!reason && i === 0) ? 0 : -1}
                      onClick={() => setReason(r.label)}
                      data-testid="cancel-reason"
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        reason === r.label ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {reasons.isLoading && <p className="text-xs text-muted-foreground" role="status">Loading reasons&hellip;</p>}
                {reasons.isError && (
                  <div className="space-y-2" role="alert" data-testid="cancel-reasons-error">
                    <p className="text-sm">We couldn&rsquo;t load the reasons, so the date can&rsquo;t be cancelled yet. Check your connection and try again.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void reasons.refetch()} disabled={reasons.isFetching}>
                      {reasons.isFetching && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Try again
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {back}
                {/* Nothing is sent from here: Next opens the explicit confirm step. */}
                <Button type="button" size="sm" disabled={!reason || busy} data-testid="cancel-next" onClick={() => { setError(null); setView('cancel_confirm'); }}>
                  Next
                </Button>
              </div>
            </div>
          ) : view === 'cancel_confirm' && reason ? (
            <ConfirmPanel
              testId="cancel-confirm-panel"
              copy={confirmCopy('cancel_date', { subject: label, reason })}
              busy={busy}
              onKeep={() => { setError(null); returnTo.current = null; setView('cancel'); }}
              onConfirm={() => void run(cancelCommand(reason), {
                title: `${label} is cancelled.`,
                body: `Dancers see "Cancelled \u00b7 ${reason}" on the event page.`,
                undo: uncancelCommand(),
              })}
            />
          ) : view === 'remove_confirm' ? (
            <ConfirmPanel
              testId="remove-confirm-panel"
              copy={confirmCopy('remove_date', { subject: label, alreadyCancelled: cancelled })}
              busy={busy}
              onKeep={() => { setError(null); setView('menu'); }}
              onConfirm={() => void removeDate()}
            />
          ) : view === 'time' ? (
            <div className="space-y-3" data-testid="time-panel">
              {stepHeading('Change the time')}
              <p className="text-xs text-muted-foreground">
                {hasSessions ? `Every session on ${label} moves with the start time.` : `Only ${label} changes.`} Other dates stay {usualTime ?? 'as usual'}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="date-start" className="text-xs">Starts</Label>
                  <Input id="date-start" type="time" value={start} onChange={(e) => { setStart(e.target.value); setLongConfirmed(false); }} className="h-11 text-[16px] md:text-[16px]" required />
                  {usualStart && <p className="text-[11px] text-muted-foreground">Usual: {usualStart}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date-end" className="text-xs">Ends</Label>
                  <Input id="date-end" type="time" value={end} onChange={(e) => { setEnd(e.target.value); setLongConfirmed(false); }} className="h-11 text-[16px] md:text-[16px]" />
                  {usualEnd && <p className="text-[11px] text-muted-foreground">Usual: {usualEnd}</p>}
                </div>
              </div>
              {spanWarning && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 space-y-2 text-xs" role="alert" data-testid="time-span-warning">
                  <p>
                    That is {spanWarning.duration} long, ending {spanWarning.endsNextDay ? 'the next day ' : ''}at {end}. Did you mean a different end time?
                  </p>
                  <label className="flex items-start gap-2 min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={longConfirmed}
                      onChange={(e) => setLongConfirmed(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0"
                      data-testid="time-span-confirm"
                    />
                    <span>Yes, it really runs that long.</span>
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                <div className="flex gap-2">
                  {hasOwnTime && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="time-reset"
                      onClick={() => void run(resetTimeCommand(), { title: `${label} is back to the usual time.`, body: usualTime ? `Starts ${usualStart} as usual.` : 'It follows the usual time again.' })}>
                      Use the usual time
                    </Button>
                  )}
                  {saveButton('Save the time', () => void run(setTimeCommand(start, end || null), (response) => setTimeDoneCopy(label, start, response)),
                    !/^\d{2}:\d{2}$/.test(start) || (!!spanWarning && !longConfirmed))}
                </div>
              </div>
            </div>
          ) : view === 'venue' ? (
            <div className="space-y-3" data-testid="venue-panel">
              {stepHeading('Change the venue')}
              <VenuePicker id="date-venue" value={venueId} onChange={setVenueId} />
              {seriesVenue && <p className="text-[11px] text-muted-foreground">Usual: {seriesVenue}</p>}
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                <div className="flex gap-2">
                  {d?.venueOverride && (
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveOverride({ venue_id: null }, `${label} is back at the usual venue.`)}>
                      Use the usual venue
                    </Button>
                  )}
                  {saveButton('Save the venue', () => venueId && void saveOverride({ venue_id: venueId }, `${label} moves to ${venueName(venues.data, venueId) ?? 'the new venue'}.`),
                    !venueId || venueId === (d?.venueOverride ?? d?.venueId ?? series.default_venue_id))}
                </div>
              </div>
            </div>
          ) : view === 'note' ? (
            <div className="space-y-3" data-testid="note-panel">
              {stepHeading('Add a note for this date')}
              <div className="space-y-1">
                <Label htmlFor="date-note" className="text-xs">Note for {label}</Label>
                <Textarea id="date-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={4000} className="text-[16px] md:text-[16px]" />
                <p className="text-[11px] text-muted-foreground">Dancers see this on this date instead of the usual description.</p>
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
              {stepHeading('Picture or booking link for this date')}
              {d?.coverImageOverride && (
                <p className="rounded-md border border-border bg-muted/30 p-2 text-xs" data-testid="date-own-picture">
                  {label} shows its own picture. A new picture for the event does not replace it.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="date-picture" className="text-xs">Picture link for {label}</Label>
                <Input id="date-picture" type="url" inputMode="url" value={picture} onChange={(e) => setPicture(e.target.value)} placeholder="https://" className="h-11 text-[16px] md:text-[16px]" />
                <p className="text-[11px] text-muted-foreground">{d?.coverImageOverride ? 'Leave empty to use the event\'s usual picture again.' : 'Empty uses the event\'s usual picture.'}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="date-ticket" className="text-xs">Booking link for {label}</Label>
                <Input id="date-ticket" type="url" inputMode="url" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="https://" className="h-11 text-[16px] md:text-[16px]" />
                <p className="text-[11px] text-muted-foreground">{d?.ticketUrlOverride ? 'Leave empty to use the event\'s usual link again.' : 'Empty uses the event\'s usual link.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {back}
                {saveButton('Save the links', () => {
                  const patch: OverridePatch = {};
                  if (picture.trim() !== (d?.coverImageOverride ?? '')) patch.cover_image_url = picture;
                  if (ticket.trim() !== (d?.ticketUrlOverride ?? '')) patch.ticket_url = ticket;
                  void saveOverride(patch, `${label} has its own ${patch.cover_image_url !== undefined && patch.ticket_url !== undefined ? 'picture and booking link' : patch.cover_image_url !== undefined ? 'picture' : 'booking link'}.`);
                }, picture.trim() === (d?.coverImageOverride ?? '') && ticket.trim() === (d?.ticketUrlOverride ?? ''))}
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="date-done" role="status">
              <p tabIndex={-1} data-step-focus className="text-sm font-semibold flex items-start gap-2 outline-none">
                <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" /> {doneText?.title}
              </p>
              <p className="text-xs text-muted-foreground">{doneText?.body}</p>
              <div className="flex flex-wrap items-center gap-3 justify-end">
                {live && (
                  <Link to={publicEventPath(series)} className="text-xs text-primary tap-link gap-1 mr-auto" data-testid="date-view-on-site">
                    View on the site <ExternalLink className="w-3 h-3" aria-hidden="true" />
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
            <p ref={errorRef} tabIndex={-1} className="text-sm text-destructive outline-none" role="alert" data-testid="date-error">{error}</p>
          )}
          {/* The spinner on the button is silent: say it in words for screen readers. */}
          <p className="sr-only" role="status" data-testid="date-saving">{busy ? 'Saving\u2026' : ''}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
