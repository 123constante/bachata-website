import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { fullDate } from '../shared/dateWords';
import { Card, PrimaryButton, StatusTag } from '../ui';
import { fetchSalesSummary, fetchStripeAccount, startOnboarding, ticketKeys } from './ticketsApi';
import {
  EVENT_SALE,
  NOT_SWITCHED_ON,
  STRIPE_COPY,
  SWITCH_LABEL,
  eventLeftLine,
  eventSaleOf,
  formatPence,
  reasonMessage,
  setupLine,
  stripeStateOf,
  switchMove,
  totalsOf,
  type NextStep,
  type SetupStep,
  type StripeState,
  type TicketStatus,
  type TypeSales,
} from './ticketModel';
import { TICKET_PATHS } from './paths';

/** The reason under a disabled control, named by it (aria-describedby). */
export function Reason({ id, children, testId }: { id: string; children: string | null; testId?: string }) {
  if (!children) return null;
  return (
    <p id={id} data-testid={testId} className="text-[13px] text-[var(--mut)]">
      {children}
    </p>
  );
}

export function useStripeState(organiserId: string | undefined) {
  const q = useQuery({
    queryKey: ticketKeys.stripe(organiserId),
    queryFn: () => fetchStripeAccount(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
  const state: StripeState | null = q.isSuccess ? stripeStateOf(q.data) : null;
  return { query: q, state };
}

export function useSalesSummary(organiserId: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.summary(organiserId),
    queryFn: () => fetchSalesSummary(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
}

const HIGHLIGHT = 'border-[var(--gold)]';

/** The ONE highlighted card on Home: connect payments, add the first ticket, or put it on sale. */
export function NextStepCard({
  step,
  organiserId,
  back,
  addPath,
  openPath,
}: {
  step: NextStep;
  organiserId: string;
  /** `?stripe=` on arrival: the person is back from Stripe. */
  back: 'return' | 'refresh' | null;
  /** Where Add tickets goes for an event (the event page with its add sheet open). */
  addPath: (seriesId: string) => string;
  openPath: (seriesId: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [switchedOff, setSwitchedOff] = useState(false);
  const go = async () => {
    setBusy(true);
    setNote(null);
    const origin = window.location.origin;
    const out = await startOnboarding(
      organiserId,
      TICKET_PATHS.stripeBack(origin, organiserId, 'return'),
      TICKET_PATHS.stripeBack(origin, organiserId, 'refresh'),
    );
    if (out.kind === 'ok') {
      window.location.assign(out.value);
      return;
    }
    setBusy(false);
    if (out.kind === 'not_configured') setSwitchedOff(true);
    else setNote(reasonMessage(out.reason));
  };
  let title: string;
  let body: string;
  let action: ReactNode;
  if (step.kind === 'connect') {
    const copy = STRIPE_COPY[step.stripe];
    title = copy.title(step.seriesName);
    body = copy.body;
    action = switchedOff ? (
      <div className="space-y-[8px]">
        <p role="status" className="text-[14px] text-[var(--fg)]" data-testid="tix-next-off">{NOT_SWITCHED_ON}</p>
        <Link to={addPath(step.seriesId)} className={LINK} data-testid="tix-next-free">
          Add a free ticket instead
        </Link>
      </div>
    ) : (
      <div className="space-y-[4px]">
        <PrimaryButton block testId="tix-getpaid-go" onClick={() => void go()} loading={busy} loadingLabel="Opening Stripe">
          {copy.action}
        </PrimaryButton>
        <Link to={addPath(step.seriesId)} className={LINK} data-testid="tix-next-free">
          Selling free tickets? Add one now
        </Link>
      </div>
    );
  } else if (step.kind === 'add') {
    title = `Add tickets to ${step.seriesName}`;
    body = 'A name, a price and how many. Three short steps.';
    action = (
      <Link to={addPath(step.seriesId)} className={PRIMARY_LINK} data-testid="tix-next-go">
        Add tickets
      </Link>
    );
  } else {
    title = `Put ${step.seriesName} on sale`;
    body = 'Your ticket is ready. Switch it to Selling so people can buy.';
    action = (
      <Link to={openPath(step.seriesId)} className={PRIMARY_LINK} data-testid="tix-next-go">
        Open the event
      </Link>
    );
  }
  const backNote =
    step.kind === 'connect' && back === 'return'
      ? 'Back from Stripe. It can take a minute to show as connected; reload the page if it does not.'
      : step.kind === 'connect' && back === 'refresh'
        ? 'That Stripe link ran out. Tap the button to carry on where you left off.'
        : null;
  return (
    <Card variant="padded" className={HIGHLIGHT} testId="tix-next" data-kind={step.kind}>
      <div className="space-y-[8px]">
        <StatusTag tone="party" testId="tix-next-tag">Next step</StatusTag>
        <h2 className="text-[17px] font-semibold leading-snug" data-testid="tix-next-title">{title}</h2>
        <p className="text-[14px] text-[var(--mut)]">{body}</p>
        {backNote && <p className="text-[13px] text-[var(--mut)]" data-testid="tix-getpaid-back">{backNote}</p>}
        {action}
        {note && (
          <p role="alert" data-testid="tix-getpaid-note" className="text-[13px] text-[var(--fg)]">
            {note}
          </p>
        )}
      </div>
    </Card>
  );
}

export const LINK = 'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--gold-fg)]';
/** A link that looks like the primary button (navigation, not an action). */
export const PRIMARY_LINK =
  'flex h-[52px] w-full items-center justify-center rounded-[var(--r-ctl)] bg-[var(--btn)] text-[16px] font-semibold text-[var(--btnfg)]';

/** "Setup 1 of 3 done" and its three segments. */
export function SetupBar({ steps }: { steps: readonly SetupStep[] }) {
  return (
    <div className="space-y-[6px]" data-testid="tix-setup">
      <div className="flex justify-between text-[13px] text-[var(--mut)]">
        <span>Setup</span>
        <span data-testid="tix-setup-line">{setupLine(steps).replace(/^Setup /, '')}</span>
      </div>
      <ol className="flex gap-[6px]" aria-label={setupLine(steps)}>
        {steps.map((s) => (
          <li
            key={s.key}
            data-done={s.done}
            aria-label={`${s.label}: ${s.done ? 'done' : 'not yet'}`}
            className={cn('h-[5px] flex-1 rounded-full', s.done ? 'bg-[var(--gold)]' : 'bg-[var(--line)]')}
          />
        ))}
      </ol>
    </div>
  );
}

/** Sold and Sales (GBP) side by side, with the rarer counts on one line under them. */
export function NumberCards({ types }: { types: readonly TypeSales[] }) {
  const t = totalsOf(types);
  const extra = [
    t.ordersPending > 0 ? `${t.ordersPending} waiting for payment` : null,
    t.refundedPence > 0 ? `${formatPence(t.refundedPence)} refunded` : null,
    t.ordersDisputed > 0 ? `${t.ordersDisputed} disputed` : null,
  ].filter(Boolean);
  return (
    <section aria-label="Sales" className="space-y-[6px]" data-testid="tix-sales">
      <div className="grid grid-cols-2 gap-[8px]">
        <Card variant="padded" testId="tix-sales-sold">
          <p className="text-[13px] text-[var(--mut)]">Sold</p>
          <p className="text-[22px] font-semibold tabular-nums">{t.ticketsSold}</p>
        </Card>
        <Card variant="padded" testId="tix-sales-gross">
          <p className="text-[13px] text-[var(--mut)]">Sales</p>
          <p className="text-[22px] font-semibold tabular-nums">{formatPence(t.grossPence)}</p>
        </Card>
      </div>
      <p className="text-[13px] text-[var(--mut)]" data-testid="tix-sales-note">
        Ticket money before Stripe&rsquo;s fees.{extra.length > 0 ? ` ${extra.join(', ')}.` : ''}
      </p>
    </section>
  );
}

export interface EventCardSeries {
  id: string;
  name: string;
  next_dates?: readonly { occurrence_date: string }[];
  upcoming_count?: number;
}

/** "Friday 6 November", "Next Friday 6 November" for a series, or a plain word when no date is known. */
export const eventDateLine = (s: EventCardSeries): string => {
  const first = s.next_dates?.[0]?.occurrence_date;
  if (!first) return 'No upcoming dates';
  return (s.upcoming_count ?? 1) > 1 ? `Next ${fullDate(first)}` : fullDate(first);
};

/** One event on Home: name, chip, date and places left. With no tickets it can carry the Add tickets button. */
export function EventCard({ series, types, to, addTo }: { series: EventCardSeries; types: readonly TypeSales[] | null; to: string; addTo: string | null }) {
  const sale = types === null ? null : EVENT_SALE[eventSaleOf(types)];
  const left = types ? eventLeftLine(types) : null;
  return (
    <Card variant="padded" className={cn(addTo && HIGHLIGHT)} testId={`tix-event-${series.id}`} data-sale={types === null ? 'unknown' : eventSaleOf(types)}>
      <Link to={to} className="block min-h-[44px] space-y-[2px]" data-testid="tix-event-open">
        <span className="flex items-center justify-between gap-[8px]">
          <span className="min-w-0 truncate text-[15px] font-semibold">{series.name}</span>
          {sale && <StatusTag tone={sale.tone} testId="tix-event-chip">{sale.label}</StatusTag>}
        </span>
        <span className="block text-[13px] text-[var(--mut)]" data-testid="tix-event-line">
          {left ? `${left} \u00B7 ` : ''}
          {eventDateLine(series)}
        </span>
      </Link>
      {addTo && (
        <Link to={addTo} className={cn(PRIMARY_LINK, 'mt-[8px]')} data-testid="tix-event-add">
          Add tickets
        </Link>
      )}
    </Card>
  );
}

/** The Selling switch: one tap moves on sale to paused and back (or a draft / sold-out ticket onto sale). Its label states the state. */
export function SellingSwitch({
  status,
  blocked,
  busy,
  onMove,
  reasonId,
  testId,
}: {
  status: TicketStatus;
  /** Why the tap is not possible now, or null. */
  blocked: string | null;
  busy: boolean;
  onMove: (to: TicketStatus) => void;
  /** The id of the visible reason the parent renders under the row. */
  reasonId?: string;
  testId?: string;
}) {
  const id = useId();
  const to = switchMove(status);
  if (!to) return <StatusTag tone="neutral" testId="tix-type-closed">{SWITCH_LABEL.closed}</StatusTag>;
  const on = status === 'on_sale';
  return (
    <div className="flex shrink-0 items-center gap-[8px]">
      <span id={`${id}-l`} className="text-[13px] text-[var(--mut)]" data-testid="tix-switch-label">
        {SWITCH_LABEL[status]}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-l`}
        aria-busy={busy || undefined}
        disabled={!!blocked || busy}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={() => onMove(to)}
        data-testid={testId ?? 'tix-switch'}
        className={cn(
          'relative h-[44px] w-[64px] shrink-0 rounded-full border transition-colors duration-300 motion-reduce:transition-none disabled:opacity-60',
          on ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-[var(--line-strong)] bg-[var(--card2)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn('absolute top-[5px] h-[32px] w-[32px] rounded-full bg-[var(--fg)] transition-[left] duration-300 motion-reduce:transition-none', on ? 'left-[27px]' : 'left-[5px]')}
        />
      </button>
    </div>
  );
}
