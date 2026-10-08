import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * D-7 / D-11: prove the mailbox without leaving the page. Sends a one-time
 * code to the signed-in email and verifies it, which replaces the session
 * with one whose `amr` carries `otp` -- the evidence claim_organiser_v1
 * accepts. `onProven` runs once the new session is in place. `returnTo` is
 * where the emailed LINK lands (the code path never leaves the page): /account
 * by default, the public organiser page when the proof was asked for there.
 *
 * It can sit inside a <form> (the create-organiser form shows it on a
 * mailbox_unproven refusal), so every button is type="button" and Enter in
 * the code box confirms the code instead of submitting the outer form.
 */
/** The project's configured code length varies (prod and E2E use 8, the default is 6), so accept 6 to 10 digits (S7). */
export const EMAIL_CODE_PATTERN = /^\d{6,10}$/;
export const EMAIL_CODE_MAX_LENGTH = 10;
/** Seconds before another code can be requested; the mail provider rate-limits sends. */
export const RESEND_COOLDOWN_SECONDS = 30;

export function EmailCodeProof({ email, onProven, returnTo = '/account' }: { email: string; onProven: () => void; returnTo?: string }) {
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

  // The send button unmounts once the code box shows: keep focus on the next step.
  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

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
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="email-code-proof">
      <p className="text-sm flex items-start gap-2" role="status" data-testid="email-code-status">
        <MailCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        {sent ? (
          <span>
            We&rsquo;ve emailed a code to <strong className="break-all">{email}</strong>. It can take a minute; check your spam folder too.
          </span>
        ) : (
          <span>
            To prove <strong className="break-all">{email}</strong> is yours, we&rsquo;ll email you a code.
          </span>
        )}
      </p>
      {sent ? (
        <div className="space-y-1">
          <Label htmlFor={codeId} className="text-xs">Code from your email</Label>
          <div className="flex flex-wrap gap-2">
            <Input
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
              className="min-h-[44px] w-36 text-[16px] tracking-widest"
              aria-label="The code from your email"
              data-testid="email-code-input"
            />
            <Button type="button" size="sm" className="rounded-full min-h-[44px]" onClick={() => void verify()} disabled={busy} data-testid="email-code-verify">
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Confirm
            </Button>
            <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => void send()} disabled={busy || cooldown > 0} data-testid="email-code-resend">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" className="rounded-full min-h-[44px]" onClick={() => void send()} disabled={busy} data-testid="email-code-send">
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Email me a code
        </Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
