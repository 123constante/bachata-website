// PROTOTYPE (search v7, S12): /__mock/s12/:view  view = hub-roger | hub-gatica | hub-pierre | role-<person>-<role> | flow-roger | flow-gatica. Dev or VITE_MOCKS=true only.
// Person HUB (face, name, city + flag, languages, facts, big role cards) and one page per role, each its own world.
// REAL people read from prod (SELECT only) through the S8 helpers. Tokens come from S11Person (exported) and MockPersonPage; no other file edited.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { resolvePublicName } from '@/lib/publicName';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { PublicDancerPageV2 } from '@/modules/dancer-app/public-page/PublicDancerPageV2';
import { buildPublicDancerPage } from '@/modules/dancer-app/public-page/model';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import { DjHero, DjContactPanel, DjListen, DjGenresEq, DjUpcoming, DjPlayedAt, type DjGig } from '@/components/dj/DjTiles';
import { BASE, ACC } from './S11Person';
import { useMockData, useDjGigs, type Data } from './MockPersonPage';
import { FIXTURES, ORGANISER_FIXTURE, type FixtureKey } from './fixtures';

type Role = 'dj' | 'dancer' | 'teacher' | 'organiser';
const B = BASE.dark; // owner decision: warm dark is the base
const PEOPLE: Record<string, { fx: FixtureKey; teacher: boolean; organiser: boolean }> = {
  roger: { fx: 'roger', teacher: false, organiser: true },
  gatica: { fx: 'gatica', teacher: true, organiser: false },
  pierre: { fx: 'pierre', teacher: true, organiser: false },
};
const PKEYS = Object.keys(PEOPLE);
const WORD: Record<Role, string> = { dj: 'DJ', dancer: 'Dancer', teacher: 'Teacher', organiser: 'Organiser' };
const first = (raw: unknown) => (Array.isArray(raw) ? ((raw.find(Boolean) as string | undefined) ?? null) : typeof raw === 'string' && raw.trim() ? raw.trim() : null);
const initialsOf = (n: string) => { const w = n.split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
const dateChip = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
};

type P = {
  key: string; d: Data; roles: Role[]; lead: Role; real: string; stage: string | null; photo: string | null; city: string | null; code: string | null;
  languages: string[]; years: string | null; level: string | null; gigs: DjGig[]; past: DjGig[]; isLive: boolean;
};

function useP(key: string): P | null {
  const meta = PEOPLE[key];
  const { data: d } = useMockData(meta.fx);
  const g = useDjGigs(FIXTURES[meta.fx].id);
  return useMemo(() => {
    if (!d) return null;
    const view = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
    const m = view ? buildPublicDancerPage(view, d.extras, []) : null;
    const real = m?.name ?? d.person.name ?? 'Bachata dancer';
    const sn = d.dj ? resolvePublicName(d.dj as never) : null;
    const roles: Role[] = [];
    if (d.roles.includes('dj') && g.upcoming.length > 0) roles.push('dj');
    if (d.roles.includes('dancer')) roles.push('dancer');
    if (d.roles.includes('dj') && g.upcoming.length === 0) roles.push('dj');
    if (meta.teacher) roles.push('teacher'); // MOCK: teacher pages are closed on prod
    if (meta.organiser) roles.push('organiser'); // MOCK: organiser read not applied on prod
    return {
      key, d, roles, lead: roles[0] ?? 'dancer', real, stage: sn && sn !== real ? sn : null,
      photo: d.person.avatarUrl ?? first(d.dj?.photo_url), city: m?.city ?? d.person.city ?? ((d.dj?.city_name as string | null) ?? null),
      code: m?.nationalityCode ?? ((d.dj?.nationality_code as string | null) ?? null), languages: m?.languages ?? [],
      years: m?.facts.dancing ?? null, level: m?.facts.level ?? null, gigs: g.upcoming, past: g.past, isLive: g.isLive,
    };
  }, [d, g, meta, key]);
}

