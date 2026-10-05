import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * D-7 / D-11: prove the mailbox without leaving the page. Sends a one-time
 * code to the signed-in email and verifies it, which replaces the session
 * with one whose `amr` carries `otp` -- the evidence claim_organiser_v1
 * accepts. `onProven` runs once the new session is in place. `returnTo` is
 * where the emailed LINK lands (the code path never leaves the page): /account
 * by default, the public organiser page when the proof was asked for there.
 */
/** The project's configured code length varies (prod and E2E use 8, the default is 6), so accept 6 to 10 digits (S7). */
export const EMAIL_CODE_PATTERN = /^\d{6,10}$/;
export const EMAIL_CODE_MAX_LENGTH = 10;

export function EmailCodeProof({ email, onProven, returnTo = '/account' }: { email: string; onProven: () => void; returnTo?: string }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('That code is invalid or expired. Send a new one.');
      return;
    }
    onProven();
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="email-code-proof">
      <p className="text-sm flex items-start gap-2">
        <MailCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          To prove <strong>{email}</strong> is yours, we&rsquo;ll email you a code.
        </span>
      </p>
      {sent ? (
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={EMAIL_CODE_MAX_LENGTH}
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="h-9 w-36 tracking-widest"
            aria-label="The code from your email"
            data-testid="email-code-input"
          />
          <Button size="sm" className="rounded-full min-h-[44px]" onClick={() => void verify()} disabled={busy} data-testid="email-code-verify">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void send()} disabled={busy}>
            Resend
          </Button>
        </div>
      ) : (
        <Button size="sm" className="rounded-full min-h-[44px]" onClick={() => void send()} disabled={busy} data-testid="email-code-send">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email me a code'}
        </Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
