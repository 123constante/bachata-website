import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatCount, formatPence, type Order, type TicketType } from '../../tickets/ticketModel';
import { doorKeys, fetchDoorList } from '../door/data';
import { buildReport, csvFileName, downloadWhy, guestListCsv, reportEmptyText } from './salesReportModel';

/**
 * The orders view's Sales report card (lazy chunk): per ticket type sold / refunded / left, money,
 * a totals row, and Download guest list (a CSV built here from the loaded orders; no email, no
 * Stripe ids). The checked-in line shows only when the door list loads; a failure says nothing.
 */
export function SalesReport({
  seriesId,
  eventName,
  types,
  orders,
  today,
}: {
  seriesId: string;
  eventName: string;
  types: readonly TicketType[];
  orders: readonly Order[];
  today: string;
}) {
  const { user } = useAuth();
  const door = useQuery({
    queryKey: doorKeys.list(user?.id, seriesId),
    queryFn: () => fetchDoorList(seriesId),
    enabled: !!user?.id && !!seriesId,
    staleTime: 15_000,
    retry: 0,
  });
  const report = buildReport(types, orders);
  const why = downloadWhy(report);
  const d = door.data;
  const checkedIn = d && d.result === 'ok' && d.inCount !== null && d.totalCount !== null ? { inCount: d.inCount, total: d.totalCount } : null;

  const download = () => {
    const { csv } = guestListCsv(types, orders);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(eventName, today);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p3-card p3-tight" data-testid="tix-report">
      <div className="p3-row-t p3-pad-y">Sales report</div>
      {report.countedOrders === 0 ? (
        <p className="p3-note p3-pad-y" data-testid="tix-report-empty">{reportEmptyText(types)}</p>
      ) : (
        <ul className="p3-list p3-flush">
          {report.rows.map((r) => (
            <li key={r.typeId} className="p3-row" data-testid={`tix-report-row-${r.typeId}`}>
              <div className="p3-grow">
                <div className="p3-row-t">{r.name}</div>
                <div className="p3-row-s" data-testid="tix-report-counts">
                  {formatCount(r.sold)} sold &middot; {formatCount(r.refundedTickets)} refunded &middot; {formatCount(r.remaining)} left of {formatCount(r.capacity)}
                </div>
                <div className="p3-row-s" data-testid="tix-report-money">
                  Paid {formatPence(r.grossPence)} &middot; Refunded {formatPence(r.refundedPence)} &middot; Net {formatPence(r.netPence)}
                </div>
              </div>
            </li>
          ))}
          <li className="p3-row" data-testid="tix-report-totals">
            <div className="p3-grow">
              <div className="p3-row-t">Total</div>
              <div className="p3-row-s" data-testid="tix-report-total-counts">
                {formatCount(report.totals.sold)} sold &middot; {formatCount(report.totals.refundedTickets)} refunded
              </div>
              <div className="p3-row-s" data-testid="tix-report-total-money">
                Paid {formatPence(report.totals.grossPence)} &middot; Refunded {formatPence(report.totals.refundedPence)} &middot; Net {formatPence(report.totals.netPence)}
              </div>
            </div>
          </li>
        </ul>
      )}
      {report.notPaidOrders > 0 && (
        <p className="p3-note p3-pad-y" data-testid="tix-report-notpaid">
          {formatCount(report.notPaidOrders)} {report.notPaidOrders === 1 ? 'order' : 'orders'} not paid, left out.
        </p>
      )}
      {checkedIn && (
        <p className="p3-note p3-pad-y" data-testid="tix-report-checkedin">
          {formatCount(checkedIn.inCount)} of {formatCount(checkedIn.total)} checked in
        </p>
      )}
      <button type="button" className="p3-btn p3-btn-line" onClick={download} disabled={why !== null} data-testid="tix-report-download">
        Download guest list
      </button>
      {why && <p className="p3-note p3-pad-y" data-testid="tix-report-why">{why}</p>}
    </div>
  );
}
