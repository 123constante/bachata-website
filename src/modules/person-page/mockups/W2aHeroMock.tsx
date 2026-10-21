// W2-A hero mockups. PROTOTYPE ONLY: reached at /__mock/w2a-hero/:view when VITE_MOCKS=true, never in
// production. Fixtures, not live reads. Real wall components (PeopleWall / DancersWall / DjsWall) and
// today's /dancers and /djs hero props, copied from origin/main. Views: d1 d2 d3 j1 j2 (hero v1) and h1 h2 h3 dj1 (hero v2: hero, CTA section, pills, wall).
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Camera, GraduationCap, Heart, Music, Sparkles, Star, UserCheck, UserPlus, Users } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { HOME_ANNOUNCE_HREF } from '@/lib/homeAnnounceBanner';
import type { PersonBadge } from '@/modules/person-page/badges';
import type { PersonRole } from '@/lib/searchEntities';
import { DancersWall, DjsWall } from '@/modules/person-page/wall/lists';
import { PeopleWall } from '@/modules/person-page/wall/PeopleWall';
import { djWallPerson, dancerWallPerson, filterWall, type WallPerson, type WallFilter } from '@/modules/person-page/wall/model';
import { WallTile } from '@/modules/person-page/wall/WallTile';
import { CHIP, FOCUS_RING, SIZE, TILE, WALL, type WallRole } from '@/modules/person-page/wall/tokens';

