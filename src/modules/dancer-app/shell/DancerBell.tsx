import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Star, Ticket } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useSeriesLevelRating } from '@/hooks/useSeriesLevelRating';
import { fetchMyTickets } from '@/modules/tickets/myTicketsApi';
import type { MyTicket } from '@/modules/tickets/myTicketsModel';
import { useMyNights } from '../screens/nights/useMyNights';
import { nudgeCandidates, type Night } from '../screens/nights/nightsModel';
import { ticketsForNight } from '../screens/nights/nightsTicket';
import {
  BELL_EMPTY_LINE, BELL_ERROR_LINE, badgeText, bellAlerts, bellLabel, loadRead, pruneRead, rateAlert, saveRead, ticketAlerts, unreadCount,
  type BellAlert,
} from './bellAlerts';

// The QR body is the Nights sheet's own (reused, nothing new asked); lazy, like on the Nights screen.
const NightQrBody = lazyWithRetry(() => import('../screens/nights/NightTicketQr').then((m) => ({ default: m.NightQrBody })));

/**
 * The RateNudge walk, as a probe: the most recent candidate night whose series is not rated yet
 * (and can be rated), one useSeriesLevelRating at a time -- the same walk Home does. Renders nothing.
 */
const RateProbe = ({ candidates, index, onResolve }: { candidates: readonly Night[]; index: number; onResolve: (n: Night | null | 'loading') => void }) => {
  const night = candidates[index];
  const { summary, isLoading, canRate } = useSeriesLevelRating(night?.seriesId);
  const settled = !night ? null : isLoading ? 'loading' : !summary || summary.my_level || !canRate ? undefined : night;
  useEffect(() => {
    if (settled !== undefined) onResolve(settled);
  }, [settled, onResolve]);
  if (night && settled === undefined) return <RateProbe candidates={candidates} index={index + 1} onResolve={onResolve} />;
  return null;
};

const Tile = ({ kind }: { kind: BellAlert['kind'] }) => (
  <span aria-hidden="true" className={`${kind === 'ticket' ? 'da-tone-violet' : 'da-tone-rose'} grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px]`}>
    {kind === 'ticket' ? <Ticket className="h-[20px] w-[20px]" /> : <Star className="h-[20px] w-[20px]" />}
  </span>
);

const Row = ({ alert, unread, onTap }: { alert: BellAlert; unread: boolean; onTap: () => void }) => {
  const body = (
    <>
      <Tile kind={alert.kind} />
      <span className="min-w-0 flex-1 text-left">
        <b className="block text-[14px]">{alert.title}</b>
        <span className="block truncate text-[13px] text-[var(--mut)]">{alert.line}</span>
      </span>
      {unread && <span aria-label="Unread" data-testid="bell-dot" className="h-[8px] w-[8px] shrink-0 rounded-full bg-[#e5484d]" />}
    </>
  );
  const cls = `da-tap flex w-full items-center gap-[10px] rounded-[12px] p-[8px] ${unread ? 'bg-[rgba(139,92,246,0.10)]' : ''}`;
  return alert.kind === 'rate' ? (
    <Link to={alert.to} className={cls} onClick={onTap} data-testid="bell-alert" data-alert-id={alert.id} data-unread={unread}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onTap} data-testid="bell-alert" data-alert-id={alert.id} data-unread={unread}>
      {body}
    </button>
  );
};

/**
 * Dancer bell (brief #1938, owner pick: option C, a small dropdown). Mounted by the shell only
 * with DANCER_BELL_ENABLED, so every read below runs only then. A person is "read" on an alert
 * only by tapping that alert (per user id, localStorage, every access in try/catch).
 */
