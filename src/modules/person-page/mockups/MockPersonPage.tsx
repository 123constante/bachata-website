// PROTOTYPE (search v7 mockups): /__mock/person/:arrangement/:fixture. Dev or VITE_MOCKS=true only.
// Three arrangements of the combined person page, rendering REAL prod data (read-only).
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { supabase } from '@/integrations/supabase/client';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { londonTodayKey } from '@/lib/londonDate';
import { resolvePublicName } from '@/lib/publicName';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import {
  DjHero, DjContactPanel, DjListen, DjGenresEq, DjUpcoming, DjPlayedAt, DjGallery, DjTextCard, type DjGig,
} from '@/components/dj/DjTiles';
// Read-only reuse of the dancer page's own model and body (same pieces /dancers/:id draws).
import { PublicDancerPageV2 } from '@/modules/dancer-app/public-page/PublicDancerPageV2';
import { buildPublicDancerPage, shareDancerPage, NO_EXTRAS, type PublicPageExtras } from '@/modules/dancer-app/public-page/model';
import { loadPersonSnapshot, type PersonSnapshot } from '../reads';
import { ROLE_ORDER, TAB_LABEL, type PersonRole } from '../personRoles';
import { ARRANGEMENTS, FIXTURES, ORGANISER_FIXTURE, type Arrangement, type FixtureKey } from './fixtures';

const TeacherProfile = lazy(() => import('@/pages/TeacherProfile'));

// Copied from PublicDancerPageV2 (not exported there): the teal "dancer ID world".
const TEAL = {
  page: '#06191F', card: '#0D3340', border: '#1F5566', text: '#EAF7FA', muted: '#8FBAC7',
  accent: '#5EE0E6', gold: '#F2C14E',
  hero: 'linear-gradient(160deg,#1C7D93 0%,#0F5468 55%,#0A3A4A 100%)',
} as const;
const PORTRAIT_PX = 104;

type DjRow = Record<string, unknown> & {
  photo_url?: string | string[] | null; genres?: string[] | null; gallery_urls?: string[] | null;
};
type Data = {
  person: PersonSnapshot;
  roles: PersonRole[];
  dancerRow: Record<string, unknown> | null;
  extras: PublicPageExtras;
  dj: DjRow | null;
};

const dateKey = (iso: string | null | undefined) => (iso ? /^(\d{4}-\d{2}-\d{2})/.exec(iso)?.[1] ?? null : null);
const firstPhoto = (raw: string | string[] | null | undefined) => (Array.isArray(raw) ? raw.find(Boolean) ?? null : raw?.trim() || null);

