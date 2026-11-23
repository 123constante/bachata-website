// Raffle v3 winner page /raffle/win/:token (behind flags.raffleV2). Spec: frozen prototype, "Winner" mode.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { useAuth } from '@/hooks/useAuth';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import TicketQrCode from '@/modules/tickets/TicketQrCode';
import {
  doorUrl, formatLocalNight, parseClaim, parseLock, screenAfterLock, screenForClaim, winAuthHref,
  type OpenNight, type WinScreen,
} from '@/modules/raffle-win/model';
import {
  canvasToPng, downloadPng, posterFileName, posterText, renderPoster, sharePosterFile, type PosterText,
} from '@/modules/raffle-win/sharePoster';
import { fetchRaffleBoard } from '@/hooks/useRaffleBoard';

const FROM_AUTH_KEY = 'raffle_win_from_auth';
const readFromAuth = (): boolean => {
  try { return sessionStorage.getItem(FROM_AUTH_KEY) === '1'; } catch { return false; }
};
const setFromAuth = (on: boolean) => {
  try { if (on) sessionStorage.setItem(FROM_AUTH_KEY, '1'); else sessionStorage.removeItem(FROM_AUTH_KEY); } catch { /* storage blocked */ }
};

const btn = 'w-full min-h-[48px] rounded-xl px-4 text-[15px] font-semibold';
const primary = `${btn} bg-primary text-primary-foreground disabled:opacity-40`;

function Shell({ hero, h1, sub, children, note, left }: {
  hero?: string; h1: string; sub?: ReactNode; children?: ReactNode; note?: string; left?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col gap-3 p-4">
      <meta name="robots" content="noindex,nofollow" />
      {hero ? <div className={left ? 'text-[40px]' : 'text-center text-[56px]'} aria-hidden="true">{hero}</div> : null}
      <h1 className={`text-[24px] font-bold ${left ? '' : 'text-center'}`}>{h1}</h1>
      {sub ? <p className={`text-[15px] text-muted-foreground ${left ? '' : 'text-center'}`}>{sub}</p> : null}
      {children}
      {note ? <p className="text-center text-[13px] text-muted-foreground">{note}</p> : null}
    </main>
  );
}

