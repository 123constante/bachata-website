import { Suspense, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Lock, Ticket } from 'lucide-react';
import { appWelcomeHref } from '@/lib/accountRouting';
import { useAuth } from '@/hooks/useAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { isOrderId } from '@/modules/tickets/ticketCheckoutModel';
import { CARD_COPY } from '../tickets/model';
import { useTicketCard } from '../tickets/useTicketCard';
import '../tickets/tickets.css';
import './teaser.css';
import { LOCKED_ROWS, TEASER_COPY, TEASER_HOME, finishLineFor, greetingFor, nightDate, nightsHref, ticketLine } from './teaserModel';

// Lazy, as on the Tickets tab: the QR generator never lands on a first load.
const TicketCard = lazyWithRetry(() => import('../tickets/TicketCard'));

type Rows = readonly { title: string; line: string }[];

/** One locked item: blurred content under one centred gold chip. Tap = the one sheet. */
const Locked = ({ children, onOpen, label, testId }: { children: ReactNode; onOpen: () => void; label: string; testId?: string }) => (
  <button type="button" className="tz-lock" onClick={onOpen} aria-label={`${label}, locked: ${TEASER_COPY.sheetTitle}`} data-testid={testId ?? 'teaser-locked'}>
    <span className="tz-lock-in" aria-hidden="true" style={{ display: 'block' }}>{children}</span>
    <span className="tz-lock-badge" aria-hidden="true">
      <span><Lock style={{ width: 14, height: 14 }} />{TEASER_COPY.locked}</span>
    </span>
  </button>
);

const LockedRows = ({ rows, onOpen }: { rows: Rows; onOpen: () => void }) => (
  <div className="tz-card">
    {rows.map((r) => (
      <Locked key={r.title} onOpen={onOpen} label={r.title}>
        <span className="tz-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0 }}><b>{r.title}</b><span>{r.line}</span></span>
          <ChevronRight aria-hidden="true" style={{ width: 18, height: 18 }} />
        </span>
      </Locked>
    ))}
  </div>
);

/** The ONE sheet every locked item opens. Continue = the existing onboarding entry; Not now closes. */
function LockSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="dt-sheet-scrim" onClick={onClose} data-testid="teaser-sheet-scrim">
      <div className="dt-sheet" role="dialog" aria-modal="true" aria-label={TEASER_COPY.sheetTitle} onClick={(e) => e.stopPropagation()} data-testid="teaser-sheet">
        <div className="tz-sheet">
          <div className="tz-grab" style={{ margin: '0 auto' }} />
          <h2>{TEASER_COPY.sheetTitle}</h2>
          <p>{TEASER_COPY.sheetBody}</p>
          <Link to={appWelcomeHref(TEASER_HOME)} className="tz-btn" onClick={onClose} data-testid="teaser-sheet-continue">{TEASER_COPY.sheetContinue}</Link>
          <button type="button" className="tz-btn tz-btn-ghost" onClick={onClose} data-testid="teaser-sheet-not-now">{TEASER_COPY.sheetNotNow}</button>
        </div>
      </div>
    </div>
  );
}

/** Sheet state for one screen: `open` for every locked item, `node` rendered once at the end. */
const useLockSheet = () => {
  const [shown, setShown] = useState(false);
  return { open: () => setShown(true), node: shown ? <LockSheet onClose={() => setShown(false)} /> : null };
};

/** `layoutC` is passed in by the route (the flag module sits in the dancer-app chunk; see TeaserOptions). */
export function TeaserHome({ layoutC = false }: { layoutC?: boolean } = {}) {
  const sheet = useLockSheet();
  const { view, retry } = useTicketCard();
  const { user } = useAuth();
  const { search } = useLocation();
  // Checkout return (buyer onboarding ON): the order card with the QR, or its plain pending line
  // while the webhook lands (the Tickets tab's own poll, useTicketCard), sits at the top of Home.
  const orderCard = BUYER_ONBOARDING_ENABLED && isOrderId(new URLSearchParams(search).get('o'));
  const first = !orderCard && view.kind === 'tickets' ? view.tickets[0] : null;
  return (
    <div className="tz-screen" data-testid="teaser-home">
      <h1 className="tz-h1">{greetingFor(user?.user_metadata)}</h1>
      {orderCard && (
        <Suspense fallback={<section className="dt-card dt-card-state" data-testid="tickets-card" data-state="loading"><p className="dt-state-line">{CARD_COPY.loading}</p></section>}>
          <TicketCard view={view} retry={retry} copy={CARD_COPY} />
        </Suspense>
      )}
      <section className="tz-card tz-pad" data-testid="teaser-finish-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="tz-big">{TEASER_COPY.step}</span>
          <span className="tz-muted" style={{ fontWeight: 600 }}>{TEASER_COPY.stepSuffix}</span>
        </div>
        <div className="tz-bar" aria-hidden="true"><i className="on" /><i /><i /><i /></div>
        <p className="tz-muted" style={{ margin: '0 0 14px', fontSize: 15 }} data-testid="teaser-finish-line">{finishLineFor(view.kind)}</p>
        <button type="button" className="tz-btn" onClick={sheet.open} data-testid="teaser-next-step">{TEASER_COPY.finishCta}</button>
      </section>
      {first && (
        <section className="tz-card" data-testid="teaser-ticket-card">
          <span className="tz-notch tz-notch-l" aria-hidden="true" /><span className="tz-notch tz-notch-r" aria-hidden="true" />
          <Link to={nightsHref(search)} className="tz-tkt" data-testid="teaser-ticket-link">
            <span className="tz-tkt-ic"><Ticket aria-hidden="true" style={{ width: 22, height: 22 }} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{TEASER_COPY.ticketTitle}</b>
              <small>{ticketLine(first.typeName, nightDate(first.eventDate))}</small>
            </span>
            <span className="tz-pill">{first.checkedIn ? 'Checked in' : 'Valid'}</span>
          </Link>
        </section>
      )}
      <div className="tz-sec">Also</div>
      <LockedRows rows={layoutC ? HOME_C_ROWS : LOCKED_ROWS.home} onOpen={sheet.open} />
      {sheet.node}
    </div>
  );
}

