import { useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLondonToday } from '@/hooks/useLondonToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  ORGANISER_HOME_KEY, fetchOccurrenceProgramme, fetchSeriesWorkspace, runSeriesCommand, saveOccurrenceProgramme, type HomeOrganiser,
} from '@/modules/organiser/shared/selfServeApi';
import { createBlock } from '@/modules/organiser/shared/createModel';
import { organiserStatus } from '@/modules/organiser/shared/organiserStatus';
import { envelope, newIdempotencyKey, newSeriesId } from '@/modules/organiser/shared/seriesCommands';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { commandErrorMessage, isServerRefusal, programmeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { UNSAVED_MESSAGE } from '@/modules/organiser/shared/editorGuards';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Chip, EmptyState, ErrorState, GhostButton, PrimaryButton, SectionLabel, SkeletonRows, TitleInput, useShake } from '../ui';
import { useOrganiserHome } from './eventsApi';
import { firstListedDate } from '@/modules/organiser/shared/seriesModel';
import { newEventCommands, reopensAfterFailedCreate, seedSessions } from './newEvent';
import { EVENT_TYPES, HINT_BOX_LINES, HINT_LINE_PX, chipHint, unconfirmedExitNote, type NewEventType } from './eventType';

// `?o=<organiser id>` (useOrganiserChoice's shape; the public organiser page's
// Create event passes it) preselects that organiser when it is one of mine.
const pickInitial = (organisers: HomeOrganiser[], wanted: string | null) =>
  (organisers.find((o) => o.id === wanted) ?? organisers.find((o) => o.lifecycle_status === 'live') ?? organisers[0])?.id ?? '';

// The shell's back link, and the one exit the unconfirmed-and-blocked note names (FIX-4 F5).
const BACK = { to: ORG_PATHS.events, label: 'Events' };

/** The create as computed at the first press: every later press sends exactly this. */
interface SentCreate { cmds: ReturnType<typeof newEventCommands>; type: NewEventType; today: string }

