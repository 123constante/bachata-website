import type { HomeOrganiser, OrganiserHome } from '../../shared/selfServeApi';
import { londonTodayKey } from '@/lib/londonDate';
import { nextUpOf, rowsOf, type P3Row } from './home';
import type { ShareCode } from './analyticsV2';

/** The one fact "this page has a live dated event" (an ended series does not count). Used by Stats and the share card. */
export function liveEventOf(home: OrganiserHome, org: HomeOrganiser): P3Row | null {
  const today = home.today || londonTodayKey();
  return nextUpOf(rowsOf({ ...home, today, organisers: [org] }));
}

export type ShareState = 'loading' | 'off' | 'noCode' | 'noEvent' | 'ready';

/** What the share link can do right now; Copy is enabled only when this is 'ready'. */
export function shareStateOf(code: { pending: boolean; data: ShareCode | undefined }, live: P3Row | null): ShareState {
  if (code.pending) return 'loading';
  if (code.data?.disabled) return 'off';
  if (!code.data?.code) return 'noCode';
  return live ? 'ready' : 'noEvent';
}

export const SHARE_REASONS: Record<Exclude<ShareState, 'ready'>, string> = {
  off: 'Your link is switched off. Ask the team.',
  noCode: 'Your link isn’t ready yet. Try again shortly.',
  noEvent: 'Add an event to get a link',
  loading: 'Getting your link…',
};
