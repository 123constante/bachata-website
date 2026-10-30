import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { buildSignInHref } from '@/lib/authRouting';
import { flags } from '@/lib/featureFlags';
import { finishProfileHref } from '@/lib/profileCompletion';
import { uploadToR2 } from '@/lib/uploadToR2';
import { uploadErrorMessage, validateImageFile } from '@/lib/upload-validation';
import { selfServeErrorCopy } from '../../shared/selfServeErrors';
import type { ClaimableOrganiser } from '../../shared/selfServeApi';
import { claimScreen, hintRowText } from '../../home/onboarding/claimStates';
import { useP3Home } from '../data/useP3Data';
import { P3_PATHS } from '../shell/paths';
import { ObSheet, ObShell, ObToast } from './ObShell';
import { OB_THEME_KEY, prefersReducedMotion, readObTheme } from './obEnv';
import { REAL_READS, REAL_WRITES, type PersonReads, type PersonWrites } from './personApi';
import { NoDancerBody, NoDancerFoot, PersonScreens } from './PersonFlow';
import { PERSON_ORDER, heldFrom, personPath, personReadFail, type PersonStep } from './personModel';
import { PAGE_STALE_KEYS, REAL_GO_LIVE, REAL_PAGE_READS, REAL_PAGE_WRITES, type GoLiveApi, type PageReads, type PageWrites } from './pageApi';
import {
  CATEGORIES,
  EMPTY_PAGE,
  KEPT_PARAMS,
  NAME_MAX,
  PAGE_COPY,
  afterContact,
  contactEntry,
  draftFrom,
  e164Of,
  flowPercent,
  reviewPercent,
  fullPath,
  pageBlocked,
  pageCommandFor,
  pageHeldAfter,
  pageHeldFrom,
  phoneE164,
  reviewCopy,
  reviewRow,
  reviewStatusFrom,
  goLiveState,
  goLiveRefusalCopy,
  liveCopy,
  GoLiveError,
  type GoLiveOutcome,
  type GoLiveRefusal,
  keptCreateDraft,
  keptCreateHref,
  type Arrival,
  type FlowStep,
  type PageDraft,
  type PageHeld,
  type PageStep,
  type ReviewRow,
  welcomeTitle,
} from './pageModel';
import { SettingsBody } from './SettingsSheet';
import './page.css';

const TICK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>;
const CHEV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const isPersonStep = (s: string): s is PersonStep => (PERSON_ORDER as readonly string[]).includes(s);
const PAGE_STEPS: readonly string[] = ['welcome', 'find', 'create-name', 'create-city', 'contact', 'contact-phone', 'whatsapp', 'cat', 'link', 'logo'];
const isPageStep = (s: string): s is PageStep => PAGE_STEPS.includes(s);
/** The page screens that need the page's own reads (a page exists by then). */
const DETAIL_STEPS: readonly PageStep[] = ['contact', 'contact-phone', 'whatsapp', 'cat', 'link', 'logo'];

type Stage =
  | { kind: 'page'; step: PageStep }
  | { kind: 'person'; step: PersonStep }
  | { kind: 'review' }
  | { kind: 'live'; outcome: GoLiveOutcome }
  | { kind: 'asked'; name: string };

const FIND_MIN = 2;

export interface OnboardingFlowProps {
  reads?: PageReads;
  writes?: PageWrites;
  personReads?: PersonReads;
  personWrites?: PersonWrites;
  goLive?: GoLiveApi;
  /** The public organiser page exists (flags.organiserDetail); Live's View / Share depend on it. Tests set it. */
  organiserDetail?: boolean;
  /** Tests stub the upload. */
  upload?: (file: File) => Promise<string>;
}

/**
 * P3 onboarding, the whole flow (W4b build 2 slices 2+3, design record docs/design/onboarding-prototype.md).
 * Route /account/p3/start[?o=<organiser id>][&at=<step>]: Welcome, Find / Create (no page yet), the page
 * screens 5-9, slice 1's person screens 10-19 (PersonScreens, reused), Review (21) and Live (22). `at` opens
 * a step directly (Home's banner, Review's rows).
 */
