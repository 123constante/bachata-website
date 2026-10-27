import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import TicketsHome from './TicketsHome';
import SeriesTickets from './SeriesTickets';
import { TICKETS_BASE } from './paths';

/**
 * /account/tickets/* (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserTicketing and flags.organiserSelfServe are on).
 */
export default function TicketRoutes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <Routes>
        <Route index element={<TicketsHome />} />
        <Route path="events/:seriesId" element={<SeriesTickets />} />
        <Route path="*" element={<ToTicketsHome />} />
      </Routes>
    </AuthGuard>
  );
}

/** An unknown path goes to the ticket home, keeping ?o= (the page) so it never swaps page. */
function ToTicketsHome() {
  const { search } = useLocation();
  return <Navigate to={`${TICKETS_BASE}${search}`} replace />;
}
