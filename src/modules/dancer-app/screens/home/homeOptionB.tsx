import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Share2 } from 'lucide-react';
import { Card } from '@/modules/organiser/ui';
import { DANCER_TABS } from '../../shell/routes';
import { buttonStyle } from '../nights/nightsStyles';
import type { MyDancerEdit } from '../../api/types';
import { PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import { LINK_GHOST_SM } from '../blocks';
import { PAGE_PATH, attendedLabel, homeBView, morePlansLabel } from './homeFocus';
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
        <Card variant="padded" testId="home-b-focus">
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
            {f.kind === 'find' && (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Nothing planned yet</h2>
                <p style={{ margin: 0, fontSize: 15 }}>Tap Going on a night and it shows up here.</p>
                <Link to={nightsPath} data-testid="home-b-cta" style={{ ...buttonStyle, textAlign: 'center' }}>Find events this week</Link>
              </>
            )}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}><Kicker>Also</Kicker></h3>
        <Card variant="padded" testId="home-b-list">
          <div style={{ margin: -12, display: 'grid' }}>
            {v.share.enabled ? (
              <Link to={PAGE_PATH} className="da-tap" style={ROW_STYLE} data-testid="home-b-share">
                <Icon><Share2 aria-hidden="true" className="h-[20px] w-[20px]" /></Icon>
                <Body title="Share my page" line="Send your page to a dance partner." />
                <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
              </Link>
            ) : (
              <div style={ROW_STYLE} aria-disabled="true" data-testid="home-b-share-off">
                <Icon><Share2 aria-hidden="true" className="h-[20px] w-[20px] text-[var(--mut)]" /></Icon>
                <Body title="Share my page" line={v.share.reason ?? ''} />
              </div>
            )}
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
