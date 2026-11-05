import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isOnboardingRefusal } from '../../../shared/selfServeErrors';
import { useGatedCopy } from '../../onboarding/gate';
import { StackSheet } from '../StackSheet';
import { TONE_CLASS } from '../model';
import { createPromo, promoKeys, updatePromo, usePromoCodes } from './promoApi';
import {
  LOCKED_WHY,
  LOCKED_SHORT,
  GATE_PROMO,
  thrownCopy,
  STILL_SAVING,
  STATE_NEXT,
  STATE_TAG,
  SWITCH_WORDS,
  switchedText,
  createArgsOf,
  discountWords,
  expiryLine,
  formOf,
  isEmptyPatch,
  isLocked,
  normaliseCode,
  paidLine,
  patchOf,
  reasonCopy,
  stateOf,
  usesLine,
  validate,
  type PromoCode,
  type PromoForm,
} from './promoModel';

export interface PromoSectionProps {
  organiserId: string;
  seriesId: string;
  /** The Tickets sheet's status toast and its alert queue (TicketsEntry): one toast pattern. */
  onSay: (text: string) => void;
  onAlert: (text: string) => void;
}

/**
 * Promo codes on the P3 Tickets sheet (lazy chunk; flag organiserTicketing via TicketsEntry).
 * Who may change a code is the server's answer: a refusal is shown as words, never predicted.
 */
export default function PromoSection({ organiserId, seriesId, onSay, onAlert }: PromoSectionProps) {
  const queryClient = useQueryClient();
  const list = usePromoCodes(seriesId);
  const gated = useGatedCopy();
  const [editing, setEditing] = useState<{ code: PromoCode | null } | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [rowError, setRowError] = useState<ReadonlyMap<string, string>>(new Map());
  // A second tap before React re-renders must not send a second command.
  const [flying] = useState(() => new Set<string>());
  const now = new Date();
  // The layer the promo sheet is portalled into: read from the DOM once the section is attached (an
  // effect-time read held in state, never a ref read during render).
  const [host, setHost] = useState<HTMLElement | null>(null);
  const anchor = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setHost((el.closest('.p3-scrim')?.parentElement as HTMLElement | null | undefined) ?? (typeof document === 'undefined' ? null : document.body));
  }, []);
  // Codes the server told us are locked although the list could not see why (INVENTORY G3).
  const [lockedIds, setLockedIds] = useState<ReadonlySet<string>>(new Set());
  const refresh = () => queryClient.invalidateQueries({ queryKey: promoKeys.list(seriesId) });

  const mark = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const setErr = (id: string, text: string | null) =>
    setRowError((m) => {
      const n = new Map(m);
      if (text === null) n.delete(id);
      else n.set(id, text);
      return n;
    });

  const toggle = async (c: PromoCode) => {
    if (flying.has(c.id)) return;
    flying.add(c.id);
    mark(c.id, true);
    setErr(c.id, null);
    try {
      const out = await updatePromo(c.id, { active: !c.active });
      if (out.ok) {
        onSay(switchedText(c, new Date()));
        await refresh();
      } else setErr(c.id, reasonCopy(out.reason));
    } catch (e) {
      setErr(c.id, gated(e, thrownCopy));
    } finally {
      flying.delete(c.id);
      mark(c.id, false);
    }
  };

  const data = list.data;
  const refused = data && !data.ok;
  let body;
  if (list.isPending) body = <p className="p3-note" data-testid="promo-loading">Loading promo codes&hellip;</p>;
  else if (list.isError) {
    body = (
      <div className="p3-state" role="alert" data-testid="promo-error">
        <strong>We could not load the promo codes.</strong>
        <p>Check your connection, then try again.</p>
        <button type="button" className="p3-btn p3-btn-line" onClick={() => void list.refetch()}>Try again</button>
      </div>
    );
  } else if (refused) {
    body = <p id={`promo-why-${seriesId}`} className="p3-note p3-pad-y" data-testid="promo-refused">{reasonCopy(data.reason)}</p>;
  } else if (data && data.ok && data.rows.length === 0) {
    body = (
      <p className="p3-note p3-pad-y" data-testid="promo-empty">
        No promo codes yet. Tap Add a promo code to give buyers money off every ticket on this event.
      </p>
    );
  } else if (data && data.ok) {
    body = (
      <ul className="p3-list p3-flush">
        {data.rows.map((c) => (
          <PromoRow key={c.id} code={c} locked={isLocked(c) || lockedIds.has(c.id)} now={now} busy={busy.has(c.id)} error={rowError.get(c.id) ?? null} onToggle={() => void toggle(c)} onEdit={() => setEditing({ code: c })} />
        ))}
      </ul>
    );
  }

  // A refused list already says why; the disabled Add points at those words (no second note).
  // The sheet is a sibling layer of the tall Tickets sheet, never inside it: StackSheet makes the
  // layers under the top one inert, and an inert ancestor would take the promo sheet with it.
  const addWhy = refused ? `promo-why-${seriesId}` : undefined;
  return (
    <section ref={anchor} className="p3-stack-s" data-testid="promo-section" aria-labelledby={`promo-h-${seriesId}`}>
      <h4 id={`promo-h-${seriesId}`} className="p3-h2 p3-h2-s">Promo codes</h4>
      <div className="p3-card p3-tight" data-testid="promo-list">{body}</div>
      <button
        type="button"
        className="p3-btn p3-btn-line"
        disabled={!!refused || list.isPending || list.isError}
        aria-describedby={addWhy}
        onClick={() => setEditing({ code: null })}
        data-testid="promo-add"
      >
        Add a promo code
      </button>
      {editing && host && createPortal(
        <PromoSheet
          code={editing.code}
          organiserId={organiserId}
          seriesId={seriesId}
          now={now}
          flying={flying}
          lockedByServer={editing.code ? lockedIds.has(editing.code.id) : false}
          onLocked={(id) => {
            setLockedIds((l) => new Set(l).add(id));
            void refresh();
          }}
          onClose={() => setEditing(null)}
          onDone={(text, changed) => {
            setEditing(null);
            onSay(text);
            if (changed) {
              if (editing.code) setErr(editing.code.id, null);
              void refresh();
            }
          }}
          onLate={(text, landed) => {
            if (landed) {
              onSay(text);
              void refresh();
            } else onAlert(text);
          }}
        />,
        host,
      )}
    </section>
  );
}

