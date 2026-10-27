import { useCallback, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import { useEventWorkspace, useSendOnce } from '../../shared/runCommands';
import { isAccessRefusal } from '../../shared/selfServeErrors';
import type { EventWorkspace } from '../../events/eventModel';
import { useP3Home } from '../data/useP3Data';
import { eventPageOf, type EventPageView } from '../data/eventPage';
import { L, addDateWhy, peopleText, sessionKindLabel, sessionTitle, timeWord } from '../model';
import { seriesFactsOf } from '../data/dates';
import type { DaySession } from '../model';
import { P3_PATHS } from '../shell/paths';
import { ChangeItLink, RetryButton, StateCard } from './parts';
import { StatusSheet, type Send } from './StatusSheet';
import { DateSheets, type DateOpen } from './DateSheet';
import { useToast } from './Toast';
import type { SendOnce } from './CancelEventSheet';

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

function SessionRow({ s }: { s: DaySession }) {
  const sub = [sessionKindLabel(s.kind), ...(s.levels ?? [])].join(' \u00b7 ');
  return (
    <li className="p3-row" data-testid="p3-session">
      <span className="p3-time">{s.start ? timeWord(s.start) : L.noTime}</span>
      <div className="p3-grow">
        <div className="p3-row-t">{sessionTitle(s)}</div>
        <div className="p3-row-s">{sub}{s.end && s.start ? ` \u00b7 until ${timeWord(s.end)}` : ''}</div>
        <div className="p3-row-s" data-testid="p3-lineup">{s.people.length ? peopleText(s.people) : L.noLineup}</div>
      </div>
    </li>
  );
}

function Sessions({ v }: { v: EventPageView }) {
  const count = v.days.reduce((n, d) => n + d.sessions.length, 0);
  return (
    <section aria-label={L.sessions} data-testid="p3-sessions">
      <h2 className="p3-h2">{L.sessions}</h2>
      {count === 0 ? (
        <StateCard title={L.noSessions} testId="p3-sessions-empty">
          <p>Dancers see what is on from the sessions: a class, a party or a show.</p>
          <ChangeItLink>Add a session in the current organiser area</ChangeItLink>
        </StateCard>
      ) : (
        v.days.map((d, i) => (
          <div key={i} className="p3-card p3-tight">
            {d.label && <strong className="p3-day">{d.label}</strong>}
            <ul className="p3-list p3-flush">{d.sessions.map((s) => <SessionRow key={s.id} s={s} />)}</ul>
          </div>
        ))
      )}
    </section>
  );
}

/** A tag's colour: the same tag words as All dates (model dateMarks). */
export function tagClass(tag: string): string {
  if (tag === L.cancelled) return 'p3-tag p3-tag-cancel';
  if (tag === L.skipped) return 'p3-tag p3-tag-hidden';
  if (tag === L.done) return 'p3-tag p3-tag-finished';
  if (tag === L.notUsualDay) return 'p3-tag p3-tag-warn';
  return 'p3-chip';
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

function About({ v }: { v: EventPageView }) {
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
      <p className="p3-note">To change sessions or details for every date: <ChangeItLink>use the current organiser area</ChangeItLink>.</p>
    </section>
  );
}

function Page({ ws, place }: { ws: EventWorkspace; place: string | null }) {
  const today = londonTodayKey();
  const v = eventPageOf(ws, today);
  const toast = useToast(ws.series.id, ws.series.version);
  const send: Send = (commands, version) => toast.run(commands, version);
  const once = useSendOnce(ws.series.id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const [sheet, setSheet] = useState(false);
  const [date, setDate] = useState<DateOpen>(null);
  const closeSheet = useCallback(() => setSheet(false), []);
  const closeDate = useCallback(() => setDate(null), []);
  const addWhy = addDateWhy(seriesFactsOf(ws, today));
  const hint = STATUS_HINT[v.lifecycle] ?? (v.lifecycle === 'ended' ? 'It has finished' : 'See what you can do');
  return (
    <div className="p3-stack" data-testid="p3-event" data-kind={v.kind}>
      <Link className="p3-link" to={P3_PATHS.events}>&larr; {L.allEvents}</Link>
      <div className="p3-card p3-head" data-testid="p3-event-head">
        {v.cover && <img className="p3-cover" src={v.cover} alt="" loading="eager" decoding="async" />}
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
      <Sessions v={v} />
      <Coming v={v} onOpen={(id) => setDate({ kind: 'date', id })} addWhy={addWhy} onAdd={() => setDate({ kind: 'add' })} />
      <About v={v} />
      {sheet && (
        <StatusSheet ws={ws} today={today} status={v.status} send={send} sendOnce={sendOnce} onClose={closeSheet}
          onDone={(d) => { setSheet(false); toast.show(d); }} />
      )}
      <DateSheets ws={ws} today={today} open={date} onClose={closeDate} onDone={(d) => { setDate(null); toast.show(d); }} />
      {toast.node}
    </div>
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
    if (isAccessRefusal(ws.error)) {
      return (
        <StateCard title="This event isn&rsquo;t one of yours" testId="p3-event-notyours">
          <p>Only the people who run an event can open it here. If it should be yours, ask the Bachata Calendar team.</p>
          <Link className="p3-link" to={P3_PATHS.events}>See your events</Link>
        </StateCard>
      );
    }
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
  const row = home.data?.organisers.flatMap((o) => o.series).find((s) => s.id === ws.data.series.id) as { default_venue_name?: string | null } | undefined;
  return <>{children(ws.data, row?.default_venue_name ?? null)}</>;
}

/** C3 event page: reads the R1 workspace; the Status sheet (W2a) and the date sheets (W2b) are its writes. */
export function EventPage() {
  return <WorkspaceGate>{(ws, place) => <Page ws={ws} place={place} />}</WorkspaceGate>;
}
