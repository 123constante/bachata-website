// Raffle winner page /raffle/win/:token: a small orchestrator over src/modules/raffle-win/**.
// ISOLATION: no import from @/modules/dancer-app (see scripts/dancer-area-isolation-allowlist.json).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchRaffleBoard } from '@/hooks/useRaffleBoard';
import { getSupabase } from '@/integrations/supabase/getSupabase';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import {
  parseClaim, parseLock, screenForClaim, type OpenNight, type WinScreen,
} from '@/modules/raffle-win/model';
import { missingProfileFields, type ProfileField } from '@/modules/raffle-win/profileFields';
import { applyRefusal, type PickSelection } from '@/modules/raffle-win/pick/pickModel';
import type { PickRefusal, ShownRefusal } from '@/modules/raffle-win/pick/pickCopy';
import { PickScreen } from '@/modules/raffle-win/pick/PickScreen';
import { ProfileSteps, type ProfileValues } from '@/modules/raffle-win/profile/ProfileSteps';
import GateScreen from '@/modules/raffle-win/screens/GateScreen';
import HonestySheet, { nightParts } from '@/modules/raffle-win/screens/HonestySheet';
import StatusScreen from '@/modules/raffle-win/screens/StatusScreen';
import WonScreen from '@/modules/raffle-win/screens/WonScreen';
import { ShareStep } from '@/modules/raffle-win/share/ShareStep';
import { posterText } from '@/modules/raffle-win/sharePoster';

const FROM_AUTH_KEY = 'raffle_win_from_auth';
// Same value as RAFFLE_FRESH_KEY in dancer-app/screens/home/raffleWinModel.ts (not imported: isolation).
const FRESH_KEY = 'raffle_win_fresh';

type Step = WinScreen | 'profile';
const ALL_FIELDS: ProfileField[] = ['avatar_url', 'first_name', 'dance_role', 'based_city_id', 'nationality', 'languages'];

const readFromAuth = (): boolean => { try { return sessionStorage.getItem(FROM_AUTH_KEY) === '1'; } catch { return false; } };
const clearFromAuth = () => { try { sessionStorage.removeItem(FROM_AUTH_KEY); } catch { /* storage blocked */ } };
const setFresh = () => { try { sessionStorage.setItem(FRESH_KEY, '1'); } catch { /* storage blocked */ } };

const asRow = (d: unknown): Record<string, unknown> | null =>
  typeof d === 'object' && d !== null && !Array.isArray(d) && typeof (d as Record<string, unknown>).profile_id === 'string'
    ? (d as Record<string, unknown>) : null;

/** Read the signed-in person's profile row; on failure ensure it exists and retry once; else null. */
async function readProfile(): Promise<Record<string, unknown> | null> {
  const attempt = async () => {
    try { const r = await rpcLoose('my_dancer_edit_v1'); return r.error ? null : asRow(r.data); } catch { return null; }
  };
  const first = await attempt();
  if (first) return first;
  try { await rpcLoose('ensure_my_dancer_profile_v1'); } catch { /* fall through */ }
  return attempt();
}

const initialFrom = (row: Record<string, unknown> | null): Partial<ProfileValues> => {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    avatar_url: s(row?.avatar_url), first_name: s(row?.first_name), dance_role: s(row?.dance_role),
    based_city_id: s(row?.based_city_id), nationality: s(row?.nationality),
    languages: Array.isArray(row?.languages) ? (row.languages as unknown[]).filter((x): x is string => typeof x === 'string') : [],
  };
};

const REFUSALS: readonly string[] = ['spot_taken', 'already_been_to_event', 'night_not_open', 'honesty_required'];
const refusalKey = (reason: string): PickRefusal | null => (REFUSALS.includes(reason) ? (reason as PickRefusal) : null);

