import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { useAuth } from '@/hooks/useAuth';
import { buildSignInHref } from '@/lib/authRouting';
import { londonTodayKey } from '@/lib/londonDate';
import { ticketDoorCode } from '@/modules/organiser/p3/door/doorFlags';
import { fetchMyTickets, type MyTicketsResult } from './myTicketsApi';
import DoorCodeLine from './DoorCodeLine';
import {
  QR_MISSING,
  checkedInLine,
  doorCodeText,
  groupTickets,
  orderPositions,
  orderRef,
  qrOpenByDefault,
  qrVisible,
  stateCopy,
  truncatedNote,
  whenLine,
  type MyTicket,
  type PageState,
} from './myTicketsModel';
import QrCode from './TicketQrCode';

/**
 * /account/my-tickets (queue B, flags.publicTicketing). A signed-in buyer's paid tickets with
 * the QR to show at the door. The qr_token never leaves this component: not logged, not in a
 * URL, not sent to analytics.
 */

const surface = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid var(--bento-hairline)',
} as const;
const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;

function TicketCard({ t, position, today, defaultOpen }: { t: MyTicket; position: string | null; today: string; defaultOpen: boolean }) {
  const [anyway, setAnyway] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const show = open && qrVisible(t, anyway);
  const code = doorCodeText(t.shortCode, ticketDoorCode);
  // Directly under the QR when one is drawn; otherwise in the QR's place, so it shows on every card.
  const codeLine = code ? <DoorCodeLine code={code} checkedIn={t.checkedIn} testId="my-ticket-short-code" /> : null;
  return (
    <li className="rounded-md p-3 text-[14px]" style={surface} data-testid="my-ticket" data-checked-in={t.checkedIn ? 'true' : 'false'}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{t.title}</h3>
        {t.checkedIn && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: 'hsl(var(--bento-accent) / 0.18)' }}>
            Checked in
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px]" data-testid="my-ticket-when">{whenLine(t, today)}</p>
      <p className="text-[12px]" style={muted}>
        {[t.typeName, position, `Order ${orderRef(t.orderId)}`].filter(Boolean).join(' \u00b7 ')}
      </p>
      {t.checkedIn && (
        <p className="mt-1 text-[13px] font-medium" data-testid="my-ticket-checked-in">{checkedInLine(t)}</p>
      )}
      <div className="mt-2">
        {!t.qrToken ? (
          <>
            <p className="text-[12px]" style={muted} data-testid="my-ticket-no-qr">{QR_MISSING}</p>
            {codeLine}
          </>
        ) : t.checkedIn && !anyway ? (
          <>
            <button
              type="button"
              onClick={() => { setAnyway(true); setOpen(true); }}
              className="min-h-[44px] w-full rounded-md px-3 text-[14px] underline"
              style={{ border: '1px solid var(--bento-hairline)' }}
            >
              Show anyway
            </button>
            {codeLine}
          </>
        ) : (
          <>
            {show && (
              <div className="rounded-md bg-white p-2" data-testid="my-ticket-qr-box">
                <QrCode token={t.qrToken} />
                {t.checkedIn && (
                  <p className="mt-1 text-center text-[12px] text-black">Already used at the door.</p>
                )}
              </div>
            )}
            {codeLine}
            {!t.checkedIn && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mt-1 min-h-[44px] w-full rounded-md px-3 text-[14px] underline"
                aria-expanded={open}
              >
                {open ? 'Hide QR code' : 'Show QR code'}
              </button>
            )}
          </>
        )}
      </div>
      {t.seriesId && (
        <Link to={`/event/${t.seriesId}`} className="inline-flex min-h-[44px] items-center text-[13px] underline">
          Event page
        </Link>
      )}
    </li>
  );
}

function Section({ title, tickets, positions, today, past, openSet }: { title: string; tickets: MyTicket[]; positions: Map<string, string | null>; today: string; past: boolean; openSet: Set<string> }) {
  if (!tickets.length) return null;
  return (
    <section className="mb-3" data-testid={past ? 'my-tickets-past' : 'my-tickets-upcoming'}>
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={muted}>
        {title} ({tickets.length})
      </h2>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <TicketCard key={t.ticketId} t={t} position={positions.get(t.ticketId) ?? null} today={today} defaultOpen={!past && openSet.has(t.ticketId)} />
        ))}
      </ul>
    </section>
  );
}

