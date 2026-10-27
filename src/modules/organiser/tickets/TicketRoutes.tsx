import { Navigate, Route, Routes } from 'react-router-dom';
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
        <Route path="*" element={<Navigate to={TICKETS_BASE} replace />} />
      </Routes>
    </AuthGuard>
  );
}
