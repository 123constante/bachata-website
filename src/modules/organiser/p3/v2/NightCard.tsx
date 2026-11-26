import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { dateDetailQueryKey, fetchDateDetail } from '../../shared/selfServeApi';
import { fullDate } from '../../shared/dateWords';
import { ownerPassesFromStored, upsertCommand } from '../../shared/seriesCommands';
import type { DateDetail, WorkspaceDate } from '../../shared/seriesModel';
import { useVenueOptions } from '../../shared/publicVenues';
import { londonTodayKey } from '@/lib/londonDate';
import { allItems } from '../../events/programmeSeriesModel';
import { localAsZTime } from '../../shared/homeModel';
import { seriesTree } from '../data/sessions';
import { V2 } from './copy';
import { nightFieldState, type WriteStep } from './editorModel';
import { Fact, aboutShort, priceLabel } from './Facts';
import { doorPriceOf } from './payMode';
import { WhenSheet, type OnSave } from './WhenSheet';
import { WhereSheet, savedLabel } from './WhereSheet';
import { AboutSheet } from './AboutSheet';
import { FlyerSheet } from './FlyerSheet';
import { dateGalleryOf, dateGalleryPatch } from '../data/dateFields';
import { venueOverridePatch } from '../../dates/venueOverride';
import { NightPriceSheet } from './PriceSheet';
import { NightCancelArea, type CancelResult } from './CancelNight';
import { DRAFT_PILL, DraftNote, isDraftEvent } from './GoLiveBar';
import { offStatusWord } from './EndCard';

/** The override keys each fact owns. A fact shows "Only this night" only when one of these is saved on the date. */
export const FACT_KEYS = {
  where: ['venue_id', 'city_id'],
  price: ['passes', 'ticket_url'],
  about: ['description'],
  flyer: ['cover_image_url'],
} as const;
type FactId = keyof typeof FACT_KEYS;

/** Which keys of this fact the date really owns (nothing is invented: an absent key never shows the tag). */
export const ownedKeys = (d: Pick<WorkspaceDate, 'override_keys'>, fact: FactId): string[] =>
  FACT_KEYS[fact].filter((k) => nightFieldState(k as never, d.override_keys, undefined) === 'changed');

const BEFORE_OF: Record<string, (x: DateDetail) => unknown> = {
  venue_id: (x) => x.venueOverride, description: (x) => x.descriptionOverride, cover_image_url: (x) => x.coverImageOverride,
  ticket_url: (x) => x.ticketUrlOverride, passes: (x) => x.passesOverride,
};

