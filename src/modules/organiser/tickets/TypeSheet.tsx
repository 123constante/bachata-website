import { useId, useState, type ChangeEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { Chip, FIELD_CLASS, Field, GhostButton, PrimaryButton, SheetView, useShake } from '../ui';
import { Reason } from './parts';
import { setTicketStatus, upsertTicketType } from './ticketsApi';
import {
  EDITOR_STEPS,
  MAX_PER_ORDER,
  NEXT_STATUS,
  buildUpsert,
  buyerTotal,
  editLock,
  formOf,
  formPence,
  formatPence,
  isoToLondonInput,
  moveBlock,
  paidOf,
  priceLock,
  reasonMessage,
  reviewRows,
  stepErrors,
  validateForm,
  type FormErrors,
  type MoveContext,
  type TicketType,
  type TypeForm,
} from './ticketModel';

export interface TypeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = a new ticket type. */
  type: TicketType | null;
  organiserId: string;
  seriesId: string;
  /** Role, Stripe and series state: decides whether Put on sale can be pressed (moveBlock). */
  ctx: MoveContext;
  hasOrders: boolean;
  /** A one-off's start: the default "Sales close" for a new ticket (eventStartOf). */
  eventStart: string | null;
  onSaved: (announcement: string) => void;
  /** The control that opened the sheet (useOpenerRef in the parent). */
  returnFocusRef: RefObject<HTMLElement>;
}

type Step = 1 | 2 | 3;
type OpenMode = 'now' | 'pick';
type CloseMode = 'event' | 'never' | 'pick';
const STEP_TITLE: Record<Step, string> = { 1: 'Name and price', 2: 'Places and dates', 3: 'Review' };

/**
 * Add or edit one ticket type in three short steps (mockup B): 1 name + price with the
 * live Buyer pays box, 2 places and the sales window, 3 review. Back keeps every value.
 * An untouched edit sends nothing.
 */
