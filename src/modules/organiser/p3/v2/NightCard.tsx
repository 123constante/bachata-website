import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventWorkspace } from '../../events/eventModel';
import { dateDetailQueryKey, fetchDateDetail } from '../../shared/selfServeApi';
import { fullDate } from '../../shared/dateWords';
import { ownerPassesFromStored } from '../../shared/seriesCommands';
import type { DateDetail, WorkspaceDate } from '../../shared/seriesModel';
import { useVenueOptions } from '../../shared/publicVenues';
import { londonTodayKey } from '@/lib/londonDate';
import { V2 } from './copy';
import { nightFieldState, type WriteStep } from './editorModel';
import { Fact, aboutShort, priceLabel } from './Facts';
import { NightCancelArea, type CancelResult } from './CancelNight';

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

export function NightCard({ ws, date, onBack, busy, onCancelNight, onBringBack, soldCount = 0 }: {
  ws: EventWorkspace; date: WorkspaceDate; busy?: boolean;
  /** cancel / bring back this night; the shell runs saveNow (no Undo) and returns the result */
  onCancelNight?: (reason: string) => Promise<CancelResult>; onBringBack?: () => Promise<CancelResult>;
  /** tickets sold on this night; slice 15 (money/tickets) supplies it */
  soldCount?: number;
  /** runs the Back to usual step; the shell owns saveNow and the toast */
  onBack: (step: WriteStep, before: Record<string, unknown> | null, label: string) => void;
}) {
  const qc = useQueryClient();
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
  const pill = cancelled ? <span className="pill x">{V2.tagCancelled}</span>
    : <span className={status === 'live' ? 'pill' : 'pill off'}>{status === 'live' ? V2.statusLive : status === 'paused' ? V2.statusPaused : V2.statusEnded}</span>;
  const flyer = dt?.coverImageUrl ?? s.default_cover_image_url;
  const own = { flyer: ownedKeys(date, 'flyer').length > 0, where: ownedKeys(date, 'where').length > 0, price: ownedKeys(date, 'price').length > 0, about: ownedKeys(date, 'about').length > 0 };
  const about = dt?.descriptionOverride ?? s.default_description;
  const passes = ownerPassesFromStored(dt?.passesOverride ?? s.passes) ?? [];
  const link = dt?.ticketUrl ?? s.default_ticket_url;
  const prices = passes.map((p) => p.price).filter((p): p is number => typeof p === 'number' && p > 0);
  const price = priceLabel({ link, ticketCount: link ? 0 : 0, minPrice: prices.length ? Math.min(...prices) : null });
  const start = hm(dt?.start ?? s.default_local_start_time);
  const end = hm(dt?.end);
  const back = (fact: FactId, part: string) => async () => {
    const d = dt ?? await qc.fetchQuery({ queryKey: dateDetailQueryKey(date.id), queryFn: () => fetchDateDetail(date.id) });
    const b = backToUsualStep(date, fact, d, part);
    if (b) onBack(b.step, b.before, V2.backToUsualFor(dateWords));
  };
  return (
    <div className="grp" data-testid="night-card">
      <div className="lab">{V2.nightCardLabel}</div>
      <div className="card">
        <div className={flyer ? 'flyer f1' : 'flyer none'} style={flyer ? { backgroundImage: `linear-gradient(#00000033,#00000066), url(${flyer})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <span>{flyer ? V2.flyerWord : V2.noFlyer}{own.flyer ? V2.onlyThisNightFlyer : ''}</span>
          <button type="button" className="fpill" data-testid="fact-flyer">{V2.flyerAndPhotos}</button>
        </div>
        <div className="fb-list">
          <div className="trow"><b data-testid="night-name">{dt?.titleOverride ?? s.name}</b>{pill}</div>
          <Fact id="when" label={V2.when} main={long} sub={start ? V2.timeRange(start, end || start) : undefined} />
          <Fact id="where" label={V2.where} main={venue?.name ?? '—'} sub={venue?.neighbourhood ?? venue?.city_name ?? undefined}
            changed={own.where} busy={busy} onBack={back('where', V2.venue)} />
          <Fact id="price" label={V2.price} main={price.m} sub={price.s || undefined} changed={own.price} busy={busy} onBack={back('price', V2.price)} />
          <Fact id="about" label={V2.description} main={aboutShort(about)} changed={own.about} busy={busy} onBack={back('about', V2.nightAbout)} />
          <NightCancelArea eventCancelled={s.lifecycle_status === 'cancelled'} nightCancelled={date.lifecycle_status === 'cancelled'}
            nightReason={dt?.cancellationReason} dateLong={long} soldCount={soldCount} busy={busy}
            onCancelNight={onCancelNight ?? (async () => ({ ok: false, error: null }))} onBringBack={onBringBack ?? (async () => ({ ok: false, error: null }))} />
        </div>
      </div>
    </div>
  );
}
