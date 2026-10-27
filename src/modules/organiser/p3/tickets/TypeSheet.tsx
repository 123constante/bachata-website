import { useId, useState, type ChangeEvent } from 'react';
import { setTicketStatus, upsertTicketType } from '../../tickets/ticketsApi';
import {
  EDITOR_STEPS,
  MAX_PER_ORDER,
  NEXT_STATUS,
  buildUpsert,
  buyerTotal,
  editLock,
  formPence,
  formatPence,
  isoToLondonInput,
  paidOf,
  priceLock,
  reviewRows,
  stepErrors,
  validateForm,
  type FormErrors,
  type MoveContext,
  type TicketType,
  type TypeForm,
} from '../../tickets/ticketModel';
import { p3MoveBlock, p3Reason, type Step, type TypeDraft } from './model';
import { StackSheet } from './StackSheet';

const STEP_TITLE: Record<Step, string> = { 1: 'Name and price', 2: 'Places and dates', 3: 'Review' };

export interface TypeSheetProps {
  /** null = a new ticket type. */
  type: TicketType | null;
  /** The draft, held by the parent (draftFor) so a re-render or a refetch never resets it. */
  draft: TypeDraft;
  onDraft: (next: TypeDraft) => void;
  organiserId: string;
  seriesId: string;
  ctx: MoveContext;
  hasOrders: boolean;
  /** A one-off's start: the default "Sales close" for a new ticket (eventStartOf). */
  eventStart: string | null;
  onClose: () => void;
  /** Saved (or nothing to save, changed=false): the parent drops the draft and says the words. */
  onSaved: (announcement: string, changed: boolean) => void;
}

/**
 * Add or edit one ticket type in three steps (the shipped TypeSheet's content, in P3
 * dress): 1 name + price with the Buyer pays box, 2 places and the sales window, 3 review.
 * Back goes one step and keeps every value. An untouched edit sends nothing.
 */
