// W2-A hero mockups. PROTOTYPE ONLY: reached at /__mock/w2a-hero/:view when VITE_MOCKS=true, never in
// production. Fixtures, not live reads. Real wall components (PeopleWall / DancersWall / DjsWall) and
// today's /dancers and /djs hero props, copied from origin/main. Views: d1 d2 d3 j1 j2.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, Heart, Music, Sparkles, Star, UserCheck, UserPlus, Users } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { HOME_ANNOUNCE_HREF } from '@/lib/homeAnnounceBanner';
import type { PersonBadge } from '@/modules/person-page/badges';
import { DancersWall, DjsWall } from '@/modules/person-page/wall/lists';
import { PeopleWall } from '@/modules/person-page/wall/PeopleWall';
import { dancerWallPerson } from '@/modules/person-page/wall/model';
import { WALL } from '@/modules/person-page/wall/tokens';

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
