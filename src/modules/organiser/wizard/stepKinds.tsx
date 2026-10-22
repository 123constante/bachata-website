// The wizard's step kinds (D26, D27). Each is a factory returning a component
// on the pinned WizardStepProps contract. The shell's heading IS the question,
// so every field label here is for screen readers only, and "Optional" sits on
// the hint line. An optional step with nothing entered shows ONE quiet "Skip
// for now"; Continue appears once something is entered. A required step has no
// Skip: its Continue stays disabled, with the reason on screen, until filled.
import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Mail, MessageCircle, X } from 'lucide-react';
import { supportLinks } from '@/modules/organiser/shared/support';
import type { WizardStepProps } from '@/modules/areas/wizardStep';
import { Chip, FIELD_CLASS, PrimaryButton, useDebounced } from '../ui';
import { needsTeamHelp } from './dancerApi';
import { useWizardEnv, type WizardEnv } from './wizardEnv';
import { LIST_ITEM_MAX, LIST_MAX_ITEMS, isBlankAnswer, withPendingItem } from './wizardModel';

export const SKIP_LABEL = 'Skip for now';
export const REQUIRED_HINT = 'Needed before your events can go live.';
/** Why a list step's Add is off while nothing is typed (on screen, linked to the button). */
export const LIST_ADD_HINT = 'Type one first, then tap Add.';
/** Why it is off once the list is full. */
export const LIST_FULL_HINT = `That is the most there can be (${LIST_MAX_ITEMS}).`;

type Check = (raw: string) => string | null;

export function SkipButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
  return (
    <button type="button" data-testid="step-skip" disabled={disabled} onClick={onSkip} className="h-[44px] w-full text-[15px] font-semibold text-[var(--mut)] underline underline-offset-4">
      {SKIP_LABEL}
    </button>
  );
}

/** "Optional." (plus the help) on optional steps; the required reason on required ones. */
function Hint({ id, required, help }: { id: string; required: boolean; help?: ReactNode }) {
  const text = required ? (help ? <>{help} {REQUIRED_HINT}</> : REQUIRED_HINT) : help ? <>Optional. {help}</> : 'Optional.';
  return <p id={id} data-testid="step-hint" className="text-[13px] text-[var(--mut)]">{text}</p>;
}

const SUPPORT_ROW = 'flex min-h-[48px] w-full items-center gap-[12px] rounded-[12px] border border-[var(--line)] px-[16px] text-[15px] font-semibold text-[var(--fg)]';

/** A refusal only the team can clear: the contact rows that exist (never a dead link), or words saying what to do. */
function TeamHelp() {
  const { whatsapp, email } = supportLinks();
  return (
    <div className="space-y-[8px]" data-testid="step-support">
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={SUPPORT_ROW} data-testid="step-support-whatsapp">
          <MessageCircle aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />WhatsApp us
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={SUPPORT_ROW} data-testid="step-support-email">
          <Mail aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />Email us
        </a>
      )}
      {!whatsapp && !email && (
        <p className="text-[13px] text-[var(--mut)]" data-testid="step-support-none">
          Our contact details are not available here yet. Tap Finish later; your other answers are saved.
        </p>
      )}
    </div>
  );
}

function StepError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <>
      <p role="alert" data-testid="step-error" className="text-[13px] text-[var(--danger)]">{error}</p>
      {needsTeamHelp(error) && <TeamHelp />}
    </>
  );
}

/** Continue once something is entered; else Skip (optional) or a disabled Continue with its reason (required). */
function StepFooter({ blank, required, saving, hintId, onContinue, onSkip }: {
  blank: boolean; required: boolean; saving: boolean; hintId: string; onContinue: () => void; onSkip?: () => void;
}) {
  if (blank && !required) return onSkip ? <SkipButton onSkip={onSkip} disabled={saving} /> : null;
  return (
    <PrimaryButton testId="step-continue" loading={saving} disabled={blank} aria-describedby={blank ? hintId : undefined} onClick={onContinue}>
      Continue
    </PrimaryButton>
  );
}

function Frame({ testId, children }: { testId: string; children: ReactNode }) {
  return <div className="space-y-[16px]" data-testid={testId}>{children}</div>;
}

// ---- text ------------------------------------------------------------------------------------

export interface TextStepConfig {
  label: string;
  /** Plain words, or words with a link (a JSX fragment). */
  help?: ReactNode;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  inputMode?: 'text' | 'numeric' | 'tel' | 'url' | 'email';
  autoComplete?: string;
  /** Our own check before anything is sent: plain refusal copy, or null. */
  check?: Check;
  /** The stored value from the typed text (a year becomes a number). Default: trimmed text, '' as null. */
  toValue?: (raw: string) => unknown;
}