function useMockData(fixture: FixtureKey): { data: Data | null; error: string | null } {
  const qc = useQueryClient();
  const [state, setState] = useState<{ data: Data | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    const fx = FIXTURES[fixture];
    (async () => {
      const person = await loadPersonSnapshot(qc, fx.id);
      if (!person) throw new Error('person not public');
      const rpc = supabase.rpc.bind(supabase) as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
      const [{ data: roleData }, { data: extrasRaw }, { data: dj }] = await Promise.all([
        rpc('get_public_person_roles_v1', { p_person_id: fx.id }),
        rpc('get_public_dancer_extras_v1', { p_profile_id: fx.id }),
        rpc('get_public_dj_v1', { p_dj_id: fx.id }),
      ]);
      const got = Array.isArray(roleData) ? (roleData as string[]) : [];
      // Teacher pages are closed on prod today, so the teacher role only shows where the fixture says so.
      const roles = ROLE_ORDER.filter((r) => got.includes(r) && (r !== 'teacher' || fx.withTeacher));
      const x = (extrasRaw ?? {}) as { bio?: string; languages?: unknown[]; whatsapp?: string };
      const extras: PublicPageExtras = extrasRaw
        ? { bio: x.bio ?? null, languages: (x.languages ?? []).filter((l): l is string => typeof l === 'string'), whatsapp: x.whatsapp ?? null }
        : NO_EXTRAS;
      const dancerRow = (qc.getQueryData(['dancer-profile', fx.id]) as Record<string, unknown> | undefined) ?? null;
      if (live) setState({ data: { person, roles, dancerRow, extras, dj: (dj as DjRow | null) ?? null }, error: null });
    })().catch((e) => live && setState({ data: null, error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, [qc, fixture]);
  return state;
}

function useDjGigs(id: string) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: appearances } = useProfileProgramAppearances('dj', mounted ? id : undefined, 1000);
  return useMemo(() => {
    const today = londonTodayKey();
    const upcoming: DjGig[] = []; const past: DjGig[] = []; let isLive = false;
    for (const a of (appearances ?? []).filter((x) => x.event_id)) {
      const gig: DjGig = { eventId: a.event_id, name: a.event_name, startTime: a.event_start_time, location: a.event_location };
      const k = dateKey(a.event_start_time);
      if (k && k >= today) { upcoming.push(gig); if (k === today) isLive = true; } else past.push(gig);
    }
    upcoming.sort((x, y) => (x.startTime ?? '').localeCompare(y.startTime ?? ''));
    return { upcoming, past, isLive };
  }, [appearances]);
}

/** Lead role = the role with something happening: a DJ with upcoming gigs, else dancing, else the first. */
const leadRole = (roles: PersonRole[], upcomingGigs: number): PersonRole =>
  roles.includes('dj') && upcomingGigs > 0 ? 'dj' : roles.includes('dancer') ? 'dancer' : roles[0];
const orderRoles = (roles: PersonRole[], lead: PersonRole) => [lead, ...roles.filter((r) => r !== lead)];

// ---------------------------------------------------------------- the ONE card (teal ID of a person)
function PersonCard({ d, slug, stamps }: { d: Data; slug: string; stamps?: ReactNode }) {
  const view = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
  const model = view ? buildPublicDancerPage(view, d.extras, []) : null;
  const [note, setNote] = useState<string | null>(null);
  const name = model?.name ?? d.person.name ?? 'Bachata Calendar profile';
  const avatar = model?.avatarUrl ?? d.person.avatarUrl;
  const doShare = async () => {
    const env = { share: typeof navigator !== 'undefined' && navigator.share ? (x: { title?: string; url?: string }) => navigator.share(x) : undefined,
      writeText: typeof navigator !== 'undefined' && navigator.clipboard ? (t: string) => navigator.clipboard.writeText(t) : undefined };
    const out = await shareDancerPage(env as never, name, `${window.location.origin}/people/${slug}`);
    setNote(out === 'copied' ? 'Link copied.' : null);
  };
  return (
    <header className="rounded-[24px] px-4 pb-4 pt-5 text-center" style={{ background: TEAL.hero, border: '1px solid #2A7C90', boxShadow: '0 10px 30px rgba(0,0,0,.4)', color: TEAL.text }} data-testid="mock-card">
      <div className="relative mx-auto" style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}>
        <div className="box-border flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ border: `4px solid ${TEAL.accent}`, background: '#06303B' }}>
          <PersonAvatar photoUrl={avatar ? optimizedImageUrl(avatar, srcWidthFor(PORTRAIT_PX * 2)) : null} name={name} size={PORTRAIT_PX - 8} loading="eager" alt={name} />
        </div>
        <NationalityFlag code={model?.nationalityCode ?? null} size={Math.round(PORTRAIT_PX * 0.8)} placement="corner" />
      </div>
      <h1 className="mt-3 break-words text-[24px] font-extrabold leading-tight">{name}</h1>
      {(model?.city ?? d.person.city) ? <p className="mt-0.5 text-[14px]" style={{ color: '#DDF6F8' }}>{model?.city ?? d.person.city}</p> : null}
      {stamps}
      {model && model.languages.length > 0 ? (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.28)' }}>
          <div className="text-[11px] tracking-[2px]" style={{ color: '#BFE9EE' }}>SPEAKS</div>
          <div className="mt-1 break-words text-[15px] font-extrabold">{model.languages.join(', ')}</div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2" data-testid="mock-contact">
        {(model?.contacts ?? []).map((c) => (
          <a key={c.kind} href={c.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center truncate rounded-full px-3 text-[14px] font-bold" style={{ minHeight: 44, background: 'rgba(6,25,31,.55)', border: `1px solid ${TEAL.border}`, color: TEAL.accent }}>
            {c.label}
          </a>
        ))}
        <button type="button" onClick={doShare} className="inline-flex items-center gap-1.5 rounded-full px-3 text-[14px] font-bold" style={{ minHeight: 44, background: TEAL.accent, color: '#06191F' }}>
          <Share2 className="h-4 w-4" aria-hidden /> Share
        </button>
      </div>
      {note ? <p role="status" className="mt-1 text-[13px]" style={{ color: '#DDF6F8' }}>{note}</p> : null}
    </header>
  );
}

function OrganiserLine({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="mt-3 text-center text-[14px]" style={{ color: TEAL.text }} data-testid="mock-organiser">
      Leads: <Link to={ORGANISER_FIXTURE.href} className="font-bold underline" style={{ color: TEAL.accent }}>{ORGANISER_FIXTURE.name}</Link>{' '}
      <span style={{ color: TEAL.muted }}>(sample)</span>
    </p>
  );
}

// ---------------------------------------------------------------- role bodies (real pieces)
function DancerBody({ d, slug }: { d: Data; slug: string }) {
  const view = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
  if (!view) return null;
  const full = buildPublicDancerPage(view, d.extras, []);
  // Identity, languages, contacts and Share live ONCE on the card, so the body gets them emptied.
  const model = { ...full, languages: [], contacts: [] };
  return (
    <div className="mock-dancer-body">
      <style>{`.mock-dancer-body [data-testid="dancer-share"],.mock-dancer-body [data-testid="dancer-share-status"],.mock-dancer-body [data-testid="dancer-share-link"]{display:none}`}</style>
      <PublicDancerPageV2 model={model} extrasOk={false} profileId={view.id} pathname={`/people/${slug}`} embedded />
      {full.songs.length > 0 ? (
        <section aria-label="Favourite songs" data-testid="mock-songs" className="mt-3 rounded-[14px] p-3.5" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}`, color: TEAL.text }}>
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px]" style={{ color: TEAL.accent }}>Favourite songs</h2>
          <ul className="space-y-1">{full.songs.map((s, i) => <li key={i} className="break-words text-[14px]">{s}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

/** The DJ page's own tiles, drawn exactly as /djs/:id draws them (near-black + gold, vinyl portrait). */
function DjBody({ d }: { d: Data }) {
  useDjPageFonts();
  const dj = d.dj;
  const { upcoming, past, isLive } = useDjGigs(d.person.id);
  if (!dj) return null;
  const s = (k: string) => (dj[k] as string | null | undefined) ?? null;
  const name = resolvePublicName(dj as never) ?? d.person.name ?? 'DJ';
  const genres = Array.isArray(dj.genres) ? dj.genres.filter(Boolean) : [];
  const gallery = Array.isArray(dj.gallery_urls) ? dj.gallery_urls.filter(Boolean) : [];
  const hasContact = !!(s('instagram') || s('website') || s('soundcloud') || s('mixcloud') || s('facebook'));
  return (
    <div style={{ ...(djInkTheme as CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)', fontFamily: 'var(--dj-body)', borderRadius: 22 }} className="p-3" data-testid="mock-dj-panel">
      <div className="mock-dj-stack" style={{ display: 'grid', gap: 16 }}>
        <DjHero name={name} photoUrl={firstPhoto(dj.photo_url)} cityName={s('city_name')} nationality={s('nationality')} nationalityCode={s('nationality_code')} bio={s('bio')} isLive={isLive} stats={{ gigs: upcoming.length + past.length || null, upcoming: upcoming.length || null, genres: genres.length || null }} />
        {hasContact ? <DjContactPanel name={name} instagram={s('instagram')} website={s('website')} soundcloud={s('soundcloud')} mixcloud={s('mixcloud')} facebook={s('facebook')} phone={s('phone')} /> : null}
        {s('soundcloud') || s('mixcloud') ? <DjListen soundcloud={s('soundcloud')} mixcloud={s('mixcloud')} /> : null}
        {genres.length > 0 ? <DjGenresEq genres={genres} /> : null}
        {upcoming.length > 0 ? <DjUpcoming gigs={upcoming} /> : null}
        {past.length > 0 ? <DjPlayedAt gigs={past} totalCount={past.length} /> : null}
        {gallery.length > 0 ? <DjGallery urls={gallery} name={name} /> : null}
        {s('faq') ? <DjTextCard title="FAQ" body={s('faq') as string} /> : null}
        {s('pricing') ? <DjTextCard title="Pricing" body={s('pricing') as string} /> : null}
      </div>
      <style>{`@keyframes dj-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes dj-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}@keyframes dj-pulse{0%,100%{opacity:.45}50%{opacity:1}}@keyframes dj-eqbar{0%,100%{transform:scaleY(.9)}50%{transform:scaleY(1.06)}}`}</style>
    </div>
  );
}

/** The real TeacherProfile, embedded; the :id it reads from the URL is supplied by a nested Routes. */
function TeacherBody({ id }: { id: string }) {
  const base = useLocation().pathname.replace(/\/$/, '');
  return (
    <EmbeddedProfileContext.Provider value={true}>
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <Routes location={{ pathname: `${base}/teachers/${id}` }}>
          <Route path="teachers/:id" element={<TeacherProfile />} />
        </Routes>
      </Suspense>
    </EmbeddedProfileContext.Provider>
  );
}

function RoleBody({ role, d, slug }: { role: PersonRole; d: Data; slug: string }) {
  if (role === 'dj') return <DjBody d={d} />;
  if (role === 'teacher') return <TeacherBody id={d.person.id} />;
  return <DancerBody d={d} slug={slug} />;
}

const SectionHeader = ({ role }: { role: PersonRole }) => (
  <h2 className="mb-2 mt-6 text-[15px] font-extrabold uppercase tracking-[2px]" style={{ color: TEAL.accent }}>{TAB_LABEL[role]}</h2>
);

// ---------------------------------------------------------------- the three arrangements
function Stamps({ d, slug, ordered }: { d: Data; slug: string; ordered: PersonRole[] }) {
  const [open, setOpen] = useState<PersonRole>(ordered[0]);
  const chips = (
    <div className="mt-3 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Roles" data-testid="mock-stamps">
      {ordered.map((r) => (
        <button key={r} type="button" role="tab" aria-selected={r === open} onClick={() => setOpen(r)}
          className="rounded-[10px] px-3 text-[13px] font-black uppercase tracking-[1px]"
          style={{ minHeight: 44, border: `2px solid ${TEAL.gold}`, transform: 'rotate(-2deg)', color: r === open ? '#06191F' : TEAL.gold, background: r === open ? TEAL.gold : 'transparent' }}>
          {TAB_LABEL[r]}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <PersonCard d={d} slug={slug} stamps={chips} />
      <div className="mt-3" role="tabpanel"><RoleBody role={open} d={d} slug={slug} /></div>
    </>
  );
}

function Stacked({ d, slug, ordered }: { d: Data; slug: string; ordered: PersonRole[] }) {
  return (
    <>
      <PersonCard d={d} slug={slug} />
      {ordered.map((r) => (
        <section key={r} aria-label={TAB_LABEL[r]} data-testid={`mock-section-${r}`}>
          {ordered.length > 1 ? <SectionHeader role={r} /> : <div className="mt-3" />}
          <RoleBody role={r} d={d} slug={slug} />
        </section>
      ))}
    </>
  );
}

function Tabs({ d, slug, ordered }: { d: Data; slug: string; ordered: PersonRole[] }) {
  const [active, setActive] = useState<PersonRole>(ordered[0]);
  return (
    <>
      <PersonCard d={d} slug={slug} />
      {ordered.length > 1 ? (
        <div role="tablist" aria-label="Roles" className="mt-3 flex gap-1" style={{ borderBottom: `1px solid ${TEAL.border}` }} data-testid="mock-tabs">
          {ordered.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={r === active} onClick={() => setActive(r)}
              className="flex-1 px-3 text-[14px] font-bold"
              style={{ minHeight: 44, color: r === active ? TEAL.accent : TEAL.muted, borderBottom: `3px solid ${r === active ? TEAL.accent : 'transparent'}` }}>
              {TAB_LABEL[r]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3" role="tabpanel"><RoleBody role={active} d={d} slug={slug} /></div>
    </>
  );
}

export default function MockPersonPage() {
  const { arrangement, fixture } = useParams<{ arrangement: string; fixture: string }>();
  const fx = FIXTURES[fixture as FixtureKey];
  const arr = arrangement as Arrangement;
  if (!fx || !ARRANGEMENTS.includes(arr)) return <p className="p-4">Unknown mock: {arrangement}/{fixture}</p>;
  return <MockInner arr={arr} fixture={fixture as FixtureKey} />;
}

function MockInner({ arr, fixture }: { arr: Arrangement; fixture: FixtureKey }) {
  const { data, error } = useMockData(fixture);
  const fx = FIXTURES[fixture];
  const gigs = useDjGigs(fx.id);
  const slug = fx.slug;
  return (
    <GlobalLayout showSubheader={false}>
      <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-3" style={{ minHeight: 700 }} data-testid="mock-root" data-ready={data ? 'true' : 'false'}>
        {error ? <p role="alert" className="p-4">Could not load: {error}</p> : null}
        {!data && !error ? <Skeleton className="h-64 w-full rounded-xl" /> : null}
        {data ? (() => {
          const ordered = orderRoles(data.roles, leadRole(data.roles, gigs.upcoming.length));
          const props = { d: data, slug, ordered };
          return (
            <>
              {arr === 'stamps' ? <Stamps {...props} /> : arr === 'stacked' ? <Stacked {...props} /> : <Tabs {...props} />}
              <OrganiserLine show={fx.organiser} />
            </>
          );
        })() : null}
      </div>
    </GlobalLayout>
  );
}
