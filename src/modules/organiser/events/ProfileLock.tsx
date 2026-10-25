// C14 edit lock on the event screens (People arc A-WEB1a). While the person's
// profiles are not finished, the controls that shape the event (details,
// programme and line-up, flyer, add dates, pause / end / repeats, Go live) are
// off WITH the reason and the way to the profile wizard. Changing or cancelling
// one date, and starting a new draft, stay open. An admin is never locked, and
// loading or an error of the progress read never locks (profileLock).

import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { PROFILE_WIZARD_PATH, profileLock, useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { withReturnTo } from '@/modules/organiser/shared/goLiveCheck';
import { ORG_PATHS } from '../shell/paths';
import { OrganiserShell } from '../shell';
import { useEventWorkspace } from './eventsApi';
import type { EventWorkspace } from './eventModel';

export interface EventLock { locked: boolean; reason: string | null }

/** The label of the link under every lock reason. */
export const LOCK_LINK_LABEL = 'Complete your profile';

/** The event's lock: the progress of its organiser (the first linked page), read once and shared through the cache. */
export function useEventLock(ws: EventWorkspace | undefined): EventLock {
  const admin = useIsAdmin();
  const progress = useProfileProgress(ws?.organiserIds?.[0] ?? null);
  // An admin check still loading is not a lock either: the lock waits for both reads.
  return profileLock(admin.isPending ? undefined : progress.data, admin.isAdmin);
}

/** The same lock from a series id (a flow screen that has no workspace in hand). */
export function useSeriesLock(seriesId: string): EventLock {
  const ws = useEventWorkspace(seriesId);
  return useEventLock(ws.data);
}

/** The wizard, coming back to this event afterwards (D37: an explicit returnTo wins). */
export const lockHref = (seriesId: string) => withReturnTo(PROFILE_WIZARD_PATH, ORG_PATHS.event(seriesId));

const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left text-[15px]';

/**
 * The reason under a locked control (or a locked group: every control in it
 * points here with aria-describedby), and the one way out.
 */
export function LockNote({ reason, seriesId, testId }: { reason: string; seriesId: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <p id={`${testId}-reason`} className="px-[16px] pb-[4px] pt-[10px] text-[13px] text-[var(--mut)]" data-testid={`${testId}-reason`}>{reason}</p>
      <Link to={lockHref(seriesId)} data-testid={`${testId}-link`} className={cn(ROW, 'font-semibold text-[var(--gold)]')}>
        <span className="min-w-0 flex-1">{LOCK_LINK_LABEL}</span>
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
      </Link>
    </div>
  );
}

/** A control that is off because of the lock: reachable with Tab, read with its reason. */
export function LockedRow({ label, reasonId, testId, className }: { label: string; reasonId: string; testId: string; className?: string }) {
  return (
    <a role="link" aria-disabled="true" tabIndex={0} aria-describedby={reasonId} data-testid={testId} data-locked="true"
      className={cn(ROW, 'cursor-not-allowed text-[var(--mut)]', className)}>
      <span className="min-w-0 flex-1">{label}</span>
    </a>
  );
}

/** A whole flow screen reached by URL while locked: says why, offers the wizard and the way back. */
export function LockedScreen({ reason, seriesId, testId }: { reason: string; seriesId: string; testId: string }) {
  return (
    <div className="flex flex-col gap-3 p-3" data-testid={testId}>
      <div className="rounded-[12px] bg-[var(--card)]">
        <LockNote reason={reason} seriesId={seriesId} testId={`${testId}-note`} />
        <Link to={ORG_PATHS.event(seriesId)} data-testid={`${testId}-back`} className={cn(ROW, 'text-[var(--fg)]')}>
          <span className="min-w-0 flex-1">Back to the event</span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </Link>
      </div>
    </div>
  );
}

/**
 * A flow screen that shapes the event (add a date, the flyer, a line-up, the
 * programme), reached by its URL while locked: the reason instead of the screen.
 */
export function SeriesLockGate({ title, children }: { title: string; children: ReactNode }) {
  const { seriesId = '' } = useParams();
  const lock = useSeriesLock(seriesId);
  if (!seriesId || !lock.locked || !lock.reason) return <>{children}</>;
  return (
    <OrganiserShell title={title} back={{ to: ORG_PATHS.event(seriesId), label: 'Back' }} testId="org-page-locked">
      <LockedScreen reason={lock.reason} seriesId={seriesId} testId="org-flow-locked" />
    </OrganiserShell>
  );
}