export default function OnboardingFlow({ reads = REAL_PAGE_READS, writes = REAL_PAGE_WRITES, personReads = REAL_READS, personWrites = REAL_WRITES, goLive = REAL_GO_LIVE, organiserDetail = flags.organiserDetail, upload }: OnboardingFlowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const home = useP3Home();
  const uid = user?.id;
  const firstOrg = params.get('o') ?? home.data?.organisers[0]?.id ?? null;
  const [orgId, setOrgId] = useState<string | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const homeReady = !!params.get('o') || !home.isPending;
  useEffect(() => {
    if (arrival || !homeReady || home.isError) return;
    setOrgId(firstOrg);
    setArrival(firstOrg ? 'has-page' : 'no-page');
  }, [arrival, homeReady, home.isError, firstOrg]);

  const at = params.get('at') ?? '';
  const [stage, setStage] = useState<Stage>(() =>
    at === 'review' ? { kind: 'review' } : isPersonStep(at) ? { kind: 'person', step: at } : isPageStep(at) ? { kind: 'page', step: at } : { kind: 'page', step: 'welcome' },
  );
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [theme, setThemeState] = useState(readObTheme);
  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    try {
      window.localStorage.setItem(OB_THEME_KEY, t);
    } catch {
      /* private mode: the switch still works for this visit */
    }
  }, []);
  const exit = useCallback(() => navigate(P3_PATHS.home), [navigate]);

  const page = useQuery({ queryKey: ['p3-ob-page', orgId], queryFn: () => reads.page(orgId as string), enabled: !!orgId, retry: false });
  const phone = useQuery({ queryKey: ['p3-ob-page', 'phone', orgId], queryFn: () => reads.phone(orgId as string), enabled: !!orgId, retry: false });
  const status = useQuery({ queryKey: ['p3-ob-status', orgId], queryFn: () => reads.status(orgId as string), enabled: !!orgId, retry: false });
  const dancer = useQuery({ queryKey: ['p3-ob', 'dancer', uid], queryFn: personReads.dancer, enabled: !!uid, retry: false });
  const intent = useQuery({ queryKey: ['p3-ob', 'intent', uid], queryFn: personReads.intent, enabled: !!uid, retry: false });
  const teacher = useQuery({ queryKey: ['p3-ob', 'teacher', uid], queryFn: personReads.teacher, enabled: !!uid, retry: false });
  const organiser = useQuery({ queryKey: ['p3-ob', 'organiser', orgId], queryFn: () => personReads.organiser(orgId as string), enabled: !!orgId, retry: false });

  const rs = orgId && status.data ? reviewStatusFrom(status.data, orgId) : null;
  // Held page values: taken ONCE per page when its reads land (the draft must not reset under the person's typing).
  const [held, setHeld] = useState<PageHeld | null>(null);
  // A no-page arrival back from Finish profile gets its create answers back (keptCreateDraft).
  const [d, setD] = useState<PageDraft | null>(() => keptCreateDraft(params));
  const heldFor = useRef<string | null>(null);
  useEffect(() => {
    if (!orgId || heldFor.current === orgId || !page.isSuccess || !phone.isSuccess || !status.isSuccess) return;
    heldFor.current = orgId;
    const h = pageHeldFrom({ page: page.data, phone: phone.data, missing: rs?.missing ?? null });
    setHeld(h);
    setD(draftFrom(h));
  }, [orgId, page.isSuccess, page.data, phone.isSuccess, phone.data, status.isSuccess, rs]);

  const personHeld = useMemo(
    () => (dancer.data && intent.data && teacher.data ? heldFrom({ dancer: dancer.data, intent: intent.data, teacher: teacher.data, bio: organiser.data?.bio ?? null }) : null),
    [dancer.data, intent.data, teacher.data, organiser.data],
  );
  const [teachNow, setTeachNow] = useState<'yes' | 'no' | null>(null);
  const teach = teachNow ?? personHeld?.teach ?? null;
  // The WhatsApp step counts on the % from the HELD number (set on arrival, updated when the phone screen's
  // Continue saves), never the live draft: typing a number must not move the bar backwards.
  const waPhone = !!(held && (e164Of(held.phone) ?? phoneE164(held.phone)));
  const groups = (person: readonly PersonStep[]) => fullPath({ arrival: arrival ?? 'has-page', waPhone }, person);
  const percentAt = (step: FlowStep) => flowPercent(step, groups(personPath(teach, true)));

  const go = (s: Stage, how: 'fwd' | 'back' = 'fwd') => {
    setDir(how);
    setStage(s);
  };

  const shell = (screen: string, body: ReactNode, foot: ReactNode, percent = 0, onBack: () => void = exit) => (
    <ObShell screen={screen} dir={dir} percent={percent} onBack={onBack} backLabel="Back" onEscape={onBack} theme={theme} foot={foot}>
      {body}
    </ObShell>
  );
  const loading = (screen: string) =>
    shell(
      `${screen}-loading`,
      <div role="status" aria-label="Loading" data-testid="p3-ob-loading" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="p3-ob-skel" style={{ width: '60%', minHeight: 34 }} />
        <div className="p3-ob-skel" />
      </div>,
      <button type="button" className="p3-ob-btn" aria-disabled="true">Continue</button>,
    );
  const failed = (screen: string, text: string, retry: () => void) =>
    shell(
      `${screen}-error`,
      <>
        <h1 className="p3-ob-t" tabIndex={-1}>{PAGE_COPY.welcome.title}</h1>
        <p className="p3-ob-err" role="alert" data-testid="p3-ob-readfail">{text}</p>
      </>,
      <button type="button" className="p3-ob-btn" onClick={retry} data-testid="p3-ob-retry">Try again</button>,
    );

  if (!user) return null;
  if (home.isError && !params.get('o')) return failed('home', 'We couldn\u2019t load your page. Try again.', () => void home.refetch());
  if (!arrival) return loading('home');
  // Welcome greets by first name: hold it until the dancer read settles so the title never changes after first paint.
  if (stage.kind === 'page' && stage.step === 'welcome' && uid && dancer.isPending) return loading('page');

  const pageReadsFailed = [page, phone, status].some((q) => q.isError);
  const needsPage = stage.kind === 'review' || (stage.kind === 'page' && DETAIL_STEPS.includes(stage.step));
  if (needsPage && orgId) {
    if (pageReadsFailed || page.data === null) return failed('page', 'We couldn\u2019t load your page. Try again.', () => [page, phone, status].forEach((q) => void q.refetch()));
    if (!held || !d || !rs) return loading('page');
  }
  if (needsPage && !orgId) {
    return failed('page', 'You don\u2019t have a page yet. Find or create one first.', () => go({ kind: 'page', step: 'welcome' }, 'back'));
  }

  const invalidate = () => {
    for (const key of PAGE_STALE_KEYS) void qc.invalidateQueries({ queryKey: key as string[] });
  };

  if (stage.kind === 'person') {
    const personReads = [dancer, intent, teacher, ...(orgId ? [organiser] : [])];
    const personFailed = personReads.some((q) => q.isError);
    // No dancer row: Retry cannot succeed, so the screen says so and offers the team's contact link.
    if (personFailed && personReadFail(personReads.map((q) => q.error)) === 'no_dancer') {
      return shell('person-nodancer', <NoDancerBody />, <NoDancerFoot />, 0, () => go({ kind: 'page', step: orgId ? 'logo' : 'welcome' }, 'back'));
    }
    if (personFailed) return failed('person', 'We couldn\u2019t load your details. Try again.', () => [dancer, intent, teacher, organiser].forEach((q) => void q.refetch()));
    if (!personHeld || (orgId && organiser.isPending)) return loading('person');
    return (
      <PersonScreens
        key={`person-${stage.step}`}
        held={personHeld}
        organiser={orgId ? organiser.data ?? null : null}
        userId={user.id}
        writes={{
          run: async (cmd, o) => {
            await personWrites.run(cmd, o);
            if (cmd.kind === 'teach') setTeachNow(cmd.yes ? 'yes' : 'no');
          },
          skipAbout: personWrites.skipAbout,
        }}
        theme={theme}
        initialStep={stage.step}
        upload={upload}
        lastLabel="Continue"
        percentOf={(s, p) => flowPercent(s, groups(p))}
        onExit={() => {
          void qc.invalidateQueries({ queryKey: ['p3-ob'] });
          go({ kind: 'page', step: orgId ? 'logo' : 'welcome' }, 'back');
        }}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ['p3-ob'] });
          void qc.invalidateQueries({ queryKey: ['p3-ob-status'] });
          go({ kind: 'review' });
        }}
      />
    );
  }

  if (stage.kind === 'review' && rs && orgId) {
    return (
      <ReviewScreen
        status={rs}
        goLive={goLive}
        orgId={orgId}
        theme={theme}
        dir={dir}
        steps={groups(personPath(teach, true)).length}
        refreshing={status.isFetching}
        onBack={() => {
          void qc.invalidateQueries({ queryKey: ['p3-ob'] });
          const last = personPath(teach, true);
          go({ kind: 'person', step: last[last.length - 1] }, 'back');
        }}
        onRow={(r) => {
          if (r.step && isPersonStep(r.step)) go({ kind: 'person', step: r.step });
          else if (r.step && isPageStep(r.step)) go({ kind: 'page', step: r.step === 'contact' && held ? contactEntry(held) : r.step });
          else navigate(r.elsewhere === 'page' ? P3_PATHS.youPage : finishProfileHref(`${P3_PATHS.start}?o=${encodeURIComponent(orgId)}&at=review`));
        }}
        onLive={(outcome) => {
          invalidate();
          go({ kind: 'live', outcome });
        }}
        onIncomplete={() => void qc.invalidateQueries({ queryKey: ['p3-ob-status'] })}
        onSignIn={() => navigate(buildSignInHref(`${P3_PATHS.start}?o=${encodeURIComponent(orgId)}&at=review`))}
        onHome={exit}
      />
    );
  }
  if (stage.kind === 'live' && orgId) {
    return <LiveScreen outcome={stage.outcome} name={held?.name || organiser.data?.name || ''} orgId={orgId} organiserDetail={organiserDetail} theme={theme} onHome={exit} onPage={() => navigate(P3_PATHS.youPage)} />;
  }
  if (stage.kind === 'asked') {
    return shell(
      'asked',
      <>
        <h1 className="p3-ob-t" tabIndex={-1} data-testid="p3-ob-title">Asked to join {stage.name}</h1>
        <p className="p3-ob-m">We will check your request and the page team will be in touch.</p>
      </>,
      <button type="button" className="p3-ob-btn" onClick={exit} data-testid="p3-ob-continue">Go to Home</button>,
      0,
      exit,
    );
  }

  // The contact group opens on the held number, or on the phone field when the page has none (known once the reads land).
  // WhatsApp with no usable number (a typed `at`) is off the path: Category.
  const asked = stage.kind === 'page' ? stage.step : 'welcome';
  const step: PageStep = asked === 'contact' && held && !held.phone ? 'contact-phone' : asked === 'whatsapp' && held && !waPhone ? 'cat' : asked;
  const pageName = held?.name || (typeof page.data?.name === 'string' ? page.data.name : '');
  return (
    <PageScreens
      step={step}
      dir={dir}
      theme={theme}
      setTheme={setTheme}
      email={user.email ?? null}
      orgId={orgId}
      firstName={dancer.data?.first_name ?? ''}
      held={held ?? { ...EMPTY_PAGE, name: pageName }}
      draft={d ?? draftFrom(EMPTY_PAGE)}
      setDraft={(f) => setD((p) => f(p ?? draftFrom(EMPTY_PAGE)))}
      setHeld={(h) => setHeld(h)}
      arrival={arrival}
      percent={percentAt(step)}
      reads={reads}
      writes={writes}
      upload={upload}
      userId={user.id}
      onStep={(s, how) => go({ kind: 'page', step: s }, how)}
      onPerson={() => go({ kind: 'person', step: 'name' })}
      onExit={exit}
      onHome={exit}
      onOrg={(id) => {
        heldFor.current = null;
        setHeld(null);
        setD(null);
        setOrgId(id);
        invalidate();
        if (KEPT_PARAMS.some((k) => params.has(k))) {
          setParams((p) => {
            const q = new URLSearchParams(p);
            for (const k of [...KEPT_PARAMS, 'at']) q.delete(k);
            return q;
          }, { replace: true });
        }
      }}
      onAsked={(name) => go({ kind: 'asked', name })}
      onFinishProfile={() => navigate(finishProfileHref(orgId || !d ? P3_PATHS.start : keptCreateHref(P3_PATHS.start, d)))}
      onFullClaim={() => navigate(P3_PATHS.youAdd)}
      invalidate={invalidate}
    />
  );
}