function PromoRow({ code: c, locked, now, busy, error, onToggle, onEdit }: { code: PromoCode; locked: boolean; now: Date; busy: boolean; error: string | null; onToggle: () => void; onEdit: () => void }) {
  const id = useId();
  const state = stateOf(c, now);
  const tag = STATE_TAG[state];
  const next = STATE_NEXT[state];
  return (
    <li className="p3-row p3-row-col" data-testid={`promo-row-${c.id}`} data-state={state}>
      <div className="p3-type">
        <button type="button" className="p3-date-btn p3-grow" onClick={onEdit} data-testid="promo-edit">
          <span className="p3-grow">
            <span className="p3-row-t p3-block" data-testid="promo-code">{c.code}</span>
            <span className="p3-row-s p3-block" data-testid="promo-line">
              {discountWords(c.kind, c.value)} &middot; {usesLine(c)}
            </span>
            <span className="p3-row-s p3-block" data-testid="promo-line2">
              {expiryLine(c, now)} &middot; {paidLine(c.paidOrders)}
            </span>
          </span>
        </button>
        <span className="p3-switch-wrap">
          <span id={`${id}-l`} className="p3-row-s" data-testid="promo-switch-label">{c.active ? SWITCH_WORDS.on : SWITCH_WORDS.off}</span>
          <button
            type="button"
            role="switch"
            aria-checked={c.active}
            aria-labelledby={`${id}-l`}
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={onToggle}
            className="p3-switch"
            data-testid="promo-switch"
          >
            <i aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className="p3-row-tags">
        <span className={TONE_CLASS[tag.tone]} data-testid="promo-state">{tag.label}</span>
      </div>
      {next && <p className="p3-note" data-testid="promo-next">{next}</p>}
      {locked && <p className="p3-note" data-testid="promo-row-locked">{LOCKED_SHORT}</p>}
      {error && <p role="alert" className="p3-error" data-testid="promo-row-error">{error}</p>}
    </li>
  );
}

interface SheetProps {
  code: PromoCode | null;
  organiserId: string;
  seriesId: string;
  now: Date;
  /** The section's in-flight keys: a sheet closed mid-save and opened again never sends twice. */
  flying: Set<string>;
  /** The server answered locked_after_use for this code earlier (the list cannot see a released order). */
  lockedByServer?: boolean;
  /** The server says this code is locked: the section marks the row and re-reads the list. */
  onLocked?: (id: string) => void;
  onClose: () => void;
  /** changed = a command was sent and landed (an untouched save sends none). */
  onDone: (text: string, changed: boolean) => void;
  /** An outcome that lands after the sheet closed: a toast (landed) or an alert that stays. */
  onLate: (text: string, landed: boolean) => void;
}

