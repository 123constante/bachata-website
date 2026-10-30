import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ticketKeys } from '../../tickets/ticketsApi';
import {
  NOT_MANAGER_STRIPE,
  NOT_SWITCHED_ON,
  STRIPE_COPY,
  canManage,
  formatCount,
  formatPence,
  reasonMessage,
  setupLine,
  setupSteps,
  totalsOf,
  type StripeState,
  type TypeSales,
} from '../../tickets/ticketModel';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { P3_PATHS } from '../shell/paths';
import { ChangeItLink, RetryButton, StateCard } from '../screens/parts';
import { hasLiveEvent, payingOrganiser, useP3Home, useStartOnboarding, useStripe, useSummary } from './data';
import { PROMPT_BODY, PROMPT_TITLE, TONE_CLASS, getPaidRowTag, showPrompt } from './model';
import { P3_TICKET_PATHS } from './paths';

const BACK_NOTE = {
  return: 'Back from Stripe. It can take a minute to show as connected; reload the page if it does not.',
  refresh: 'That Stripe link ran out. Tap the button to carry on where you left off.',
} as const;

/** The Get paid card's title and body on the Get paid screen (the shipped STRIPE_COPY; "none" names no event). */
const screenCopy = (s: StripeState, switchedOff: boolean): { title: string; body: string } => {
  if (s === 'none') return { title: STRIPE_COPY.none.action as string, body: switchedOff ? STRIPE_COPY.none.body : `${STRIPE_COPY.none.body} Free tickets work without it.` };
  return { title: STRIPE_COPY[s].title(''), body: STRIPE_COPY[s].body };
};

/** Sold and Sales, with the rarer counts on one line under them (the shipped NumberCards' words). */
export function MoneySoFar({ types }: { types: readonly TypeSales[] }) {
  const t = totalsOf(types);
  const extra = [
    t.ordersPending > 0 ? `${formatCount(t.ordersPending)} waiting for payment` : null,
    t.refundedPence > 0 ? `${formatPence(t.refundedPence)} refunded` : null,
    t.ordersDisputed > 0 ? `${formatCount(t.ordersDisputed)} disputed` : null,
  ].filter(Boolean);
  return (
    <section aria-label="Money so far" className="p3-stack-s" data-testid="tix-money">
      <h2 className="p3-h2">Money so far</h2>
      <div className="p3-pair">
        <div className="p3-card p3-stat" data-testid="tix-money-sold">
          <span className="p3-stat-l">Sold</span>
          <span className="p3-stat-n">{formatCount(t.ticketsSold)}</span>
        </div>
        <div className="p3-card p3-stat" data-testid="tix-money-gross">
          <span className="p3-stat-l">Sales</span>
          <span className="p3-stat-n p3-money">{formatPence(t.grossPence)}</span>
        </div>
      </div>
      <p className="p3-note" data-testid="tix-money-note">
        Ticket money before Stripe&rsquo;s fees.{extra.length > 0 ? ` ${extra.join(', ')}.` : ''}
      </p>
    </section>
  );
}

