// The door's screens. All words and buttons come from doorModel; nothing here decides what a code means.
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { CityPicker } from '@/components/ui/city-picker';
import { OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth-otp-routing';
import { EMAIL_CODE_MAX_LENGTH, EMAIL_CODE_PATTERN } from '@/modules/organiser/shared/components/EmailCodeProof';
import { Turnstile } from './Turnstile';
import {
  DOOR_COPY, LOOKALIKE_TEXT, PRIVACY_PATH, RATE_LIMITED_TEXT, TERMS_PATH, emailFormState, pagePath, startFormState,
  type DoorAction, type LookalikeState, type Screen,
} from './doorModel';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';
const FIELD = 'min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-[16px]';
const WHY = 'text-center text-[13px] text-muted-foreground';
const LINK = 'underline underline-offset-4 text-primary';

export function ActionButton({ action, onRetry }: { action: DoorAction; onRetry?: () => void }) {
  const cls = action.primary ? BTN : GHOST;
  if (action.kind === 'retry') return <button type="button" className={cls} onClick={onRetry} data-testid="door-action-retry">{action.label}</button>;
  if (action.external) return <a className={cls} href={action.to} target="_blank" rel="noopener noreferrer" data-testid="door-action">{action.label}</a>;
  return <Link className={cls} to={action.to} data-testid="door-action">{action.label}</Link>;
}

/** One result/closed/refused screen: always at least one working button. */
export function ResultScreen({ screen, tone = 'neutral', onRetry, testId }: { screen: Screen; tone?: 'good' | 'neutral'; onRetry?: () => void; testId: string }) {
  return (
    <section className="flex flex-col gap-3" data-testid={testId} data-tone={tone}>
      <h1 className="text-lg font-semibold" tabIndex={-1}>{screen.title}</h1>
      <p className="text-sm" role="status">{screen.body}</p>
      <div className="flex flex-col gap-2">
        {screen.actions.map((a) => <ActionButton key={a.label} action={a} onRetry={onRetry} />)}
      </div>
    </section>
  );
}

export function TermsLine() {
  const t = DOOR_COPY.terms;
  return (
    <p className={WHY} data-testid="door-terms">
      {t.lead} <Link className={LINK} to={TERMS_PATH}>{t.terms}</Link> {t.and} <Link className={LINK} to={PRIVACY_PATH}>{t.privacy}</Link>
    </p>
  );
}

export function PublicDoor({ turnstileKey, onSend, onVerify, resendSeconds = OTP_RESEND_COOLDOWN_SECONDS }: {
  turnstileKey: string | null;
  /** Resolves to an error sentence, or null when the code was sent. */
  onSend: (email: string, token: string | null) => Promise<string | null>;
  onVerify: (email: string, code: string) => Promise<string | null>;
  resendSeconds?: number;
}) {
  const emailId = useId();
  const codeId = useId();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const form = emailFormState(email, busy, Boolean(turnstileKey), Boolean(token));
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.canSend || busy) return;
    setBusy(true); setError(null);
    const err = await onSend(email, token);
    setBusy(false);
    if (err) { setError(err); return; }
    setSent(true); setCooldown(resendSeconds);
  };
  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!EMAIL_CODE_PATTERN.test(code.trim())) { setError('Enter the code from your email.'); return; }
    setBusy(true); setError(null);
    const err = await onVerify(email, code);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <section className="flex flex-col gap-4" data-testid="door-public">
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold" tabIndex={-1}>{DOOR_COPY.title}</h1>
        <p className="text-sm">{DOOR_COPY.who}</p>
      </header>
      <div>
        <h2 className="mb-1 text-sm font-semibold">{DOOR_COPY.stepsHeading}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm" data-testid="door-steps">
          {DOOR_COPY.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
      {!sent ? (
        <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void send(e)} data-testid="door-email-form">
          <label htmlFor={emailId} className="text-sm font-medium">Your email</label>
          <input id={emailId} type="email" inputMode="email" autoComplete="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="door-email" />
          <Turnstile siteKey={turnstileKey} onToken={setToken} />
          <button type="submit" className={BTN} disabled={!form.canSend} data-testid="door-send">{DOOR_COPY.send}</button>
          <p className={WHY} data-testid="door-send-why">{form.why}</p>
        </form>
      ) : (
        <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void verify(e)} data-testid="door-code-form">
          <p className="text-sm" role="status">{DOOR_COPY.codeSent(email.trim())}</p>
          <label htmlFor={codeId} className="text-sm font-medium">Code from your email</label>
          <input id={codeId} inputMode="numeric" autoComplete="one-time-code" maxLength={EMAIL_CODE_MAX_LENGTH} className={`${FIELD} tracking-widest`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-testid="door-code" />
          <button type="submit" className={BTN} disabled={busy} data-testid="door-verify">Confirm</button>
          <button type="button" className={GHOST} disabled={busy || cooldown > 0} onClick={() => void send()} data-testid="door-resend">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new code'}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-destructive" role="alert" data-testid="door-error">{error}</p>}
      <TermsLine />
    </section>
  );
}

