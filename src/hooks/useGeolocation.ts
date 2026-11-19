import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { flags } from '@/lib/featureFlags';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { readFix, writeFix } from '@/lib/geo/nearMeFix';

export type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied';

export type GeolocationDenialReason =
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'insecure'
  | 'dismissed'
  | null;

export type Coords = { lat: number; lng: number };

type UseGeolocationResult = {
  status: GeolocationStatus;
  reason: GeolocationDenialReason;
  coords: Coords | null;
  /** Metres, from the last fix (null: unknown). Only filled when nearMe is ON. */
  accuracy: number | null;
  /** False once a few attempts have failed: the chip stops offering "try again". */
  canRetry: boolean;
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

const MAX_ATTEMPTS = 3;

/** Chrome reports a dismissed prompt as PERMISSION_DENIED with this message; it is "Not now", not a refusal. */
const mapReason = (
  code: number | undefined | null,
  message?: string,
): GeolocationDenialReason => {
  if (code === 1 && flags.nearMe && /dismiss/i.test(message || '')) return 'dismissed';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return 'denied';
};

const GeoContext = createContext<UseGeolocationResult | null>(null);
export const GeolocationContext = GeoContext;

/** One shared instance when a GeolocationProvider is mounted (nearMe ON); otherwise each caller
 *  keeps its own state, exactly as before. */
export function useGeolocation(): UseGeolocationResult {
  const shared = useContext(GeoContext);
  const own = useGeolocationState(shared === null);
  return shared ?? own;
}

export function useGeolocationState(active = true): UseGeolocationResult {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const attempts = useRef(0);
  const [canRetry, setCanRetry] = useState(true);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [reason, setReason] = useState<GeolocationDenialReason>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const highAccuracyRetried = useRef(false);
  // Bumped by clear(): a request still in flight when the reader cancels must not land later.
  const generation = useRef(0);

  const statusRef = useRef<GeolocationStatus>('idle');
  statusRef.current = status;

  useEffect(() => {
    if (!active) return;
    if (!flags.nearMe) {
      const cached = readCached();
      if (cached) {
        setCoords(cached);
        setStatus('granted');
      }
      return;
    }
    // Restore a fix under 30 minutes old, but only if the browser ALREADY says granted: never a prompt.
    let live = true;
    const fix = readFix();
    if (fix) {
      void navigator.permissions
        ?.query({ name: 'geolocation' as PermissionName })
        .then((s) => {
          if (!live || s.state !== 'granted') return;
          setCoords({ lat: fix.lat, lng: fix.lng });
          setAccuracy(fix.accuracy);
          setStatus('granted');
        })
        .catch(() => undefined);
    }
    // ONE permission-change listener for the whole app (this runs once, in the provider).
    let perm: PermissionStatus | null = null;
    const onPermChange = () => {
      if (!perm) return;
      if (perm.state === 'denied') {
        generation.current += 1;
        setCoords(null);
        setAccuracy(null);
        setStatus('denied');
        setReason('denied');
        writeFix(null);
      } else if (statusRef.current === 'denied') {
        // Allowed again in settings: offer a fresh tap, never auto-request.
        attempts.current = 0;
        setCanRetry(true);
        setStatus('idle');
        setReason(null);
      }
    };
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((p) => {
          if (!live) return;
          perm = p;
          p.addEventListener?.('change', onPermChange);
        })
        .catch(() => undefined);
    }
    // Safari fallback: older versions never fire "change", so look again when the tab returns.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (perm) return;
      if (statusRef.current === 'denied') {
        attempts.current = 0;
        setCanRetry(true);
        setStatus('idle');
        setReason(null);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      perm?.removeEventListener?.('change', onPermChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active]);

  const request = useCallback(() => {
    // A tap while a fix is already being fetched must not stack a second request.
    if (flags.nearMe && statusRef.current === 'loading') return;
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
    if (flags.nearMe) {
      if (attempts.current >= MAX_ATTEMPTS) {
        setCanRetry(false);
        return;
      }
      attempts.current += 1;
      statusRef.current = 'loading';
    }
    setStatus('loading');
    setReason(null);
    highAccuracyRetried.current = false;
    const gen = ++generation.current;

    const onSuccess = (pos: GeolocationPosition) => {
      if (gen !== generation.current) return;
      const next: Coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setCoords(next);
      setStatus('granted');
      setReason(null);
      if (flags.nearMe) {
        attempts.current = 0;
        setCanRetry(true);
        setAccuracy(pos.coords.accuracy ?? null);
        writeFix({ ...next, accuracy: pos.coords.accuracy ?? 0, ts: Date.now() });
      } else {
        writeCached(next);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (gen !== generation.current) return;
      const mapped = mapReason(err?.code, err?.message);
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
      // PERMISSION_DENIED (code 1) is user choice -- not an error worth reporting.
      // Only the reason is counted (a dataLayer push); no coordinates ever leave the device.
      if (err?.code !== 1) {
        trackAnalyticsEvent('geo_error', { reason: mapped ?? 'unknown' });
      }
      setCoords(null);
      setAccuracy(null);
      setStatus('denied');
      setReason(mapped);
      if (flags.nearMe) {
        if (attempts.current >= MAX_ATTEMPTS) setCanRetry(false);
        writeFix(null);
      } else {
        writeCached(null);
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 300000,
    });
  }, []);

  const clear = useCallback(() => {
    generation.current += 1;
    setCoords(null);
    setStatus('idle');
    setReason(null);
    setAccuracy(null);
    if (flags.nearMe) {
      statusRef.current = 'idle';
      writeFix(null);
    } else {
      writeCached(null);
    }
  }, []);

  return { status, reason, coords, accuracy, canRetry, request, clear };
}
