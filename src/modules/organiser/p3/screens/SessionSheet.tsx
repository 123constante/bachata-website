import { useState } from 'react';
import { fullDate } from '../../shared/dateWords';
import { LEVEL_KEYS, SESSION_TYPES, TYPE_LABEL, endsNextDay, titleProblem, type DraftPerson } from '../../shared/programmeModel';
import { CHANGED_SESSION_REMOVE_CONFIRM, roleWord, typeWord } from '../../events/programmeSeriesModel';
import type { EventWorkspace } from '../../events/eventModel';
import { L, PROGRAMME_WHY, liveDates, programmeRules, scopeWhy, sessionTitle, shownControls, timeWord, type ProgrammeControl, type Scope } from '../model';
import { eventOf, levelLabel } from '../data/eventPage';
import {
  dateAdd, dateEdit, dateFactsFor, dateLineup, dateOff, datePeople, draftFor, draftsOf, emptyForm, everyAdd, everyEdit, everyLineup, everyRemove,
  factsOf, formOfDraft, formOfItem, isExtra, itemOf, levelsApply, peopleOfItem, sameForm, saveErrorCopy, seriesTree,
  useDateProgramme, useDateSend, useEverySend, useVenueRooms, type Built, type DateBuilt, type SessForm,
} from '../data/sessions';
import { LineupSheet } from './LineupSheet';
import { RetryButton } from './parts';
import { useGatedCopy } from '../onboarding/gate';
import { Sheet } from './Sheet';
import type { Done } from './StatusSheet';

/** A session sheet: a stored session (its P3 id, or a per-date draft key) or a new one (key null), in a scope. */
export type SessionOpen = { key: string | null; scope: Scope; date?: { id: string; date: string } | null } | null;

type Step = 'edit' | 'lineup' | 'removeAll';

function Why({ why, testId }: { why: string | null; testId: string }) {
  return why ? <p className="p3-note" data-testid={testId}>{why}</p> : null;
}

/** C3 "What is it?": the server's four kinds by their shared words; a stored kind outside them shows, pressed, read-only. */
function KindChips({ type, off, onPick }: { type: string | null; off: boolean; onPick: (t: string) => void }) {
  const list: string[] = [...SESSION_TYPES];
  if (type && !list.includes(type)) list.push(type);
  return (
    <div className="p3-chips" role="group" aria-label={L.whatIsIt} data-testid="p3-sess-kinds">
      {list.map((t) => (
        <button key={t} type="button" aria-pressed={type === t} disabled={off || !(SESSION_TYPES as readonly string[]).includes(t)}
          onClick={() => onPick(t)} data-testid={`p3-sess-kind-${t}`}>{TYPE_LABEL[t] ?? typeWord(t)}</button>
      ))}
    </div>
  );
}

/**
 * C3 session sheet + scope picker + `removeall`, and the line-up sheet as its next step.
 * Every control's on/off and reason come from model/programme.ts (programmeRules); the
 * writes from data/sessions.ts. An untouched save is disabled ("Nothing changed yet").
 */
