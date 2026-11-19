import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildSignInHref } from '@/lib/authRouting';
import { acceptDoorSeat } from './doorJoinApi';
import { DOOR_JOIN_COPY as C, DOOR_PATHS, DOOR_TOKEN_RE, accessEndsWord, joinStepOf, type JoinIn } from './doorJoinModel';

type Accept = JoinIn['accept'];

/**
 * /door/join/:token -- a door person opens the organiser's link here (organiser R4 slice a).
 * Live whatever the organiser flags: a link must work for the person it was sent to. Signed out:
 * sign in (the site's own sign-in page), come back to this same link, then it accepts once.
 * The token never reaches a log, a Referer header, or the history once it is used up.
 */
export default function DoorJoinPage({ accept = acceptDoorSeat }: { accept?: typeof acceptDoorSeat }) {
  useNoindexMeta(true);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, authStatus } = useAuth();
  const tokenValid = DOOR_TOKEN_RE.test(token);
  const auth: JoinIn['auth'] = authStatus === 'resolving' ? 'resolving' : user ? 'signed_in' : 'signed_out';
  const [res, setRes] = useState<Accept>('idle');
  const ran = useRef(false);

  const run = useCallback(async () => {
    setRes('running');
    try { setRes(await accept(token)); } catch { setRes('failed'); }
  }, [accept, token]);

  useEffect(() => {
    if (!tokenValid || auth !== 'signed_in' || ran.current) return;
    ran.current = true;
    void run();
  }, [tokenValid, auth, run]);

  const step = joinStepOf({ tokenValid, auth, accept: res });
  // A used-up token leaves the address bar (and so the back button and history) for good.
  useEffect(() => {
    if (step === 'ended' || step === 'used' || step === 'revoked' || step === 'bad_link') {
      window.history.replaceState(window.history.state, '', DOOR_PATHS.joinDone);
    }
  }, [step]);

  const seriesId = typeof res === 'object' ? res.seriesId : null;
  // Accepted: straight on to the door screen, replacing this entry so the token leaves the history.
  useEffect(() => {
    if (step === 'ok' && seriesId) navigate(DOOR_PATHS.seat(seriesId), { replace: true });
  }, [step, seriesId, navigate]);
  const ends = typeof res === 'object' ? accessEndsWord(res.expiresAt) : null;
  const here = DOOR_PATHS.join(token);

  return (
    <main data-testid="door-join" data-step={step} style={{ minHeight: '100dvh', background: '#fff', color: '#1c1917', padding: '24px 16px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>{C.title}</h1>
      {step === 'checking' || step === 'accepting' ? (
        <p role="status" aria-busy="true" style={{ fontSize: 15 }} data-testid="door-join-busy">{step === 'checking' ? C.checking : C.accepting}</p>
      ) : step === 'signed_out' ? (
        <>
          <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 8px' }} data-testid="door-join-msg">{C.signedOut}</p>
          <p style={{ fontSize: 15, margin: '0 0 20px', color: '#57534e' }}>{C.signedOutWhy}</p>
          <Link style={BTN} to={buildSignInHref(here)} data-testid="door-join-signin">{C.signIn}</Link>
        </>
      ) : step === 'ok' && seriesId ? (
        <>
          <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 8px' }} data-testid="door-join-msg">{C.ok}</p>
          {ends && <p style={{ fontSize: 15, margin: '0 0 20px', color: '#57534e' }} data-testid="door-join-ends">{C.okUntil(ends)}</p>}
          <button type="button" style={BTN} onClick={() => navigate(DOOR_PATHS.seat(seriesId), { replace: true })} data-testid="door-join-open">{C.openDoor}</button>
        </>
      ) : step === 'profile' ? (
        <>
          <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 20px' }} data-testid="door-join-msg">{C.profile}</p>
          <Link style={BTN} to={`/finish-profile?returnTo=${encodeURIComponent(here)}`} data-testid="door-join-profile">{C.finishProfile}</Link>
        </>
      ) : step === 'error' ? (
        <div role="alert">
          <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 20px' }} data-testid="door-join-msg">{C.error}</p>
          <button type="button" style={BTN} onClick={() => void run()} data-testid="door-join-retry">{C.retry}</button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 17, fontWeight: 500, margin: '0 0 20px' }} data-testid="door-join-msg">
            {step === 'used' ? C.used : step === 'revoked' ? C.revoked : C.ended}
          </p>
          <Link style={{ ...BTN, background: '#fff', color: '#C2410C', border: '1px solid #C2410C' }} to="/" data-testid="door-join-home">{C.home}</Link>
        </>
      )}
    </main>
  );
}

const BTN = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 48, borderRadius: 10, background: '#C2410C', color: '#fff', fontSize: 16, fontWeight: 500, textDecoration: 'none', border: 0 } as const;