export function TypeSheet({ type, draft, onDraft, organiserId, seriesId, ctx, hasOrders, eventStart, onClose, onSaved }: TypeSheetProps) {
  const { form, step, openMode, closeMode } = draft;
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'sell' | 'save' | 'close' | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const id = useId();
  const locked = editLock(type, ctx.role);
  const lockedPrice = priceLock(hasOrders);
  const patch = (p: Partial<TypeDraft>) => onDraft({ ...draft, ...p });
  const set = <K extends keyof TypeForm>(k: K, v: TypeForm[K]) => patch({ form: { ...form, [k]: v } });

  const allErrors = (): FormErrors => {
    const e = validateForm(form, { hasOrders, reserved: type?.reserved ?? 0 });
    if (openMode === 'pick' && !form.opensAt && !e.opensAt) e.opensAt = 'Pick a date and time, or choose Now.';
    if (closeMode === 'pick' && !form.closesAt && !e.closesAt) e.closesAt = 'Pick a date and time, or choose another option.';
    return e;
  };

  const next = () => {
    if (step === 3) return;
    const errs = locked ? {} : stepErrors(allErrors(), step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    patch({ step: (step + 1) as Step });
  };

  const pence = formPence(form);
  const sellBlock = p3MoveBlock({ pricePence: pence ?? 0, reserved: type?.reserved ?? 0, capacity: Number(form.capacity) || 0 }, 'on_sale', ctx);

  const submit = async (sell: boolean) => {
    if (locked) return;
    const errs = allErrors();
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length > 0) {
      patch({ step: Object.keys(stepErrors(errs, 1)).length > 0 ? 1 : 2 });
      return;
    }
    const upsert = buildUpsert(form, type, { organiserId, seriesId });
    if (!upsert) {
      onSaved('Nothing changed, so nothing was saved.', false);
      return;
    }
    setSaving(sell ? 'sell' : 'save');
    try {
      const out = await upsertTicketType(upsert);
      if (!out.ok) {
        setServerError(p3Reason(out.reason));
        return;
      }
      if (type) return onSaved('Ticket saved.', true);
      if (!sell) return onSaved('Ticket saved as a draft. Switch it to Selling when you are ready.', true);
      if (!out.id) return onSaved('Ticket saved as a draft. Switch it to Selling to put it on sale.', true);
      const st = await setTicketStatus(out.id, 'on_sale').catch(() => ({ ok: false, reason: null }));
      onSaved(st.ok ? 'Ticket added and on sale.' : `Ticket saved as a draft, not on sale yet. ${p3Reason(st.reason)}`, true);
    } catch {
      setServerError(p3Reason(null));
    } finally {
      setSaving(null);
    }
  };

  const closeForGood = async () => {
    if (!type) return;
    setSaving('close');
    setServerError(null);
    try {
      const out = await setTicketStatus(type.id, 'closed');
      if (out.ok) onSaved(`${type.name}: sales closed.`, true);
      else setServerError(p3Reason(out.reason));
    } catch {
      setServerError(p3Reason(null));
    } finally {
      setSaving(null);
    }
  };

  const input = (k: 'name' | 'price' | 'capacity' | 'opensAt' | 'closesAt', extra: Record<string, unknown> = {}) => ({
    id: `${id}-${k}`,
    value: form[k],
    disabled: !!locked,
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${id}-${k}-err` : `${id}-${k}-help`,
    className: 'p3-in',
    'data-testid': `tix-form-${k}`,
    ...extra,
  });
  const err = (k: keyof TypeForm) =>
    errors[k] ? <p id={`${id}-${k}-err`} className="p3-note p3-danger-t" data-testid={`tix-err-${k}`}>{errors[k]}</p> : null;

  const total = pence === null ? null : buyerTotal(pence);
  const canClose = !!type && !locked && NEXT_STATUS[type.status].includes('closed');
  const busy = saving !== null;

  const saveChanges = (
    <button type="button" className="p3-btn" onClick={() => void submit(false)} disabled={busy} aria-busy={saving === 'save' || undefined} data-testid="tix-save">
      {saving === 'save' ? 'Saving\u2026' : 'Save changes'}
    </button>
  );
  let footer;
  if (step < 3 && type && !locked) {
    footer = (
      <>
        {saveChanges}
        <button type="button" className="p3-btn p3-btn-line" onClick={next} data-testid="tix-next">Continue</button>
      </>
    );
  } else if (step < 3) {
    footer = <button type="button" className="p3-btn" onClick={next} data-testid="tix-next">Continue</button>;
  } else if (locked) {
    footer = <p className="p3-note" data-testid="tix-form-locked">{locked}</p>;
  } else if (type) {
    footer = saveChanges;
  } else {
    footer = (
      <>
        <button
          type="button"
          className="p3-btn"
          onClick={() => void submit(true)}
          disabled={!!sellBlock || busy}
          aria-describedby={sellBlock ? `${id}-sell` : undefined}
          aria-busy={saving === 'sell' || undefined}
          data-testid="tix-sell"
        >
          {saving === 'sell' ? 'Putting on sale\u2026' : 'Put on sale'}
        </button>
        {sellBlock && <p id={`${id}-sell`} className="p3-note" data-testid="tix-sell-reason">{sellBlock}</p>}
        <button type="button" className="p3-btn p3-btn-line" onClick={() => void submit(false)} disabled={busy} data-testid="tix-save">
          {saving === 'save' ? 'Saving\u2026' : 'Save as draft'}
        </button>
      </>
    );
  }

  return (
    <StackSheet
      full
      title={type ? 'Edit ticket' : 'Add a ticket'}
      onClose={() => {
        // A save in flight finishes here: closing now would keep the draft and allow a second save.
        if (!saving) onClose();
      }}
      viewKey={String(step)}
      onBack={step > 1 && !saving ? () => patch({ step: (step - 1) as Step }) : undefined}
      testId="tix-sheet"
      footer={
        <div className="p3-stack-s">
          {serverError && <p role="alert" className="p3-error" data-testid="tix-form-error">{serverError}</p>}
          {footer}
        </div>
      }
    >
      <div className="p3-stack-s" data-step={step} data-testid="tix-step-body">
        <div className="p3-step-head">
          <strong>{STEP_TITLE[step]}</strong>
          <span data-testid="tix-step">{step} / {EDITOR_STEPS}</span>
        </div>
        <div className="p3-steps" aria-hidden="true">
          {[1, 2, 3].map((n) => <i key={n} data-on={n <= step} />)}
        </div>
        {locked && step < 3 && <p className="p3-note" data-testid="tix-form-locked-top">{locked}</p>}

        {step === 1 && (
          <>
            <label className="p3-field" htmlFor={`${id}-name`}>Name</label>
            <input {...input('name', { maxLength: 200, autoComplete: 'off', 'data-sheet-autofocus': true })} />
            {err('name')}
            <p id={`${id}-name-help`} className="p3-note">For example Early bird, Standard or Door.</p>
            <label className="p3-field" htmlFor={`${id}-price`}>Price (&pound;)</label>
            <input
              {...input('price', {
                inputMode: 'decimal',
                placeholder: '0.00',
                disabled: !!locked || !!lockedPrice,
                onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ form: { ...form, price: e.target.value, paid: paidOf(e.target.value) } }),
              })}
            />
            {err('price')}
            <p id={`${id}-price-help`} className="p3-note" data-testid="tix-price-help">{lockedPrice ?? 'Leave empty or 0 for a free ticket.'}</p>
            <div className="p3-buyer" data-testid="tix-buyer-pays" aria-live="polite">
              <span className="p3-row-s">Buyer pays</span>
              {total === null ? (
                <span className="p3-row-t" data-testid="tix-buyer-total">Enter a price to see it</span>
              ) : (
                <>
                  <span className="p3-stat-n" data-testid="tix-buyer-total">{total.free ? 'Free' : formatPence(total.totalPence)}</span>
                  <span className="p3-row-s" data-testid="tix-buyer-line">{total.line}</span>
                </>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="p3-field" htmlFor={`${id}-capacity`}>Places</label>
            <input {...input('capacity', { inputMode: 'numeric', placeholder: '20', 'data-sheet-autofocus': true })} />
            {err('capacity')}
            <p id={`${id}-capacity-help`} className="p3-note">How many tickets in total. One order can hold up to {MAX_PER_ORDER}.</p>
            <p className="p3-field">Sales open</p>
            <div className="p3-chips" role="group" aria-label="Sales open">
              <button type="button" aria-pressed={openMode === 'now'} disabled={!!locked} data-testid="tix-open-now" onClick={() => patch({ openMode: 'now', form: { ...form, opensAt: '' } })}>Now</button>
              <button type="button" aria-pressed={openMode === 'pick'} disabled={!!locked} data-testid="tix-open-pick" onClick={() => patch({ openMode: 'pick' })}>Pick a time</button>
            </div>
            {openMode === 'pick' && (
              <>
                <label className="p3-field" htmlFor={`${id}-opensAt`}>Opens (London time)</label>
                <input {...input('opensAt', { type: 'datetime-local' })} />
              </>
            )}
            {err('opensAt')}
            <p className="p3-field">Sales close</p>
            <div className="p3-chips" role="group" aria-label="Sales close">
              {eventStart && (
                <button type="button" aria-pressed={closeMode === 'event'} disabled={!!locked} data-testid="tix-close-event" onClick={() => patch({ closeMode: 'event', form: { ...form, closesAt: isoToLondonInput(eventStart) } })}>Event start</button>
              )}
              <button type="button" aria-pressed={closeMode === 'never'} disabled={!!locked} data-testid="tix-close-never" onClick={() => patch({ closeMode: 'never', form: { ...form, closesAt: '' } })}>When I stop selling</button>
              <button type="button" aria-pressed={closeMode === 'pick'} disabled={!!locked} data-testid="tix-close-pick" onClick={() => patch({ closeMode: 'pick' })}>Pick a time</button>
            </div>
            {closeMode === 'pick' && (
              <>
                <label className="p3-field" htmlFor={`${id}-closesAt`}>Closes (London time)</label>
                <input {...input('closesAt', { type: 'datetime-local' })} />
              </>
            )}
            {err('closesAt')}
          </>
        )}

        {step === 3 && (
          <>
            <div className="p3-card p3-inset p3-tight" data-testid="tix-review">
              <ul className="p3-list p3-flush">
                <li className="p3-row"><span className="p3-row-t" data-testid="tix-review-name">{form.name.trim()}</span></li>
                {reviewRows(form, eventStart).map((r) => (
                  <li key={r.key} className="p3-row" data-testid={`tix-review-${r.key}`}>
                    <span className="p3-grow p3-row-s">{r.label}</span>
                    <span className="p3-row-t p3-plain">{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            {!type && !locked && <p className="p3-note">Save as draft keeps it hidden from buyers until you switch it to Selling.</p>}
            {canClose && (
              <div className="p3-stack-s" data-testid="tix-close-area">
                {confirmClose ? (
                  <>
                    <p className="p3-row-t p3-plain">Close sales for good? Nobody can buy this ticket again. Cannot be undone.</p>
                    <div className="p3-pair">
                      <button type="button" className="p3-btn p3-btn-line" onClick={() => setConfirmClose(false)} data-testid="tix-close-keep">Keep selling</button>
                      <button type="button" className="p3-btn p3-btn-danger" onClick={() => void closeForGood()} disabled={busy} data-testid="tix-close-confirm">
                        {saving === 'close' ? 'Closing\u2026' : 'Close sales'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="p3-btn p3-btn-line" onClick={() => setConfirmClose(true)} data-testid="tix-close">Close sales for good</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </StackSheet>
  );
}