const headName = (p: P, role: Role) => (role === 'dj' && p.stage ? p.stage : p.real);
const subName = (p: P, role: Role) => (role === 'dj' && p.stage ? p.real : role !== 'dj' && p.stage ? `DJ ${p.stage}` : null);
const edge = (r: Role) => ACC[r].edgeDark;

function Face({ p, role, size }: { p: P; role: Role; size: number }) {
  const [failed, setFailed] = useState(false);
  const common: CSSProperties = { width: size, height: size, borderRadius: 18, flex: '0 0 auto' };
  let inner: ReactNode;
  if (p.photo && !failed) {
    inner = <div style={{ ...common, overflow: 'hidden', background: B.line }}><img src={optimizedImageUrl(p.photo, 480)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /></div>;
  } else if (p.photo) {
    // A photo exists but the sandbox cannot load it (403): labelled neutral block, never an invented face.
    inner = (
      <div style={{ ...common, background: B.card, border: `2px dashed ${B.muted}`, color: B.muted }} className="flex flex-col items-center justify-center text-center" data-face="photo-block">
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2 }}>PHOTO</span><span style={{ fontSize: 10, fontWeight: 600 }}>real photo here</span>
      </div>
    );
  } else {
    inner = <div style={{ ...common, background: ACC[role].tile, color: ACC[role].tileInk }} className="flex items-center justify-center" data-face="initials"><span style={{ fontSize: size * 0.34, fontWeight: 800 }}>{initialsOf(headName(p, role))}</span></div>;
  }
  return <div className="relative" style={{ width: size, height: size }}>{inner}<NationalityFlag code={p.code} size={Math.round(size * 0.5)} placement="inset" /></div>;
}

/** Quiet facts strip: only facts that exist; hidden when none. */
function Facts({ p, role, items }: { p: P; role?: Role; items?: string[] }) {
  const list = items ?? [p.years ? `${p.years} dancing` : null, p.level, p.languages.length ? p.languages.join(', ') : null].filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" data-testid="facts" style={{ color: B.muted, fontSize: 14, borderTop: `1px solid ${B.line}`, paddingTop: 10 }}>
      {list.map((f) => <li key={f} className="break-words" style={{ color: B.text }}><span style={{ color: role ? edge(role) : B.muted }}>&bull;</span> {f}</li>)}
    </ul>
  );
}

const slugOf = (p: P) => p.key;
const hubUrl = (p: P) => `/__mock/s12/hub-${p.key}`;
const roleUrl = (p: P, r: Role) => `/__mock/s12/role-${p.key}-${r}`;

function roleLine(p: P, r: Role): string {
  if (r === 'dj') return p.gigs.length ? `${p.gigs.length} gig${p.gigs.length > 1 ? 's' : ''} coming up${p.gigs[0] ? ` \u00b7 next ${dateChip(p.gigs[0].startTime)}` : ''}` : 'DJ sets and music';
  if (r === 'dancer') return [p.years ? `${p.years} dancing` : null, p.level].filter(Boolean).join(' \u00b7 ') || '';
  if (r === 'teacher') return 'Classes and workshops';
  return `Leads: ${ORGANISER_FIXTURE.name}`;
}

