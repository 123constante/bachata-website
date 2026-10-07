import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { LIFECYCLE_LABEL, createSeriesCommand, type HomeOrganiser } from '../selfServeApi';
import { resolveCreateCityId } from '../createCity';
import { createPayload, newIdempotencyKey, newSeriesId, type OwnerCommand } from '../seriesCommands';
import { commandErrorMessage, isServerRefusal } from '../selfServeErrors';
import { UNSAVED_MESSAGE, leaveGuardEnabled } from '../editorGuards';
import {
  EVENT_KINDS,
  WEEKDAY_OPTIONS,
  createBlock,
  createDraft,
  createProblems,
  emptyCreateForm,
  followUpCommands,
  dateForWeekday,
  previewModel,
  submitHint,
  weekdayOf,
  type CreateForm,
} from '../createModel';
import { EventPreview } from './EventPreview';
import { useVenueOptions, venueName } from './publicVenues';
import { useOwnerCommand } from './useOwnerCommand';
import { VenuePicker } from './VenuePicker';

/**
 * The create screen (Lever 2 W3, mockup 02-A): party or weekly class, one form
 * with the public page previewed beside it (below it on a phone). "Save draft"
 * sends the create and the schedule; "Submit for review" adds the owner's
 * draft -> pending_review move. Every write is a P5 command envelope through
 * useOwnerCommand, the same path the series page uses.
 */

interface Props {
  organisers: HomeOrganiser[];
  /** From the home's "New event" button (?organiser=). */
  initialOrganiserId: string | null;
  /** London calendar date, YYYY-MM-DD. */
  today: string;
}

const pickInitial = (organisers: HomeOrganiser[], wanted: string | null) =>
  (organisers.find((o) => o.id === wanted) ?? organisers.find((o) => o.lifecycle_status === 'live') ?? organisers[0])?.id ?? '';

