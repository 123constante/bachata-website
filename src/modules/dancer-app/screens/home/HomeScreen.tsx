import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { useAuth } from '@/hooks/useAuth';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { DancerApiError } from '../../api/errors';
import type { MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';
import { DANCER_TABS } from '../../shell/routes';
import { inDaysLabel, nextNight, nudgeCandidates, placeAndTime, shortDate, statusLabel } from '../nights/nightsModel';
import { GOING_TILE_HELP, goingTileValue } from '../../api/numbersModel';
import { useMyNumbers } from '../../api/useMyNumbers';
import { buttonStyle, gradientBg, linkStyle } from '../nights/nightsStyles';
import { useBrowseHref } from '../nights/useBrowseHref';
import { useMyNights } from '../nights/useMyNights';
import { greeting } from './homeCopy';
import { nextStepLine } from '../../api/nextStep';
import { RateNudge } from './RateNudge';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { WhatsOn } from './WhatsOn';
import { NumbersTiles } from './NumbersTiles';
import { PartnerTile } from './PartnerTile';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { Avatar, MessageUsLink } from '../me/ui';
import { NO_PROFILE_MESSAGE } from '../../api/messageUs';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '../../copy/sharedCopy';
import { BROWSE_EVENTS_LABEL } from './homeCopy';

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

const tile: CSSProperties = { minHeight: 112, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--da-text)', textDecoration: 'none' };
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
    style={{ width: 74, height: 74, borderRadius: '50%', background: `conic-gradient(#fff ${pct * 3.6}deg, rgba(255,255,255,.25) 0)`, display: 'grid', placeItems: 'center' }}
  >
    <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--da-gradient-from)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16 }}>{pct}%</div>
  </div>
);

const Message = ({ children }: { children: ReactNode }) => (
  <div className="da-card" role="status" data-testid="home-message">{children}</div>
);

const HomeBody = ({ profile }: { profile: MyDancerEdit }) => {
  const { user } = useAuth();
  const { nights, todayKey, isError, isLoading } = useMyNights();
  const browseHref = useBrowseHref(profile.based_city_id);
  const hero = nextNight(nights.upcoming);
  // F7 (owner decision): the tile and the strip read ONE number from ONE source,
  // my_dancer_stats_v1.nights_going_upcoming (scheduled nights only, so a cancelled
  // night is not counted). The nights list above stays as it is.
  const numbers = useMyNumbers();
  const going = goingTileValue(numbers);
  const name = profile.first_name || profile.display_name || 'there';
  const [noticeGone, setNoticeGone] = useState(() => (user?.id ? readFlag('local', noticeKey(user.id)) : true));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar profile={profile} size={52} />
        <div style={{ minWidth: 0 }}>
          <div className="da-muted" style={{ fontSize: 14 }}>{greeting(new Date().getHours())}</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{name}</h1>
        </div>
      </div>

      {!profile.is_active && (
        <div className="da-card" role="status" data-testid="paused-banner" style={{ borderColor: 'var(--da-danger)' }}>
          <b>{HIDDEN_STATE_LINE}</b>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            <Link to={APP_ACCOUNT_SETTINGS_PATH} style={linkStyle}>{SHOW_AGAIN_LABEL}</Link>
          </p>
        </div>
      )}

      {profile.linked_from_admin && !noticeGone && user?.id && (
        <div className="da-card" data-testid="linked-notice">
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
        </div>
      )}

      <section
        data-testid="home-hero"
        style={{ borderRadius: 16, padding: 14, color: 'var(--da-on-gradient)', background: HERO_BACKGROUND }}
      >
        {hero && hero.date ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Your next night &middot; {inDaysLabel(hero.date, todayKey)}</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, margin: '4px 0', overflowWrap: 'anywhere' }}>{hero.name}</div>
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              {[shortDate(hero.date), placeAndTime(hero)].filter(Boolean).join(' \u00B7 ')} &middot; {statusLabel(hero)}
            </div>
            <a href={hero.href} style={{ ...buttonStyle, background: '#fff', color: '#1A0F0B' }}>See event</a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Your next night</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 10px' }}>
              {isLoading ? 'Loading\u2026' : isError ? 'We couldn\u2019t load your nights.' : 'No upcoming night yet.'}
            </div>
            <a href={browseHref} style={{ ...buttonStyle, background: '#fff', color: '#1A0F0B' }}>{BROWSE_EVENTS_LABEL}</a>
          </>
        )}
      </section>

      <RateNudge candidates={nudgeCandidates(nights.past, todayKey)} todayKey={todayKey} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Link to={path('me')} data-testid="tile-strength" style={{ ...tile, background: gradientBg, color: 'var(--da-on-gradient)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ring pct={profile.strength.pct} />
          </div>
          <span style={{ fontSize: 13 }} data-testid="tile-strength-next">
            {nextStepLine(profile)}
          </span>
        </Link>
        {GOING_CHECKIN_ENABLED && (
        <Link to={path('nights')} data-testid="tile-going" className="da-card" style={{ ...tile }}>
          <b style={{ fontSize: 14 }}>Upcoming nights</b>
          {/* A number is big; the loading / failed words are body size so they fit the tile. */}
          <span style={{ fontSize: numbers.data ? 28 : 14, fontWeight: 800, overflowWrap: 'anywhere' }} data-testid="tile-going-count">{going}</span>
          <span className="da-muted" style={{ fontSize: 13 }}>{GOING_TILE_HELP}</span>
        </Link>
        )}
      </div>

      <NumbersTiles hasPhoto={Boolean(profile.avatar_url)} />

      <PartnerTile />

      <WhatsOn cityId={profile.based_city_id} />
    </div>
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
        <b>We can&rsquo;t find a dancer profile for you yet.</b>
        <p style={{ margin: '4px 0 8px', fontSize: 14 }}>Message us and we&rsquo;ll sort it out.</p>
        {/* The control itself, not a pointer to Options: Options cannot load without a profile either. */}
        <MessageUsLink message={NO_PROFILE_MESSAGE} style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', minHeight: 44 }} />
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
