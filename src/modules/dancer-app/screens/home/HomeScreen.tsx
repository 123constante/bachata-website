import { Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/modules/organiser/ui';
import { ChevronRight } from 'lucide-react';
import { LINK_GHOST_SM, TILE_CLASS } from '../blocks';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { londonTodayKey } from '@/lib/londonDate';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { DancerApiError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';
import { DANCER_TABS } from '../../shell/routes';
import { goingTileValue } from '../../api/numbersModel';
import { buttonStyle, gradientBg, linkStyle } from '../nights/nightsStyles';
import { greeting } from './homeCopy';
import { nextStepLine } from '../../api/nextStep';
import { RateNudge } from './RateNudge';
import { GoingTileView, HomeHero, type HomeGoing } from './homeParts';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { LineupPeople } from './LineupPeople';
import { NumbersTiles } from './NumbersTiles';
import { PartnerTile } from './PartnerTile';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { CoupleArt } from '../art';
import { Avatar, MessageUsLink } from '../me/ui';
import { NO_PROFILE_MESSAGE } from '../../api/messageUs';
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

const Ring = ({ pct }: { pct: number }) => (
  <div
    role="img"
    aria-label={`Profile strength ${pct}%`}
    className="da-strength-ring"
    style={{ width: 56, height: 56, flex: '0 0 auto', '--da-pct': `${pct}%` } as CSSProperties}
  >
    <span style={{ width: 46, height: 46, fontSize: 14 }}>{pct}%</span>
  </div>
);

const Message = ({ children }: { children: ReactNode }) => (
  <Card variant="padded" role="status" testId="home-message">{children}</Card>
);

/** `going` null = the going switch is off: nothing going renders and no going RPC runs. */
const HomeBodyView = ({ profile, going }: { profile: MyDancerEdit; going: HomeGoing | null }) => {
  const { user } = useAuth();
  const goingCount = going?.goingCount ?? null;
  const name = profile.first_name || profile.display_name || 'there';
  const [noticeGone, setNoticeGone] = useState(() => (user?.id ? readFlag('local', noticeKey(user.id)) : true));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="da-ring-avatar"><Avatar profile={profile} size={52} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="da-muted" style={{ fontSize: 14 }}>{greeting(new Date().getHours())}</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{name}</h1>
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

      <HomeHero
        night={going?.hero ?? null}
        isLoading={going?.isLoading ?? false}
        isError={going?.isError ?? false}
        retry={going?.retry}
        how={going?.how ?? null}
      />

      <RateNudge candidates={going?.nudge ?? []} todayKey={going?.todayKey || londonTodayKey()} />

      {/* Review S4: one column; strength is the prototype's full-width row (ring, title, next step, chevron). */}
      <div style={{ display: 'grid', gap: 10 }}>
        <Link to={path('me')} data-testid="tile-strength" className={`${TILE_CLASS} da-tile-rose da-strength-row`}>
          <Ring pct={profile.strength.pct} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', fontSize: 15 }}>Profile strength</b>
            <span style={{ display: 'block', fontSize: 13 }} data-testid="tile-strength-next">
              {nextStepLine(profile)}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </Link>
        {going && (
          <GoingTileView
            value={goingTileValue({ isLoading: going.isLoading, goingCount })}
            isNumber={goingCount !== null}
            help={going.tileHelp}
          />
        )}
      </div>

      <NumbersTiles
        hasPhoto={Boolean(profile.avatar_url)}
        going={goingCount !== null && going?.tagGoing ? { label: going.tagGoing, value: goingCount, went: going.wentCount ?? 0 } : null}
        goingOn={going !== null}
      />

      <PartnerTile />

      <LineupPeople />
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
    body = (
      <Message>
        <CoupleArt />
        <b>We can&rsquo;t find a dancer profile for you yet.</b>
        <p style={{ margin: '4px 0 8px', fontSize: 14 }}>Message us and we&rsquo;ll sort it out.</p>
        {/* The control itself, not a pointer to Options: Options cannot load without a profile either. */}
        <MessageUsLink message={NO_PROFILE_MESSAGE} className={LINK_GHOST_SM} />
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