function NewEventForm({ organisers, today }: { organisers: HomeOrganiser[]; today: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [type, setType] = useState<NewEventType | null>(null);
  // The create as first SENT (name, organiser, city, London date, chip), kept for the
  // life of the page: a lost reply may have saved it, so every later press resends it
  // and its schedule verbatim and never re-reads the form (review F1, F2).
  const sentRef = useRef<SentCreate | null>(null);
  // The create went out: name, chips and organiser freeze. Only a server refusal of the
  // FIRST send, with no send before it unconfirmed (nothing was saved), opens them again.
  const [sent, setSent] = useState(false);
  // A send ended without proof either way (a lost reply, or a refusal of a resend): the
  // event may exist, so the form never reopens for the life of the page (FIX-4 F1).
  const unconfirmedRef = useRef(false);
  // The create was confirmed: the event exists with the chosen chip. Never reset.
  const [made, setMade] = useState(false);
  const [organiserId, setOrganiserId] = useState(() => pickInitial(organisers, params.get('o')));
  const [seriesId] = useState(newSeriesId);
  // One key per write, kept across retries: a lost reply replays instead of creating twice.
  const [keys] = useState(() => ({ create: newIdempotencyKey(), rule: newIdempotencyKey() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const { shake, shakeProps } = useShake();
  const organiser = organisers.find((o) => o.id === organiserId) ?? null;
  const block = organiser ? createBlock(organiser) : 'Set up your organiser first.';
  // Draft or changes-needed: the send lives on Home, so offer the way there.
  const canSend = !!organiser && organiserStatus(organiser.name, organiser.lifecycle_status).canSendForReview;
  const blockId = useId();
  // Off once the event exists: it is saved as a draft. On while the create is not confirmed.
  useUnsavedChangesGuard({ enabled: name.trim() !== '' && !busy && !created && !made, message: UNSAVED_MESSAGE });

  const create = async () => {
    if (busy) return;
    const kept = sentRef.current;
    let start: () => Promise<SentCreate>;
    if (kept) {
      start = async () => kept;
    } else {
      if (!organiser || block) return;
      if (!name.trim()) { setError('Give your event a name.'); shake(); return; }
      if (!type) { setError('Choose the first session: a class, a party or a workshop.'); shake(); return; }
      const org = organiser;
      const chip = type;
      start = async () => {
        const cityId = await resolveCreateCityId({ venueCityName: null, organiserCityId: org.city_id });
        const first = { cmds: newEventCommands(name, today, org.id, cityId, chip), type: chip, today };
        sentRef.current = first;
        setSent(true);
        return first;
      };
    }
    setBusy(true);
    setError(null);
    let version: number | null = null;
    let go: SentCreate;
    try {
      go = await start();
      const res = await runSeriesCommand(envelope(seriesId, null, go.cmds.create, keys.create));
      version = typeof res?.new_version === 'number' ? res.new_version : null;
      setMade(true);
    } catch (err) {
      // The first send refused: nothing was saved, so the form opens again (same keys).
      // Anything else may have saved it: the form stays frozen on the create already sent,
      // and a later coded error on a resend proves nothing about it (FIX-4 F1).
      if (reopensAfterFailedCreate({ refused: isServerRefusal(err), firstSend: kept === null, earlierUnconfirmed: unconfirmedRef.current })) {
        sentRef.current = null;
        setSent(false);
      } else if (sentRef.current) {
        unconfirmedRef.current = true;
      }
      setError(isServerRefusal(err) ? commandErrorMessage(err) : 'We could not confirm the save. Check your connection and press Create again.');
      shake();
      setBusy(false);
      return;
    }
    try {
      // The event exists now. A refused schedule is shown, never swallowed: Create
      // again retries it (the create replays under its key), or the editor sets it.
      await runSeriesCommand(envelope(seriesId, version, go.cmds.schedule, keys.rule));
    } catch (err) {
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      setError(`Your event is saved as a draft, but its ${go.type === 'class' ? 'weekly dates were' : 'date was'} not listed: ${commandErrorMessage(err)} Press Create to try again, or open the event and set the date there.`);
      shake();
      setBusy(false);
      return;
    }
    try {
      // The first session goes on the first listed date. seedSessions sends
      // nothing when the date already holds one, so pressing Create again after
      // a lost reply never adds a second session.
      const first = firstListedDate((await fetchSeriesWorkspace(seriesId)).dates, go.today);
      if (!first) throw new Error('no_listed_date');
      const programme = await fetchOccurrenceProgramme(first.id);
      const sessions = seedSessions(programme, go.type);
      if (sessions) await saveOccurrenceProgramme(first.id, programme.version, sessions);
    } catch (err) {
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      const why = isServerRefusal(err) ? ` ${programmeErrorCopy(err).message}` : '';
      setError(`Your event and its ${go.type === 'class' ? 'weekly dates are' : 'date is'} saved as a draft, but the first session was not added.${why} Press Create to try again, or open the event and add it on its first date.`);
      shake();
      setBusy(false);
      return;
    }
    setCreated(true);
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    navigate(ORG_PATHS.event(seriesId), { replace: true });
  };

  // Frozen from the moment a create is sent (and while any step runs): the hint above
  // Create says why.
  const frozen = busy || sent || made;

  return (
    <form
      className="space-y-[16px]"
      data-testid="org-new-event-form"
      onSubmit={(e) => { e.preventDefault(); void create(); }}
    >
      <TitleInput value={name} onChange={(v) => { setName(v); setError(null); }} aria-label="Event name" placeholder="Event name" maxLength={120} disabled={frozen} testId="org-new-event-name" />
      <section aria-label="First session" data-testid="org-new-event-type">
        <SectionLabel as="p">First session</SectionLabel>
        <div className="flex flex-wrap gap-[8px]">
          {EVENT_TYPES.map((t) => (
            <Chip key={t.type} selected={type === t.type} onToggle={() => { setType(t.type); setError(null); }} disabled={frozen} testId={`org-new-event-type-${t.type}`}>{t.label}</Chip>
          ))}
        </div>
        {/* A fixed box of HINT_BOX_LINES lines (the longest hint at 320px): the hint changes as the create runs, and nothing above Create may move. */}
        <p className="mt-[8px] text-[13px] text-[var(--mut)]" style={{ minHeight: HINT_BOX_LINES * HINT_LINE_PX, lineHeight: `${HINT_LINE_PX}px` }} data-testid="org-new-event-type-hint">
          {chipHint(made ? 'made' : sent ? 'sent' : 'open', busy, type)}
        </p>
      </section>
      <p className="text-[14px] text-[var(--mut)]">
        You add the venue, sessions and pictures next. Only you see it until you press &lsquo;Send for review&rsquo; on the event page.
      </p>
      {organisers.length > 1 && (
        <section aria-label="Organiser">
          <SectionLabel as="p">Organiser</SectionLabel>
          <div className="flex flex-wrap gap-[8px]">
            {organisers.map((o) => (
              <Chip key={o.id} selected={o.id === organiserId} onToggle={() => setOrganiserId(o.id)} disabled={frozen} testId="org-new-event-organiser">{o.name}</Chip>
            ))}
          </div>
        </section>
      )}
      {block && <p id={blockId} className="text-[14px] text-[var(--fg)]" data-testid="org-new-event-block">{block}</p>}
      {/* Sent, never confirmed, now blocked: Create is off and the form frozen, so name the way out. */}
      {block && sent && !made && (
        <p className="text-[14px] text-[var(--mut)]" data-testid="org-new-event-unconfirmed-exit">{unconfirmedExitNote(BACK.label)}</p>
      )}
      {block && canSend && (
        <GhostButton onClick={() => navigate(ORG_PATHS.home)} testId="org-new-event-go-home">Go to Home to send it for review</GhostButton>
      )}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-new-event-error">{error}</p>}
      <div {...shakeProps}>
        <PrimaryButton type="submit" loading={busy} loadingLabel="Creating" disabled={!!block} aria-describedby={block ? blockId : undefined} testId="org-new-event-create">
          Create event
        </PrimaryButton>
      </div>
      {/* Once the event exists (the locked hint says "open the event"): BELOW Create, so the
          button just pressed never moves. Never before the create is confirmed: it may not exist.
          Never while its date or first session still runs: a tap would race the schedule (FIX-4 F3). */}
      {made && !busy && (
        <GhostButton onClick={() => { setCreated(true); navigate(ORG_PATHS.event(seriesId), { replace: true }); }} testId="org-new-event-open">
          Open the event
        </GhostButton>
      )}
    </form>
  );
}

/** /account/o/events/new -- name only; creates the draft at once and opens its editor (W2). */
export default function NewEventPage() {
  const home = useOrganiserHome();
  const today = useLondonToday(home.data?.today || undefined);
  return (
    <OrganiserShell title="New event" back={BACK} testId="org-page-new-event">
      {/* The error state only when there is nothing to show: a failed refetch (on focus) must not
          unmount the form, which holds the sent create, its key and series id (FIX-4 F2). */}
      {home.isPending ? (
        <SkeletonRows count={2} label="Loading" />
      ) : !home.data ? (
        <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} />
      ) : home.data.organisers.length === 0 ? (
        <EmptyState title="Set up your organiser first" body="An event belongs to an organiser. Create or claim yours from Home." testId="org-new-event-no-organiser" />
      ) : (
        <NewEventForm organisers={home.data.organisers} today={today} />
      )}
    </OrganiserShell>
  );
}
