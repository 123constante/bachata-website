import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Done } from './StatusSheet';

/**
 * An edit screen saved and came back (W3a, C3 backTo + toast): the event page shows the words
 * it carried once, then drops them from the history entry so Back does not show them again.
 */
export function useSavedToast(show: (d: Done) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const text = (location.state as { p3Toast?: unknown } | null)?.p3Toast;
  useEffect(() => {
    if (typeof text !== 'string' || !text) return;
    show({ text, undo: null });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [text, show, navigate, location.pathname, location.search]);
}
