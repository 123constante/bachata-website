import { Fragment, useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { OTP_CODE_LENGTH } from '@/lib/auth-otp-routing';

interface MagicLinkConfirmationProps {
  email: string;
  /** Re-sends the email. Resolves once the request has settled. */
  onResend: () => Promise<void>;
  onChangeEmail: () => void;
  /**
   * Called once the emailed code has been verified and a session exists. The
   * parent routes onwards (via /auth/callback) so a typed code lands exactly
   * where the emailed link would have.
   */
  onVerified: () => void;
  /** Optional extra action, e.g. "Continue browsing" */
  extraAction?: { label: string; onClick: () => void };
}

const COOLDOWN = 30;
const CODE_LENGTH = OTP_CODE_LENGTH;
const CODE_LABEL = `${CODE_LENGTH}-digit code`;
// Two groups of four: 8 slots must fit a 390px screen inside the card.
const GROUP_SIZE = CODE_LENGTH / 2;
const ERROR_ID = 'email-code-error';

const MagicLinkConfirmation = ({ email, onResend, onChangeEmail, onVerified, extraAction }: MagicLinkConfirmationProps) => {
  const [countdown, setCountdown] = useState(COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifying = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const verify = async (token: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setIsVerifying(true);
    setCodeError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
      trackAnalyticsEvent('auth_code_verified', { source: 'auth_page', route: 'returning' });
      onVerified();
    } catch (error) {
      const message = String((error as { message?: unknown } | null)?.message || '').toLowerCase();
      const isInvalid = message.includes('invalid') || message.includes('expired');
      setCodeError(
        isInvalid
          ? 'That code is wrong or has expired. Check it and try again, or resend a new one.'
          : 'We could not check that code. Please try again.',
      );
      setCode('');
    } finally {
      verifying.current = false;
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResend();
      setCountdown(COOLDOWN);
      setCode('');
      setCodeError(null);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4 py-2">
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
        <Mail className="w-5 h-5 text-primary" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in email to <strong className="text-foreground break-all">{email}</strong>.
          <br />
          Click the link in the email, or enter the code from it.
        </p>
      </div>

      <div className="w-full space-y-2">
        <label htmlFor="email-code" className="block text-sm font-medium">
          {CODE_LABEL}
        </label>
        <div className="flex justify-center">
          <InputOTP
            id="email-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              setCode(value.replace(/\D/g, ''));
              if (codeError) setCodeError(null);
            }}
            onComplete={(value) => void verify(value)}
            disabled={isVerifying}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={CODE_LABEL}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? ERROR_ID : undefined}
          >
            {[0, 1].map((group) => (
              <Fragment key={group}>
                {group === 1 && <div role="separator" aria-hidden="true" className="mx-2 h-0.5 w-2 rounded bg-muted-foreground/50" />}
                <InputOTPGroup className="gap-1.5">
                  {Array.from({ length: GROUP_SIZE }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={group * GROUP_SIZE + i}
                      className="h-12 w-9 rounded-md border bg-card text-base"
                    />
                  ))}
                </InputOTPGroup>
              </Fragment>
            ))}
          </InputOTP>
        </div>
        {codeError && (
          <p id={ERROR_ID} role="alert" className="text-sm text-destructive">
            {codeError}
          </p>
        )}
        {isVerifying && <p className="text-sm text-muted-foreground">Checking code&hellip;</p>}
      </div>

      <div className="w-full space-y-2">
        <Button
          variant="secondary"
          className="w-full min-h-[44px] rounded-full"
          disabled={countdown > 0 || isResending}
          onClick={handleResend}
        >
          {isResending ? 'Sending\u2026' : countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </Button>

        <Button variant="ghost" className="w-full min-h-[44px] text-muted-foreground" onClick={onChangeEmail}>
          Use a different email
        </Button>

        {extraAction && (
          <Button variant="ghost" className="w-full min-h-[44px] text-muted-foreground" onClick={extraAction.onClick}>
            {extraAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MagicLinkConfirmation;
