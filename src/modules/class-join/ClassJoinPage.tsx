import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyDancerEdit, saveMyDancerProfile } from '@/modules/dancer-app/api/rpc';
import { saveMyRole } from '@/modules/areas/shared/areaApi';
import { roleErrorMessage } from '@/modules/areas/shared/errorCopy';
import {
  codeOf, ensureMyProfile, firstName, joinAuthHref, longDay, peekClassInvite, redeemClassInvite, splitName,
  type Peek, type Redeemed,
} from './classJoinApi';

const LEVELS = ['Beginner', 'Improver', 'Intermediate', 'Advanced'] as const;
const GENERIC = 'Something went wrong. Try again.';
const BTN = 'flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold';
const PRIMARY = `${BTN} bg-primary text-primary-foreground disabled:opacity-50`;
const SECONDARY = `${BTN} border border-border text-foreground`;
const INPUT = 'min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-sm';

type Step = 'loading' | 'closed' | 'open' | 'details' | 'done';

export default function ClassJoinPage() {
  const { token = '' } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [done, setDone] = useState<Redeemed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needName, setNeedName] = useState(false);
  const [first, setFirst] = useState('');
  const [surname, setSurname] = useState('');
  const [levels, setLevels] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    peekClassInvite(token)
      .then((p) => { if (!live) return; setPeek(p); setStep(p.status === 'open' ? 'open' : 'closed'); })
      .catch(() => { if (live) { setError(GENERIC); setStep('closed'); } });
    return () => { live = false; };
  }, [token]);

  const fail = (e: unknown) => {
    const c = codeOf(e);
    if (c === 'invite_invalid' || c === 'invite_closed' || c === 'invite_revoked' || c === 'invite_expired') {
      setError(null);
      setStep('closed');
    } else {
      setError(GENERIC);
    }
  };

  const redeem = async () => {
    try {
      const r = await redeemClassInvite(token);
      setDone(r);
      setStep('done');
    } catch (e) {
      if (codeOf(e) === 'no_teacher_profile') {
        const mine = await fetchMyDancerEdit().catch(() => null);
        const empty = !mine?.first_name;
        const s = splitName(peek?.displayName ?? null);
        setNeedName(empty);
        if (empty) { setFirst(s.first); setSurname(s.surname); }
        setStep('details');
      } else {
        fail(e);
      }
    }
  };

  const onShow = async () => {
    setBusy(true); setError(null);
    try {
      await ensureMyProfile();
      await redeem();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const valid = levels.length > 0 && (!needName || first.trim() !== '');
  const onSave = async () => {
    setBusy(true); setError(null);
    try {
      if (needName) await saveMyDancerProfile({ first_name: first.trim(), surname: surname.trim() || null });
      await saveMyRole('teacher', { levels_taught: levels });
      await redeem();
    } catch (e) {
      setError(codeOf(e) ? GENERIC : roleErrorMessage(e));
    } finally { setBusy(false); }
  };

  const toggle = (l: string) => setLevels((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  let body: JSX.Element;
  if (step === 'loading' || authLoading) {
    body = <div role="status" aria-label="Loading" className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />;
  } else if (step === 'closed') {
    body = (
      <>
        <h1 className="text-lg font-bold">This link doesn&rsquo;t work any more</h1>
        <p className="text-sm text-muted-foreground">Ask the organiser to send you a new one.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Link to="/" className={PRIMARY}>Go to Bachata Calendar</Link>
      </>
    );
  } else if (step === 'done') {
    body = (
      <>
        <h1 className="text-lg font-bold">You&rsquo;re on the class</h1>
        <p className="text-sm text-muted-foreground">
          {done?.classTitle ?? 'The class'} at {done?.eventName ?? 'the event'}, from {longDay(done?.firstDate ?? null)}.
        </p>
        <Link to="/account/t" className={PRIMARY}>See my teacher area</Link>
        <Link to="/" className={SECONDARY}>Done</Link>
      </>
    );
  } else if (step === 'details') {
    body = (
      <>
        <h1 className="text-lg font-bold">Last step: your teacher details</h1>
        {needName && (
          <div className="space-y-2">
            <label className="block text-sm">First name
              <input className={INPUT} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
            </label>
            <label className="block text-sm">Surname
              <input className={INPUT} value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
            </label>
          </div>
        )}
        <p className="text-sm font-medium">Levels you teach</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={levels.includes(l)} onClick={() => toggle(l)}
              className={`min-h-[48px] rounded-full border px-4 text-sm ${levels.includes(l) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{l}</button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="button" className={PRIMARY} disabled={!valid || busy} onClick={onSave}>Save and show me on the class</button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-lg font-bold">Hi {firstName(peek?.displayName ?? null)}</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re teaching {peek?.classTitle ?? 'a class'} at {peek?.eventName ?? 'the event'} on {longDay(peek?.nightDate ?? null)}{peek?.forward ? ' and the weeks after' : ''}
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {user ? (
          <button type="button" className={PRIMARY} disabled={busy} onClick={onShow}>Show me on the class</button>
        ) : (
          <>
            <Link to={joinAuthHref(token, 'signup')} className={PRIMARY}>Join and show on the class</Link>
            <Link to={joinAuthHref(token, 'signin')} className="block py-3 text-center text-xs text-muted-foreground underline">I already have an account</Link>
          </>
        )}
      </>
    );
  }

  return <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-3 p-3">{body}</main>;
}
