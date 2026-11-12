import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { Card } from '@/modules/organiser/ui';
import { DANCER_TABS } from '../../shell/routes';
import { buttonStyle } from '../nights/nightsStyles';
import type { MyDancerEdit } from '../../api/types';
import { EDIT_PATH } from '../../api/nextStep';
import { PREVIEW_ROW_LINE, attendedView, homeView } from './homeModel';
import type { HeroNight } from './homeParts';

const tab = (id: 'nights' | 'me') => DANCER_TABS.find((t) => t.id === id)?.path ?? '/app';
const PAGE_PATH = '/app/page';

const Kicker = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 14, fontWeight: 700 }} className="da-muted">{children}</span>
);

const Row = ({ to, title, line, testId }: { to: string; title: string; line: string; testId: string }) => (
  <Link to={to} data-testid={testId} className="da-tap" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 64, color: 'inherit', textDecoration: 'none' }}>
    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <b style={{ fontSize: 16 }}>{title}</b>
      <span className="da-muted" style={{ fontSize: 14 }}>{line}</span>
    </span>
    <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
  </Link>
);

const List = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <Card variant="padded" testId={testId}><div style={{ margin: -12, display: 'grid' }}>{children}</div></Card>
);

/** D1 / D2 / D3 body below the greeting. `going` = the next night going ahead (null = none or still loading). */
export const HomeAView = ({ profile, went, night, goingKnown }: { profile: MyDancerEdit; went: number | null; night: HeroNight | null; goingKnown: boolean }) => {
  const v = homeView(profile);
  const attended = attendedView(went);
  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid={`home-a-${v.kind}`}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, overflowWrap: 'anywhere' }}>{v.title}</h1>
        {v.subtitle && <p className="da-muted" style={{ margin: '4px 0 0', fontSize: 15 }}>{v.subtitle}</p>}
      </div>

      {v.kind !== 'complete' && v.next && (
        <Card variant="padded" testId="home-main-card">
          <div style={{ display: 'grid', gap: 14 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Finish your profile</h2>
            {v.kind === 'unfinished' ? (
              <ul data-testid="home-checklist" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
                {v.checklist.map((c) => (
                  <li key={c.step} data-done={c.done} data-next={c.next} style={{ display: 'flex', gap: 10, minHeight: 32, alignItems: 'center', fontSize: 15, fontWeight: c.next ? 700 : 400 }}>
                    {c.done ? <Check aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> : <Circle aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />}
                    <span>{c.noun}{c.done ? <span className="da-sr-only" style={{ position: 'absolute', left: -9999 }}> done</span> : null}{c.next ? ' \u00B7 next' : ''}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="da-muted" style={{ margin: 0, fontSize: 15 }}>Four quick steps: your name, your city, how you dance, a photo.</p>
            )}
            <Link to={v.next.path} state={{ focus: v.next.focus }} data-testid="home-next-step" style={{ ...buttonStyle, textAlign: 'center' }}>{v.next.label}</Link>
          </div>
        </Card>
      )}

      {v.kind === 'complete' && attended.kind === 'count' && (
        <Card variant="padded" testId="home-attended">
          <div style={{ display: 'grid', gap: 8 }}>
            <Kicker>Nights attended</Kicker>
            <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }} data-testid="home-attended-n">{attended.n}</span>
          </div>
        </Card>
      )}
      {v.kind === 'complete' && attended.kind === 'empty' && (
        <Card variant="padded" testId="home-attended-empty">
          <div style={{ display: 'grid', gap: 10 }}>
            <Kicker>Nights attended</Kicker>
            <b style={{ fontSize: 18 }}>Find your first night</b>
            <p className="da-muted" style={{ margin: 0, fontSize: 15 }}>Say you are going to a night, then go.</p>
            {/* The ONE call to action on a calm first screen: no second Browse / Find a night below. */}
            <Link to={tab('nights')} data-testid="home-find-night" style={{ ...buttonStyle, textAlign: 'center' }}>Browse this week</Link>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {v.kind === 'complete' && night && <h3 style={{ margin: 0 }}><Kicker>Going</Kicker></h3>}
        <List testId="home-list">
          <Row to={PAGE_PATH} title="Preview your page" line={v.kind === 'complete' ? 'See what other dancers see' : PREVIEW_ROW_LINE(v)} testId="home-row-preview" />
          {v.kind !== 'complete' && (
            <Row
              to={tab('nights')}
              title="Going"
              line={night ? `${night.name}, ${night.inDays}` : goingKnown ? 'Nothing booked yet.' : 'Your booked nights.'}
              testId="home-row-going"
            />
          )}
          {v.kind === 'complete' && night && <Row to={tab('nights')} title={night.name} line={`${night.inDays}${night.place ? ', ' + night.place : ''}`} testId="home-row-going" />}
          {v.kind === 'complete' && !night && goingKnown && attended.kind !== 'empty' && (
            <Row to={tab('nights')} title="Nothing booked yet" line="Find a night" testId="home-row-going-empty" />
          )}
          {v.kind !== 'new' && <Row to={EDIT_PATH} title="Edit profile" line={v.kind === 'complete' ? 'Everything, any time' : 'Everything else, any time'} testId="home-row-edit" />}
        </List>
      </div>

      {v.kind === 'new' && <p className="da-muted" style={{ margin: 0, fontSize: 14 }} data-testid="home-numbers-note">Your numbers start after your first night out.</p>}
      {/* no PREVIEW/numbers tap row: D1 "Your numbers" is plain text (fix 1) */}
    </div>
  );
};
