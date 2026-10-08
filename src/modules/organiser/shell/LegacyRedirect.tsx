import { Navigate, useLocation, useParams } from 'react-router-dom';
import { legacyAccountPath, type LegacyAccountTarget } from './legacyPaths';

export function LegacyAccountRedirect({ target }: { target: LegacyAccountTarget }) {
  const { search, hash } = useLocation();
  const params = useParams();
  return <Navigate to={legacyAccountPath(target, params, search, hash)} replace />;
}
