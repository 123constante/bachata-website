import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLondonToday } from '@/hooks/useLondonToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { ORGANISER_HOME_KEY, runSeriesCommand, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { createBlock } from '@/modules/organiser/shared/createModel';
import { envelope, newIdempotencyKey, newSeriesId } from '@/modules/organiser/shared/seriesCommands';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { commandErrorMessage, isServerRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { UNSAVED_MESSAGE } from '@/modules/organiser/shared/editorGuards';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Chip, EmptyState, ErrorState, PrimaryButton, SectionLabel, SkeletonRows, TitleInput, useShake } from '../ui';
import { useOrganiserHome } from './eventsApi';
import { newEventCommands } from './newEvent';

const pickInitial = (organisers: HomeOrganiser[]) =>
  (organisers.find((o) => o.lifecycle_status === 'live') ?? organisers[0])?.id ?? '';

function NewEventForm({ organisers, today }: { organisers: HomeOrganiser[]; today: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [organiserId, setOrganiserId] = useState(() => pickInitial(organisers));
  const [seriesId] = useState(newSeriesId);
  // One key per write, kept across retries: a lost reply replays instead of creating twice.
  const [keys] = useState(() => ({ create: newIdempotencyKey(), rule: newIdempotencyKey() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const { shake, shakeProps } = useShake();
  const organiser = organisers.find((o) => o.id === organiserId) ?? null;
  const block = organiser ? createBlock(organiser) : 'Set up your organiser first.';
  useUnsavedChangesGuard({ enabled: name.trim() !== '' && !busy && !created, message: UNSAVED_MESSAGE });

  const create = async () => {
    if (!organiser || block || busy) return;
    if (!name.trim()) { setError('Give your event a name.'); shake(); return; }
    setBusy(true);
    setError(null);
    let version: number | null = null;
    try {
      const cityId = await resolveCreateCityId({ venueCityName: null, organiserCityId: organiser.city_id });
      const cmds = newEventCommands(name, today, organiser.id, cityId);
      const res = await runSeriesCommand(envelope(seriesId, null, cmds.create, keys.create));
      version = typeof res?.new_version === 'number' ? res.new_version : null;
      // The event exists now; a refused rule is fixed from the editor ('Repeats').
      await runSeriesCommand(envelope(seriesId, version, cmds.rule, keys.rule)).catch(() => undefined);
    } catch (err) {
      setError(isServerRefusal(err) ? commandErrorMessage(err) : 'We could not confirm the save. Check your connection and press Create again.');
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
      className="space-y-4"
      data-testid="org-new-event-form"
      onSubmit={(e) => { e.preventDefault(); void create(); }}
    >
      <TitleInput value={name} onChange={(v) => { setName(v); setError(null); }} aria-label="Event name" placeholder="Event name" maxLength={120} testId="org-new-event-name" />
      <p className="text-[14px] text-[var(--mut)]">
        Just the name for now. You add the date, place and pictures next. It stays a draft until you send it for review.
      </p>
      {organisers.length > 1 && (
        <section aria-label="Organiser">
          <SectionLabel as="p">Organiser</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {organisers.map((o) => (
              <Chip key={o.id} selected={o.id === organiserId} onToggle={() => setOrganiserId(o.id)} testId="org-new-event-organiser">{o.name}</Chip>
            ))}
          </div>
        </section>
      )}
      {block && <p className="text-[14px] text-[var(--fg)]" data-testid="org-new-event-block">{block}</p>}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-new-event-error">{error}</p>}
      <div {...shakeProps}>
        <PrimaryButton type="submit" loading={busy} loadingLabel="Creating" disabled={!!block} testId="org-new-event-create">
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