interface PageScreensProps {
  step: PageStep;
  dir: 'fwd' | 'back';
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  email: string | null;
  orgId: string | null;
  /** The dancer's first name when known (Welcome greets by it); '' otherwise. */
  firstName?: string;
  held: PageHeld;
  draft: PageDraft;
  setDraft: (f: (p: PageDraft) => PageDraft) => void;
  setHeld: (h: PageHeld) => void;
  arrival: Arrival;
  percent: number;
  reads: PageReads;
  writes: PageWrites;
  upload?: (file: File) => Promise<string>;
  userId: string;
  onStep: (s: PageStep, how: 'fwd' | 'back') => void;
  onPerson: () => void;
  onExit: () => void;
  onHome: () => void;
  onOrg: (id: string) => void;
  onAsked: (name: string) => void;
  onFinishProfile: () => void;
  onFullClaim: () => void;
  invalidate: () => void;
}

type PageSheet = { kind: 'claim'; page: ClaimableOrganiser } | { kind: 'settings' } | null;

/** Screens 1-9: one question each, one primary button, Back on every one. */
export function PageScreens(props: PageScreensProps) {
  const { step, dir, theme, setTheme, email, orgId, held, draft: d, setDraft, setHeld, arrival, percent, reads, writes, upload, userId, onStep, onPerson, onExit, onOrg, onAsked, onFinishProfile, onFullClaim, invalidate } = props;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; next?: 'finish_profile' | 'reauth' | 'find' } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PageSheet>(null);
  const [bounce, setBounce] = useState(false);
  const [lastContact, setContactVia] = useState<PageStep | null>(null);
  const contactVia: PageStep = lastContact ?? (held.phone ? 'contact' : 'contact-phone');
  const [findQ, setFindQ] = useState('');
  const [cityQ, setCityQ] = useState('');
  const clearToast = useCallback(() => setToast(null), []);
  const set = <K extends keyof PageDraft>(k: K, v: PageDraft[K]) => setDraft((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (!bounce) return;
    const t = setTimeout(() => setBounce(false), 340);
    return () => clearTimeout(t);
  }, [bounce]);

  const waOn = !!(e164Of(d.phone) ?? phoneE164(d.phone));
  const move = (to: PageStep | 'person' | 'exit', how: 'fwd' | 'back') => {
    setError(null);
    setSheet(null);
    if (to === 'exit') return onExit();
    if (to === 'person') return onPerson();
    onStep(to, how);
  };
  const prev = (): PageStep | 'exit' => {
    switch (step) {
      case 'welcome': return 'exit';
      case 'find': return 'welcome';
      case 'create-name': return 'find';
      case 'create-city': return 'create-name';
      case 'contact': return 'welcome';
      case 'contact-phone': return held.phone ? 'contact' : 'welcome';
      case 'whatsapp': return contactVia;
      case 'cat': return waOn ? 'whatsapp' : contactVia;
      case 'link': return 'cat';
      case 'logo': return 'link';
    }
  };
  const back = () => move(prev(), 'back');
  const escape = () => (sheet ? setSheet(null) : back());
  const celebrate = () => {
    if (prefersReducedMotion()) return;
    setBounce(true);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* not every browser has it */
    }
  };
  const next = (): PageStep | 'person' => {
    switch (step) {
      case 'welcome': return orgId ? 'contact' : 'find';
      case 'find': return 'create-name';
      case 'create-name': return 'create-city';
      case 'create-city': return 'contact-phone';
      case 'contact': return afterContact(held.phone);
      case 'contact-phone': return 'whatsapp';
      case 'whatsapp': return 'cat';
      case 'cat': return 'link';
      case 'link': return 'logo';
      case 'logo': return 'person';
    }
  };

  const fail = (e: unknown) => {
    const c = selfServeErrorCopy(e);
    const code = e instanceof Error ? e.message : '';
    setError({
      text: /^invalid_phone/.test(code) ? 'That number did not work. Type + and the country code, like +44 7700 900123.' : c.message === 'Something went wrong. Please try again.' ? 'Couldn\u2019t save. Check your connection and try again.' : c.message,
      next: code === 'organiser_name_taken' ? 'find' : c.next === 'finish_profile' ? 'finish_profile' : c.next === 'reauth' ? 'reauth' : undefined,
    });
  };

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await writes.create(d.name.trim(), d.cityId);
      setSaving(false);
      celebrate();
      onOrg(id);
      // A new page has no number: the contact group opens on the phone field.
      setContactVia('contact-phone');
      move('contact-phone', 'fwd');
    } catch (e) {
      setSaving(false);
      fail(e);
    }
  };

  const continueStep = async () => {
    if (saving) return;
    const reason = pageBlocked(step, d);
    if (reason) {
      setToast(reason);
      return;
    }
    if (step === 'create-city') return void create();
    if (step === 'contact' || step === 'contact-phone') setContactVia(step);
    const cmd = orgId ? pageCommandFor(step, d, held) : null;
    if (cmd && orgId) {
      setSaving(true);
      setError(null);
      try {
        await writes.run(cmd, orgId);
      } catch (e) {
        setSaving(false);
        fail(e);
        return;
      }
      setSaving(false);
      setHeld(pageHeldAfter(step, held, d));
      invalidate();
    }
    celebrate();
    const to = step === 'contact-phone' ? (waOn ? 'whatsapp' : 'cat') : next();
    move(to, 'fwd');
  };

  /** "No public number": confirms the contact with no phone (confirm_organiser_contact_v1 with p_phone null). */
  const noNumber = async () => {
    if (saving || !orgId) return;
    if (!held.contactConfirmed) {
      setSaving(true);
      try {
        await writes.run({ kind: 'confirm', phone: null }, orgId);
      } catch (e) {
        setSaving(false);
        fail(e);
        return;
      }
      setSaving(false);
      setHeld({ ...held, contactConfirmed: true });
      invalidate();
    }
    setContactVia('contact-phone');
    set('phone', held.phone);
    move('cat', 'fwd');
  };

  const copy = PAGE_COPY[step];
  const reason = pageBlocked(step, d);
  const label = saving ? 'Saving\u2026' : step === 'create-city' ? 'Create page' : step === 'contact' ? 'Yes, that\u2019s right' : step === 'welcome' ? (orgId ? 'Let\u2019s go' : 'Find your page') : step === 'find' ? 'Not listed? Create a page' : 'Continue';
  const errorLine = error && (
    <p className="p3-ob-err" role="alert" data-testid="p3-ob-error">
      {error.text}{' '}
      {error.next === 'find' && <button type="button" className="p3-ob-lnk" onClick={() => { setFindQ(d.name); move('find', 'back'); }} data-testid="p3-ob-ask-instead">Ask to join it instead</button>}
      {error.next === 'finish_profile' && <button type="button" className="p3-ob-lnk" onClick={onFinishProfile}>Finish your profile</button>}
    </p>
  );
  const foot = (
    <>
      {errorLine || (reason && step !== 'welcome' && step !== 'find' ? <p className="p3-ob-why" id="p3-ob-why" data-testid="p3-ob-why">{reason}</p> : null)}
      <button
        type="button"
        className="p3-ob-btn"
        aria-disabled={(reason && step !== 'find') || saving ? 'true' : undefined}
        aria-describedby={reason ? 'p3-ob-why' : undefined}
        data-bounce={bounce ? 'true' : undefined}
        onClick={() => (step === 'find' ? move('create-name', 'fwd') : void continueStep())}
        data-testid="p3-ob-continue"
      >
        {label}
      </button>
      {step === 'contact' && <button type="button" className="p3-ob-lnk" onClick={() => move('contact-phone', 'fwd')} data-testid="p3-ob-change-number">Change number</button>}
      {step === 'contact-phone' && !held.phone && orgId && <button type="button" className="p3-ob-lnk" onClick={() => void noNumber()} data-testid="p3-ob-no-number">No public number</button>}
    </>
  );

  const titleOf = step === 'welcome' ? welcomeTitle(props.firstName, orgId ? held.name : '') : copy.title;
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void continueStep();
  };

  return (
    <ObShell screen={step} dir={dir} percent={percent} onBack={back} backLabel="Back" onEscape={escape} theme={theme} foot={foot}>
      <h1 className="p3-ob-t" id="p3-ob-title" tabIndex={-1} data-testid="p3-ob-title">{titleOf}</h1>
      {copy.helper && <p className="p3-ob-m">{copy.helper}</p>}
      {step === 'welcome' && (
        <>
          <p className="p3-ob-m">{orgId ? 'A few quick questions and your page is ready to edit. About five minutes, once only.' : 'Let\u2019s find or set up your organiser page.'}</p>
          <p className="p3-ob-m" data-testid="p3-ob-signedin">
            {email ? <>Signed in as <span className="p3-ob-break">{email}</span>. </> : <>Signed in. </>}
            <button type="button" className="p3-ob-lnk" onClick={() => setSheet({ kind: 'settings' })} data-testid="p3-ob-notyou">Not you?</button>
          </p>
        </>
      )}
      {step === 'find' && <FindStep q={findQ} setQ={setFindQ} reads={reads} onPick={(p) => setSheet({ kind: 'claim', page: p })} />}
      {step === 'create-name' && (
        <input className="p3-ob-inp" type="text" autoComplete="off" placeholder="Bachata Nights Harrogate" aria-labelledby="p3-ob-title" value={d.name} maxLength={NAME_MAX + 20}
          onChange={(e) => set('name', e.target.value)} onKeyDown={enter} data-testid="p3-ob-page-name" />
      )}
      {step === 'create-city' && <CityStep q={cityQ} setQ={setCityQ} reads={reads} chosenId={d.cityId} chosenLabel={d.cityLabel} onPick={(id, label) => setDraft((p) => ({ ...p, cityId: id, cityLabel: label }))} />}
      {step === 'contact' && (
        <div className="p3-ob-card" data-testid="p3-ob-held-phone">
          <p className="p3-ob-m">Shown on {held.name || 'your page'}</p>
          <strong className="p3-ob-big">{held.phone}</strong>
        </div>
      )}
      {step === 'contact-phone' && (
        <input className="p3-ob-inp" type="tel" inputMode="tel" autoComplete="tel" placeholder={'07\u2026'} aria-labelledby="p3-ob-title" value={d.phone}
          onChange={(e) => set('phone', e.target.value)} onKeyDown={enter} data-testid="p3-ob-phone" />
      )}
      {step === 'whatsapp' && (
        <div className="p3-ob-tiles" role="radiogroup" aria-labelledby="p3-ob-title">
          <Tile on={d.whatsapp === 'yes'} onClick={() => set('whatsapp', 'yes')} label="Yes" testId="p3-ob-wa-yes" />
          <Tile on={d.whatsapp === 'no'} onClick={() => set('whatsapp', 'no')} label="No" testId="p3-ob-wa-no" />
        </div>
      )}
      {step === 'cat' && (
        <>
          {(held.name || held.city) && <p className="p3-ob-m">{held.name}{held.city ? `, in ${held.city}` : ''}</p>}
          <div className="p3-ob-tiles" data-five="true" role="radiogroup" aria-labelledby="p3-ob-title">
            {CATEGORIES.map((c) => <Tile key={c.value} on={d.category === c.value} onClick={() => set('category', c.value)} label={c.label} testId={`p3-ob-cat-${c.value.replace(/\s/g, '')}`} />)}
          </div>
        </>
      )}
      {step === 'link' && (
        <input className="p3-ob-inp" type="text" inputMode="url" autoComplete="url" placeholder="yourpage.com or @yourpage" aria-labelledby="p3-ob-title" value={d.link}
          onChange={(e) => set('link', e.target.value)} onKeyDown={enter} data-testid="p3-ob-link" />
      )}
      {step === 'logo' && <LogoStep url={d.logo} orgId={orgId ?? userId} onUrl={(u) => set('logo', u)} upload={upload} />}

      {sheet?.kind === 'claim' && (
        <ClaimSheet
          page={sheet.page}
          theme={theme}
          writes={writes}
          onClose={() => setSheet(null)}
          onClaimed={(id) => {
            setSheet(null);
            onOrg(id);
            move('contact', 'fwd');
          }}
          onAsked={() => onAsked(sheet.page.name)}
          onHome={props.onHome}
          onFullClaim={onFullClaim}
        />
      )}
      {sheet?.kind === 'settings' && (
        <ObSheet title="Settings" onClose={() => setSheet(null)} theme={theme} testId="p3-ob-sheet-settings">
          <SettingsBody key={held.name} theme={theme} setTheme={setTheme} organiserId={orgId} pageName={held.name} rename={writes.rename} onRenamed={(name) => { setHeld({ ...held, name }); invalidate(); }} />
        </ObSheet>
      )}
      {toast && <ObToast text={toast} theme={theme} onDone={clearToast} />}
    </ObShell>
  );
}

