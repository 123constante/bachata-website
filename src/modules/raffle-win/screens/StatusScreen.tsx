// Winner journey W4a: status screens (none, error, other, cancel). Controlled, unrouted.
import { Link } from 'react-router-dom';

export type StatusKind = 'none' | 'error' | 'other' | 'cancel';

const COPY: Record<StatusKind, { icon: string; h: string; p: string }> = {
  none: { icon: '☾', h: 'No nights open right now', p: 'Check back soon. Your prize is kept.' },
  error: { icon: '⚠', h: 'Something went wrong', p: 'Check your connection and try again.' },
  other: { icon: '🔒', h: 'Already claimed', p: 'This prize was claimed by a different account. Message the organiser if that was not you.' },
  cancel: { icon: '⊘', h: 'This link is no longer valid', p: 'The organiser cancelled this prize. Message them if you think this is a mistake.' },
};

type Props = {
  kind: StatusKind;
  /** error only: the failure came from the lock call, so Retry may bring up a QR */
  afterLock?: boolean;
  /** none: Check again (re-fetch). error: Retry. */
  onAction?: () => void;
};

const primary = 'flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#ec3458] text-[17px] font-bold text-white';
const quiet = 'flex h-[44px] w-full items-center justify-center text-[15px] font-semibold text-[#f7ecd9]/70 underline underline-offset-4';

export default function StatusScreen({ kind, afterLock, onAction }: Props) {
  const c = COPY[kind];
  const bad = kind !== 'none';
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#150a1c] px-5 py-6 text-center text-[#f7ecd9]" data-testid={`win-status-${kind}`}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5">
        <div aria-hidden="true" className={`flex h-[104px] w-[104px] items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-[48px] ${bad ? 'text-[#ff5470]' : 'text-[#f5b942]'}`}>{c.icon}</div>
        <h1 className="text-[34px] leading-[1.02] font-extrabold">{c.h}</h1>
        <p className="max-w-[300px] text-[16px] text-[#f7ecd9]/70">{c.p}</p>
        {kind === 'error' && afterLock ? <p className="text-[13.5px] text-[#f7ecd9]/70">If your night did lock, Retry brings up your QR.</p> : null}
      </div>
      {kind === 'none' ? <button type="button" className={primary} onClick={onAction}>Check again</button> : null}
      {kind === 'error' ? <button type="button" className={primary} onClick={onAction}>Retry</button> : null}
      {kind === 'other' || kind === 'cancel' ? <Link to="/" className={quiet}>See what is on</Link> : null}
    </main>
  );
}