export default function RaffleWin() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const [step, setStep] = useState<Step>('loading');
  const [winId, setWinId] = useState('');
  const [nights, setNights] = useState<OpenNight[]>([]);
  const [selection, setSelection] = useState<PickSelection>(null);
  const [banner, setBanner] = useState<ShownRefusal | null>(null);
  const [night, setNight] = useState<OpenNight | null>(null);
  const [ticked, setTicked] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [afterLock, setAfterLock] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [missing, setMissing] = useState<ProfileField[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [initial, setInitial] = useState<Partial<ProfileValues>>({});
  const [dancers, setDancers] = useState<number | null>(null);
  const profileDone = useRef(false);

  // Tell the board the winner opened the link: once per mount, fire and forget.
  // The RPC ships in admin PR #2427 (not in generated types yet), hence rpcLoose.
  const openedSent = useRef(false);
  useEffect(() => {
    if (!token || openedSent.current) return;
    openedSent.current = true;
    try { void rpcLoose('raffle_win_link_opened_v1', { p_link_token: token }).catch(() => {}); } catch { /* swallowed */ }
  }, [token]);

  const claim = useCallback(async () => {
    setStep('loading');
    const fromAuth = readFromAuth();
    let r;
    try {
      const res = await rpcLoose('raffle_win_claim_link_v1', { p_link_token: token });
      r = res.error ? ({ kind: 'error' } as const) : parseClaim(res.data);
    } catch { r = { kind: 'error' } as const; }
    clearFromAuth();
    if (r.kind === 'ok') { setWinId(r.winId); setNights(r.nights); setFirstName(r.firstName); setSelection(null); setBanner(null); setTicked(false); }
    const next = screenForClaim(r, { fromAuth });
    if (next === 'qr') { navigate('/app/home', { replace: true }); return; }
    setAfterLock(false);
    setStep(next);
  }, [token, navigate]);

  useEffect(() => {
    if (isLoading) return;
    if (!signedIn) { setStep('claim'); return; }
    void claim();
  }, [isLoading, signedIn, claim]);

  useEffect(() => {
    if (step !== 'share') return;
    let live = true;
    fetchRaffleBoard().then((b) => { if (live) setDancers(b.poolCount > 0 ? b.poolCount : null); }).catch(() => undefined);
    return () => { live = false; };
  }, [step]);

  // Onboarding can newly link "been to" events: re-read the open nights so the list is honest again.
  const reloadAfterProfile = async () => {
    profileDone.current = true;
    setStep('loading');
    let r;
    try {
      const res = await rpcLoose('raffle_win_claim_link_v1', { p_link_token: token });
      r = res.error ? ({ kind: 'error' } as const) : parseClaim(res.data);
    } catch { r = { kind: 'error' } as const; }
    if (r.kind !== 'ok') { setStep('honest'); return; }
    const next = screenForClaim(r, { fromAuth: true });
    if (next === 'qr') { navigate('/app/home', { replace: true }); return; }
    if (next !== 'pick') { setAfterLock(false); setStep(next); return; }
    setNights(r.nights); setFirstName(r.firstName);
    const fresh = night ? r.nights.find((n) => n.occurrenceId === night.occurrenceId) : undefined;
    if (fresh) { setNight(fresh); setTicked(false); setStep('honest'); return; }
    setNight(null); setSelection(null); setBanner(null); setTicked(false);
    setStep('pick');
  };

  const onLockTap = async (n: OpenNight) => {
    setNight(n); setTicked(false); setNudge(false);
    if (profileDone.current) { setStep('honest'); return; }
    setStep('loading');
    const row = await readProfile();
    const miss = row ? missingProfileFields(row) : ALL_FIELDS;
    setInitial(initialFrom(row)); setMissing(miss); setIsNew(miss.length === ALL_FIELDS.length);
    if (miss.length === 0) { profileDone.current = true; setStep('honest'); } else setStep('profile');
  };

  const sendEmail = (id: string) => {
    void (async () => {
      try { const sb = await getSupabase(); await sb.functions.invoke('raffle-win-email', { body: { win_id: id } }); } catch { /* never blocks */ }
    })();
  };

  const confirm = async () => {
    if (busy || !night) return;
    const needsTick = night.needsTick !== false;
    if (needsTick && !ticked) { setNudge(true); return; }
    setBusy(true);
    let out;
    try {
      const res = await rpcLoose('raffle_win_lock_v2', { p_win_id: winId, p_occurrence_id: night.occurrenceId, p_never_been: needsTick });
      out = res.error ? ({ kind: 'error' } as const) : parseLock(res.data);
    } catch { out = { kind: 'error' } as const; }
    setBusy(false);
    if (out.kind === 'qr') {
      const won = out.night ?? night;
      setNight(won); if (out.firstName) setFirstName(out.firstName);
      setFresh(); sendEmail(winId); setStep('share'); return;
    }
    if (out.kind === 'back-to-pick') {
      const key = refusalKey(out.reason);
      let left = nights;
      if (key) {
        const a = applyRefusal(nights, key, night); left = a.nights; setNights(a.nights); setSelection(a.selection);
        setBanner(key === 'already_been_to_event' ? null : key); // that one is silent
      }
      setStep(left.length === 0 ? 'none' : 'pick'); return;
    }
    if (out.kind === 'profile') { profileDone.current = false; setMissing(out.missing); setIsNew(false); setStep('profile'); return; }
    if (out.kind === 'screen') { setStep(out.screen); return; }
    setAfterLock(true); setStep('error');
  };

  let body;
  if (step === 'loading') {
    body = <div className="flex min-h-[100dvh] items-center justify-center bg-[#150a1c] text-[15px] text-[#f7ecd9]">Loading&hellip;</div>;
  } else if (step === 'claim') body = <GateScreen token={token} />;
  else if (step === 'won') body = <WonScreen onChoose={() => setStep('pick')} />;
  else if (step === 'pick') {
    body = <PickScreen nights={nights} selection={selection} banner={banner} onSelect={setSelection} onLock={(n) => void onLockTap(n)} />;
  } else if (step === 'profile' && user) {
    body = (
      <ProfileSteps missing={missing} isNewAccount={isNew} userId={user.id} initial={initial}
        night={night ? { date: nightParts(night.startLocal).long, title: night.title } : null}
        onDone={() => void reloadAfterProfile()} onBackToPick={() => setStep('pick')} />
    );
  } else if (step === 'honest' && night) {
    body = <HonestySheet night={night} ticked={ticked} busy={busy} nudge={nudge}
      onTick={() => { setTicked((t) => !t); setNudge(false); }} onConfirm={() => void confirm()} onBack={() => setStep('pick')} />;
  } else if (step === 'share' && night) {
    const link = posterText({ firstName, night, poolCount: dancers, origin: window.location.origin }).link;
    body = <ShareStep night={night} dancersInDraw={dancers} link={link} firstName={firstName} onDone={() => navigate('/app/home', { replace: true })} />;
  } else if (step === 'none') body = <StatusScreen kind="none" onAction={() => void claim()} />;
  else if (step === 'other' || step === 'cancel') body = <StatusScreen kind={step} />;
  else body = <StatusScreen kind="error" afterLock={afterLock} onAction={() => void claim()} />;

  return (<><meta name="robots" content="noindex,nofollow" />{body}</>);
}
