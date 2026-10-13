import { useId, useState } from 'react';
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
import { firstListedDate, newEventCommands, seedSessions } from './newEvent';
import { CHIPS_LOCKED_HINT, EVENT_TYPES, FIRST_SESSION_HINT, type NewEventType } from './eventType';

// `?o=<organiser id>` (useOrganiserChoice's shape; the public organiser page's
// Create event passes it) preselects that organiser when it is one of mine.
const pickInitial = (organisers: HomeOrganiser[], wanted: string | null) =>
  (organisers.find((o) => o.id === wanted) ?? organisers.find((o) => o.lifecycle_status === 'live') ?? organisers[0])?.id ?? '';

function NewEventForm({ organisers, today }: { organisers: HomeOrganiser[]; today: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [type, setType] = useState<NewEventType | null>(null);
  // The event exists but its dates did not list, or its first session was not
  // added: say so and offer to open it.
  const [scheduleFailed, setScheduleFailed] = useState(false);
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
  useUnsavedChangesGuard({ enabled: name.trim() !== '' && !busy && !created, message: UNSAVED_MESSAGE });

  const create = async () => {
    if (!organiser || block || busy) return;
    if (!name.trim()) { setError('Give your event a name.'); shake(); return; }
    if (!type) { setError('Choose the first session: a class, a party or a workshop.'); shake(); return; }
    setBusy(true);
    setError(null);
    setScheduleFailed(false);
    let version: number | null = null;
    let cmds: ReturnType<typeof newEventCommands>;
    try {
      const cityId = await resolveCreateCityId({ venueCityName: null, organiserCityId: organiser.city_id });
      cmds = newEventCommands(name, today, organiser.id, cityId, type);
      const res = await runSeriesCommand(envelope(seriesId, null, cmds.create, keys.create));
      version = typeof res?.new_version === 'number' ? res.new_version : null;
    } catch (err) {
      setError(isServerRefusal(err) ? commandErrorMessage(err) : 'We could not confirm the save. Check your connection and press Create again.');
      shake();
      setBusy(false);
      return;
    }
    try {
      // The event exists now. A refused schedule is shown, never swallowed: Create
      // again retries it (the create replays under its key), or the editor sets it.
      await runSeriesCommand(envelope(seriesId, version, cmds.schedule, keys.rule));
    } catch (err) {
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      setError(`Your event is saved as a draft, but its ${type === 'class' ? 'weekly dates were' : 'date was'} not listed: ${commandErrorMessage(err)} Press Create to try again, or open the event and set the date there.`);
      setScheduleFailed(true);
      shake();
      setBusy(false);
      return;
    }
    try {
      // The first session goes on the first listed date. seedSessions sends
      // nothing when the date already holds one, so pressing Create again after
      // a lost reply never adds a second session.
      const first = firstListedDate((await fetchSeriesWorkspace(seriesId)).dates, today);
      if (!first) throw new Error('no_listed_date');
      const programme = await fetchOccurrenceProgramme(first.id);
      const sessions = seedSessions(programme, type);
      if (sessions) await saveOccurrenceProgramme(first.id, programme.version, sessions);
    } catch (err) {
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      const why = isServerRefusal(err) ? ` ${programmeErrorCopy(err).message}` : '';
      setError(`Your event and its ${type === 'class' ? 'weekly dates are' : 'date is'} saved as a draft, but the first session was not added.${why} Press Create to try again, or open the event and add it on its first date.`);
      setScheduleFailed(true);
      shake();
      setBusy(false);
      return;
    }
    setCreated(true);
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    navigate(ORG_PATHS.event(seriesId), { replace: true });
  };

  return (
    <form
      className="space-y-[16px]"
      data-testid="org-new-event-form"
      onSubmit={(e) => { e.preventDefault(); void create(); }}
    >
      <TitleInput value={name} onChange={(v) => { setName(v); setError(null); }} aria-label="Event name" placeholder="Event name" maxLength={120} testId="org-new-event-name" />
      <section aria-label="First session" data-testid="org-new-event-type">
        <SectionLabel as="p">First session</SectionLabel>
        <div className="flex flex-wrap gap-[8px]">
          {EVENT_TYPES.map((t) => (
            <Chip key={t.type} selected={type === t.type} onToggle={() => { setType(t.type); setError(null); }} disabled={scheduleFailed} testId={`org-new-event-type-${t.type}`}>{t.label}</Chip>
          ))}
        </div>
        <p className="mt-[8px] text-[13px] text-[var(--mut)]" data-testid="org-new-event-type-hint">
          {scheduleFailed ? CHIPS_LOCKED_HINT : type ? EVENT_TYPES.find((t) => t.type === type)?.hint : FIRST_SESSION_HINT}
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
              <Chip key={o.id} selected={o.id === organiserId} onToggle={() => setOrganiserId(o.id)} testId="org-new-event-organiser">{o.name}</Chip>
            ))}
          </div>
        </section>
      )}
      {block && <p id={blockId} className="text-[14px] text-[var(--fg)]" data-testid="org-new-event-block">{block}</p>}
      {block && canSend && (
        <GhostButton onClick={() => navigate(ORG_PATHS.home)} testId="org-new-event-go-home">Go to Home to send it for review</GhostButton>
      )}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-new-event-error">{error}</p>}
      {scheduleFailed && (
        <GhostButton onClick={() => { setCreated(true); navigate(ORG_PATHS.event(seriesId), { replace: true }); }} testId="org-new-event-open">
          Open the event
        </GhostButton>
      )}
      <div {...shakeProps}>
        <PrimaryButton type="submit" loading={busy} loadingLabel="Creating" disabled={!!block} aria-describedby={block ? blockId : undefined} testId="org-new-event-create">
          Create event
        </PrimaryButton>
      </div>
    </form>
  );
}

/** /account/o/events/new -- name only; creates the draft at once and opens its editor (W2). */
export default function NewEventPage() {
  const home = useOrganiserHome();
  const today = useLondonToday(home.data?.today || undefined);
  return (
    <OrganiserShell title="New event" back={{ to: ORG_PATHS.events, label: 'Events' }} testId="org-page-new-event">
      {home.isPending ? (
        <SkeletonRows count={2} label="Loading" />
      ) : home.isError ? (
        <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} />
      ) : home.data.organisers.length === 0 ? (
        <EmptyState title="Set up your organiser first" body="An event belongs to an organiser. Create or claim yours from Home." testId="org-new-event-no-organiser" />
      ) : (
        <NewEventForm organisers={home.data.organisers} today={today} />
      )}
    </OrganiserShell>
  );
}
