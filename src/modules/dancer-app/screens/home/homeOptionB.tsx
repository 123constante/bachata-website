import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Eye, Share2, UserRound } from 'lucide-react';
import { Card } from '@/modules/organiser/ui';
import { flags } from '@/lib/featureFlags';
import { useHasRaffleWin } from './homeRaffleWin';
import { DANCER_TABS } from '../../shell/routes';
import { buttonStyle } from '../nights/nightsStyles';
import type { MyDancerEdit } from '../../api/types';
import { PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import { LINK_GHOST_SM } from '../blocks';
import { DANCER_ONBOARDING_V3_ENABLED } from '../onboarding/onboardingV3Flag';
import ShineCard, { SHINE_ADD_PATH } from './ShineCard';
import ProgressRingCard from './ProgressRingCard';
import { linkPrefill } from '../onboarding/bioModel';
import { NEXT_LABEL, profileProgress } from '../onboarding/profileProgress';
import { PAGE_PATH, attendedLabel, homeBView, homeCView, morePlansLabel, type HomeFocus, type ShareRow } from './homeFocus';
import type { HeroNight } from './homeParts';

const nightsPath = DANCER_TABS.find((t) => t.id === 'nights')?.path ?? '/app';

const Kicker = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 14, fontWeight: 700 }} className="da-muted">{children}</span>
);

const ROW_STYLE = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 64, color: 'inherit', textDecoration: 'none' } as const;
const Body = ({ title, line }: { title: string; line?: string }) => (
  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
    <b style={{ fontSize: 16 }}>{title}</b>
    {line && <span className="da-muted" style={{ fontSize: 14 }}>{line}</span>}
  </span>
);
const Icon = ({ children }: { children: ReactNode }) => (
  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none' }}>{children}</span>
);

/** The focus card's inside: profile step, next night or find events (one copy, B and C). */
const FocusBody = ({ f }: { f: HomeFocus }) => (
  <div style={{ display: 'grid', gap: 12 }} data-focus={f.kind}>
    {f.kind === 'profile' && (
      <>
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }} data-testid="home-b-progress">{f.done} of {f.total}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>to finish your profile</h2>
        <div role="img" aria-label={`${f.done} of ${f.total} done`} style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: f.total }, (_, i) => (
            <i key={i} data-on={i < f.done} style={{ flex: 1, height: 6, borderRadius: 3, background: i < f.done ? 'var(--da-accent)' : 'var(--da-border)' }} />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 15 }}>{f.lead}</p>
        <Link to={f.cta.path} state={{ focus: f.cta.focus }} data-testid="home-b-cta" style={{ ...buttonStyle, textAlign: 'center' }}>{f.cta.label}</Link>
      </>
    )}
    {f.kind === 'night' && (
      <>
        <Kicker>Next night</Kicker>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{f.night.name}</h2>
        <p style={{ margin: 0, fontSize: 15 }}>{f.night.inDays}{f.night.place ? `, ${f.night.place}` : ''}</p>
        {f.night.tag && <Kicker>{f.night.tag}</Kicker>}
        <Link to={f.night.href ?? nightsPath} data-testid="home-b-cta" style={{ ...buttonStyle, textAlign: 'center' }}>Open the night</Link>
      </>
    )}
    {f.kind === 'find' && !DANCER_ONBOARDING_V3_ENABLED && (
      <>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Nothing planned yet</h2>
        <p style={{ margin: 0, fontSize: 15 }}>Tap Going on a night and it shows up here.</p>
        <Link to={nightsPath} data-testid="home-b-cta" style={{ ...buttonStyle, textAlign: 'center' }}>Find events this week</Link>
      </>
    )}
  </div>
);

/** "Share my page": a link, or off with the reason (homeFocus.homeBView decides). */
const ShareRowView = ({ share }: { share: ShareRow }) =>
  share.enabled ? (
    <Link to={PAGE_PATH} className="da-tap" style={ROW_STYLE} data-testid="home-b-share">
      <Icon><Share2 aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
      <Body title="Share my page" line="Send your page to a dance partner." />
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  ) : (
    <div style={ROW_STYLE} aria-disabled="true" data-testid="home-b-share-off">
      <Icon><Share2 aria-hidden="true" className="h-[20px] w-[20px] text-[var(--mut)]" /></Icon>
      <Body title="Share my page" line={share.reason ?? ''} />
    </div>
  );

/** Loading card: the same slot the focus card fills, with the way out in words. */
export const HomeBLoading = () => (
  <Card variant="padded" testId="home-b-loading" aria-busy="true" role="status">
    <p style={{ margin: 0, fontSize: 15 }}>Loading your home&hellip; If it takes long, check your connection.</p>
  </Card>
);