export function LookalikeCards({ state, onNo, busy }: { state: LookalikeState; onNo: () => void; busy: boolean }) {
  if (state.kind === 'idle' || state.kind === 'none') return null;
  if (state.kind === 'rate_limited') return <p className={WHY} role="status" data-testid="door-lookalike-limited">{RATE_LIMITED_TEXT}</p>;
  if (state.kind === 'error') return <p className={WHY} role="status" data-testid="door-lookalike-error">{LOOKALIKE_TEXT.error}</p>;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border p-3" data-testid="door-lookalikes" aria-label={LOOKALIKE_TEXT.heading}>
      <h2 className="text-sm font-semibold">{LOOKALIKE_TEXT.heading}</h2>
      <ul className="flex flex-col gap-2">
        {state.items.map((it) => (
          <li key={it.organiserId} className="flex items-center gap-3" data-testid="door-lookalike-card">
            {it.logoUrl ? <img src={it.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-muted" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.name}</p>
              {it.city && <p className="truncate text-[13px] text-muted-foreground">{it.city}</p>}
            </div>
            <Link className="inline-flex min-h-[44px] items-center text-[13px] text-primary underline underline-offset-4" to={pagePath(it.organiserId)}>{LOOKALIKE_TEXT.yes}</Link>
          </li>
        ))}
      </ul>
      <p className={WHY} data-testid="door-lookalike-help">{LOOKALIKE_TEXT.yesHelp}</p>
      <button type="button" className={GHOST} disabled={busy} onClick={onNo} data-testid="door-lookalike-no">{LOOKALIKE_TEXT.no}</button>
    </section>
  );
}

export function StartYourPage({ lookalikes, onChange, onSubmit, busy, inlineError }: {
  lookalikes: LookalikeState;
  onChange: (name: string, cityId: string) => void;
  onSubmit: (name: string, cityId: string) => void;
  busy: boolean;
  inlineError: string | null;
}) {
  const nameId = useId();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const form = startFormState(name, city, busy);
  useEffect(() => { onChange(name, city); }, [name, city, onChange]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.canSubmit) onSubmit(name, city);
  };
  return (
    <section className="flex flex-col gap-4" data-testid="door-start">
      <h1 className="text-lg font-semibold" tabIndex={-1}>{DOOR_COPY.start.title}</h1>
      <form className="flex flex-col gap-3" noValidate onSubmit={submit} data-testid="door-start-form">
        <label htmlFor={nameId} className="text-sm font-medium">{DOOR_COPY.start.nameLabel}</label>
        <input id={nameId} className={FIELD} value={name} maxLength={80} autoComplete="organization" onChange={(e) => setName(e.target.value)} data-testid="door-name" />
        <label htmlFor="door-city" className="text-sm font-medium">{DOOR_COPY.start.cityLabel}</label>
        <CityPicker id="door-city" value={city} onChange={(id) => setCity(id)} />
        <LookalikeCards state={lookalikes} busy={busy} onNo={() => onSubmit(name, city)} />
        <button type="submit" className={BTN} disabled={!form.canSubmit} data-testid="door-submit">{DOOR_COPY.start.submit}</button>
        <p className={WHY} data-testid="door-submit-why">{form.why}</p>
        {inlineError && <p className="text-sm text-destructive" role="alert" data-testid="door-inline-error">{inlineError}</p>}
      </form>
      <TermsLine />
    </section>
  );
}
