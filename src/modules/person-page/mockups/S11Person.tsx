// PROTOTYPE (search v7, S11): /__mock/s11/:view  view = dj | teacher | three | nophoto | card | sheet. ?theme=dark. Dev or VITE_MOCKS=true only.
// ONE arrangement: role badges on a single person page. REAL people read from prod (SELECT only). The S9 tokens are copied, not imported (S10 edits S9FaceWall.tsx).
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { londonTodayKey } from '@/lib/londonDate';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { loadPersonSnapshot } from '../reads';

type Rpc = (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
const rpc = () => supabase.rpc.bind(supabase) as unknown as Rpc;

// Same two bases and role accents as S9 (S10's wall), copied.
export const BASE = {
  light: { page: '#FFF4E6', card: '#FFFFFF', text: '#3B2216', muted: '#6B4A3A', line: '#EBD6BE' },
  dark: { page: '#1E1410', card: '#2B1D16', text: '#FBEBDD', muted: '#CDB09C', line: '#4A3226' },
} as const;
type Theme = keyof typeof BASE;
type Role = 'dj' | 'dancer' | 'teacher' | 'organiser';
// edge = the colour of the chip outline/fill used against the page; checked in docs/mockups/s11-person/contrast.json
export const ACC: Record<Role, { label: string; bg: string; ink: string; tile: string; tileInk: string; edgeLight: string; edgeDark: string }> = {
  dj: { label: 'DJ', bg: '#F2B632', ink: '#3B2216', tile: '#F6D58A', tileInk: '#5A3A00', edgeLight: '#8A5A00', edgeDark: '#F2B632' },
  dancer: { label: 'Dancer', bg: '#0F766E', ink: '#FFFFFF', tile: '#BFE8E1', tileInk: '#0B4F4A', edgeLight: '#0F766E', edgeDark: '#5FC9BE' },
  teacher: { label: 'Teacher', bg: '#6D28D9', ink: '#FFFFFF', tile: '#E4D7FB', tileInk: '#4C1D95', edgeLight: '#6D28D9', edgeDark: '#B79BF2' },
  organiser: { label: 'Organiser', bg: '#B93E0B', ink: '#FFFFFF', tile: '#FAD2BE', tileInk: '#7A2606', edgeLight: '#B93E0B', edgeDark: '#F08A5A' },
};
// Section titles/text drawn on the page use the accent in a readable shade per base.
const sectionInk = (r: Role, th: Theme) => (th === 'light' ? ACC[r].edgeLight : ACC[r].edgeDark);

// Real prod people (ids as in S9). stage = the DJ name rule applies when list_public_djs_v1 has one.
export const PEOPLE = {
  dj: { id: '005a7329-90a3-4d81-8854-296a4a6db673', label: 'Roger Cracco: DJ with gigs', organiser: true, teacher: false },
  teacher: { id: '017dee9f-c30a-45e3-b2b9-01dab3cb8062', label: 'Gatica: Teacher + Dancer', organiser: false, teacher: true },
  three: { id: '04ca2889-870a-4891-9a97-cb6231020d73', label: 'Bisket / Oreo Sensual: 3 roles', organiser: true, teacher: true },
  nophoto: { id: '0dd8819b-1aa1-4c6e-9747-f09b2c177a0c', label: 'Pierre Henry: no photo, almost no data', organiser: false, teacher: true },
} as const;
type PKey = keyof typeof PEOPLE;
const PKEYS = Object.keys(PEOPLE) as PKey[];
/** FIXTURE, not data: get_public_person_organisers_v1 may not be applied on prod (same as S7/S8). */
const ORGANISER_FIXTURE = 'Sample Bachata Nights';

type Dj = { id: string; first_name: string | null; surname: string | null; dj_name: string | null; photo_url: unknown; next_gig_date: string | null; city_name: string | null };
const photoOf = (raw: unknown) => (Array.isArray(raw) ? ((raw.find(Boolean) as string | undefined) ?? null) : typeof raw === 'string' && raw.trim() ? raw.trim() : null);
const stripDj = (s: string) => s.replace(/^dj\s+/i, '').trim();
const initialsOf = (n: string) => {
  const w = n.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};
const dateChip = (k: string) => {
  const d = new Date(`${k.slice(0, 10)}T12:00:00Z`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
};

type Gig = { eventId: string; name: string; venue: string | null; date: string };
type Person = {
  id: string; real: string; stage: string | null; photo: string | null; city: string | null;
  roles: Role[]; // public roles incl. organiser line; teacher = badge only
  gigs: Gig[]; songs: string[]; years: string | null; styles: string[]; danceRole: string | null;
};

function usePerson(k: PKey): Person | null | undefined {
  const qc = useQueryClient();
  const meta = PEOPLE[k];
  const base = useQuery({
    queryKey: ['s11-person', meta.id],
    queryFn: async () => {
      const [snap, roles, djs] = await Promise.all([
        loadPersonSnapshot(qc, meta.id),
        rpc()('get_public_person_roles_v1', { p_person_id: meta.id }),
        rpc()('list_public_djs_v1', { p_city_id: null, p_limit: 200 }),
      ]);
      const dancerRow = qc.getQueryData(['dancer-profile', meta.id]);
      return { snap, roles: (Array.isArray(roles.data) ? (roles.data as string[]) : []) as string[], dj: ((djs.data ?? []) as Dj[]).find((d) => d.id === meta.id) ?? null, dancerRow };
    },
  });
  const { data: apps } = useProfileProgramAppearances('dj', meta.id, 1000);
  return useMemo(() => {
    if (base.isLoading) return undefined;
    const b = base.data;
    if (!b?.snap) return null;
    const view = b.dancerRow ? mapDancerPublicProfile(b.dancerRow as never) : null;
    const today = londonTodayKey();
    const gigs = (apps ?? [])
      .filter((a) => a.event_id && (a.event_start_time ?? '').slice(0, 10) >= today)
      .sort((x, y) => (x.event_start_time ?? '').localeCompare(y.event_start_time ?? ''))
      .map((a) => ({ eventId: a.event_id as string, name: a.event_name ?? 'Event', venue: a.event_location ?? null, date: (a.event_start_time as string).slice(0, 10) }));
    const real = (b.dj ? [b.dj.first_name, b.dj.surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() : '') || b.snap.name || 'Bachata dancer';
    const stage = b.dj?.dj_name ? stripDj(b.dj.dj_name) : null;
    const roles: Role[] = [];
    if (b.roles.includes('dj') || b.dj) roles.push('dj');
    if (b.roles.includes('dancer') || b.snap.roles.includes('dancer')) roles.push('dancer');
    if (meta.teacher && (b.roles.includes('teacher') || b.snap.roles.includes('teacher') || k === 'nophoto' || k === 'teacher')) roles.push('teacher'); // badge only
    if (meta.organiser) roles.push('organiser');
    return {
      id: meta.id, real, stage: stage && stage !== real ? stage : null,
      photo: photoOf(b.dj?.photo_url) ?? b.snap.avatarUrl ?? b.snap.djPhoto, city: b.dj?.city_name ?? b.snap.city, roles, gigs,
      songs: view?.favoriteSongs ?? [], years: view?.yearsDancing ?? null, styles: view?.favoriteStyles ?? [], danceRole: view?.partnerRole ?? null,
    };
  }, [base.isLoading, base.data, apps, meta, k]);
}

/** Owner rule: lead with the role that has something happening; a DJ with upcoming gigs leads with gigs, else dancing leads. */
export const leadRole = (p: Person): Role => (p.roles.includes('dj') && p.gigs.length > 0 ? 'dj' : p.roles.includes('dancer') ? 'dancer' : p.roles.find((r) => r !== 'organiser') ?? 'dancer');
/** Stage name leads on DJ things, real name elsewhere. */
export const headName = (p: Person, lead: Role) => (lead === 'dj' && p.stage ? p.stage : p.real);
const subName = (p: Person, lead: Role) => (lead === 'dj' && p.stage ? p.real : p.stage && lead !== 'dj' ? `DJ ${p.stage}` : null);

function plainLine(p: Person): string {
  const words = p.roles.filter((r) => r !== 'organiser').map((r) => ({ dj: 'DJ', dancer: 'dancer', teacher: 'teacher', organiser: '' }[r]));
  if (!words.length) return p.city ? `Bachata in ${p.city}.` : '';
  const j = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
  return `${j.charAt(0).toUpperCase()}${j.slice(1)}${p.city ? ` in ${p.city}` : ''}.`;
}

function Face({ p, lead, size, th }: { p: Person; lead: Role; size: number; th: Theme }) {
  const [failed, setFailed] = useState(false);
  const a = ACC[lead];
  const c = BASE[th];
  const common = { width: size, height: size, borderRadius: 18, flex: '0 0 auto' } as const;
  if (p.photo && !failed) {
    return (
      <div style={{ ...common, overflow: 'hidden', background: c.line }} data-face="photo">
        <img src={optimizedImageUrl(p.photo, 480)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }
  if (p.photo) {
    // A photo exists but the sandbox cannot load it (403): a labelled neutral block, NOT an invented face.
    return (
      <div style={{ ...common, background: c.card, border: `2px dashed ${c.muted}`, color: c.muted }} className="flex flex-col items-center justify-center text-center" data-face="photo-block">
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2 }}>PHOTO</span>
        <span style={{ fontSize: 10, fontWeight: 600 }}>real photo here</span>
      </div>
    );
  }
  return (
    <div style={{ ...common, background: a.tile, color: a.tileInk, backgroundImage: `radial-gradient(circle at 20% 15%, rgba(255,255,255,.55) 0 18%, transparent 19%), radial-gradient(circle at 85% 90%, rgba(255,255,255,.35) 0 26%, transparent 27%), repeating-linear-gradient(135deg, rgba(0,0,0,.04) 0 6px, transparent 6px 12px)` }} className="flex items-center justify-center" aria-hidden="true" data-face="initials">
      <span style={{ fontSize: size * 0.34, fontWeight: 800, letterSpacing: 1 }}>{initialsOf(p.stage && lead === 'dj' ? p.stage : p.real)}</span>
    </div>
  );
}

/** Badge = filled chip in the role accent (text pair >= 4.5); outlined chip edge uses the base-aware shade (>= 3). */
function Badge({ r, th, lead }: { r: Role; th: Theme; lead: boolean }) {
  const a = ACC[r];
  return (
    <span data-testid="role-badge" data-lead={lead ? '1' : '0'} style={{ background: a.bg, color: a.ink, fontSize: 13, fontWeight: 800, lineHeight: '18px', padding: '3px 12px', borderRadius: 999, border: `${lead ? 2 : 1.5}px solid ${th === 'light' ? a.edgeLight : a.edgeDark}` }}>{a.label}</span>
  );
}

function Card({ p, th, nextGig }: { p: Person; th: Theme; nextGig: Gig | null }) {
  const c = BASE[th];
  const lead = leadRole(p);
  const sub = subName(p, lead);
  const organiser = p.roles.includes('organiser');
  const line = plainLine(p);
  const cta = ACC[lead];
  return (
    <section className="px-4 pb-4 pt-5" style={{ background: c.card, borderBottom: `1px solid ${c.line}`, borderRadius: '0 0 24px 24px' }} data-testid="top-card">
      <div className="flex items-center gap-4">
        <Face p={p} lead={lead} size={128} th={th} />
        <div className="min-w-0">
          <h1 className="break-words text-[26px] font-extrabold leading-tight" style={{ color: c.text }} data-testid="person-name">{headName(p, lead)}</h1>
          {sub ? <div className="break-words text-[14px]" style={{ color: c.muted }}>{sub}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Roles">
        {p.roles.map((r) => <Badge key={r} r={r} th={th} lead={r === lead} />)}
      </div>
      {line ? <p className="mt-3 text-[16px]" style={{ color: c.text }}>{line}</p> : null}
      {organiser ? <p className="mt-1 text-[14px]" style={{ color: c.muted }} data-fixture="organiser">Leads: <span style={{ color: c.text, fontWeight: 700 }}>{ORGANISER_FIXTURE}</span></p> : null}
      {nextGig ? (
        <Link to={`/event/${nextGig.eventId}`} data-testid="primary-cta" className="mt-4 flex items-center justify-center text-center" style={{ minHeight: 54, borderRadius: 16, background: cta.bg, color: cta.ink, fontSize: 17, fontWeight: 800, padding: '0 14px', border: `2px solid ${th === 'light' ? cta.edgeLight : cta.edgeDark}` }}>
          Go to their next event &middot; {dateChip(nextGig.date)}
        </Link>
      ) : null}
      <Link to={`/__mock/s11/card?id=${p.id}&theme=${th}`} data-testid="share" className="mt-2 flex items-center justify-center gap-2 font-bold" style={{ minHeight: 48, borderRadius: 14, border: `2px solid ${c.text}`, color: c.text, fontSize: 15, background: 'transparent' }}>
        Share this person
      </Link>
    </section>
  );
}

function Section({ r, title, th, children }: { r: Role; title: string; th: Theme; children: React.ReactNode }) {
  const c = BASE[th];
  return (
    <section className="mx-3 mt-3 rounded-[16px] p-4" style={{ background: c.card, border: `1px solid ${c.line}`, borderLeft: `6px solid ${th === 'light' ? ACC[r].edgeLight : ACC[r].edgeDark}`, color: c.text }} aria-label={title} data-testid="role-section" data-role={r}>
      <h2 className="mb-2 text-[13px] font-extrabold uppercase" style={{ letterSpacing: 1.5, color: sectionInk(r, th) }}>{title}</h2>
      {children}
    </section>
  );
}

function GigsSection({ p, th }: { p: Person; th: Theme }) {
  const c = BASE[th];
  if (!p.gigs.length) return null;
  return (
    <Section r="dj" title={`${p.stage ? `${p.stage} ` : ''}Gigs coming up`.trim()} th={th}>
      <ul className="space-y-2">
        {p.gigs.slice(0, 3).map((g) => (
          <li key={g.eventId}>
            <Link to={`/event/${g.eventId}`} className="flex items-center gap-3" style={{ minHeight: 48 }}>
              <span className="shrink-0 rounded-full text-center" style={{ background: ACC.dj.bg, color: ACC.dj.ink, fontSize: 13, fontWeight: 800, padding: '3px 10px', minWidth: 64 }}>{dateChip(g.date)}</span>
              <span className="min-w-0"><span className="block break-words text-[15px] font-bold" style={{ color: c.text }}>{g.name}</span>{g.venue ? <span className="block break-words text-[13px]" style={{ color: c.muted }}>{g.venue}</span> : null}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DancingSection({ p, th }: { p: Person; th: Theme }) {
  const c = BASE[th];
  const facts = [p.years ? `${p.years} dancing` : null, p.danceRole ? `Dances ${p.danceRole.toLowerCase()}` : null].filter(Boolean) as string[];
  if (!p.roles.includes('dancer') || (!facts.length && !p.styles.length && !p.songs.length)) return null;
  return (
    <Section r="dancer" title="Dancing" th={th}>
      {facts.length ? <p className="text-[15px]">{facts.join(' · ')}</p> : null}
      {p.styles.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">{p.styles.map((s) => <span key={s} className="rounded-full" style={{ border: `1.5px solid ${th === 'light' ? ACC.dancer.edgeLight : ACC.dancer.edgeDark}`, color: c.text, fontSize: 13, fontWeight: 600, padding: '2px 10px' }}>{s}</span>)}</div>
      ) : null}
      {p.songs.length ? (
        <div className="mt-3">
          <h3 className="mb-1 text-[13px] font-extrabold" style={{ color: c.muted }}>Favourite songs</h3>
          <ul className="space-y-1">{p.songs.map((s, i) => <li key={i} className="break-words text-[15px]">{s}</li>)}</ul>
        </div>
      ) : null}
    </Section>
  );
}

function Frame({ k, th }: { k: PKey; th: Theme }) {
  const p = usePerson(k);
  if (p === undefined) return <p className="p-4" data-testid="s11-loading">Loading</p>;
  if (p === null) return <p role="alert" className="p-4">Could not load this person.</p>;
  const lead = leadRole(p);
  const nextGig = p.gigs[0] ?? null;
  // Lead role's section first; the others follow only when filled. Teacher has no section (badge only).
  const secs = lead === 'dj' ? [<GigsSection key="g" p={p} th={th} />, <DancingSection key="d" p={p} th={th} />] : [<DancingSection key="d" p={p} th={th} />, <GigsSection key="g" p={p} th={th} />];
  return (
    <div style={{ background: BASE[th].page, minHeight: 844, paddingBottom: 24 }} data-testid="s11-frame" data-person={k} data-lead={lead} data-ready="1">
      <Card p={p} th={th} nextGig={nextGig} />
      {secs}
    </div>
  );
}

/** What a shared link looks like in a chat: link-preview card (no invented face: initials or labelled PHOTO block). */
function CallingCard({ th }: { th: Theme }) {
  const [sp] = useSearchParams();
  const k = (PKEYS.find((x) => PEOPLE[x].id === sp.get('id')) ?? 'dj') as PKey;
  const p = usePerson(k);
  const c = BASE[th];
  if (!p) return <p className="p-4" data-testid="s11-loading">Loading</p>;
  const lead = leadRole(p);
  const next = p.gigs[0];
  return (
    <div style={{ background: c.page, minHeight: 844, padding: 16 }} data-testid="calling-card" data-ready="1">
      <p className="mb-3 text-[13px] font-bold" style={{ color: c.muted }}>PREVIEW: what a friend sees when you share this link in a chat</p>
      <div className="ml-auto max-w-[330px] rounded-[18px] p-1.5" style={{ background: th === 'light' ? '#DCF8C6' : '#3B2A1F', color: c.text }}>
        <div className="overflow-hidden rounded-[14px]" style={{ background: c.card, border: `1px solid ${c.line}` }}>
          <div className="flex items-center justify-center py-6" style={{ background: ACC[lead].tile }}>
            <Face p={p} lead={lead} size={150} th={th} />
          </div>
          <div className="p-3">
            <div className="text-[12px]" style={{ color: c.muted }}>bachatacalendar.co.uk</div>
            <div className="break-words text-[18px] font-extrabold" style={{ color: c.text }}>{headName(p, lead)}</div>
            <div className="mt-1 flex flex-wrap gap-1">{p.roles.map((r) => <Badge key={r} r={r} th={th} lead={r === lead} />)}</div>
            <div className="mt-2 text-[14px]" style={{ color: c.text }}>{plainLine(p)}{next ? ` Next: ${dateChip(next.date)}.` : ''}</div>
          </div>
        </div>
        <div className="px-2 pb-1 pt-1 text-[13px] underline" style={{ color: c.text }}>bachatacalendar.co.uk/people/{p.id.slice(0, 8)}&hellip;</div>
      </div>
      <p className="mt-4 text-[12px]" style={{ color: c.muted }}>Frame only. The real share card image (og:image) is not produced by this prototype.</p>
    </div>
  );
}

function Sheet({ th }: { th: Theme }) {
  return (
    <div style={{ background: '#777', padding: 16, width: PKEYS.length * 422 }} data-testid="sheet" data-ready="1">
      <div className="flex gap-4">
        {PKEYS.map((k) => (
          <div key={k} style={{ width: 390 }}>
            <div className="mb-1 text-[14px] font-extrabold text-white">{PEOPLE[k].label} &middot; {th === 'light' ? 'cream' : 'warm dark'}</div>
            <div style={{ width: 390, height: 844, overflow: 'hidden' }}><Frame k={k} th={th} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function S11Person() {
  const { view } = useParams<{ view: string }>();
  const [sp] = useSearchParams();
  const th: Theme = sp.get('theme') === 'dark' ? 'dark' : 'light';
  const body = view === 'card' ? <CallingCard th={th} /> : view === 'sheet' ? <Sheet th={th} /> : PKEYS.includes(view as PKey) ? <Frame k={view as PKey} th={th} /> : <p className="p-4">Unknown view</p>;
  return view === 'sheet' ? body : <div className="mx-auto w-full overflow-x-hidden" style={{ maxWidth: 430, background: BASE[th].page }} data-testid="s11-root">{body}</div>;
}
