import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import { useEventWorkspace, useSendOnce } from '../../shared/runCommands';
import { isAccessRefusal } from '../../shared/selfServeErrors';
import type { EventWorkspace } from '../../events/eventModel';
import { useP3Home } from '../data/useP3Data';
import { STATUS_COPY, eventPageOf, publicPageOf, type EventPageView } from '../data/eventPage';
import { L, addDateWhy, peopleText, removedStatus, sessionKindLabel, sessionTitle, timeWord } from '../model';
import { repeatShapeOf, seriesFactsOf, tagClass } from '../data/dates';
import type { DaySession } from '../model';
import { P3_PATHS } from '../shell/paths';
import { RetryButton, StateCard } from './parts';
import { StatusSheet, type Send } from './StatusSheet';
import { RepeatSheet } from './RepeatSheet';
import { previewRepeat } from '../data/repeat';
import { repeatWords } from '../model/repeat';
import { DateSheets, type DateOpen } from './DateSheet';
import { useToast } from './Toast';
import { useSavedToast } from './savedToast';
import { SessionSheet, type SessionOpen } from './SessionSheet';
import { factsOf } from '../data/sessions';
import { programmeRules } from '../model/programme';
import type { SendOnce } from './CancelEventSheet';
import { flags } from '@/lib/featureFlags';
import { TicketsEntry } from '../tickets/TicketsEntry';

/** The second half of the status row (C3 "Live \u00b7 Hide or end it"). */
const STATUS_HINT: Record<string, string> = {
  live: 'Hide or end it',
  paused: 'Show it again or end it',
  draft: 'Put it live',
  rejected: 'Put it live',
};

/** The read failed because the event is gone, or the id is not one. */
const isNotFound = (e: unknown) =>
  /^(not_found|series_not_found)|invalid input syntax for type uuid/.test(String((e as { message?: unknown } | null)?.message ?? ''));

function SessionRow({ s, onOpen }: { s: DaySession; onOpen: ((id: string) => void) | null }) {
  const sub = [sessionKindLabel(s.kind), ...(s.levels ?? [])].join(' \u00b7 ');
  const body = (
    <>
      <span className="p3-time">{s.start ? timeWord(s.start) : L.noTime}</span>
      <div className="p3-grow">
        <div className="p3-row-t">{sessionTitle(s)}</div>
        <div className="p3-row-s">{sub}{s.end && s.start ? ` \u00b7 until ${timeWord(s.end)}` : ''}</div>
        <div className="p3-row-s" data-testid="p3-lineup">{s.people.length ? peopleText(s.people) : L.noLineup}</div>
      </div>
    </>
  );
  // a festival's programme is the team's (read-only rows); every other kind opens the session sheet (W2d)
  if (!onOpen) return <li className="p3-row" data-testid="p3-session">{body}</li>;
  return (
    <li className="p3-row p3-row-btn" data-testid="p3-session">
      <button type="button" className="p3-date-btn" onClick={() => onOpen(s.id)} data-testid="p3-open-session">
        {body}
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </li>
  );
}

function Sessions({ v, ws, onOpen }: { v: EventPageView; ws: EventWorkspace; onOpen: (key: string | null) => void }) {
  const count = v.days.reduce((n, d) => n + d.sessions.length, 0);
  const festival = v.kind === 'festival';
  const addWhy = programmeRules(factsOf(ws, 'every', null, null)).add;
  const open = festival ? null : (id: string) => onOpen(id);
  return (
    <section aria-label={L.sessions} data-testid="p3-sessions">
      <h2 className="p3-h2">{L.sessions}</h2>
      {count === 0 ? (
        <StateCard title={L.noSessions} testId="p3-sessions-empty">
          <p>{addWhy ?? 'Dancers see what is on from the sessions: a class, a party or a show. Add the first one.'}</p>
        </StateCard>
      ) : (
        v.days.map((d, i) => (
          <div key={i} className="p3-card p3-tight">
            {d.label && <strong className="p3-day">{d.label}</strong>}
            <ul className="p3-list p3-flush">{d.sessions.map((s) => <SessionRow key={s.id} s={s} onOpen={open} />)}</ul>
          </div>
        ))
      )}
      {festival ? <p className="p3-note" data-testid="p3-sessions-ask">{L.festivalAsk}</p> : (
        <div className="p3-stack-s p3-gap-t">
          <button type="button" className="p3-btn p3-btn-line" disabled={!!addWhy} onClick={() => onOpen(null)} data-testid="p3-add-session">{L.addSession}</button>
          {addWhy && count > 0 && <p className="p3-note" data-testid="p3-add-session-why">{addWhy}</p>}
        </div>
      )}
    </section>
  );
}

