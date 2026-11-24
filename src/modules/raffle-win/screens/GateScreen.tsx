// Winner journey W4a: signed-out gate. Controlled, unrouted. Copy is the frozen prototype's.
import { Link } from 'react-router-dom';
import { winAuthHref } from '../model';

export const FROM_AUTH_KEY = 'raffle_win_from_auth';
export const markFromAuth = () => {
  try { sessionStorage.setItem(FROM_AUTH_KEY, '1'); } catch { /* storage blocked */ }
};

export const KICKER = 'Free entry · one night';

export function Ticket({ title, stub, heading }: { title: string; stub: React.ReactNode; heading?: boolean }) {
  return (
    <div className="w-full rounded-3xl bg-[#f7ecd9] text-[#24121f] overflow-hidden">
      <div className="p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#ec3458]">{KICKER}</p>
        {heading
          ? <h1 className="mt-2 text-[34px] leading-[1.02] font-extrabold">{title}</h1>
          : <p className="mt-2 text-[17px] font-semibold">{title}</p>}
      </div>
      <div className="border-t-2 border-dashed border-[#24121f]/30 p-5 text-[15px] font-semibold">{stub}</div>
    </div>
  );
}

export default function GateScreen({ token }: { token: string }) {
  return (
    <main className="flex min-h-[100dvh] flex-col justify-center gap-4 bg-[#150a1c] px-5 py-6 text-[#f7ecd9]" data-testid="win-gate">
      <Ticket heading title="You won a free night" stub={<span>Sealed. Sign in to open it.</span>} />
      <p className="text-[16px] text-[#f7ecd9]/70">Sign in to claim it. This link works until an organiser cancels it, so keep it private.</p>
      <p className="rounded-2xl border border-[#f5b942]/30 bg-[#f5b942]/10 p-3 text-[14.5px] font-medium">
        The first account to sign in keeps the prize. Do not forward this link.
      </p>
      <Link
        to={winAuthHref(token)}
        onClick={markFromAuth}
        className="flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#ec3458] text-[17px] font-bold text-white"
      >
        Sign in to claim
      </Link>
    </main>
  );
}
