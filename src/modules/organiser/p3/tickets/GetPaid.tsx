import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PAYOUTS_ASK_OWNER,
  isOwner,
  NOT_SWITCHED_ON,
  STRIPE_COPY,
  OPEN_STRIPE_LABEL,
  canManage,
  canSetUpPayouts,
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
import { isListedSeries } from '../../shared/homeModel';
import { teamOf } from '../../shared/selfServeApi';
import { P3_PATHS } from '../shell/paths';
import { P3PushedShell } from '../you/surface';
import { P3Link, RetryButton, StateCard } from '../screens/parts';
import { hasLiveEvent, payingOrganiser, useP3Home, useStartOnboarding, useStripe, useSummary } from './data';
import { PROMPT_BODY, PROMPT_TITLE, TONE_CLASS, getPaidRowTag, showPrompt, type PromptState } from './model';
import { P3_TICKET_PATHS } from './paths';
import { CONNECT_RETURN_EVERY_MS, CONNECT_RETURN_FOR_MS, nextTicketTarget, returnKindOf, useConnectReturn } from './connectReturn';

const BACK_NOTE = {
  return: 'Back from Stripe. We are checking it now; it can take a minute to show as connected.',
  refresh: 'That Stripe link ran out. Tap the button to carry on where you left off.',
} as const;
/** Back from Stripe (or a link that ran out) while Stripe is checking: nothing is left to fill in. */
const BACK_NOTE_WAITING = 'Back from Stripe. It is checking your details, which is usually quick. Tap Check again in a minute.';

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
    t.discountsPence > 0 ? `${formatPence(t.discountsPence)} off with promo codes` : null,
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
function GetPaidContent() {
  const home = useP3Home();
  const [params, setParams] = useSearchParams();
  const org = payingOrganiser(home.data, params.get('o'));
  const stripeParam = params.get('stripe');
  // Read once on arrival, then dropped from the URL so a reload does not repeat the note.
  const [back] = useState(() => returnKindOf(stripeParam));
  useEffect(() => {
    if (!stripeParam) return;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
  }, [stripeParam, params, setParams]);

  if (home.isPending) {
    return <div className="p3-stack"><StateCard title="Loading&hellip;" testId="tix-getpaid-loading">This takes a second.</StateCard></div>;
  }
  if (home.isError) {
    return (
      <div className="p3-stack">
        
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
        
        <StateCard title="No organiser page yet" testId="tix-getpaid-nopage">
          <p>Set up your organiser page first, then come back here to get paid for tickets.</p>
          <P3Link to={P3_PATHS.start} testId="tix-getpaid-setup">Set up your page</P3Link>
        </StateCard>
      </div>
    );
  }
  return <div className="p3-stack" data-testid="tix-getpaid"><GetPaidBody org={org} back={back} /></div>;
}

/** You > Get paid (route you/get-paid): in P3's pushed frame, the same one the You screens use. */
export function GetPaidScreen() {
  return (
    <P3PushedShell title="Get paid" back={{ to: P3_PATHS.you, label: 'You' }}>
      <GetPaidContent />
    </P3PushedShell>
  );
}

