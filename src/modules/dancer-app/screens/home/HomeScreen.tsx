import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/modules/organiser/ui';
import { LINK_GHOST_SM } from '../blocks';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { londonTodayKey } from '@/lib/londonDate';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { DancerApiError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';
import { DANCER_TABS } from '../../shell/routes';
import { gradientBg, linkStyle } from '../nights/nightsStyles';
import { greeting } from './homeCopy';
import { useMyNumbers } from '../../api/useMyNumbers';
import { HomeMainCard } from './HomeMainCard';
import { ClaimYourPage } from './ClaimYourPage';
import { RateNudge } from './RateNudge';
import type { HomeGoing } from './homeParts';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { CoupleArt } from '../art';
import { Avatar, MessageUsLink } from '../me/ui';
import { NO_PROFILE_MESSAGE } from '../../api/messageUs';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '../../copy/sharedCopy';


const ENTERED_KEY = 'dancer_app_entered';
const noticeKey = (userId: string) => `dancer_app_linked_notice_dismissed:${userId}`;

const readFlag = (store: 'session' | 'local', key: string): boolean => {
  try {
    return (store === 'session' ? sessionStorage : localStorage).getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (store: 'session' | 'local', key: string) => {
  try {
    (store === 'session' ? sessionStorage : localStorage).setItem(key, '1');
  } catch {
    /* storage blocked: the notice shows again, the event may fire again */
  }
};

// Home's going data (hero night, rate nudge, Upcoming nights tile, the strip's Going cell)
// comes from ONE lazy feed, homeGoing.tsx, mounted only while the going switch is on: the
// CalendarGoingFeed pattern. Switch off, the /app/* first load carries none of the going
// module (perf-budgets.json, dancer-app row).
const HomeGoingFeed = lazyWithRetry(() => import('./homeGoing'));

/** The going feed's chunk is on its way: the same as the list loading. */
const HOME_GOING_LOADING: HomeGoing = {
  isLoading: true,
  isError: false,
  retry: () => undefined,
  hero: null,
  how: null,
  nudge: [],
  todayKey: '',
  goingCount: null,
  wentCount: null,
  tagGoing: null,
  tileHelp: null,
};

/**
 * The hero is painted with the dancer gradient token pair (audit M14). White on
 * --da-gradient-from / --da-gradient-to is pinned at >= 4.5:1 by the theme test;
 * the old coral start (--da-accent) was 2.55:1 under 13-14px text.
 */
export const HERO_BACKGROUND = gradientBg;

const Message = ({ children }: { children: ReactNode }) => (
  <Card variant="padded" role="status" testId="home-message">{children}</Card>
);

/** `going` null = the going switch is off: nothing going renders and no going RPC runs. */
const HomeBodyView = ({ profile, going }: { profile: MyDancerEdit; going: HomeGoing | null }) => {
  const { user } = useAuth();
  const numbers = useMyNumbers();
  const name = profile.first_name || profile.display_name || '';
  // The "we linked your profile" line shows ONCE (inside the main card, no buttons), then the flag hides it.
  const [showLinkedNote] = useState(() => !!profile.linked_from_admin && !!user?.id && !readFlag('local', noticeKey(user.id)));
  useEffect(() => {
    if (showLinkedNote && user?.id) writeFlag('local', noticeKey(user.id));
  }, [showLinkedNote, user?.id]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="da-ring-avatar"><Avatar profile={profile} size={52} /></span>
        <div style={{ minWidth: 0 }}>
          {name && <div className="da-muted" style={{ fontSize: 14 }}>{greeting(new Date().getHours())}</div>}
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{name || 'Welcome'}</h1>
        </div>
      </div>

      {!profile.is_active && (
        <Card variant="padded" role="status" data-testid="paused-banner" className="border-[var(--danger)]">
          <b>{HIDDEN_STATE_LINE}</b>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            <Link to={APP_ACCOUNT_SETTINGS_PATH} style={linkStyle}>{SHOW_AGAIN_LABEL}</Link>
          </p>
        </Card>
      )}

      <RateNudge candidates={going?.nudge ?? []} todayKey={going?.todayKey || londonTodayKey()} />

      {/* Calm first screen (admin #1534): ONE main card, nothing under it. Nights attended lives in the card. */}
      <HomeMainCard profile={profile} nightsWent={numbers.data?.went ?? null} linkedNote={showLinkedNote} />
    </div>
  );
};

const HomeBody = ({ profile }: { profile: MyDancerEdit }) => {
  // Read at render (not at import): the switch is the only thing deciding, and tests flip it.
  const on = GOING_CHECKIN_ENABLED;
  const [going, setGoing] = useState<HomeGoing>(HOME_GOING_LOADING);
  return (
    <>
      {on && (
        <Suspense fallback={null}>
          <HomeGoingFeed onGoing={setGoing} />
        </Suspense>
      )}
      <HomeBodyView profile={profile} going={on ? going : null} />
    </>
  );
};

const HomeScreen = () => {
  const profile = useMyDancerEdit({ staleTime: 60_000 });
  const [claimDismissed, setClaimDismissed] = useState(false);
  const noProfile = profile.error instanceof DancerApiError && profile.error.code === 'no_profile';
  // A claim refetch flips the query back to loading; keep the claim card mounted through it so its result copy survives.
  const [wasNoProfile, setWasNoProfile] = useState(false);
  if (noProfile && !wasNoProfile) setWasNoProfile(true);

  // Once per session, signed-in only (trackDancerEvent is a no-op signed out).
  useEffect(() => {
    if (readFlag('session', ENTERED_KEY)) return;
    if (trackDancerEvent('dancer_app_entered', { source: 'home' })) writeFlag('session', ENTERED_KEY);
  }, []);

  let body: ReactNode;
  if (profile.isLoading && !wasNoProfile) {
    body = <Message>Loading your home&hellip;</Message>;
  } else if (noProfile || (profile.isLoading && wasNoProfile)) {
    body = (
      <Message>
        <CoupleArt />
        <ClaimYourPage onLinked={async () => !!(await profile.refetch()).data} onDismiss={() => setClaimDismissed(true)} dismissed={claimDismissed} />
        {/* Walk bug 1: never trapped here -- Account settings, Sign out, and the organiser area for an organiser. */}
        <NoProfileWayOut />
      </Message>
    );
  } else if (profile.error || !profile.data) {
    body = (
      <Message>
        <b>{profile.error instanceof Error ? profile.error.message : 'We couldn\u2019t load your home.'}</b>
        <div>
          <button type="button" className="da-tap" style={{ ...linkStyle, background: 'none', border: 0 }} onClick={() => void profile.refetch()}>Try again</button>
        </div>
      </Message>
    );
  } else {
    body = <HomeBody profile={profile.data} />;
  }
  return <div data-testid="dancer-screen-home">{body}</div>;
};

export default HomeScreen;
