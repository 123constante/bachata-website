import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  HOME_ANNOUNCE_BANNER_ON,
  HOME_ANNOUNCE_CTA,
  HOME_ANNOUNCE_HREF,
  HOME_ANNOUNCE_STORAGE_KEY,
  HOME_ANNOUNCE_TEXT,
} from '@/lib/homeAnnounceBanner';

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(HOME_ANNOUNCE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

// Dismissed for this visit even when storage is blocked (reads can throw).
let dismissedThisVisit = false;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const isDismissed = () => dismissedThisVisit || readDismissed();

// `enabled` is a test seam; production passes nothing and the constant decides.
const HomeAnnounceBanner = ({ enabled = HOME_ANNOUNCE_BANNER_ON }: { enabled?: boolean }) => {
  // Server snapshot is "dismissed" so the server and first client render match (nothing); storage is read after hydration.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  if (!enabled || dismissed) return null;

  const dismiss = () => {
    dismissedThisVisit = true;
    try {
      window.localStorage.setItem(HOME_ANNOUNCE_STORAGE_KEY, '1');
    } catch {
      /* storage blocked: still hidden for this visit */
    }
    listeners.forEach((l) => l());
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      data-testid="home-announce-banner"
      className="mx-auto flex w-full max-w-screen-xl items-center gap-2 bg-primary px-3 py-2 text-primary-foreground"
    >
      <p className="min-w-0 flex-1 text-sm font-medium">{HOME_ANNOUNCE_TEXT}</p>
      <Link
        to={HOME_ANNOUNCE_HREF}
        className="inline-flex h-[44px] shrink-0 items-center rounded-md bg-black px-3 text-sm font-semibold text-white"
      >
        {HOME_ANNOUNCE_CTA}
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default HomeAnnounceBanner;
