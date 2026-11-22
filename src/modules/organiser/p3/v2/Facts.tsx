import type { ReactNode } from 'react';
import { V2 } from './copy';

export type PriceMode = 'door' | 'link' | 'notOnSale' | 'none' | 'tickets';
export interface PriceInput {
  doorPrice?: string | null;
  link?: string | null;
  /** null = not known from the read (the prototype treats it as connected) */
  stripeConnected?: boolean | null;
  ticketCount?: number;
  minPrice?: number | null;
}

/** The Price fact's two lines, in the prototype's five modes. Pure. */
export function priceLabel(i: PriceInput): { mode: PriceMode; m: string; s: string } {
  if (i.doorPrice) return { mode: 'door', m: `£${i.doorPrice}`, s: V2.payAtDoor };
  if (i.link) return { mode: 'link', m: V2.ticketsElsewhere, s: i.link || V2.yourLink };
  if (i.stripeConnected === false) return { mode: 'notOnSale', m: V2.notOnSale, s: V2.setUpTicketsFirst };
  const n = i.ticketCount ?? 0;
  if (n <= 0) return { mode: 'none', m: V2.addTicket, s: '' };
  return {
    mode: 'tickets',
    m: `${n > 1 ? V2.from : ''}${i.minPrice ? `£${i.minPrice}` : V2.free}`,
    s: V2.tickets_n(n),
  };
}

/** The Description fact's first line: 60 characters then an ellipsis. */
export const aboutShort = (t: string | null | undefined): string =>
  (t ? (t.length > 60 ? `${t.slice(0, 60)}…` : t) : V2.noDescription);

/**
 * One fact (prototype `fact()`): a raised button with label, bold value, optional second line, the "Only this night"
 * tag when this night changed it, and "Change ›". `onOpen` is undefined until the slice that owns the sheet lands:
 * the button then renders fully and a tap does nothing. "Back to usual" sits under a changed fact.
 */
export function Fact({ id, label, main, sub, changed, onOpen, onBack, busy }: {
  id: string; label: string; main: ReactNode; sub?: string; changed?: boolean; onOpen?: () => void; onBack?: () => void; busy?: boolean;
}) {
  return (
    <div className="fwrap" data-testid={`fact-${id}`}>
      <button type="button" className="fbtn" onClick={() => onOpen?.()}>
        <span>
          <span className="lab">{label}</span>
          <b>{main}</b>
          {sub ? <span className="s">{sub}</span> : null}
          {changed ? <span className="only" data-testid={`only-${id}`}>{V2.onlyThisNight}</span> : null}
        </span>
        <span className="fgo">{V2.change} &rsaquo;</span>
      </button>
      {changed && onBack ? (
        <div className="fopts">
          <button type="button" className="fopt" disabled={busy} data-testid={`back-${id}`} onClick={onBack}>{V2.backToUsual}</button>
        </div>
      ) : null}
    </div>
  );
}
