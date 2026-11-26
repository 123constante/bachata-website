import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { useSeo } from '@/lib/seo';
import { parseMyWinTokens } from '@/modules/dancer-app/screens/home/raffleWinModel';

export type DoorStatus = 'valid' | 'too_early' | 'already_admitted' | 'admitted' | 'not_valid' | 'cancelled';
export interface DoorResult {
  status: DoorStatus;
  name: string;
  event: string;
  date: string;
  admittedAtLocal: string;
  /** Optional (the DB ships later): absent or null = no photo. */
  photoUrl: string | null;
  /** The night is locked to the organiser's team. Absent (old DB) = false. */
  needsTeam: boolean;
  /** This viewer may admit. Absent (old DB) = true. */
  viewerCanAdmit: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD...' (a London calendar date) -> 'Fri 28 Nov'. No timezone conversion. */
export function formatDoorDate(raw: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? '');
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${DAYS[dow]} ${d} ${MONTHS[mo - 1]}`;
}

/** Parse an RPC reply; anything unrecognised is treated as not valid. */
export function parseDoorResult(data: unknown): DoorResult {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const s = o.status;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    status: s === 'valid' || s === 'too_early' || s === 'already_admitted' || s === 'admitted' || s === 'cancelled' ? s : 'not_valid',
    name: str(o.name),
    event: str(o.event),
    date: str(o.date),
    admittedAtLocal: str(o.admitted_at_local),
    photoUrl: typeof o.photo_url === 'string' && o.photo_url.trim() !== '' ? o.photo_url : null,
    needsTeam: o.needs_team === true,
    viewerCanAdmit: o.viewer_can_admit !== false,
  };
}

type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; result: DoorResult; admittedByUs: boolean };

export function DoorScreen(props: { view: View; busy: boolean; onAdmit: () => void; onRetry: () => void; viewerIsWinner?: boolean; signedIn?: boolean; token?: string }) {
  const { view, busy, onAdmit, onRetry, viewerIsWinner = false, signedIn = false, token = '' } = props;
  let hero = '';
  let title = '';
  let body: React.ReactNode = null;

  if (view.kind === 'loading') {
    return <p className="text-sm text-muted-foreground" role="status">Checking&hellip;</p>;
  }
  if (view.kind === 'error') {
    hero = '⚠️';
    title = 'Could not check';
    body = (
      <>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <button type="button" onClick={onRetry} className="mt-3 h-[48px] w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground">
          Retry
        </button>
      </>
    );
  } else {
    const { result, admittedByUs } = view;
    const photo = result.photoUrl ? (
      <img data-testid="door-photo" src={result.photoUrl} alt="" width={160} height={160}
        className="mx-auto mb-3 h-[160px] w-[160px] rounded-full object-cover" />
    ) : null;
    const when = formatDoorDate(result.date);
    const card = (
      <div className="mt-1 rounded-xl border p-3 text-left">
        {photo}
        <p className="text-base font-bold">{result.name}</p>
        <p className="text-sm text-muted-foreground">
          {result.event}
          {when ? <> &middot; {when}</> : null}
        </p>
      </div>
    );
    if (result.status === 'admitted' || (result.status === 'valid' && admittedByUs && result.viewerCanAdmit)) {
      hero = '🎉';
      title = 'Admitted';
      body = (
        <>
          {photo}
          <p className="text-sm text-muted-foreground">{result.name} is in. Marked as attended.</p>
        </>
      );
    } else if (result.status === 'cancelled') {
      hero = '❌';
      title = 'Not valid';
      body = (
        <>
          {card}
          <p className="mt-3 text-sm font-semibold" data-testid="door-cancelled">This night was cancelled. Do not admit.</p>
        </>
      );
    } else if (result.status === 'too_early') {
      hero = '🕒';
      title = `Valid on ${when || 'a later date'}. Come back then.`;
      body = card;
    } else if (result.status === 'valid') {
      hero = '✅';
      title = 'Valid prize';
      body = viewerIsWinner ? (
        <>
          {card}
          <p className="mt-3 text-base font-bold" data-testid="door-show-this">Show this to the door</p>
        </>
      ) : !result.viewerCanAdmit ? (
        signedIn ? (
          <>
            {card}
            <p className="mt-3 text-base font-bold" data-testid="door-show-organiser">Show this to the organiser</p>
          </>
        ) : (
          <>
            {card}
            <a
              data-testid="door-sign-in"
              href={`/auth?mode=signin&returnTo=${encodeURIComponent('/raffle/door/' + token)}`}
              className="mt-3 flex h-[48px] w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
            >
              Sign in to admit
            </a>
            <p className="mt-2 text-sm text-muted-foreground">Only the organiser&rsquo;s team can admit tonight.</p>
          </>
        )
      ) : (
        <>
          {card}
          <button
            type="button"
            onClick={onAdmit}
            disabled={busy}
            className="mt-3 h-[48px] w-full rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
          >
            Admit
          </button>
        </>
      );
    } else if (result.status === 'already_admitted') {
      hero = '⚠️';
      title = 'Already admitted';
      body = (
        <>
          {card}
          <p className="mt-3 text-sm text-muted-foreground" data-testid="door-used-at">
            This prize was used at {result.admittedAtLocal}.
          </p>
          <p className="mt-2 text-sm font-semibold" data-testid="door-photo-rule">
            {result.photoUrl
              ? 'If this is the person in the photo, let them in.'
              : result.name
                ? `If this is ${result.name}, let them in.`
                : 'Ask the organiser for help.'}
          </p>
        </>
      );
    } else {
      hero = '❌';
      title = 'Not valid';
      body = (
        <p className="text-sm text-muted-foreground">
          This code is cancelled or for another night. Ask the organiser for help.
        </p>
      );
    }
  }

  return (
    <div className="text-center">
      <div className="text-5xl" aria-hidden="true">{hero}</div>
      <h1 className="mt-2 text-xl font-bold">{title}</h1>
      <div className="mt-2">{body}</div>
    </div>
  );
}

export default function RaffleDoor() {
  useSeo({ title: 'Raffle door', description: 'Raffle prize door check.', noindex: true });
  const { token = '' } = useParams<{ token: string }>();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const signedIn = !!user && !user.is_anonymous;
  const userId = user?.id;
  const [viewerIsWinner, setViewerIsWinner] = useState(false);
  useEffect(() => {
    setViewerIsWinner(false);
    if (!signedIn || !token) return;
    let live = true;
    void (async () => {
      try {
        const { data, error } = await rpcLoose('raffle_my_wins_v1');
        if (live && !error) setViewerIsWinner(parseMyWinTokens(data).includes(token));
      } catch { /* not the winner view: door staff screen as before */ }
    })();
    return () => { live = false; };
  }, [signedIn, userId, token]);

  const call = useCallback(async (fn: string): Promise<DoorResult | null> => {
    try {
      const { data, error } = await rpcLoose(fn, { p_qr_token: token });
      if (error) return null;
      return parseDoorResult(data);
    } catch {
      return null;
    }
  }, [token]);

  const check = useCallback(async () => {
    setView({ kind: 'loading' });
    const result = await call('raffle_door_check_v1');
    setView(result ? { kind: 'result', result, admittedByUs: false } : { kind: 'error' });
  }, [call]);

  // The reply depends on who is signed in, so a sign-in change re-runs the check.
  useEffect(() => { void check(); }, [check, userId]);

  const admit = useCallback(async () => {
    setBusy(true);
    const result = await call('raffle_door_admit_v1');
    setBusy(false);
    if (!result) { setView({ kind: 'error' }); return; }
    setView({ kind: 'result', result, admittedByUs: result.status === 'valid' || result.status === 'admitted' });
  }, [call]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-6">
      <DoorScreen view={view} busy={busy} onAdmit={() => void admit()} onRetry={() => void check()} viewerIsWinner={viewerIsWinner} signedIn={signedIn} token={token} />
    </main>
  );
}