function Tile({ on, onClick, label, help, testId }: { on: boolean; onClick: () => void; label: string; help?: string; testId: string }) {
  return (
    <button type="button" className="p3-ob-tile" role="radio" aria-checked={on} onClick={onClick} data-testid={testId}>
      <strong>{label}</strong>
      {help && <span>{help}</span>}
      <span className="p3-ob-tick">{TICK}</span>
    </button>
  );
}

function useDebounced<T>(v: T, ms: number): T {
  const [out, setOut] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setOut(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return out;
}

function SearchInput({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return (
    <div className="p3-ob-search">
      {SEARCH}
      <input className="p3-ob-inp" type="search" placeholder={placeholder} autoComplete="off" aria-labelledby="p3-ob-title" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </div>
  );
}

function FindStep({ q, setQ, reads, onPick }: { q: string; setQ: (v: string) => void; reads: PageReads; onPick: (p: ClaimableOrganiser) => void }) {
  const term = useDebounced(q.trim(), 250);
  const res = useQuery({ queryKey: ['p3-ob-find', term], queryFn: () => reads.findPages(term), enabled: term.length >= FIND_MIN, retry: false });
  return (
    <>
      <SearchInput value={q} onChange={setQ} placeholder={'Try \u201cBachata Leeds\u201d'} testId="p3-ob-find-q" />
      <div className="p3-ob-scrollbox" data-testid="p3-ob-find-results">
        {term.length < FIND_MIN ? (
          <p className="p3-ob-m p3-ob-kbhide">Type two or more letters.</p>
        ) : res.isError ? (
          <p className="p3-ob-err" role="alert">The search didn&rsquo;t work. Check your connection and try again.</p>
        ) : res.isPending ? (
          <p className="p3-ob-m" role="status">Searching&hellip;</p>
        ) : res.data.length === 0 ? (
          <p className="p3-ob-m" role="status">No page called &ldquo;{term}&rdquo;. Create one below.</p>
        ) : (
          <div role="list">
            {res.data.map((p) => (
              <button key={p.id} type="button" role="listitem" className="p3-ob-row" onClick={() => onPick(p)} data-testid={`p3-ob-find-${p.id}`}>
                <span className="p3-ob-row-txt"><strong>{p.name}</strong><span>{hintRowText(p.hint)}</span></span>
                {CHEV}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CityStep({ q, setQ, reads, chosenId, chosenLabel, onPick }: { q: string; setQ: (v: string) => void; reads: PageReads; chosenId: string; chosenLabel: string; onPick: (id: string, label: string) => void }) {
  const term = useDebounced(q.trim(), 250);
  const res = useQuery({ queryKey: ['p3-ob-city', term], queryFn: () => reads.cities(term), enabled: term.length >= FIND_MIN, retry: false });
  const found = (res.data ?? []).filter((c) => c.id !== chosenId).slice(0, chosenId ? 3 : 4);
  return (
    <>
      <SearchInput value={q} onChange={setQ} placeholder="Search cities" testId="p3-ob-city-q" />
      <div className="p3-ob-scrollbox">
        {res.isError && <p className="p3-ob-err" role="alert">The search didn&rsquo;t work. Try again.</p>}
        <div className="p3-ob-chips" role="radiogroup" aria-labelledby="p3-ob-title" data-testid="p3-ob-city-chips">
          {chosenId && (
            <button type="button" role="radio" aria-checked="true" className="p3-ob-chip" onClick={() => onPick('', '')} data-testid="p3-ob-city-chosen">{chosenLabel}</button>
          )}
          {found.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked="false" className="p3-ob-chip" onClick={() => onPick(c.id, c.label)} data-testid={`p3-ob-city-${c.id}`}>{c.label}</button>
          ))}
        </div>
        {term.length >= FIND_MIN && res.isSuccess && found.length === 0 && !chosenId && <p className="p3-ob-m" role="status">No city called &ldquo;{term}&rdquo;.</p>}
      </div>
    </>
  );
}

function LogoStep({ url, orgId, onUrl, upload }: { url: string; orgId: string; onUrl: (u: string) => void; upload?: (f: File) => Promise<string> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateImageFile(file);
    if (check.ok === false) {
      setErr(check.message);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      onUrl(upload ? await upload(file) : await uploadToR2(file, 'avatars', `organiser-${orgId}-${Math.random()}.${ext}`));
    } catch (x) {
      setErr(uploadErrorMessage(x) || 'That logo did not upload. Try again or pick another.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="p3-ob-ava-row">
        <div className="p3-ob-ava" data-sq="true" data-has={url ? 'true' : undefined} data-testid="p3-ob-logo">
          {url ? <img src={url} alt="Your logo" loading="lazy" decoding="async" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 16l5-5 4 4 3-3 4 4" strokeLinejoin="round" /></svg>}
        </div>
        <button type="button" className="p3-ob-ava-btn" onClick={() => input.current?.click()} disabled={busy} data-testid="p3-ob-logo-pick">
          {busy ? 'Uploading\u2026' : url ? 'Change logo' : 'Choose a logo'}
        </button>
      </div>
      <input ref={input} className="p3-ob-sr" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} data-testid="p3-ob-logo-file" />
      {err && <p className="p3-ob-err" role="alert" data-testid="p3-ob-logo-err">{err}</p>}
    </>
  );
}

function ClaimSheet({ page, theme, writes, onClose, onClaimed, onAsked, onHome, onFullClaim }: {
  page: ClaimableOrganiser; theme: 'light' | 'dark'; writes: PageWrites; onClose: () => void; onClaimed: (id: string) => void; onAsked: () => void; onHome: () => void; onFullClaim: () => void;
}) {
  const s = claimScreen(page.hint, page.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; reauth: boolean } | null>(null);
  const act = async () => {
    if (s.primary === 'home') return onHome();
    setBusy(true);
    setErr(null);
    try {
      if (s.primary === 'claim') {
        await writes.claim(page.id);
        onClaimed(page.id);
      } else {
        await writes.ask(page.id);
        onAsked();
      }
    } catch (e) {
      const c = selfServeErrorCopy(e);
      setErr({ text: c.message, reauth: c.next === 'reauth' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ObSheet title={s.title} onClose={onClose} theme={theme} testId="p3-ob-sheet-claim">
      <p className="p3-ob-m">{s.sub}</p>
      {err && (
        <p className="p3-ob-err" role="alert" data-testid="p3-ob-claim-err">
          {err.text} {err.reauth && <button type="button" className="p3-ob-lnk" onClick={onFullClaim}>Confirm with an email code</button>}
        </p>
      )}
      <button type="button" className="p3-ob-btn" aria-disabled={busy ? 'true' : undefined} onClick={() => void act()} data-testid="p3-ob-claim-go">{busy ? 'Saving\u2026' : s.primaryLabel}</button>
      {s.notThisOne && <button type="button" className="p3-ob-lnk" onClick={onClose}>Not this one</button>}
    </ObSheet>
  );
}

function ReviewScreen({ status, goLive, orgId, theme, dir, steps, refreshing, onBack, onRow, onLive, onIncomplete, onSignIn, onHome }: {
  status: NonNullable<ReturnType<typeof reviewStatusFrom>>; goLive: GoLiveApi; orgId: string; theme: 'light' | 'dark'; dir: 'fwd' | 'back'; steps: number; refreshing: boolean;
  onBack: () => void; onRow: (r: ReviewRow) => void; onLive: (outcome: GoLiveOutcome) => void; onIncomplete: () => void; onSignIn: () => void; onHome: () => void;
}) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<GoLiveRefusal | null>(null);
  // What the server said is still missing (an incomplete refusal), shown at once, before the status read catches up.
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  // Double-tap safe: a ref, not state, so a second tap in the same frame cannot start a second call; it stays set
  // after a success (the screen is leaving), so one Go live shows one result.
  const inFlight = useRef(false);
  const shown = useMemo(() => ({ ...status, missing: [...status.missing, ...serverMissing.filter((m) => !status.missing.includes(m))] }), [status, serverMissing]);
  const rows = shown.missing.map(reviewRow);
  const c = reviewCopy(shown, goLive.deployed);
  const state = goLiveState(shown, goLive.deployed);
  // New missing items from the status read outrank an earlier refusal: the disabled reason shows, not "Try again".
  const missingKey = status.missing.join(',');
  const seenMissing = useRef(missingKey);
  useEffect(() => {
    if (seenMissing.current === missingKey) return;
    seenMissing.current = missingKey;
    setRefused(null);
  }, [missingKey]);
  const percent = reviewPercent(steps, shown.missing.length);
  const fail = refused ? goLiveRefusalCopy(refused) : null;
  const primaryLabel = fail?.action === 'home' ? 'Go to Home' : fail?.action === 'sign-in' ? 'Sign in again' : fail?.action === 'retry' ? 'Try again' : c.primary;
  const primary = async () => {
    if (state === 'live' || state === 'in-review' || state === 'closed' || fail?.action === 'home') return onHome();
    if (fail?.action === 'sign-in') return onSignIn();
    if (c.reason) return setToast(c.reason);
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRefused(null);
    try {
      const outcome = await goLive.complete(orgId);
      onLive(outcome);
      return;
    } catch (e) {
      const r: GoLiveRefusal = e instanceof GoLiveError ? e.refusal : 'failed';
      if (e instanceof GoLiveError && r === 'incomplete') {
        setServerMissing(e.missing);
        onIncomplete();
      }
      setRefused(r);
      inFlight.current = false;
    }
    setBusy(false);
  };
  const rowBtn = (r: ReviewRow) => (
    <button key={r.code} type="button" className="p3-ob-row" onClick={() => { setAll(false); onRow(r); }} data-testid={`p3-ob-review-${r.code}`}>
      <span className="p3-ob-row-txt"><strong>{r.label}</strong><span>{r.step ? 'To do' : r.elsewhere === 'page' ? 'To do, on your page' : 'To do, in your dancer profile'}</span></span>
      {CHEV}
    </button>
  );
  return (
    <ObShell screen="review" dir={dir} percent={percent} onBack={onBack} backLabel="Back" onEscape={() => (all ? setAll(false) : onBack())} theme={theme}
      foot={
        <>
          {fail ? <p className="p3-ob-err" role="alert" data-testid="p3-ob-golive-err">{fail.text}</p> : c.reason ? <p className="p3-ob-why" id="p3-ob-why" data-testid="p3-ob-why">{c.reason}</p> : null}
          <button type="button" className="p3-ob-btn" aria-disabled={(c.reason && fail?.action !== 'home' && fail?.action !== 'sign-in') || busy ? 'true' : undefined} aria-describedby={c.reason && !fail ? 'p3-ob-why' : undefined} onClick={() => void primary()} data-testid="p3-ob-continue">
            {busy ? 'Going live\u2026' : primaryLabel}
          </button>
        </>
      }>
      <h1 className="p3-ob-t" id="p3-ob-title" tabIndex={-1} data-testid="p3-ob-title">{c.title}</h1>
      <p className="p3-ob-m" data-testid="p3-ob-review-sub" aria-busy={refreshing || undefined}>{c.sub}</p>
      {rows.length > 0 && (
        <>
          <div className="p3-ob-card p3-ob-card-list" data-testid="p3-ob-review-next">{rowBtn(rows[0])}</div>
          {rows.length > 1 && <button type="button" className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm" onClick={() => setAll(true)} data-testid="p3-ob-review-all">Show all</button>}
        </>
      )}
      {all && (
        <ObSheet title={c.title} onClose={() => setAll(false)} theme={theme} testId="p3-ob-sheet-review">
          {rows.map(rowBtn)}
        </ObSheet>
      )}
      {toast && <ObToast text={toast} theme={theme} onDone={clearToast} />}
    </ObShell>
  );
}

/** Screen 22. Only reached after goLive.complete resolved; `pending_review` is the review variant (liveCopy), never "You're live". */
function LiveScreen({ outcome, name, orgId, organiserDetail, theme, onHome, onPage }: {
  outcome: GoLiveOutcome; name: string; orgId: string; organiserDetail: boolean; theme: 'light' | 'dark'; onHome: () => void; onPage: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const c = liveCopy(outcome, name, organiserDetail);
  const href = `/organisers/${encodeURIComponent(orgId)}`;
  const share = async () => {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote('Link copied.');
      }
    } catch {
      /* the person closed the share sheet */
    }
  };
  const first = c.actions[0];
  const line = (a: string) => (a === first ? 'p3-ob-btn' : 'p3-ob-btn p3-ob-btn-line');
  return (
    <ObShell screen={outcome === 'live' ? 'live' : 'live-review'} dir="fwd" percent={100} onBack={onHome} backLabel="Go to Home" onEscape={onHome} theme={theme}
      foot={
        <>
          {c.actions.includes('view') &&
            (c.publicView ? (
              <a className={line('view')} href={href} data-testid="p3-ob-live-view">View my page</a>
            ) : (
              <button type="button" className={line('view')} onClick={onPage} data-testid="p3-ob-live-view">View my page</button>
            ))}
          {c.actions.includes('share') && <button type="button" className={line('share')} onClick={() => void share()} data-testid="p3-ob-live-share">Share</button>}
          <button type="button" className={line('home')} onClick={onHome} data-testid="p3-ob-live-home">Go to Home</button>
        </>
      }>
      {c.celebrate && <Confetti />}
      <div className="p3-ob-celebrate">
        <div className="p3-ob-bigtick">{TICK}</div>
        <h1 className="p3-ob-t" id="p3-ob-title" tabIndex={-1} data-testid="p3-ob-title">{c.title}</h1>
        <p className="p3-ob-m" data-testid="p3-ob-live-sub">{c.sub}</p>
      </div>
      {note && <ObToast text={note} theme={theme} onDone={clearNote} />}
    </ObShell>
  );
}

/** Confetti on a canvas behind the celebration; none under prefers-reduced-motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || prefersReducedMotion()) return;
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    const w = (c.width = c.offsetWidth || 320);
    const h = (c.height = c.offsetHeight || 480);
    const colours = ['#f4b400', '#e8590c', '#2f9e44', '#1c7ed6', '#ae3ec9'];
    const bits = Array.from({ length: 90 }, (_, i) => ({ x: Math.random() * w, y: -Math.random() * h, v: 2 + Math.random() * 3, s: 4 + Math.random() * 5, c: colours[i % colours.length], r: Math.random() * 6 }));
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.y += b.v;
        b.r += 0.1;
        ctx.fillStyle = b.c;
        ctx.save();
        ctx.translate(b.x + Math.sin(b.r) * 6, b.y);
        ctx.rotate(b.r);
        ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6);
        ctx.restore();
      }
      if (t - t0 < 2600) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="p3-ob-confetti" aria-hidden="true" data-testid="p3-ob-confetti" />;
}
