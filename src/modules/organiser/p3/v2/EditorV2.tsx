import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { EventWorkspace } from '../../events/eventModel';
import { weekdayName } from '../../events/eventModel';
import { fullDate, MONTH_NAMES, WEEKDAY_NAMES } from '../../shared/dateWords';
import { londonTodayKey, weekdayOfKey } from '@/lib/londonDate';
import { P3_PATHS } from '../shell/paths';
import { DATE_TAG_WORD, UPCOMING_PAGE, dateTagOf, upcomingOf } from './editorModel';
import { V2Toast, type V2ToastState } from './V2Toast';
import { useSaveNow } from './saveNow';
import { NightCard } from './NightCard';
import { DatesSheet } from './DatesSheet';
import { LinkSheet } from './PaySheets';
import { cancelCommand, upsertCommand, cancelOneOffCommand, uncancelCommand, type OwnerCommand } from '../../shared/seriesCommands';
import { V2 } from './copy';
import type { WriteStep } from './editorModel';
import { EveryBody } from './EveryBody';
import { NightHub } from './NightHub';
import { publicEventRefOf } from '../data/home';
import type { Night as RaffleNightRow } from '../events/eventsModel';
import './v2.css';

type Tab = 'night' | 'every';

/** "26 Nov" for a chip's second line. */
const dayMonth = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
};

/**
 * Editor v2 page frame (flag organiserEditorV2): back link, tabs, date chips (weekly only), title, scope line and
 * a slot per tab that later slices fill. The picked night lives in `?night=`, the tab in `?tab=every`.
 */
