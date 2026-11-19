// Shared geolocation denial copy + retry/iOS helpers.
//
// Both the /tonight NearMeCta and the home-map LocateControl / MapLocateButton
// render the same denial guidance and decide "Try again" visibility the same
// way, so the copy + predicates live here once. Kept ASCII-only (FUSE mount).

import type { GeolocationDenialReason } from '@/hooks/useGeolocation';

/** True on iPhone/iPad/iPod, where geolocation permission sticks per-site and
 *  the recovery path is the iOS Settings app (not a browser re-prompt). */
export const isIOSUserAgent = (): boolean =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/.test(navigator.userAgent || '');

/** Human-facing reason copy for a denied/failed geolocation request. */
export function denialCopy(
  reason: GeolocationDenialReason,
  onIOS: boolean,
  standalone = false,
): string {
  if (reason === 'dismissed') return 'Not now. Tap Near me whenever you want distances.';
  if (reason === 'timeout') return "Couldn't find you in time. Try again, or step outside for a better signal.";
  if (reason === 'denied' && standalone) {
    return onIOS
      ? 'Location is off for this app. Open Settings > Privacy & Security > Location Services, find this app and set it to While Using.'
      : 'Location is off for this app. Open your phone settings, then Apps, find this app, and allow Location.';
  }
  if (reason === 'insecure') {
    return 'Location needs a secure connection.';
  }
  if (onIOS) {
    return "Location is off for this site. Open Settings > Apps > Safari > Location and set this site to Allow, then refresh.";
  }
  return "Couldn't get your location. Check your browser's site permissions.";
}

/** True when the site was added to the home screen and opened as an app. */
export const isStandaloneDisplay = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** "Try again" is shown iff a retry can plausibly succeed. PERMISSION_DENIED on
 *  iOS Safari sticks per-site and re-issuing getCurrentPosition fails instantly;
 *  an insecure context is unfixable client-side. timeout/unavailable can recover
 *  (better signal, GPS warm-up), and non-iOS browsers allow a re-prompt. */
export function showRetry(
  reason: GeolocationDenialReason,
  onIOS: boolean,
): boolean {
  return !(reason === 'denied' && onIOS) && reason !== 'insecure';
}
