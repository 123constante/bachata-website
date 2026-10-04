import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * D-7 / D-11: prove the mailbox without leaving the page. Sends a 6-digit
 * code to the signed-in email and verifies it, which replaces the session
 * with one whose `amr` carries `otp` -- the evidence claim_organiser_v1
 * accepts. `onProven` runs once the new session is in place.
 */
export function EmailCodeProof({ email, onProven }: { email: string; onProven: () => void }) {
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
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent('/account')}`,
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
    if (!/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from the email.');
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
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="email-code-proof">
      <p className="text-sm flex items-start gap-2">
        <MailCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          To prove <strong>{email}</strong> is yours, we&rsquo;ll email you a 6-digit code.
        </span>
      </p>
      {sent ? (
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="h-9 w-28 tracking-widest"
            aria-label="6-digit code"
            data-testid="email-code-input"
          />
          <Button size="sm" onClick={() => void verify()} disabled={busy} data-testid="email-code-verify">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void send()} disabled={busy}>
            Resend
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => void send()} disabled={busy} data-testid="email-code-send">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email me a code'}
        </Button>
      )}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