/** The step that puts a fact back to the usual value, and what it read before (for Undo). null before = no Undo. */
export function backToUsualStep(d: Pick<WorkspaceDate, 'id' | 'version' | 'override_keys'>, fact: FactId, detail: DateDetail | undefined, part: string): { step: WriteStep; before: Record<string, unknown> | null } | null {
  const keys = ownedKeys(d, fact);
  if (!keys.length) return null;
  const payload = Object.fromEntries(keys.map((k) => [k, null]));
  const before: Record<string, unknown> = {};
  let known = !!detail;
  for (const k of keys) { const f = BEFORE_OF[k]; if (detail && f) before[k] = f(detail); else known = false; }
  return {
    step: { part, target: 'occurrence', id: d.id, version: d.version, command: { kind: 'occurrence.set_override', payload }, order: 1 },
    before: known ? before : null,
  };
}

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export function NightCard({ ws, date, onBack, onSave, busy, onCancelNight, onBringBack, soldCount = 0, onOpenTickets, onChangeLink }: {
  /** one-off, link mode: opens the Link to buy tickets sheet */
  onChangeLink?: () => void;
  /** opens the Tickets screen; the shell passes it (no router in this component) */
  onOpenTickets?: () => void;
  ws: EventWorkspace; date: WorkspaceDate; busy?: boolean;
  /** cancel / bring back this night; the shell runs saveNow (no Undo) and returns the result */
  onCancelNight?: (reason: string) => Promise<CancelResult>; onBringBack?: () => Promise<CancelResult>;
  /** tickets sold on this night; slice 15 (money/tickets) supplies it */
  soldCount?: number;
  /** runs the Back to usual step; the shell owns saveNow and the toast */
  /** saves at once through saveNow (When sheet) */
  onSave?: OnSave;
  onBack: (step: WriteStep, before: Record<string, unknown> | null, label: string) => unknown;
}) {
  const qc = useQueryClient();
  const [whenOpen, setWhenOpen] = useState(false);
  const [sheet, setSheet] = useState<'where' | 'about' | 'flyer' | 'price' | null>(null);
  const s = ws.series;
  const detail = useQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
  const dt = detail.data;
  const venues = useVenueOptions();
  const venueId = dt?.venueId ?? s.default_venue_id;
  const venue = venues.data?.find((v) => v.id === venueId);
  const today = londonTodayKey();
  const long = fullDate(date.occurrence_date).replace(/ \d{4}$/, '');
  const dateWords = fullDate(date.occurrence_date, today);
  const cancelled = date.lifecycle_status === 'cancelled' || s.lifecycle_status === 'cancelled';
  const status = s.lifecycle_status === 'paused' ? 'paused' : (s.lifecycle_status === 'ended' || date.lifecycle_status === 'ended') ? 'ended' : 'live';
  const draft = isDraftEvent(ws);
  const offWord = offStatusWord(s.lifecycle_status);
  const pill = draft ? <span className="pill off" data-testid="draft-pill">{DRAFT_PILL}</span> : offWord ? <span className="pill off" data-testid="status-pill">{offWord}</span> : cancelled ? <span className="pill x">{V2.tagCancelled}</span>
    : <span className={status === 'live' ? 'pill' : 'pill off'}>{status === 'live' ? V2.statusLive : status === 'paused' ? V2.statusPaused : V2.statusEnded}</span>;
  const flyer = dt?.coverImageUrl ?? s.default_cover_image_url;
  // O-05: a one-off has no "usual" to go back to, so no "Only this night" tags and no "Back to usual" buttons
  const mine = s.format !== 'one_off';
  const own = { flyer: mine && ownedKeys(date, 'flyer').length > 0, where: mine && ownedKeys(date, 'where').length > 0, price: mine && ownedKeys(date, 'price').length > 0, about: mine && ownedKeys(date, 'about').length > 0 };
  const about = dt?.descriptionOverride ?? s.default_description;
  const passes = ownerPassesFromStored(dt?.passesOverride ?? s.passes) ?? [];
  const link = dt?.ticketUrl ?? s.default_ticket_url;
  const prices = passes.map((p) => p.price).filter((p): p is number => typeof p === 'number' && p > 0);
  const price = priceLabel({ link, doorPrice: !link && doorPriceOf(dt?.passesOverride ?? s.passes) != null ? String(doorPriceOf(dt?.passesOverride ?? s.passes)) : null, ticketCount: 0, minPrice: prices.length ? Math.min(...prices) : null });
  // No start time on the event: the night's own time, else its materialised time, else the first session.
  const firstSession = allItems(seriesTree(ws)).filter((it) => it.start).sort((a, b) => a.start.localeCompare(b.start))[0];
  const start = hm(dt?.start ?? localAsZTime(date.materialised_start_utc) ?? firstSession?.start);
  const end = hm(dt?.end ?? (dt?.start || date.materialised_start_utc ? null : firstSession?.end));
  const back = (fact: FactId, part: string) => async () => {
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    const b = backToUsualStep(date, fact, d, part);
    if (b) return onBack(b.step, b.before, V2.backToUsualFor(dateWords));
    return undefined;
  };
  const saveVenue = async (id: string) => {
    if (!onSave) return;
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    // The city follows the venue, sent the way the old editor sends it; the old pair is what Undo puts back.
    const patch = await venueOverridePatch(id === s.default_venue_id ? null : id, venues.data);
    const prev = await venueOverridePatch(d.venueOverride, venues.data);
    const step: WriteStep = { part: V2.venue, target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: patch }, order: 1 };
    const r = await onSave([step], [prev], savedLabel('night', dateWords));
    if (r.ok) setSheet(null);
  };
  const saveAbout = async (value: string | null) => {
    if (!onSave) return;
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    const step: WriteStep = { part: V2.nightAbout, target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: { description: value } }, order: 1 };
    const r = await onSave([step], [{ description: d.descriptionOverride }], savedLabel('night', dateWords));
    if (r.ok) setSheet(null);
  };
  // A failed save must not look saved: throw so the sheet shows its error line (FlyerSheet catches and renders it).
  const mustSave = async (steps: WriteStep[], before: Parameters<NonNullable<typeof onSave>>[1], label: string) => {
    const r = await onSave!(steps, before, label);
    if (!r.ok) throw new Error(r.error ?? 'Not saved. Try again.');
  };
  const saveFlyer = async (url: string | null, label: string) => {
    if (!onSave) return; // url null = REMOVE for this night: the server owns '' (no flyer), null would inherit
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    const step: WriteStep = { part: V2.flyer, target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: { cover_image_url: url ?? '' } }, order: 1 };
    // A one-off has no separate series flyer and the go-live check reads the series cover, so set both (else "A flyer is required" never clears).
    if (s.format === 'one_off') {
      const seriesStep: WriteStep = { part: V2.flyer, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', default_cover_image_url: url }), order: 2 };
      await mustSave([step, seriesStep], [{ cover_image_url: d.coverImageOverride }, { name: s.name ?? '', default_cover_image_url: s.default_cover_image_url ?? null }], label);
      return;
    }
    // Recurring with no series cover yet: the first night flyer also becomes the series cover, so go-live clears. An existing series cover is never overwritten, and removing a night flyer never clears it.
    if (url && !s.default_cover_image_url) {
      const seriesStep: WriteStep = { part: V2.flyer, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', default_cover_image_url: url }), order: 2 };
      await mustSave([step, seriesStep], [{ cover_image_url: d.coverImageOverride }, { name: s.name ?? '', default_cover_image_url: null }], label);
      return;
    }
    await mustSave([step], [{ cover_image_url: d.coverImageOverride }], label);
  };
  const saveGallery = async (next: string[], label: string) => {
    if (!onSave) return;
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    const patch = dateGalleryPatch(ws, d, next);
    if (!patch) return;
    const step: WriteStep = { part: V2.gallery, target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: patch }, order: 1 };
    await mustSave([step], [{ gallery: d.galleryOverride }], label);
  };
  return (
    <div className="grp" data-testid="night-card">
      <div className="lab">{s.format === 'one_off' ? V2.oneOff.label : V2.nightCardLabel}</div>
      <div className="card">
        <div className={flyer ? 'flyer f1' : 'flyer none'} style={flyer ? { backgroundImage: `linear-gradient(#00000033,#00000066), url(${flyer})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <span>{flyer ? V2.flyerWord : V2.noFlyer}{own.flyer ? V2.onlyThisNightFlyer : ''}</span>
          <button type="button" className="fpill" data-testid="fact-flyer" onClick={onSave ? () => setSheet('flyer') : undefined}>{V2.flyerAndPhotos}</button>
        </div>
        <div className="fb-list">
          <div className="trow"><b data-testid="night-name">{dt?.titleOverride ?? s.name}</b>{pill}</div>
          {draft && <DraftNote />}
          <Fact id="when" label={V2.when} main={long} sub={start ? V2.timeRange(start, end || start) : undefined} onOpen={onSave ? () => setWhenOpen(true) : undefined} />
          <Fact id="where" label={V2.where} main={venue?.name ?? '\u2014'} sub={venue?.neighbourhood ?? venue?.city_name ?? undefined}
            changed={own.where} busy={busy} onBack={back('where', V2.venue)} onOpen={onSave ? () => setSheet('where') : undefined} />
          <Fact id="price" label={V2.price} main={price.m} sub={price.s || undefined} changed={own.price} busy={busy} onBack={back('price', V2.price)} onOpen={onSave ? () => setSheet('price') : onOpenTickets} />
          <Fact id="about" label={V2.description} main={aboutShort(about)} changed={own.about} busy={busy} onBack={back('about', V2.nightAbout)} onOpen={onSave ? () => setSheet('about') : undefined} />
          {s.format === 'one_off' && onOpenTickets ? (
            <div className="fwrap" data-testid="row-goTickets">
              <button type="button" className="fbtn ln" onClick={() => onOpenTickets()}>
                <span className="lt">{V2.ticketsPay.rowLabel}</span>
                <span className="lv"><b>{V2.ticketsPay.rowSub}</b></span>
                <span className="fgo">&rsaquo;</span>
              </button>
            </div>
          ) : null}
          <NightCancelArea eventCancelled={s.lifecycle_status === 'cancelled'} nightCancelled={date.lifecycle_status === 'cancelled'}
            nightReason={dt?.cancellationReason} dateLong={long} soldCount={soldCount} busy={busy}
            onCancelNight={onCancelNight ?? (async () => ({ ok: false, error: null }))} onBringBack={onBringBack ?? (async () => ({ ok: false, error: null }))} />
        </div>
      </div>
      {sheet === 'where' && onSave && (
        <WhereSheet current={venueId ?? null} mode="night" dateWords={dateWords} changed={own.where}
          onSave={saveVenue} onBack={back('where', V2.venue)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'about' && onSave && (
        <AboutSheet current={about ?? ''} usual={s.default_description} mode="night" dateWords={dateWords} changed={own.about}
          onSave={saveAbout} onBack={back('about', V2.nightAbout)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'flyer' && onSave && (
        <FlyerSheet seriesId={s.id} flyer={flyer ?? null} gallery={dateGalleryOf(ws, dt ?? null) ?? []} mode="night" dateWords={dateWords}
          dayName={fullDate(date.occurrence_date).split(' ')[0]} changed={own.flyer}
          onFlyer={saveFlyer} onGallery={saveGallery} onBackToUsual={back('flyer', V2.flyer)} onClose={() => setSheet(null)} />
      )}
      {sheet === 'price' && onSave && (
        <NightPriceSheet ws={ws} date={date} detail={dt} weekly={s.format !== 'one_off'} long={fullDate(date.occurrence_date, today).replace(/ \d{4}$/, '')}
          day={fullDate(date.occurrence_date).split(' ')[0]} dateWords={dateWords} oneOff={s.format === 'one_off'} changed={own.price} onSave={onSave}
          onBack={back('price', V2.price)} onGoTickets={() => { setSheet(null); onOpenTickets?.(); }}
          onLink={() => { setSheet(null); onChangeLink?.(); }} onClose={() => setSheet(null)} />
      )}
      {whenOpen && onSave && <WhenSheet date={date} laterDates={ws.dates} eventName={s.name ?? undefined} oneOff={s.format === 'one_off'} today={today} onSave={onSave} onClose={() => setWhenOpen(false)} />}
    </div>
  );
}
