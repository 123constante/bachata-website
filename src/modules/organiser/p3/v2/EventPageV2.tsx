import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EventWorkspace } from '../../events/eventModel';
import { venueName } from '../../shared/publicVenues';
import { fullDate } from '../../shared/dateWords';
import { useSendOnce } from '../../shared/runCommands';
import { cancelPlan } from '../data/eventPage';
import { repeatShapeOf } from '../data/dates';
import { allItems, itemName } from '../../events/programmeSeriesModel';
import { fetchOrganiserPages } from '../../events/programmeSeriesApi';
import { seriesTree } from '../data/sessions';
import { repeatWords } from '../model/repeat';
import { GuardedBack } from '../screens/EditTray';
import type { SendOnce } from '../screens/CancelEventSheet';
import { Sheet } from '../screens/Sheet';
import { VenueList } from '../screens/VenueList';
import { P3_PATHS } from '../shell/paths';
import { TicketsEntry } from '../tickets/TicketsEntry';
import { R4CancelSheet } from '../r4/R4CancelSheet';
import { useEventChoice } from '../r4/EventChoice';
import { r4EventRowOf } from '../r4/r4EventsModel';
import { V2, repeatParts, sessionLine } from './copy';
import { DATE_TAG_WORD, UPCOMING_PAGE, dateTagOf, upcomingOf, type EventFields } from './editorModel';
import { SaveBar } from './SaveBar';
import { useEditor } from './useEditor';
import './v2.css';

/** A session before 06:00 belongs to the night before (01:00 sorts after 23:00). */
const lateKey = (t: string) => (t && t < '06:00' ? `3${t}` : `1${t || '99:99'}`);

/** One prototype row: grey label, value (ellipsis), chevron. */
function Row({ k, v, testId, onClick, to, disabled }: { k: string; v: string; testId: string; onClick?: () => void; to?: string; disabled?: boolean }) {
  const body: ReactNode = (<><span className="v2-k">{k}</span><span className={v ? 'v2-v' : 'v2-v v2-add'}>{v || V2.add}</span></>);
  return to
    ? <Link to={to} className="v2-r v2-go" data-testid={testId}>{body}</Link>
    : <button type="button" className="v2-r v2-go" disabled={disabled} onClick={onClick} data-testid={testId}>{body}</button>;
}

