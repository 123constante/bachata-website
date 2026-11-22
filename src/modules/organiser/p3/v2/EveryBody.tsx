import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { fetchOrganiserPages } from '../../events/programmeSeriesApi';
import { fullDate } from '../../shared/dateWords';
import { useVenueOptions } from '../../shared/publicVenues';
import { venueOverridePatch } from '../../dates/venueOverride';
import { durationMinutes } from '../../shared/seriesModel';
import { upsertCommand } from '../../shared/seriesCommands';
import { V2 } from './copy';
import type { WriteStep } from './editorModel';
import { Fact, aboutShort, priceLabel } from './Facts';
import { ProgSheet, type OnSave } from './WhenSheet';
import { SessionSheetV2 } from './SessionSheetV2';
import { addSession, allItems, buildDays, programCommand, profileTypeOf, removeSession, updateItem, validateTree, type PItem, type PTree } from '../../events/programmeSeriesModel';
import { seriesTree } from '../data/sessions';
import { isEditableRole, sessionLevels, type DraftSession, type PeopleRole } from '../../shared/programmeModel';
import { WhereSheet, savedLabel } from './WhereSheet';
import { AboutSheet } from './AboutSheet';
import { FlyerSheet } from './FlyerSheet';
import { NameSheet } from './NameSheet';
import { MusicSheet } from './MusicSheet';
import { OrgSheet } from './OrgSheet';
import { RepeatSheetV2, type LostNight } from './RepeatSheetV2';
import { dayChangeCommand } from '../../events/eventModel';
import { WEEKDAY_NAMES } from '../../shared/dateWords';
import { DATE_TAG_WORD, dateTagOf } from './editorModel';
import type { OwnerCommand } from '../../shared/seriesCommands';
import { londonTodayKey, weekdayOfKey } from '@/lib/londonDate';
import { ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { ownerPassesFromStored, lifecycleCommand } from '../../shared/seriesCommands';
import { endRunCommand, tonightDate } from '../../events/eventModel';
import { EndCard, type LifeState } from './EndCard';
import { StatusSheet, CancelEventSheetV2, type TodayAnswer } from './StatusSheets';
import { cancelCommand, uncancelCommand } from '../../shared/seriesCommands';
import { upcomingOf } from './editorModel';
import { dateDetailQueryKey, fetchDateDetail } from '../../shared/selfServeApi';

const E = V2.every;

/** One raised one-line row (prototype factLn): label left, bold value (one line, ellipsis), a chevron. Tap does nothing when `onOpen` is absent (pending slice). */
function Line({ id, label, value, onOpen }: { id: string; label: string; value: ReactNode; onOpen?: () => void }) {
  return (
    <div className="fwrap" data-testid={`row-${id}`}>
      <button type="button" className="fbtn ln" onClick={() => onOpen?.()}>
        <span className="lt">{label}</span>
        <span className="lv"><b>{value}</b></span>
        <span className="fgo">&rsaquo;</span>
      </button>
    </div>
  );
}

type SeriesBits = { default_city_id?: string | null; default_cover_image_url: string | null };

/**
 * The "Every <day>" tab (flag organiserEditorV2): what dancers see every <day>, then the About group. Every write is
 * a series.upsert carrying `name`. Music / Organisers / Repeats / When / Price taps are PENDING later slices.
 */
export function EveryBody({ ws, day, saveNow, busy, onOpenTickets }: { ws: EventWorkspace; day: string; saveNow: OnSave; busy?: boolean; onOpenTickets?: () => void }) {
  const s = ws.series;
  const [sheet, setSheet] = useState<'where' | 'about' | 'flyer' | 'name' | 'music' | 'orgs' | 'repeats' | 'pause' | 'end' | 'cancel' | 'prog' | null>(null);
  const [editing, setEditing] = useState<{ row: DraftSession | null } | null>(null);
  const [progProblem, setProgProblem] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const venues = useVenueOptions();
  const orgIds = ws.organiserIds ?? [];
  const pages = useQuery({ queryKey: ['org-organiser-pages', ...orgIds], queryFn: () => fetchOrganiserPages(orgIds), enabled: orgIds.length > 0 });
  const venue = venues.data?.find((v) => v.id === s.default_venue_id);
  const label = savedLabel('usual', day);
  const comingNights = upcomingOf(ws.dates ?? [], londonTodayKey());
  const allNightsCancelled = comingNights.length > 0 && comingNights.every((x) => x.lifecycle_status === 'cancelled');
  const cancelled = s.lifecycle_status === 'cancelled' || allNightsCancelled;
  const firstCancelled = allNightsCancelled ? comingNights[0] : null;
  const reasonQ = useQuery({ queryKey: dateDetailQueryKey(firstCancelled?.id ?? ''), queryFn: () => fetchDateDetail(firstCancelled!.id), enabled: !!firstCancelled });
  const status = s.lifecycle_status === 'paused' ? 'paused' : s.lifecycle_status === 'ended' ? 'ended' : 'live';
  const pill = cancelled ? <span className="pill x">{V2.tagCancelled}</span>
    : <span className={status === 'live' ? 'pill' : 'pill off'}>{status === 'live' ? V2.statusLive : status === 'paused' ? V2.statusPaused : V2.statusEnded}</span>;
  const flyer = s.default_cover_image_url;
  const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');
  const start = hm(s.default_local_start_time);
  const mins = durationMinutes(s.default_duration);
  const endAt = start && mins ? (() => { const t = (Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + mins) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })() : '';
  const passes = ownerPassesFromStored(s.passes) ?? [];
  const link = s.default_ticket_url;
  const prices = passes.map((p) => p.price).filter((p): p is number => typeof p === 'number' && p > 0);
  const price = priceLabel({ link, ticketCount: 0, minPrice: prices.length ? Math.min(...prices) : null });
  const name = s.name ?? '';
  const music = (ws.musicStyles ?? []).length ? ws.musicStyles.join(', ') : E.noneYet;
  const repeats = ws.endedOn ? E.repeatsEnds(day, fullDate(ws.endedOn, londonTodayKey())) : E.repeatsNoEnd(day);
  const orgs = orgIds.length === 0 ? E.noneYet : pages.data?.length ? pages.data.map((p) => p.name).join(', ') : E.organisersN(orgIds.length);

  const send = async (part: string, payload: Record<string, unknown>, before: Record<string, unknown>) => {
    const step: WriteStep = { part, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', ...payload }), order: 1 };
    const r = await saveNow([step], [{ name: s.name ?? '', ...before }], label);
    if (r.ok) setSheet(null);
    return r;
  };
  const saveVenue = async (id: string) => {
    const patch = await venueOverridePatch(id, venues.data);
    const city = patch.city_id;
    const oldCity = (s as unknown as SeriesBits).default_city_id ?? null;
    await send(V2.venue, { default_venue_id: id, ...(city ? { default_city_id: city } : {}) }, { default_venue_id: s.default_venue_id, ...(city ? { default_city_id: oldCity } : {}) });
  };
  const saveAbout = async (value: string | null) => { await send(V2.nightAbout, { default_description: value }, { default_description: s.default_description ?? null }); };
  const saveName = async (v: string) => { await send(E.name, { name: v }, {}); };
  const saveMusic = async (styles: string[]) => { await send(E.music, { default_music_styles: styles }, { default_music_styles: ws.musicStyles ?? [] }); };
  const saveOrgs = async (command: OwnerCommand, _ids: string[]) => {
    const step: WriteStep = { part: E.organisers, target: 'series', id: s.id, version: s.version, command, order: 1 };
    const r = await saveNow([step], [{ organiser_ids: ws.organiserIds }], label);
    if (r.ok) setSheet(null);
  };
  const ruleDay = (() => { const w = ownerWeeklyRule(s)?.weekdays[0]; return typeof w === 'number' ? w : Math.max(0, WEEKDAY_NAMES.indexOf(day)); })();
  /** Upcoming nights with their own changes (cancelled / changed) that the new day + end would stop producing. */
  const lostFor = (wd: number, end: string | null): LostNight[] => {
    const today = londonTodayKey();
    return (ws.dates ?? [])
      .filter((x) => x.occurrence_date >= today && (wd !== weekdayOfKey(x.occurrence_date) || (end !== null && x.occurrence_date > end)))
      .flatMap((x) => { const t = dateTagOf(x, s.lifecycle_status ?? ''); return t === 'cancelled' || t === 'changed' ? [{ id: x.id, date: x.occurrence_date, word: DATE_TAG_WORD[t] }] : []; })
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  const saveRepeat = async (wd: number, end: string | null) => {
    const base = dayChangeCommand(s.recurrence_rule, wd);
    const command = { ...base, payload: { ...base.payload, end: end ? { kind: 'until_date', date: end } : { kind: 'none' } } };
    const step: WriteStep = { part: E.repeats, target: 'series', id: s.id, version: s.version, command, order: 1 };
    const old = s.recurrence_rule && typeof s.recurrence_rule === 'object' ? { ...(s.recurrence_rule as Record<string, unknown>) } : {};
    const r = await saveNow([step], [old], 'Saved');
    if (r.ok) setSheet(null);
  };
  const progTree = seriesTree(ws);
  const progRows: DraftSession[] = allItems(progTree).map((it) => ({
    key: it.key, original: it.raw as unknown as DraftSession['original'], type: it.type, title: it.title, start: it.start, end: it.end, levels: it.levels, removed: false,
    people: it.people.map((p) => ({ id: p.profileId, name: p.name, role: p.role, origin: 'stored' as const, removed: false })),
  }));
  const SECTION: Record<string, string> = { class: 'classes', masterclass: 'masterclass', party: 'party', performance: 'showcase' };
  /** Usual-week programme: one series.set_program with the whole programme; Undo puts the old days back. */
  const saveProg = async (next: PTree, label2: string): Promise<boolean> => {
    const bad = validateTree(next, progTree)[0];
    if (bad) { setProgProblem(bad.message); return false; }
    const command = programCommand(next, progTree);
    if (!command) return false;
    const step: WriteStep = { part: V2.nightSessions, target: 'series', id: s.id, version: s.version, command, order: 1 };
    const r = await saveNow([step], [{ days: buildDays(progTree) }], label2);
    setProgProblem(r.ok ? null : r.error);
    return r.ok;
  };
  const progDone = (row: DraftSession) => {
    setEditing(null);
    const peopleOf = (it: PItem | null, list: DraftSession['people']): PItem['people'] => {
      const all = list ?? [];
      const kept = (it?.people ?? []).filter((p) => !all.some((q) => q.id === p.profileId && q.origin === 'stored' && q.removed));
      const added = all.filter((p) => p.origin === 'added' && !p.removed && isEditableRole(p.role))
        .map((p) => ({ profileId: p.id, name: p.name, profileType: profileTypeOf(p.role as PeopleRole), role: p.role, level: null }));
      return [...kept, ...added] as PItem['people'];
    };
    const fields = (it: PItem) => ({ type: row.type, title: row.title, start: row.start, end: row.end, levels: sessionLevels({ type: row.type, levels: row.levels }), people: peopleOf(it, row.people) });
    const stored = allItems(progTree).find((i) => i.key === row.key);
    if (stored) { void saveProg(updateItem(progTree, stored.key, fields(stored)), label); return; }
    const type = row.type ?? 'class';
    const added = addSession(progTree, SECTION[type] ?? 'party', type);
    const it = allItems(added.tree).find((i) => i.key === added.key)!;
    void saveProg(updateItem(added.tree, added.key, fields(it)), label);
  };
  const progRemove = (row: DraftSession) => {
    setEditing(null);
    if (!row.original) return;
    void saveProg(removeSession(progTree, row.key), label).then((ok) => { if (ok) setSheet(null); });
  };
  const life: LifeState = cancelled ? 'Cancelled' : status === 'paused' ? 'Paused' : status === 'ended' ? 'Ended' : 'Live';
  const nightStep = (d: { id: string; version: number }, command: OwnerCommand): WriteStep => ({ part: E.toastCancelled, target: 'occurrence', id: d.id, version: d.version, command, order: 1 });
  /** Cancel the event: one occurrence.cancel per coming night that is not already cancelled; one save, no Undo. */
  const cancelEventDo = async (reason: string) => {
    setStatusError(null);
    const steps = comingNights.filter((x) => x.lifecycle_status !== 'cancelled').map((x) => nightStep(x, cancelCommand(reason)));
    const r = await saveNow(steps, [], E.toastCancelled, { noUndo: true });
    if (r.ok) setSheet(null); else setStatusError(r.error ?? 'Not saved. Try again.');
  };
  /** Make it live again when every coming night is cancelled: uncancel each one; Undo when inverseOf supports it. */
  const liveAgain = async () => {
    const nights = comingNights.filter((x) => x.lifecycle_status === 'cancelled');
    if (!allNightsCancelled || s.lifecycle_status === 'cancelled' || !nights.length) { void setLife('live', E.toastLive); return; }
    const reason = reasonQ.data?.cancellationReason ?? '';
    await saveNow(nights.map((x) => nightStep(x, uncancelCommand())), nights.map(() => ({ cancelled: true, reason })), E.toastLive);
  };
  const setLife = async (to: 'paused' | 'live', toast: string) => {
    const step: WriteStep = { part: toast, target: 'series', id: s.id, version: s.version, command: lifecycleCommand(to), order: 1 };
    const r = await saveNow([step], [{ to: s.lifecycle_status ?? 'live' }], toast);
    if (r.ok) setSheet(null); else setStatusError(r.error);
  };
  /** End: a later last night only sets the end date (status stays Live); otherwise series.end_run. */
  const endDo = async (last: string, today: TodayAnswer | null) => {
    const t = londonTodayKey();
    setStatusError(null);
    if (last && last < t) { setStatusError(V2.lastDatePast); return; }
    if (last && weekdayOfKey(last) !== ruleDay) { setStatusError(V2.lastDateWeekday(WEEKDAY_NAMES[ruleDay])); return; }
    const first = (ws.dates ?? []).map((x) => x.occurrence_date).filter((d) => d >= t).sort()[0];
    if (last && first && last >= first) {
      const base = dayChangeCommand(s.recurrence_rule, ruleDay);
      const command = { ...base, payload: { ...base.payload, end: { kind: 'until_date', date: last } } };
      const step: WriteStep = { part: E.repeats, target: 'series', id: s.id, version: s.version, command, order: 1 };
      const old = s.recurrence_rule && typeof s.recurrence_rule === 'object' ? { ...(s.recurrence_rule as Record<string, unknown>) } : {};
      const r = await saveNow([step], [old], E.toastEndsAfter(fullDate(last, t)));
      if (r.ok) setSheet(null); else setStatusError(r.error);
      return;
    }
    const step: WriteStep = { part: E.toastEnded, target: 'series', id: s.id, version: s.version, command: endRunCommand(today), order: 1 };
    const r = await saveNow([step], [{ to: s.lifecycle_status ?? 'live' }], E.toastEnded);
    if (r.ok) setSheet(null); else setStatusError(r.error);
  };
  const saveFlyer = async (url: string | null, lab: string) => {
    const step: WriteStep = { part: V2.flyer, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', default_cover_image_url: url }), order: 1 };
    await saveNow([step], [{ name: s.name ?? '', default_cover_image_url: flyer ?? null }], lab);
  };
  const saveGallery = async (next: string[], lab: string) => {
    const step: WriteStep = { part: V2.gallery, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', default_gallery: next }), order: 1 };
    await saveNow([step], [{ name: s.name ?? '', default_gallery: ws.gallery ?? [] }], lab);
  };

  return (
    <>
      <div className="grp" data-testid="every-card">
        <div className="lab">{E.label(day)}</div>
        <div className="card">
          <div className={flyer ? 'flyer f1' : 'flyer none'} style={flyer ? { backgroundImage: `linear-gradient(#00000033,#00000066), url(${flyer})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            <span>{flyer ? V2.flyerWord : V2.noFlyer}</span>
            <button type="button" className="fpill" data-testid="fact-flyer" onClick={() => setSheet('flyer')}>{V2.flyerAndPhotos}</button>
          </div>
          <div className="fb-list">
            <div className="trow"><b data-testid="every-name">{name}</b>{pill}</div>
            <Fact id="when" label={V2.when} main={E.everyDay(day)} sub={start ? (endAt ? E.timeRange(start, endAt) : start) : undefined} onOpen={() => { setProgProblem(null); setSheet('prog'); }} />
            <Fact id="where" label={V2.where} main={venue?.name ?? '—'} sub={venue?.neighbourhood ?? venue?.city_name ?? undefined} busy={busy} onOpen={() => setSheet('where')} />
            <Fact id="price" label={V2.price} main={price.m} sub={price.s || undefined} onOpen={onOpenTickets} />
          </div>
        </div>
      </div>
      <div className="grp" data-testid="every-about">
        <div className="lab hd">{E.aboutHead}</div>
        <div className="card"><div className="fb-list">
          <Line id="name" label={E.name} value={name} onOpen={() => setSheet('name')} />
          <Line id="about" label={V2.description} value={aboutShort(s.default_description)} onOpen={() => setSheet('about')} />
          <Line id="music" label={E.music} value={music} onOpen={() => setSheet('music')} />
          <Line id="repeats" label={E.repeats} value={repeats} onOpen={() => setSheet('repeats')} />
          <Line id="organisers" label={E.organisers} value={orgs} onOpen={() => setSheet('orgs')} />
        </div></div>
      </div>
      <EndCard status={life} endDate={ws.endedOn ? fullDate(ws.endedOn, londonTodayKey()) : null} reason={cancelled ? (reasonQ.data?.cancellationReason ?? null) : null}
        onLive={() => void liveAgain()} onCancel={() => { setStatusError(null); setSheet('cancel'); }} onPause={() => { setStatusError(null); setSheet('pause'); }} onEnd={() => { setStatusError(null); setSheet('end'); }} />
      {sheet === 'prog' && (
        <ProgSheet rows={progRows} oneOff={false} onOpenSession={(r) => setEditing({ row: r })} onClose={() => { setSheet(null); setEditing(null); }} />
      )}
      {sheet === 'prog' && progProblem && <p className="err" role="alert" data-testid="prog-problem">{progProblem}</p>}
      {sheet === 'prog' && editing && (
        <SessionSheetV2 row={editing.row} count={progRows.length} ctx="usual" dayLabel={day} onDone={progDone} onRemove={progRemove} onClose={() => setEditing(null)} />
      )}
      {sheet === 'pause' && <StatusSheet to="Paused" from={life} lastNight="" tonight={false} error={statusError} onDo={() => setLife('paused', E.toastPaused)} onClose={() => setSheet(null)} />}
      {sheet === 'cancel' && <CancelEventSheetV2 soldCount={0} error={statusError} onCancel={cancelEventDo} onClose={() => setSheet(null)} />}
      {sheet === 'end' && <StatusSheet to="Ended" from={life} lastNight={ws.endedOn ?? ''} tonight={!!tonightDate(ws, londonTodayKey())} error={statusError} onDo={endDo} onClose={() => setSheet(null)} />}
      {sheet === 'where' && <WhereSheet mode="usual" dateWords={day} current={s.default_venue_id ?? null} onSave={saveVenue} onClose={() => setSheet(null)} />}
      {sheet === 'about' && <AboutSheet mode="usual" dateWords={day} current={s.default_description ?? ''} usual={s.default_description} onSave={saveAbout} onClose={() => setSheet(null)} />}
      {sheet === 'name' && <NameSheet current={name} day={day} onSave={saveName} onClose={() => setSheet(null)} />}
      {sheet === 'music' && <MusicSheet current={ws.musicStyles ?? []} onSave={saveMusic} onClose={() => setSheet(null)} />}
      {sheet === 'orgs' && <OrgSheet stored={orgIds} names={Object.fromEntries((pages.data ?? []).map((p) => [p.id, p.name]))} seriesId={s.id} lifecycle={s.lifecycle_status ?? ''} onSave={saveOrgs} onClose={() => setSheet(null)} />}
      {sheet === 'repeats' && <RepeatSheetV2 day={ruleDay} endedOn={ws.endedOn ?? null} startDate={s.default_start_date ?? s.created_at?.slice(0, 10) ?? londonTodayKey()} today={londonTodayKey()} lostFor={lostFor} onSave={saveRepeat} onClose={() => setSheet(null)} />}
      {sheet === 'flyer' && <FlyerSheet mode="usual" dateWords={day} seriesId={s.id} flyer={flyer ?? null} gallery={ws.gallery ?? []} dayName={day} onFlyer={saveFlyer} onGallery={saveGallery} onClose={() => setSheet(null)} />}
    </>
  );
}
