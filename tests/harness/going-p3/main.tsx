import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '@/index.css';
import '@/modules/organiser/theme.css';
import '@/modules/organiser/ui/ember.css';
import {
  GoingLoadState,
  GoingNightSummary,
  GoingPeopleSheet,
  organiserGoingStateFor,
  type GoingPerson,
  type MyEventGoingNight,
} from '@/modules/going';

/*
 * Scenes = component x state x shape. Night shapes follow the prod shape survey
 * (0 going, cancelled 0) plus the RPC's own rules (1, 9, 200, cancelled with
 * people, hidden page, photo, 21-char name). The frames copy C2's slot markup
 * (card, row, sheet) with the organiser tokens only.
 */
const NAMES = ['Ana', 'Leo', 'Mia', 'Sam', 'Kai', 'Zoe', 'Raf', 'In\u00e9s', 'Tom', 'Bea', 'Maximiliana-Josefinaa'];
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#7a2b52"/><circle cx="40" cy="32" r="14" fill="#ffb38a"/><rect x="18" y="52" width="44" height="28" rx="14" fill="#ffb38a"/></svg>');
const person = (i: number): GoingPerson => ({
  dancer_profile_id: i % 4 === 3 ? null : `d${i}`,
  first_name: NAMES[i % NAMES.length],
  photo_url: i % 5 === 1 ? PHOTO : null,
});
const night = (count: number, cancelled = false): MyEventGoingNight => ({
  occurrence_id: `o${count}`,
  occurrence_date: '2026-10-29',
  starts_at_local: '2026-10-29T21:00:00',
  is_cancelled: cancelled,
  going_count: count,
  people: Array.from({ length: Math.min(count, 200) }, (_, i) => person(i)),
});
const SHAPES: Record<string, MyEventGoingNight> = {
  'going-0': night(0),
  'going-1': night(1),
  'going-12': night(12),
  'going-200': night(200),
  cancelled: night(0, true),
  'cancelled-had-3': night(3, true),
};

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)' };

const HomeHero = ({ n }: { n: MyEventGoingNight }) => (
  <div style={{ ...card, padding: 16 }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold-fg)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Next up &middot; Thursday, 9 PM
    </div>
    <div style={{ fontSize: 24, fontWeight: 600, margin: '8px 0 6px', color: 'var(--fg)' }}>Latin Lovers Bachata</div>
    <GoingNightSummary night={n} variant="compact" onOpen={() => {}} />
  </div>
);

const SheetRow = ({ n }: { n: MyEventGoingNight }) => (
  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 16px' }}>
    <div style={{ flexShrink: 0, whiteSpace: 'nowrap', fontWeight: 500, fontSize: 16, color: 'var(--fg)' }}>Who&rsquo;s going</div>
    <div style={{ flex: 1 }} />
    <GoingNightSummary night={n} variant="compact" onOpen={() => {}} />
  </div>
);

const StatsRow = ({ n }: { n: MyEventGoingNight }) => (
  <div style={{ ...card, padding: '10px 16px' }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <div style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 16, color: 'var(--fg)' }}>Latin Lovers Bachata</div>
      <div style={{ fontSize: 14, color: 'var(--mut)', whiteSpace: 'nowrap' }}>148 views</div>
    </div>
    <GoingNightSummary night={n} variant="compact" onOpen={() => {}} />
  </div>
);

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'var(--scrim, rgba(0,0,0,0.6))' }}>
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', overflow: 'hidden',
        background: 'var(--sheet)', borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0', padding: '10px 16px 28px',
      }}
    >
      <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--line-strong)', margin: '0 auto 12px' }} />
      {children}
    </div>
  </div>
);

const v = (f: Parameters<typeof organiserGoingStateFor>[0]) => organiserGoingStateFor(f);
const LOAD: Record<string, ReturnType<typeof v>> = {
  loading: v({ enabled: true, signedIn: true, status: 'pending' }),
  error: v({ enabled: true, signedIn: true, status: 'error', error: 'network' }),
  'not-signed-in': v({ enabled: true, signedIn: false, status: 'pending' }),
  'not-found': v({ enabled: true, signedIn: true, status: 'error', error: 'not_found' }),
  'not-organiser': v({ enabled: true, signedIn: true, status: 'error', error: 'not_organiser' }),
};

const scene = new URLSearchParams(location.search).get('scene') ?? 'summary-home--going-12';
const [kind, shape] = scene.split('--');

const body = (() => {
  if (kind === 'load') return <div style={{ ...card, padding: '6px 16px' }}><GoingLoadState view={LOAD[shape]} onRetry={() => {}} onSignIn={() => {}} /></div>;
  const n = SHAPES[shape];
  if (kind === 'summary-home') return <HomeHero n={n} />;
  if (kind === 'summary-row') return <SheetRow n={n} />;
  if (kind === 'summary-stats') return <StatsRow n={n} />;
  if (kind === 'sheet') return <Sheet><GoingPeopleSheet night={n} /></Sheet>;
  return <p>unknown scene</p>;
})();

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="org-theme ember-world" style={{ minHeight: '100vh', padding: 16, boxSizing: 'border-box' }} data-scene={scene}>
      {body}
    </div>
  </MemoryRouter>,
);