/** Editor v2 event page (flag organiserEditorV2, weekly and one-off), drawn as the approved prototype. */
export function EventPageV2({ ws }: { ws: EventWorkspace }) {
  const ed = useEditor(ws);
  const { id, today, base, f, venues, city, changes, save, toast, why, undo, doSave } = ed;
  const weekly = ws.series.format === 'recurring';
  const dirty = ed.dirty;
  const draft = ed.draft.event;
  const setDraft = (fn: (d: Partial<EventFields>) => Partial<EventFields>) => ed.update((x) => ({ ...x, event: fn(x.event) }));
  const sessions = useMemo(() => allItems(seriesTree(ws)).slice().sort((a, b) => (lateKey(a.start) < lateKey(b.start) ? -1 : 1)), [ws]);
  const [sheet, setSheet] = useState<null | 'name' | 'about' | 'venue'>(null);
  const [more, setMore] = useState(false);
  const [cancel, setCancel] = useState(false);
  const once = useSendOnce(id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const plan = weekly ? null : cancelPlan(ws, today);
  const oneOffDate = ws.dates[0]?.occurrence_date ?? null;
  const oneOffCancelled = !weekly && ws.dates[0]?.lifecycle_status === 'cancelled';
  const upcoming = upcomingOf(ws.dates, today);
  const shown = more ? upcoming : upcoming.slice(0, UPCOMING_PAGE);
  const nameProblem = f.name.trim().length === 0 ? 'Add a name.' : null;
  // the state pill: the same mapping as the Events list and the event hub (r4EventRowOf)
  const choice = useEventChoice();
  const row = choice.rows.find((r) => r.id === id) ?? null;
  const pill = row ? r4EventRowOf(row).pill : null;
  const orgIds = ws.organiserIds;
  const pages = useQuery({ queryKey: ['org-organiser-pages', ...orgIds], queryFn: () => fetchOrganiserPages(orgIds), enabled: orgIds.length > 0 });
  const whoRuns = orgIds.length === 0 ? '' : pages.data ? pages.data.map((p) => p.name).join(', ') : V2.loading;
  const repeat = repeatParts(repeatWords(repeatShapeOf(ws), today));

  return (
    <div className="v2-page" data-testid="v2-event" data-id={id}>
      <header className="v2-top">
        <span className="v2-bk"><GuardedBack to={P3_PATHS.event(id)}>{null}</GuardedBack></span>
        <span className="v2-tt">
          <span className="v2-tt1">{V2.events}</span>
          <span className="v2-tt2" data-testid="v2-event-subline" title={base.name}>{f.name.trim() || base.name}</span>
        </span>
        {pill && <span className={`r4-pill r4-pill-${pill.tone}`} data-testid="v2-pill">{pill.word}</span>}
      </header>

      <div className="v2-main">
        <section className="v2-stack" aria-labelledby="v2-card-event">
          <h2 id="v2-card-event" className="v2-lbl">{V2.eventCard}</h2>
          <div className="v2-card">
            <Row k={V2.name} v={f.name} testId="v2-name" disabled={save.busy} onClick={() => setSheet('name')} />
            <Row k={V2.about} v={f.about.replace(/\s+/g, ' ').trim()} testId="v2-about" disabled={save.busy} onClick={() => setSheet('about')} />
            <Row k={V2.music} v={ws.musicStyles.join(', ')} testId="v2-music" to={P3_PATHS.eventDetails(id)} />
            <Row k={V2.venue} v={venueName(venues.data, f.venueId) ?? (f.venueId ? V2.loading : '')} testId="v2-venue" disabled={save.busy} onClick={() => setSheet('venue')} />
            {city.failed && <p className="v2-err" role="alert">{city.problem} <button type="button" className="v2-chg" onClick={city.retry}>Try again</button></p>}
            {weekly ? (
              <div className="v2-r" data-testid="v2-repeat">
                <span className="v2-k">{V2.repeat}</span>
                <span className="v2-rb" title={repeat.full}>
                  <span className="v2-rt">{repeat.head}</span>
                  {repeat.rest && <span className="v2-rl">{repeat.rest}</span>}
                </span>
                <Link to={P3_PATHS.eventAll(id)} className="v2-chg">{V2.changeRepeat}</Link>
              </div>
            ) : (
              <div className="v2-r" data-testid="v2-date">
                <span className="v2-k">{V2.date}</span>
                <span className="v2-v">{oneOffDate ? fullDate(oneOffDate, today) : V2.add}</span>
                <Link to={P3_PATHS.eventDates(id)} className="v2-chg">{V2.changeDate}</Link>
              </div>
            )}
            <Row k={V2.whoRuns} v={whoRuns} testId="v2-who" to={P3_PATHS.eventOrganisers(id)} />
          </div>
        </section>

        <section className="v2-stack" aria-labelledby="v2-card-prog">
          <h2 id="v2-card-prog" className="v2-lbl">{V2.programme}</h2>
          <div className="v2-card">
            {sessions.length === 0 && <p className="v2-empty" data-testid="v2-sessions-empty">{V2.noSessions}</p>}
            {sessions.map((s) => (
              <Link key={s.key} to={P3_PATHS.eventAll(id)} className="v2-sess" data-testid="v2-session-row">
                <span className="v2-time">{s.start || '–'}{s.end && <small>{V2.to(s.end)}</small>}</span>
                <span className="v2-rb">
                  <span className="v2-rt">{itemName(s)}</span>
                  <span className="v2-rl">{sessionLine(s)}</span>
                </span>
              </Link>
            ))}
            <div className="v2-r"><Link to={P3_PATHS.eventAll(id)} className="v2-chg" data-testid="v2-add-session">{V2.addSession}</Link></div>
          </div>
          <p className="v2-foot">{V2.programmeLine}</p>
        </section>

        <section className="v2-stack" aria-labelledby="v2-card-tickets" data-testid="v2-tickets-frame">
          <h2 id="v2-card-tickets" className="v2-lbl">{V2.tickets}</h2>
          {/* S2 slot: S2 replaces today's TicketsEntry here. */}
          <div className="v2-card v2-pad"><TicketsEntry seriesId={id} /></div>
        </section>

        <section className="v2-stack" aria-labelledby="v2-card-pics">
          <h2 id="v2-card-pics" className="v2-lbl">{V2.pictures}</h2>
          <div className="v2-card">
            <Row k={V2.flyer} v={ws.series.default_cover_image_url ? V2.added : ''} testId="v2-flyer" to={P3_PATHS.eventDetails(id)} />
            <Row k={V2.gallery} v={V2.photos(ws.gallery.length)} testId="v2-gallery" to={P3_PATHS.eventDetails(id)} />
            <Row k={V2.videos} v={V2.videoCount(ws.videoUrls.length)} testId="v2-videos" to={P3_PATHS.eventDetails(id)} />
          </div>
        </section>

        {weekly && (
          <section className="v2-stack" aria-labelledby="v2-card-dates" data-testid="v2-dates">
            <h2 id="v2-card-dates" className="v2-lbl">{V2.upcoming}</h2>
            {upcoming.length === 0 ? <p className="v2-foot" data-testid="v2-dates-empty">{V2.noUpcoming}</p> : <p className="v2-foot">{V2.upcomingLine}</p>}
            {shown.length > 0 && (
              <div className="v2-card">
                {shown.map((d) => {
                  const tag = dateTagOf(d, ws.series.lifecycle_status);
                  return (
                    <Link key={d.id} to={P3_PATHS.eventNight(id, d.id)} className="v2-r v2-go" data-testid="v2-date-row">
                      <span className="v2-v">{fullDate(d.occurrence_date, today)}</span>
                      {tag && <span className={`v2-tag v2-tag-${tag}`}>{DATE_TAG_WORD[tag]}</span>}
                    </Link>
                  );
                })}
                {!more && upcoming.length > UPCOMING_PAGE && (
                  <div className="v2-r"><button type="button" className="v2-chg" onClick={() => setMore(true)} data-testid="v2-dates-more">{V2.showMore}</button></div>
                )}
              </div>
            )}
          </section>
        )}

        <div className="v2-card">
          <Link to={P3_PATHS.event(id)} className="v2-r v2-go" data-testid="v2-guest-list"><span className="v2-v v2-dark">{V2.guestList}</span></Link>
          <Link to={P3_PATHS.eventAll(id)} className="v2-r v2-go" data-testid="v2-status"><span className="v2-v v2-dark">{V2.pauseOrEnd}</span></Link>
          {!weekly && plan && (
            oneOffCancelled
              ? <Link to={P3_PATHS.eventAll(id)} className="v2-r v2-go v2-red" data-testid="v2-bring-back"><span className="v2-v">{V2.bringBackEvent}</span></Link>
              : (
                <button type="button" className="v2-r v2-go v2-red" disabled={dirty} onClick={() => setCancel(true)} data-testid="v2-cancel-event">
                  <span className="v2-rb"><span className="v2-rt">{V2.cancelEvent}</span>{dirty && <span className="v2-rl">{V2.saveFirst}</span>}</span>
                </button>
              )
          )}
        </div>
      </div>

      {toast.node}
      <SaveBar changes={changes} busy={save.busy} failed={save.failed} why={why} onUndo={undo} onSave={() => void doSave()} />
      {save.error && !save.failed.length && <p className="v2-err" role="alert">{save.error}</p>}

      {ed.leaveSheet}
      {sheet === 'name' && (
        <Sheet title={V2.name} onClose={() => setSheet(null)}>
          <div className="v2-f">
            <label htmlFor="v2-name-in" className="v2-fl">{V2.name}</label>
            <textarea id="v2-name-in" className="v2-in" rows={3} value={f.name} disabled={save.busy} autoComplete="off"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} data-testid="v2-name-input" />
            {draft.name !== undefined && nameProblem && <p className="v2-err" role="alert">{nameProblem}</p>}
          </div>
          <button type="button" className="r4-btn v2-tap" onClick={() => setSheet(null)} data-testid="v2-sheet-done">{V2.done}</button>
        </Sheet>
      )}
      {sheet === 'about' && (
        <Sheet title={V2.about} onClose={() => setSheet(null)}>
          <div className="v2-f">
            <label htmlFor="v2-about-in" className="v2-fl">{V2.about}</label>
            <textarea id="v2-about-in" className="v2-in" rows={6} value={f.about} disabled={save.busy}
              onChange={(e) => setDraft((d) => ({ ...d, about: e.target.value }))} data-testid="v2-about-input" />
          </div>
          <button type="button" className="r4-btn v2-tap" onClick={() => setSheet(null)} data-testid="v2-sheet-done">{V2.done}</button>
        </Sheet>
      )}
      {sheet === 'venue' && (
        <Sheet title={V2.venue} onClose={() => setSheet(null)}>
          <VenueList venues={venues} testId="v2-venues">
            {(list) => list.map((v) => (
              <button key={v.id} type="button" className="p3-choice v2-tap" aria-pressed={v.id === f.venueId}
                onClick={() => { setDraft((d) => ({ ...d, venueId: v.id })); setSheet(null); }}>
                <span className="p3-row-t">{v.name}</span>
                <span className="p3-row-s">{[v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </VenueList>
        </Sheet>
      )}
      {cancel && plan && (
        <R4CancelSheet name={ws.series.name} plan={plan} send={sendOnce} onClose={() => setCancel(false)}
          onDone={() => { setCancel(false); toast.show(V2.tagCancelled); }} />
      )}
    </div>
  );
}
