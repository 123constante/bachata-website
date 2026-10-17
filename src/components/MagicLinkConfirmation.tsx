import { Fragment, useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { OTP_CODE_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth-otp-routing';
import { trackAuthStep } from '@/lib/trackAuthStep';
import { ConsentLine } from '@/components/auth/ConsentLine';
// L1: the account pages' one long-email wrap (break before "@", then overflow-wrap:anywhere).
import { EmailText } from '@/components/account/EmailText';

/** What a resend did: sent, refused as too soon (wait out a fresh cooldown), or failed. */
export type ResendOutcome = 'sent' | 'wait' | 'failed';

interface MagicLinkConfirmationProps {
  email: string;
  /** Re-sends the email. Resolves with the outcome once the request has settled. */
  onResend: () => Promise<ResendOutcome>;
  /** Why the last send failed, shown under the code box (the parent owns the wording). */
  resendError?: string;
  onChangeEmail: () => void;
  /**
   * Called once the emailed code has been verified and a session exists. The
   * parent routes onwards (via /auth/callback) so a typed code lands exactly
   * where the emailed link would have.
   */
  /** May return a promise: the box stays busy ("Checking code") until it settles. */
  onVerified: () => void | Promise<void>;
  /** D8: sign-UP only -- the one-line Terms and Privacy clickwrap under the code box. */
  showConsent?: boolean;
  /** Optional extra action, e.g. "Continue browsing" */
  extraAction?: { label: string; onClick: () => void };
}

const COOLDOWN = OTP_RESEND_COOLDOWN_SECONDS;
const CODE_LENGTH = OTP_CODE_LENGTH;
const CODE_LABEL = `${CODE_LENGTH}-digit code`;
// Two groups of four: 8 slots must fit a 390px screen inside the card.
const GROUP_SIZE = CODE_LENGTH / 2;
const ERROR_ID = 'email-code-error';

// ---- D7: the code step over a reload, and the wrong-code limit --------------------------
// sessionStorage (this tab only), cleared with every other person-scoped key at sign-out
// (lib/personScopedStorage) and on verify / "Use a different email".

export const CODE_STEP_KEY = 'auth_code_step_v1';
/** A reload this long after the send still reopens the code box. */
export const CODE_STEP_TTL_MS = 10 * 60 * 1000;
/** Wrong codes accepted before the box stops and asks for a new code. */
export const MAX_WRONG_CODES = 5;

type CodeStep = { email: string; mode: string; at: number; wrong: number };

const readRaw = (): CodeStep | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CODE_STEP_KEY) ?? 'null') as Partial<CodeStep> | null;
    if (!parsed || typeof parsed.email !== 'string' || !parsed.email || typeof parsed.mode !== 'string' || typeof parsed.at !== 'number') return null;
    return { email: parsed.email, mode: parsed.mode, at: parsed.at, wrong: typeof parsed.wrong === 'number' ? parsed.wrong : 0 };
  } catch {
    return null;
  }
};

const write = (step: CodeStep) => {
  try {
    sessionStorage.setItem(CODE_STEP_KEY, JSON.stringify(step));
  } catch {
    /* storage blocked: a reload goes back to the e-mail form, as before */
  }
};

/** The code step sent within the last 10 minutes for this /auth mode, else null. */
export const readCodeStep = (mode: string): CodeStep | null => {
  const step = readRaw();
  if (!step || step.mode !== mode) return null;
  const age = Date.now() - step.at;
  return age >= 0 && age <= CODE_STEP_TTL_MS ? step : null;
};

/** A code was just sent (first send or resend): a fresh 10 minutes and no wrong codes. */
export const rememberCodeStep = (email: string, mode: string) => write({ email, mode, at: Date.now(), wrong: 0 });

export const forgetCodeStep = () => {
  try {
    sessionStorage.removeItem(CODE_STEP_KEY);
  } catch {
    /* nothing stored */
  }
};

const storedWrongCodes = (email: string): number => {
  const step = readRaw();
  return step && step.email === email ? step.wrong : 0;
};

const storeWrongCodes = (email: string, wrong: number) => {
  const step = readRaw();
  if (step && step.email === email) write({ ...step, wrong });
};