/** You > Get paid (route you/get-paid): Stripe state, the Connect button, setup and money so far. */
export function GetPaidScreen() {
  const home = useP3Home();
  const [params, setParams] = useSearchParams();
  const org = payingOrganiser(home.data, params.get('o'));
  const stripeParam = params.get('stripe');
  // Read once on arrival, then dropped from the URL so a reload does not repeat the note.
  const [back] = useState<'return' | 'refresh' | null>(stripeParam === 'return' || stripeParam === 'refresh' ? stripeParam : null);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (back && org?.id) void queryClient.invalidateQueries({ queryKey: ticketKeys.stripe(org.id) });
  }, [back, org?.id, queryClient]);
  useEffect(() => {
    if (!stripeParam) return;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
  }, [stripeParam, params, setParams]);

  const head = <Link className="p3-link" to={P3_PATHS.you}>&larr; You</Link>;
  if (home.isPending) {
    return <div className="p3-stack">{head}<StateCard title="Loading&hellip;" testId="tix-getpaid-loading">This takes a second.</StateCard></div>;
  }
  if (home.isError) {
    return (
      <div className="p3-stack">
        {head}
        <StateCard title="We couldn&rsquo;t load your page" testId="tix-getpaid-home-error">
          <p>Check your connection, then try again.</p>
          <RetryButton onClick={() => void home.refetch()} />
        </StateCard>
      </div>
    );
  }
  if (!org) {
    return (
      <div className="p3-stack">
        {head}
        <StateCard title="No organiser page yet" testId="tix-getpaid-nopage">
          <p>Set up your organiser page first, then come back here to get paid for tickets.</p>
          <ChangeItLink>Do it in the current organiser area</ChangeItLink>
        </StateCard>
      </div>
    );
  }
  return <div className="p3-stack" data-testid="tix-getpaid">{head}<GetPaidBody org={org} back={back} /></div>;
}

