import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EventWorkspace } from '../../events/eventModel';
import { fullDate, WEEKDAY_NAMES } from '../../shared/dateWords';
import { saveButton } from '../model';
import {
  NTH_CHOICES, PREVIEW_EMPTY, REPEAT_COPY, REPEAT_MAX, WEEK_ORDER, addMonthsKey, blankDraft, courseFacts, courseLine, defaultWeekday,
  draftOfRule, draftSig, parsePreview, previewCommand, previewFailure, previewLines, repeatAccess, repeatFailure, repeatPlan, repeatProblem,
  noRuleNote, repeatSentence, repeatStart, repeatWords, type RepeatDraft, type RepeatEnd, type RepeatPreview,
} from '../model/repeat';
import type { PreviewRepeat } from '../data/repeat';
import { repeatShapeOf } from '../data/dateFacts';
import { newIdempotencyKey } from '../../shared/seriesCommands';
import { useGatedCopy } from '../onboarding/gate';
import { Sheet } from './Sheet';
import type { SendOnce } from './CancelEventSheet';
import type { Done } from './StatusSheet';

/** The sheet and its scrim go to document.body, inside their own p3-theme (the frame's light or dark). */
function OnBody({ children }: { children: ReactNode }) {
  const theme = document.querySelector('.p3-frame')?.getAttribute('data-theme') ?? undefined;
  return createPortal(<div className="p3-theme p3-portal" data-theme={theme}>{children}</div>, document.body);
}

type PreviewState =
  | { key: string; state: 'ok'; data: RepeatPreview }
  | { key: string; state: 'error'; text: string };

const pressed = (on: boolean) => ({ 'aria-pressed': on });