function Coming({ v, onOpen, addWhy, onAdd }: { v: EventPageView; onOpen: (id: string) => void; addWhy: string | null; onAdd: () => void }) {
  return (
    <section aria-label={L.comingUp} data-testid="p3-coming">
      <h2 className="p3-h2">{L.comingUp}</h2>
      <div className="p3-card p3-tight">
        {v.coming.length ? (
          <ul className="p3-list p3-flush">
            {v.coming.map((c) => (
              <li key={c.id} className="p3-row p3-row-btn" data-testid="p3-coming-row">
                <button type="button" className="p3-date-btn" onClick={() => onOpen(c.id)} data-testid="p3-open-date">
                  <span className={`p3-grow p3-row-t ${c.cancelled ? 'p3-struck' : ''}`}>{c.label}</span>
                  {c.tags.map((t) => <span key={t} className={tagClass(t)}>{t}</span>)}
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          !v.comingMore && (
            <div className="p3-state" data-testid="p3-coming-empty">
              <strong>{L.noComing}</strong>
              {v.status.key === 'finished' ? <p>This has finished. Its past dates stay in your history.</p> : (
                <>
                  <p>{addWhy ?? 'Add a date so dancers can find it, or end it if it has finished.'}</p>
                </>
              )}
            </div>
          )
        )}
        {v.comingMore && <p className="p3-note" data-testid="p3-coming-more">{v.comingMore}</p>}
        {v.partial && <p className="p3-note" data-testid="p3-partial">{v.partial}</p>}
        <div className="p3-pair p3-gap-t">
          <Link className="p3-btn p3-btn-line p3-btn-link" to={P3_PATHS.eventDates(v.id)} data-testid="p3-all-dates">{L.seeAllDates}</Link>
          <button type="button" className="p3-btn p3-btn-line" disabled={!!addWhy} onClick={onAdd} data-testid="p3-add-date">{L.addDate}</button>
        </div>
        {addWhy && v.coming.length > 0 && <p className="p3-note" data-testid="p3-add-why">{addWhy}</p>}
      </div>
    </section>
  );
}

function AboutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="p3-row p3-row-col">
      <span className="p3-row-s">{label}</span>
      <span className="p3-row-t p3-plain">{children}</span>
    </div>
  );
}

/** F-34: the public page, same tab; disabled with the reason beside it when dancers cannot open one. */
function DancerView({ ws }: { ws: EventWorkspace }) {
  const pub = publicPageOf(ws);
  const title = <span className="p3-row-t">See it as dancers see it</span>;
  if (pub.href) {
    return (
      <Link className="p3-row p3-row-link" to={pub.href} data-testid="p3-dancer-view">
        <span className="p3-grow">{title}<br /><span className="p3-row-s" data-testid="p3-dancer-view-sub">{pub.why}</span></span>
        <span aria-hidden="true">&rsaquo;</span>
      </Link>
    );
  }
  return (
    <div className="p3-row" aria-disabled="true" data-testid="p3-dancer-view-off">
      <span className="p3-grow p3-mut">{title}<br /><span className="p3-row-s" data-testid="p3-dancer-view-why">{pub.why}</span></span>
    </div>
  );
}

function About({ v, ws }: { v: EventPageView; ws: EventWorkspace }) {
  const a = v.about;
  const none = <span className="p3-mut">{L.notSet}</span>;
  return (
    <section aria-label={L.about} data-testid="p3-about">
      <h2 className="p3-h2">{L.about}</h2>
      <div className="p3-card p3-tight p3-list">
        <AboutRow label={L.about}>{a.description ? <span className="p3-pre">{a.description}</span> : none}</AboutRow>
        <AboutRow label={L.music}>{a.music.length ? a.music.join(', ') : none}</AboutRow>
        <AboutRow label={L.ticket}>{a.ticket ? <a className="p3-link" href={a.ticket} target="_blank" rel="noreferrer">{a.ticket}</a> : none}</AboutRow>
        <AboutRow label={L.instagram}>{a.instagram ? <a className="p3-link" href={a.instagram} target="_blank" rel="noreferrer">{a.instagram}</a> : none}</AboutRow>
      </div>
      <div className="p3-card p3-tight p3-list p3-gap-t" data-testid="p3-edit-rows">
        <DancerView ws={ws} />
        <Link className="p3-row p3-row-link" to={P3_PATHS.eventDetails(v.id)} data-testid="p3-open-details">
          <span className="p3-grow"><span className="p3-row-t">{L.detailsTitle}</span><br /><span className="p3-row-s">{L.detailsRowSub}</span></span>
          <span aria-hidden="true">&rsaquo;</span>
        </Link>
        <Link className="p3-row p3-row-link" to={P3_PATHS.eventPrices(v.id)} data-testid="p3-open-prices">
          <span className="p3-grow"><span className="p3-row-t">{L.prices}</span><br /><span className="p3-row-s">{L.pricesRowSub}</span></span>
          <span aria-hidden="true">&rsaquo;</span>
        </Link>
        <Link className="p3-row p3-row-link" to={P3_PATHS.eventHistory(v.id)} data-testid="p3-open-history">
          <span className="p3-grow"><span className="p3-row-t">{L.history}</span><br /><span className="p3-row-s">{L.historyRowSub}</span></span>
          <span aria-hidden="true">&rsaquo;</span>
        </Link>
        <Link className="p3-row p3-row-link" to={P3_PATHS.eventOrganisers(v.id)} data-testid="p3-open-organisers">
          <span className="p3-grow"><span className="p3-row-t">{L.organisers}</span><br /><span className="p3-row-s">{L.organisersRowSub}</span></span>
          <span aria-hidden="true">&rsaquo;</span>
        </Link>
      </div>
    </section>
  );
}

function Page({ ws, place }: { ws: EventWorkspace; place: string | null }) {
  const today = londonTodayKey();
  const v = eventPageOf(ws, today);
  const toast = useToast(ws.series.id, ws.series.version);
  useSavedToast(toast.show);
  const send: Send = (commands, version) => toast.run(commands, version);
  const once = useSendOnce(ws.series.id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const navigate = useNavigate();
  // a cover address that does not load is the same as no cover (F-25)
  const [broken, setBroken] = useState<string | null>(null);
  const coverBroken = !!v.cover && v.cover === broken;
  const [sheet, setSheet] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const closeRepeat = useCallback(() => setRepeat(false), [setRepeat]);
  const [date, setDate] = useState<DateOpen>(null);
  const [session, setSession] = useState<SessionOpen>(null);
  const closeSheet = useCallback(() => setSheet(false), [setSheet]);
  const closeDate = useCallback(() => setDate(null), [setDate]);
  const addWhy = addDateWhy(seriesFactsOf(ws, today));
  const hint = STATUS_HINT[v.lifecycle] ?? (v.lifecycle === 'ended' ? 'It has finished' : 'See what you can do');
  return (
    <div className="p3-stack" data-testid="p3-event" data-kind={v.kind}>
      <Link className="p3-link" to={P3_PATHS.events}>&larr; {L.allEvents}</Link>
      <div className="p3-card p3-head" data-testid="p3-event-head">
        {v.cover && !coverBroken && <img className="p3-cover" src={v.cover} alt="" loading="eager" decoding="async" onError={() => setBroken(v.cover)} />}
        <h2 className="p3-name" data-testid="p3-event-name">{v.name}</h2>
        <div className="p3-row-tags">
          <span className="p3-chip" data-testid="p3-kind">{v.kindWord}</span>
          <span className={`p3-tag p3-tag-${v.status.key}`} data-testid="p3-status">
            {v.status.key === 'live' && <span className="p3-dot" aria-hidden="true" />}
            {v.status.label}
          </span>
        </div>
        <p className="p3-row-s" data-testid="p3-shape">{v.shape}{place ? ` \u00b7 ${place}` : ''}</p>
        {v.when && <p className="p3-row-t" data-testid="p3-when">{v.when}</p>}
      </div>
      <button type="button" className="p3-card p3-status-row" onClick={() => setSheet(true)} data-testid="p3-open-status">
        <span className="p3-grow">
          <span className="p3-row-t">{v.status.label}</span>
          <span className="p3-row-s">{` \u00b7 ${hint}`}</span>
        </span>
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      <button type="button" className="p3-card p3-status-row" onClick={() => setRepeat(true)} data-testid="p3-open-repeat">
        <span className="p3-grow">
          <span className="p3-row-t">Repeats</span><br />
          <span className="p3-row-s" data-testid="p3-repeat-row">{repeatWords(repeatShapeOf(ws), today)}</span>
        </span>
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      {flags.organiserTicketing && <TicketsEntry seriesId={ws.series.id} />}
      {flags.organiserTicketing && (
        <Link className="p3-card p3-status-row" to={P3_PATHS.eventDoor(ws.series.id)} data-testid="p3-open-door">
          <span className="p3-grow">
            <span className="p3-row-t">Scan tickets</span>
            <span className="p3-row-s"> &middot; At the door</span>
          </span>
          <span aria-hidden="true">&rsaquo;</span>
        </Link>
      )}
      <Sessions v={v} ws={ws} onOpen={(key) => setSession({ key, scope: 'every' })} />
      <Coming v={v} onOpen={(id) => setDate({ kind: 'date', id })} addWhy={addWhy} onAdd={() => setDate({ kind: 'add' })} />
      <About v={v} ws={ws} />
      {sheet && (
        <StatusSheet ws={ws} today={today} status={v.status} send={send} sendOnce={sendOnce} onClose={closeSheet}
          onDone={(d) => {
            setSheet(false);
            if (d.removed) navigate(P3_PATHS.events, { state: { p3Toast: d.text } });
            else toast.show(d);
          }} />
      )}
      {repeat && (
        <RepeatSheet ws={ws} today={today} send={sendOnce} preview={(cmd) => previewRepeat(ws.series.id, ws.series.version, cmd)}
          onClose={closeRepeat} onDone={(d) => { setRepeat(false); toast.show(d); }} />
      )}
      <DateSheets ws={ws} today={today} open={date} onClose={closeDate} onDone={(d) => { setDate(null); toast.show(d); }} />
      {session && (
        <SessionSheet ws={ws} today={today} open={session} onClose={() => setSession(null)} onDone={(d) => { setSession(null); toast.show(d); }} />
      )}
      {toast.node}
    </div>
  );
}

/** The refusal copy every P3 event screen shows when the read is not this person's (W3b-1 History reuses it). */
export function NotYoursCard() {
  return (
    <StateCard title="This event isn&rsquo;t one of yours" testId="p3-event-notyours">
      <p>Only the people who run an event can open it here. If it should be yours, ask the Bachata Calendar team.</p>
      <Link className="p3-link" to={P3_PATHS.events}>See your events</Link>
    </StateCard>
  );
}

/** The workspace read with its loading, not-yours, not-found and error states (event page and All dates). */
export function WorkspaceGate({ children }: { children: (ws: EventWorkspace, place: string | null) => ReactNode }) {
  const { seriesId } = useParams<{ seriesId: string }>();
  const ws = useEventWorkspace(seriesId);
  const home = useP3Home();
  if (ws.isPending) {
    return <StateCard title="Loading the event&hellip;" testId="p3-event-loading">This takes a second.</StateCard>;
  }
  if (ws.isError) {
    if (isAccessRefusal(ws.error)) return <NotYoursCard />;
    if (isNotFound(ws.error)) {
      return (
        <StateCard title="We can&rsquo;t find this event" testId="p3-event-notfound">
          <p>It may have been removed, or the link is wrong.</p>
          <Link className="p3-link" to={P3_PATHS.events}>See your events</Link>
        </StateCard>
      );
    }
    return (
      <StateCard title="We couldn&rsquo;t load this event" testId="p3-event-error">
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void ws.refetch()} />
      </StateCard>
    );
  }
  if (ws.data.series.lifecycle_status === 'archived') {
    return (
      <StateCard title="This event was removed" testId="p3-event-removed">
        <p><span className={`p3-tag p3-tag-${removedStatus().key}`} data-testid="p3-status">{removedStatus().label}</span></p>
        <p>{STATUS_COPY.archivedWhy}</p>
        <Link className="p3-link" to={P3_PATHS.events}>See your events</Link>
      </StateCard>
    );
  }
  const row = home.data?.organisers.flatMap((o) => o.series).find((s) => s.id === ws.data.series.id) as { default_venue_name?: string | null } | undefined;
  return <>{children(ws.data, row?.default_venue_name ?? null)}</>;
}

/** C3 event page: reads the R1 workspace; the Status sheet (W2a) and the date sheets (W2b) are its writes. */
export function EventPage() {
  return <WorkspaceGate>{(ws, place) => <Page ws={ws} place={place} />}</WorkspaceGate>;
}
