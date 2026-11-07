// PROTOTYPE (search v7, S8): /__mock/s8/:view/:fixture/:role?  view = opt1 | opt2 | search | lineup.
// Dev or VITE_MOCKS=true only. REAL prod data (read-only); the organiser line is a labelled sample.
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useParams } from 'react-router-dom';
import { Share2, User } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { resolvePublicName } from '@/lib/publicName';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { PublicDancerPageV2 } from '@/modules/dancer-app/public-page/PublicDancerPageV2';
import { buildPublicDancerPage, shareDancerPage, type PublicDancerPageModel } from '@/modules/dancer-app/public-page/model';
import { ROLE_LABEL, type PersonRole } from '../personRoles';
import { FIXTURES, type FixtureKey } from './fixtures';
import {
  TEAL, PersonCard, OrganiserLine, DancerBody, DjBody, TeacherBody, leadRole, orderRoles, useMockData, useDjGigs, type Data,
} from './MockPersonPage';

const firstPhoto = (raw: unknown) => (Array.isArray(raw) ? (raw.find(Boolean) as string | undefined) ?? null : typeof raw === 'string' && raw.trim() ? raw.trim() : null);

/** Real name (person card, dancer, teacher). */
const realName = (d: Data) => {
  const v = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
  return v?.displayName ?? d.person.name ?? 'Bachata Calendar profile';
};
/** Stage name (DJ things only); null when there is no DJ row or it equals the real name. */
const stageName = (d: Data) => {
  const s = d.dj ? resolvePublicName(d.dj as never) : null;
  return s && s !== realName(d) ? s : null;
};
const dancerModel = (d: Data): PublicDancerPageModel | null => {
  const v = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
  return v ? buildPublicDancerPage(v, d.extras, []) : null;
};
/** THIN RULE: a dancer room exists only when it has something to say. */
const dancerHasContent = (m: PublicDancerPageModel | null) =>
  !!m && !!(m.facts.dancing || m.facts.level || m.facts.style || m.stamp || m.practice || m.highlights.length || m.songs.length || m.goingNext);

function useRoom(fixture: FixtureKey) {
  const { data, error } = useMockData(fixture);
  const gigs = useDjGigs(FIXTURES[fixture].id);
  // THIN RULE: a teacher room needs a real teacher read; an empty read hides the room (no "Teacher not found").
  const [teacherOk, setTeacherOk] = useState<boolean | null>(null);
  useEffect(() => {
    const rpc = supabase.rpc.bind(supabase) as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
    rpc('get_public_teacher_detail_v1', { p_entity_id: FIXTURES[fixture].id }).then(({ data: t }) => setTeacherOk(Array.isArray(t) ? t.length > 0 : !!t));
  }, [fixture]);
  const ready = data && teacherOk !== null ? { ...data, roles: data.roles.filter((r) => r !== 'teacher' || teacherOk) } : null;
  return { data: ready, error, gigs };
}

// ------------------------------------------------------------------ Option 1
function RoomHeader({ role, d }: { role: PersonRole; d: Data }) {
  const stage = role === 'dj' ? stageName(d) : null;
  const label = role === 'dj' ? (stage ? `DJ · ${stage}` : 'DJ') : role === 'teacher' ? 'Teaches' : 'Dances';
  return <h2 className="mb-2 mt-6 text-[15px] font-extrabold uppercase tracking-[2px]" style={{ color: TEAL.accent }}>{label}</h2>;
}

function Opt1({ fixture }: { fixture: FixtureKey }) {
  const { data: d, error, gigs } = useRoom(fixture);
  const fx = FIXTURES[fixture];
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!d) return <Skeleton className="h-64 w-full rounded-xl" />;
  const ordered = orderRoles(d.roles, leadRole(d.roles, gigs.upcoming.length));
  const dm = dancerModel(d);
  const hidden: string[] = [];
  const rooms = ordered.filter((r) => {
    if (r === 'dancer' && !dancerHasContent(dm)) { hidden.push('dancer room (nothing to show)'); return false; }
    return true;
  });
  return (
    <>
      <PersonCard d={d} slug={fx.slug} />
      {rooms.map((r) => (
        <section key={r} aria-label={ROLE_LABEL[r]} data-testid={`s8-room-${r}`}>
          {rooms.length > 1 ? <RoomHeader role={r} d={d} /> : <div className="mt-3" />}
          {r === 'dj' ? <DjBody d={d} /> : r === 'teacher' ? <TeacherBody id={d.person.id} /> : <DancerBody d={d} slug={fx.slug} />}
        </section>
      ))}
      <OrganiserLine show={fx.organiser} />
      <p data-hidden={hidden.join(',')} className="sr-only">{hidden.join(', ')}</p>
    </>
  );
}

