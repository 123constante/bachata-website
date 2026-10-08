import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Film, Images, MapPin, Repeat, Shapes, Text, Ticket, Users } from 'lucide-react';
import { useLondonToday } from '@/hooks/useLondonToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { FLYER_ACCEPT } from '@/modules/organiser/shared/flyerModel';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { UNSAVED_MESSAGE, saveBarState } from '@/modules/organiser/shared/editorGuards';
import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { TEAM, endedOnLabel, eventLock, lifecycleTag } from '@/modules/organiser/shared/eventState';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  AnnounceRegion, Card, Chip, Cover, EmptyState, ErrorState, PreviewBar, SkeletonRows, StatusTag, SummaryRow, TitleInput,
  useAnnounce, useShake,
} from '../ui';
import { CAP_NOTE, allowedEndChoices, endWithinCap, listingView } from './dateCap';
import { scheduleView } from './schedule';
import { EditorSheet, type SheetName } from './EditorSheet';
import { DatesList, ScheduleCard } from './EditorRows';
import { DatesTakenOff } from './DatesTakenOff';
import { EventReviewCard } from './ReviewCard';
import { EditorGroup } from './EditorGroup';
import { sessionDates } from './reviewModel';
import { categoryLabel } from './eventType';
import { EventList } from './EventList';
import {
  FIELD_LABEL, MUSIC_STYLES, capInput, cardPreview, changedFields, conflictingFields, draftFromWorkspace, draftProblem,
  listedUntil, oneDateLoss, repeatsLabel, savePlan, shortDate, type CardPreview, type EventDraft, type EventWorkspace,
} from './eventModel';
import { eventWorkspaceQueryKey, fetchEventWorkspace, organisersOf, useEventWorkspace, useOrganiserHome, useRunCommands } from './eventsApi';
import { uploadEventPicture } from './media';

