import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FLYER_ACCEPT } from '../../shared/flyerModel';
import { useVenueOptions } from '../../shared/publicVenues';
import { fullDate } from '../../shared/dateWords';
import { StateCard } from '../screens/parts';
import { flyerToDraft, type FlyerDraftResult } from './flyerToDraft';
import { DRAFT_STORE_KEY, afterKind } from './model';
import { forgetStoredDraft } from './useCreateSave';
import { flyerHandoff, keepFlyerHandoff, resetWords, useFlyerRead, type FlyerReadDeps, type FlyerReadResult, browserFlyerDeps } from './useFlyerRead';

/**
 * Start from a flyer (P3 New event, behind organiserFlyerReader): pick a photo, it is read, and the
 * normal form opens filled in. Every state has a way forward, and the blank form (the kind tiles)
 * is always one tap away. Nothing is saved here.
 */

function PickButton({ label, reading, onPick }: { label: string; reading: boolean; onPick: (f: File) => void }) {
  return (
    <>
      <label className={`p3-btn p3-file p3-new-file${reading ? ' p3-new-flyer-off' : ''}`} aria-disabled={reading || undefined} data-testid="p3-flyer-pick-label">
        {label}
        <input type="file" accept={FLYER_ACCEPT} disabled={reading} aria-describedby={reading ? 'p3-flyer-pick-why' : undefined}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }} data-testid="p3-flyer-pick" />
      </label>
      {reading && <p className="p3-note" id="p3-flyer-pick-why" data-testid="p3-flyer-pick-why">One flyer at a time: this one is still being read.</p>}
    </>
  );
}

function Blank({ onBlank }: { onBlank: () => void }) {
  return <button type="button" className="p3-btn p3-btn-line" onClick={onBlank} data-testid="p3-flyer-blank">Fill it in yourself</button>;
}

/** What the flyer gave, said plainly (the not enough state). */
function foundLines(r: FlyerDraftResult, today: string): string[] {
  const d = r.draft;
  return [
    d.name && `Name: ${d.name}`,
    d.firstDate && `Date: ${fullDate(d.firstDate, today)}`,
    d.venue ? `Venue: ${d.venue.name}` : r.venueSaid && `Flyer says: ${r.venueSaid}`,
    r.sessionChoices.length > 0 && `${r.sessionChoices.length} session${r.sessionChoices.length === 1 ? '' : 's'}`,
  ].filter((x): x is string => !!x);
}

/** D2: how long a good read waits on the venue list before it goes on without venue matching. */
const VENUE_WAIT_MS = 8000;
const NO_VENUE_MATCH_NOTE = 'The venue list did not load, so we continued without venue matching: pick the venue below.';

/** D7: the missing part, taken from flyerToDraft's not_enough note so the title and the form say the same thing. */
function notEnoughTitle(r: FlyerDraftResult): string {
  // flyerToDraft missing part: "... (missing a date, a venue) ..."
  const text = r.notes.find((n) => n.code === 'not_enough')?.text ?? '';
  const missing = /\(missing ([^)]+)\)/.exec(text)?.[1];
  return missing ? `Not enough on this flyer: missing ${missing}` : 'Not enough on this flyer to fill the form';
}