const LOCKED_MESSAGE = 'Too many wrong codes. Send a new code to try again.';

const MagicLinkConfirmation = ({ email, onResend, resendError, onChangeEmail, onVerified, showConsent, extraAction }: MagicLinkConfirmationProps) => {
  const [countdown, setCountdown] = useState(COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [wrongCodes, setWrongCodes] = useState(() => storedWrongCodes(email));
  const locked = wrongCodes >= MAX_WRONG_CODES;
  const verifying = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const verify = async (token: string) => {
    if (verifying.current || locked) return;
    verifying.current = true;
    setIsVerifying(true);
    setCodeError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
      trackAnalyticsEvent('auth_code_verified', { source: 'auth_page', route: 'returning' });
      trackAuthStep({ step: 'code_ok', outcome: 'ok' });
      // The code is spent now: whatever the hand-over does must never reach the wrong-code path below.
      try {
        await onVerified();
      } catch {
        /* the parent owns its own failures */
      }
    } catch (error) {
      const { code: errorCode, message: rawMessage } = (error as { code?: unknown; message?: unknown } | null) ?? {};
      const message = String(rawMessage || '').toLowerCase();
      const isInvalid = message.includes('invalid') || message.includes('expired') || errorCode === 'otp_expired';
      // Supabase answers a wrong code with the ambiguous "Token has expired or is invalid", so the word
      // "expired" alone proves nothing: only error.code otp_expired (or an "expired" with no "invalid") is expired.
      const isExpired = errorCode === 'otp_expired' || (message.includes('expired') && !message.includes('invalid'));
      trackAuthStep({ step: 'code_fail', outcome: !isInvalid ? 'error' : isExpired ? 'expired' : 'wrong' });
      if (isInvalid) {
        const wrong = wrongCodes + 1;
        setWrongCodes(wrong);
        storeWrongCodes(email, wrong);
      }
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
      const outcome = await onResend();
      // H7: only a send that landed, or a "too soon" refusal (wait it out), restarts the wait;
      // a plain failure can be retried at once. The reason shows under the box (resendError).
      if (outcome !== 'failed') setCountdown(COOLDOWN);
      if (outcome === 'sent') {
        setCode('');
        setCodeError(null);
      }
      // A send that landed started a fresh step (rememberCodeStep); a failed one keeps the count.
      setWrongCodes(storedWrongCodes(email));
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
          We sent a sign-in email to{' '}
          <strong className="text-foreground">
            <EmailText email={email} />
          </strong>
          .
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
            disabled={isVerifying || locked}
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={CODE_LABEL}
            aria-invalid={codeError || locked ? true : undefined}
            aria-describedby={ERROR_ID}
          >
            {[0, 1].map((group) => (
              <Fragment key={group}>
                {group === 1 && <div role="separator" aria-hidden="true" className="mx-1 min-[360px]:mx-2 h-0.5 w-2 rounded bg-muted-foreground/50" />}
                {/* L20: narrower slots below 360px so all 8 fit a 320px screen. */}
                <InputOTPGroup className="gap-1 min-[360px]:gap-1.5">
                  {Array.from({ length: GROUP_SIZE }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={group * GROUP_SIZE + i}
                      className="h-12 w-7 min-[360px]:w-9 rounded-md border bg-card text-base"
                    />
                  ))}
                </InputOTPGroup>
              </Fragment>
            ))}
          </InputOTP>
        </div>
        {/* Always mounted so screen readers announce the text when it appears. */}
        <p id={ERROR_ID} role="alert" aria-live="assertive" className="text-sm text-destructive">
          {locked ? LOCKED_MESSAGE : codeError || resendError}
        </p>
        {isVerifying && <p className="text-sm text-muted-foreground" role="status">Checking code&hellip;</p>}
        {/* The code auto-submits: there is no Continue, so the line names what it does. */}
        {showConsent && <ConsentLine lead="Entering the code confirms you agree to our" />}
      </div>

      <div className="w-full space-y-2">
        <Button
          variant="secondary"
          className="w-full min-h-[44px] rounded-full"
          disabled={(countdown > 0 && !locked) || isResending}
          onClick={handleResend}
        >
          {isResending ? 'Sending\u2026' : locked ? 'Send a new code' : countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
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