export function EditorV2({ ws }: { ws: EventWorkspace }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const openTickets = () => navigate(`${P3_PATHS.event(ws.series.id)}/tickets`);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const { saveNow, toast, onToastDone, busy } = useSaveNow(ws.series.id, ws.series.version);
  const today = londonTodayKey();
  const weekly = ws.series.format !== 'one_off';
  const coming = upcomingOf(ws.dates, today);
  const chips = coming.slice(0, UPCOMING_PAGE);
  const nightId = params.get('night');
  const picked = (nightId && coming.find((d) => d.id === nightId)) || coming[0] || ws.dates[0] || null;
  const tab: Tab = weekly && params.get('tab') === 'every' ? 'every' : 'night';
  const day = weekly
    ? (picked ? weekdayName(picked.occurrence_date) : WEEKDAY_NAMES[weekdayOfKey(today)])
    : '';

  const setTab = (t: Tab) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (t === 'every') n.set('tab', 'every'); else n.delete('tab');
    return n;
  }, { replace: true, preventScrollReset: true });
  const pickNight = (id: string) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('night', id);
    return n;
  }, { replace: true, preventScrollReset: true });

  const pickFromSheet = (id: string) => {
    setDatesOpen(false);
    setParams((p) => { const n = new URLSearchParams(p); n.set('night', id); n.delete('tab'); return n; }, { replace: true, preventScrollReset: true });
    window.scrollTo?.({ top: 0 });
  };
  const every = tab === 'every';
  /** tap 55: weekly goes to the "Every <day>" tab first, so coming back lands there; then the Tickets screen */
  const goTickets = () => { if (weekly) setTab('every'); openTickets(); };
  const saveLink = async (url: string) => {
    const old = ws.series.default_ticket_url ?? null;
    const step: WriteStep = { part: V2.ticketsPay.toastLink, target: 'series', id: ws.series.id, version: ws.series.version, command: upsertCommand({ name: ws.series.name ?? '', default_ticket_url: url }), order: 1 };
    setLinkError(null);
    const r = await saveNow([step], [{ name: ws.series.name ?? '', default_ticket_url: old }], V2.ticketsPay.toastLink);
    if (r.ok) setLinkOpen(false); else setLinkError(r.error ?? V2.ticketsPay.notSaved);
  };
  const title = every ? `Every ${day}` : (picked ? fullDate(picked.occurrence_date).replace(/ \d{4}$/, '') : (ws.series.name ?? ''));
  const scope = every
    ? `Changes here are for every ${day}. A night you changed on its own keeps its change.`
    : 'Changes here are for this night only.';

  // cancel / bring back run at once with no Undo (prototype); a one-off cancels through series.cancel_one_off
  const nightStep = (d: { id: string; version: number }, command: OwnerCommand, series: boolean): WriteStep => (series
    ? { part: V2.cancelNight, target: 'series', id: ws.series.id, version: null, command, order: 1 }
    : { part: V2.cancelNight, target: 'occurrence', id: d.id, version: d.version, command, order: 1 });
  const cancelNight = (reason: string) => saveNow([nightStep(picked!, ws.series.format === 'one_off' ? cancelOneOffCommand(reason) : cancelCommand(reason), ws.series.format === 'one_off')], [], V2.cancelledToast(title), { noUndo: true });
  const [plain, setPlain] = useState<V2ToastState | null>(null);
  const say = (text: string) => setPlain((p) => ({ seq: (p?.seq ?? 0) + 1, text }));
  const ref = publicEventRefOf(ws.series);
  const shareLink = picked && ref && typeof window !== 'undefined'
    ? `${window.location.origin}/event/${encodeURIComponent(ref)}${weekly ? `?occurrenceId=${picked.id}` : ''}` : null;
  const bringBack = () => saveNow([nightStep(picked!, uncancelCommand(), false)], [], V2.broughtBackToast(title), { noUndo: true });

  return (
    <div className="ev2 ev2-page v2-page" data-testid="ev2-page">
      <Link to={P3_PATHS.events} className="ev2-back" data-testid="ev2-back">&larr; Events</Link>
      {weekly && (
        <div className="ev2-tabs" role="tablist" aria-label="What you are changing">
          <button type="button" role="tab" aria-selected={!every} className="ev2-tab" data-testid="ev2-tab-night" onClick={() => setTab('night')}>This night</button>
          <button type="button" role="tab" aria-selected={every} className="ev2-tab" data-testid="ev2-tab-every" onClick={() => setTab('every')}>Every {day}</button>
        </div>
      )}
      {weekly && !every && (
        <div className="ev2-chips" data-testid="ev2-chips">
          {chips.map((d) => {
            const tag = dateTagOf(d, ws.series.lifecycle_status);
            const word = tag === 'cancelled' || tag === 'changed' ? DATE_TAG_WORD[tag] : null;
            const on = picked?.id === d.id;
            return (
              <button key={d.id} type="button" className={on ? 'ev2-chip ev2-chip-on' : 'ev2-chip'} aria-pressed={on} data-testid="ev2-chip" onClick={() => pickNight(d.id)}>
                <span className="ev2-chip-a">{WEEKDAY_NAMES[weekdayOfKey(d.occurrence_date)].slice(0, 3)}</span>
                <span className="ev2-chip-b">{dayMonth(d.occurrence_date)}</span>
                {word && <span className={`ev2-chip-tag ev2-chip-tag-${tag}`}>{word}</span>}
              </button>
            );
          })}
          <button type="button" className="ev2-chip ev2-chip-more" data-testid="ev2-more-dates" onClick={() => setDatesOpen(true)}>
            <span className="ev2-chip-b">More dates</span>
          </button>
        </div>
      )}
      <h1 className="ev2-title" data-testid="ev2-title">{title}</h1>
      <p className="ev2-scope" data-testid="ev2-scope">{scope}</p>
      <div data-ev2-slot={every ? 'every' : 'night'}>
        {!every && picked && (
          <NightCard onOpenTickets={goTickets} onChangeLink={() => { setLinkError(null); setLinkOpen(true); }} ws={ws} date={picked} busy={busy} onCancelNight={cancelNight} onBringBack={bringBack} onSave={saveNow} onBack={(step, before, label) => { void saveNow([step], [before], label); }} />
        )}
        {!every && picked && (
          <NightHub seriesId={ws.series.id} seriesName={ws.series.name ?? ''} occurrenceId={picked.id} oneOff={!weekly} shareLink={shareLink} toast={say}
            raffleNight={{ seriesId: ws.series.id, date: picked.occurrence_date, dayLabel: fullDate(picked.occurrence_date) } as unknown as RaffleNightRow} />
        )}
        {every && <EveryBody onOpenTickets={openTickets} ws={ws} day={day} saveNow={saveNow} busy={busy} />}
      </div>
      {linkOpen && <LinkSheet link={ws.series.default_ticket_url ?? ''} busy={busy} error={linkError} onDone={(u) => { void saveLink(u); }} onClose={() => setLinkOpen(false)} />}
      <DatesSheet open={datesOpen} dates={coming} seriesStatus={ws.series.lifecycle_status} onPick={pickFromSheet} onClose={() => setDatesOpen(false)} />
      <V2Toast toast={plain ?? toast} onDone={(q) => { setPlain(null); onToastDone(q); }} />
    </div>
  );
}