function GetPaidBody({ org, back }: { org: HomeOrganiser; back: 'return' | 'refresh' | null }) {
  const { query, state } = useStripe(org.id);
  const summary = useSummary(org.id);
  const { go, busy, note, switchedOff } = useStartOnboarding(org.id);
  const manager = canManage(org.role);
  if (query.isPending) return <StateCard title="Loading your payment set-up&hellip;" testId="tix-getpaid-stripe-loading">This takes a second.</StateCard>;
  if (query.isError || !state) {
    return (
      <StateCard title="We could not read your payment set-up." testId="tix-getpaid-error">
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void query.refetch()} />
      </StateCard>
    );
  }
  const copy = screenCopy(state, switchedOff);
  const tag = STRIPE_COPY[state];
  const types = summary.data?.ok ? summary.data.types : null;
  const steps = types ? setupSteps(state, types) : null;
  const canGo = manager && state !== 'connected' && !switchedOff;
  return (
    <>
      {back && state !== 'connected' && <p className="p3-warn" data-testid="tix-getpaid-back">{BACK_NOTE[back]}</p>}
      <section className="p3-card p3-stack-s" data-testid="tix-getpaid-card" data-state={state}>
        <div className="p3-row-tags"><span className={TONE_CLASS[tag.tone]} data-testid="tix-getpaid-tag">{tag.tag}</span></div>
        <strong data-testid="tix-getpaid-title">{copy.title}</strong>
        <p className="p3-note">{copy.body}</p>
        {switchedOff && <p className="p3-warn" role="status" data-testid="tix-getpaid-off">{NOT_SWITCHED_ON}</p>}
        {state !== 'connected' && !manager && <p className="p3-note" id="tix-getpaid-why" data-testid="tix-getpaid-why">{NOT_MANAGER_STRIPE}</p>}
        {state !== 'connected' && !switchedOff && (
          <button
            type="button"
            className="p3-btn"
            disabled={!canGo || busy}
            aria-busy={busy || undefined}
            aria-describedby={!manager ? 'tix-getpaid-why' : undefined}
            onClick={() => void go()}
            data-testid="tix-getpaid-go"
          >
            {busy ? 'Opening Stripe\u2026' : STRIPE_COPY[state].action}
          </button>
        )}
        {note && <p role="alert" className="p3-error" data-testid="tix-getpaid-note">{note}</p>}
        {canGo && <p className="p3-note">You leave Bachata Calendar for Stripe and come back here when you finish.</p>}
      </section>
      {manager && hasLiveEvent(org) && steps && steps.some((s) => !s.done) && (
        <section className="p3-card" aria-label={setupLine(steps)} data-testid="tix-setup">
          <strong data-testid="tix-setup-line">{setupLine(steps)}</strong>
          <ul className="p3-list p3-flush">
            {steps.map((s) => (
              <li key={s.key} className="p3-row p3-setup" data-done={s.done}>
                <span className="p3-tick" aria-hidden="true" data-done={s.done} />
                <span className="p3-grow">{s.label}<span className="p3-sr">{s.done ? ': done' : ': not yet'}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.isError && (
        <StateCard title="We could not load your sales." testId="tix-money-error">
          <RetryButton onClick={() => void summary.refetch()} />
        </StateCard>
      )}
      {summary.data && !summary.data.ok && <p className="p3-note" data-testid="tix-money-refused">{reasonMessage(summary.data.reason)}</p>}
      {types && types.length > 0 && <MoneySoFar types={types} />}
    </>
  );
}

/** You's Get paid row: its right side states the Stripe state. Its own component so the You hub (W4a) mounts it as is. */
export function GetPaidRow() {
  const home = useP3Home();
  const org = payingOrganiser(home.data, null);
  const { state } = useStripe(org?.id);
  if (!org) return null;
  const tag = getPaidRowTag(state);
  return (
    <Link className="p3-card p3-status-row" to={P3_TICKET_PATHS.getPaid(org.id)} data-testid="tix-you-getpaid">
      <span className="p3-grow">
        <span className="p3-row-t p3-block">Get paid</span>
        <span className="p3-row-s">Stripe pays ticket money into your bank</span>
      </span>
      {tag && <span className={TONE_CLASS[tag.tone]} data-testid="tix-you-getpaid-tag">{tag.label}</span>}
      <span aria-hidden="true">&rsaquo;</span>
    </Link>
  );
}

/** Home's ONE Get paid prompt: owner / manager, a live event, payments not connected. */
export function GetPaidPrompt() {
  const home = useP3Home();
  const org = payingOrganiser(home.data, null);
  const { state } = useStripe(org?.id);
  if (!org || !showPrompt(org.role, hasLiveEvent(org), state)) return null;
  return <Prompt org={org} stripe={state} />;
}

function Prompt({ org, stripe }: { org: HomeOrganiser; stripe: 'none' | 'started' }) {
  const { go, busy, note, switchedOff } = useStartOnboarding(org.id);
  return (
    <section className="p3-card p3-stack-s p3-prompt" aria-label="Get paid" data-testid="tix-prompt" data-state={stripe}>
      <span className={`${TONE_CLASS.party} p3-self-start`} data-testid="tix-prompt-kicker">Get paid</span>
      <strong data-testid="tix-prompt-title">{PROMPT_TITLE[stripe]}</strong>
      <p className="p3-note">{PROMPT_BODY[stripe]}</p>
      {switchedOff ? (
        <p className="p3-warn" role="status" data-testid="tix-prompt-off">{NOT_SWITCHED_ON}</p>
      ) : (
        <button type="button" className="p3-btn" onClick={() => void go()} disabled={busy} aria-busy={busy || undefined} data-testid="tix-prompt-go">
          {busy ? 'Opening Stripe\u2026' : STRIPE_COPY[stripe].action}
        </button>
      )}
      {note && <p role="alert" className="p3-error" data-testid="tix-prompt-note">{note}</p>}
      <Link className="p3-link" to={P3_TICKET_PATHS.getPaid(org.id)} data-testid="tix-prompt-more">More about getting paid</Link>
    </section>
  );
}

/** Home's tickets-sold tile: only once anything has sold, only on a page the person runs. */
export function TicketsSoldTile() {
  const home = useP3Home();
  const org = payingOrganiser(home.data, null);
  const summary = useSummary(org?.id);
  const types = summary.data?.ok ? summary.data.types : null;
  if (!org || !types) return null;
  const t = totalsOf(types);
  if (t.ticketsSold === 0) return null;
  return (
    <Link to={P3_TICKET_PATHS.getPaid(org.id)} className="p3-card p3-stat p3-tap" data-testid="tix-sold-tile">
      <span className="p3-stat-n">{formatCount(t.ticketsSold)}</span>
      <span className="p3-stat-l">Tickets sold &middot; {formatPence(t.grossPence)}</span>
    </Link>
  );
}
