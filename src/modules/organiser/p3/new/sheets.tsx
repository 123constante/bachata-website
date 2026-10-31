import { useState } from 'react';
import { LEVEL_KEYS, LEVEL_LABEL, SESSION_TYPES, TYPE_LABEL, levelsApplyTo } from '../../shared/programmeModel';
import { useVenueOptions } from '../../shared/publicVenues';
import { MAX_PASSES, newPriceRow, type PriceRow } from '../../events/seriesExtras';
import { PAYMENT_LABEL, PAYMENT_METHODS } from '../../events/paymentModel';
import { emptyForm, type SessForm } from '../data/sessions';
import { repeatProblem, repeatSentence, type RepeatDraft } from '../model/repeat';
import { Editor as RepeatEditor } from '../screens/RepeatSheet';
import { Sheet } from '../screens/Sheet';
import { PriceCard } from '../screens/PriceCard';
import { P3Link, RetryButton, StateCard } from '../screens/parts';
import { P3_PATHS } from '../shell/paths';
import {
  COPY, firstDateFits, monthDayWarning, rowProblems, togglePay, venueMatches, venueOf,
  type CreateDraft, type CreateVenue,
} from './model';

/** Where is it? Search the venues; nothing found says what to do (skip, add it later, ask us). */
export function VenueSheet({ onPick, onClose }: { onPick: (v: CreateVenue | null) => void; onClose: () => void }) {
  const venues = useVenueOptions();
  const [term, setTerm] = useState('');
  const shown = venueMatches(venues.data ?? [], term);
  let body;
  if (venues.isPending) body = <StateCard title={COPY.venueLoading} testId="p3-new-venue-loading">This takes a second.</StateCard>;
  else if (venues.isError) {
    body = (
      <StateCard title="Venues didn&rsquo;t load" testId="p3-new-venue-error">
        <p>{COPY.venueError}</p>
        <RetryButton onClick={() => void venues.refetch()} />
      </StateCard>
    );
  } else if (!shown.length) {
    body = (
      <div className="p3-card p3-state" data-testid="p3-new-venue-none">
        <strong>{term.trim() ? COPY.venueNone(term) : 'No venues listed'}</strong>
        <p>{COPY.venueNoneBody}</p>
        <P3Link to={P3_PATHS.youHelp} testId="p3-new-venue-help">Open Help</P3Link>
      </div>
    );
  } else {
    body = (
      <ul className="p3-card p3-list" data-testid="p3-new-venue-list" aria-label="Venues">
        {shown.map((v) => (
          <li key={v.id}>
            <button type="button" className="p3-new-row" onClick={() => onPick(venueOf(v))} data-testid="p3-new-venue-row">
              <span className="p3-grow">
                <span className="p3-row-t">{v.name}</span><br />
                {(v.neighbourhood || v.city_name) && <span className="p3-row-s">{[v.neighbourhood, v.city_name].filter(Boolean).join(' \u00b7 ')}</span>}
              </span>
              <span className="p3-new-act">Pick</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Sheet title="Where is it?" onClose={onClose}>
      <label className="p3-field" htmlFor="p3-new-venue-q">Search venues</label>
      <input id="p3-new-venue-q" className="p3-in" type="search" value={term} placeholder="Venue name or area" onChange={(e) => setTerm(e.target.value)} data-testid="p3-new-venue-search" />
      {body}
      <button type="button" className="p3-btn p3-btn-line" onClick={() => onPick(null)} data-testid="p3-new-venue-skip">Skip for now</button>
      <p className="p3-note">Skip for now keeps the draft without a venue. Going live needs one.</p>
    </Sheet>
  );
}

/** How does it repeat? The P3 Repeat sheet's own editor; the dates are checked on the event page once it exists. */
export function RepeatSheetNew({ d, today, onChange, onClose }: { d: CreateDraft; today: string; onChange: (r: RepeatDraft) => void; onClose: () => void }) {
  const r = d.repeat;
  const problem = repeatProblem(r, today, d.firstDate || null) ?? (d.firstDate && !firstDateFits(r, d.firstDate) ? COPY.notFit : null);
  const warn = monthDayWarning(r);
  return (
    <Sheet title="How does it repeat?" onClose={onClose}>
      <RepeatEditor d={r} set={(p) => onChange({ ...r, ...p })} today={today} off={false} />
      {warn && <p className="p3-warn" data-testid="p3-new-repeat-warn">{warn}</p>}
      {problem ? <p className="p3-error" data-testid="p3-new-repeat-problem">{problem}</p> : <p className="p3-note" data-testid="p3-new-repeat-line">{repeatSentence(r, today)}</p>}
      <p className="p3-note">{COPY.capNote}</p>
      <button type="button" className="p3-btn" onClick={onClose} data-testid="p3-new-repeat-done">Done</button>
    </Sheet>
  );
}

/** Sessions: what happens, each with its own start and end (times live on sessions, never the event). */
export function SessionsSheet({ d, today, onChange, onClose }: { d: CreateDraft; today: string; onChange: (s: SessForm[]) => void; onClose: () => void }) {
  const set = (i: number, patch: Partial<SessForm>) => onChange(d.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const problem = rowProblems(d, today).sessions;
  return (
    <Sheet title="Sessions" onClose={onClose}>
      <p className="p3-note">{COPY.sessionsNote}</p>
      {!d.sessions.length && <StateCard title="No sessions yet" testId="p3-new-sess-empty"><p>{COPY.noSessions}</p></StateCard>}
      {d.sessions.map((s, i) => (
        <div key={i} className="p3-card p3-stack-s" data-testid="p3-new-sess">
          <strong>Session {i + 1}</strong>
          <div className="p3-chips" role="group" aria-label={`Session ${i + 1}: what is it?`}>
            {SESSION_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={s.type === t}
                onClick={() => set(i, { type: t, title: s.title.trim() === (TYPE_LABEL[s.type ?? ''] ?? '') ? TYPE_LABEL[t] : s.title, levels: levelsApplyTo(t) ? s.levels : [] })}
                data-testid={`p3-new-sess-type-${t}`}>{TYPE_LABEL[t]}</button>
            ))}
          </div>
          <label className="p3-field" htmlFor={`p3-new-st-${i}`}>Name</label>
          <input id={`p3-new-st-${i}`} className="p3-in" value={s.title} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} data-testid="p3-new-sess-title" />
          <div className="p3-new-time">
            <div className="p3-stack-s">
              <label className="p3-field" htmlFor={`p3-new-ss-${i}`}>Starts</label>
              <input id={`p3-new-ss-${i}`} className="p3-in" type="time" value={s.start} onChange={(e) => set(i, { start: e.target.value })} data-testid="p3-new-sess-start" />
            </div>
            <div className="p3-stack-s">
              <label className="p3-field" htmlFor={`p3-new-se-${i}`}>Ends</label>
              <input id={`p3-new-se-${i}`} className="p3-in" type="time" value={s.end} onChange={(e) => set(i, { end: e.target.value })} data-testid="p3-new-sess-end" />
            </div>
          </div>
          {levelsApplyTo(s.type) && (
            <div className="p3-chips" role="group" aria-label={`Session ${i + 1}: level`}>
              {LEVEL_KEYS.map((l) => (
                <button key={l} type="button" aria-pressed={s.levels.includes(l)} onClick={() => set(i, { levels: toggle(s.levels, l) })}>{LEVEL_LABEL[l]}</button>
              ))}
            </div>
          )}
          <button type="button" className="p3-link p3-danger-t" onClick={() => onChange(d.sessions.filter((_, j) => j !== i))} data-testid="p3-new-sess-remove">Remove this session</button>
        </div>
      ))}
      {problem && <p className="p3-error" data-testid="p3-new-sess-problem">{problem}</p>}
      <button type="button" className="p3-btn p3-btn-line" onClick={() => onChange([...d.sessions, { ...emptyForm('party'), title: TYPE_LABEL.party }])} data-testid="p3-new-sess-add">Add a session</button>
      <button type="button" className="p3-btn" onClick={onClose} data-testid="p3-new-sess-done">Done</button>
    </Sheet>
  );
}

/** Price basics: how dancers pay (going live needs it), a price or two, a ticket link. Stripe tickets come later. */
export function PriceSheet({ d, today, onChange, onClose }: { d: CreateDraft; today: string; onChange: (p: Partial<CreateDraft>) => void; onClose: () => void }) {
  const free = d.pay.includes('free');
  const problem = rowProblems(d, today).price;
  const setRow = (i: number, r: PriceRow) => onChange({ prices: d.prices.map((x, j) => (j === i ? r : x)) });
  const full = d.prices.length >= MAX_PASSES;
  return (
    <Sheet title="Price" onClose={onClose}>
      <p className="p3-field" id="p3-new-pay">How do dancers pay?</p>
      <div className="p3-chips" role="group" aria-labelledby="p3-new-pay" data-testid="p3-new-pay">
        {PAYMENT_METHODS.map((m) => (
          <button key={m} type="button" aria-pressed={d.pay.includes(m)} onClick={() => onChange({ pay: togglePay(d.pay, m) })} data-testid={`p3-new-pay-${m}`}>{PAYMENT_LABEL[m]}</button>
        ))}
      </div>
      <p className="p3-note">{free ? 'Shows as Free on the event.' : 'Pick every way that works. Free stands on its own.'}</p>
      {!free && (
        <div className="p3-stack-s" data-testid="p3-new-prices">
          {d.prices.map((r, i) => (
            <PriceCard key={r.id} row={r} i={i} off={false} onChange={(x) => setRow(i, x)} onRemove={() => onChange({ prices: d.prices.filter((_, j) => j !== i) })} />
          ))}
          <button type="button" className="p3-btn p3-btn-line" disabled={full} aria-describedby={full ? 'p3-new-price-full' : undefined}
            onClick={() => onChange({ prices: [...d.prices, newPriceRow()] })} data-testid="p3-new-price-add">Add a price</button>
          {full && <p className="p3-note" id="p3-new-price-full">Up to {MAX_PASSES} prices. Remove one to add another.</p>}
        </div>
      )}
      {d.pay.includes('ticket_link') && (
        <>
          <label className="p3-field" htmlFor="p3-new-ticket">Ticket link</label>
          <input id="p3-new-ticket" className="p3-in" type="url" inputMode="url" placeholder="https://" value={d.ticketUrl} onChange={(e) => onChange({ ticketUrl: e.target.value })} data-testid="p3-new-ticket" />
          <p className="p3-note">Must start with https://</p>
        </>
      )}
      {problem && <p className="p3-error" data-testid="p3-new-price-problem">{problem}</p>}
      <button type="button" className="p3-btn" onClick={onClose} data-testid="p3-new-price-done">Done</button>
    </Sheet>
  );
}
