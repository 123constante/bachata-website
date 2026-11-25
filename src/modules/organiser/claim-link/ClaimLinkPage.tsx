import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { EmailCodeProof } from '@/modules/organiser/shared/components/EmailCodeProof';
import { fetchOrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import NotFound from '@/pages/NotFound';
import { redeemClaimLink } from './claimLinkApi';
import { CLAIM_TOKEN_RE, REFUSAL_SCREENS, type ClaimOutcome } from './claimLinkModel';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';

type Step = 'email' | 'code' | 'working' | 'result';

/** /claim/:token. Flag organiser_onboarding_v2 is a DB flag: the server answers feature_off, which shows the not-found page. */
export default function ClaimLinkPage() {
  useNoindexMeta(true);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  const { token = '' } = useParams<{ token: string }>();
  const { user, authStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null);
  const [pageName, setPageName] = useState<string | null>(null);

  const redeem = useCallback(async () => {
    setStep('working');
    const result = await redeemClaimLink(token);
    if (result.kind === 'success' && result.organiserId) {
      try {
        const home = await fetchOrganiserHome();
        setPageName(home.organisers.find((o) => o.id === result.organiserId)?.name ?? null);
      } catch { setPageName(null); }
    }
    setOutcome(result);
    setStep(result.kind === 'signed_out' ? 'email' : 'result');
  }, [token]);

  // Signed in on arrival (or right after the code): redeem once.
  useEffect(() => {
    if (authStatus === 'ready' && user && step === 'email' && outcome === null && CLAIM_TOKEN_RE.test(token)) void redeem();
  }, [authStatus, user, step, outcome, token, redeem]);

  const shell = (body: React.ReactNode) => (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-6 pt-3" data-testid="claim-step" data-step={step}>{body}</div>
    </GlobalLayout>
  );

  if (authStatus === 'resolving') return shell(<p className="text-[14px] text-muted-foreground">One moment&hellip;</p>);
  if (!CLAIM_TOKEN_RE.test(token)) return shell(refusal('invalid'));
  if (outcome?.kind === 'refused' && outcome.reason === 'feature_off') return <NotFound />;

  if (step === 'working') return shell(<p className="text-[14px] text-muted-foreground" role="status">Claiming your page&hellip;</p>);

  if (step === 'result' && outcome) {
    if (outcome.kind === 'success') {
      return shell(
        <>
          <h1 className="text-[22px] font-bold leading-tight">It&rsquo;s yours</h1>
          {pageName && <p className="text-[16px] font-semibold" data-testid="claim-page-name">{pageName}</p>}
          <p className="text-[14px] text-muted-foreground">You can now look after this page and add your events.</p>
          <Link to={ORGANISER_HOME_PATH} className={BTN} data-testid="claim-continue">Continue</Link>
        </>,
      );
    }
    if (outcome.kind === 'refused') {
      if (outcome.reason === 'email_unproven') {
        return shell(
          <>
            {refusal('email_unproven')}
            <button type="button" className={BTN} onClick={() => { setOutcome(null); setStep('code'); }} data-testid="claim-try-again">Try again</button>
          </>,
        );
      }
      return shell(refusal(outcome.reason));
    }
    return shell(
      <>
        <h1 className="text-[22px] font-bold leading-tight">Something went wrong</h1>
        <p className="text-[14px] text-muted-foreground">We could not claim the page. Please try again.</p>
        <button type="button" className={BTN} onClick={() => { setOutcome(null); setStep('email'); }} data-testid="claim-retry">Try again</button>
      </>,
    );
  }

  if (step === 'code' || user?.email) {
    const address = user?.email ?? email.trim();
    return shell(
      <>
        <h1 className="text-[22px] font-bold leading-tight">Check your email</h1>
        <EmailCodeProof email={address} returnTo={`/claim/${token}`} onProven={() => { setOutcome(null); void redeem(); }} />
        {!user && <button type="button" className={GHOST} onClick={() => setStep('email')} data-testid="claim-back">Back</button>}
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-[22px] font-bold leading-tight">What&rsquo;s your email?</h1>
      <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[48px] text-[16px]" aria-label="Your email" data-testid="claim-email" />
      <Button type="button" className="min-h-[48px] rounded-xl" disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => setStep('code')} data-testid="claim-send">Email me a code</Button>
    </>,
  );
}

function refusal(reason: keyof typeof REFUSAL_SCREENS) {
  const s = REFUSAL_SCREENS[reason];
  return (
    <div data-testid={`claim-refusal-${reason}`}>
      <h1 className="text-[22px] font-bold leading-tight">{s.heading}</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">{s.body}</p>
    </div>
  );
}
