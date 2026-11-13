import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removePriceStep, setPriceStep } from '../../tickets/ticketsApi';
import {
  RESERVE_NOT_READY_TEXT,
  STEPS_EMPTY,
  STEPS_FREE,
  STEPS_ORDERS_NOTE,
  STEPS_TITLE,
  STEP_LIVE_NOTE,
  STEP_REMOVE_LIVE,
  addBlock,
  ambiguousNote,
  appliesLine,
  buildStepCommand,
  isAmbiguousTime,
  stepFormOf,
  stepReasonMessage,
  stepVerb,
  validateStep,
  type ManagedType,
  type PriceStep,
  type StepErrors,
  type StepForm,
} from '../../tickets/priceSteps';
import { PRESETS_HELP, PRESETS_TITLE, presetForm, type PresetsView } from '../../tickets/coursePresets';
import { useGatedCopy } from '../onboarding/gate';
import { managedKey } from './data';

/** 44px tap targets in px: the phone root font is ~13.5px, so rem sizes run small (CLAUDE.md). */
const TAP = { minHeight: 44 } as const;

export interface PriceStepsProps {
  seriesId: string;
  /** The type's row from ticket_types_manage_v1; undefined while it loads. */
  row: ManagedType | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** The sheet's has_orders (sales / orders reads); the manage row's own has_orders also counts. */
  hasOrders: boolean;
  /** T5 (flag ticketCoursePresets): the course's early-bird presets; null/absent = none shown. */
  presets?: PresetsView | null;
}

type Editing = { step: PriceStep | null; form: StepForm };

/**
 * T3: the "Price changes" block of the ticket editor (flag ticketPriceStepsEditor). Each add, move
 * and remove is its own command (ticket_price_step_set_v1 / _remove_v1), apart from the ticket's
 * Save. A refusal keeps the draft open with the server's reason; an untouched move sends nothing.
 */
