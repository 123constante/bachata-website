import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { useSeo } from '@/lib/seo';

export type DoorStatus = 'valid' | 'already_admitted' | 'not_valid';
export interface DoorResult {
  status: DoorStatus;
  name: string;
  event: string;
  date: string;
  admittedAtLocal: string;
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
    status: s === 'valid' || s === 'already_admitted' ? s : 'not_valid',
    name: str(o.name),
    event: str(o.event),
    date: str(o.date),
    admittedAtLocal: str(o.admitted_at_local),
  };
}

type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; result: DoorResult; admittedByUs: boolean };

export function DoorScreen(props: { view: View; busy: boolean; onAdmit: () => void; onRetry: () => void }) {
  const { view, busy, onAdmit, onRetry } = props;
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
    if (result.status === 'valid' && admittedByUs) {
      hero = '🎉';
      title = 'Admitted';
      body = <p className="text-sm text-muted-foreground">{result.name} is in. Marked as attended.</p>;
    } else if (result.status === 'valid') {
      hero = '✅';
      title = 'Valid prize';
      const when = formatDoorDate(result.date);
      body = (
        <>
          <div className="mt-1 rounded-xl border p-3 text-left">
            <p className="text-base font-bold">{result.name}</p>
            <p className="text-sm text-muted-foreground">
              {result.event}
              {when ? <> &middot; {when}</> : null}
            </p>
          </div>
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
        <p className="text-sm text-muted-foreground">
          This prize was used at {result.admittedAtLocal}. Do not admit again.
        </p>
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

  useEffect(() => { void check(); }, [check]);

  const admit = useCallback(async () => {
    setBusy(true);
    const result = await call('raffle_door_admit_v1');
    setBusy(false);
    if (!result) { setView({ kind: 'error' }); return; }
    setView({ kind: 'result', result, admittedByUs: result.status === 'valid' });
  }, [call]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-6">
      <DoorScreen view={view} busy={busy} onAdmit={() => void admit()} onRetry={() => void check()} />
    </main>
  );
}
