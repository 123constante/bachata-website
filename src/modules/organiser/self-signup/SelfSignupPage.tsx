import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { EmailCodeProof } from '@/modules/organiser/shared/components/EmailCodeProof';
import { searchCities, type CityResult } from '@/modules/organiser/home/onboarding/citySearch';
import AboutYouScreen from '@/modules/organiser/claim-link/AboutYouScreen';
import NotFound from '@/pages/NotFound';
import { fetchNameMatches, onboardOrganiser } from './selfSignupApi';
import {
  DEBOUNCE_MS, outcomeCopy, refusalView, shouldSearchMatches, GENERIC_FAILURE,
  type NameMatch, type OnboardResult, type RefusalView,
} from './selfSignupModel';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';

type Step = 'email' | 'code' | 'who' | 'working' | 'result' | 'refused' | 'about' | 'done';

/** /start-organiser. Unlisted, noindex. The DB flag organiser_onboarding_v2 off = the not-found page. */
export default function SelfSignupPage() {
  useNoindexMeta(true);
  const { user, authStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [name, setName] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [city, setCity] = useState<CityResult | null>(null);
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [claimTarget, setClaimTarget] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [result, setResult] = useState<Extract<OnboardResult, { kind: 'success' }> | null>(null);
  const [refusal, setRefusal] = useState<RefusalView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const seq = useRef(0);

  // Signed in on arrival: skip the email screen. The server refuses email_not_proven if the mailbox is not proven.
  useEffect(() => {
    if (authStatus === 'ready' && user && (step === 'email' || step === 'code')) setStep('who');
  }, [authStatus, user, step]);

  useEffect(() => {
    if (city || cityQuery.trim().length < 2) { setCityResults([]); return; }
    const t = setTimeout(() => { searchCities(cityQuery).then(setCityResults).catch(() => setCityResults([])); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityQuery, city]);

  useEffect(() => {
    setMatches([]);
    if (step !== 'who' || !shouldSearchMatches(name, city?.id ?? null) || !city) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      void fetchNameMatches(name, city.id).then((m) => { if (mine === seq.current) setMatches(m); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [name, city, step]);

  const shell = (body: React.ReactNode, footer = false) => (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-6 pt-3" data-testid="signup-step" data-step={step}>
        {body}
        {footer && <Link to={ORGANISER_HOME_PATH} className={GHOST} data-testid="signup-save-later">Save later</Link>}
      </div>
    </GlobalLayout>
  );

  if (notFound) return <NotFound />;
  if (authStatus === 'resolving') return shell(<p className="text-[14px] text-muted-foreground">One moment&hellip;</p>);

  const submit = async () => {
    if (!city) return;
    setStep('working');
    const res = await onboardOrganiser(name, city.id, claimTarget);
    if (res.kind === 'success') { setResult(res); setStep('result'); return; }
    if (res.kind === 'signed_out') { setStep('email'); return; }
    const view = res.kind === 'refused' ? refusalView(res.reason) : { action: 'retry' as const, message: GENERIC_FAILURE };
    if (view.action === 'not_found') { setNotFound(true); return; }
    if (view.action === 'back_to_email') { setStep('code'); return; }
    setRefusal(view);
    setStep('refused');
  };

  if (step === 'working') return shell(<p className="text-[14px] text-muted-foreground" role="status">Creating your page&hellip;</p>);

  if (step === 'refused' && refusal) {
    return shell(
      <>
        <p className="text-[15px]" data-testid="signup-refusal">{refusal.message}</p>
        {refusal.action === 'own_page' && <Link to={ORGANISER_HOME_PATH} className={BTN} data-testid="signup-own-page">Open my page</Link>}
        {refusal.action === 'retry' && <button type="button" className={BTN} onClick={() => void submit()} data-testid="signup-retry">Try again</button>}
        <button type="button" className={GHOST} onClick={() => setStep('who')} data-testid="signup-back">Back</button>
      </>,
      true,
    );
  }

  if (step === 'result' && result) {
    return shell(
      <>
        <h1 className="text-[22px] font-bold leading-tight" data-testid="signup-outcome">{outcomeCopy(result.outcome, result.displayName)}</h1>
        <button type="button" className={BTN} onClick={() => setStep('about')} data-testid="signup-continue">Continue</button>
      </>,
      true,
    );
  }

  if (step === 'about' && user) {
    return shell(
      <AboutYouScreen userId={user.id} signInEmail={user.email ?? null} onSaved={() => setStep('done')} onSkip={() => setStep('done')} onBack={() => setStep('result')} />,
      true,
    );
  }

  if (step === 'done') {
    return shell(
      <>
        <h1 className="text-[26px] font-bold leading-tight" data-testid="signup-done-line">You&rsquo;re all set</h1>
        {result?.displayName && <p className="text-[18px] font-semibold">{result.displayName}</p>}
        <p className="text-[14px] text-muted-foreground">Your page is live. Welcome aboard.</p>
        <Link to={ORGANISER_HOME_PATH} className={BTN} data-testid="signup-open-page">Open my page</Link>
      </>,
    );
  }

  if (step === 'who') {
    const visible = matches.filter((m) => !dismissed.includes(m.organiserId));
    return shell(
      <>
        <h1 className="text-[22px] font-bold leading-tight">Who is running it?</h1>
        <Input value={name} onChange={(e) => { setName(e.target.value); setClaimTarget(null); setDismissed([]); }} className="min-h-[48px] text-[16px]" aria-label="Organiser name" data-testid="signup-name" />
        {visible.map((m) => (
          <div key={m.organiserId} className="rounded-xl border-2 border-primary p-3" data-testid="signup-match-card">
            <p className="text-[15px] font-semibold">Looks like it is already here: {m.displayName} &middot; {m.city}</p>
            {m.emailMatch && <p className="mt-1 text-[14px] text-muted-foreground">Its contact email matches yours.</p>}
            <div className="mt-2 flex flex-col gap-2">
              <button type="button" className={claimTarget === m.organiserId ? BTN : GHOST} onClick={() => setClaimTarget(m.organiserId)} data-testid="signup-yes">Yes, this is me</button>
              <button type="button" className={GHOST} onClick={() => { if (claimTarget === m.organiserId) setClaimTarget(null); setDismissed((d) => [...d, m.organiserId]); }} data-testid="signup-no">No, mine is different</button>
            </div>
          </div>
        ))}
        {city ? (
          <div className="flex items-center justify-between rounded-xl border border-border p-3 text-[15px]">
            <span data-testid="signup-city-chosen">{city.label}</span>
            <button type="button" className="text-[14px] underline" onClick={() => { setCity(null); setClaimTarget(null); setDismissed([]); }}>Change</button>
          </div>
        ) : (
          <>
            <Input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="City" className="min-h-[48px] text-[16px]" aria-label="City" data-testid="signup-city" />
            {cityResults.map((c) => (
              <button key={c.id} type="button" className={GHOST} onClick={() => { setCity(c); setCityResults([]); }} data-testid="signup-city-option">{c.label}</button>
            ))}
          </>
        )}
        <button type="button" className={BTN} disabled={name.trim().length < 2 || !city} onClick={() => void submit()} data-testid="signup-submit">Create my page</button>
      </>,
      true,
    );
  }

  const address = user?.email ?? email.trim();
  if (step === 'code') {
    return shell(
      <>
        <h1 className="text-[22px] font-bold leading-tight">Check your email</h1>
        <EmailCodeProof email={address} returnTo="/start-organiser" onProven={() => setStep('who')} />
        <button type="button" className={GHOST} onClick={() => setStep('email')} data-testid="signup-back">Back</button>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-[22px] font-bold leading-tight">What&rsquo;s your email?</h1>
      <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[48px] text-[16px]" aria-label="Your email" data-testid="signup-email" />
      <button type="button" className={BTN} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} onClick={() => setStep('code')} data-testid="signup-send">Email me a code</button>
    </>,
  );
}
