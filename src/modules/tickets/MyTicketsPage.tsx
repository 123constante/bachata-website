import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { useAuth } from '@/hooks/useAuth';
import { buildSignInHref } from '@/lib/authRouting';
import { useServerToday } from '@/modules/dancer-app/screens/tickets/serverToday';
import { ticketDoorCode } from '@/modules/organiser/p3/door/doorFlags';
import { fetchMyTickets, type MyTicketsResult } from './myTicketsApi';
import DoorCodeLine from './DoorCodeLine';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { orderTicketList, partRefundLine, ticketGreyed, ticketNightKey, ticketQrShown, ticketStatusAt, ticketStatusLines, ticketStatusTag, type TicketStatus } from './ticketCardStatus';
import { MY_TICKETS_PATH } from './myTicketsModel';
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

/** The one status call for a My tickets row (flag OFF: always valid, exactly as before). */
const statusOf = (t: MyTicket): TicketStatus =>
  BUYER_ONBOARDING_ENABLED ? ticketStatusAt({ date: t.date, eventCancelled: t.nightCancelled, refunded: t.refunded, checkedIn: t.checkedIn }) : 'valid';

function TicketCard({ t, position, today, defaultOpen }: { t: MyTicket; position: string | null; today: string; defaultOpen: boolean }) {
  const [anyway, setAnyway] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const show = open && qrVisible(t, anyway);
  // Buyer onboarding ON: the one shared status mapping (ticketCardStatus); passed / cancelled / refunded / used = greyed, no QR, no code.
  const status = statusOf(t);
  const lines = ticketStatusLines(status, t.refundedPence);
  const reason = lines.length > 0;
  const tag = ticketStatusTag(status) ?? (t.checkedIn ? 'Checked in' : null);
  const partRefund = BUYER_ONBOARDING_ENABLED ? partRefundLine(t.refunded, t.refundedPence) : null;
  const code = ticketQrShown(status) ? doorCodeText(t.shortCode, ticketDoorCode) : null;
  // Directly under the QR when one is drawn; otherwise in the QR's place, so it shows on every card.
  const codeLine = code ? <DoorCodeLine code={code} checkedIn={t.checkedIn} testId="my-ticket-short-code" /> : null;
  return (
    <li className="rounded-md p-3 text-[14px]" style={ticketGreyed(status) ? { ...surface, opacity: 0.6 } : surface} data-testid="my-ticket" data-checked-in={t.checkedIn ? 'true' : 'false'} data-ticket-status={status}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{t.title}</h3>
        {tag && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: 'hsl(var(--bento-accent) / 0.18)' }} data-testid="my-ticket-tag">
            {tag}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px]" data-testid="my-ticket-when">{whenLine(t, today)}</p>
      <p className="text-[12px]" style={muted}>
        {[t.typeName, position, `Order ${orderRef(t.orderId)}`].filter(Boolean).join(' \u00b7 ')}
      </p>
      {partRefund && (
        <p className="text-[12px]" style={muted} data-testid="my-ticket-part-refund">{partRefund}</p>
      )}
      {t.checkedIn && (
        <p className="mt-1 text-[13px] font-medium" data-testid="my-ticket-checked-in">{checkedInLine(t)}</p>
      )}
      <div className="mt-2">
        {reason ? (
          <div role="status" data-testid="my-ticket-status">
            {lines.map((l, i) => (
              <p key={i} className={i === 0 ? 'text-[13px] font-medium' : 'text-[12px]'}>{l}</p>
            ))}
          </div>
        ) : !t.qrToken ? (
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
  // Buyer onboarding ON (owner click 6): ONE list, soonest first, greyed at the bottom, passed nights dropped.
  const list = useMemo(
    () => (BUYER_ONBOARDING_ENABLED && reply ? orderTicketList(reply.tickets, statusOf, (t) => t.date, ticketNightKey()) : null),
    [reply],
  );
  const shownState: PageState = state === 'ready' && list && list.length === 0 ? 'empty' : state;
  const groups = useMemo(() => groupTickets(reply?.tickets ?? [], today), [reply, today]);
  const openSet = useMemo(() => qrOpenByDefault(list ? list.filter((t) => statusOf(t) === 'valid') : groups.upcoming, today), [list, groups, today]);
  const positions = useMemo(() => orderPositions(reply?.tickets ?? []), [reply]);
  const note = reply ? truncatedNote(reply) : null;
  return (
    <div className="mx-auto w-full max-w-[430px] px-3 py-3" data-testid="my-tickets" data-state={shownState}>
      <h1 className="mb-2 text-[17px] font-semibold" style={{ color: 'hsl(var(--bento-accent))' }}>My tickets</h1>
      {shownState === 'ready' && reply && list ? (
        <>
          {note && <p className="mb-2 rounded-md p-2 text-[12px]" style={surface} data-testid="my-tickets-truncated">{note}</p>}
          <ul className="space-y-2" data-testid="my-tickets-list">
            {list.map((t) => (
              <TicketCard key={t.ticketId} t={t} position={positions.get(t.ticketId) ?? null} today={today} defaultOpen={openSet.has(t.ticketId)} />
            ))}
          </ul>
        </>
      ) : shownState === 'ready' && reply ? (
        <>
          {note && <p className="mb-2 rounded-md p-2 text-[12px]" style={surface} data-testid="my-tickets-truncated">{note}</p>}
          {groups.upcoming.length === 0 && (
            <p className="mb-2 text-[13px]" style={muted}>No upcoming tickets. <Link to="/" className="underline">Find an event</Link></p>
          )}
          <Section title="Upcoming" tickets={groups.upcoming} positions={positions} today={today} past={false} openSet={openSet} />
          <Section title="Past" tickets={groups.past} positions={positions} today={today} past openSet={openSet} />
        </>
      ) : (
        <StateBox state={shownState as Exclude<PageState, 'ready'>} signIn={buildSignInHref(MY_TICKETS_PATH)} onRetry={onRetry} />
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
        <Link to={c.action.to} className="inline-flex min-h-[44px] items-center rounded-md px-3 font-medium" style={{ border: '1px solid var(--bento-hairline)' }}>{c.action.label}</Link>
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
  const today = useServerToday();
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
      <MyTicketsView result={result} authReady={authReady} onRetry={onRetry} today={today} />
    </GlobalLayout>
  );
}