export const textOf = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export function makeTextStep(key: string, c: TextStepConfig) {
  function TextStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const [draft, setDraft] = useState(() => textOf(value));
    const [local, setLocal] = useState<string | null>(null);
    const blank = draft.trim() === '';
    const send = () => {
      const problem = c.check?.(draft) ?? null;
      if (problem) { setLocal(problem); return; }
      onAnswer(c.toValue ? c.toValue(draft) : draft.trim() || null);
    };
    const common = {
      id,
      value: draft,
      disabled: saving,
      autoFocus: true,
      placeholder: c.placeholder,
      maxLength: c.maxLength,
      'aria-describedby': `${id}-hint`,
      'aria-invalid': local || error ? true : undefined,
      onChange: (e: { target: { value: string } }) => { setDraft(e.target.value); setLocal(null); },
    };
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[4px]">
          <label htmlFor={id} className="sr-only">{c.label}</label>
          {c.multiline ? (
            <textarea {...common} rows={5} className={`${FIELD_CLASS} min-h-[120px] py-[12px]`} />
          ) : (
            <input
              {...common}
              type={c.inputMode === 'tel' ? 'tel' : c.inputMode === 'url' ? 'url' : 'text'}
              inputMode={c.inputMode}
              autoComplete={c.autoComplete}
              className={`${FIELD_CLASS} h-[48px]`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !blank && !saving) send(); }}
            />
          )}
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <StepError error={local ?? error} />
        <StepFooter blank={blank} required={required} saving={saving} hintId={`${id}-hint`} onContinue={send} onSkip={onSkip} />
      </Frame>
    );
  }
  TextStep.displayName = `text:${key}`;
  return TextStep;
}

// ---- one choice (answers on the tap) ----------------------------------------------------------

export function makeChoiceStep(key: string, c: { label: string; help?: ReactNode; options: readonly { value: string; label: string }[] }) {
  function ChoiceStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[4px]">
          <div role="group" aria-label={c.label} aria-describedby={`${id}-hint`} className="flex flex-wrap gap-[8px]">
            {c.options.map((o) => (
              <Chip key={o.value} selected={value === o.value} disabled={saving} onToggle={() => onAnswer(o.value)} testId="step-choice">{o.label}</Chip>
            ))}
          </div>
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <StepError error={error} />
        {isBlankAnswer(value) && !required && onSkip && <SkipButton onSkip={onSkip} disabled={saving} />}
      </Frame>
    );
  }
  ChoiceStep.displayName = `choice:${key}`;
  return ChoiceStep;
}

// ---- a list (D27) -----------------------------------------------------------------------------

