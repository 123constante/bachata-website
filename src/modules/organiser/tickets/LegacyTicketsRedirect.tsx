import { Navigate, useLocation } from 'react-router-dom';
import { legacyTicketsTarget } from './legacyRedirect';

/** /account/tickets/* (the retired screens): send the person to the P3 screen that does the same job. */
export default function LegacyTicketsRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={legacyTicketsTarget(pathname, search)} replace />;
}
