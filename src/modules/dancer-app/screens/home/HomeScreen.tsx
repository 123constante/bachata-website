import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/modules/organiser/ui';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { londonTodayKey } from '@/lib/londonDate';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { DancerApiError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';
import { DANCER_TABS } from '../../shell/routes';
import { buttonStyle, gradientBg, linkStyle } from '../nights/nightsStyles';
import { RateNudge } from './RateNudge';
import type { HomeGoing } from './homeParts';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { HomeAView } from './homeOptionA';
import { ClaimCard } from './claimCard';
import { useMyNumbers } from '../../api/useMyNumbers';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '../../copy/sharedCopy';

const path = (id: 'nights' | 'me' | 'options') => DANCER_TABS.find((t) => t.id === id)?.path ?? '/app';

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
  const [noticeGone, setNoticeGone] = useState(() => (user?.id ? readFlag('local', noticeKey(user.id)) : true));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!profile.is_active && (
        <Card variant="padded" role="status" data-testid="paused-banner" className="border-[var(--danger)]">
          <b>{HIDDEN_STATE_LINE}</b>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            <Link to={APP_ACCOUNT_SETTINGS_PATH} style={linkStyle}>{SHOW_AGAIN_LABEL}</Link>
          </p>
        </Card>
      )}

      {profile.linked_from_admin && !noticeGone && user?.id && (
        <Card variant="padded" testId="linked-notice">
          <b>We&rsquo;ve linked your profile</b>
          <p style={{ margin: '4px 0 8px', fontSize: 14 }}>A profile made for you by the Bachata Calendar team is now yours. Have a look and make it right.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={path('me')} style={buttonStyle}>Check my profile</Link>
            <button
              type="button"
              className="da-tap"
              style={{ background: 'none', border: '1px solid var(--da-border)', borderRadius: 12, color: 'var(--da-text)', padding: '0 16px', fontWeight: 700 }}
              onClick={() => {
                writeFlag('local', noticeKey(user.id));
                setNoticeGone(true);
              }}
            >
              Got it
            </button>
          </div>
        </Card>
      )}

      <HomeAView
        profile={profile}
        went={numbers.data ? numbers.data.went : null}
        night={going?.hero ?? null}
        goingKnown={going !== null && !going.isLoading && !going.isError}
      />

      <RateNudge candidates={going?.nudge ?? []} todayKey={going?.todayKey || londonTodayKey()} />
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

  // Once per session, signed-in only (trackDancerEvent is a no-op signed out).
  useEffect(() => {
    if (readFlag('session', ENTERED_KEY)) return;
    if (trackDancerEvent('dancer_app_entered', { source: 'home' })) writeFlag('session', ENTERED_KEY);
  }, []);

  let body: ReactNode;
  if (profile.isLoading) {
    body = <Message>Loading your home&hellip;</Message>;
  } else if (profile.error instanceof DancerApiError && profile.error.code === 'no_profile') {
    // D4 (unclaimed): the claim button re-runs the existing no-arg claim; its answer is drawn in the card.
    // Walk bug 1: never trapped here -- NoProfileWayOut gives Account settings, Sign out, the organiser area.
    body = (
      <div style={{ display: 'grid', gap: 12 }}>
        <ClaimCard />
        <NoProfileWayOut />
      </div>
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