export function makeListStep(key: string, c: { label: string; help?: ReactNode; placeholder: string }) {
  function ListStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const [items, setItems] = useState<string[]>(() => (Array.isArray(value) ? value.map(String) : []));
    const [pending, setPending] = useState('');
    const effective = withPendingItem(items, pending);
    const add = () => { setItems(effective); setPending(''); };
    const full = items.length >= LIST_MAX_ITEMS;
    // A disabled Add always says why, on screen (never a silent grey button).
    const addOff = !saving && (full || pending.trim() === '') ? (full ? LIST_FULL_HINT : LIST_ADD_HINT) : null;
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[8px]">
          {items.length > 0 && (
            <ul className="flex flex-wrap gap-[8px]" aria-label={c.label} data-testid="step-list-items">
              {items.map((it) => (
                <li key={it} className="inline-flex min-h-[44px] items-center gap-[4px] rounded-[8px] border border-[var(--line-strong)] bg-[var(--card2)] pl-[12px] text-[14px] text-[var(--fg)]">
                  {it}
                  <button type="button" disabled={saving} aria-label={`Remove ${it}`} onClick={() => setItems(items.filter((x) => x !== it))} className="inline-flex h-[44px] w-[44px] items-center justify-center text-[var(--mut)]">
                    <X aria-hidden="true" className="h-[16px] w-[16px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor={id} className="sr-only">{c.label}</label>
          <div className="flex gap-[8px]">
            <input
              id={id}
              value={pending}
              disabled={saving || full}
              autoFocus
              maxLength={LIST_ITEM_MAX}
              placeholder={c.placeholder}
              aria-describedby={`${id}-hint`}
              onChange={(e) => setPending(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              className={`${FIELD_CLASS} h-[48px] flex-1`}
            />
            <button type="button" data-testid="step-list-add" disabled={saving || full || pending.trim() === ''} aria-describedby={addOff ? `${id}-add` : undefined} onClick={add} className="h-[48px] min-w-[64px] rounded-[12px] bg-[var(--card2)] px-[12px] text-[15px] font-semibold text-[var(--fg)] disabled:opacity-60">
              Add
            </button>
          </div>
          {addOff && <p id={`${id}-add`} data-testid="step-list-add-reason" className="text-[13px] text-[var(--mut)]">{addOff}</p>}
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <StepError error={error} />
        <StepFooter blank={effective.length === 0} required={required} saving={saving} hintId={`${id}-hint`} onContinue={() => onAnswer(effective)} onSkip={onSkip} />
      </Frame>
    );
  }
  ListStep.displayName = `list:${key}`;
  return ListStep;
}

// ---- search and pick (a city, a country): answers on the tap of a result ---------------------

export interface PickResult { id: string; label: string }

export function makePickStep(key: string, c: { label: string; help?: ReactNode; placeholder: string; search: (q: string) => Promise<PickResult[]>; currentLabel?: (value: unknown) => string | null }) {
  function PickStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const [q, setQ] = useState('');
    const term = useDebounced(q.trim());
    const results = useQuery({ queryKey: ['wizard-pick', key, term], queryFn: () => c.search(term), enabled: term.length >= 2, retry: false });
    const current = c.currentLabel?.(value) ?? null;
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[8px]">
          {current && <p className="text-[14px] text-[var(--fg)]" data-testid="step-pick-current">Now: {current}</p>}
          <label htmlFor={id} className="sr-only">{c.label}</label>
          <input id={id} value={q} autoFocus disabled={saving} placeholder={c.placeholder} aria-describedby={`${id}-hint`} onChange={(e) => setQ(e.target.value)} className={`${FIELD_CLASS} h-[48px]`} />
          <Hint id={`${id}-hint`} required={required} help={c.help ?? 'Type two letters or more, then tap the right one.'} />
          {term.length >= 2 && (
            results.isError ? (
              <p role="alert" className="text-[13px] text-[var(--danger)]">The search did not work. Check your connection and type again.</p>
            ) : results.data && results.data.length === 0 ? (
              <p className="text-[13px] text-[var(--mut)]" data-testid="step-pick-none">Nothing matches. Try a different spelling.</p>
            ) : (
              <ul className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--card)]" data-testid="step-pick-results">
                {(results.data ?? []).map((r) => (
                  <li key={r.id}>
                    <button type="button" disabled={saving} onClick={() => onAnswer(r.id)} data-testid="step-pick-result" className="flex min-h-[48px] w-full items-center border-b border-[var(--line)] px-[16px] text-left text-[15px] text-[var(--fg)]">
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
        <StepError error={error} />
        {isBlankAnswer(value) && !required && onSkip && <SkipButton onSkip={onSkip} disabled={saving} />}
      </Frame>
    );
  }
  PickStep.displayName = `pick:${key}`;
  return PickStep;
}

// ---- a picture --------------------------------------------------------------------------------

/** Pick a file; it uploads, then the URL is the answer. `upload` throws plain copy. */
export function makeUploadStep(key: string, c: { label: string; help?: ReactNode; accept: string; upload: (env: WizardEnv) => ((file: File) => Promise<string>) | null }) {
  function UploadStep({ value, required, saving, error, onAnswer, onSkip }: WizardStepProps) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [local, setLocal] = useState<string | null>(null);
    const upload = c.upload(useWizardEnv());
    const shown = typeof value === 'string' && value ? value : null;
    const pick = async (file: File | undefined) => {
      if (!file || !upload) return;
      setBusy(true);
      setLocal(null);
      try {
        onAnswer(await upload(file));
      } catch (e) {
        setLocal(e instanceof Error ? e.message : 'The picture did not upload. Try again.');
      } finally {
        setBusy(false);
        if (input.current) input.current.value = '';
      }
    };
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[8px]">
          {shown && <img src={shown} alt="" loading="eager" className="h-[88px] w-[88px] rounded-[16px] object-cover" data-testid="step-upload-current" />}
          <label htmlFor={id} className="sr-only">{c.label}</label>
          <input ref={input} id={id} type="file" accept={c.accept} className="sr-only" aria-describedby={`${id}-hint`} onChange={(e) => void pick(e.target.files?.[0])} />
          <PrimaryButton testId="step-upload" loading={busy || saving} loadingLabel="Uploading" disabled={!upload} onClick={() => input.current?.click()}>
            <Camera aria-hidden="true" className="h-[20px] w-[20px]" /> {shown ? 'Choose a new picture' : 'Choose a picture'}
          </PrimaryButton>
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <StepError error={local ?? error} />
        {!shown && !required && onSkip && <SkipButton onSkip={onSkip} disabled={busy || saving} />}
      </Frame>
    );
  }
  UploadStep.displayName = `upload:${key}`;
  return UploadStep;
}

/** A step answered on another screen (the dancer photo has its own crop screen); it comes back here after. */
export function makeElsewhereStep(key: string, c: { label: string; help?: ReactNode; cta: string; to: (returnTo: string) => string }) {
  function ElsewhereStep({ required, saving, error, onSkip }: WizardStepProps) {
    const id = useId();
    const { returnTo } = useWizardEnv();
    return (
      <Frame testId={`step-${key}`}>
        <div className="space-y-[8px]">
          <Link to={c.to(returnTo)} aria-describedby={`${id}-hint`} data-testid="step-elsewhere" className="inline-flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[var(--btn)] text-[16px] font-bold text-[var(--btnfg)]">
            <Camera aria-hidden="true" className="h-[20px] w-[20px]" /> {c.cta}
          </Link>
          <Hint id={`${id}-hint`} required={required} help={c.help} />
        </div>
        <StepError error={error} />
        {!required && onSkip && <SkipButton onSkip={onSkip} disabled={saving} />}
      </Frame>
    );
  }
  ElsewhereStep.displayName = `elsewhere:${key}`;
  return ElsewhereStep;
}