export function FlyerStart({ today, organiserId, pageCount, onBlank, deps = browserFlyerDeps }: {
  today: string; organiserId: string | null; pageCount: number; onBlank: () => void; deps?: FlyerReadDeps;
}) {
  const navigate = useNavigate();
  const venues = useVenueOptions();
  const flyer = useFlyerRead(today, deps);
  const st = flyer.state;

  const open = (r: FlyerDraftResult, file: File) => {
    const { draft, handoff } = flyerHandoff(r, file);
    forgetStoredDraft();
    try { window.sessionStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(draft)); } catch { /* storage off: the form still opens with it */ }
    keepFlyerHandoff(handoff);
    // the kind comes from the flyer, never from a tile
    navigate(afterKind(draft.kind, organiserId, pageCount));
  };
  const pick = (f: File) => { void flyer.start(f); };

  // a good read goes straight to the form; not enough waits here to say what was found
  const result: FlyerReadResult | null = st.s === 'done' ? st.result : null;
  const goodRead = st.s === 'done' && st.result.kind === 'read';
  // D2: a venue list that never settles must not hold a good read: after VENUE_WAIT_MS, continue without venue matching
  const [waitedOut, setWaitedOut] = useState<unknown>(null);
  const waiting = goodRead && venues.isPending;
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaitedOut(st), VENUE_WAIT_MS);
    return () => clearTimeout(t);
  }, [waiting, st]);
  // latched: a list that lands after the wait does not re-open the form or change what it opened with
  const noMatch = goodRead && waitedOut === st;
  // venues still loading: wait, so a venue on the flyer can match (a failed load matches none)
  const verdict = useMemo(() => {
    if (st.s !== 'done' || st.result.kind !== 'read' || (venues.isPending && !noMatch)) return null;
    const r0 = flyerToDraft(st.result.read, noMatch ? [] : venues.data ?? [], today);
    // the venue name stays as the "Flyer says" note; the form says in one line that matching was skipped
    const r = noMatch ? { ...r0, notes: [...r0.notes, { code: 'no_venue_match', text: NO_VENUE_MATCH_NOTE }] } : r0;
    return { r, file: st.file, enough: !r.notes.some((n) => n.code === 'not_enough') };
  }, [st, venues.isPending, venues.data, today, noMatch]);
  const held = verdict && !verdict.enough ? verdict : null;
  useEffect(() => {
    if (verdict?.enough) open(verdict.r, verdict.file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per answer
  }, [verdict]);

  const card = (title: string, testId: string, body: ReactNode, again = true) => (
    <StateCard title={title} testId={testId}>
      {body}
      <div className="p3-stack-s">
        {again && <PickButton label="Try another photo" reading={flyer.reading} onPick={pick} />}
        <Blank onBlank={onBlank} />
      </div>
    </StateCard>
  );

  let body: ReactNode;
  if (st.s === 'reading' || (goodRead && !held)) {
    body = (
      <StateCard title="Reading your flyer&hellip;" testId="p3-flyer-reading">
        <p role="status">This takes a few seconds. Nothing is saved until you save.</p>
        <PickButton label="Pick a flyer photo" reading onPick={pick} />
        <button type="button" className="p3-btn p3-btn-line" onClick={flyer.cancel} data-testid="p3-flyer-cancel">Cancel</button>
      </StateCard>
    );
  } else if (held) {
    const lines = foundLines(held.r, today);
    body = (
      <StateCard title={notEnoughTitle(held.r)} testId="p3-flyer-not-enough">
        {noMatch && <p className="p3-note" data-testid="p3-flyer-no-venue-match">{NO_VENUE_MATCH_NOTE}</p>}
        <p>Here is what we found:</p>
        {lines.length ? <ul className="p3-new-flyer-found" data-testid="p3-flyer-found">{lines.map((l) => <li key={l}>{l}</li>)}</ul> : <p data-testid="p3-flyer-found-none">Nothing we could use.</p>}
        <div className="p3-stack-s">
          <button type="button" className="p3-btn" onClick={() => open(held.r, held.file)} data-testid="p3-flyer-use">Use what we found</button>
          <PickButton label="Try another photo" reading={flyer.reading} onPick={pick} />
          <Blank onBlank={onBlank} />
        </div>
      </StateCard>
    );
  } else if (result?.kind === 'problem') {
    body = card('That photo won\u2019t work', 'p3-flyer-problem', <p className="p3-error">{result.message}</p>);
  } else if (result?.kind === 'offline') {
    body = card('You\u2019re offline', 'p3-flyer-offline', <p>Connect to the internet and try again, or fill it in yourself.</p>);
  } else if (result?.kind === 'refused' && result.reason === 'daily_limit') {
    // D5: no number here (the function owns the limit): "today's flyer reads"
    const when = resetWords(result.resetsAt);
    body = card('You\u2019ve used all of today\u2019s flyer reads', 'p3-flyer-daily-limit', <p>{when ? <>Back {when}.</> : <>Back tomorrow.</>} You can fill it in yourself now.</p>, false);
  } else if (result?.kind === 'refused' && result.reason === 'attempts_limit') {
    // N3: the attempts cap is per day, so the next step is the reset time (London), never "wait a few minutes"
    const when = resetWords(result.resetsAt);
    body = card('Too many tries today', 'p3-flyer-attempts-limit', <p>{when ? <>Back {when}.</> : <>Back tomorrow.</>} You can fill it in yourself now.</p>, false);
  } else if (result?.kind === 'refused' && result.reason === 'switched_off') {
    body = card('Flyer reading is paused for now', 'p3-flyer-switched-off', <p>You can fill it in yourself: it takes a minute.</p>, false);
  } else if (result?.kind === 'refused' && result.reason === 'not_organiser') {
    body = card('Flyer reading is for organisers', 'p3-flyer-not-organiser', <p>This account cannot read flyers yet. You can fill it in yourself.</p>, false);
  } else if (result?.kind === 'refused' && result.reason === 'unauthorised') {
    body = card('Your sign-in has run out', 'p3-flyer-unauthorised', <p>Reload this page to sign in again, or fill it in yourself.</p>, false);
  } else if (result) {
    // bad_image, read_failed, error
    body = card('Couldn\u2019t read that one', 'p3-flyer-failed', <p>Try another photo, or fill it in yourself.</p>);
  } else {
    body = (
      <div className="p3-card p3-stack-s" data-testid="p3-flyer-choose">
        <strong>Start from a flyer</strong>
        <p className="p3-note">We read the title, dates, time, venue, sessions, price and ticket link from a photo of your flyer. Nothing is saved until you save.</p>
        <PickButton label="Pick a flyer photo" reading={flyer.reading} onPick={pick} />
        <Blank onBlank={onBlank} />
      </div>
    );
  }
  return <div className="p3-stack-s" data-testid="p3-flyer">{body}</div>;
}