export function TeaserNights() {
  const sheet = useLockSheet();
  const { view, retry } = useTicketCard();
  return (
    <div className="tz-screen" data-testid="teaser-nights">
      <h1 className="tz-title">Nights</h1>
      <Suspense fallback={<section className="dt-card dt-card-state" data-testid="tickets-card" data-state="loading"><p className="dt-state-line">{CARD_COPY.loading}</p></section>}>
        <TicketCard view={view} retry={retry} copy={CARD_COPY} />
      </Suspense>
      <div className="tz-sec">Past nights</div>
      <div className="tz-card">
        <Locked onOpen={sheet.open} label={LOCKED_ROWS.nights[0].title}>
          <span className="tz-night">
            <span className="tz-date">Past</span>
            <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 15 }}>{LOCKED_ROWS.nights[0].title}</b><span className="tz-muted" style={{ fontSize: 13 }}>{LOCKED_ROWS.nights[0].line}</span></span>
          </span>
        </Locked>
      </div>
      {sheet.node}
    </div>
  );
}

/** Layout C preview Home ghosts: Preview my page (moved from Me) joins after Share my page. */
const HOME_C_ROWS: Rows = [LOCKED_ROWS.home[0], { title: 'Preview my page', line: LOCKED_ROWS.me[1].line }, ...LOCKED_ROWS.home.slice(1)];
/** Layout C preview Me ghosts: My page moved to Home. */
const ME_C_ROWS: Rows = LOCKED_ROWS.me.filter((r) => r.title !== 'My page');

/**
 * Layout C (brief dancer-layout-c-s2): `settings` is the live Settings section, given the ghost drawer for
 * the two rows that stay locked (Send feedback, Add to my phone's home screen); `signOut` is the quiet last
 * row. Both are passed in by the route, as TeaserOptions' signOut is (they live in the dancer-app chunk).
 */
export function TeaserMe({ layoutC = false, settings, signOut }: { layoutC?: boolean; settings?: (ghost: (row: { label: string }) => ReactNode) => ReactNode; signOut?: ReactNode } = {}) {
  const sheet = useLockSheet();
  const ghost = (row: { label: string }) => (
    <Locked onOpen={sheet.open} label={row.label} testId={`teaser-locked-${row.label}`}>
      <span className="tz-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}><b>{row.label}</b></span>
        <ChevronRight aria-hidden="true" style={{ width: 18, height: 18 }} />
      </span>
    </Locked>
  );
  return (
    <div className="tz-screen" data-testid="teaser-me">
      <h1 className="tz-title">Me</h1>
      <section className="tz-card tz-pad" style={{ display: 'grid', gap: 12 }}>
        <div className="tz-me-top">
          <span className="tz-av" aria-hidden="true">?</span>
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{TEASER_COPY.meName}</div><div className="tz-muted" style={{ fontSize: 14 }}>{TEASER_COPY.meEmpty}</div></div>
        </div>
        <button type="button" className="tz-btn" onClick={sheet.open} data-testid="teaser-me-continue">{TEASER_COPY.sheetContinue}</button>
      </section>
      <div className="tz-sec">My profile</div>
      <LockedRows rows={layoutC ? ME_C_ROWS : LOCKED_ROWS.me} onOpen={sheet.open} />
      {layoutC && settings?.(ghost)}
      {layoutC && signOut && <div className="tz-quiet-out" data-testid="teaser-me-sign-out">{signOut}</div>}
      {sheet.node}
    </div>
  );
}

/** `signOut` is passed in by the route (it lives in the dancer-app chunk; importing it here would make this lazy chunk pull that chunk and drop its manifest entry). */
export function TeaserOptions({ signOut }: { signOut?: ReactNode }) {
  const sheet = useLockSheet();
  return (
    <div className="tz-screen" data-testid="teaser-options">
      <h1 className="tz-title">Options</h1>
      <LockedRows rows={LOCKED_ROWS.options} onOpen={sheet.open} />
      {signOut}
      {sheet.node}
    </div>
  );
}