// ------------------------------------------------------------------ Option 2
function LinkBar({ fixture, d, current, roles }: { fixture: FixtureKey; d: Data; current: PersonRole; roles: PersonRole[] }) {
  const others = roles.filter((r) => r !== current);
  if (others.length === 0) return null;
  const stage = stageName(d);
  const text = (r: PersonRole) => (r === 'dj' ? (stage ? `DJ as ${stage}` : 'DJ') : r === 'teacher' ? 'Teaches' : 'Dances');
  return (
    <nav aria-label="Also" data-testid="s8-linkbar" className="mb-3 flex flex-wrap items-center gap-2 text-[14px]" style={{ color: TEAL.muted }}>
      <span>Also:</span>
      {others.map((r) => (
        <Link key={r} to={`/__mock/s8/opt2/${fixture}/${r}`} className="inline-flex items-center rounded-full px-3 font-bold" style={{ minHeight: 44, border: `1px solid ${TEAL.border}`, color: TEAL.accent, background: TEAL.page }}>
          {text(r)}
        </Link>
      ))}
    </nav>
  );
}

function ShareBtn({ title, path }: { title: string; path: string }) {
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    const env = { share: typeof navigator !== 'undefined' && navigator.share ? (x: { title?: string; url?: string }) => navigator.share(x) : undefined,
      writeText: typeof navigator !== 'undefined' && navigator.clipboard ? (t: string) => navigator.clipboard.writeText(t) : undefined };
    const out = await shareDancerPage(env as never, title, `${window.location.origin}${path}`);
    setNote(out === 'copied' ? 'Link copied.' : null);
  };
  return (
    <div className="flex items-center justify-end gap-2">
      {note ? <span role="status" className="text-[13px]" style={{ color: TEAL.muted }}>{note}</span> : null}
      <button type="button" onClick={go} className="inline-flex items-center gap-1.5 rounded-full px-3 text-[14px] font-bold" style={{ minHeight: 44, background: TEAL.accent, color: '#06191F' }}>
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </button>
    </div>
  );
}

function Opt2({ fixture, role }: { fixture: FixtureKey; role?: string }) {
  const { data: d, error, gigs } = useRoom(fixture);
  const fx = FIXTURES[fixture];
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!d) return <Skeleton className="h-64 w-full rounded-xl" />;
  const dm = dancerModel(d);
  // Roles are always public: the link bar lists every role, even one whose page is just the card.
  const roles = d.roles;
  const teacherHidden = !roles.includes('teacher') && fx.withTeacher;
  const current = (roles.find((r) => r === role) ?? (teacherHidden ? 'teacher' : leadRole(roles, gigs.upcoming.length))) as PersonRole;
  const path = `/${current === 'dj' ? 'djs' : current === 'teacher' ? 'teachers' : 'dancers'}/${fx.slug}`;
  return (
    <>
      <LinkBar fixture={fixture} d={d} current={current} roles={roles} />
      {current === 'dancer' && dm ? (
        <PublicDancerPageV2 model={dm} extrasOk={false} profileId={fx.id} pathname={path} />
      ) : current === 'dj' ? (
        <>
          <ShareBtn title={`${stageName(d) ?? realName(d)} on Bachata Calendar`} path={path} />
          <div className="mt-1"><DjBody d={d} /></div>
        </>
      ) : (
        <>
          <ShareBtn title={`${realName(d)} on Bachata Calendar`} path={path} />
          <h1 className="mb-2 mt-1 break-words text-[24px] font-extrabold" style={{ color: TEAL.text }}>{realName(d)}</h1>
          {teacherHidden ? <p className="text-[14px]" style={{ color: TEAL.muted }}>This teacher has no public teaching profile yet.</p> : <TeacherBody id={d.person.id} />}
        </>
      )}
      <OrganiserLine show={fx.organiser} />
    </>
  );
}

// ------------------------------------------------------------------ search row + lineup
const photoOf = (d: Data) => d.person.avatarUrl ?? firstPhoto(d.dj?.photo_url);

