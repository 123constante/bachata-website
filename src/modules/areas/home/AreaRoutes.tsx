// The person areas' routes (AREA_PATHS): Your areas, the teacher area and the
// DJ area, each with its details page. ONE lazy chunk; AuthGuard wraps it here,
// inside the chunk, exactly as the organiser area does (signed-out visitors go
// to the same /auth sign-in, with returnTo).
import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { AREA_PATHS, type AreaKey } from '@/lib/areaPaths';
import { DEFAULT_AREA_PATHS } from '../shared/paths';
import { DjAreaPage, DjProfilePage, TeacherAreaPage, TeacherProfilePage } from '../index';
import { YOUR_AREAS_LABEL } from './areaStatus';
import YourAreasPage from './YourAreasPage';

/** The details page under each role area (its path is DEFAULT_AREA_PATHS[role].profile). */
const AREA_DETAILS_SEGMENT = 'details';

function Fallback() {
  return <div className="org-theme min-h-[100dvh]" aria-busy="true" />;
}

export default function AreaRoutes({ area }: { area: AreaKey }) {
  useNoindexMeta(true);
  let body;
  if (area === 'areas') {
    body = <YourAreasPage />;
  } else {
    const Area = area === 'teacher' ? TeacherAreaPage : DjAreaPage;
    const Details = area === 'teacher' ? TeacherProfilePage : DjProfilePage;
    body = (
      <Routes>
        <Route index element={<Area profilePath={DEFAULT_AREA_PATHS[area].profile} backPath={AREA_PATHS.areas} backLabel={YOUR_AREAS_LABEL} />} />
        <Route path={AREA_DETAILS_SEGMENT} element={<Details areaPath={AREA_PATHS[area]} />} />
      </Routes>
    );
  }
  return (
    <AuthGuard>
      <Suspense fallback={<Fallback />}>{body}</Suspense>
    </AuthGuard>
  );
}
