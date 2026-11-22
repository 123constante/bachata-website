import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVenueOptions, venueName } from '../../shared/publicVenues';
import { priceLabel, priceRows, pricesLock } from '../../events/seriesExtras';
import type { EventWorkspace } from '../../events/eventModel';
import { londonTodayKey } from '@/lib/londonDate';
import { L, hasOneDate, saveWordsFor } from '../model';
import { repeatShapeOf } from '../data/dates';
import { repeatWords } from '../model/repeat';
import { DETAILS_SPECS, detailsBlocker, detailsDraftOf, detailsLandedKeys, detailsPlan, detailsProblems } from '../data/details';
import { scopedChangesOf, changedWord } from '../model/scopeAsk';
import { keepDraft, dropKept } from '../onboarding/keptDraft';
import { useBackToEvent, useEditForm, useEditLock, useKeptEdit, useLeave, useSaveRun, GuardedBack, type Ask } from '../screens/EditTray';
import { useVenueCity } from '../screens/DetailsScreen';
import { WorkspaceGate } from '../screens/EventPage';
import { ScopeSheet, useScopedRun, type ScopedDone } from '../screens/ScopeSheet';
import { Sheet } from '../screens/Sheet';
import { VenueList } from '../screens/VenueList';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from './EventChoice';
import { R4Chevron } from './R4Shell';
import { EDIT_COPY, r4EditOf } from './r4EditModel';