/** Error card: Try again and Message us, so the person always has a next move. */
export const HomeBError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <Card variant="padded" role="alert" testId="home-b-error">
    <div style={{ display: 'grid', gap: 12 }}>
      <b style={{ fontSize: 18 }}>{message}</b>
      <p className="da-muted" style={{ margin: 0, fontSize: 15 }}>Nothing is lost. Check your connection and try again.</p>
      <button type="button" className="da-tap" data-testid="home-b-retry" style={{ ...buttonStyle, border: 0 }} onClick={onRetry}>Try again</button>
      <MessageUsLink message={PROFILE_HELP_MESSAGE} className={LINK_GHOST_SM} />
    </div>
  </Card>
);

/**
 * Option B body below the page chrome: ONE focus card (profile step, else next night, else
 * find events), then up to three rows (Share, more plans, nights attended).
 * `focusLoading` = the going feed is still on its way and the profile is complete.
 */
export const HomeBView = ({ profile, went, night, goingCount, focusLoading }: {
  profile: MyDancerEdit;
  went: number | null;
  night: HeroNight | null;
  goingCount: number | null;
  focusLoading: boolean;
}) => {
  const v = homeBView(profile, { went, night, goingCount });
  const f = v.focus;
  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid={`home-b-${v.base.kind}`}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{v.base.title}</h1>

      {focusLoading && v.base.kind === 'complete' ? (
        <HomeBLoading />
      ) : (
        !(DANCER_ONBOARDING_V3_ENABLED && f.kind === 'find') && (
          <Card variant="padded" testId="home-b-focus">
            <FocusBody f={f} />
          </Card>
        )
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}><Kicker>Also</Kicker></h3>
        <Card variant="padded" testId="home-b-list">
          <div style={{ margin: -12, display: 'grid' }}>
            <ShareRowView share={v.share} />
            {v.morePlans !== null && (
              <Link to={nightsPath} className="da-tap" style={ROW_STYLE} data-testid="home-b-more-plans">
                <Body title={morePlansLabel(v.morePlans)} />
                <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
              </Link>
            )}
            {v.attended.kind === 'count' && (
              <div style={ROW_STYLE} data-testid="home-b-attended">
                <Icon><CalendarDays aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
                <Body title={attendedLabel(v.attended.n)} line="Nights you went to." />
              </div>
            )}
            {v.attended.kind === 'first' && (
              <Link to={nightsPath} className="da-tap" style={ROW_STYLE} data-testid="home-b-first-night">
                <Icon><CalendarDays aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
                <Body title="Your first night out" line="Nights you attend are counted here." />
                <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

/** Layout C section head: the prototype's `.head2` (11px, uppercase, .08em, bold, muted). */
const Head = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <h2
    data-testid={testId}
    className="da-muted"
    style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}
  >
    {children}
  </h2>
);

/**
 * Layout C Home (brief dancer-layout-c-s1, DANCER_LAYOUT_C_ENABLED): h1, then the alerts, then
 * three jobs. Get ready = the profile-steps card (gone once the four steps are done). Go out =
 * Rate last night, Your ticket, the night / find card, N more plans, nights attended (LAST, not
 * tappable). Be found = Share my page, Preview my page. Same mapping as Option B (homeCView).
 * `rate` / `ticket` are null when their switch is off; `alerts` = the paused banner + linked notice.
 */
type HomeCProps = {
  profile: MyDancerEdit;
  went: number | null;
  night: HeroNight | null;
  goingCount: number | null;
  focusLoading: boolean;
  alerts: ReactNode;
  rate: ReactNode;
  ticket: ReactNode;
};

/** Flag `homeGoldenLook` off = today's view untouched; on = the prototype A look (below). */
export const HomeCView = (props: HomeCProps) => (flags.homeGoldenLook ? <HomeCGolden {...props} /> : <HomeCClassic {...props} />);

const HomeCClassic = ({ profile, went, night, goingCount, focusLoading, alerts, rate, ticket }: HomeCProps) => {
  const v = homeCView(profile, { went, night, goingCount });
  const complete = v.base.kind === 'complete';
  const goOutLoading = focusLoading && complete;
  const rows = v.morePlans !== null || v.attended.kind !== 'hidden';
  // Onboarding v8: "Nothing planned yet" is gone, so a find focus draws no card (and no gap).
  const goCard = v.goOut && !(DANCER_ONBOARDING_V3_ENABLED && v.goOut.kind === 'find') ? v.goOut : null;
  const goOut = Boolean(rate) || Boolean(ticket) || goOutLoading || goCard !== null || rows;
  const progress = DANCER_ONBOARDING_V3_ENABLED
    ? profileProgress({ photo: Boolean(profile.avatar_url), startedYear: profile.dance_started_year, styles: profile.favorite_styles, partnerAnswered: profile.looking_for_partner != null, bio: profile.bio ?? '', link: linkPrefill(profile) })
    : null;
  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid={`home-c-${v.base.kind}`}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{v.base.title}</h1>
      {alerts}

      {progress && (
        <>
          <Head testId="home-c-head-ready">Get ready</Head>
          <ProgressRingCard progress={progress} requiredPath={v.ready?.cta.path ?? '/app/welcome'} />
        </>
      )}
      {!progress && v.ready && (
        <>
          <Head testId="home-c-head-ready">Get ready</Head>
          <Card variant="padded" testId="home-b-focus">
            <FocusBody f={v.ready} />
          </Card>
        </>
      )}

      {goOut && <Head testId="home-c-head-go">Go out</Head>}
      {rate}
      {ticket}
      {goOutLoading ? (
        <HomeBLoading />
      ) : (
        goCard && (
          <Card variant="padded" testId="home-c-go-card">
            <FocusBody f={goCard} />
          </Card>
        )
      )}
      {rows && (
        <Card variant="padded" testId="home-c-go-rows">
          <div style={{ margin: -12, display: 'grid' }}>
            {v.morePlans !== null && (
              <Link to={nightsPath} className="da-tap" style={ROW_STYLE} data-testid="home-b-more-plans">
                <Body title={morePlansLabel(v.morePlans)} />
                <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
              </Link>
            )}
            {v.attended.kind === 'count' && (
              <div style={ROW_STYLE} data-testid="home-b-attended">
                <Icon><CalendarDays aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
                <Body title={attendedLabel(v.attended.n)} line="Nights you went to." />
              </div>
            )}
            {v.attended.kind === 'first' && (
              <div style={ROW_STYLE} data-testid="home-b-first-night">
                <Icon><CalendarDays aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
                <Body title="Your first night out" line="Nights you attend are counted here." />
              </div>
            )}
          </div>
        </Card>
      )}

      {DANCER_ONBOARDING_V3_ENABLED && <ShineCard profile={profile} />}

      <Head testId="home-c-head-found">Be found</Head>
      <Card variant="padded" testId="home-c-found">
        <div style={{ margin: -12, display: 'grid' }}>
          <ShareRowView share={v.share} />
          <Link to={PAGE_PATH} className="da-tap" style={ROW_STYLE} data-testid="home-c-preview">
            <Icon><Eye aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
            <Body title="Preview my page" line="How it looks and who visited." />
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
          </Link>
        </div>
      </Card>
    </div>
  );
};

/* ---- Golden look (flag homeGoldenLook): prototype A rows and headings, same items and taps ---- */
const HGL_CSS = `
.hgl{--card:#27201c;--ink:#f7eee7;--muted:#bba99e;--line:#3d322c;--brand:#ff6f5e;--brand-ink:#2a0f0a;--gold:#f2b544;--ok:#62d39d;--ok-soft:#173326;--shadow:0 10px 30px rgba(0,0,0,.45);--bg:var(--da-bg);color:var(--ink)}
.hgl-box,.hgl-ticket>section,.hgl [data-testid="rate-nudge"],.hgl [data-testid="home-shine"]>div{background:var(--card)!important;border:1px solid var(--line)!important;border-radius:16px!important;box-shadow:none!important;padding:10px 12px;min-height:60px;margin-bottom:8px;color:var(--ink)}
.hgl [data-testid="home-shine-add"]{background:var(--brand)!important;color:var(--brand-ink)!important;border-radius:14px!important;font-weight:800;min-height:44px}`;
const TONES = ['linear-gradient(135deg,#4b2a6b,#dc4433)', 'linear-gradient(135deg,#0f5d6b,#f2b544)'];
const ROW_BOX = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', minHeight: 60, marginBottom: 8, color: 'var(--ink)', textDecoration: 'none', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 } as const;

const Sec = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <h2 data-testid={testId} style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '26px 2px 8px' }}>{children}</h2>
);