export function PriceSteps({ seriesId, row, loading, failed, onRetry, hasOrders, presets }: PriceStepsProps) {
  const queryClient = useQueryClient();
  const gated = useGatedCopy();
  const id = useId();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<StepErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const alive = useRef(true);
  // In-flight guard read synchronously: two taps before a re-render must not send two commands (review r1).
  const inFlight = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);

  const head = <h4 className="p3-field" style={{ marginTop: 12 }}>{STEPS_TITLE}</h4>;
  if (loading) return <section data-testid="tix-steps">{head}<p className="p3-note">Checking price changes&hellip;</p></section>;
  if (failed || !row) {
    return (
      <section data-testid="tix-steps">
        {head}
        <p className="p3-note" data-testid="tix-steps-failed">Price changes could not be loaded.</p>
        <button type="button" className="p3-btn p3-btn-line p3-btn-sm" style={TAP} onClick={onRetry}>Try again</button>
      </section>
    );
  }

  const refetch = () => queryClient.invalidateQueries({ queryKey: managedKey(seriesId) });
  const fail = (e: unknown) => {
    const words = gated(e, () => stepReasonMessage(null));
    if (words !== null && alive.current) setServerError(words);
  };

  const open = (step: PriceStep | null, draft?: StepForm) => {
    setEditing({ step, form: draft ?? stepFormOf(step) });
    setErrors({});
    setServerError(null);
    setNote(null);
    setRemoving(null);
  };
  const setForm = (p: Partial<StepForm>) => editing && setEditing({ ...editing, form: { ...editing.form, ...p } });

  const save = async () => {
    if (!editing || inFlight.current) return;
    const errs = validateStep(editing.form);
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length > 0) return;
    const cmd = buildStepCommand(row.id, editing.form, editing.step);
    if (!cmd) {
      setEditing(null);
      setNote('Nothing changed, so nothing was saved.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const out = await setPriceStep(cmd);
      if (!alive.current) return;
      if (!out.ok) {
        // The draft stays open (reserve_not_ready included): nothing typed is lost. The list is re-read
        // (a step may have gone live, or another manager added one).
        setServerError(stepReasonMessage(out.reason));
        void refetch();
        return;
      }
      setEditing(null);
      setNote(editing.step ? 'Price change moved.' : 'Price change added.');
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const remove = async (step: PriceStep) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      const out = await removePriceStep(step.id);
      if (!alive.current) return;
      if (!out.ok) {
        setServerError(out.reason === 'step_in_past' ? STEP_REMOVE_LIVE : stepReasonMessage(out.reason));
        setRemoving(null);
        void refetch();
        return;
      }
      setRemoving(null);
      setNote('Price change removed.');
      await refetch();
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const free = row.basePricePence <= 0;
  const block = addBlock(row);
  const orders = hasOrders || row.hasOrders;

  const form = (f: StepForm) => (
    <div className="p3-stack-s" data-testid="tix-step-form">
      <label className="p3-field" htmlFor={`${id}-at`}>From (UK time)</label>
      <input
        id={`${id}-at`}
        type="datetime-local"
        className="p3-in"
        value={f.at}
        onChange={(e) => setForm({ at: e.target.value })}
        aria-invalid={errors.at ? true : undefined}
        aria-describedby={`${id}-at-help`}
        data-testid="tix-step-at"
      />
      {errors.at && <p className="p3-note p3-danger-t" data-testid="tix-step-at-err">{errors.at}</p>}
      <p id={`${id}-at-help`} className="p3-note" data-testid="tix-step-at-help">
        {!errors.at && isAmbiguousTime(f.at) && f.at !== (editing?.step ? stepFormOf(editing.step).at : '') ? ambiguousNote(f.at) : 'The new price starts at this date and time.'}
      </p>
      <label className="p3-field" htmlFor={`${id}-price`}>New price (&pound;)</label>
      <input
        id={`${id}-price`}
        className="p3-in"
        inputMode="decimal"
        placeholder="0.00"
        value={f.price}
        onChange={(e) => setForm({ price: e.target.value })}
        aria-invalid={errors.price ? true : undefined}
        data-testid="tix-step-price"
      />
      {errors.price && <p className="p3-note p3-danger-t" data-testid="tix-step-price-err">{errors.price}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="p3-btn p3-btn-sm" style={TAP} disabled={busy} onClick={() => void save()} data-testid="tix-step-save">
          {busy ? 'Saving\u2026' : editing?.step ? 'Save change' : 'Add price change'}
        </button>
        <button type="button" className="p3-btn p3-btn-line p3-btn-sm" style={TAP} disabled={busy} onClick={() => { setEditing(null); setServerError(null); }} data-testid="tix-step-cancel">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section data-testid="tix-steps" aria-labelledby={`${id}-h`}>
      <h4 id={`${id}-h`} className="p3-field" style={{ marginTop: 12 }}>{STEPS_TITLE}</h4>
      {free ? (
        <p className="p3-note" data-testid="tix-steps-free">{STEPS_FREE}</p>
      ) : (
        <>
          {orders && <p className="p3-note" data-testid="tix-steps-orders">{STEPS_ORDERS_NOTE}</p>}
          {row.steps.length === 0 && !editing && <p className="p3-note" data-testid="tix-steps-empty">{STEPS_EMPTY}</p>}
          {row.steps.length > 0 && (
            <ul className="p3-list p3-flush" data-testid="tix-steps-list">
              {row.steps.map((s, i) => (
                <li key={s.id} className="p3-stack-s" data-testid="tix-step-row" data-step-id={s.id} style={{ padding: '8px 0' }}>
                  {editing?.step?.id === s.id ? (
                    form(editing.form)
                  ) : (
                    <>
                      <span className="p3-row-t">{stepVerb(row.steps, i, row.basePricePence)}</span>
                      <span className="p3-row-s" data-testid="tix-step-applies">{appliesLine(s.effectiveFrom)}</span>
                      {s.isLive ? (
                        <span className="p3-note" data-testid="tix-step-live">{STEP_LIVE_NOTE}</span>
                      ) : removing === s.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="p3-row-s">Remove this price change?</span>
                          <button type="button" className="p3-btn p3-btn-danger p3-btn-sm" style={TAP} disabled={busy} onClick={() => void remove(s)} data-testid="tix-step-remove-yes">
                            {busy ? 'Removing\u2026' : 'Remove'}
                          </button>
                          <button type="button" className="p3-btn p3-btn-line p3-btn-sm" style={TAP} disabled={busy} onClick={() => setRemoving(null)}>Keep</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="p3-btn p3-btn-line p3-btn-sm" style={TAP} disabled={busy || !!editing} onClick={() => open(s)} data-testid="tix-step-move">Change</button>
                          <button type="button" className="p3-btn p3-btn-line p3-btn-sm" style={TAP} disabled={busy || !!editing} onClick={() => { setRemoving(s.id); setServerError(null); setNote(null); }} data-testid="tix-step-remove">Remove</button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing && !editing.step && form(editing.form)}
          {!editing && (
            <>
              <button
                type="button"
                className="p3-btn p3-btn-line"
                style={TAP}
                disabled={!!block || busy}
                aria-describedby={block ? `${id}-add-why` : undefined}
                onClick={() => open(null)}
                data-testid="tix-step-add"
              >
                Add a price change
              </button>
              {block && <p id={`${id}-add-why`} className="p3-note" data-testid="tix-step-add-why">{block}</p>}
            </>
          )}
        </>
      )}
      {presets && !editing && (
        <div className="p3-stack-s" data-testid="tix-presets">
          <h5 className="p3-field">{PRESETS_TITLE}</h5>
          {presets.blocked ? (
            <p className="p3-note" data-testid="tix-presets-blocked">{presets.blocked}</p>
          ) : (
            <>
              {presets.offered.length > 0 && <p className="p3-note">{PRESETS_HELP}</p>}
              {presets.offered.map((pr) => (
                <button key={pr.id} type="button" className="p3-btn p3-btn-line" style={TAP} disabled={busy} onClick={() => open(null, presetForm(pr))} data-testid={`tix-preset-${pr.id}`}>
                  {pr.label}
                </button>
              ))}
              {presets.skipped.map((s) => (
                <p key={s.id} className="p3-note" data-testid={`tix-preset-skipped-${s.id}`}>{s.label}: {s.why}</p>
              ))}
            </>
          )}
        </div>
      )}
      {serverError && (
        <p role="alert" className="p3-error" data-testid="tix-step-error" data-reserve={serverError === RESERVE_NOT_READY_TEXT ? 'not-ready' : undefined}>{serverError}</p>
      )}
      {note && <p className="p3-note" role="status" data-testid="tix-step-note">{note}</p>}
    </section>
  );
}
