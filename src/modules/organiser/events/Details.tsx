import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { firstListedDate, upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { eventLock } from '@/modules/organiser/shared/eventState';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { useFlowHome } from '@/modules/organiser/flows/add/useFlow';
import { EDIT_PARAM, EventConflict, EventStepShell, SendButton, StepError, detailEditPath, useEventSend } from '@/modules/organiser/flows/event';
import { readExtra } from '@/modules/organiser/flows/event/eventSteps';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Card, ErrorState, FIELD_CLASS, SkeletonRows } from '../ui';
import { ScheduleCard } from './EditorRows';
import { EditorSheet, MAX_DESCRIPTION, type SheetName } from './EditorSheet';
import {
  DETAIL_LABEL, capInput, detailChanged, detailCommand, detailProblem, detailValue, draftFromWorkspace, venueCommand,
  type DetailField, type EventDraft, type EventWorkspace, type TextDetail,
} from './eventModel';
import { useEventWorkspace } from './eventsApi';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { ClosedLines } from './ClosedLines';
import { uploadEventPicture } from './media';
import { countLabel, mediaCommand, passCount, pricesLock, usualEnd } from './seriesExtras';
import { EndEdit, PricesEdit } from './DetailsExtras';

const TEXT_FIELDS: TextDetail[] = ['name', 'time', 'level', 'music', 'tickets', 'instagram', 'about'];
const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left';
const MAX_LEN: Record<TextDetail, number> = { name: 120, time: 5, level: 60, music: 300, tickets: 500, instagram: 300, about: MAX_DESCRIPTION };

const readField = (raw: string | null): TextDetail | null => TEXT_FIELDS.find((f) => f === raw) ?? null;