function Lock() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="r4-in-icon">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Edit({ ws }: { ws: EventWorkspace }) {
  const c = useEventChoice();
  const today = c.today || londonTodayKey();
  const id = ws.series.id;
  const row = c.rows.find((r) => r.id === id) ?? null;
  const shape = repeatShapeOf(ws);
  const m = r4EditOf({
    row,
    repeatWords: shape.from === 'once' ? null : repeatWords(shape, today),
    wsNext: ws.dates.filter((d) => d.lifecycle_status !== 'cancelled' && d.occurrence_date >= today).map((d) => d.occurrence_date).sort()[0] ?? null,
    prices: priceRows(ws).map(priceLabel),
    pricesLock: pricesLock(ws),
  });

  // Name and Place save through the Details save (same plan, same scope ask, same kept draft).
  const kept = useKeptEdit(ws, 'details', detailsDraftOf);
  const form = useEditForm(ws, detailsDraftOf, DETAILS_SPECS, kept);
  const save = useSaveRun(id);
  const words = saveWordsFor(hasOneDate(ws.dates.length, ws.total), ws.series.lifecycle_status);
  const back = useBackToEvent(id, form.dirty);
  const lock = useEditLock(ws);
  const venues = useVenueOptions();
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
  // the leave guard (back, tabs, browser back): asks before typing is dropped, as the Details tray does
  const [ask, setAsk] = useState<Ask>(null);
  useLeave(form.dirty, setAsk);
  const { draft, set } = form;
  const city = useVenueCity(form.changed.includes('venueId') ? draft.venueId : null, venues.data);
  const problems = detailsProblems(form.base, draft);
  const blocker = detailsBlocker(form.base, draft) ?? city.problem;
  const plan = detailsPlan(form.base, draft, city.id);
  const scoped = scopedChangesOf(plan, form.changed.includes('name'));
  const scopedRun = useScopedRun(id);
  const askable = scoped.fields.length > 0 && !hasOneDate(ws.dates.length, ws.total);
  const off = !!lock || save.busy;

  const runPlain = async () => {
    const res = await save.run(plan, form.version, (v, command) => form.landed(v, detailsLandedKeys(command)));
    if (res.gated) keepDraft(id, { screen: 'details', draft, base: form.base });
    if (res.ok) { dropKept(id); form.saved(res.version); back(words.detailsSaved); }
  };
  const onSave = async () => {
    if (askable) { setAsking(true); return; }
    await runPlain();
  };
  const scopedDone = (d: ScopedDone) => {
    setAsking(false);
    dropKept(id);
    form.saved(d.scope === 'all_dates' ? d.reply.newVersion : null);
    back(d.scope === 'this_date' && d.day ? words.savedDate(d.day) : [words.detailsSavedScoped(changedWord(scoped.fields)), d.keptLine].filter(Boolean).join(' '));
  };

  const place = venueName(venues.data, draft.venueId);
  const saveWhy = lock ?? (form.dirty ? blocker : null);
  return (
    <div className="r4-stack r4-form" data-testid="r4-edit" data-id={id}>
      <div>
        <GuardedBack to={P3_PATHS.event(id)}>{null}</GuardedBack>
        <h1 className="r4-h1">Edit night</h1>
      </div>

      <div className="r4-field">
        <label htmlFor="r4-en-name" className="r4-field-l">Name</label>
        <input id="r4-en-name" className="r4-in" type="text" value={draft.name} disabled={off} autoComplete="off"
          onChange={(e) => set({ name: e.target.value })} data-testid="r4-edit-name" />
        {form.changed.includes('name') && problems.name && <p className="r4-err" role="alert">{problems.name}</p>}
      </div>

      <div className="r4-field">
        <div className="r4-grid-32">
          <div className="r4-field">
            <span className="r4-field-l" id="r4-en-date-l">Date</span>
            <Link to={P3_PATHS.eventDates(id)} className="r4-in r4-in-link" aria-labelledby="r4-en-date-l" aria-describedby="r4-en-dates-why" data-testid="r4-edit-date">{m.date ?? EDIT_COPY.noDate}</Link>
          </div>
          <div className="r4-field">
            <span className="r4-field-l" id="r4-en-starts-l">Starts</span>
            <Link to={P3_PATHS.eventDates(id)} className="r4-in r4-in-link" aria-labelledby="r4-en-starts-l" aria-describedby="r4-en-dates-why" data-testid="r4-edit-starts">{m.starts ?? (m.startsKnown ? EDIT_COPY.noTime : EDIT_COPY.timeUnknown)}</Link>
          </div>
        </div>
        <p id="r4-en-dates-why" className="r4-hint">{EDIT_COPY.datesWhy}</p>
      </div>

      <div className="r4-field">
        <span className="r4-field-l" id="r4-en-place-l">Place</span>
        <button type="button" className="r4-in r4-in-link" aria-labelledby="r4-en-place-l" disabled={off} onClick={() => setPicking(true)} data-testid="r4-edit-place">
          {place ?? (draft.venueId ? L.detailsPlaceLoading : L.notSet)}
        </button>
        {problems.venueId && <p className="r4-err" role="alert">{problems.venueId}</p>}
        {city.failed && (
          <p className="r4-err" role="alert">{L.detailsCityFail} <button type="button" className="r4-linkbtn" onClick={city.retry}>{L.detailsCityRetry}</button></p>
        )}
      </div>

      {m.price && (
        <div className="r4-field" data-testid="r4-edit-price-field">
          <span className="r4-field-l" id="r4-en-price-l">Ticket price</span>
          {m.price.locked ? (
            <div className="r4-in-wrap">
              <input className="r4-in" type="text" value={m.price.value} disabled aria-labelledby="r4-en-price-l" aria-describedby="r4-en-price-why" data-testid="r4-edit-price" />
              <Lock />
            </div>
          ) : (
            <Link to={P3_PATHS.eventPrices(id)} className="r4-in r4-in-link" aria-labelledby="r4-en-price-l" aria-describedby="r4-en-price-why" data-testid="r4-edit-price">{m.price.value}</Link>
          )}
          <p id="r4-en-price-why" className="r4-hint" data-testid="r4-edit-price-why">{m.price.locked ?? EDIT_COPY.priceWhy}</p>
        </div>
      )}

      <div className="r4-card r4-list">
        <Link to={P3_PATHS.eventAll(id)} className="r4-row" data-testid="r4-edit-repeat">
          <span className="r4-row-t">{m.repeat.words}</span>
          <span className="r4-row-end">{m.repeat.on ? 'On' : 'Off'}</span>
          <span className="r4-mut"><R4Chevron /></span>
        </Link>
      </div>

      <div className="r4-savebar" data-testid="r4-edit-savebar">
        {form.elsewhere && (
          <p className="r4-hint" role="status" data-testid="r4-edit-elsewhere">{L.changedElsewhere} <button type="button" className="r4-linkbtn" onClick={() => { form.restart(); save.forget(); scopedRun.forget(); }} data-testid="r4-edit-restart">{L.startAgain}</button></p>
        )}
        {save.error && <p className="r4-err" role="alert" data-testid="r4-edit-error">{save.error}</p>}
        {saveWhy && <p className="r4-hint" data-testid="r4-edit-why">{saveWhy}</p>}
        <button type="button" className="r4-btn r4-btn-42" disabled={!form.dirty || !!blocker || !!lock || save.busy || !plan.length}
          onClick={() => void onSave()} data-testid="r4-edit-save">
          {save.busy ? <>Saving&hellip;</> : 'Save changes'}
        </button>
      </div>

      {asking && (
        <ScopeSheet seriesId={id} fields={scoped.fields} changes={scoped.changes} unscopedChanged={scoped.unscopedChanged}
          seriesVersion={form.version} dateVersion={(d) => ws.dates.find((x) => x.id === d)?.version ?? null} run={scopedRun.send}
          onPlain={() => { setAsking(false); void runPlain(); }} onDone={scopedDone}
          onGated={() => { setAsking(false); keepDraft(id, { screen: 'details', draft, base: form.base }); }} onClose={() => setAsking(false)} />
      )}
      {ask?.kind === 'leave' && (
        <Sheet title={L.leaveTitle} onClose={() => setAsk(null)}>
          <p className="r4-sub">{L.leaveBody}</p>
          <div className="r4-section r4-pick">
            <button type="button" className="r4-btn r4-btn-42" onClick={() => setAsk(null)} data-testid="r4-edit-keep">{L.keepEditing}</button>
            <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={() => { const go = ask.go; form.undo(); setAsk(null); go(); }} data-testid="r4-edit-leave">{L.leaveGo}</button>
          </div>
        </Sheet>
      )}
      {picking && (
        <Sheet title={L.detailsPlaceSheet} onClose={() => setPicking(false)}>
          <VenueList venues={venues} testId="r4-edit-venues">
            {(list) => list.map((v) => (
              <button key={v.id} type="button" className="p3-choice" aria-pressed={v.id === draft.venueId}
                onClick={() => { set({ venueId: v.id }); setPicking(false); }}>
                <span className="p3-row-t">{v.name}</span>
                <span className="p3-row-s">{[v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </VenueList>
        </Sheet>
      )}
    </div>
  );
}

/** Board R4EditNight (flag organiserR4): the one-form Edit night. */
export function R4EditNight() {
  return <WorkspaceGate>{(ws) => <Edit key={ws.series.id} ws={ws} />}</WorkspaceGate>;
}
