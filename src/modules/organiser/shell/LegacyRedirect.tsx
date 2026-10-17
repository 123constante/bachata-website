import { Navigate, useLocation, useParams } from 'react-router-dom';
import { legacyAccountPath, moduleLegacyPath, type LegacyAccountTarget, type ModuleLegacyTarget } from './legacyPaths';

export function LegacyAccountRedirect({ target }: { target: LegacyAccountTarget }) {
  const { search, hash } = useLocation();
  const params = useParams();
  return <Navigate to={legacyAccountPath(target, params, search, hash)} replace />;
}

export function ModuleLegacyRedirect({ target }: { target: ModuleLegacyTarget }) {
  const { search, hash } = useLocation();
  const params = useParams();
  return <Navigate to={moduleLegacyPath(target, params, search, hash)} replace />;
}
