import { useEffect, useId, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GhostButton, PrimaryButton } from '../../ui';
import { EMAIL_CODE_MAX_LENGTH, EMAIL_CODE_PATTERN, RESEND_COOLDOWN_SECONDS } from './onboardingModel';

/**
 * Prove the mailbox without leaving the page (D-7 / D-11), rebuilt for the
 * organiser area: email a one-time code to the signed-in address and verify
 * it. Verifying replaces the session with one whose `amr` carries `otp`,
 * which claim_organiser_v1 and create_organiser_profile_v1 accept. The
 * emailed LINK (instead of the code) lands back on the organiser Home.
 */
export function EmailCode({ email, onProven, returnTo = '/account/o' }: { email: string; onProven: () => void; returnTo?: string }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const codeId = useId();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    setBusy(false);
    if (sendError) {
      setError('We could not send the code. Please try again in a moment.');
      return;
    }
    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const verify = async () => {
    const token = code.trim();
    if (!EMAIL_CODE_PATTERN.test(token)) {
      setError('Enter the code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    if (verifyError) {
      setError('That code did not work. Check it against the latest email, or send a new code.');
      return;
    }
    onProven();
  };

  return (
    <div className="space-y-[12px]" data-testid="email-code">
      <p className="flex items-start gap-[8px] text-[14px] text-[var(--fg)]" role="status" data-testid="email-code-status">
        <MailCheck aria-hidden="true" className="mt-[2px] h-[18px] w-[18px] shrink-0 text-[var(--gold)]" />
        {sent ? (
          <span>
            We&rsquo;ve emailed a code to <strong className="break-all">{email}</strong>. It can take a minute; check your spam folder too.
          </span>
        ) : (
          <span>
            First, prove <strong className="break-all">{email}</strong> is yours. We&rsquo;ll email you a code.
          </span>
        )}
      </p>
      {sent ? (
        <>
          <label htmlFor={codeId} className="block text-[13px] text-[var(--mut)]">
            Code from your email
          </label>
          <input
            id={codeId}
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            maxLength={EMAIL_CODE_MAX_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (!busy) void verify();
            }}
            className="h-[48px] w-full rounded-[12px] border border-[var(--line-strong)] bg-[var(--card2)] px-[16px] text-[16px] tracking-widest text-[var(--fg)] outline-none"
            data-testid="email-code-input"
          />
          <PrimaryButton onClick={() => void verify()} loading={busy} loadingLabel="Checking the code" testId="email-code-verify">
            Confirm
          </PrimaryButton>
          <GhostButton size="sm" onClick={() => void send()} disabled={busy || cooldown > 0} testId="email-code-resend">
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          </GhostButton>
        </>
      ) : (
        <PrimaryButton onClick={() => void send()} loading={busy} loadingLabel="Sending the code" testId="email-code-send">
          Email me a code
        </PrimaryButton>
      )}
      {error && (
        <p className="text-[14px] text-[var(--danger)]" role="alert" data-testid="email-code-error">
          {error}
        </p>
      )}
    </div>
  );
}