const HUES = [18, 160, 265, 40, 200, 330, 95, 350];
// A face-like data-URI "photo" so tiles look like photos (the real wall shows real photos).
const face = (i: number) => {
  const h = HUES[i % HUES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${h},45%,38%)"/><circle cx="50" cy="40" r="19" fill="hsl(${h},35%,72%)"/><ellipse cx="50" cy="92" rx="34" ry="30" fill="hsl(${h},35%,72%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
const NAMES = ['Sofia', 'Marco', 'Elena', 'Jamal', 'Chloe', 'Rafa', 'Ana', 'Dmitri', 'Lucia', 'Tomas', 'Priya', 'Hugo', 'Maya', 'Kofi',
  'Isabel', 'Leo', 'Nadia', 'Sam', 'Carmen', 'Ivan', 'Zoe', 'Mateo', 'Aisha', 'Oscar', 'Bea', 'Luca', 'Tia', 'Jonas'];
const rows = NAMES.map((n, i) => ({ id: `d${i}`, name: n, avatar_url: i % 5 === 3 ? null : face(i), nationality: ['GB', 'ES', 'IT', 'FR', null][i % 5] }));
const B = (id: string, roles: PersonBadge['roles']): PersonBadge => ({ id, roles, djName: null, djHasUpcoming: false, nextGigDate: null });
const badges = new Map<string, PersonBadge>(rows.map((r, i) => [r.id, B(r.id, i % 7 === 0 ? ['teacher', 'dancer'] : i % 4 === 0 ? ['dj', 'dancer'] : ['dancer'])]));
const djRows = NAMES.slice(0, 20).map((n, i) => ({
  id: `j${i}`, display_name: `DJ ${n}`, dj_name: `DJ ${n}`, first_name: null, surname: null, photo_url: i % 6 === 4 ? null : face(i + 3),
  nationality_code: ['GB', 'ES', null][i % 3], has_upcoming_gig: i % 3 === 0, next_gig_date: i % 3 === 0 ? '2099-10-23' : null,
}));
const djBadges = new Map<string, PersonBadge>(djRows.map((r) => [r.id, B(r.id, ['dj'])]));

const PRACTICE = '/practice-partners';
// The ONE real sign-up route (same as the Join row). /create-dancers-profile is unrouted.
const CREATE = HOME_ANNOUNCE_HREF;

// Today's hero widgets, JSX copied from origin/main src/pages/Dancers.tsx (navigate() became Link for the mock).
function TodayWidgets() {
  const base = 'cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border shadow-lg w-[140px] md:w-[160px] block no-underline';
  return (
    <div className="relative z-10 px-4 -mt-6 mb-16">
      <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
        <Link to={PRACTICE} className={`${base} border-primary/30`}>
          <Users className="w-7 h-7 md:w-9 md:h-9 mb-2 text-primary" aria-hidden="true" />
          <h3 className="font-bold text-xs md:text-sm text-foreground">Find Practice Partners</h3>
        </Link>
        <Link to={CREATE} className={`${base} border-festival-pink/30`}>
          <UserPlus className="w-7 h-7 md:w-9 md:h-9 mb-2 text-festival-pink" aria-hidden="true" />
          <h3 className="font-bold text-xs md:text-sm text-foreground">Create a Profile</h3>
        </Link>
        <Link to="/videographers" className={`${base} border-blue-500/30`}>
          <Camera className="w-7 h-7 md:w-9 md:h-9 mb-2 text-blue-400" aria-hidden="true" />
          <h3 className="font-bold text-xs md:text-sm text-foreground">Book a Photoshoot</h3>
        </Link>
      </div>
    </div>
  );
}

const TODAY_DANCERS_HERO = {
  emoji: '\u{1F483}', titleWhite: 'Meet', titleOrange: 'Dancers',
  floatingIcons: [Users, Star, Heart, Music, Sparkles, UserCheck], largeTitle: true,
};

// D1/D3: the slim header. Short cards: icon + label only, side by side.
function SlimHeader() {
  const card = 'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border px-2 text-[14px] font-bold no-underline';
  return (
    <div style={{ background: WALL.page, color: WALL.text }} className="px-3 pt-3" data-testid="slim-hero">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[30px] leading-none" aria-hidden="true">{'\u{1F483}'}</span>
        <h1 className="text-[28px] font-black leading-none">
          <span style={{ color: '#FFFFFF' }}>Meet </span>
          <span className="text-primary">Dancers</span>
        </h1>
      </div>
      <div className="flex gap-2">
        <Link to={PRACTICE} className={`${card} border-primary/50`} style={{ background: WALL.card, color: WALL.text }}>
          <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />Find Practice Partners
        </Link>
        <Link to={CREATE} className={`${card} border-festival-pink/50`} style={{ background: WALL.card, color: WALL.text }}>
          <UserPlus className="h-5 w-5 shrink-0 text-festival-pink" aria-hidden="true" />Create a Profile
        </Link>
      </div>
    </div>
  );
}

// The wall draws its own "Meet the dancers behind the nights" line; under the slim title that would say
// "Meet" twice, so the mock hides that h1 + sub-line (a production version would drop them via a prop).
const HIDE_WALL_TITLE = '.w2a-slim [data-testid="wall-root"] > h1, .w2a-slim [data-testid="wall-root"] > p { display: none; }';

function SlimWall({ withJoin }: { withJoin: boolean }) {
  const people = useMemo(() => rows.map((r) => dancerWallPerson(r, r.name, r.nationality, badges.get(r.id), false)), []);
  return (
    <div className="w2a-slim">
      <style>{HIDE_WALL_TITLE}</style>
      <SlimHeader />
      {withJoin ? (
        <DancersWall dancers={rows} getName={(d) => d.name} isLoading={false} badges={badges} badgesFailed={false} teacherPagesOpen={false} />
      ) : (
        <PeopleWall list="dancers" people={people} showTeachers={false} emptyAll={<p>No dancers</p>} />
      )}
    </div>
  );
}

// J1: today's /djs hero (props from origin/main) over a simple grid of the same fixtures.
function TodayDjs() {
  return (
    <GlobalLayout
      showSubheader={false}
      gradientPalette="dj"
      hero={{ emoji: '\u{1F3A7}', titleWhite: 'Bachata', titleOrange: 'DJs', subtitle: 'Discover the DJs behind the music — sensual, traditional, and everything in between.' }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-3 gap-2">
          {djRows.map((d) => (
            <div key={d.id} className="rounded-xl p-2 text-center">
              <img src={d.photo_url ?? face(0)} alt="" className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
              <p className="mb-0.5 text-sm font-bold leading-tight text-foreground">{d.display_name}</p>
              <p className="text-[12px] text-muted-foreground">DJ</p>
            </div>
          ))}
        </div>
      </div>
    </GlobalLayout>
  );
}


// ---------------------------------------------------------------------------------------------
// HERO v2 (h1 h2 h3 dj1): three sections = the hero (unchanged) / a call-to-action section with one
// card per role / filter pills + the face wall. Organisers are NOT on the real wall list: here they
// are MOCK fixtures so the Organisers pill has something to filter (flagged in the handover).
type Cta = { role: WallRole; title: string; line: string; href: string; Icon: typeof Users; live: string };
const CTAS: Cta[] = [
  { role: 'dancer', title: 'Find Practice Partners', line: 'Meet people to train with', href: PRACTICE, Icon: Users, live: 'real' },
  { role: 'dj', title: 'Join as a DJ', line: 'Get listed and get booked', href: '/auth?mode=signup&userType=dj', Icon: Music, live: 'real' },
  { role: 'teacher', title: 'Teach with us', line: 'Share your classes', href: '/auth?mode=signup&userType=teacher', Icon: GraduationCap, live: 'real route; teacher pages closed on prod' },
  { role: 'organiser', title: 'List your event', line: 'Promote your nights', href: '/auth?mode=signup&userType=organiser&returnTo=/account/o', Icon: Calendar, live: 'real' },
];
const CTA_LABEL = 'Join';
const FOCUS = FOCUS_RING;

function CtaCard({ c, wide }: { c: Cta; wide?: boolean }) {
  const t = TILE[c.role]; const chip = CHIP[c.role];
  const second = c.role === 'dancer';
  return (
    <div
      data-testid="cta-card" data-role={c.role}
      className={`flex flex-col rounded-2xl p-3 ${wide ? 'w-[200px] shrink-0 snap-start' : ''}`}
      style={{ background: t.bg, border: `1.5px solid ${t.edge}`, color: t.ink, minHeight: 124 }}
    >
      <Link to={c.href} className={`flex flex-1 flex-col no-underline ${FOCUS}`} style={{ color: t.ink }}>
        <span className="mb-2 flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: chip.bg, color: chip.text }}>
          <c.Icon aria-hidden="true" style={{ width: 20, height: 20 }} />
        </span>
        <span className="text-[15px] font-extrabold leading-tight">{c.title}</span>
        <span className="mt-0.5 text-[13px] leading-snug">{c.line}</span>
      </Link>
      {second ? (
        <Link to={CREATE} className={`mt-1 inline-flex items-center text-[13px] font-bold underline ${FOCUS}`} style={{ color: t.ink, minHeight: 36 }}>
          or Create a Profile
        </Link>
      ) : null}
    </div>
  );
}

function CtaSection({ layout }: { layout: 'grid' | 'swipe' }) {
  return (
    <section style={{ background: WALL.page, color: WALL.text }} className="px-3 pb-2 pt-4" aria-label={CTA_LABEL} data-testid="cta-section">
      <h2 className="mb-2 text-[16px] font-extrabold">Be part of the scene</h2>
      {layout === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">{CTAS.map((c) => <CtaCard key={c.role} c={c} />)}</div>
      ) : (
        <div className="-mx-3 flex scroll-px-3 snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1" data-testid="cta-swipe">
          {CTAS.map((c) => <CtaCard key={c.role} c={c} wide />)}
        </div>
      )}
    </section>
  );
}

// h3: ONE large card for the page's own role (Dancers) with both buttons + a slim link row for the rest.
function CtaSingle() {
  const t = TILE.dancer; const chip = CHIP.dancer;
  const btn = 'flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-2 text-[14px] font-bold no-underline';
  return (
    <section style={{ background: WALL.page, color: WALL.text }} className="px-3 pb-2 pt-4" data-testid="cta-section">
      <div data-testid="cta-card" data-role="dancer" className="rounded-2xl p-4" style={{ background: t.bg, border: `1.5px solid ${t.edge}`, color: t.ink }}>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: chip.bg, color: chip.text }}>
            <Users aria-hidden="true" style={{ width: 24, height: 24 }} />
          </span>
          <div>
            <p className="text-[18px] font-extrabold leading-tight">Dance with us</p>
            <p className="text-[13px]">Find people to train with, or get on the wall</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={PRACTICE} className={`${btn} ${FOCUS}`} style={{ background: chip.bg, color: chip.text }}><Users aria-hidden="true" style={{ width: 18, height: 18 }} />Find Practice Partners</Link>
          <Link to={CREATE} className={`${btn} ${FOCUS}`} style={{ background: WALL.page, color: WALL.text, border: `1.5px solid ${t.edge}` }}><UserPlus aria-hidden="true" style={{ width: 18, height: 18 }} />Create a Profile</Link>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-1 text-[13px]" data-testid="also-row" style={{ color: WALL.muted }}>
        <span>Also:</span>
        {CTAS.filter((c) => c.role !== 'dancer').map((c, i) => (
          <span key={c.role}>
            {i > 0 ? <span aria-hidden="true"> &middot; </span> : null}
            <Link to={c.href} className={`inline-flex items-center font-bold underline ${FOCUS}`} style={{ color: WALL.text, minHeight: 44 }}>
              {c.role === 'dj' ? 'DJs' : c.role === 'teacher' ? 'Teachers' : 'Organisers'}
            </Link>
          </span>
        ))}
      </p>
    </section>
  );
}