function GetPaidBody({ org, back }: { org: HomeOrganiser; back: 'return' | 'refresh' | null }) {
  const { query, state } = useStripe(org.id);
  // Review 1520-r1 F3: only the owner's summary keeps pence once parsed.
  const summary = useSummary(org.id, isOwner(org.role));
  const { go, busy, note, switchedOff } = useStartOnboarding(org.id);
  const manager = canManage(org.role);
  useConnectReturn(back === 'return' && canSetUpPayouts(org.role), state === 'connected', () => query.refetch());
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
  // Slice 2 (PQ1): payouts are the owner's. Anyone else is told to ask the owner, with no button and no amounts.
  const owner = isOwner(org.role);
  const canGo = owner && state !== 'connected' && !switchedOff;
  return (
    <>
      {back && state !== 'connected' && <p className="p3-warn" data-testid="tix-getpaid-back">{state === 'waiting' ? BACK_NOTE_WAITING : BACK_NOTE[back]}</p>}
      <section className="p3-card p3-stack-s" data-testid="tix-getpaid-card" data-state={state}>
        <div className="p3-row-tags"><span className={TONE_CLASS[tag.tone]} data-testid="tix-getpaid-tag">{tag.tag}</span></div>
        <strong data-testid="tix-getpaid-title">{copy.title}</strong>
        <p className="p3-note">{copy.body}</p>
        {switchedOff && <p className="p3-warn" role="status" data-testid="tix-getpaid-off">{NOT_SWITCHED_ON}</p>}
        {state !== 'connected' && !owner && <p className="p3-note" id="tix-getpaid-why" data-testid="tix-getpaid-why">{PAYOUTS_ASK_OWNER}</p>}
        {owner && state !== 'connected' && !switchedOff && (
          <button
            type="button"
            className="p3-btn"
            disabled={!canGo || busy}
            aria-busy={busy || undefined}
            aria-describedby={!manager ? 'tix-getpaid-why' : undefined}
            onClick={() => (state === 'waiting' ? void query.refetch() : void go())}
            data-testid="tix-getpaid-go"
          >
            {busy && state !== 'waiting' ? 'Opening Stripe\u2026' : STRIPE_COPY[state].action}
          </button>
        )}
        {owner && state === 'waiting' && !switchedOff && (
          <OpenStripeLink onClick={() => void go()} disabled={!canGo || busy} busy={busy} testId="tix-getpaid-open" />
        )}
        {note && <p role="alert" className="p3-error" data-testid="tix-getpaid-note">{note}</p>}
        {state === 'connected' && manager && <AddTicketNext org={org} idPrefix="tix-getpaid-add" />}
        {canGo && <p className="p3-note">You leave Bachata Calendar for Stripe and come back here when you finish.</p>}
      </section>
      {owner && hasLiveEvent(org) && steps && steps.some((s) => !s.done) && (
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
      {owner && summary.isError && (
        <StateCard title="We could not load your sales." testId="tix-money-error">
          <RetryButton onClick={() => void summary.refetch()} />
        </StateCard>
      )}
      {owner && summary.data && !summary.data.ok && <p className="p3-note" data-testid="tix-money-refused">{reasonMessage(summary.data.reason)}</p>}
      {owner && summary.data?.moneyVisible === true && types && types.length > 0 && <MoneySoFar types={types} />}
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

/** Connected: the real next step, Add a ticket, opening the Tickets sheet of the right event. */
function AddTicketNext({ org, idPrefix }: { org: HomeOrganiser; idPrefix: string }) {
  const next = nextTicketTarget(org);
  return (
    <>
      {next.why && <p className="p3-note" data-testid={`${idPrefix}-why`}>{next.why}</p>}
      <Link className="p3-btn" style={BIG} to={next.to} data-testid={idPrefix}>Add a ticket</Link>
    </>
  );
}

/** The waiting state's plain way on to Stripe: a text link, never the primary action. */
function OpenStripeLink({ onClick, disabled, busy, testId }: { onClick: () => void; disabled: boolean; busy: boolean; testId: string }) {
  return (
    <button type="button" className="p3-link" style={{ minHeight: 44, textAlign: 'left' }} disabled={disabled} aria-busy={busy || undefined} onClick={onClick} data-testid={testId}>
      {busy ? 'Opening Stripe\u2026' : OPEN_STRIPE_LABEL}
    </button>
  );
}

function Prompt({ org, stripe }: { org: HomeOrganiser; stripe: PromptState }) {
  const { go, busy, note, switchedOff } = useStartOnboarding(org.id);
  const { query } = useStripe(org.id);
  return (
    <section className="p3-card p3-stack-s p3-prompt" aria-label="Get paid" data-testid="tix-prompt" data-state={stripe}>
      <span className={`${TONE_CLASS.party} p3-self-start`} data-testid="tix-prompt-kicker">Get paid</span>
      <strong data-testid="tix-prompt-title">{PROMPT_TITLE[stripe]}</strong>
      <p className="p3-note">{PROMPT_BODY[stripe]}</p>
      {switchedOff ? (
        <p className="p3-warn" role="status" data-testid="tix-prompt-off">{NOT_SWITCHED_ON}</p>
      ) : (
        <button type="button" className="p3-btn" onClick={() => (stripe === 'waiting' ? void query.refetch() : void go())} disabled={busy} aria-busy={busy || undefined} data-testid="tix-prompt-go">
          {busy && stripe !== 'waiting' ? 'Opening Stripe\u2026' : STRIPE_COPY[stripe].action}
        </button>
      )}
      {stripe === 'waiting' && !switchedOff && <OpenStripeLink onClick={() => void go()} disabled={busy} busy={busy} testId="tix-prompt-open" />}
      {note && <p role="alert" className="p3-error" data-testid="tix-prompt-note">{note}</p>}
      <Link className="p3-link" to={P3_TICKET_PATHS.getPaid(org.id)} data-testid="tix-prompt-more">More about getting paid</Link>
    </section>
  );
}

/** Home's tickets-sold tile: only once anything has sold, only on a page the person runs. */
export function TicketsSoldTile() {
  const home = useP3Home();
  const org = payingOrganiser(home.data, null);
  // Slice 2 (PQ1): the amount is the owner's. A manager's tile is the count alone (its summary keeps no pence).
  const summary = useSummary(org?.id, isOwner(org?.role));
  // Fail closed: the server's money_visible=false hides the amount even for a role we believed was the owner; a missing flag or loading summary is counts only.
  const money = isOwner(org?.role) && summary.data?.moneyVisible === true;
  const types = summary.data?.ok ? summary.data.types : null;
  if (!org || !types) return null;
  const t = totalsOf(types);
  if (t.ticketsSold === 0) return null;
  return (
    <Link to={P3_TICKET_PATHS.getPaid(org.id)} className="p3-card p3-stat p3-tap" data-testid="tix-sold-tile">
      <span className="p3-stat-n">{formatCount(t.ticketsSold)}</span>
      <span className="p3-stat-l">Tickets sold{money && <> &middot; {formatPence(t.grossPence)}</>}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------
 * The single Get paid screen (route /account/p3/get-paid?o=<organiserId>): the page a WhatsApp
 * link lands on. ONE mapping (startView) decides the heading, the notes and the one primary
 * button for every role x Stripe state x arrival; the markup only draws it.
 * ---------------------------------------------------------------------------------------- */

export const POLL_EVERY_MS = CONNECT_RETURN_EVERY_MS;
export const POLL_FOR_MS = CONNECT_RETURN_FOR_MS;
const STRIPE_ASKS = [
  'Your name and date of birth',
  'Your bank details, so it can pay you',
  'A few words on what you sell',
] as const;

export type StartArrival = 'fresh' | 'return' | 'refresh';
export type StartPhase = 'checking' | 'timeout' | null;
export interface StartView {
  heading: string;
  asks: boolean;
  status: string | null;
  note: string | null;
  primary: { kind: 'connect' | 'add' | 'check'; label: string } | null;
  /** Waiting only: the plain way on to Stripe under Check again. */
  secondary: { kind: 'connect'; label: string } | null;
}

/** The ask-the-owner line: the owner's name when the home payload carries it, else "the page owner". */
export const askOwner = (org: HomeOrganiser): string => `Ask ${teamOf(org).find((m) => m.role === 'owner')?.displayName ?? 'the page owner'} to connect payments`;

export function startView(i: { manager: boolean; owner: boolean; state: StripeState; arrival: StartArrival; phase: StartPhase; switchedOff: boolean; org: HomeOrganiser }): StartView {
  const ready = i.state === 'connected';
  if (ready) {
    return { heading: 'You\u2019re ready to sell tickets', asks: false, status: null, note: null, primary: i.manager ? { kind: 'add', label: 'Add a ticket' } : null, secondary: null };
  }
  const base = { heading: 'Get paid for your tickets', asks: true };
  if (!i.owner) return { ...base, status: null, note: askOwner(i.org), primary: null, secondary: null };
  if (i.switchedOff) return { ...base, asks: false, status: null, note: NOT_SWITCHED_ON, primary: null, secondary: null };
  if (i.arrival === 'return' && i.phase === 'checking') return { ...base, asks: false, status: 'Checking with Stripe\u2026', note: null, primary: null, secondary: null };
  if (i.arrival === 'return' && i.phase === 'timeout') {
    return { ...base, asks: false, status: 'Stripe is still finishing. This can take a minute.', note: null, primary: { kind: 'check', label: 'Check again' }, secondary: i.state === 'waiting' ? { kind: 'connect', label: OPEN_STRIPE_LABEL } : null };
  }
  if (i.state === 'waiting') {
    return { ...base, asks: false, status: STRIPE_COPY.waiting.title('') + '.', note: STRIPE_COPY.waiting.body, primary: { kind: 'check', label: 'Check again' }, secondary: { kind: 'connect', label: OPEN_STRIPE_LABEL } };
  }
  const label = i.state === 'started' ? 'Carry on with Stripe' : 'Connect Stripe';
  return { ...base, status: null, note: i.arrival === 'refresh' ? 'That Stripe link ran out. Tap the button to carry on where you left off.' : null, primary: { kind: 'connect', label }, secondary: null };
}

const BIG = { minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;

function StartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="p3-theme p3-frame" data-testid="getpaid-start">
      <header className="p3-top">
        <Link className="p3-link" to={P3_PATHS.home} data-testid="getpaid-start-home" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>&larr; Home</Link>
      </header>
      <main className="p3-main"><div className="p3-stack">{children}</div></main>
    </div>
  );
}

function StartBody({ org, arrival }: { org: HomeOrganiser; arrival: StartArrival }) {
  const { query, state } = useStripe(org.id);
  const { go, busy, note, switchedOff } = useStartOnboarding(org.id, 'start');
  const manager = canManage(org.role);
  const { phase, again } = useConnectReturn(arrival === 'return' && canSetUpPayouts(org.role), state === 'connected', () => query.refetch());
  if (query.isPending) return <StateCard title="Loading&hellip;" testId="getpaid-start-loading">This takes a second.</StateCard>;
  if (query.isError || !state) {
    return (
      <StateCard title="We could not read your payment set-up." testId="getpaid-start-error">
        <p>Check your connection, then try again.</p>
        <RetryButton onClick={() => void query.refetch()} />
      </StateCard>
    );
  }
  const v = startView({ manager, owner: canSetUpPayouts(org.role), state, arrival, phase, switchedOff, org });
  return (
    <section className="p3-card p3-stack-s" data-testid="getpaid-start-card" data-state={state}>
      <h1 data-testid="getpaid-start-title" style={{ margin: 0, fontSize: 'var(--fs-title)' }}>{v.heading}</h1>
      {v.asks && (
        <div data-testid="getpaid-start-asks">
          <strong>What Stripe will ask you</strong>
          <ul className="p3-note" style={{ margin: '4px 0 0', paddingLeft: 20, listStyle: 'disc' }}>{STRIPE_ASKS.map((a) => <li key={a}>{a}</li>)}</ul>
          <p className="p3-note">Stripe asks. We never see it.</p>
        </div>
      )}
      {v.status && <p className="p3-warn" role="status" data-testid="getpaid-start-status">{v.status}</p>}
      {v.note && <p className={switchedOff ? 'p3-warn' : 'p3-note'} role={switchedOff ? 'status' : undefined} data-testid="getpaid-start-note">{v.note}</p>}
      {v.primary?.kind === 'connect' && (
        <button type="button" className="p3-btn" style={BIG} disabled={busy} aria-busy={busy || undefined} onClick={() => void go()} data-testid="getpaid-start-go">
          {busy ? 'Opening Stripe\u2026' : v.primary.label}
        </button>
      )}
      {v.primary?.kind === 'check' && (
        <button type="button" className="p3-btn" style={BIG} onClick={() => again()} data-testid="getpaid-start-check">{v.primary.label}</button>
      )}
      {v.primary?.kind === 'add' && (
        <AddTicketNext org={org} idPrefix="getpaid-start-add" />
      )}
      {v.secondary && (
        <button type="button" className="p3-link" style={{ minHeight: 44, textAlign: 'left' }} disabled={busy} aria-busy={busy || undefined} onClick={() => void go()} data-testid="getpaid-start-open">
          {busy ? 'Opening Stripe\u2026' : v.secondary.label}
        </button>
      )}
      {note && <p role="alert" className="p3-error" data-testid="getpaid-start-error-note">{note}</p>}
    </section>
  );
}

/** Route get-paid: its own full-screen frame, behind flags.organiserTicketing and AuthGuard. */
export function GetPaidStart() {
  const home = useP3Home();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('o');
  const stripeParam = params.get('stripe');
  const [arrival] = useState<StartArrival>(() => returnKindOf(stripeParam) ?? 'fresh');
  useEffect(() => {
    if (!stripeParam) return;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
  }, [stripeParam, params, setParams]);

  if (home.isPending) return <StartFrame><StateCard title="Loading&hellip;" testId="getpaid-start-home-loading">This takes a second.</StateCard></StartFrame>;
  if (home.isError) {
    return (
      <StartFrame>
        <StateCard title="We couldn&rsquo;t load your page" testId="getpaid-start-home-error">
          <p>Check your connection, then try again.</p>
          <RetryButton onClick={() => void home.refetch()} />
        </StateCard>
      </StartFrame>
    );
  }
  const orgs = home.data?.organisers ?? [];
  if (orgs.length === 0) {
    return (
      <StartFrame>
        <StateCard title="No organiser page yet" testId="getpaid-start-nopage">
          <p>Set up your organiser page first, then come back here to get paid for tickets.</p>
          <P3Link to={P3_PATHS.start} testId="getpaid-start-setup">Set up your page</P3Link>
        </StateCard>
      </StartFrame>
    );
  }
  // A link for a page that is not on this account never quietly shows another page.
  if (wanted && !orgs.some((o) => o.id === wanted)) {
    return (
      <StartFrame>
        <StateCard title="This link is for a page that is not on your account" testId="getpaid-start-wrong">
          <p>You may be signed in with a different email. Go to your own pages from Home.</p>
          <P3Link to={P3_PATHS.home} testId="getpaid-start-wrong-home">Go to Home</P3Link>
        </StateCard>
      </StartFrame>
    );
  }
  const org = payingOrganiser(home.data, wanted);
  if (!org) return null;
  return <StartFrame><StartBody org={org} arrival={arrival} /></StartFrame>;
}