export function TypeSheet({ open, onOpenChange, type, organiserId, seriesId, ctx, hasOrders, eventStart, onSaved, returnFocusRef }: TypeSheetProps) {
  const [form, setForm] = useState<TypeForm>(() => {
    const f = formOf(type);
    return type || !eventStart ? f : { ...f, closesAt: isoToLondonInput(eventStart) };
  });
  const [step, setStep] = useState<Step>(1);
  const [openMode, setOpenMode] = useState<OpenMode>(() => (form.opensAt ? 'pick' : 'now'));
  const [closeMode, setCloseMode] = useState<CloseMode>(() =>
    !form.closesAt ? 'never' : eventStart && form.closesAt === isoToLondonInput(eventStart) ? 'event' : 'pick',
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'sell' | 'save' | 'close' | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const { shake, shakeProps } = useShake();
  const id = useId();
  const locked = editLock(type, ctx.role);
  const lockedPrice = priceLock(hasOrders);
  const set = <K extends keyof TypeForm>(k: K, v: TypeForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** Every error, plus "pick a time" for a Pick a time chip left empty. */
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
    if (Object.keys(errs).length > 0) {
      shake();
      return;
    }
    setStep((step + 1) as Step);
  };

  const pence = formPence(form);
  const sellBlock = moveBlock({ pricePence: pence ?? 0, reserved: type?.reserved ?? 0, capacity: Number(form.capacity) || 0 }, 'on_sale', ctx);

  const submit = async (sell: boolean) => {
    if (locked) return;
    const errs = allErrors();
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length > 0) {
      setStep(Object.keys(stepErrors(errs, 1)).length > 0 ? 1 : 2);
      shake();
      return;
    }
    const draft = buildUpsert(form, type, { organiserId, seriesId });
    if (!draft) {
      onSaved('Nothing changed, so nothing was saved.');
      return;
    }
    setSaving(sell ? 'sell' : 'save');
    try {
      const out = await upsertTicketType(draft);
      if (!out.ok) {
        setServerError(reasonMessage(out.reason));
        shake();
        return;
      }
      if (type) return onSaved('Ticket saved.');
      if (!sell) return onSaved('Ticket saved as a draft. Switch it to Selling when you are ready.');
      if (!out.id) return onSaved('Ticket saved as a draft. Switch it to Selling to put it on sale.');
      const st = await setTicketStatus(out.id, 'on_sale').catch(() => ({ ok: false, reason: null }));
      onSaved(st.ok ? 'Ticket added and on sale.' : `Ticket saved as a draft, not on sale yet. ${reasonMessage(st.reason)}`);
    } catch {
      setServerError(reasonMessage(null));
      shake();
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
      if (out.ok) onSaved(`${type.name}: sales closed.`);
      else setServerError(reasonMessage(out.reason));
    } catch {
      setServerError(reasonMessage(null));
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
    className: `${FIELD_CLASS} h-[48px]`,
    'data-testid': `tix-form-${k}`,
    ...extra,
  });

  const total = pence === null ? null : buyerTotal(pence);
  const canClose = !!type && !locked && NEXT_STATUS[type.status].includes('closed');

  const saveChanges = (
    <PrimaryButton block testId="tix-save" onClick={() => void submit(false)} loading={saving === 'save'} loadingLabel="Saving" disabled={saving !== null}>
      Save changes
    </PrimaryButton>
  );
  let footer;
  if (step < 3 && type && !locked) {
    // An edit saves from any step: raising places is open, change, save (no walk to the review).
    footer = (
      <div className="space-y-[8px]">
        {saveChanges}
        <GhostButton block testId="tix-next" onClick={next}>
          Continue
        </GhostButton>
      </div>
    );
  } else if (step < 3) {
    footer = (
      <PrimaryButton block testId="tix-next" onClick={next}>
        Continue
      </PrimaryButton>
    );
  } else if (locked) {
    footer = <Reason id={`${id}-locked`} testId="tix-form-locked">{locked}</Reason>;
  } else if (type) {
    footer = saveChanges;
  } else {
    footer = (
      <div className="space-y-[8px]">
        <PrimaryButton
          block
          testId="tix-sell"
          onClick={() => void submit(true)}
          loading={saving === 'sell'}
          loadingLabel="Putting on sale"
          disabled={!!sellBlock || saving !== null}
          aria-describedby={sellBlock ? `${id}-sell` : undefined}
        >
          Put on sale
        </PrimaryButton>
        <Reason id={`${id}-sell`} testId="tix-sell-reason">{sellBlock}</Reason>
        <GhostButton block testId="tix-save" onClick={() => void submit(false)} loading={saving === 'save'} loadingLabel="Saving" disabled={saving !== null}>
          Save as draft
        </GhostButton>
      </div>
    );
  }

  return (
    <SheetView
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      fullHeight
      title={type ? 'Edit ticket' : 'Add a ticket'}
      viewKey={String(step)}
      onBack={step > 1 ? () => setStep((step - 1) as Step) : undefined}
      backLabel="Back"
      testId="tix-sheet"
      footer={
        <div className="space-y-[4px]" {...shakeProps}>
          {serverError && (
            <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid="tix-form-error">
              {serverError}
            </p>
          )}
          {footer}
        </div>
      }
    >
      <div className="space-y-[12px]" data-step={step}>
        <div className="space-y-[6px]">
          <div className="flex items-center justify-between text-[13px] text-[var(--mut)]">
            <span className="font-semibold text-[var(--fg)]">{STEP_TITLE[step]}</span>
            <span data-testid="tix-step">
              {step} / {EDITOR_STEPS}
            </span>
          </div>
          <div className="flex gap-[6px]" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={cn('h-[5px] flex-1 rounded-full', n <= step ? 'bg-[var(--gold)]' : 'bg-[var(--line)]')} />
            ))}
          </div>
        </div>
        {locked && step < 3 && <Reason id={`${id}-locked-top`} testId="tix-form-locked-top">{locked}</Reason>}

        {step === 1 && (
          <>
            <Field label="Name" htmlFor={`${id}-name`} help="For example Early bird, Standard or Door." error={errors.name}>
              <input {...input('name', { maxLength: 200, autoComplete: 'off', 'data-sheet-autofocus': true })} />
            </Field>
            <Field
              label="Price (&pound;)"
              htmlFor={`${id}-price`}
              help={lockedPrice ?? 'Leave empty or 0 for a free ticket.'}
              error={errors.price}
            >
              <input
                {...input('price', {
                  inputMode: 'decimal',
                  placeholder: '0.00',
                  disabled: !!locked || !!lockedPrice,
                  onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, price: e.target.value, paid: paidOf(e.target.value) })),
                })}
              />
            </Field>
            <div className="space-y-[2px] rounded-[var(--r-ctl)] border border-dashed border-[var(--gold)] p-[12px]" data-testid="tix-buyer-pays" aria-live="polite">
              <p className="text-[13px] text-[var(--mut)]">Buyer pays</p>
              {total === null ? (
                <p className="text-[15px]" data-testid="tix-buyer-total">Enter a price to see it</p>
              ) : (
                <>
                  <p className="text-[17px] font-semibold tabular-nums" data-testid="tix-buyer-total">
                    {total.free ? 'Free' : formatPence(total.totalPence)}
                  </p>
                  <p className="text-[13px] text-[var(--mut)]" data-testid="tix-buyer-line">{total.line}</p>
                </>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Places" htmlFor={`${id}-capacity`} help={`How many tickets in total. One order can hold up to ${MAX_PER_ORDER}.`} error={errors.capacity}>
              <input {...input('capacity', { inputMode: 'numeric', placeholder: '20', 'data-sheet-autofocus': true })} />
            </Field>
            <div className="space-y-[6px]">
              <p className="text-[13px] font-semibold text-[var(--mut)]">Sales open</p>
              <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Sales open">
                <Chip testId="tix-open-now" selected={openMode === 'now'} disabled={!!locked} onToggle={() => { setOpenMode('now'); set('opensAt', ''); }}>
                  Now
                </Chip>
                <Chip testId="tix-open-pick" selected={openMode === 'pick'} disabled={!!locked} onToggle={() => setOpenMode('pick')}>
                  Pick a time
                </Chip>
              </div>
              {openMode === 'pick' && (
                <Field label="Opens (London time)" htmlFor={`${id}-opensAt`} error={errors.opensAt}>
                  <input {...input('opensAt', { type: 'datetime-local' })} />
                </Field>
              )}
              {openMode === 'now' && errors.opensAt && <p className="text-[13px] text-[var(--danger)]">{errors.opensAt}</p>}
            </div>
            <div className="space-y-[6px]">
              <p className="text-[13px] font-semibold text-[var(--mut)]">Sales close</p>
              <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Sales close">
                {eventStart && (
                  <Chip testId="tix-close-event" selected={closeMode === 'event'} disabled={!!locked} onToggle={() => { setCloseMode('event'); set('closesAt', isoToLondonInput(eventStart)); }}>
                    Event start
                  </Chip>
                )}
                <Chip testId="tix-close-never" selected={closeMode === 'never'} disabled={!!locked} onToggle={() => { setCloseMode('never'); set('closesAt', ''); }}>
                  When I stop selling
                </Chip>
                <Chip testId="tix-close-pick" selected={closeMode === 'pick'} disabled={!!locked} onToggle={() => setCloseMode('pick')}>
                  Pick a time
                </Chip>
              </div>
              {closeMode === 'pick' && (
                <Field label="Closes (London time)" htmlFor={`${id}-closesAt`} error={errors.closesAt}>
                  <input {...input('closesAt', { type: 'datetime-local' })} />
                </Field>
              )}
              {closeMode !== 'pick' && errors.closesAt && <p className="text-[13px] text-[var(--danger)]">{errors.closesAt}</p>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="divide-y divide-[var(--line)] rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--card)]" data-testid="tix-review">
              <div className="flex items-center justify-between gap-[8px] px-[16px] py-[12px]">
                <p className="min-w-0 truncate text-[15px] font-semibold" data-testid="tix-review-name">{form.name.trim()}</p>
              </div>
              {reviewRows(form, eventStart).map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-[8px] px-[16px] py-[10px] text-[14px]" data-testid={`tix-review-${r.key}`}>
                  <span className="text-[var(--mut)]">{r.label}</span>
                  <span className="text-right tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
            {!type && !locked && (
              <p className="text-[13px] text-[var(--mut)]">Save as draft keeps it hidden from buyers until you switch it to Selling.</p>
            )}
            {canClose && (
              <div className="space-y-[6px] border-t border-[var(--line)] pt-[12px]" data-testid="tix-close-area">
                {confirmClose ? (
                  <>
                    <p className="text-[14px]">Close sales for good? Nobody can buy this ticket again. Cannot be undone.</p>
                    <div className="grid grid-cols-2 gap-[8px]">
                      <GhostButton block size="sm" testId="tix-close-keep" onClick={() => setConfirmClose(false)}>
                        Keep selling
                      </GhostButton>
                      <PrimaryButton block size="sm" testId="tix-close-confirm" className="bg-[var(--danger)] text-[var(--btnfg)]" loading={saving === 'close'} loadingLabel="Closing" onClick={() => void closeForGood()}>
                        Close sales
                      </PrimaryButton>
                    </div>
                  </>
                ) : (
                  <GhostButton block size="sm" testId="tix-close" onClick={() => setConfirmClose(true)}>
                    Close sales for good
                  </GhostButton>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SheetView>
  );
}
