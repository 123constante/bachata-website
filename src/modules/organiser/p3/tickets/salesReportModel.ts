import { SHOWN_ORDER, orderTag, shortRef, type Order, type TicketType } from '../../tickets/ticketModel';

/*
 * The sales report's pure model: totals per ticket type and the guest-list CSV. No email and no
 * Stripe id is ever read (the orders read does not carry them). "Counted" orders are the ones the
 * orders list shows (paid, refunded, disputed); pending / expired ones are only "not paid".
 */

export interface TypeReportRow {
  typeId: string;
  name: string;
  capacity: number;
  /** Tickets in orders still standing (paid). */
  sold: number;
  /** Tickets in fully refunded orders. */
  refundedTickets: number;
  /** Tickets in disputed orders: voided on a lost dispute, so not sold. */
  disputedTickets: number;
  /** Places still open: capacity less what is reserved, never below 0. */
  remaining: number;
  grossPence: number;
  refundedPence: number;
  /** Disputed orders' money not already refunded: the organiser is not keeping it. */
  disputedPence: number;
  netPence: number;
}

export interface SalesReport {
  rows: TypeReportRow[];
  totals: { sold: number; refundedTickets: number; disputedTickets: number; grossPence: number; refundedPence: number; disputedPence: number; netPence: number };
  /** Orders that count (paid / refunded / disputed): the CSV has exactly this many rows. */
  countedOrders: number;
  /** Pending / expired orders: left out of every total. */
  notPaidOrders: number;
}

export const isCounted = (o: Pick<Order, 'status'>): boolean => SHOWN_ORDER.includes(o.status);

export function buildReport(types: readonly TicketType[], orders: readonly Order[]): SalesReport {
  const rows: TypeReportRow[] = types.map((t) => ({
    typeId: t.id,
    name: t.name,
    capacity: t.capacity,
    sold: 0,
    refundedTickets: 0,
    disputedTickets: 0,
    remaining: Math.max(0, t.capacity - t.reserved),
    grossPence: 0,
    refundedPence: 0,
    disputedPence: 0,
    netPence: 0,
  }));
  const byId = new Map(rows.map((r) => [r.typeId, r]));
  let countedOrders = 0;
  let notPaidOrders = 0;
  for (const o of orders) {
    if (!isCounted(o)) {
      notPaidOrders += 1;
      continue;
    }
    const r = byId.get(o.typeId);
    if (!r) continue;
    countedOrders += 1;
    if (o.status === 'refunded') r.refundedTickets += o.quantity;
    else if (o.status === 'disputed') {
      // A lost dispute voids the tickets and never sets refunded_pence: show it on its own line and take it out of Net.
      r.disputedTickets += o.quantity;
      r.disputedPence += Math.max(0, o.totalPence - o.refundedPence);
    } else r.sold += o.quantity;
    r.grossPence += o.totalPence;
    r.refundedPence += o.refundedPence;
  }
  for (const r of rows) r.netPence = r.grossPence - r.refundedPence - r.disputedPence;
  const sum = (f: (r: TypeReportRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    rows,
    totals: {
      sold: sum((r) => r.sold),
      refundedTickets: sum((r) => r.refundedTickets),
      disputedTickets: sum((r) => r.disputedTickets),
      grossPence: sum((r) => r.grossPence),
      refundedPence: sum((r) => r.refundedPence),
      disputedPence: sum((r) => r.disputedPence),
      netPence: sum((r) => r.netPence),
    },
    countedOrders,
    notPaidOrders,
  };
}

/** Why Download is greyed, or null when there is a guest list to take out. */
export const downloadWhy = (report: SalesReport): string | null =>
  report.countedOrders === 0 ? 'No paid orders yet. The guest list fills as people buy.' : null;

/** The empty words: what the organiser can do next. */
export const reportEmptyText = (types: readonly Pick<TicketType, 'status'>[]): string =>
  types.length === 0
    ? 'No sales to report yet. Add a ticket type, then share the event.'
    : 'No sales to report yet. Share the event so people can buy.';

/**
 * Where the card's money comes from. It differs from Money so far (ticket_sales_summary_v1:
 * paid orders only, subtotal less discount, no booking fee) by the paid booking fees plus the
 * totals of refunded and disputed orders (salesReport.model.agree.test.ts).
 */
export const REPORT_SOURCE_TEXT =
  'From the orders above. Includes booking fees and refunded or disputed orders; Money so far on Get paid counts paid orders only.';

export const CSV_COLUMNS = ['Order', 'Buyer name', 'Ticket type', 'Quantity', 'Status', 'Paid at', 'Refunded (pence)'] as const;

/** A cell starting = + - @ (or a tab / CR / LF) would run as a formula in a spreadsheet: lead it with an apostrophe. */
export const csvCell = (v: string | number): string => {
  let s = String(v);
  if (/^[=+\-@\t\r\n]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The short reference an organiser can say aloud: the ONE order code (ticketModel, review 1520-r1 F4). */
export { shortRef };

export function guestListCsv(types: readonly Pick<TicketType, 'id' | 'name'>[], orders: readonly Order[]): { csv: string; rows: number } {
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const counted = orders.filter(isCounted).slice().sort((a, b) => (a.paidAt ?? '').localeCompare(b.paidAt ?? '') || a.id.localeCompare(b.id));
  const lines = [CSV_COLUMNS.join(',')];
  for (const o of counted) {
    lines.push(
      [
        shortRef(o.id),
        o.buyerName?.trim() || 'Buyer',
        typeName.get(o.typeId) ?? '',
        o.quantity,
        orderTag(o.status).label,
        o.paidAt ?? '',
        o.refundedPence,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return { csv: `${lines.join('\r\n')}\r\n`, rows: counted.length };
}

const slugOf = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';

export const csvFileName = (eventName: string, dateKey: string): string => `guests-${slugOf(eventName)}-${dateKey}.csv`;