/** A `.row`: tone square + icon, title over line, optional coral go word. A link when `to` is set. */
const GRow = ({ testId, to, state, tone, icon, title, line, go }: {
  testId: string; to?: string; state?: unknown; tone: 0 | 1; icon: ReactNode; title: string; line?: string; go?: string;
}) => {
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none', color: '#fff', background: TONES[tone] }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{title}</b>
        {line && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{line}</span>}
      </span>
      {go && <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--brand)', fontSize: 13 }}>{go}</span>}
    </>
  );
  return to ? <Link to={to} state={state} className="da-tap" style={ROW_BOX} data-testid={testId}>{inner}</Link> : <div style={ROW_BOX} data-testid={testId}>{inner}</div>;
};

const HomeCGolden = ({ profile, went, night, goingCount, focusLoading, alerts, rate, ticket }: HomeCProps) => {
  const hasWin = useHasRaffleWin();
  const v = homeCView(profile, { went, night, goingCount });
  const complete = v.base.kind === 'complete';
  const goOutLoading = focusLoading && complete;
  const rows = v.morePlans !== null || v.attended.kind !== 'hidden';
  const goCard = v.goOut && !(DANCER_ONBOARDING_V3_ENABLED && v.goOut.kind === 'find') ? v.goOut : null;
  const goOut = Boolean(rate) || Boolean(ticket) || goOutLoading || goCard !== null || rows;
  const progress = DANCER_ONBOARDING_V3_ENABLED
    ? profileProgress({ photo: Boolean(profile.avatar_url), startedYear: profile.dance_started_year, styles: profile.favorite_styles, partnerAnswered: profile.looking_for_partner != null, bio: profile.bio ?? '', link: linkPrefill(profile) })
    : null;
  const requiredPath = v.ready?.cta.path ?? '/app/welcome';
  const nextPath = progress?.next && (progress.next === 'bio' || progress.next === 'link') ? SHINE_ADD_PATH : requiredPath;
  const nightIcon = <CalendarDays aria-hidden="true" className="h-[20px] w-[20px]" />;
  return (
    <div className="hgl" data-testid={`home-c-${v.base.kind}`}>
      <style>{HGL_CSS}</style>
      {!hasWin && <h1 data-testid="home-c-title" style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, fontWeight: 800, margin: '0 0 8px', overflowWrap: 'anywhere' }}>{v.base.title}</h1>}
      {alerts}

      {progress && (
        <>
          <Sec testId="home-c-head-ready">Get ready</Sec>
          {progress.pct === 100
            ? <GRow testId="home-ring-win" tone={0} icon={<UserRound aria-hidden="true" className="h-[20px] w-[20px]" />} title="Profile complete" line="You are fully visible to dancers and organisers." />
            : <GRow testId="home-ring" to={nextPath} tone={0} icon={<UserRound aria-hidden="true" className="h-[20px] w-[20px]" />} title="Your profile" line={`${progress.pct}%${progress.next ? ` \u00b7 Next: ${NEXT_LABEL[progress.next]}` : ''}`} go="Finish" />}
        </>
      )}
      {!progress && v.ready && (
        <>
          <Sec testId="home-c-head-ready">Get ready</Sec>
          <div className="hgl-box" data-testid="home-b-focus"><FocusBody f={v.ready} /></div>
        </>
      )}

      {goOut && <Sec testId="home-c-head-go">Go out</Sec>}
      {rate}
      {ticket && <div className="hgl-ticket">{ticket}</div>}
      {goOutLoading ? (
        <HomeBLoading />
      ) : (
        goCard && <div className="hgl-box" data-testid="home-c-go-card"><FocusBody f={goCard} /></div>
      )}
      {rows && (
        <div data-testid="home-c-go-rows">
          {v.morePlans !== null && <GRow testId="home-b-more-plans" to={nightsPath} tone={1} icon={nightIcon} title={morePlansLabel(v.morePlans)} go="View" />}
          {v.attended.kind === 'count' && <GRow testId="home-b-attended" tone={0} icon={nightIcon} title={attendedLabel(v.attended.n)} line="Nights you went to." />}
          {v.attended.kind === 'first' && <GRow testId="home-b-first-night" tone={0} icon={nightIcon} title="Your first night out" line="Nights you attend are counted here." />}
        </div>
      )}

      {DANCER_ONBOARDING_V3_ENABLED && <ShineCard profile={profile} />}

      <Sec testId="home-c-head-found">Be found</Sec>
      <div data-testid="home-c-found">
        {v.share.enabled
          ? <GRow testId="home-b-share" to={PAGE_PATH} tone={0} icon={<Share2 aria-hidden="true" className="h-[20px] w-[20px]" />} title="Share my page" line="Send your page to a dance partner." go="Share" />
          : <div aria-disabled="true" style={{ ...ROW_BOX, opacity: 0.7 }} data-testid="home-b-share-off"><b style={{ fontSize: 14 }}>Share my page</b><span style={{ fontSize: 13, color: 'var(--muted)' }}>{v.share.reason ?? ''}</span></div>}
        <GRow testId="home-c-preview" to={PAGE_PATH} tone={1} icon={<Eye aria-hidden="true" className="h-[20px] w-[20px]" />} title="Preview my page" line="How it looks and who visited." go="View" />
      </div>
    </div>
  );
};
