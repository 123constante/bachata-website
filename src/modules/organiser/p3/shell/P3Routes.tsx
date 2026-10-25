import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { P3Placeholder } from './placeholders';
import { P3_PATHS } from './paths';

/**
 * The P3 organiser area (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserP3 and flags.organiserSelfServe are on). W0: placeholders only.
 */
export default function P3Routes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <Routes>
        <Route element={<P3Shell />}>
          <Route index element={<P3Placeholder tab="home" />} />
          <Route path="events" element={<P3Placeholder tab="events" />} />
          <Route path="stats" element={<P3Placeholder tab="stats" />} />
          <Route path="you" element={<P3Placeholder tab="you" />} />
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