function SearchCard({ d, title, sub, chips }: { d: Data; title: string; sub?: string; chips: ReactNode }) {
  const img = photoOf(d);
  return (
    <Card className="h-full overflow-hidden border-primary/15">
      <div className="relative aspect-[4/3] bg-muted/50">
        {img ? <img src={optimizedImage(img)} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><User className="h-8 w-8" /></div>}
        <NationalityFlag code={dancerModel(d)?.nationalityCode ?? null} size={TILE_FLAG_SIZE} placement="inset" />
      </div>
      <div className="p-3">
        <h3 className="break-words text-sm font-bold text-foreground">{title}</h3>
        {sub ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{sub}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div>
      </div>
    </Card>
  );
}
const optimizedImage = (u: string) => optimizedImageUrl(u, 320);
const Chip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-foreground">{children}</span>
);

function SearchRow({ fixture, variant }: { fixture: FixtureKey; variant?: 'stage' }) {
  // Search labels come from the roles read itself (roles are always public), not from the room rule.
  const { data: d } = useMockData(fixture);
  if (!d) return <Skeleton className="h-52 w-full rounded-xl" />;
  const stage = stageName(d);
  const chips = d.roles.map((r) => (
    <Chip key={r}>{r === 'dj' ? (stage && variant !== 'stage' ? `DJ · ${stage}` : 'DJ') : ROLE_LABEL[r]}</Chip>
  ));
  // Name rule: the real name leads, except when the typed query matched the stage name (a DJ search label).
  return variant === 'stage' && stage
    ? <SearchCard d={d} title={stage} sub={`DJ name of ${realName(d)}`} chips={chips} />
    : <SearchCard d={d} title={realName(d)} chips={chips} />;
}

function Search() {
  return (
    <div data-testid="s8-search">
      <p className="mb-2 text-[13px]" style={{ color: TEAL.muted }}>People (one row per person; role labels, not one row per role)</p>
      <div className="grid grid-cols-2 gap-3">
        <SearchRow fixture="threerole" />
        <SearchRow fixture="roger" />
        <SearchRow fixture="pierre" />
        <SearchRow fixture="javier" />
      </div>
      <p className="mb-2 mt-5 text-[13px]" style={{ color: TEAL.muted }}>Same person when the typed text matches the DJ name</p>
      <div className="grid grid-cols-2 gap-3"><SearchRow fixture="threerole" variant="stage" /></div>
    </div>
  );
}

function LineupLine({ fixture, as }: { fixture: FixtureKey; as: 'dj' | 'teacher' }) {
  const { data: d } = useRoom(fixture);
  if (!d) return <Skeleton className="h-12 w-full rounded-xl" />;
  const name = as === 'dj' ? stageName(d) ?? realName(d) : realName(d);
  const img = photoOf(d);
  return (
    <li className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}`, minHeight: 56 }}>
      <PersonAvatar photoUrl={img ? optimizedImageUrl(img, 96) : null} name={name} size={44} alt={name} />
      <div className="min-w-0 flex-1">
        <div className="break-words text-[15px] font-bold" style={{ color: TEAL.text }}>{name}</div>
        <div className="text-[12px]" style={{ color: TEAL.muted }}>{as === 'dj' ? 'DJ' : 'Teacher'}</div>
      </div>
    </li>
  );
}

function Lineup() {
  return (
    <section data-testid="s8-lineup" className="rounded-[14px] p-4" style={{ background: TEAL.page, color: TEAL.text }}>
      <h2 className="mb-1 text-[13px] font-extrabold uppercase tracking-[1.5px]" style={{ color: TEAL.accent }}>Lineup (sample event)</h2>
      <p className="mb-3 text-[13px]" style={{ color: TEAL.muted }}>DJs are listed by stage name; a teacher by real name.</p>
      <ul className="space-y-2">
        <LineupLine fixture="threerole" as="dj" />
        <LineupLine fixture="roger" as="dj" />
        <LineupLine fixture="pierre" as="teacher" />
      </ul>
    </section>
  );
}

export default function S8Mock() {
  const { view, fixture, role } = useParams<{ view: string; fixture: string; role?: string }>();
  const fx = fixture as FixtureKey;
  if (!FIXTURES[fx]) return <p className="p-4">Unknown fixture</p>;
  return (
    <GlobalLayout showSubheader={false}>
      <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-3" style={{ minHeight: 700 }} data-testid="s8-root">
        {view === 'opt1' ? <Opt1 fixture={fx} /> : view === 'opt2' ? <Opt2 fixture={fx} role={role} /> : view === 'search' ? <Search /> : view === 'lineup' ? <Lineup /> : <p>Unknown view</p>}
      </div>
    </GlobalLayout>
  );
}
