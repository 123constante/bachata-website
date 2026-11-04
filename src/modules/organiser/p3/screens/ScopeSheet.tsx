import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fullDate } from '../../shared/dateWords';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import { ORGANISER_HOME_KEY, seriesWorkspaceQueryKey } from '../../shared/selfServeApi';
import { commandErrorMessage, isOnboardingRefusal, isVersionConflict } from '../../shared/selfServeErrors';
import { useGatedCopy } from '../onboarding/gate';
import { heldKey, previewScope, sendScoped, type HeldKey, type ScopePreview, type ScopedReply, type ScopedRequest } from '../data/scopeAsk';
import {
  FIELD_WORD, MAX_LISTED_DATES, MORE_DATES_NOTE, previewLine, scopeChoices, type ScopeField,
} from '../model/scopeAsk';
import { keptDatesLine } from '../model/saveWords';
import { Sheet } from './Sheet';

/** What the screen needs after a scoped save landed. */
export interface ScopedDone { reply: ScopedReply; scope: 'all_dates' | 'this_date'; day: string | null; keptLine: string }
export type ScopedResult = { ok: true; done: ScopedDone } | { ok: false; error: string | null; gated: boolean };

/**
 * Sends the scoped call under a key it holds until the write lands (a retry after a dropped
 * connection is the same write) or "Start again" calls `forget`. Lives in the screen, so
 * closing and reopening the sheet keeps the key.
 */
export function useScopedRun(seriesId: string) {
  const held = useRef<HeldKey | null>(null);
  const qc = useQueryClient();
  const gated = useGatedCopy();
  const send = async (req: ScopedRequest, day: string | null, fields: readonly ScopeField[]): Promise<ScopedResult> => {
    held.current = heldKey(held.current, JSON.stringify(req));
    try {
      const reply = await sendScoped(req, held.current.key);
      held.current = null;
      const words = [...new Set(reply.keptDates.flatMap((k) => k.fields).map((f) => (f === 'venue_id' || f === 'city_id' ? FIELD_WORD.venue : FIELD_WORD[f as ScopeField] ?? FIELD_WORD[fields[0]])))];
      const keptLine = req.scope === 'all_dates' ? keptDatesLine(reply.keptDates.length, words.join(' and ') || FIELD_WORD[fields[0]]) : '';
      return { ok: true, done: { reply, scope: req.scope, day, keptLine } };
    } catch (e) {
      if (isVersionConflict(e)) held.current = null;
      return { ok: false, error: gated(e, commandErrorMessage), gated: isOnboardingRefusal(e) };
    } finally {
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      void qc.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void qc.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    }
  };
  return { send, forget: () => { held.current = null; } };
}

const TALL = { minHeight: 44 } as const;

/**
 * "Which dates?" (a Sheet), opened from Save when a scoped field changed on an event with
 * several dates. It reads the counts first; a failed read offers "Try again" and nothing that
 * writes. One future date (the read says so) saves as today, without asking. Cancel sends nothing.
 */
export function ScopeSheet({ seriesId, fields, changes, unscopedChanged, seriesVersion, dateVersion, run, onPlain, onDone, onClose }: {
  seriesId: string;
  fields: ScopeField[];
  changes: Record<string, unknown>;
  unscopedChanged: boolean;
  seriesVersion: number | null;
  dateVersion: (occurrenceId: string) => number | null;
  run: (req: ScopedRequest, day: string | null, fields: readonly ScopeField[]) => Promise<ScopedResult>;
  /** Today's save, unchanged (the plain series.upsert). */
  onPlain: () => void;
  onDone: (r: ScopedDone) => void;
  /** Gate refusal or any failed result the screen must see; the sheet shows the error itself. */
  onGated: () => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ScopePreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plain = useRef(onPlain);
  useEffect(() => { plain.current = onPlain; });
  const auto = useRef(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    previewScope(seriesId, fields).then(
      (p) => { if (live) setPreview(p); },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, attempt]);

  // fewer than two future dates: nothing to ask, today's save
  useEffect(() => {
    if (preview && preview.totals.dates < 2 && !auto.current) { auto.current = true; plain.current(); }
  }, [preview]);

  const choices = scopeChoices({ unscopedChanged });
  const go = async (req: ScopedRequest, day: string | null) => {
    setBusy(true);
    setError(null);
    const r = await run(req, day, fields);
    setBusy(false);
    if (r.ok) onDone(r.done);
    else { setError(r.error); if (r.gated) onGated(); }
  };
  const all = () => {
    if (choices.allSendsPlain) { onPlain(); return; }
    void go({ scope: 'all_dates', seriesId, changes, expectedVersion: seriesVersion }, null);
  };

  return (
    <Sheet title="Which dates?" onClose={() => { if (!busy) onClose(); }}>
      {failed && (
        <div className="p3-stack-s" data-testid="p3-scope-fail">
          <p className="p3-error" role="alert">We could not check your dates. Nothing was saved.</p>
          <button type="button" className="p3-btn" style={TALL} onClick={() => { setAttempt((n) => n + 1); }} data-testid="p3-scope-retry">Try again</button>
        </div>
      )}
      {!failed && (!preview || preview.totals.dates < 2) && <p className="p3-note" data-testid="p3-scope-loading">Checking your dates&hellip;</p>}
      {!failed && preview && preview.totals.dates >= 2 && (
        <div className="p3-stack-s" data-testid="p3-scope-ready">
          <button type="button" className="p3-choice" style={TALL} disabled={busy} onClick={all} data-testid="p3-scope-all">
            <span className="p3-row-t">All {preview.totals.dates} dates</span>
            <span className="p3-row-s" data-testid="p3-scope-line">{previewLine(preview.totals, preview.dates, fields)}</span>
          </button>
          <button type="button" className="p3-choice" style={TALL} disabled={busy || !choices.oneEnabled} aria-expanded={picking}
            onClick={() => setPicking((v) => !v)} data-testid="p3-scope-one">
            <span className="p3-row-t">Just one date</span>
            {choices.oneWhy && <span className="p3-row-s" data-testid="p3-scope-one-why">{choices.oneWhy}</span>}
          </button>
          {picking && choices.oneEnabled && (
            <div className="p3-stack-s" data-testid="p3-scope-dates">
              {preview.dates.slice(0, MAX_LISTED_DATES).map((d) => (
                <button key={d.occurrence_id} type="button" className="p3-choice" style={TALL} disabled={busy}
                  onClick={() => void go({ scope: 'this_date', seriesId, occurrenceId: d.occurrence_id, changes, expectedVersion: dateVersion(d.occurrence_id) }, fullDate(d.occurrence_date))}
                  data-testid="p3-scope-date">
                  <span className="p3-row-t">{fullDate(d.occurrence_date)}</span>
                </button>
              ))}
              {preview.dates.length > MAX_LISTED_DATES && <p className="p3-note" data-testid="p3-scope-more">{MORE_DATES_NOTE}</p>}
            </div>
          )}
        </div>
      )}
      {busy && <p className="p3-note">Saving&hellip;</p>}
      {error && <p className="p3-error" role="alert" data-testid="p3-scope-error">{error}</p>}
      <button type="button" className="p3-btn p3-btn-line" style={TALL} disabled={busy} onClick={onClose} data-testid="p3-scope-cancel">Cancel</button>
    </Sheet>
  );
}