export function SessionSheet({ ws, today, open, onClose, onDone }: {
  ws: EventWorkspace; today: string; open: NonNullable<SessionOpen>; onClose: () => void; onDone: (d: Done) => void;
}) {
  const tree = seriesTree(ws);
  // a per-date draft key 's:<id>' names the same series item as 'i:<id>'; no series item = added to one date only
  const itemKey = open.key?.startsWith('s:') ? `i:${open.key.slice(2)}` : open.key;
  const item = itemKey ? itemOf(tree, itemKey) : null;
  const extra = !!open.key && !item;
  const next = liveDates(eventOf(ws), today)[0] ?? null;
  const target = open.date ?? (next ? { id: ws.dates.find((d) => d.occurrence_date === next.date)?.id ?? '', date: next.date } : null);
  const wsDate = target ? ws.dates.find((d) => d.id === target.id) ?? null : null;
  const [scope, setScope] = useState<Scope>(open.scope);
  const [step, setStep] = useState<Step>('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = useGatedCopy();
  const prog = useDateProgramme(scope === 'date' && wsDate ? wsDate.id : null);
  const drafts = prog.data ? draftsOf(prog.data) : null;
  const draft = drafts && open.key ? draftFor(drafts, open.key) : null;
  const rooms = useVenueRooms(scope === 'every' ? ws.series.default_venue_id ?? null : null).data ?? [];
  const sendEvery = useEverySend(ws);
  const sendDate = useDateSend(ws, wsDate?.id ?? null);

  const day = target ? fullDate(target.date, today) : '';
  const facts = factsOf(ws, scope, wsDate ? dateFactsFor(wsDate, today, prog.data ?? null) : null,
    open.key ? { extra, notRunning: !!draft?.removed, stored: true } : null);
  const rules = programmeRules(facts);
  const shown = shownControls(scope, facts.item);
  const has = (c: ProgrammeControl) => shown.includes(c);

  const base: SessForm = scope === 'date' && draft ? formOfDraft(draft) : item ? formOfItem(item) : emptyForm();
  // Typing is kept while the sheet stays on the same session and scope; switching scope starts again, and says so
  // (r1 #1, #7). A new stored version under the typing is someone else's save (this sheet closes on its own): the
  // typing is KEPT and the sheet says so, with a way to start again from what is stored (W2d r2 nit A).
  const baseKey = `${scope}|${draft?.key ?? ''}`;
  const verKey = String(scope === 'date' ? prog.data?.version ?? '' : ws.series.version);
  const [edit, setEdit] = useState<{ k: string; v: string; f: SessForm } | null>(null);
  const mine = edit && edit.k === baseKey ? edit : null;
  const form = mine ? mine.f : base;
  const set = (patch: Partial<SessForm>) => setEdit({ k: baseKey, v: mine?.v ?? verKey, f: { ...form, ...patch } });
  const elsewhere = !!mine && mine.v !== verKey && !sameForm(mine.f, base);
  // the name's reason waits for the field to be left or a save to be tried (W2d r2 nit C)
  const [nameTried, setNameTried] = useState(false);
  const dirty = open.key ? !sameForm(form, base) : true;
  const typed = !!mine;
  // a NEW session needs a name in either scope (the date writer refuses one without); a stored untitled one stays as it is (r1 #2)
  const nameWhy = !open.key && !form.title.trim() ? titleProblem(form.title) : null;
  const name = open.key ? sessionTitle({ title: base.title }) : L.newSession;
  const where = scope === 'every' ? L.everyDate : `${day}${extra ? ` \u00b7 ${L.extra}` : ''}`;

  /** One write from the sheet: a problem or a refusal stays on screen as plain words. */
  const run = async (b: Built | DateBuilt, text: string) => {
    if (b.problem) { setError(b.problem); return; }
    setBusy(true);
    setError(null);
    try {
      // typing that began before someone else's save goes against the version it began on, so the save is
      // refused and "Start again" is the way forward, never a write over what the person did not see (PR #1082 r1 #1)
      const began = mine && mine.v !== '' ? Number(mine.v) : null;
      if ('command' in b) { if (b.command) await sendEvery(b.command, began ?? ws.series.version); }
      else if (b.payload && prog.data) await sendDate(began ?? prog.data.version, b.payload);
      onDone({ text, undo: null });
    } catch (e) {
      setError(gated(e, saveErrorCopy));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (scope === 'every') return run(itemKey ? everyEdit(tree, itemKey, form, rooms) : everyAdd(tree, form, rooms), open.key ? L.savedEvery : L.addedEvery);
    if (!drafts) return undefined;
    return run(draft ? dateEdit(drafts, draft.key, form) : dateAdd(drafts, form), draft ? L.savedDate(day) : L.addedDate(day));
  };

  const people: DraftPerson[] = scope === 'date' ? (draft ? datePeople(draft) : []) : item ? peopleOfItem(item) : [];
  const saveLineup = (list: DraftPerson[]) => {
    if (scope === 'every' && itemKey) return run(everyLineup(tree, itemKey, list), L.lineupSaved(L.everyDate.toLowerCase()));
    if (drafts && draft) return run(dateLineup(drafts, draft.key, list), L.lineupSaved(`${day} only`));
    return undefined;
  };

  if (step === 'lineup') {
    return (
      <LineupSheet name={name} where={where} type={form.type} initial={people} why={rules.lineup} busy={busy} error={error}
        onSave={(l) => void saveLineup(l)} onBack={() => { setError(null); setStep('edit'); }} />
    );
  }

  if (step === 'removeAll') {
    const n = liveDates(eventOf(ws), today).length;
    return (
      <Sheet title={L.removeAllTitle(name)} onClose={onClose}>
        <p className="p3-mut" data-testid="p3-removeall-body">{L.removeAllBody(n)}</p>
        <p className="p3-note" data-testid="p3-removeall-changed">{CHANGED_SESSION_REMOVE_CONFIRM}</p>
        <p className="p3-note">{L.removeAllHint}</p>
        {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
        <div className="p3-stack-s">
          <button type="button" className="p3-btn p3-btn-danger" disabled={busy || !!rules.removeAll}
            onClick={() => itemKey && void run(everyRemove(tree, itemKey), L.removedEvery)} data-testid="p3-removeall-yes">{L.removeAllYes}</button>
          <button type="button" className="p3-btn p3-btn-line" onClick={() => setStep('edit')} data-testid="p3-removeall-keep">{L.keepIt}</button>
        </div>
      </Sheet>
    );
  }

  const scopeOff = scopeWhy(facts);
  const loading = scope === 'date' && !!wsDate && prog.isPending;
  const lost = scope === 'date' && !!drafts && !!open.key && !draft;
  const everyWhy = extra ? PROGRAMME_WHY.everyOnly : null;
  const dateWhy = !target ? L.noComing : null;
  const nd = endsNextDay(form.start || null, form.end || null);
  const fieldsOff = !!rules.save || busy;
  const live = (people ?? []).filter((p) => !p.removed);

  return (
    <Sheet title={open.key ? name : L.newSession} onClose={onClose}>
      <p className="p3-note" data-testid="p3-sess-where">{`${ws.series.name.trim() || L.noName} \u00b7 ${where}`}</p>
      <div className="p3-stack-s" role="radiogroup" aria-label={L.whichDates} data-testid="p3-sess-scope">
        <button type="button" role="radio" className="p3-choice" aria-checked={scope === 'every'} disabled={!!everyWhy || busy}
          onClick={() => { setError(null); setScope('every'); }} data-testid="p3-scope-every">
          <span className="p3-row-t">{L.everyDate}</span>
          <span className="p3-row-s">{everyWhy ?? L.everyDateSub}</span>
        </button>
        <button type="button" role="radio" className="p3-choice" aria-checked={scope === 'date'} disabled={!!dateWhy || busy}
          onClick={() => { setError(null); setScope('date'); }} data-testid="p3-scope-date">
          <span className="p3-row-t">{target ? L.justDate(day) : L.thisOnly}</span>
          <span className="p3-row-s">{dateWhy ?? L.justDateSub}</span>
        </button>
      </div>
      {typed && <p className="p3-note" data-testid="p3-sess-scope-clears">{L.scopeClears}</p>}
      {scopeOff && !loading && <p className="p3-warn" data-testid="p3-sess-why">{scopeOff}</p>}
      {loading ? <p className="p3-note" data-testid="p3-sess-loading">{L.loadingSessions}</p> : prog.isError && scope === 'date' ? (
        <div className="p3-stack-s"><p className="p3-error" role="alert">{L.sessionsLoadFail}</p><RetryButton onClick={() => void prog.refetch()} /></div>
      ) : lost ? (
        <p className="p3-warn" data-testid="p3-sess-lost">{L.sessionsLoadFail}</p>
      ) : facts.item?.notRunning && scope === 'date' ? (
        <div className="p3-stack-s" data-testid="p3-sess-off">
          <p className="p3-mut">{L.notRunningBody(day)}</p>
          {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
          <button type="button" className="p3-btn" disabled={busy || !!rules.notRunning}
            onClick={() => drafts && draft && void run(dateOff(drafts, draft.key, false), L.backDate(day))} data-testid="p3-sess-bringback">{L.bringBackSess}</button>
          <Why why={rules.notRunning} testId="p3-why-notRunning" />
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>{L.leaveOff}</button>
        </div>
      ) : (
        <>
          {has('kind') && (
            <>
              <span className="p3-field">{L.whatIsIt}</span>
              <KindChips type={form.type} off={!!rules.kind || busy} onPick={(t) => set({ type: t })} />
              <Why why={scopeOff ? null : rules.kind} testId="p3-why-kind" />
            </>
          )}
          <label className="p3-field" htmlFor="p3-sess-name">{L.sessName}</label>
          <input id="p3-sess-name" className="p3-in" value={form.title} disabled={fieldsOff} autoComplete="off" placeholder={L.namePlaceholder}
            onChange={(e) => set({ title: e.target.value })} onBlur={() => setNameTried(true)} data-testid="p3-sess-name" />
          {elsewhere && (
            <div className="p3-warn" role="status" data-testid="p3-sess-elsewhere">
              <p className="p3-plain">{L.changedElsewhere}</p>
              <button type="button" className="p3-link" onClick={() => setEdit(null)} data-testid="p3-sess-start-again">{L.startAgain}</button>
            </div>
          )}
          <div className="p3-pair">
            <div>
              <label className="p3-field" htmlFor="p3-sess-start">{L.starts}</label>
              <input id="p3-sess-start" className="p3-in" type="time" step={900} value={form.start} disabled={fieldsOff}
                onChange={(e) => set({ start: e.target.value })} data-testid="p3-sess-start" />
            </div>
            <div>
              <label className="p3-field" htmlFor="p3-sess-end">{L.ends}</label>
              <input id="p3-sess-end" className="p3-in" type="time" step={900} value={form.end} disabled={fieldsOff}
                onChange={(e) => set({ end: e.target.value })} data-testid="p3-sess-end" />
            </div>
          </div>
          {nd && <p className="p3-note" data-testid="p3-sess-nextday">{L.endsNextDayAt(timeWord(form.end))}</p>}
          {scope === 'every' && rooms.length > 1 ? (
            <>
              <span className="p3-field">{L.room}</span>
              <div className="p3-chips" role="group" aria-label={L.room} data-testid="p3-sess-rooms">
                {rooms.map((r) => (
                  <button key={r.id} type="button" aria-pressed={form.roomId === r.id} disabled={fieldsOff}
                    onClick={() => set({ roomId: form.roomId === r.id ? null : r.id })}>{r.name}</button>
                ))}
              </div>
            </>
          ) : item && typeof item.raw.room === 'string' && item.raw.room.trim() ? (
            <p className="p3-note" data-testid="p3-sess-room">{`${L.room}: ${item.raw.room.trim()}`}</p>
          ) : null}
          {levelsApply(form.type) && (
            <>
              <span className="p3-field">{L.level}</span>
              <div className="p3-chips" role="group" aria-label={L.level} data-testid="p3-sess-levels">
                {LEVEL_KEYS.map((k) => (
                  <button key={k} type="button" aria-pressed={form.levels.includes(k)} disabled={fieldsOff}
                    onClick={() => set({ levels: form.levels.includes(k) ? form.levels.filter((x) => x !== k) : [...form.levels, k] })}>{levelLabel(k)}</button>
                ))}
              </div>
            </>
          )}
          <span className="p3-field">{L.lineup}</span>
          <div className="p3-card p3-tight" data-testid="p3-sess-lineup">
            {live.length
              ? <ul className="p3-list p3-flush">{live.map((p) => <li key={`${p.id}|${p.role}`} className="p3-row"><span className="p3-grow p3-row-t">{p.name}</span><span className="p3-row-s">{roleWord(p.role)}</span></li>)}</ul>
              : <p className="p3-note p3-pad">{open.key ? L.nobodyYet : L.lineupAfterAdd}</p>}
          </div>
          {has('lineup') && (
            <>
              <button type="button" className="p3-btn p3-btn-line" disabled={!!rules.lineup || busy} onClick={() => { setError(null); setStep('lineup'); }} data-testid="p3-sess-lineup-open">{L.changeLineup}</button>
              <Why why={scopeOff ? null : rules.lineup} testId="p3-why-lineup" />
            </>
          )}
          {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
          <div className="p3-stack-s p3-gap-t">
            <button type="button" className="p3-btn" disabled={!dirty || !!rules.save || busy || (scope === 'date' && !drafts)}
              onClick={() => { if (nameWhy) { setNameTried(true); return; } void save(); }} data-testid="p3-sess-save">
              {!open.key ? L.addThisSession : !dirty ? L.nothingChanged : scope === 'every' ? L.saveAll : L.saveOne}
            </button>
            <Why why={rules.save || !nameTried ? null : nameWhy} testId="p3-why-name" />
            {!open.key && <button type="button" className="p3-btn p3-btn-line" onClick={onClose} data-testid="p3-sess-dontadd">{L.dontAdd}</button>}
            {has('removeAll') && (
              <>
                <button type="button" className="p3-btn p3-btn-line p3-danger-t" disabled={!!rules.removeAll || busy} onClick={() => { setError(null); setStep('removeAll'); }} data-testid="p3-sess-removeall">{L.removeAll}</button>
                <Why why={scopeOff ? null : rules.removeAll} testId="p3-why-removeAll" />
              </>
            )}
            {has('removeOne') && (
              <>
                <button type="button" className="p3-btn p3-btn-line p3-danger-t" disabled={!!rules.removeOne || busy}
                  onClick={() => drafts && draft && void run(dateOff(drafts, draft.key, true), L.removedDate(day))} data-testid="p3-sess-removeone">{L.removeOne}</button>
                <Why why={scopeOff ? null : rules.removeOne} testId="p3-why-removeOne" />
              </>
            )}
            {has('notRunning') && (
              <>
                <button type="button" className="p3-btn p3-btn-line" disabled={!!rules.notRunning || busy}
                  onClick={() => drafts && draft && void run(dateOff(drafts, draft.key, true), L.offDate(day))} data-testid="p3-sess-notrunning">{L.notRunning}</button>
                <p className="p3-note">{L.notRunningNote}</p>
              </>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * The date sheet's per-date session rows (organiser_get_occurrence_programme_v1): each
 * opens the session sheet on "Just this date"; "Add a session to this date only" under them.
 */
export function DateSessions({ ws, today, date, onDone }: {
  ws: EventWorkspace; today: string; date: { id: string; occurrence_date: string; lifecycle_status: string }; onDone: (d: Done) => void;
}) {
  const prog = useDateProgramme(date.id);
  const [open, setOpen] = useState<SessionOpen>(null);
  const facts = factsOf(ws, 'date', dateFactsFor(date, today, prog.data ?? null), null);
  const addWhy = programmeRules(facts).add;
  const at = { id: date.id, date: date.occurrence_date };
  const drafts = prog.data ? draftsOf(prog.data) : [];
  return (
    <section aria-label={L.sessionsDate} data-testid="p3-date-sessions">
      <span className="p3-field">{L.sessionsDate}</span>
      {prog.isPending ? <p className="p3-note">{L.loadingSessions}</p> : prog.isError ? (
        <div className="p3-stack-s"><p className="p3-error" role="alert">{L.sessionsLoadFail}</p><RetryButton onClick={() => void prog.refetch()} /></div>
      ) : (
        <div className="p3-card p3-tight">
          {drafts.length ? (
            <ul className="p3-list p3-flush">
              {drafts.map((d) => (
                <li key={d.key} className="p3-row p3-row-btn" data-testid="p3-date-session">
                  <button type="button" className="p3-date-btn" onClick={() => setOpen({ key: d.key, scope: 'date', date: at })} data-testid="p3-open-date-session">
                    <span className="p3-time">{d.start ? timeWord(d.start) : L.noTime}</span>
                    <span className={`p3-grow p3-row-t ${d.removed ? 'p3-struck' : ''}`}>{sessionTitle({ title: d.title })}</span>
                    {d.removed && <span className="p3-tag p3-tag-cancel">{isExtra(d) ? L.removedTag : L.notRunningTag}</span>}
                    {!d.removed && isExtra(d) && <span className="p3-tag p3-tag-warn">{L.extraTag}</span>}
                    <span aria-hidden="true">&rsaquo;</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="p3-note p3-pad">{addWhy ? L.noSessions : L.noSessionsDate}</p>}
        </div>
      )}
      <div className="p3-stack-s p3-gap-t">
        <button type="button" className="p3-btn p3-btn-line" disabled={!!addWhy} onClick={() => setOpen({ key: null, scope: 'date', date: at })} data-testid="p3-date-add-session">{L.addSessOne}</button>
        {addWhy && !prog.isPending && <p className="p3-note" data-testid="p3-date-add-session-why">{addWhy}</p>}
      </div>
      {open && <SessionSheet ws={ws} today={today} open={open} onClose={() => setOpen(null)} onDone={(d) => { setOpen(null); onDone(d); }} />}
    </section>
  );
}
