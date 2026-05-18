import { useCallback, useEffect, useRef, useState } from 'react';
import { captureException } from '@/lib/sentry';

export type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied';

export type GeolocationDenialReason =
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'insecure'
  | null;

export type Coords = { lat: number; lng: number };

type UseGeolocationResult = {
  status: GeolocationStatus;
  reason: GeolocationDenialReason;
  coords: Coords | null;
  request: () => void;
  clear: () => void;
};

const STORAGE_KEY = 'tonight.userCoords';

const readCached = (): Coords | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Coords>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
};

const writeCached = (coords: Coords | null) => {
  try {
    if (coords) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage can throw in private modes; ignore */
  }
};

const mapReason = (
  code: number | undefined | null,
): GeolocationDenialReason => {
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return 'denied';
};

export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [reason, setReason] = useState<GeolocationDenialReason>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const highAccuracyRetried = useRef(false);

  useEffect(() => {
    const cached = readCached();
    if (cached) {
      setCoords(cached);
      setStatus('granted');
    }
  }, []);

  const request = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('denied');
      setReason('unavailable');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('denied');
      setReason('insecure');
      return;
    }
    setStatus('loading');
    setReason(null);
    highAccuracyRetried.current = false;

    const onSuccess = (pos: GeolocationPosition) => {
      const next: Coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setCoords(next);
      setStatus('granted');
      setReason(null);
      writeCached(next);
    };

    const onError = (err: GeolocationPositionError) => {
      const mapped = mapReason(err?.code);
      // Retry once with high-accuracy on timeout. The low-accuracy Wi-Fi/IP
      // path often stalls indoors on cellular; GPS is slower but more
      // reliable as a one-shot fallback.
      if (err?.code === 3 && !highAccuracyRetried.current) {
        highAccuracyRetried.current = true;
        navigator.geolocation.getCurrentPosition(onSuccess, onError, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        return;
      }
      captureException(err, {
        feature: 'tonight.gps',
        code: err?.code ?? null,
        message: err?.message,
        mappedReason: mapped,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        isSecureContext: window.isSecureContext,
      });
      setCoords(null);
      setStatus('denied');
      setReason(mapped);
      writeCached(null);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 300000,
    });
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus('idle');
    setReason(null);
    writeCached(null);
  }, []);

  return { status, reason, coords, request, clear };
}
