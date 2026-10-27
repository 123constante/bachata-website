import { Route } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { GetPaidRow, GetPaidScreen } from '../tickets/GetPaid';
import { P3Placeholder } from './placeholders';

/*
 * W-T x W4a MERGE POINT. The ONLY place the You tab knows about ticketing: W4a (the
 * You hub, built in parallel) replaces the `you` element with its hub and mounts
 * <GetPaidRow /> as one of its rows behind flags.organiserTicketing; the you/get-paid
 * route stays as is. Nothing else in P3Routes changes for W-T.
 */
function YouScreen() {
  return (
    <div className="p3-stack">
      {flags.organiserTicketing && <GetPaidRow />}
      <P3Placeholder tab="you" />
    </div>
  );
}

export const youRoutes = () => (
  <>
    <Route path="you" element={<YouScreen />} />
    {flags.organiserTicketing && <Route path="you/get-paid" element={<GetPaidScreen />} />}
  </>
);