/** One field, one box, one Save (C37 tap-to-edit): Save stays off until the value differs. */
function DetailEdit({ ws, field }: { ws: EventWorkspace; field: TextDetail }) {
  const seriesId = ws.series.id;
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const [typed, setTyped] = useState(() => detailValue(ws, field));
  const changed = detailChanged(ws, field, typed);
  const problem = changed ? detailProblem(field, typed) : null;
  const save = () => {
    const command = detailCommand(ws, field, typed);
    if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
  };
  const props = {
    id: 'org-detail-input', value: typed, maxLength: MAX_LEN[field], 'data-testid': 'org-detail-input', 'aria-label': DETAIL_LABEL[field],
    onChange: (e: { target: { value: string } }) => setTyped(e.target.value),
  };
  return (
    <EventStepShell seriesId={seriesId} title={DETAIL_LABEL[field]} back={ORG_PATHS.eventDetails(seriesId)}>
      {conflict ? <EventConflict seriesId={seriesId} /> : (
        <>
          {field === 'about'
            ? <textarea {...props} rows={6} className={cn(FIELD_CLASS, 'min-h-[132px] py-[10px]')} />
            : <input {...props} type="text" inputMode={field === 'time' ? 'numeric' : field === 'tickets' || field === 'instagram' ? 'url' : 'text'}
                placeholder={field === 'time' ? '20:00' : field === 'music' ? 'Bachata, Kizomba' : undefined} className={cn(FIELD_CLASS, 'h-[48px]')} />}
          {problem && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-detail-problem">{problem}</p>}
          <SendButton label="Save" testId="org-detail-save" reason={!changed ? 'Nothing changed yet' : problem} busy={busy} onSend={save} />
          <StepError text={error} />
        </>
      )}
    </EventStepShell>
  );
}

function shown(ws: EventWorkspace, field: TextDetail): string {
  const v = detailValue(ws, field).trim();
  if (!v) return 'Add';
  return field === 'about' ? `${v.slice(0, 40)}${v.length > 40 ? '\u2026' : ''}` : v;
}

/** The rows; the venue row opens the event-truth editor sheet, unchanged (4.2). */
function DetailRows({ ws, today }: { ws: EventWorkspace; today: string }) {
  const seriesId = ws.series.id;
  const lock = eventLock(ws.series.lifecycle_status);
  const venues = useVenueOptions();
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const loaded = draftFromWorkspace(ws, today);
  const [draft, setDraft] = useState<EventDraft>(loaded);
  // The sheet's Done patches then closes in one tap: the close reads the patched draft from here.
  const latest = useRef<EventDraft>(loaded);
  const patch = (p: Partial<EventDraft>) => {
    latest.current = { ...latest.current, ...p };
    setDraft(latest.current);
  };
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const upcoming = upcomingDates(ws.dates, today);

  // C06: each picture is checked and uploaded now; the new list saves when the sheet closes.
  const onUploadGallery = (files: File[]) => {
    if (uploading) return;
    setUploading(true);
    setUploadError(null);
    void (async () => {
      try {
        for (const file of files) {
          const url = await uploadEventPicture(seriesId, file);
          patch({ gallery: [...latest.current.gallery, url] });
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : commandErrorMessage(err));
      } finally {
        setUploading(false);
      }
    })();
  };

  // The sheet closes: a new venue, gallery or video list is ONE series.upsert; an untouched sheet sends nothing.
  const onSheet = (next: SheetName | null) => {
    const closing = sheet;
    setSheet(next);
    if (next !== null || busy) return;
    if (closing === 'gallery' || closing === 'video') {
      const now = latest.current;
      const command = closing === 'gallery' ? mediaCommand(ws, 'default_gallery', now.gallery) : mediaCommand(ws, 'default_video_urls', now.videos);
      if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
      return;
    }
    const venueId = latest.current.venueId;
    if (!venueId || venueId === ws.series.default_venue_id) return;
    void (async () => {
      try {
        const city = venues.data?.find((v) => v.id === venueId)?.city_name ?? null;
        const cityId = city ? await resolveCreateCityId({ venueCityName: city, organiserCityId: null }) : null;
        await sendThenDone(ws.series.version, venueCommand(ws, venueId, cityId), { title: 'Saved', message: 'Saved' });
      } catch (err) {
        setCityError(commandErrorMessage(err));
      }
    })();
  };

  if (conflict) return <EventConflict seriesId={seriesId} />;
  // Gallery and videos open the editor's sheet (C06); a closed event shows them read only.
  const sheetRow = (label: string, value: string, open: SheetName, testId: string) => lock ? (
    <div key={testId} className={cn(ROW, 'text-[var(--mut)]')} data-testid={testId}>
      <span className="w-[88px] shrink-0 text-[14px]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{value === 'Add' ? 'None' : value}</span>
    </div>
  ) : (
    <button key={testId} type="button" data-testid={testId} className={ROW} onClick={() => setSheet(open)}>
      <span className="w-[88px] shrink-0 text-[14px] text-[var(--mut)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{value}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </button>
  );
  // The usual end (C14) and the price list (C09b): their own edit view on this route; the
  // price list a team set up is shown off with its reason (the server would refuse it).
  const extraRow = (field: 'ends' | 'prices', label: string, value: string, reason: string | null) => lock ? (
    <div key={field} className={cn(ROW, 'text-[var(--mut)]')} data-testid={`org-detail-${field}`}>
      <span className="w-[88px] shrink-0 text-[14px]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{value === 'Add' ? 'None' : value}</span>
    </div>
  ) : reason ? (
    <div key={field}>
      <a role="link" aria-disabled="true" data-testid={`org-detail-${field}`} className={cn(ROW, 'cursor-not-allowed text-[var(--mut)]')}>
        <span className="w-[88px] shrink-0 text-[14px]">{label}</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{value === 'Add' ? 'None' : value}</span>
      </a>
      <p className="px-[16px] pb-[10px] text-[13px] text-[var(--mut)]" data-testid={`org-detail-${field}-reason`}>{reason}</p>
    </div>
  ) : (
    <Link key={field} to={detailEditPath(seriesId, field)} data-testid={`org-detail-${field}`} className={ROW}>
      <span className="w-[88px] shrink-0 text-[14px] text-[var(--mut)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{value}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  );
  const row = (field: DetailField, value: string) => lock ? (
    <div key={field} className={cn(ROW, 'text-[var(--mut)]')} data-testid={`org-detail-${field}`}>
      <span className="w-[88px] shrink-0 text-[14px]">{DETAIL_LABEL[field]}</span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{value === 'Add' ? 'None' : value}</span>
    </div>
  ) : (
    <Link key={field} to={detailEditPath(seriesId, field)} data-testid={`org-detail-${field}`} className={ROW}
      onClick={field === 'venue' ? (e) => { e.preventDefault(); setSheet('venue'); } : undefined}>
      <span className="w-[88px] shrink-0 text-[14px] text-[var(--mut)]">{DETAIL_LABEL[field]}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{value}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  );

  return (
    <>
      <ClosedLines ws={ws} today={today} testId="org-detail" />
      <Card testId="org-detail-rows">
        {row('name', shown(ws, 'name'))}
        {row('venue', venueName(venues.data, ws.series.default_venue_id) ?? (ws.series.default_venue_id ? 'Venue' : 'Add'))}
        {row('time', shown(ws, 'time'))}
        {extraRow('ends', 'Ends', usualEnd(ws) || 'Add', null)}
        {(['level', 'music', 'tickets', 'instagram', 'about'] as TextDetail[]).map((f) => row(f, shown(ws, f)))}
        {extraRow('prices', 'Prices', countLabel(passCount(ws), 'price', 'prices'), pricesLock(ws))}
        {lock ? (
          <div className={cn(ROW, 'text-[var(--mut)]')} data-testid="org-detail-cover">
            <span className="w-[88px] shrink-0 text-[14px]">Cover</span>
            <span className="min-w-0 flex-1 truncate text-[15px]">{ws.series.default_cover_image_url ? 'Set' : 'None'}</span>
          </div>
        ) : (
          <Link to={ORG_PATHS.cover(seriesId)} data-testid="org-detail-cover" className={ROW}>
            <span className="w-[88px] shrink-0 text-[14px] text-[var(--mut)]">Cover</span>
            <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{ws.series.default_cover_image_url ? 'Change' : 'Add'}</span>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
          </Link>
        )}
        {sheetRow('Gallery', countLabel(draft.gallery.length, 'photo', 'photos'), 'gallery', 'org-detail-gallery')}
        {sheetRow('Videos', countLabel(draft.videos.length, 'video', 'videos'), 'video', 'org-detail-videos')}
      </Card>
      <StepError text={error ?? cityError} />
      <ScheduleCard seriesId={seriesId} next={firstListedDate(ws.dates, today)} today={today} upcoming={upcoming.length}
        pastCount={ws.dates.length - upcoming.length} closed={!!lock} />
      <EditorSheet sheet={sheet} onSheet={onSheet} draft={draft} patch={patch} today={today}
        cap={capInput(ws, draft, today)} venues={venues.data} venuesError={venues.isError} onRetryVenues={() => void venues.refetch()}
        venuesRetrying={venues.isFetching} onUploadGallery={onUploadGallery} uploading={uploading} uploadError={uploadError} />
    </>
  );
}

/**
 * /account/o/events/:seriesId/details (C37): name, venue, time, the usual end,
 * level, music, tickets, Instagram, about, prices, the cover (S7's screen, a
 * link), gallery and videos (the editor's sheets) and the line-up / sessions
 * row (the event-truth ScheduleCard). Each edit is ONE series.upsert with the
 * changed field (`?edit=` on this route), then Done.
 */
export default function Details() {
  const { seriesId = '' } = useParams();
  const [search] = useSearchParams();
  const home = useFlowHome();
  const ws = useEventWorkspace(seriesId);
  const today = home.data?.today ?? londonTodayKey();
  const field = readField(search.get(EDIT_PARAM));
  const extra = readExtra(search.get(EDIT_PARAM));

  if (field && ws.data && !eventLock(ws.data.series.lifecycle_status)) return <DetailEdit key={field} ws={ws.data} field={field} />;
  if (extra === 'ends' && ws.data && !eventLock(ws.data.series.lifecycle_status)) return <EndEdit ws={ws.data} />;
  if (extra === 'prices' && ws.data && !eventLock(ws.data.series.lifecycle_status) && !pricesLock(ws.data)) return <PricesEdit ws={ws.data} />;
  return (
    <OrganiserShell title={ws.data?.series.name ?? 'Details'} back={{ to: ORG_PATHS.event(seriesId), label: 'Back' }} testId="org-page-details">
      <div className="flex flex-col gap-3 p-3">
        {ws.isError && isAccessRefusal(ws.error) ? <NoAccess />
          : ws.isError ? <ErrorState onRetry={() => void ws.refetch()} retrying={ws.isFetching} testId="org-details-error" />
          : !ws.data ? <SkeletonRows count={6} label="Loading the details" testId="org-details-loading" />
            : <DetailRows key={ws.data.series.version} ws={ws.data} today={today} />}
      </div>
    </OrganiserShell>
  );
}