const ORGANISERS: WallPerson[] = ['Salsa Nights', 'Casa Bachata', 'Noche Latina', 'Ritmo Co', 'Baila Club', 'Sabor Events'].map((n, i) => ({
  id: `o${i}`, name: n, photo: i % 3 === 2 ? null : face(i + 5), flagCode: ['GB', 'ES', null][i % 3], href: null,
  tags: [{ role: 'organiser' as unknown as PersonRole, label: 'Organiser', href: null }],
  lead: 'organiser' as unknown as PersonRole, dateLabel: null, profileType: 'dancer' as const,
}));

type Pill = { k: WallFilter | 'organiser'; label: string };
const PILLS: Pill[] = [{ k: 'all', label: 'All' }, { k: 'dancer', label: 'Dancers' }, { k: 'dj', label: 'DJs' }, { k: 'teacher', label: 'Teachers' }, { k: 'organiser', label: 'Organisers' }];

function PillsAndWall({ list }: { list: 'dancers' | 'djs' }) {
  const [filter, setFilter] = useState<Pill['k']>('all');
  const base = useMemo(() => (list === 'dancers'
    ? rows.map((r) => dancerWallPerson(r, r.name, r.nationality, badges.get(r.id), true))
    : djRows.map((r) => djWallPerson(r, r.display_name, djBadges.get(r.id), true))), [list]);
  const people = useMemo(() => [...base, ...ORGANISERS], [base]);
  const shown = useMemo(
    () => (filter === 'organiser' ? ORGANISERS : filterWall(people, filter as WallFilter)),
    [people, filter],
  );
  return (
    <div style={{ background: WALL.page, color: WALL.text }} className="px-3 pb-6 pt-3" data-testid="wall-root">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show" data-testid="pill-row">
        {PILLS.map((f) => {
          const on = f.k === filter;
          return (
            <button
              key={f.k} type="button" aria-pressed={on} data-testid="wall-filter" className={FOCUS} onClick={() => setFilter(f.k)}
              style={{
                minHeight: SIZE.filterHeight, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999,
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                background: on ? WALL.text : 'transparent', color: on ? WALL.page : WALL.text, border: `1.5px solid ${on ? WALL.text : WALL.line}`,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${SIZE.columns}, minmax(0, 1fr))`, gap: SIZE.gap }} data-testid="wall-grid">
        {shown.map((p) => <WallTile key={p.id} person={p} list={list} />)}
      </div>
    </div>
  );
}

const TODAY_DJS_HERO = {
  emoji: '\u{1F3A7}', titleWhite: 'Bachata', titleOrange: 'DJs',
  subtitle: 'Discover the DJs behind the music — sensual, traditional, and everything in between.',
};

export default function W2aHeroMock() {
  const { view = 'd1' } = useParams();
  const [, force] = useState(0);
  void force;
  let body: ReactNode;
  switch (view) {
    case 'd2':
      body = (
        <GlobalLayout showSubheader={false} hero={TODAY_DANCERS_HERO}>
          <TodayWidgets />
          <DancersWall dancers={rows} getName={(d) => d.name} isLoading={false} badges={badges} badgesFailed={false} teacherPagesOpen={false} />
        </GlobalLayout>
      );
      break;
    case 'h1':
    case 'h2':
    case 'h3':
      body = (
        <GlobalLayout showSubheader={false} hero={TODAY_DANCERS_HERO}>
          {view === 'h3' ? <CtaSingle /> : <CtaSection layout={view === 'h2' ? 'swipe' : 'grid'} />}
          <PillsAndWall list="dancers" />
        </GlobalLayout>
      );
      break;
    case 'dj1':
      body = (
        <GlobalLayout showSubheader={false} gradientPalette="dj" hero={TODAY_DJS_HERO}>
          <CtaSection layout="grid" />
          <PillsAndWall list="djs" />
        </GlobalLayout>
      );
      break;
    case 'd3': body = <GlobalLayout showSubheader={false}><SlimWall withJoin /></GlobalLayout>; break;
    case 'j1': body = <TodayDjs />; break;
    case 'j2':
      body = (
        <GlobalLayout showSubheader={false} gradientPalette="dj">
          <DjsWall djs={djRows} isLoading={false} badges={djBadges} badgesFailed={false} teacherPagesOpen={false} />
        </GlobalLayout>
      );
      break;
    default: body = <GlobalLayout showSubheader={false}><SlimWall withJoin={false} /></GlobalLayout>;
  }
  return <>{body}</>;
}