const DancerBell = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const my = useMyNights();
  const ticketsOn = flags.publicTicketing;
  const tq = useQuery({
    queryKey: ['dancer-bell', 'tickets', userId],
    enabled: Boolean(userId) && ticketsOn,
    queryFn: async (): Promise<MyTicket[]> => {
      const r = await fetchMyTickets();
      if (r.kind === 'ok') return r.reply.tickets;
      if (r.kind === 'signed_out') return [];
      throw new Error('tickets');
    },
  });
  const candidates = useMemo(() => nudgeCandidates(my.nights.past, my.todayKey), [my.nights.past, my.todayKey]);
  const candidateKey = candidates.map((c) => c.occurrenceId).join(',');
  // The probe's answer is stored WITH the candidate list it answered for, so an early answer can
  // never be overwritten by a reset effect (a child effect runs before its parent's).
  const [resolved, setResolved] = useState<{ key: string; night: Night | null } | null>(null);
  const rateNight: Night | null | 'loading' =
    candidates.length === 0 ? null : resolved && resolved.key === candidateKey ? resolved.night : 'loading';
  const onResolve = useCallback(
    (n: Night | null | 'loading') => {
      if (n !== 'loading') setResolved({ key: candidateKey, night: n });
    },
    [candidateKey],
  );

  const now = new Date();
  const loading = my.isLoading || (ticketsOn && tq.isLoading) || rateNight === 'loading';
  const failed = my.isError || (ticketsOn && tq.isError);
  const alerts = useMemo(
    () => (loading || failed ? [] : bellAlerts(ticketsOn ? ticketAlerts(my.nights.upcoming, tq.data ?? [], my.todayKey, new Date()) : [], rateAlert(rateNight as Night | null, my.todayKey))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, failed, ticketsOn, my.nights.upcoming, tq.data, my.todayKey, rateNight, now.getMinutes()],
  );

  const [read, setRead] = useState<ReadonlySet<string>>(() => (userId ? loadRead(userId) : new Set()));
  useEffect(() => {
    setRead(userId ? loadRead(userId) : new Set());
  }, [userId]);
  // Prune read ids that are no longer shown (only once the list is settled).
  useEffect(() => {
    if (!userId || loading || failed) return;
    const next = pruneRead(read, alerts);
    if (next !== read) {
      setRead(next);
      saveRead(userId, next);
    }
  }, [userId, loading, failed, alerts, read]);

  const unread = loading || failed ? 0 : unreadCount(alerts, read);
  const badge = badgeText(unread);
  const [open, setOpen] = useState(false);
  // Fixed to the viewport (not the bell): Switch sits right of the bell, so a bell-anchored card ran off the left edge.
  const [pos, setPos] = useState({ top: 56, arrowRight: 40 });
  const [qr, setQr] = useState<{ occurrenceId: string; name: string; date: string | null } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const closeQr = () => {
    setQr(null);
    button.current?.focus();
  };
  const markRead = (id: string) => {
    if (!userId) return;
    const next = new Set(read);
    next.add(id);
    setRead(next);
    saveRead(userId, next);
  };
  const tap = (a: BellAlert) => {
    markRead(a.id);
    setOpen(false);
    if (a.kind === 'ticket') setQr({ occurrenceId: a.occurrenceId, name: a.nightName, date: a.nightDate });
  };
  const qrTickets = qr ? ticketAlertTickets(my.nights.upcoming, tq.data ?? [], qr.occurrenceId, new Date()) : [];

  return (
    <div ref={wrap} style={{ position: 'relative' }} data-testid="dancer-bell">
      {candidates.length > 0 && <RateProbe key={candidateKey} candidates={candidates} index={0} onResolve={onResolve} />}
      <button
        ref={button}
        type="button"
        className="da-tap"
        aria-label={bellLabel(unread)}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="dancer-bell-button"
        onClick={() => {
          const r = button.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 8, arrowRight: Math.max(12, window.innerWidth - (r.left + r.width / 2) - 12 - 5) });
          setOpen((o) => !o);
        }}
        style={{ position: 'relative', minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center' }}
      >
        <Bell aria-hidden="true" style={{ width: 22, height: 22 }} />
        {badge && (
          <span
            data-testid="dancer-bell-badge"
            aria-hidden="true"
            style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#e5484d', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Alerts"
          data-testid="dancer-bell-dropdown"
          style={{ position: 'fixed', top: pos.top, right: 12, width: 'min(320px, calc(100vw - 24px))', zIndex: 30, background: 'var(--card, #fff)', color: 'var(--fg, inherit)', border: '1px solid var(--line, rgba(0,0,0,.12))', borderRadius: 16, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}
        >
          <span aria-hidden="true" style={{ position: 'absolute', top: -6, right: pos.arrowRight, width: 10, height: 10, transform: 'rotate(45deg)', background: 'var(--card, #fff)', borderLeft: '1px solid var(--line, rgba(0,0,0,.12))', borderTop: '1px solid var(--line, rgba(0,0,0,.12))' }} />
          {failed ? (
            <button type="button" className="da-tap w-full p-[10px] text-left text-[14px]" onClick={() => { my.retry(); void tq.refetch(); }} data-testid="bell-retry">
              {BELL_ERROR_LINE}
            </button>
          ) : loading ? (
            <p className="m-0 p-[10px] text-[14px] text-[var(--mut)]">Loading&hellip;</p>
          ) : alerts.length === 0 ? (
            <p className="m-0 p-[10px] text-[14px] text-[var(--mut)]" data-testid="bell-empty">{BELL_EMPTY_LINE}</p>
          ) : (
            <div className="grid gap-[2px]">
              {alerts.map((a) => (
                <Row key={a.id} alert={a} unread={!read.has(a.id)} onTap={() => tap(a)} />
              ))}
            </div>
          )}
        </div>
      )}
      {qr && (
        // Its own small overlay, not the options Sheet: that lives in the dancer-app chunk, and a lazy
        // chunk importing it breaks the dancer-app.tsx entry key the bundle-budget check looks for.
        <div
          role="dialog"
          aria-modal="true"
          aria-label={qr.name}
          data-testid="bell-qr-sheet"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'end center' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeQr(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeQr(); }}
        >
          <div style={{ width: 'min(480px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--card, #fff)', color: 'var(--fg, inherit)', borderRadius: '20px 20px 0 0', padding: 16, paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <h2 className="m-0 mb-[8px] text-center text-[16px]">{qr.name}</h2>
            <Suspense fallback={null}>
              <NightQrBody key={qr.occurrenceId} night={qr} tickets={qrTickets} />
            </Suspense>
            <button type="button" autoFocus className="da-tap mt-[12px] w-full rounded-[12px] border border-[var(--line)] p-[10px] text-[14px]" onClick={closeQr} data-testid="bell-qr-close">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ticketAlertTickets = (upcoming: readonly Night[], tickets: readonly MyTicket[], occurrenceId: string, now: Date): MyTicket[] => {
  const n = upcoming.find((x) => x.occurrenceId === occurrenceId);
  return n ? ticketsForNight(n, [...tickets], now) : [];
};

export default DancerBell;
