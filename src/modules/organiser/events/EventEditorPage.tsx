import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Film, Images, MapPin, Repeat, Text, Ticket, Users } from 'lucide-react';
import { useLondonToday } from '@/hooks/useLondonToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { FLYER_ACCEPT } from '@/modules/organiser/shared/flyerModel';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { UNSAVED_MESSAGE } from '@/modules/organiser/shared/editorGuards';
import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  AnnounceRegion, Card, Chip, Cover, EmptyState, ErrorState, PreviewBar, SkeletonRows, StatusTag, SummaryRow, TitleInput,
  useAnnounce, useShake,
} from '../ui';
import { CAP_NOTE, allowedEndChoices, endWithinCap, extendStep } from './dateCap';
import { EditorSheet, type SheetName } from './EditorSheet';
import { DatesList, ScheduleCard } from './EditorRows';
import { EventList } from './EventList';
import {
  FIELD_LABEL, MUSIC_STYLES, capInput, cardPreview, changedFields, conflictingFields, draftFromWorkspace, draftProblem,
  listedUntil, repeatsLabel, savePlan, shortDate, type CardPreview, type EventDraft, type EventWorkspace,
} from './eventModel';
import { eventWorkspaceQueryKey, fetchEventWorkspace, organisersOf, useEventWorkspace, useOrganiserHome, useRunCommands } from './eventsApi';
import { uploadEventPicture } from './media';

