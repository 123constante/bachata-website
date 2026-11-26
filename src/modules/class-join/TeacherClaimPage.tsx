import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { firstName, longDay } from './classJoinApi';
import {
  claimAuthHref, peekTeacherClaim, redeemTeacherClaim,
  type ClaimPeek, type ClaimRedeemStatus,
} from './teacherClaimApi';

const GENERIC = 'Something went wrong. Try again.';
const BTN = 'flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold';
const PRIMARY = `${BTN} bg-primary text-primary-foreground disabled:opacity-50`;
const SECONDARY = `${BTN} border border-border text-foreground`;

type Step = 'loading' | 'closed' | 'open' | 'linked' | 'requested';

const stepOfRedeem = (s: ClaimRedeemStatus): Step => (s === 'linked' ? 'linked' : s === 'requested' ? 'requested' : 'closed');

export default function TeacherClaimPage() {
  const { token = '' } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  const [peek, setPeek] = useState<ClaimPeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    peekTeacherClaim(token)
      .then((p) => {
        if (!live) return;
        setPeek(p);
        setStep(p.status === 'open' ? 'open' : p.status === 'linked' ? 'linked' : p.status === 'requested' ? 'requested' : 'closed');
      })
      .catch(() => { if (live) setStep('closed'); });
    return () => { live = false; };
  }, [token]);

  const onClaim = async () => {
    setBusy(true); setError(null);
    try {
      const r = await redeemTeacherClaim(token);
      setStep(stepOfRedeem(r.status));
    } catch {
      setError(GENERIC);
    } finally { setBusy(false); }
  };

  let body: JSX.Element;
  if (step === 'loading' || authLoading) {
    body = <div role="status" aria-label="Loading" className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />;
  } else if (step === 'closed') {
    body = (
      <>
        <h1 className="text-lg font-bold">This link doesn&rsquo;t work any more</h1>
        <p className="text-sm text-muted-foreground">Ask the organiser to send you a new one.</p>
        <Link to="/" className={PRIMARY}>Go to Bachata Calendar</Link>
      </>
    );
  } else if (step === 'linked') {
    body = (
      <>
        <h1 className="text-lg font-bold">It&rsquo;s yours</h1>
        <p className="text-sm text-muted-foreground">Your teacher profile is now on your account.</p>
        <Link to="/account/t" className={PRIMARY}>See my teacher area</Link>
        <Link to="/" className={SECONDARY}>Done</Link>
      </>
    );
  } else if (step === 'requested') {
    body = (
      <>
        <h1 className="text-lg font-bold">Thanks</h1>
        <p className="text-sm text-muted-foreground">We&rsquo;ll check it&rsquo;s you and link it within a day.</p>
        <Link to="/" className={SECONDARY}>Done</Link>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-lg font-bold">Hi {firstName(peek?.displayName ?? null)}</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re teaching at {peek?.eventName ?? 'the event'} on {longDay(peek?.nightDate ?? null)}. This is your teacher profile on Bachata Calendar.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {user ? (
          <button type="button" className={PRIMARY} disabled={busy} onClick={onClaim}>Claim my profile</button>
        ) : (
          <>
            <Link to={claimAuthHref(token, 'signup')} className={PRIMARY}>Create an account to claim it</Link>
            <Link to={claimAuthHref(token, 'signin')} className="block py-3 text-center text-xs text-muted-foreground underline">I already have an account</Link>
            <p className="text-center text-xs text-muted-foreground">Use the email or Instagram the organiser has for you, so we can match you.</p>
          </>
        )}
      </>
    );
  }

  return <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-3 p-3">{body}</main>;
}