function Editor({ d, set, today, off }: { d: RepeatDraft; set: (p: Partial<RepeatDraft>) => void; today: string; off: boolean }) {
  const [more, setMore] = useState(d.interval !== 1);
  const unit = d.freq === 'weekly' ? 'weeks' : 'months';
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const ends: Array<[RepeatEnd, string]> = [['none', 'Keeps going'], ['after_count', 'Stops after'], ['until_date', 'Stops on a date']];
  return (
    <div className="p3-stack-s" data-testid="p3-repeat-editor">
      <div className="p3-seg p3-seg2" role="group" aria-label="How often">
        <button type="button" disabled={off} {...pressed(d.freq === 'weekly')} onClick={() => set({ freq: 'weekly' })}>Every week</button>
        <button type="button" disabled={off} {...pressed(d.freq === 'monthly')} onClick={() => set({ freq: 'monthly' })}>Every month</button>
      </div>
      {d.freq === 'weekly' ? (
        <>
          <p className="p3-field" id="p3-repeat-days">On which days?</p>
          <div className="p3-chips" role="group" aria-labelledby="p3-repeat-days" data-testid="p3-repeat-days">
            {WEEK_ORDER.map((w) => (
              <button key={w} type="button" disabled={off} aria-label={WEEKDAY_NAMES[w]} {...pressed(d.weekdays.includes(w))}
                onClick={() => set({ weekdays: toggle(d.weekdays, w).sort((a, b) => a - b) })}>
                {WEEKDAY_NAMES[w].slice(0, 3)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="p3-seg p3-seg2" role="group" aria-label="Which day of the month">
            <button type="button" disabled={off} {...pressed(d.monthBy === 'nth')} onClick={() => set({ monthBy: 'nth' })}>On a weekday</button>
            <button type="button" disabled={off} {...pressed(d.monthBy === 'day')} onClick={() => set({ monthBy: 'day' })}>On a date</button>
          </div>
          {d.monthBy === 'day' ? (
            <>
              <label className="p3-field" htmlFor="p3-repeat-day">Day of the month (1 to 31)</label>
              <input disabled={off} id="p3-repeat-day" className="p3-in" type="number" inputMode="numeric" min={1} max={31} value={Number.isNaN(d.day) ? '' : d.day}
                onChange={(e) => set({ day: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
            </>
          ) : (
            <>
              <p className="p3-field" id="p3-repeat-nths">Which weeks? (pick one or more)</p>
              <div className="p3-chips" role="group" aria-labelledby="p3-repeat-nths" data-testid="p3-repeat-nths">
                {NTH_CHOICES.map((c) => (
                  <button key={c.n} type="button" disabled={off} {...pressed(d.nths.includes(c.n))} onClick={() => set({ nths: toggle(d.nths, c.n) })}>{c.label}</button>
                ))}
              </div>
              <p className="p3-field" id="p3-repeat-wd">Which day?</p>
              <div className="p3-chips" role="group" aria-labelledby="p3-repeat-wd">
                {WEEK_ORDER.map((w) => (
                  <button key={w} type="button" disabled={off} aria-label={WEEKDAY_NAMES[w]} {...pressed(d.weekday === w)} onClick={() => set({ weekday: w })}>
                    {WEEKDAY_NAMES[w].slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <p className="p3-field" id="p3-repeat-end">How it ends</p>
      <div className="p3-seg" role="group" aria-labelledby="p3-repeat-end" data-testid="p3-repeat-ends">
        {ends.map(([k, label]) => <button key={k} type="button" disabled={off} {...pressed(d.end === k)} onClick={() => set({ end: k })}>{label}</button>)}
      </div>
      {d.end === 'after_count' && (
        <>
          <label className="p3-field" htmlFor="p3-repeat-count">How many times in all (1 to {REPEAT_MAX.count})</label>
          <input disabled={off} id="p3-repeat-count" className="p3-in" type="number" inputMode="numeric" min={1} max={REPEAT_MAX.count} value={Number.isNaN(d.count) ? '' : d.count}
            onChange={(e) => set({ count: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
        </>
      )}
      {d.end === 'until_date' && (
        <>
          <label className="p3-field" htmlFor="p3-repeat-until">Last date (up to 2 years ahead)</label>
          <input disabled={off} id="p3-repeat-until" className="p3-in" type="date" min={today} max={addMonthsKey(today, REPEAT_MAX.months)} value={d.until}
            onChange={(e) => set({ until: e.target.value })} />
        </>
      )}
      <button type="button" disabled={off} className="p3-link" aria-expanded={more} onClick={() => setMore((m) => !m)} data-testid="p3-repeat-more">More options</button>
      {more && (
        <>
          <label className="p3-field" htmlFor="p3-repeat-interval">Repeat every</label>
          <select disabled={off} id="p3-repeat-interval" className="p3-in" value={d.interval} onChange={(e) => set({ interval: Number(e.target.value) })}>
            {Array.from({ length: REPEAT_MAX.interval }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n === 1 ? `Every ${unit.slice(0, -1)}` : `Every ${n} ${unit}`}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

/**
 * C3 Repeat sheet (W3c-1). The editor opens on the stored rule; every change asks the server for a
 * dry run (series.set_recurrence + dry_run) and shows the next 8 dates and what moves. Save sends
 * the same payload without dry_run, once; an untouched sheet sends nothing. A course shows the
 * editor greyed with what to do instead; a pattern only the team sets, and a closed event, show
 * the pattern with why; a one-off and a festival say they do not repeat.
 */
export function RepeatSheet({ ws, today, send, preview, onDone, onClose }: {
  ws: EventWorkspace;
  today: string;
  /** The one-command save goes under a key held per draft (as the Status sheet's cancel): a retry after a dropped connection is the same write. */
  send: SendOnce;
  preview: PreviewRepeat;
  onDone: (d: Done) => void;
  onClose: () => void;
}) {
  const s = ws.series;
  const access = repeatAccess({ format: s.format, lifecycle: s.lifecycle_status, rule: s.recurrence_rule });
  const shape = repeatShapeOf(ws);
  const note = noRuleNote(shape);
  const next = ws.dates.filter((x) => x.lifecycle_status !== 'cancelled' && x.occurrence_date >= today).map((x) => x.occurrence_date).sort()[0] ?? null;
  const [base] = useState<RepeatDraft>(() => draftOfRule(s.recurrence_rule, defaultWeekday(next)) ?? blankDraft(defaultWeekday(next)));
  const [draft, setDraft] = useState<RepeatDraft>(base);
  const [pv, setPv] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = useGatedCopy();
  // the dry-run preview re-asks the server on every change: it opens the gate at most once per sheet (Save, every time)
  const gatedPreview = useGatedCopy({ once: true });
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const held = useRef<{ sig: string; key: string } | null>(null);

  const sig = draftSig(draft);
  const changed = sig !== draftSig(base);
  const start = repeatStart(s);
  const problem = repeatProblem(draft, today, start);
  const plan = repeatPlan(access, base, draft, today, start);
  const wantPreview = access.mode === 'edit' && changed && !problem;

  // What the preview answers is keyed by the draft's meaning and the retry count: an answer for an
  // older draft is never shown, so "checking" is derived, never set from here.
  const key = `${sig}#${nonce}`;
  useEffect(() => {
    if (!wantPreview) return undefined;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      preview(previewCommand(draft)).then(
        (raw) => { if (seq.current === mine) setPv({ key, state: 'ok', data: parsePreview(raw) }); },
        // a refused dry run opens the A1 gate; the preview then reads "not checked yet" with its Check again (P3-GATE)
        (e) => { if (seq.current === mine) setPv({ key, state: 'error', text: gatedPreview(e, previewFailure) ?? REPEAT_COPY.previewNeeded }); },
      );
    }, 350);
    return () => { clearTimeout(t); seq.current += 1; };
    // the draft is read through key (its meaning plus the retry count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wantPreview]);

  const set = (p: Partial<RepeatDraft>) => { setError(null); setDraft((d) => ({ ...d, ...p })); };
  const shown = wantPreview && pv && pv.key === key ? pv : null;
  const checking = wantPreview && !shown;
  // Save waits for a GOOD answer: a failed dry run (refused, or the phone offline) never showed
  // what the change removes, so Check again is the way on (review F2).
  const failed = shown?.state === 'error';
  const btn = saveButton({
    changed: plan.length || (changed && problem) ? 1 : 0,
    problem: problem ?? (checking ? REPEAT_COPY.checking : failed ? REPEAT_COPY.previewNeeded : null),
    lock: access.mode === 'edit' ? null : access.why,
    busy,
    labels: { save: REPEAT_COPY.save, nothing: access.mode === 'disabled' ? REPEAT_COPY.cantHere : REPEAT_COPY.nothing },
  });

  const save = async () => {
    if (!plan.length || checking || failed) return;
    setBusy(true);
    setError(null);
    if (held.current?.sig !== sig) held.current = { sig, key: newIdempotencyKey() };
    try {
      const res = await send(plan[0], held.current.key);
      held.current = null;
      onDone({ text: REPEAT_COPY.saved, undo: null, version: typeof res?.new_version === 'number' ? res.new_version : null });
    } catch (e) {
      setError(gated(e, repeatFailure));
    } finally {
      setBusy(false);
    }
  };

  const course = s.format === 'course' ? courseFacts(ws, today) : null;

  if (access.mode === 'readonly' || access.mode === 'none') {
    return (
      <OnBody>
        <Sheet title={REPEAT_COPY.title} onClose={onClose}>
          <div className="p3-card p3-inset" data-testid="p3-repeat-current">{repeatWords(shape, today)}</div>
          {course && <p className="p3-note" data-testid="p3-repeat-course">{courseLine(course, today)}</p>}
          <p className="p3-note" data-testid="p3-repeat-why">{access.why}</p>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>OK</button>
        </Sheet>
      </OnBody>
    );
  }

  return (
    <OnBody>
      <Sheet title={REPEAT_COPY.title} onClose={onClose}>
        <div className="p3-sheet-body p3-stack-s">
          {course && <p className="p3-row-t" data-testid="p3-repeat-course">{courseLine(course, today)}</p>}
          {access.mode === 'disabled' && <p className="p3-warn" id="p3-repeat-why" data-testid="p3-repeat-why">{access.why}</p>}
          {access.mode === 'edit' && note && !changed && <p className="p3-note" data-testid="p3-repeat-norule">{note}</p>}
          <fieldset className="p3-ask" disabled={access.mode !== 'edit' || busy} aria-describedby={access.mode === 'disabled' ? 'p3-repeat-why' : undefined}>
            <legend className="p3-sr">How it repeats</legend>
            <Editor d={draft} set={set} today={today} off={access.mode !== 'edit' || busy} />
          </fieldset>
          <div className="p3-card p3-inset" data-testid="p3-repeat-sentence">{repeatSentence(draft, today)}</div>
          {wantPreview && (
            <div className="p3-stack-s" aria-live="polite" data-testid="p3-repeat-preview">
              {!shown ? <p className="p3-note">{REPEAT_COPY.checking}</p>
                : shown.state === 'error' ? (
                  <>
                    <p className="p3-error" role="alert" data-testid="p3-repeat-preview-error">{shown.text}</p>
                    <button type="button" className="p3-btn p3-btn-line" onClick={() => setNonce((n) => n + 1)}>{REPEAT_COPY.retry}</button>
                  </>
                ) : (
                  <>
                    {previewLines(shown.data).map((l) => (
                      <p key={l.key} className={l.tone === 'danger' ? 'p3-error' : 'p3-note'} data-testid={`p3-repeat-line-${l.key}`}>{l.text}</p>
                    ))}
                    <p className="p3-field">{REPEAT_COPY.next}</p>
                    {shown.data.next.length ? (
                      <ul className="p3-plain-list" data-testid="p3-repeat-next">
                        {shown.data.next.map((x) => <li key={x}>{fullDate(x, today)}</li>)}
                      </ul>
                    ) : <p className="p3-note" data-testid="p3-repeat-next-empty">{PREVIEW_EMPTY}</p>}
                  </>
                )}
            </div>
          )}
        </div>
        <div className="p3-sheet-foot">
          <div className="p3-stack-s">
            {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
            {btn.why && access.mode === 'edit' && <p className="p3-note" data-testid="p3-repeat-save-why">{btn.why}</p>}
            <button type="button" className="p3-btn" disabled={!btn.enabled} data-testid="p3-repeat-save" onClick={() => void save()}>{btn.label}</button>
            {changed && access.mode === 'edit' && (
              <button type="button" className="p3-link" onClick={() => { setError(null); setDraft(base); }} data-testid="p3-repeat-undo">{REPEAT_COPY.undo}</button>
            )}
          </div>
        </div>
      </Sheet>
    </OnBody>
  );
}