/** The public card as guests will see it (compact, inside the sticky bar). */
export function PublicCardPreview({ card }: { card: CardPreview }) {
  return (
    <div className="flex items-center gap-[12px] p-[8px]" data-testid="org-card-preview">
      <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[8px] bg-[var(--card2)]">
        {card.coverUrl && <img src={card.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[var(--fg)]">{card.title}</p>
        <p className="truncate text-[13px] text-[var(--mut)]">{[card.when, card.where].filter(Boolean).join(' \u00b7 ') || 'Date and venue to come'}</p>
      </div>
    </div>
  );
}

/** A stored style shown as a chip: 'zouk' reads 'Zouk' (the stored spelling is what is saved). */
const styleLabel = (s: string) => (s && s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
  const tag = lifecycleTag(ws.series.lifecycle_status);
  // Ended / archived: shown, never edited (the server refuses every owner write).
  const lock = eventLock(ws.series.lifecycle_status);
  const sched = useMemo(() => scheduleView(ws.series, ws.dates), [ws]);
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
      // When the organiser moves the start or makes it weekly, re-pick an end inside the cap.
      // Any other edit leaves the stored rule alone (an open-ended rule stays open-ended).
      const scheduleMoved = 'startDate' in p || 'shape' in p;
      if (scheduleMoved && next.shape === 'weekly' && (!next.until || !endWithinCap(capInput(ws, next, today), next.until))) {
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
    const problem = draftProblem(draft, ws, today, base);
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
  const upcoming = upcomingDates(ws.dates, today);
  // A one-date event that can be made weekly (recurring with no rule, G5).
  const canRepeat = sched.mode === 'single' && sched.repeatsReason === null && !lock;
  const weekly = (sched.mode === 'weekly' || canRepeat) && draft.shape === 'weekly';
  // Weekly -> One date, not saved yet: the dates that go (the sheet confirmed it).
  const pendingOneDate = sched.mode === 'weekly' && draft.shape === 'single' && base.shape === 'weekly';
  const loss = oneDateLoss(ws, draft, today);
  // One mapping decides the row's date, whether Extend can add a date (the server's
  // 30-scheduled-upcoming rule) and its sentence. Extend continues the run from its
  // last listed date (an open-ended rule included).
  const listing = listingView(cap, draft.until ?? until, {
    listed: upcoming.filter((d) => d.lifecycle_status !== 'cancelled').length,
    last: upcoming[upcoming.length - 1]?.occurrence_date ?? null,
  });
  const step = weekly ? listing.step : null;
  const untilLabel = listing.untilText;
  const endedLabel = endedOnLabel(ws.series.lifecycle_status, ws.endedOn, today);
  const firstDate = ws.hasMore ? draft.startDate : [...ws.dates.map((d) => d.occurrence_date)].sort()[0] ?? draft.startDate;
  const next = upcoming.find((d) => d.lifecycle_status !== 'cancelled') ?? null;
  const emptyHint = lock ?? (sched.mode === 'fixed' ? sched.reason : weekly ? 'Use Extend above to list more dates.' : 'Change \u2018Starts on\u2019 above to list a new date.') ?? '';
  const ownOrganisers = organisersOf(home.data?.organisers, seriesId);
  const organisers = ownOrganisers.map((o) => o.name);
  const bar = saveBarState({ dirty, saving, locked: !!lock });
  // Chips: the fixed list, then every stored style outside it once (matched without case).
  // Extras come from what was loaded AND the draft, so turning one off never loses its chip.
  const extras: string[] = [];
  for (const s of [...base.styles, ...draft.styles]) {
    if (!MUSIC_STYLES.some((m) => m.toLowerCase() === s.toLowerCase()) && !extras.some((x) => x.toLowerCase() === s.toLowerCase())) extras.push(s);
  }
  const styles = [...MUSIC_STYLES, ...extras];
  const hasStyle = (s: string) => draft.styles.some((x) => x.toLowerCase() === s.toLowerCase());
  const toggleStyle = (s: string) => patch({ styles: hasStyle(s) ? draft.styles.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...draft.styles, s] });
  const card = cardPreview(draft, ws, today, venueName(venues.data, draft.venueId));

  const editor = (
    <div className="space-y-[20px] pb-[16px]" data-testid="org-event-editor">
      <div className="flex justify-end">
        <StatusTag tone={tag.tone} testId="org-event-status">{tag.label}</StatusTag>
      </div>
      {lock && (
        <p className="rounded-[12px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[12px] text-[14px] text-[var(--fg)]" data-testid="org-event-locked">
          {lock}
        </p>
      )}
      <EditorGroup id="what" heading="What it is">
        <TitleInput value={draft.name} onChange={(name) => patch({ name })} readOnly={!!lock} aria-label="Event name" placeholder="Event name" maxLength={120} testId="org-event-name" />
        <Cover src={draft.coverUrl || null} alt="" onChange={lock ? undefined : () => coverInput.current?.click()} changeLabel="Change cover" emptyLabel="Add a square cover" testId="org-cover" />
        <input ref={coverInput} type="file" accept={FLYER_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pickCover} data-testid="org-cover-file" />
        {uploading === 'cover' && <p className="text-center text-[13px] text-[var(--mut)]" role="status">Uploading the cover&hellip;</p>}
        {uploadError && sheet === null && <p role="alert" className="text-center text-[14px] text-[var(--danger)]">{uploadError}</p>}
        <Card>
          <SummaryRow icon={<Shapes />} label="Type" value={categoryLabel(ws.series.category)}
            sublabel={`Chosen when the event was made. To change it, ask ${TEAM}.`} testId="org-row-type" />
        </Card>
      </EditorGroup>
      <EditorGroup id="when" heading="When">
        <Card label="Date" testId="org-date-card">
          {sched.mode === 'fixed' ? (
            <SummaryRow icon={<CalendarDays />} label="First date" value={firstDate ? shortDate(firstDate, today) : 'Not set'} testId="org-row-starts" />
          ) : (
            <SummaryRow icon={<CalendarDays />} label="Starts on" value={draft.startDate ? shortDate(draft.startDate, today) : 'Choose'} onPress={() => setSheet('starts')} testId="org-row-starts" />
          )}
          {sched.mode === 'weekly' || canRepeat ? (
            <SummaryRow icon={<Repeat />} label="Repeats" value={repeatsLabel(draft)} onPress={() => setSheet('repeats')} testId="org-row-repeats" />
          ) : sched.mode === 'single' ? (
            <SummaryRow icon={<Repeat />} label="Repeats" value={sched.pattern} testId="org-row-repeats" />
          ) : (
            <SummaryRow icon={<Repeat />} label="Repeats" value={sched.pattern} testId="org-row-repeats" />
          )}
          {endedLabel ? (
            <SummaryRow label={endedLabel} testId="org-row-ended" />
          ) : sched.mode !== 'weekly' && !weekly ? (
            <SummaryRow label={untilLabel} sublabel={sched.mode === 'single' && !upcoming.length ? emptyHint : undefined} testId="org-row-until" />
          ) : weekly ? (
            <div className="flex min-h-[52px] items-center gap-[12px] px-[16px] py-[8px]" data-testid="org-row-until">
              <button type="button" onClick={() => setSheet('until')} className="min-h-[44px] min-w-0 flex-1 text-left" data-testid="org-row-until-open">
                <span className="block truncate text-[15px] text-[var(--fg)]">{until ? untilLabel : 'Choose how long it is listed'}</span>
                <span id="org-extend-note" className="block text-[13px] text-[var(--mut)]" data-testid="org-extend-note">{listing.note}</span>
              </button>
              <button type="button" disabled={!step} onClick={() => step && patch({ until: step.until })} data-testid="org-extend"
                aria-label={step ? `Extend by ${step.add} dates` : 'Extend'} aria-describedby={step ? undefined : 'org-extend-note'}
                className="h-[44px] shrink-0 rounded-[12px] px-[12px] text-[15px] font-semibold text-[var(--gold)] disabled:text-[var(--mut)]">
                Extend
              </button>
            </div>
          ) : pendingOneDate ? (
            <SummaryRow label={draft.startDate ? `Only ${shortDate(draft.startDate, today)}` : 'One date'}
              sublabel={loss ? `Save to take off the other ${loss === 1 ? 'date' : `${loss} dates`}` : 'Save to keep just this date'} testId="org-row-until" />
          ) : (
            <SummaryRow label={until ? untilLabel : 'No date listed yet'} sublabel={CAP_NOTE} testId="org-row-until" />
          )}
          {sched.mode !== 'weekly' && !lock && (sched.mode === 'fixed' ? sched.reason : sched.repeatsReason) && (
            <p className="px-[16px] py-[12px] text-[13px] text-[var(--mut)]" data-testid="org-schedule-reason">{sched.mode === 'fixed' ? sched.reason : sched.repeatsReason}</p>
          )}
        </Card>
        <DatesList seriesId={seriesId} dates={ws.dates} today={today} emptyHint={emptyHint} truncated={ws.hasMore} />
        <DatesTakenOff series={ws.series} dates={ws.dates} today={today} lock={lock} dirty={dirty} canChooseEnd={weekly} />
      </EditorGroup>
      <EditorGroup id="where" heading="Where">
        <Card>
          <SummaryRow icon={<MapPin />} label="Venue" value={venueName(venues.data, draft.venueId) ?? (lock ? 'None' : 'Choose')} onPress={() => setSheet('venue')} disabled={!!lock} testId="org-row-venue" />
        </Card>
      </EditorGroup>
      <EditorGroup id="see" heading="What people see">
        <Card>
          <SummaryRow icon={<Text />} label="Description" value={draft.description.trim() ? draft.description.trim() : lock ? 'None' : 'Add'} onPress={() => setSheet('description')} disabled={!!lock} testId="org-row-description" />
        </Card>
        <section aria-label="Music styles" data-testid="org-styles">
          <p className="mb-[8px] text-[13px] font-semibold uppercase tracking-wide text-[var(--mut)]">Music</p>
          <div className="flex flex-wrap gap-[8px]">
            {styles.map((s) => <Chip key={s.toLowerCase()} selected={hasStyle(s)} onToggle={() => toggleStyle(s)} disabled={!!lock} testId="org-style-chip">{styleLabel(s)}</Chip>)}
          </div>
        </section>
        <Card>
          <SummaryRow icon={<Images />} label="Gallery" value={draft.gallery.length ? `${draft.gallery.length} photo${draft.gallery.length === 1 ? '' : 's'}` : 'None'} onPress={() => setSheet('gallery')} disabled={!!lock} testId="org-row-gallery" />
          <SummaryRow icon={<Film />} label="Video" value={draft.videos.length ? `${draft.videos.length}` : 'None'} onPress={() => setSheet('video')} disabled={!!lock} testId="org-row-video" />
        </Card>
      </EditorGroup>
      <EditorGroup id="programme" heading="Programme">
        <ScheduleCard seriesId={seriesId} next={next} today={today} upcoming={upcoming.length} pastCount={ws.dates.length - upcoming.length} closed={!!lock} />
      </EditorGroup>
      <EditorGroup id="links" heading="Tickets and links">
        <Card>
          <SummaryRow icon={<Ticket />} label="Ticket link" value={draft.ticketUrl.trim() || (lock ? 'None' : 'Add')} onPress={() => setSheet('ticket')} disabled={!!lock} testId="org-row-ticket" />
        </Card>
      </EditorGroup>
      <EditorGroup id="who" heading="Who runs it">
        <Card>
          <SummaryRow icon={<Users />} label="Organisers" value={organisers.length ? joinNames(organisers) : undefined}
            sublabel={`Set when the event was made. To change them, ask ${TEAM}.`} testId="org-row-organisers" />
        </Card>
      </EditorGroup>
      <EventReviewCard seriesId={seriesId} name={base.name} status={ws.series.lifecycle_status} version={ws.series.version}
        upcomingListed={upcoming.filter((d) => d.lifecycle_status !== 'cancelled').length}
        datesWithSessions={sessionDates(ws.hasSessions, upcoming)} hasCover={base.coverUrl.trim() !== ''}
        organisers={home.data ? ownOrganisers : null} dirty={dirty} onSent={() => announce('Sent for review.')} />
      <EditorSheet stopReason={sched.stopReason} oneDateLoss={sched.mode === 'weekly' && base.shape === 'weekly' ? loss : 0}
        sheet={sheet} onSheet={setSheet} draft={draft} patch={patch} today={today} cap={cap} capNote={listing.sheetNote} venues={venues.data}
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
          {bar.show && (
            <PreviewBar
              preview={<PublicCardPreview card={card} />}
              actionLabel={bar.label}
              onAction={() => void save()}
              loading={saving}
              disabled={bar.disabled}
              live={live}
              compact={bar.compact}
              summary={bar.summary}
              shakeProps={shakeProps}
            />
          )}
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