function RoleCard({ p, r, lead }: { p: P; r: Role; lead: boolean }) {
  const a = ACC[r];
  const mock = r === 'teacher' || r === 'organiser';
  const line = roleLine(p, r);
  return (
    <Link to={roleUrl(p, r)} data-testid="role-card" data-role={r} data-lead={lead ? '1' : '0'} className="flex items-center gap-3" style={{ minHeight: 84, borderRadius: 18, background: B.card, border: `${lead ? 2 : 1.5}px solid ${edge(r)}`, borderLeft: `10px solid ${edge(r)}`, padding: '12px 12px 12px 14px', color: B.text }}>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span style={{ background: a.bg, color: a.ink, fontSize: 14, fontWeight: 800, padding: '2px 12px', borderRadius: 999 }}>{WORD[r]}</span>
          {lead ? <span style={{ fontSize: 12, fontWeight: 800, color: edge(r) }}>HAPPENING NOW</span> : null}
          {mock ? <span style={{ fontSize: 11, fontWeight: 800, color: B.muted, border: `1px dashed ${B.muted}`, borderRadius: 6, padding: '0 6px' }}>mock: not live</span> : null}
        </span>
        {line ? <span className="mt-1 block break-words text-[15px]" style={{ color: B.text }}>{line}</span> : null}
      </span>
      <ChevronRight className="h-6 w-6 shrink-0" style={{ color: edge(r) }} aria-hidden />
    </Link>
  );
}

function HubFrame({ p }: { p: P }) {
  const lead = p.lead;
  const sub = subName(p, lead);
  const next = p.gigs[0];
  const cta = ACC[lead];
  return (
    <div style={{ background: B.page, minHeight: 844, paddingBottom: 24, color: B.text }} data-testid="hub" data-person={p.key} data-ready="1">
      <div className="px-4 pt-3"><Link to="/__mock/s9/wall" className="inline-flex items-center gap-1 text-[15px] font-bold" style={{ minHeight: 44, color: B.text }}><ArrowLeft className="h-4 w-4" aria-hidden /> People wall</Link></div>
      <section className="mx-3 mt-1 p-4" style={{ background: B.card, border: `1px solid ${B.line}`, borderRadius: 24 }}>
        <div className="flex items-center gap-4">
          <Face p={p} role={lead} size={128} />
          <div className="min-w-0">
            <h1 className="break-words text-[26px] font-extrabold leading-tight" data-testid="person-name">{headName(p, lead)}</h1>
            {sub ? <div className="break-words text-[14px]" style={{ color: B.muted }}>{sub}</div> : null}
            {p.city ? <div className="mt-1 text-[15px]" style={{ color: B.text }}>{p.city}</div> : null}
          </div>
        </div>
        <Facts p={p} />
        {next ? (
          <Link to={`/event/${next.eventId}`} data-testid="primary-cta" className="mt-4 flex items-center justify-center text-center" style={{ minHeight: 54, borderRadius: 16, background: cta.bg, color: cta.ink, fontSize: 17, fontWeight: 800, padding: '0 14px' }}>
            Go to their next event &middot; {dateChip(next.startTime)}
          </Link>
        ) : null}
      </section>
      <h2 className="mx-4 mb-2 mt-5 text-[13px] font-extrabold uppercase" style={{ letterSpacing: 1.5, color: B.muted }}>{p.roles.length > 1 ? `What ${headName(p, lead).split(' ')[0]} does` : 'Role'}</h2>
      <div className="mx-3 grid gap-3">{p.roles.map((r, i) => <RoleCard key={r} p={p} r={r} lead={i === 0 && p.roles.length > 1} />)}</div>
    </div>
  );
}

