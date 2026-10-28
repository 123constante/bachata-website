import { Route } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { GetPaidRow, GetPaidScreen } from '../tickets/GetPaid';

/*
 * W-T x W4a MERGE POINT. The ONLY place the You tab knows about ticketing: the W4a You hub
 * mounts <YouTicketsRow /> (the Get paid row) and P3Routes mounts youGetPaidRoute(); both are
 * behind flags.organiserTicketing, and the you/get-paid route stays a sibling of the hub.
 */
export function YouTicketsRow() {
  return <>{flags.organiserTicketing && <GetPaidRow />}</>;
}

export const youGetPaidRoute = () => (
  <>{flags.organiserTicketing && <Route path="you/get-paid" element={<GetPaidScreen />} />}</>
);