function SharePosterStep({ text, onDone, onSkip }: { text: PosterText; onDone: () => void; onSkip: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [readyFor, setReadyFor] = useState<PosterText | null>(null);
  const ready = readyFor === text;
  useEffect(() => {
    let live = true;
    if (ref.current) void renderPoster(ref.current, text).then(() => { if (live) setReadyFor(text); });
    return () => { live = false; };
  }, [text]);
  const png = async () => (ref.current ? canvasToPng(ref.current) : null);
  const save = async () => {
    const b = await png();
    if (b) downloadPng(b, posterFileName(text.title));
  };
  const share = async () => {
    const b = await png();
    if (!b) return;
    const r = await sharePosterFile(b, text);
    if (r === 'shared') onDone();
  };
  return (
    <Shell h1="Share your win" sub="Tell your friends you are going. Your QR code is on the next screen.">
      <p className="text-center text-[12px] font-semibold uppercase tracking-wider text-primary">Night confirmed</p>
      <canvas ref={ref} role="img" aria-label={`Share poster: won a free night at ${text.title}`}
        className="mx-auto aspect-[4/5] w-[68%] rounded-xl shadow-lg" />
      <button type="button" className={primary} disabled={!ready} onClick={() => void share()}>Share</button>
      <button type="button" className={`${btn} border border-border`} disabled={!ready} onClick={() => void save()}>Save image</button>
      <button type="button" className={`${btn} underline underline-offset-4`} onClick={onSkip}>Skip, show my QR</button>
    </Shell>
  );
}

export default function RaffleWin() {
  const { token = '' } = useParams();
  const { user, isLoading } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const [screen, setScreen] = useState<WinScreen>('loading');
  const [winId, setWinId] = useState('');
  const [nights, setNights] = useState<OpenNight[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [qr, setQr] = useState<{ token: string; night: OpenNight | null } | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [poolCount, setPoolCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setScreen('loading');
    const fromAuth = readFromAuth();
    let r;
    try {
      const res = await rpcLoose('raffle_win_claim_link_v1', { p_link_token: token });
      r = res.error ? ({ kind: 'error' } as const) : parseClaim(res.data);
    } catch { r = { kind: 'error' } as const; }
    setFromAuth(false);
    if (r.kind === 'ok') {
      setFirstName(r.firstName);
      setWinId(r.winId); setNights(r.nights); setChosen(null); setTicked(false);
      if (r.qrToken) setQr({ token: r.qrToken, night: r.night });
    }
    setScreen(screenForClaim(r, { fromAuth }));
  }, [token]);

  useEffect(() => {
    if (!flags.raffleV2 || isLoading) return;
    if (!signedIn) { setScreen('claim'); return; }
    void load();
  }, [isLoading, signedIn, load]);

  const night = useMemo(() => nights.find((n) => n.occurrenceId === chosen) ?? null, [nights, chosen]);

  const confirm = async () => {
    if (busy || !night || !ticked) return;
    setBusy(true); setLine(null);
    let out;
    try {
      const res = await rpcLoose('raffle_win_lock_v2', { p_win_id: winId, p_occurrence_id: night.occurrenceId, p_never_been: true });
      out = res.error ? ({ kind: 'error' } as const) : parseLock(res.data);
    } catch { out = { kind: 'error' } as const; }
    setBusy(false);
    if (out.kind === 'qr') {
      setQr({ token: out.qrToken, night: out.night ?? night });
      if (out.firstName) setFirstName(out.firstName);
      setScreen(screenAfterLock(flags.raffleSharePoster)); return;
    }
    if (out.kind === 'screen') { setScreen(out.screen); return; }
    if (out.kind === 'back-to-pick') {
      if (out.dropNight) setNights((ns) => ns.filter((n) => n.occurrenceId !== night.occurrenceId));
      setChosen(null); setTicked(false); setLine(out.line); setScreen('pick'); return;
    }
    setScreen('error');
  };

  // Draw count for the poster pill: fetched once when the share step opens; failure = no pill.
  useEffect(() => {
    if (screen !== 'share' || poolCount !== null) return;
    let live = true;
    fetchRaffleBoard().then((b) => { if (live && b.poolCount > 0) setPoolCount(b.poolCount); }).catch(() => undefined);
    return () => { live = false; };
  }, [screen, poolCount]);

  const posterNight = qr?.night ?? null;
  const poster = useMemo(
    () => (posterNight ? posterText({ firstName, night: posterNight, poolCount, origin: window.location.origin }) : null),
    [firstName, posterNight, poolCount],
  );

  if (!flags.raffleV2) return <Navigate to="/" replace />;

  if (screen === 'loading') return <Shell h1={'Loading\u2026'} />;
  if (screen === 'error') {
    return (
      <Shell hero={'\u26A0\uFE0F'} h1="Something went wrong" sub="Check your connection and try again.">
        <button type="button" className={primary} onClick={() => void load()}>Retry</button>
      </Shell>
    );
  }
  if (screen === 'claim') {
    return (
      <Shell hero={'\uD83C\uDF81'} h1="You won a free night"
        sub="Sign in to claim it. This link works until an organiser cancels it, so keep it private."
        note="The first account to sign in keeps the prize. Do not forward this link.">
        <Link to={winAuthHref(token)} className={`${primary} flex items-center justify-center`} onClick={() => setFromAuth(true)}>Sign in to claim</Link>
      </Shell>
    );
  }
  if (screen === 'won') {
    return (
      <Shell hero={'\uD83C\uDF81'} h1="You won!" sub="Free entry to a bachata night you have never been to. Pick which one."
        note="You are signed in, so no WhatsApp needed.">
        <button type="button" className={primary} onClick={() => setScreen('pick')}>Choose my night</button>
      </Shell>
    );
  }
  if (screen === 'pick') {
    return (
      <Shell left h1="Pick your night" sub="Only nights you have never been to. Once you lock one, only the organiser can change it.">
        {line ? <p role="status" className="text-[14px] text-destructive">{line}</p> : null}
        <div className="flex flex-col gap-2">
          {nights.map((n) => (
            <button key={n.occurrenceId} type="button" aria-pressed={chosen === n.occurrenceId}
              className={`min-h-[56px] rounded-xl border p-3 text-left ${chosen === n.occurrenceId ? 'border-primary bg-primary/10' : 'border-border'}`}
              onClick={() => setChosen(n.occurrenceId)}>
              <span className="block text-[15px] font-bold">{n.title}</span>
              <span className="block text-[13px] text-muted-foreground">{formatLocalNight(n.startLocal)}</span>
            </button>
          ))}
        </div>
        <button type="button" className={primary} disabled={!night} onClick={() => setScreen('honest')}>Lock this night</button>
      </Shell>
    );
  }
  if (screen === 'honest') {
    return (
      <Shell h1="One last thing" sub={night ? `${night.title}, ${formatLocalNight(night.startLocal)}` : undefined}>
        <label className="flex min-h-[48px] items-center gap-3 text-[15px]">
          <input type="checkbox" className="h-5 w-5" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
          I have never been to this event.
        </label>
        <button type="button" className={primary} disabled={!ticked || busy} onClick={() => void confirm()}>Confirm and get my QR</button>
        <button type="button" className={`${btn} border border-border`} disabled={busy} onClick={() => setScreen('pick')}>Back</button>
      </Shell>
    );
  }
  if (screen === 'share' && qr && poster) {
    return <SharePosterStep text={poster} onDone={() => setScreen('qr')} onSkip={() => setScreen('qr')} />;
  }
  if ((screen === 'share' || screen === 'qr') && qr) {
    return (
      <Shell h1="You are in"
        sub={`Show this at the door.${qr.night ? ` ${qr.night.title}, ${formatLocalNight(qr.night.startLocal)}` : ''}`}
        note="This code does not expire. Your organiser can cancel it.">
        <TicketQrCode token={doorUrl(window.location.origin, qr.token)} />
      </Shell>
    );
  }
  if (screen === 'none') {
    return (
      <Shell hero={'\uD83C\uDF19'} h1="No nights open right now" sub="Check back soon. Your prize is kept.">
        <button type="button" className={primary} onClick={() => void load()}>Check again</button>
      </Shell>
    );
  }
  if (screen === 'other') {
    return <Shell hero={'\uD83D\uDD12'} h1="Already claimed" sub="This prize was claimed by a different account. Message the organiser if that was not you." />;
  }
  return <Shell hero={'\uD83D\uDEAB'} h1="This link is no longer valid" sub="The organiser cancelled this prize. Message them if you think this is a mistake." />;
}
