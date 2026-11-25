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
import { fetchFlagOn, fetchNameMatches, onboardOrganiser } from './selfSignupApi';
import FirstEventStep from './FirstEventStep';
import {
  DEBOUNCE_MS, outcomeCopy, refusalView, shouldSearchMatches, GENERIC_FAILURE,
  type FirstEventInput, type NameMatch, type OnboardResult, type RefusalView,
} from './selfSignupModel';

const SITE_ORIGIN = 'https://bachatacalendar.co.uk';

async function sharePage(url: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ url });
    else await navigator.clipboard.writeText(url);
  } catch { /* cancelled or blocked: nothing to do */ }
}

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';

type Step = 'email' | 'code' | 'who' | 'working' | 'result' | 'refused' | 'about' | 'done' | 'event';

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
  const [eventDraft, setEventDraft] = useState<FirstEventInput>({ name: '', date: '' });
  const [eventError, setEventError] = useState<string | null>(null);
  // What the last save actually sent, so "Try again" never resends an event the person skipped.
  const [sentEvent, setSentEvent] = useState<FirstEventInput | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [flagOn, setFlagOn] = useState(false);
  const seq = useRef(0);

  // Flag gate on load: the page renders only once organiser_onboarding_v2 is confirmed on. Fail closed.
  useEffect(() => {
    let live = true;
    void fetchFlagOn().then((on) => { if (live) setFlagOn(on); });
    return () => { live = false; };
  }, []);

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
    if (step !== 'who' || !shouldSearchMatches(name, city?.id ?? null) || !city) { setMatches([]); return; }
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

  if (notFound || !flagOn) return <NotFound />;
  if (authStatus === 'resolving') return shell(<p className="text-[14px] text-muted-foreground">One moment&hellip;</p>);

  const submit = async (firstEvent: FirstEventInput | null = null) => {
    if (!city) return;
    setStep('working');
    setEventError(null);
    setSentEvent(firstEvent);
    const res = await onboardOrganiser(name, city.id, claimTarget, firstEvent);
    if (res.kind === 'success') { setResult(res); setStep('result'); return; }
    if (res.kind === 'signed_out') { setStep('email'); return; }
    const view = res.kind === 'refused' ? refusalView(res.reason) : { action: 'retry' as const, message: GENERIC_FAILURE };
    if (view.action === 'not_found') { setNotFound(true); return; }
    if (view.action === 'back_to_email') { setStep('code'); return; }
    if (view.action === 'back_to_event') { setEventError(view.message); setStep('event'); return; }
    setRefusal(view);
    setStep('refused');
  };

  if (step === 'working') return shell(<p className="text-[14px] text-muted-foreground" role="status">Creating your page&hellip;</p>);

  if (step === 'refused' && refusal) {
    return shell(
      <>
        <p className="text-[15px]" data-testid="signup-refusal">{refusal.message}</p>
        {refusal.action === 'own_page' && <Link to={ORGANISER_HOME_PATH} className={BTN} data-testid="signup-own-page">Open my page</Link>}
        {refusal.action === 'retry' && <button type="button" className={BTN} onClick={() => void submit(sentEvent)} data-testid="signup-retry">Try again</button>}
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
        <button type="button" className={GHOST} onClick={() => setStep('who')} data-testid="signup-back">Back</button>
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
        <div className="flex justify-center" aria-hidden="true" data-testid="signup-done-tick"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2f7d4f] text-[36px] font-bold leading-none text-white">&#10003;</span></div>
        <h1 className="text-[26px] font-bold leading-tight" data-testid="signup-done-line">You&rsquo;re all set</h1>
        <p className="text-[14px] text-muted-foreground" data-testid="signup-done-sub">{result?.outcome === 'created_claim_waiting' ? 'Your claim is in.' : 'Your page is live. Welcome aboard.'}</p>
        {result?.slug && <p className="text-[14px] font-medium break-all" data-testid="signup-page-link">bachatacalendar.co.uk/organisers/{result.slug}</p>}
        {result?.slug && <button type="button" className={BTN} onClick={() => void sharePage(`${SITE_ORIGIN}/organisers/${result.slug}`)} data-testid="signup-share">Share your page</button>}
        <Link to={ORGANISER_HOME_PATH} className={GHOST} data-testid="signup-open-page">See my page</Link>
      </>,
    );
  }

  if (step === 'event') {
    return shell(
      <FirstEventStep
        initial={eventDraft}
        error={eventError}
        onContinue={(e) => { setEventDraft(e); void submit(e); }}
        onSkip={() => void submit(null)}
        onBack={(e) => { setEventDraft(e); setEventError(null); setStep('who'); }}
      />,
      true,
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
        <button type="button" className={BTN} disabled={name.trim().length < 2 || !city} onClick={() => (claimTarget ? void submit() : setStep('event'))} data-testid="signup-submit">Create my page</button>
        {!user && <button type="button" className={GHOST} onClick={() => setStep('code')} data-testid="signup-back">Back</button>}
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
      true,
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
