import { useId, useState, type ChangeEvent, type RefObject } from 'react';
import { Chip, FIELD_CLASS, Field, PrimaryButton, SheetView, useShake } from '../ui';
import { Reason } from './parts';
import { upsertTicketType } from './ticketsApi';
import {
  MAX_PER_ORDER,
  buildUpsert,
  editLock,
  formOf,
  priceLock,
  reasonMessage,
  validateForm,
  type FormErrors,
  type MemberRole,
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
  role: MemberRole;
  hasOrders: boolean;
  onSaved: (announcement: string) => void;
  /** The control that opened the sheet (useOpenerRef in the parent). */
  returnFocusRef: RefObject<HTMLElement>;
}

/** Create or edit one ticket type. An untouched edit sends nothing. */
export function TypeSheet({ open, onOpenChange, type, organiserId, seriesId, role, hasOrders, onSaved, returnFocusRef }: TypeSheetProps) {
  const [form, setForm] = useState<TypeForm>(() => formOf(type));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { shake, shakeProps } = useShake();
  const id = useId();
  const locked = editLock(type, role);
  const lockedPrice = priceLock(hasOrders);
  const set = <K extends keyof TypeForm>(k: K, v: TypeForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (locked) return;
    const errs = validateForm(form, { hasOrders, reserved: type?.reserved ?? 0 });
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length > 0) {
      shake();
      return;
    }
    const draft = buildUpsert(form, type, { organiserId, seriesId });
    if (!draft) {
      onSaved('Nothing changed, so nothing was saved.');
      return;
    }
    setSaving(true);
    try {
      const out = await upsertTicketType(draft);
      if (out.ok) onSaved(type ? 'Ticket saved.' : 'Ticket added. Put it on sale when you are ready.');
      else {
        setServerError(reasonMessage(out.reason));
        shake();
      }
    } catch {
      setServerError(reasonMessage(null));
      shake();
    } finally {
      setSaving(false);
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

  return (
    <SheetView
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      fullHeight
      title={type ? 'Edit ticket' : 'Add a ticket type'}
      testId="tix-sheet"
      footer={
        <div className="space-y-[4px]" {...shakeProps}>
          {serverError && (
            <p role="alert" className="text-[13px] text-[var(--err,#f87171)]" data-testid="tix-form-error">
              {serverError}
            </p>
          )}
          <PrimaryButton block testId="tix-save" onClick={() => void save()} loading={saving} loadingLabel="Saving" disabled={!!locked} aria-describedby={locked ? `${id}-locked` : undefined}>
            {type ? 'Save ticket' : 'Add ticket'}
          </PrimaryButton>
          <Reason id={`${id}-locked`} testId="tix-form-locked">{locked}</Reason>
        </div>
      }
    >
      <div className="space-y-[12px]">
        <Field label="Name" htmlFor={`${id}-name`} help="For example Early bird, Standard or Door." error={errors.name}>
          <input {...input('name', { maxLength: 200, autoComplete: 'off', 'data-sheet-autofocus': true })} />
        </Field>
        <div className="space-y-[4px]">
          <p className="text-[13px] font-semibold text-[var(--mut)]">Price</p>
          <div className="flex gap-[8px]" role="group" aria-label="Free or paid">
            <Chip testId="tix-form-free" selected={!form.paid} disabled={!!locked || !!lockedPrice} onToggle={() => set('paid', false)}>
              Free
            </Chip>
            <Chip testId="tix-form-paid" selected={form.paid} disabled={!!locked || !!lockedPrice} onToggle={() => set('paid', true)}>
              Paid
            </Chip>
          </div>
          <Reason id={`${id}-pricelock`} testId="tix-form-pricelock">{locked ? null : lockedPrice}</Reason>
        </div>
        {form.paid && (
          <Field
            label="Price in pounds"
            htmlFor={`${id}-price`}
            help="Buyers also pay a 50p booking fee per ticket. Free tickets need no Stripe account."
            error={errors.price}
          >
            <input
              {...input('price', {
                inputMode: 'decimal',
                placeholder: '12.50',
                disabled: !!locked || !!lockedPrice,
                'aria-describedby': lockedPrice ? `${id}-pricelock` : undefined,
              })}
            />
          </Field>
        )}
        <Field label="How many tickets" htmlFor={`${id}-capacity`} help={`One order can hold up to ${MAX_PER_ORDER} tickets.`} error={errors.capacity}>
          <input {...input('capacity', { inputMode: 'numeric', placeholder: '100' })} />
        </Field>
        <Field label="Sales open (London time)" htmlFor={`${id}-opensAt`} help="Leave empty to open as soon as it is on sale." error={errors.opensAt}>
          <input {...input('opensAt', { type: 'datetime-local' })} />
        </Field>
        <Field label="Sales close (London time)" htmlFor={`${id}-closesAt`} help="Leave empty to sell until you close it." error={errors.closesAt}>
          <input {...input('closesAt', { type: 'datetime-local' })} />
        </Field>
      </div>
    </SheetView>
  );
}