export function MyTicketsView({ result, authReady, onRetry, today }: {
  result: MyTicketsResult | null;
  authReady: 'resolving' | 'signed_out' | 'signed_in' | 'unavailable';
  onRetry: () => void;
  today: string;
}) {
  const location = useLocation();
  const state: PageState =
    authReady === 'signed_out' || result?.kind === 'signed_out' ? 'signed_out'
      : authReady === 'unavailable' || result?.kind === 'error' ? 'error'
        : authReady === 'resolving' || !result ? 'loading'
          : result.reply.tickets.length === 0 ? 'empty' : 'ready';
  const reply = result?.kind === 'ok' ? result.reply : null;
  const groups = useMemo(() => groupTickets(reply?.tickets ?? [], today), [reply, today]);
  const openSet = useMemo(() => qrOpenByDefault(groups.upcoming, today), [groups, today]);
  const positions = useMemo(() => orderPositions(reply?.tickets ?? []), [reply]);
  const note = reply ? truncatedNote(reply) : null;
  return (
    <div className="mx-auto w-full max-w-[430px] px-3 py-3" data-testid="my-tickets" data-state={state}>
      <h1 className="mb-2 text-[17px] font-semibold" style={{ color: 'hsl(var(--bento-accent))' }}>My tickets</h1>
      {state === 'ready' && reply ? (
        <>
          {note && <p className="mb-2 rounded-md p-2 text-[12px]" style={surface} data-testid="my-tickets-truncated">{note}</p>}
          {groups.upcoming.length === 0 && (
            <p className="mb-2 text-[13px]" style={muted}>No upcoming tickets. <Link to="/" className="underline">Find an event</Link></p>
          )}
          <Section title="Upcoming" tickets={groups.upcoming} positions={positions} today={today} past={false} openSet={openSet} />
          <Section title="Past" tickets={groups.past} positions={positions} today={today} past openSet={openSet} />
        </>
      ) : (
        <StateBox state={state as Exclude<PageState, 'ready'>} signIn={buildSignInHref(location.pathname)} onRetry={onRetry} />
      )}
    </div>
  );
}

function StateBox({ state, signIn, onRetry }: { state: Exclude<PageState, 'ready'>; signIn: string; onRetry: () => void }) {
  const c = stateCopy(state, signIn);
  return (
    <section className="rounded-md p-3 text-[14px]" style={surface} data-testid="my-tickets-state" role={state === 'error' ? 'alert' : undefined} aria-busy={state === 'loading' || undefined}>
      <p className="mb-1 font-semibold">{c.title}</p>
      <p className="mb-2" style={muted}>{c.body}</p>
      {state === 'loading' && <div className="h-24 w-full animate-pulse rounded-md" style={{ background: 'var(--bento-hairline)' }} />}
      {c.action?.kind === 'link' && (
        <Link to={c.action.to} className="inline-flex min-h-[44px] items-center underline">{c.action.label}</Link>
      )}
      {c.action?.kind === 'retry' && (
        <button type="button" onClick={onRetry} className="min-h-[44px] rounded-md px-3 underline" style={{ border: '1px solid var(--bento-hairline)' }}>
          {c.action.label}
        </button>
      )}
    </section>
  );
}

export default function MyTicketsPage() {
  useSeo({ title: 'My tickets', description: 'Your Bachata Calendar tickets.', noindex: true });
  const { user, authStatus, retryAuth } = useAuth();
  const [result, setResult] = useState<MyTicketsResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const uid = user?.id ?? null;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    setResult(null);
    void fetchMyTickets().then((r) => { if (live) setResult(r); });
    return () => { live = false; };
  }, [uid, attempt]);
  const onRetry = useCallback(() => {
    if (authStatus === 'unavailable') retryAuth?.();
    else setAttempt((n) => n + 1);
  }, [authStatus, retryAuth]);
  const authReady = authStatus === 'resolving' ? 'resolving' : authStatus === 'unavailable' ? 'unavailable' : uid ? 'signed_in' : 'signed_out';
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('myTickets')}>
      <MyTicketsView result={result} authReady={authReady} onRetry={onRetry} today={londonTodayKey()} />
    </GlobalLayout>
  );
}