export function CreateEventForm({ organisers, initialOrganiserId, today }: Props) {
  const navigate = useNavigate();
  const [organiserId, setOrganiserId] = useState(() => pickInitial(organisers, initialOrganiserId));
  const [form, setForm] = useState<CreateForm>(emptyCreateForm);
  // The series id is chosen here: a series.upsert on an id with no row is a create.
  const [seriesId] = useState(newSeriesId);
  // ONE key for the create, kept across retries: if the create landed but its reply was
  // lost, the retry replays that success (command_idempotency_p5) instead of re-sending
  // create-only keys to a series that now exists. A refused create stores nothing, so the
  // same key runs fresh after the organiser fixes the form.
  const [createKey] = useState(newIdempotencyKey);
  const [running, setRunning] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The create landed but a later command did not: the draft exists, finish it from its page. */
  const [landed, setLanded] = useState(false);
  /**
   * The create failed WITHOUT a server answer, so it may have landed. The fields lock
   * until a retry settles it: that retry reuses the create key, and the server would
   * replay the ORIGINAL create, so an edit made in between would be silently dropped.
   */
  const [unsure, setUnsure] = useState(false);
  const command = useOwnerCommand(seriesId);
  const venues = useVenueOptions();
  // Synchronous: two clicks in one frame must not both start a create (state lags a render).
  const inFlight = useRef(false);
  // The follow-ups still to send once the create landed, each with ONE key kept across
  // retries (a lost reply replays instead of tripping version_conflict), and the version
  // the last landed command returned. The series page cannot set the weekly rule or
  // submit, so a refused follow-up is retried from here.
  const remaining = useRef<{ steps: Array<{ command: OwnerCommand; key: string }>; version: number | null; submit: boolean } | null>(null);

  const organiser = organisers.find((o) => o.id === organiserId) ?? organisers[0] ?? null;
  const block = organiser ? createBlock(organiser) : 'Set up your organiser first.';
  const problems = createProblems(form, today);
  const submitBlocked = createProblems(form, today, { forSubmit: true }).length > 0;
  const missing = submitHint(form, today);
  const preview = previewModel(form, venueName(venues.data, form.venueId), organiser?.name ?? '', today);
  const weekday = weekdayOf(form.date);
  const weekly = form.kind === 'weekly_class';
  const canSend = !!organiser && !block && problems.length === 0 && !running && !landed;
  // Anything typed counts as unsaved until the draft has landed (then the screen moves on by itself).
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyCreateForm());
  useUnsavedChangesGuard({ enabled: leaveGuardEnabled({ dirty, saving: !!running, finished: landed }), message: UNSAVED_MESSAGE });

  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const run = async (submit: boolean) => {
    if (!organiser || !canSend || (submit && submitBlocked) || inFlight.current) return;
    inFlight.current = true;
    try {
      await sendAll(organiser.id, submit);
    } finally {
      inFlight.current = false;
    }
  };

  const sendAll = async (orgId: string, submit: boolean) => {
    setError(null);
    setRunning(submit ? 'submit' : 'draft');
    let version: number | null = null;
    try {
      const venueCity = venues.data?.find((v) => v.id === form.venueId)?.city_name ?? null;
      const cityId = await resolveCreateCityId({ venueCityName: venueCity, organiserCityId: organiser?.city_id ?? null });
      const res = await command.mutateAsync({
        targetId: seriesId,
        version: null,
        idempotencyKey: createKey,
        command: createSeriesCommand(createPayload(createDraft(form), cityId), orgId),
      });
      version = typeof res.new_version === 'number' ? res.new_version : null;
      setUnsure(false);
    } catch (err) {
      const refused = isServerRefusal(err);
      setUnsure(!refused);
      setError(
        refused
          ? commandErrorMessage(err)
          : 'We could not confirm the save. Check your connection and press the same button again. Your details are still here.',
      );
      setRunning(null);
      return;
    }
    remaining.current = {
      steps: followUpCommands(form, submit).map((next) => ({ command: next, key: newIdempotencyKey() })),
      version,
      submit,
    };
    setLanded(true);
    await sendFollowUps();
  };

  const finish = async () => {
    if (!remaining.current || inFlight.current) return;
    inFlight.current = true;
    try {
      await sendFollowUps();
    } finally {
      inFlight.current = false;
    }
  };

  const sendFollowUps = async () => {
    const left = remaining.current;
    if (!left) return;
    setError(null);
    setRunning(left.submit ? 'submit' : 'draft');
    while (left.steps.length > 0) {
      const step = left.steps[0];
      try {
        const res = await command.mutateAsync({ targetId: seriesId, version: left.version, command: step.command, idempotencyKey: step.key });
        left.version = typeof res.new_version === 'number' ? res.new_version : left.version;
        left.steps.shift();
      } catch (err) {
        setError(`${commandErrorMessage(err)} Your event is saved as a draft. Try again, or open it.`);
        setRunning(null);
        return;
      }
    }
    remaining.current = null;
    navigate(`/account/series/${seriesId}`, { replace: true, state: { created: left.submit ? 'submitted' : 'draft' } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-start" data-testid="create-event">
      <form
        className="space-y-3"
        // Enter (a phone keyboard's Go) must not send anything for review: only the buttons send.
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset disabled={unsure || landed} className="space-y-3 min-w-0" data-testid="create-fields">
        {organisers.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="create-organiser" className="text-xs">Organiser</Label>
            <select
              id="create-organiser"
              value={organiserId}
              onChange={(e) => setOrganiserId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="create-organiser"
            >
              {organisers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}{o.lifecycle_status === 'live' ? '' : ` (${LIFECYCLE_LABEL[o.lifecycle_status] ?? o.lifecycle_status})`}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="space-y-1">
          <legend className="text-xs font-medium">What is it?</legend>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                aria-pressed={form.kind === k.kind}
                onClick={() => set('kind', k.kind)}
                className={cn(
                  'rounded-md border p-3 text-left text-sm transition-colors',
                  form.kind === k.kind ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50',
                )}
                data-testid={`kind-${k.kind}`}
              >
                <span className="block font-semibold">{k.label}</span>
                <span className="block text-xs text-muted-foreground">{k.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1">
          <Label htmlFor="create-name" className="text-xs">Name</Label>
          <Input id="create-name" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} className="h-9 text-sm" placeholder={weekly ? 'Tuesday Bachata Class' : 'Bachata Sundays Party'} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {weekly && (
            <div className="space-y-1">
              <Label htmlFor="create-weekday" className="text-xs">Day</Label>
              <select
                id="create-weekday"
                value={Number.isNaN(weekday) ? '' : weekday}
                onChange={(e) => set('date', dateForWeekday(form.date, today, Number(e.target.value)))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="create-weekday"
              >
                <option value="" disabled>Choose a day</option>
                {WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="create-date" className="text-xs">{weekly ? 'First date' : 'Date'}</Label>
            <Input id="create-date" type="date" min={today} value={form.date} onChange={(e) => set('date', e.target.value)} className="h-9 text-sm" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="create-start" className="text-xs">Starts</Label>
            <Input id="create-start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="h-9 text-sm" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-end" className="text-xs">Ends</Label>
            <Input id="create-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="create-venue" className="text-xs">Where</Label>
          <VenuePicker id="create-venue" value={form.venueId} onChange={(id) => set('venueId', id)} organiserName={organiser?.name ?? null} />
          <p className="text-[11px] text-muted-foreground">You need a venue before you can send it for review. Can&rsquo;t find yours? Search first, then ask the team to add it.</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium leading-none">Price</p>
          <p className="text-xs text-muted-foreground" data-testid="create-price-note">The Bachata Calendar team adds this for now.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="create-cover" className="text-xs">Picture (link)</Label>
          <Input id="create-cover" type="url" inputMode="url" placeholder="https://" value={form.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} className="h-9 text-sm" />
          <p className="text-[11px] text-muted-foreground">A square or portrait picture works best. Until you add one, we use your organiser picture.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="create-description" className="text-xs">About this event <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="create-description" value={form.description} rows={4} maxLength={4000} onChange={(e) => set('description', e.target.value)} className="text-sm" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="create-ticket" className="text-xs">Where to book (link) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="create-ticket" type="url" inputMode="url" placeholder="Paste your booking link" value={form.ticketUrl} onChange={(e) => set('ticketUrl', e.target.value)} className="h-9 text-sm" />
        </div>

        </fieldset>

        {block && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="status" data-testid="create-blocked">{block}</p>
        )}
        {error && <p className="text-xs text-destructive" role="alert" data-testid="create-error">{error}</p>}

        <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-t border-border space-y-1" data-testid="create-actions">
          {landed ? (
            <p className="text-sm flex flex-wrap items-center gap-2">
              <span>Saved as a draft.</span>
              {error && !running && remaining.current && (
                <Button type="button" size="sm" variant="outline" onClick={() => void finish()} data-testid="finish-draft">Try again</Button>
              )}
              <Link to={`/account/series/${seriesId}`} className="text-primary font-medium" data-testid="open-draft">Open the draft</Link>
            </p>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild size="sm" variant="ghost" className="lg:hidden mr-auto min-h-[44px]">
                <a href="#create-preview"><Eye className="w-4 h-4" aria-hidden="true" /> Preview</a>
              </Button>
              <Button type="button" size="sm" variant="outline" className="min-h-[44px]" disabled={!canSend} onClick={() => void run(false)} data-testid="save-draft">
                {running === 'draft' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save draft
              </Button>
              <Button type="button" size="sm" className="min-h-[44px]" disabled={!canSend || submitBlocked} onClick={() => void run(true)} data-testid="submit-review">
                {running === 'submit' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Submit for review
              </Button>
            </div>
          )}
          {!block && !landed && missing && <p className="text-[11px] text-muted-foreground text-right" data-testid="create-missing">{missing}</p>}
          <p className="text-[11px] text-muted-foreground">
            The Bachata Calendar team checks every new event before it goes live, usually within a day. Changes to a live event show straight away.
          </p>
        </div>
      </form>

      {/* The form promises the organiser picture until a cover is added; the preview shows it too. */}
      <EventPreview model={{ ...preview, coverImageUrl: preview.coverImageUrl ?? organiser?.avatar_url ?? null }} />
    </div>
  );
}