/** The public card as guests will see it (compact, inside the sticky bar). */
export function PublicCardPreview({ card }: { card: CardPreview }) {
  return (
    <div className="flex items-center gap-[12px] p-[8px]" data-testid="org-card-preview">
      <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[8px] bg-[var(--card2)]">
        {card.coverUrl && <img src={card.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[var(--fg)]">{card.title}</p>
        <p className="truncate text-[13px] text-[var(--mut)]">{[card.when, card.where].filter(Boolean).join(' \u00b7 ') || 'Date and venue to come'}</p>
      </div>
    </div>
  );
}

const joinNames = (names: string[]) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

function EventEditor({ ws, today }: { ws: EventWorkspace; today: string }) {
  const seriesId = ws.series.id;
  const queryClient = useQueryClient();
  const run = useRunCommands(seriesId);
  const venues = useVenueOptions();
  const home = useOrganiserHome();
  const loaded = useMemo(() => draftFromWorkspace(ws, today), [ws, today]);
  const [base, setBase] = useState<EventDraft>(loaded);
  const [draft, setDraft] = useState<EventDraft>(loaded);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'cover' | 'gallery' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const { shake, shakeProps } = useShake();
  const [message, announce] = useAnnounce();
  const dirty = changedFields(base, draft).length > 0;
  const live = ws.series.lifecycle_status === 'live';
  const cap = useMemo(() => capInput(ws, draft, today), [ws, draft, today]);

  // Fresh server values replace the screen only when the organiser has not typed.
  const [seen, setSeen] = useState(loaded);
  if (seen !== loaded) {
    setSeen(loaded);
    setDraft((d) => (changedFields(base, d).length === 0 ? loaded : d));
    setBase(loaded);
  }

  useUnsavedChangesGuard({ enabled: dirty && !saving, message: UNSAVED_MESSAGE });

  const patch = useCallback((p: Partial<EventDraft>) => {
    setError(null);
    setDraft((d) => {
      const next = { ...d, ...p };
      // A weekly event always has an end inside the cap: re-pick one when the start moves.
      if (next.shape === 'weekly' && (!next.until || !endWithinCap(capInput(ws, next, today), next.until))) {
        const choices = allowedEndChoices(capInput(ws, next, today));
        next.until = (choices.find((c) => c.count >= 8) ?? choices[choices.length - 1])?.until ?? null;
      }
      return next;
    });
  }, [ws, today]);

  const upload = async (files: File[], kind: 'cover' | 'gallery') => {
    setUploading(kind);
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadEventPicture(seriesId, file));
      if (kind === 'cover') patch({ coverUrl: urls[0] });
      else setDraft((d) => ({ ...d, gallery: [...d.gallery, ...urls] }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'The picture did not upload.');
    } finally {
      setUploading(null);
    }
  };
  const pickCover = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void upload([file], 'cover');
  };

  const save = async () => {
    const problem = draftProblem(draft, ws, today);
    if (problem) { setError(problem); shake(); return; }
    setSaving(true);
    setError(null);
    try {
      // Read what the server holds NOW before overwriting anything.
      const fresh = await queryClient.fetchQuery({ queryKey: eventWorkspaceQueryKey(seriesId), queryFn: () => fetchEventWorkspace(seriesId), staleTime: 0 });
      const freshDraft = draftFromWorkspace(fresh, today);
      const clash = conflictingFields(base, freshDraft, draft);
      if (clash.length) {
        setBase(freshDraft);
        setError(`Someone else changed ${joinNames(clash.map((f) => FIELD_LABEL[f]))} while you were editing, so nothing was saved. Check it, then save again.`);
        shake();
        return;
      }
      const venueCity = draft.venueId !== freshDraft.venueId ? venues.data?.find((v) => v.id === draft.venueId)?.city_name ?? null : null;
      const cityId = venueCity ? await resolveCreateCityId({ venueCityName: venueCity, organiserCityId: null }) : null;
      await run(savePlan(freshDraft, draft, fresh, today, cityId), fresh.series.version);
      setBase(draft);
      announce(live ? 'Saved. Guests see it now.' : 'Saved.');
    } catch (err) {
      setError(commandErrorMessage(err));
      shake();
    } finally {
      setSaving(false);
    }
  };

  const until = listedUntil(draft, ws, today);
  const step = draft.shape === 'weekly' ? extendStep(cap, draft.until) : null;
  const next = upcomingDates(ws.dates, today).find((d) => d.lifecycle_status !== 'cancelled') ?? null;
  const organisers = organisersOf(home.data?.organisers, seriesId).map((o) => o.name);
  const styles = [...MUSIC_STYLES, ...draft.styles.filter((s) => !MUSIC_STYLES.some((m) => m.toLowerCase() === s.toLowerCase()))];
  const hasStyle = (s: string) => draft.styles.some((x) => x.toLowerCase() === s.toLowerCase());
  const toggleStyle = (s: string) => patch({ styles: hasStyle(s) ? draft.styles.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...draft.styles, s] });
  const card = cardPreview(draft, ws, today, venueName(venues.data, draft.venueId));

  const editor = (
    <div className="space-y-[20px] pb-[16px]" data-testid="org-event-editor">
      <div className="flex justify-end">
        <StatusTag tone={live ? 'live' : 'draft'} testId="org-event-status">{live ? 'Live' : 'Draft'}</StatusTag>
      </div>
      <Cover src={draft.coverUrl || null} alt="" onChange={() => coverInput.current?.click()} changeLabel="Change cover" emptyLabel="Add a square cover" testId="org-cover" />
      <input ref={coverInput} type="file" accept={FLYER_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pickCover} data-testid="org-cover-file" />
      {uploading === 'cover' && <p className="text-center text-[13px] text-[var(--mut)]" role="status">Uploading the cover&hellip;</p>}
      {uploadError && sheet === null && <p role="alert" className="text-center text-[14px] text-[var(--danger)]">{uploadError}</p>}
      <Card>
        <SummaryRow icon={<Images />} label="Gallery" value={draft.gallery.length ? `${draft.gallery.length} photo${draft.gallery.length === 1 ? '' : 's'}` : 'None'} onPress={() => setSheet('gallery')} testId="org-row-gallery" />
        <SummaryRow icon={<Film />} label="Video" value={draft.videos.length ? `${draft.videos.length}` : 'None'} onPress={() => setSheet('video')} testId="org-row-video" />
      </Card>
      <TitleInput value={draft.name} onChange={(name) => patch({ name })} aria-label="Event name" placeholder="Event name" maxLength={120} testId="org-event-name" />
      <Card label="Date" testId="org-date-card">
        <SummaryRow icon={<CalendarDays />} label="Starts on" value={draft.startDate ? shortDate(draft.startDate, today) : 'Choose'} onPress={() => setSheet('starts')} testId="org-row-starts" />
        <SummaryRow icon={<Repeat />} label="Repeats" value={repeatsLabel(draft)} onPress={() => setSheet('repeats')} testId="org-row-repeats" />
        {draft.shape === 'weekly' ? (
          <div className="flex min-h-[52px] items-center gap-[12px] px-[16px] py-[8px]" data-testid="org-row-until">
            <button type="button" onClick={() => setSheet('until')} className="min-w-0 flex-1 text-left" data-testid="org-row-until-open">
              <span className="block truncate text-[15px] text-[var(--fg)]">{until ? `Listed until ${shortDate(until, today)}` : 'Choose how long it is listed'}</span>
              <span className="block truncate text-[13px] text-[var(--mut)]">{CAP_NOTE}</span>
            </button>
            <button type="button" disabled={!step} onClick={() => step && patch({ until: step.until })} data-testid="org-extend"
              aria-label={step ? `Extend by ${step.add} dates` : 'Extend (already at 30 upcoming dates)'}
              className="h-[44px] shrink-0 rounded-[12px] px-[12px] text-[15px] font-semibold text-[var(--gold)] disabled:text-[var(--mut)]">
              Extend
            </button>
          </div>
        ) : (
          <SummaryRow label={until ? `Listed until ${shortDate(until, today)}` : 'No date listed yet'} sublabel={CAP_NOTE} testId="org-row-until" />
        )}
      </Card>
      <ScheduleCard seriesId={seriesId} next={next} today={today} />
      <Card>
        <SummaryRow icon={<MapPin />} label="Venue" value={venueName(venues.data, draft.venueId) ?? 'Choose'} onPress={() => setSheet('venue')} testId="org-row-venue" />
        <SummaryRow icon={<Users />} label="Organisers" value={organisers.length ? joinNames(organisers) : undefined} testId="org-row-organisers" />
        <SummaryRow icon={<Text />} label="Description" value={draft.description.trim() ? draft.description.trim() : 'Add'} onPress={() => setSheet('description')} testId="org-row-description" />
      </Card>
      <section aria-label="Music styles" data-testid="org-styles">
        <p className="mb-[8px] text-[13px] font-semibold uppercase tracking-wide text-[var(--mut)]">Music</p>
        <div className="flex flex-wrap gap-[8px]">
          {styles.map((s) => <Chip key={s} selected={hasStyle(s)} onToggle={() => toggleStyle(s)} testId="org-style-chip">{s}</Chip>)}
        </div>
      </section>
      <Card label="More">
        <SummaryRow icon={<Ticket />} label="Ticket link" value={draft.ticketUrl.trim() || 'Add'} onPress={() => setSheet('ticket')} testId="org-row-ticket" />
      </Card>
      <DatesList seriesId={seriesId} dates={ws.dates} today={today} />
      <EditorSheet
        sheet={sheet} onSheet={setSheet} draft={draft} patch={patch} today={today} cap={cap} venues={venues.data}
        venuesError={venues.isError} onRetryVenues={() => void venues.refetch()} venuesRetrying={venues.isFetching}
        onUploadGallery={(files) => void upload(files, 'gallery')} uploading={uploading === 'gallery'} uploadError={uploadError}
      />
      <AnnounceRegion message={message} />
    </div>
  );

  return (
    <OrganiserShell
      title={draft.name.trim() || 'Edit event'}
      back={{ to: ORG_PATHS.events, label: 'Events' }}
      testId="org-page-event-editor"
      list={<EventList activeId={seriesId} />}
      detail={editor}
      actionBar={
        <>
          {error && <p role="alert" className="px-[16px] pt-[12px] text-[14px] text-[var(--danger)]" data-testid="org-save-error">{error}</p>}
          <PreviewBar
            preview={<PublicCardPreview card={card} />}
            actionLabel={dirty ? 'Save changes' : 'Saved'}
            onAction={() => void save()}
            loading={saving}
            disabled={!dirty}
            live={live}
            shakeProps={shakeProps}
          />
        </>
      }
    />
  );
}

/** /account/o/events/:seriesId -- the event editor; on wide screens the list sits beside it (W2). */
export default function EventEditorPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const workspace = useEventWorkspace(seriesId);
  const home = useOrganiserHome();
  const today = useLondonToday(home.data?.today || undefined);
  if (workspace.data) return <EventEditor key={seriesId} ws={workspace.data} today={today} />;
  return (
    <OrganiserShell
      title="Edit event"
      back={{ to: ORG_PATHS.events, label: 'Events' }}
      testId="org-page-event-editor"
      list={<EventList activeId={seriesId} />}
      detail={
        workspace.isError ? (
          <ErrorState onRetry={() => void workspace.refetch()} retrying={workspace.isFetching} testId="org-editor-error" />
        ) : !seriesId ? (
          <EmptyState title="Event not found" />
        ) : (
          <SkeletonRows count={6} label="Loading the event" testId="org-editor-loading" />
        )
      }
    />
  );
}
