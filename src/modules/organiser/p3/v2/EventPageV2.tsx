import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventWorkspace } from '../../events/eventModel';
import { venueName } from '../../shared/publicVenues';
import { fullDate } from '../../shared/dateWords';
import { useSendOnce } from '../../shared/runCommands';
import { cancelPlan } from '../data/eventPage';
import { repeatShapeOf } from '../data/dates';
import { allItems } from '../../events/programmeSeriesModel';
import { seriesTree } from '../data/sessions';
import { repeatWords } from '../model/repeat';
import { GuardedBack } from '../screens/EditTray';
import type { SendOnce } from '../screens/CancelEventSheet';
import { Sheet } from '../screens/Sheet';
import { VenueList } from '../screens/VenueList';
import { P3_PATHS } from '../shell/paths';
import { TicketsEntry } from '../tickets/TicketsEntry';
import { R4CancelSheet } from '../r4/R4CancelSheet';
import { V2 } from './copy';
import { DATE_TAG_WORD, UPCOMING_PAGE, dateTagOf, upcomingOf, type EventFields } from './editorModel';
import { SaveBar } from './SaveBar';
import { useEditor } from './useEditor';
import './v2.css';

/** Editor v2 event page (flag organiserEditorV2, weekly and one-off): every edit waits behind one save bar. */
export function EventPageV2({ ws }: { ws: EventWorkspace }) {
  const ed = useEditor(ws);
  const { id, today, base, f, venues, city, changes, save, toast, why, undo, doSave } = ed;
  const weekly = ws.series.format === 'recurring';
  const dirty = ed.dirty;
  const draft = ed.draft.event;
  const setDraft = (fn: (d: Partial<EventFields>) => Partial<EventFields>) => ed.update((x) => ({ ...x, event: fn(x.event) }));
  const sessions = allItems(seriesTree(ws));
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
  const [cancel, setCancel] = useState(false);
  const once = useSendOnce(id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const plan = weekly ? null : cancelPlan(ws, today);
  const oneOffDate = ws.dates[0]?.occurrence_date ?? null;
  const oneOffCancelled = !weekly && ws.dates[0]?.lifecycle_status === 'cancelled';
  const upcoming = upcomingOf(ws.dates, today);
  const shown = more ? upcoming : upcoming.slice(0, UPCOMING_PAGE);
  const nameTooLong = f.name.trim().length === 0 ? 'Add a name.' : null;

  return (
    <div className="r4-stack r4-form" data-testid="v2-event" data-id={id}>
      <div>
        <GuardedBack to={P3_PATHS.event(id)}>{null}</GuardedBack>
        <h1 className="r4-h1">Edit event</h1>
        <p className="v2-sub-line" data-testid="v2-event-subline" title={base.name}>{base.name}</p>
      </div>

      <section className="r4-card v2-card" aria-labelledby="v2-card-event">
        <h2 id="v2-card-event" className="r4-label v2-card-h">{V2.eventCard}</h2>
        <div className="r4-field">
          <label htmlFor="v2-name" className="r4-field-l">{V2.name}</label>
          <textarea id="v2-name" className="r4-in v2-tap" rows={3} value={f.name} disabled={save.busy} autoComplete="off"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} data-testid="v2-name" />
          {draft.name !== undefined && nameTooLong && <p className="r4-err" role="alert">{nameTooLong}</p>}
        </div>
        <div className="r4-field">
          <label htmlFor="v2-about" className="r4-field-l">{V2.about}</label>
          <textarea id="v2-about" className="r4-in" rows={4} value={f.about} disabled={save.busy}
            onChange={(e) => setDraft((d) => ({ ...d, about: e.target.value }))} data-testid="v2-about" />
        </div>
        <Link to={P3_PATHS.eventDetails(id)} className="v2-row" data-testid="v2-music">
          <span className="v2-row-t">{V2.music}</span><span className="v2-row-help">{ws.musicStyles.join(', ') || 'Not set'}</span>
        </Link>
        <button type="button" className="v2-row" disabled={save.busy} onClick={() => setPicking(true)} data-testid="v2-venue">
          <span className="v2-row-t">{V2.venue}</span><span className="v2-row-help">{venueName(venues.data, f.venueId) ?? (f.venueId ? 'Loading' : 'Not set')}</span>
        </button>
        {city.failed && <p className="r4-err" role="alert">{city.problem} <button type="button" className="v2-link" onClick={city.retry}>Try again</button></p>}
        {weekly ? (
          <div className="v2-row" data-testid="v2-repeat">
            <span className="v2-row-t">{V2.repeat}: {repeatWords(repeatShapeOf(ws), today)}</span>
            <Link to={P3_PATHS.eventAll(id)} className="v2-link">{V2.changeRepeat}</Link>
          </div>
        ) : (
          <div className="v2-row" data-testid="v2-date">
            <span className="v2-row-t">{V2.date}: {oneOffDate ? fullDate(oneOffDate, today) : 'Not set'}</span>
            <Link to={P3_PATHS.eventDates(id)} className="v2-link">{V2.changeDate}</Link>
          </div>
        )}
        <Link to={P3_PATHS.eventOrganisers(id)} className="v2-row" data-testid="v2-who">
          <span className="v2-row-t">{V2.whoRuns}</span>{ws.organiserIds.length > 0 && <span className="v2-row-help">{ws.organiserIds.length}</span>}
        </Link>
      </section>

      <section className="r4-card v2-card" aria-labelledby="v2-card-prog">
        <h2 id="v2-card-prog" className="r4-label v2-card-h">{V2.programme}</h2>
        <p className="v2-row-help">{V2.programmeLine}</p>
        {sessions.map((s) => (
          <Link key={s.key} to={P3_PATHS.eventAll(id)} className="v2-row" data-testid="v2-session-row">
            <span className="v2-row-t">{s.title || 'Session'}</span>
            <span className="v2-row-help">{[s.start, s.end].filter(Boolean).join('\u2013')}</span>
          </Link>
        ))}
        <Link to={P3_PATHS.eventAll(id)} className="v2-row" data-testid="v2-add-session"><span className="v2-row-t">{V2.addSession}</span></Link>
      </section>

      <section className="r4-card v2-card" aria-labelledby="v2-card-tickets" data-testid="v2-tickets-frame">
        <h2 id="v2-card-tickets" className="r4-label v2-card-h">{V2.tickets}</h2>
        {/* S2 slot: S2 replaces today's TicketsEntry here. */}
        <TicketsEntry seriesId={id} />
      </section>

      <section className="r4-card v2-card" aria-labelledby="v2-card-pics">
        <h2 id="v2-card-pics" className="r4-label v2-card-h">{V2.pictures}</h2>
        <Link to={P3_PATHS.eventDetails(id)} className="v2-row"><span className="v2-row-t">{V2.flyer}</span><span className="v2-row-help">{ws.series.default_cover_image_url ? 'Added' : 'Not set'}</span></Link>
        <Link to={P3_PATHS.eventDetails(id)} className="v2-row"><span className="v2-row-t">{V2.gallery}</span><span className="v2-row-help">{ws.gallery.length}</span></Link>
        <Link to={P3_PATHS.eventDetails(id)} className="v2-row"><span className="v2-row-t">{V2.videos}</span><span className="v2-row-help">{ws.videoUrls.length}</span></Link>
      </section>

      {weekly && (
        <section className="r4-card v2-card" aria-labelledby="v2-card-dates" data-testid="v2-dates">
          <h2 id="v2-card-dates" className="r4-label v2-card-h">{V2.upcoming}</h2>
          {upcoming.length === 0 ? <p className="v2-row-help" data-testid="v2-dates-empty">{V2.noUpcoming}</p> : <p className="v2-row-help">{V2.upcomingLine}</p>}
          {shown.map((d) => {
            const tag = dateTagOf(d, ws.series.lifecycle_status);
            return (
              <Link key={d.id} to={P3_PATHS.eventNight(id, d.id)} className="v2-row" data-testid="v2-date-row">
                <span className="v2-row-t">{fullDate(d.occurrence_date, today)}</span>
                {tag && <span className={`v2-tag v2-tag-${tag}`}>{DATE_TAG_WORD[tag]}</span>}
              </Link>
            );
          })}
          {!more && upcoming.length > UPCOMING_PAGE && (
            <button type="button" className="v2-link" onClick={() => setMore(true)} data-testid="v2-dates-more">{V2.showMore}</button>
          )}
        </section>
      )}

      <section className="r4-card v2-card">
        <Link to={P3_PATHS.event(id)} className="v2-row" data-testid="v2-guest-list"><span className="v2-row-t">{V2.guestList}</span></Link>
        <Link to={P3_PATHS.eventAll(id)} className="v2-row" data-testid="v2-status"><span className="v2-row-t">{V2.pauseOrEnd}</span></Link>
        {!weekly && plan && (
          oneOffCancelled
            ? <Link to={P3_PATHS.eventAll(id)} className="v2-row" data-testid="v2-bring-back"><span className="v2-row-t">{V2.bringBackEvent}</span></Link>
            : (
              <div className={dirty ? 'v2-grey' : undefined}>
                <button type="button" className="v2-row" disabled={dirty} onClick={() => setCancel(true)} data-testid="v2-cancel-event"><span className="v2-row-t">{V2.cancelEvent}</span></button>
                {dirty && <p className="v2-row-help">{V2.saveFirst}</p>}
              </div>
            )
        )}
      </section>

      {toast.node}
      <SaveBar changes={changes} busy={save.busy} failed={save.failed} why={why} onUndo={undo} onSave={() => void doSave()} />
      {save.error && !save.failed.length && <p className="r4-err" role="alert">{save.error}</p>}

      {ed.leaveSheet}
      {picking && (
        <Sheet title={V2.venue} onClose={() => setPicking(false)}>
          <VenueList venues={venues} testId="v2-venues">
            {(list) => list.map((v) => (
              <button key={v.id} type="button" className="p3-choice v2-tap" aria-pressed={v.id === f.venueId}
                onClick={() => { setDraft((d) => ({ ...d, venueId: v.id })); setPicking(false); }}>
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
