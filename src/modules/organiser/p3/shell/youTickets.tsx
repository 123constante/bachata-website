import { Route } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import type { SeatKind } from '@/modules/organiser/shared/ownership';
import { TICKETS_INTERIM_LINE, ticketsRow } from '@/modules/organiser/shared/teamRules';
import { GetPaidRow, GetPaidScreen } from '../tickets/GetPaid';

/*
 * W-T x W4a MERGE POINT. The ONLY place the You tab knows about ticketing: the W4a You hub
 * mounts <YouTicketsRow /> (the Get paid row) and P3Routes mounts youGetPaidRoute(); both are
 * behind flags.organiserTicketing, and the you/get-paid route stays a sibling of the hub.
 */
export function YouTicketsRow({ seatKind = null }: { seatKind?: SeatKind | null }) {
  const interim = ticketsRow(seatKind) === 'line';
  return (
    <>
      {flags.organiserTicketing && interim && <p className="p3-row-s" data-testid="you-tickets-interim">{TICKETS_INTERIM_LINE}</p>}
      {!interim && <>{flags.organiserTicketing && <GetPaidRow />}</>}
    </>
  );
}

export const youGetPaidRoute = () => (
  <>{flags.organiserTicketing && <Route path="you/get-paid" element={<GetPaidScreen />} />}</>
);