/** Role page chrome: back to hub, role label, and "Also: other roles". Each role then paints its OWN world below. */
function Chrome({ p, r, children, mock }: { p: P; r: Role; children: ReactNode; mock?: boolean }) {
  const others = p.roles.filter((x) => x !== r);
  const a = ACC[r];
  return (
    <div style={{ background: B.page, minHeight: 844, paddingBottom: 24, color: B.text }} data-testid="role-page" data-role={r} data-person={p.key} data-ready="1">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <Link to={hubUrl(p)} data-testid="back-hub" className="inline-flex items-center gap-1 text-[15px] font-bold" style={{ minHeight: 44, color: B.text }}><ArrowLeft className="h-4 w-4" aria-hidden /> {headName(p, p.lead).split(' ')[0]}&rsquo;s page</Link>
        <span style={{ background: a.bg, color: a.ink, fontSize: 13, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>{WORD[r]}</span>
      </div>
      {mock ? <p className="mx-4 mt-1 text-[12px] font-bold" style={{ color: B.muted }} data-testid="mock-label">mock: not live{r === 'teacher' ? ' (teacher pages are closed on prod)' : ' (organiser read not on prod; sample name)'}</p> : null}
      <div className="mx-3 mt-2">{children}</div>
      {others.length ? (
        <nav aria-label="Also" data-testid="also" className="mx-3 mt-4 flex flex-wrap items-center gap-2 text-[14px]" style={{ color: B.muted }}>
          <span>Also:</span>
          {others.map((o) => <Link key={o} to={roleUrl(p, o)} className="inline-flex items-center rounded-full px-3 font-bold" style={{ minHeight: 44, border: `2px solid ${edge(o)}`, color: B.text, background: B.card }}>{WORD[o]}</Link>)}
        </nav>
      ) : null}
    </div>
  );
}

/** DJ world: the live DJ tiles (near-black + gold vinyl) on the warm-dark base, GIGS FIRST. */
function DjWorld({ p }: { p: P }) {
  useDjPageFonts();
  const dj = p.d.dj;
  if (!dj) return <p style={{ color: B.muted }}>No DJ page yet.</p>;
  const s = (k: string) => (dj[k] as string | null | undefined) ?? null;
  const genres = Array.isArray(dj.genres) ? dj.genres.filter(Boolean) : [];
  const name = resolvePublicName(dj as never) ?? p.real;
  const hasContact = !!(s('instagram') || s('website') || s('soundcloud') || s('mixcloud') || s('facebook'));
  return (
    <div style={{ ...(djInkTheme as CSSProperties), background: B.page, color: 'var(--dj-cream)', fontFamily: 'var(--dj-body)', borderRadius: 22 }} data-testid="dj-world">
      <div style={{ display: 'grid', gap: 16 }}>
        {p.gigs.length ? <DjUpcoming gigs={p.gigs} /> : null}
        <DjHero name={name} photoUrl={first(dj.photo_url)} cityName={s('city_name')} nationality={s('nationality')} nationalityCode={s('nationality_code')} bio={s('bio')} isLive={p.isLive} stats={{ gigs: p.gigs.length + p.past.length || null, upcoming: p.gigs.length || null, genres: genres.length || null }} />
        {hasContact ? <DjContactPanel name={name} instagram={s('instagram')} website={s('website')} soundcloud={s('soundcloud')} mixcloud={s('mixcloud')} facebook={s('facebook')} phone={s('phone')} /> : null}
        {s('soundcloud') || s('mixcloud') ? <DjListen soundcloud={s('soundcloud')} mixcloud={s('mixcloud')} /> : null}
        {genres.length ? <DjGenresEq genres={genres} /> : null}
        {p.past.length ? <DjPlayedAt gigs={p.past} totalCount={p.past.length} /> : null}
      </div>
      <style>{`@keyframes dj-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes dj-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}@keyframes dj-pulse{0%,100%{opacity:.45}50%{opacity:1}}@keyframes dj-eqbar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}`}</style>
    </div>
  );
}

/** Dancer world: the live teal ID card (PublicDancerPageV2) on the warm-dark base. Its own Back and Share are hidden here (the hub bar replaces Back). */
function DancerWorld({ p }: { p: P }) {
  const view = p.d.dancerRow ? mapDancerPublicProfile(p.d.dancerRow as never) : null;
  if (!view) return <p className="p-3" style={{ color: B.muted }}>No dancer page yet.</p>;
  const model = buildPublicDancerPage(view, p.d.extras, []);
  return (
    <div data-testid="dancer-world">
      <style>{`[data-testid="dancer-world"] [data-testid="dancer-back"]{display:none}`}</style>
      <PublicDancerPageV2 model={model} extrasOk={false} profileId={view.id} pathname={`/people/${p.key}`} />
    </div>
  );
}

/** Teacher world (MOCK, violet): only facts that exist; nothing invented. */
function TeacherWorld({ p }: { p: P }) {
  const a = ACC.teacher;
  const facts = [p.city, p.languages.length ? p.languages.join(', ') : null].filter(Boolean) as string[];
  return (
    <div data-testid="teacher-world">
      <section className="p-4 text-center" style={{ background: `linear-gradient(160deg,#4C1D95 0%,#2E1065 100%)`, border: `2px solid ${a.edgeDark}`, borderRadius: 24, color: '#F5EEFF' }}>
        <div className="mx-auto" style={{ width: 112 }}><Face p={p} role="teacher" size={112} /></div>
        <div className="mt-3 text-[11px] font-bold" style={{ letterSpacing: 2, color: '#E4D7FB' }}>TEACHER</div>
        <h1 className="break-words text-[26px] font-extrabold leading-tight">{p.real}</h1>
        {p.city ? <p className="mt-0.5 text-[15px]" style={{ color: '#E4D7FB' }}>{p.city}</p> : null}
      </section>
      <section className="mt-3 p-4" style={{ background: B.card, border: `1px solid ${B.line}`, borderLeft: `6px solid ${a.edgeDark}`, borderRadius: 16 }}>
        <h2 className="mb-1 text-[13px] font-extrabold uppercase" style={{ letterSpacing: 1.5, color: a.edgeDark }}>Teaches</h2>
        <p className="text-[15px]" style={{ color: B.text }}>Class list, levels and prices appear here once teacher pages open. This frame shows the layout only.</p>
        <Facts p={p} role="teacher" items={facts} />
      </section>
    </div>
  );
}

/** Organiser world (MOCK, burnt orange): the existing organiser page style, sample name only. */
function OrganiserWorld({ p }: { p: P }) {
  const a = ACC.organiser;
  return (
    <div data-testid="organiser-world">
      <section className="p-4" style={{ background: `linear-gradient(160deg,#7A2606 0%,#3B1204 100%)`, border: `2px solid ${a.edgeDark}`, borderRadius: 24, color: '#FFF1E8' }}>
        <div className="text-[11px] font-bold" style={{ letterSpacing: 2, color: '#FAD2BE' }}>ORGANISER</div>
        <h1 className="mt-1 break-words text-[26px] font-extrabold leading-tight">{ORGANISER_FIXTURE.name}</h1>
        <p className="mt-1 text-[15px]" style={{ color: '#FAD2BE' }}>Led by {p.real} (sample name)</p>
      </section>
      <section className="mt-3 p-4" style={{ background: B.card, border: `1px solid ${B.line}`, borderLeft: `6px solid ${a.edgeDark}`, borderRadius: 16 }}>
        <h2 className="mb-1 text-[13px] font-extrabold uppercase" style={{ letterSpacing: 1.5, color: a.edgeDark }}>Their events</h2>
        {p.gigs.length ? <p className="text-[15px]" style={{ color: B.text }}>Next on the calendar: {p.gigs[0].name} &middot; {dateChip(p.gigs[0].startTime)}</p> : <p className="text-[15px]" style={{ color: B.text }}>No events on the calendar right now.</p>}
        <Link to={ORGANISER_FIXTURE.href} className="mt-3 flex items-center justify-center text-center" style={{ minHeight: 54, borderRadius: 16, background: a.bg, color: a.ink, fontSize: 17, fontWeight: 800 }}>See all events by this organiser</Link>
      </section>
    </div>
  );
}

function RoleFrame({ p, r }: { p: P; r: Role }) {
  if (!p.roles.includes(r)) return <p className="p-4" style={{ color: B.text }}>{p.real} has no {WORD[r]} role.</p>;
  const body = r === 'dj' ? <DjWorld p={p} /> : r === 'dancer' ? <DancerWorld p={p} /> : r === 'teacher' ? <TeacherWorld p={p} /> : <OrganiserWorld p={p} />;
  return <Chrome p={p} r={r} mock={r === 'teacher' || r === 'organiser'}>{body}</Chrome>;
}

function Hub({ k }: { k: string }) { const p = useP(k); return p ? <HubFrame p={p} /> : <p className="p-4" style={{ color: B.text }} data-testid="s12-loading">Loading</p>; }
function Role({ k, r }: { k: string; r: Role }) { const p = useP(k); return p ? <RoleFrame p={p} r={r} /> : <p className="p-4" style={{ color: B.text }} data-testid="s12-loading">Loading</p>; }

/** Flow sheet: wall tile -> hub -> role page, three small frames with arrows and plain-word labels. */
function Flow({ k }: { k: string }) {
  const p = useP(k);
  const S = 0.62;
  const W = Math.round(390 * S), H = Math.round(844 * S);
  if (!p) return <p className="p-4" data-testid="s12-loading">Loading</p>;
  const shown: Role = p.roles[0];
  const wall = (
    <div style={{ background: B.page, height: 844, color: B.text }} className="px-3 pt-4">
      <h2 className="mb-3 text-[22px] font-extrabold">People</h2>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 16 }, (_, i) => i === 5 ? (
          <div key={i} style={{ aspectRatio: '1', borderRadius: 12, outline: `4px solid ${edge(shown)}`, outlineOffset: 2, overflow: 'hidden' }}><Face p={p} role={shown} size={84} /></div>
        ) : <div key={i} style={{ aspectRatio: '1', borderRadius: 12, background: B.card, border: `1px dashed ${B.line}` }} />)}
      </div>
      <p className="mt-4 text-[16px] font-bold" style={{ color: edge(shown) }}>&uarr; Tap this face</p>
      <p className="mt-1 text-[12px]" style={{ color: B.muted }}>Other tiles are neutral blanks: this sheet shows one real person only.</p>
    </div>
  );
  const arrow = <div className="flex items-center justify-center text-[40px] font-extrabold text-white" aria-hidden>&rarr;</div>;
  const box = (label: string, el: ReactNode) => (
    <div style={{ width: W }}>
      <div className="mb-1 text-[15px] font-extrabold text-white" style={{ minHeight: 40 }}>{label}</div>
      <div style={{ width: W, height: H, overflow: 'hidden', borderRadius: 12 }}><div style={{ width: 390, height: 844, overflow: 'hidden', transform: `scale(${S})`, transformOrigin: 'top left', pointerEvents: 'none' }}>{el}</div></div>
    </div>
  );
  return (
    <div style={{ background: '#6B5B52', padding: 16, width: W * 3 + 120 + 80 }} data-testid="flow" data-ready="1">
      <div className="mb-2 text-[18px] font-extrabold text-white">{p.real}: from the wall to a role page</div>
      <div className="flex gap-4">
        {box('1. On the wall, tap a face', wall)}{arrow}
        {box('2. Their page: pick what they do', <HubFrame p={p} />)}{arrow}
        {box(`3. That role has its own look (${WORD[shown]})`, <RoleFrame p={p} r={shown} />)}
      </div>
    </div>
  );
}

export default function S12Hub() {
  const { view = '' } = useParams<{ view: string }>();
  const [kind, a, b] = view.split('-');
  let body: ReactNode = <p className="p-4">Unknown view</p>;
  if (kind === 'hub' && PKEYS.includes(a)) body = <Hub k={a} />;
  else if (kind === 'role' && PKEYS.includes(a) && ['dj', 'dancer', 'teacher', 'organiser'].includes(b)) body = <Role k={a} r={b as Role} />;
  else if (kind === 'flow' && PKEYS.includes(a)) return <Flow k={a} />;
  return <div className="mx-auto w-full overflow-x-hidden" style={{ maxWidth: 430, background: B.page }} data-testid="s12-root">{body}</div>;
}