export function PromoSheet({ code, organiserId, seriesId, now, flying, lockedByServer = false, onLocked, onClose, onDone, onLate }: SheetProps) {
  const id = useId();
  const gated = useGatedCopy();
  const [form, setForm] = useState<PromoForm>(() => formOf(code));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const key = `sheet:${code?.id ?? 'new'}`;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const locked = !!code && (isLocked(code) || lockedByServer);
  const errors = tried ? validate(form, code, now) : {};
  const set = (k: keyof PromoForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const label = code ? code.code : normaliseCode(form.code);

  const submit = async () => {
    if (flying.has(key)) {
      setServerError(STILL_SAVING);
      return;
    }
    setTried(true);
    if (Object.keys(validate(form, code, new Date())).length > 0) return;
    let send;
    if (code) {
      const patch = patchOf(code, form, locked);
      if (isEmptyPatch(patch)) {
        onDone('Nothing changed, so nothing was saved.', false);
        return;
      }
      send = () => updatePromo(code.id, patch);
    } else {
      const args = createArgsOf(form);
      send = () => createPromo(organiserId, seriesId, args);
    }
    flying.add(key);
    setSaving(true);
    setServerError(null);
    const fail = (text: string) => (alive.current ? setServerError(text) : onLate(`${label}: not saved. ${text}`, false));
    try {
      const out = await send();
      if (out.ok) {
        const text = code ? `${label}: changes saved.` : `${label} is ready. Buyers can type it when they buy.`;
        if (alive.current) onDone(text, true);
        else onLate(text, true);
      } else {
        if (code && out.reason === 'locked_after_use') {
          // The row is locked after all: show it locked, put the discount back as it was, offer no retry of it.
          setForm((f) => ({ ...f, kind: formOf(code).kind, amount: formOf(code).amount }));
          onLocked?.(code.id);
        }
        fail(reasonCopy(out.reason));
      }
    } catch (e) {
      // Closed mid-save: no gate sheet can open for a gone sheet, so the refusal is an alert that stays.
      if (!alive.current) onLate(`${label}: not saved. ${isOnboardingRefusal(e) ? GATE_PROMO : thrownCopy(e)}`, false);
      else {
        // A refused gate opens the shared gate sheet (null): no second error on top of it.
        const text = gated(e, thrownCopy);
        if (text !== null) fail(text);
      }
    } finally {
      flying.delete(key);
      if (alive.current) setSaving(false);
    }
  };

  const field = (k: keyof PromoForm, extra: Record<string, unknown> = {}) => ({
    id: `${id}-${k}`,
    value: form[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(k, e.target.value),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${id}-${k}-err` : undefined,
    className: 'p3-in',
    'data-testid': `promo-form-${k}`,
    ...extra,
  });
  const err = (k: keyof PromoForm) =>
    errors[k] ? <p id={`${id}-${k}-err`} className="p3-note p3-danger-t" data-testid={`promo-err-${k}`}>{errors[k]}</p> : null;

  return (
    <StackSheet
      title={code ? `Promo code \u00B7 ${code.code}` : 'New promo code'}
      onClose={onClose}
      testId="promo-sheet"
      footer={
        <div className="p3-stack-s">
          {serverError && <p role="alert" className="p3-error" data-testid="promo-form-error">{serverError}</p>}
          <button type="button" className="p3-btn" onClick={() => void submit()} disabled={saving} aria-busy={saving || undefined} data-testid="promo-save">
            {saving ? 'Saving\u2026' : code ? 'Save changes' : 'Create code'}
          </button>
        </div>
      }
    >
      <div className="p3-stack-s">
        <p className="p3-note">Takes money off every ticket on this event. A ticket never goes below &pound;0.</p>
        {code ? (
          <p className="p3-note" data-testid="promo-code-fixed">The code&rsquo;s name cannot change. To use another name, make a new code.</p>
        ) : (
          <>
            <label className="p3-field" htmlFor={`${id}-code`}>Code</label>
            <input {...field('code', { maxLength: 32, autoComplete: 'off', autoCapitalize: 'characters', spellCheck: false, placeholder: 'EARLYBIRD', 'data-sheet-autofocus': true })} />
            {err('code')}
          </>
        )}
        <p className="p3-field">Discount</p>
        <div className="p3-chips" role="group" aria-label="Discount" aria-describedby={locked ? `${id}-locked` : undefined}>
          <button type="button" aria-pressed={form.kind === 'percent'} disabled={locked} data-testid="promo-kind-percent" onClick={() => set('kind', 'percent')}>Per cent</button>
          <button type="button" aria-pressed={form.kind === 'fixed'} disabled={locked} data-testid="promo-kind-fixed" onClick={() => set('kind', 'fixed')}>Amount in &pound;</button>
        </div>
        <label className="p3-field" htmlFor={`${id}-amount`}>{form.kind === 'percent' ? 'Per cent off each ticket' : 'Pounds off each ticket'}</label>
        <input {...field('amount', { inputMode: 'decimal', disabled: locked, placeholder: form.kind === 'percent' ? '10' : '2.50' })} />
        {err('amount')}
        {locked && <p id={`${id}-locked`} className="p3-note" data-testid="promo-locked">{LOCKED_WHY}</p>}
        <label className="p3-field" htmlFor={`${id}-maxUses`}>Most orders (leave empty for no limit)</label>
        <input {...field('maxUses', { inputMode: 'numeric', placeholder: 'No limit' })} />
        {err('maxUses')}
        <label className="p3-field" htmlFor={`${id}-endsAt`}>Ends, London time (leave empty for no end date)</label>
        <input {...field('endsAt', { type: 'datetime-local' })} />
        {form.endsAt && (
          <button type="button" className="p3-link" onClick={() => set('endsAt', '')} data-testid="promo-clear-end">No end date</button>
        )}
        {err('endsAt')}
      </div>
    </StackSheet>
  );
}
