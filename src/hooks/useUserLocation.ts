import { useCallback, useEffect, useState } from 'react';

export type UserLocationStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type UserLocationReason =
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'insecure'
  | null;

export type UserCoords = { lat: number; lng: number };

type UseUserLocationResult = {
  status: UserLocationStatus;
  reason: UserLocationReason;
  coords: UserCoords | null;
  request: () => void;
  clear: () => void;
  setManualCoords: (coords: UserCoords) => void;
};

const STORAGE_KEY = 'tonight.userCoords';

const readCachedCoords = (): UserCoords | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserCoords>;
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
    return null;
  } catch {
    return null;
  }
};

const writeCachedCoords = (coords: UserCoords | null) => {
  try {
    if (coords) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage can throw in private modes; ignore */
  }
};

const geolocationSupported = () =>
  typeof window !== 'undefined' && 'geolocation' in navigator;

const isSecureContext = () =>
  typeof window !== 'undefined' && Boolean(window.isSecureContext);

export function useUserLocation(): UseUserLocationResult {
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [reason, setReason] = useState<UserLocationReason>(null);
  const [coords, setCoords] = useState<UserCoords | null>(null);

  // Hydrate from sessionStorage on mount, but only if the browser still
  // reports the permission as granted. This avoids silently re-applying
  // coords after the user revoked permission in another tab.
  // On iOS Safari, navigator.permissions.query is not reliably supported,
  // so we fall back to trusting the cache if the API is unavailable.
  useEffect(() => {
    if (!geolocationSupported()) {
      setStatus('unavailable');
      setReason('unavailable');
      return;
    }
    if (!isSecureContext()) {
      // getCurrentPosition will hang or silently fail on insecure origins
      // (everything except localhost/127.0.0.1 over plain http). Surface
      // it cleanly so the postcode fallback renders immediately.
      setStatus('unavailable');
      setReason('insecure');
      return;
    }
    const cached = readCachedCoords();
    if (!cached) return;
    let cancelled = false;
    (async () => {
      try {
        if ('permissions' in navigator && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({
              name: 'geolocation' as PermissionName,
            });
            if (cancelled) return;
            if (result.state === 'granted') {
              setCoords(cached);
              setStatus('granted');
              setReason(null);
            }
            return;
          } catch {
            // Permissions API query failed (common on iOS). Fall through.
          }
        }
        if (!cancelled) {
          setCoords(cached);
          setStatus('granted');
          setReason(null);
        }
      } catch {
        /* swallow â€” leave state idle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(() => {
    if (!geolocationSupported()) {
      setStatus('unavailable');
      setReason('unavailable');
      return;
    }
    if (!isSecureContext()) {
      setStatus('unavailable');
      setReason('insecure');
      return;
    }
    setStatus('loading');
    setReason(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        setStatus('granted');
        setReason(null);
        writeCachedCoords(next);
      },
      (err) => {
        // PositionError.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        let nextReason: UserLocationReason = 'denied';
        if (err && typeof err.code === 'number') {
          if (err.code === 2) nextReason = 'unavailable';
          else if (err.code === 3) nextReason = 'timeout';
        }
        // eslint-disable-next-line no-console
        console.warn('[useUserLocation] geolocation error', {
          code: err?.code,
          message: err?.message,
          reason: nextReason,
        });
        setCoords(null);
        setStatus('denied');
        setReason(nextReason);
        writeCachedCoords(null);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus('idle');
    setReason(null);
    writeCachedCoords(null);
  }, []);

  const setManualCoords = useCallback((next: UserCoords) => {
    setCoords(next);
    setStatus('granted');
    setReason(null);
    writeCachedCoords(next);
  }, []);

  return { status, reason, coords, request, clear, setManualCoords };
}
