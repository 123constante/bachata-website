import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { buildSignInHref } from '@/lib/authRouting';
import { bindOrganiserInviteEmail, invitePreviewQueryKey } from './inviteRedeemApi';
import {
  BIND_FAILED_COPY,
  BIND_UNAVAILABLE_COPY,
  EMAIL_CHECK_COPY,
  bindCopy,
  checkTypedEmail,
  interpretBind,
  maskTypedEmail,
  type BindCopy,
} from './bindEmailModel';
import { INVITE_PATH } from './inviteModel';

const BTN = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
const LINK = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium';
const SLIDE = 'animate-in fade-in slide-in-from-right-4 duration-200';

type Step = 'type' | 'confirm' | 'stopped';

/**
 * Signed-out visitor on an UNBOUND open link: type your email, confirm it (the first bind wins, so a typo would burn
 * the link), bind it, then continue into the normal sign-in for THAT address and come back to this link. This step
 * never redeems anything: Accept is the Join button on the page the person lands on after sign-in.
 */
export default function BindEmailStep({ token, organiserName, inviterFirstName }: { token: string; organiserName: string; inviterFirstName: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('type');
  const [typed, setTyped] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [stop, setStop] = useState<BindCopy | null>(null);
  const here = `${INVITE_PATH}/${token}`;

  const toConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkTypedEmail(typed);
    if (!check.ok) {
      setError(EMAIL_CHECK_COPY[check.reason]);
      return;
    }
    setError(null);
    setEmail(check.email);
    setStep('confirm');
  };

  const bind = async () => {
    setBusy(true);
    setError(null);
    setUnavailable(false);
    let outcome;
    try {
      const { data, error: err } = await bindOrganiserInviteEmail(token, email);
      outcome = interpretBind(data, err);
    } catch {
      outcome = interpretBind(null, { message: 'network' });
    }
    setBusy(false);
    if (outcome.kind === 'unavailable') {
      setUnavailable(true);
      setError(BIND_UNAVAILABLE_COPY);
      return;
    }
    if (outcome.kind === 'failed') {
      setError(BIND_FAILED_COPY);
      return;
    }
    const copy = bindCopy(outcome.status, inviterFirstName);
    if (copy.next === 'continue') {
      // The sign-in page starts with this address; the link's preview now carries the hint.
      try { localStorage.setItem('auth_last_email', email.toLowerCase()); } catch { /* storage blocked: they type it again */ }
      void queryClient.invalidateQueries({ queryKey: invitePreviewQueryKey(token) });
      navigate(buildSignInHref(here));
      return;
    }
    if (copy.next === 'stop') {
      setStop(copy);
      setStep('stopped');
      return;
    }
    // bad_email: back to the typing step with the message; rate_limited: stay put and say so.
    setError(copy.text);
    if (outcome.status === 'bad_email') setStep('type');
  };

  const title = `You’ve been invited to manage ${organiserName}`;
  const from = inviterFirstName ? `From ${inviterFirstName}.` : null;

  return (
    <div className="mx-auto max-w-md space-y-3 px-4 pt-10 text-center" data-testid="invite-card">
      <h1 className="text-lg font-semibold" data-testid="invite-title">{title}</h1>
      {from && <p className="text-sm text-muted-foreground" data-testid="invite-from">{from}</p>}
      {step === 'type' && (
        <form key="type" className={`${SLIDE} flex flex-col gap-2`} onSubmit={toConfirm} noValidate data-testid="bind-type">
          <label htmlFor="bind-email" className="text-sm font-medium">Type your email</label>
          <input
            id="bind-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={typed}
            onChange={(e) => { setTyped(e.target.value); setError(null); }}
            className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-base"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'bind-error' : undefined}
            data-testid="bind-input"
          />
          {error && <p id="bind-error" className="text-sm text-destructive" role="alert" data-testid="bind-error">{error}</p>}
          <button type="submit" className={BTN} disabled={!typed.trim()} data-testid="bind-next">Next</button>
          {!typed.trim() && <p className="text-xs text-muted-foreground" data-testid="bind-next-why">Type your email to continue.</p>}
        </form>
      )}
      {step === 'confirm' && (
        <div key="confirm" className={`${SLIDE} flex flex-col gap-2`} data-testid="bind-confirm">
          <p className="text-sm font-medium" data-testid="bind-confirm-line">We&rsquo;ll send your sign-in link to {maskTypedEmail(email)}. Is that right?</p>
          {error && <p className="text-sm text-destructive" role="alert" data-testid="bind-error">{error}</p>}
          <button type="button" className={BTN} disabled={busy} onClick={() => void bind()} data-testid="bind-yes">{busy ? 'Saving…' : 'Yes, that’s right'}</button>
          <button type="button" className={LINK} disabled={busy} onClick={() => { setStep('type'); setError(null); setUnavailable(false); }} data-testid="bind-change">No, change it</button>
          {unavailable && <Link to={buildSignInHref(here)} className={LINK} data-testid="invite-sign-in">Sign in without this step</Link>}
        </div>
      )}
      {step === 'stopped' && stop && (
        <div key="stopped" className={`${SLIDE} flex flex-col gap-2`} data-testid="bind-stopped">
          <p className="text-sm text-muted-foreground" role="status" data-testid="bind-stopped-text">{stop.text}</p>
          <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>
        </div>
      )}
    </div>
  );
}
