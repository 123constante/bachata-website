import { useCallback, useEffect, useState } from 'react';

export type UserLocationStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type UserCoords = { lat: number; lng: number };

type UseUserLocationResult = {
  status: UserLocationStatus;
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

const isGeolocationAvailable = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'geolocation' in navigator;

export function useUserLocation(): UseUserLocationResult {
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [coords, setCoords] = useState<UserCoords | null>(null);

  // Hydrate from sessionStorage on mount, but only if the browser still
  // reports the permission as granted. This avoids silently re-applying
  // coords after the user revoked permission in another tab.
  useEffect(() => {
    if (!isGeolocationAvailable()) {
      setStatus('unavailable');
      return;
    }
    const cached = readCachedCoords();
    if (!cached) return;
    let cancelled = false;
    (async () => {
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({
            name: 'geolocation' as PermissionName,
          });
          if (cancelled) return;
          if (result.state === 'granted') {
            setCoords(cached);
            setStatus('granted');
          }
        } else {
          // No permissions API — trust the cache for the session.
          if (!cancelled) {
            setCoords(cached);
            setStatus('granted');
          }
        }
      } catch {
        /* swallow — leave state idle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(() => {
    if (!isGeolocationAvailable()) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        setStatus('granted');
        writeCachedCoords(next);
      },
      () => {
        setCoords(null);
        setStatus('denied');
        writeCachedCoords(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus('idle');
    writeCachedCoords(null);
  }, []);

  const setManualCoords = useCallback((next: UserCoords) => {
    setCoords(next);
    setStatus('granted');
    writeCachedCoords(next);
  }, []);

  return { status, coords, request, clear, setManualCoords };
}
