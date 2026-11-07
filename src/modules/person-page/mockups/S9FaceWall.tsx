// PROTOTYPE (search v7, S9): /__mock/s9/:view  view = wall4 | wall3 | nophoto | sheet. Dev or VITE_MOCKS=true only.
// Face wall of REAL people (list_public_djs_v1 + the person reads). Nothing here is invented.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { londonTodayKey } from '@/lib/londonDate';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { loadPersonSnapshot } from '../reads';
import type { PersonRole } from '../personRoles';

type Rpc = (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }>;
const rpc = () => supabase.rpc.bind(supabase) as unknown as Rpc;

/** Shared warm base + one accent per role. Every text/fill pair is checked in docs/mockups/s9-facewall/05-contrast.json. */
export const WARM = {
  light: { page: '#FFF4E6', card: '#FFFFFF', text: '#3B2216', muted: '#6B4A3A', line: '#EBD6BE' },
  dark: { page: '#1E1410', card: '#2B1D16', text: '#FBEBDD', muted: '#CDB09C', line: '#4A3226' },
} as const;
type RoleKey = PersonRole | 'organiser';
export const ACCENT: Record<RoleKey, { label: string; chipBg: string; chipText: string; tileBg: string; tileInk: string }> = {
  dj: { label: 'DJ', chipBg: '#F2B632', chipText: '#3B2216', tileBg: '#F6D58A', tileInk: '#5A3A00' },
  dancer: { label: 'Dancer', chipBg: '#0F766E', chipText: '#FFFFFF', tileBg: '#BFE8E1', tileInk: '#0B4F4A' },
  teacher: { label: 'Teacher', chipBg: '#6D28D9', chipText: '#FFFFFF', tileBg: '#E4D7FB', tileInk: '#4C1D95' },
  organiser: { label: 'Organiser', chipBg: '#B93E0B', chipText: '#FFFFFF', tileBg: '#FAD2BE', tileInk: '#7A2606' },
};
const SHORT: Record<RoleKey, string> = { dj: 'DJ', dancer: 'Dance', teacher: 'Teach', organiser: 'Org' };

// Fixture people (REAL prod ids). Why each is here is in docs/handover/s9-facewall.md.
const IDS = [
  '005a7329-90a3-4d81-8854-296a4a6db673', // Roger Cracco: DJ + dancer, gig soon
  '04ca2889-870a-4891-9a97-cb6231020d73', // Bisket / Oreo Sensual: 3 roles
  '0b67cc21-3e5a-48a6-8470-a07030d6bf1f', // "DJ El Rugido": stage name
  '59150b2d-0963-4cea-80fd-76c2d48ab23c', // Bobby Blanco: no photo, gig soon
  'bccc8a0c-daec-414d-ad21-81aa658ebba1', // "DJ Carlos De La Cruz": long stage name, no photo
  '7c68e12a-3c8a-4c78-8d5f-712b52530a59', // Magda Sobolewska: long surname
  'a61e7b72-1fb2-42a9-b8e1-b843183ad562', // Melita Somos: flag, gig
  '8cbced3d-c437-4e0d-bc71-0e8b8b787fe1', // Daniel Carbonero: flag, gig
  'ae3bffbb-a8d5-44e4-9080-6b217f2b03f9', // Morcilla (Papacito): stage name, gig
  'b8d35574-835b-494f-b395-dca0fcb8e441', // Missy K: stage name, no gig
  '3e349814-79da-4e8c-832b-dca0e5d777da', // DJ Tony Spark: stage name
  '017dee9f-c30a-45e3-b2b9-01dab3cb8062', // Gatica: teacher + dancer
  '26ef26e9-ace4-4eef-9722-b6ea54e9699b', // Javier: dancer only
  '0dd8819b-1aa1-4c6e-9747-f09b2c177a0c', // Pierre Henry: teacher only, no photo
  '57ef6bdc-e03a-4072-8fde-7a021f538147', // Enoch Lopez: teacher only
  '3eac9b2b-c61c-4d2b-95d1-53679a7afa23', // Joey Brooks: DJ
];

type Dj = { id: string; display_name: string | null; dj_name: string | null; first_name: string | null; surname: string | null; photo_url: unknown; nationality_code: string | null; next_gig_date: string | null; city_name: string | null };
export type Tile = {
  id: string; real: string; first: string; stage: string | null; photo: string | null; flag: string | null;
  roles: PersonRole[]; nextDate: string | null; city: string | null;
};

const photoOf = (raw: unknown) => (Array.isArray(raw) ? ((raw.find(Boolean) as string | undefined) ?? null) : typeof raw === 'string' && raw.trim() ? raw.trim() : null);
const stripDj = (s: string) => s.replace(/^dj\s+/i, '').trim();
const ORDER: PersonRole[] = ['dj', 'dancer', 'teacher'];
// Teacher pages are closed on prod (S8 handover), so the teacher role shows only for these verified teachers.
const TEACHERS = new Set(['04ca2889-870a-4891-9a97-cb6231020d73', '017dee9f-c30a-45e3-b2b9-01dab3cb8062', '0dd8819b-1aa1-4c6e-9747-f09b2c177a0c', '57ef6bdc-e03a-4072-8fde-7a021f538147']);

function useTiles(): { tiles: Tile[] | null; error: string | null } {
  const qc = useQueryClient();
  const djs = useQuery({
    queryKey: ['s9-djs'],
    queryFn: async () => ((await rpc()('list_public_djs_v1', { p_city_id: null, p_limit: 200 })).data ?? []) as Dj[],
  });
  const per = useQueries({
    queries: IDS.map((id) => ({
      queryKey: ['s9-person', id],
      queryFn: async () => {
        const [snap, roles] = await Promise.all([loadPersonSnapshot(qc, id), rpc()('get_public_person_roles_v1', { p_person_id: id })]);
        return { snap, roles: (Array.isArray(roles.data) ? (roles.data as string[]) : []) as string[] };
      },
    })),
  });
  const loading = djs.isLoading || per.some((p) => p.isLoading);
  const tiles = useMemo(() => {
    if (loading) return null;
    const byId = new Map((djs.data ?? []).map((d) => [d.id, d]));
    const out: Tile[] = [];
    IDS.forEach((id, i) => {
      const p = per[i].data;
      if (!p?.snap) return;
      const dj = byId.get(id);
      const real = (dj ? [dj.first_name, dj.surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() : '') || p.snap.name || 'Bachata dancer';
      const stage = dj?.dj_name ? stripDj(dj.dj_name) : null;
      const roles = ORDER.filter((r) => (p.roles.includes(r) || (r === 'dj' && !!dj)) && (r !== 'teacher' || TEACHERS.has(id)));
      out.push({
        id, real, first: real.split(' ')[0], stage: stage && stage !== real ? stage : null,
        photo: photoOf(dj?.photo_url) ?? p.snap.avatarUrl ?? p.snap.djPhoto, flag: dj?.nationality_code ?? null,
        roles, nextDate: dj?.next_gig_date && dj.next_gig_date >= londonTodayKey() ? dj.next_gig_date : null, city: dj?.city_name ?? p.snap.city,
      });
    });
    return out;
  }, [loading, djs.data, per]);
  return { tiles, error: djs.error ? String(djs.error) : null };
}

const dateChip = (k: string) => {
  const d = new Date(`${k}T12:00:00Z`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
};
const initialsOf = (n: string) => {
  const w = n.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};
/** The name a tile shows: DJ filter leads with the stage name, every other filter with the real first name. */
const tileName = (t: Tile, filter: Filter) => (filter === 'djs' && t.stage ? t.stage : filter === 'djs' && t.roles[0] === 'dj' && t.roles.length === 1 ? t.real : t.first);
export const leadOf = (t: Tile, filter: Filter): RoleKey => (filter === 'djs' ? 'dj' : filter === 'dancers' ? 'dancer' : filter === 'teachers' ? 'teacher' : t.roles[0] ?? 'dancer');

type Filter = 'all' | 'djs' | 'dancers' | 'teachers';
const FILTERS: { k: Filter; label: string }[] = [{ k: 'all', label: 'All' }, { k: 'djs', label: 'DJs' }, { k: 'dancers', label: 'Dancers' }, { k: 'teachers', label: 'Teachers' }];
const FILTER_ROLE: Record<Filter, PersonRole | null> = { all: null, djs: 'dj', dancers: 'dancer', teachers: 'teacher' };

function Face({ t, lead, px, theme }: { t: Tile; lead: RoleKey; px?: number; theme: 'light' | 'dark' }) {
  const [failed, setFailed] = useState<string | null>(null);
  const a = ACCENT[lead];
  const show = t.photo && failed !== t.photo;
  void theme;
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1 / 1', borderRadius: 12, height: px, background: a.tileBg }} data-face={show ? 'photo' : 'initials'}>
      {show ? (
        <img src={optimizedImageUrl(t.photo as string, 320)} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(t.photo)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true"
          style={{ color: a.tileInk, backgroundImage: `radial-gradient(circle at 20% 15%, rgba(255,255,255,.55) 0 18%, transparent 19%), radial-gradient(circle at 85% 90%, rgba(255,255,255,.35) 0 26%, transparent 27%), repeating-linear-gradient(135deg, rgba(0,0,0,.04) 0 6px, transparent 6px 12px)` }}>
          <span style={{ fontSize: 'clamp(22px, 9vw, 30px)', fontWeight: 800, letterSpacing: 1 }}>{initialsOf(t.stage ?? t.real)}</span>
        </div>
      )}
    </div>
  );
}

function RoleChips({ roles, filter }: { roles: PersonRole[]; filter: Filter }) {
  const shown = filter === 'all' ? roles : roles;
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-[3px]">
      {shown.map((r) => (
        <span key={r} data-testid="role-chip" style={{ background: ACCENT[r].chipBg, color: ACCENT[r].chipText, fontSize: 10, fontWeight: 700, lineHeight: '14px', padding: '1px 6px', borderRadius: 999 }}>{SHORT[r]}</span>
      ))}
    </div>
  );
}

export function WallTile({ t, filter, theme, cols }: { t: Tile; filter: Filter; theme: 'light' | 'dark'; cols: 3 | 4 }) {
  const c = WARM[theme];
  const lead = leadOf(t, filter);
  const name = tileName(t, filter);
  return (
    <Link to={`/__mock/s9/sheet?id=${t.id}&theme=${theme}`} className="block min-w-0" data-testid="wall-tile" aria-label={`${name}, ${t.roles.map((r) => ACCENT[r].label).join(', ')}${t.nextDate ? `, next event ${dateChip(t.nextDate)}` : ''}`}>
      <div className="relative">
        <Face t={t} lead={lead} theme={theme} />
        <NationalityFlag code={t.flag} size={40} placement="inset" />
        {t.nextDate ? (
          <span data-testid="date-chip" className="absolute bottom-1 left-1 rounded-full" style={{ background: ACCENT.dj.chipBg, color: ACCENT.dj.chipText, fontSize: 10, fontWeight: 800, lineHeight: '14px', padding: '1px 6px', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}>{dateChip(t.nextDate)}</span>
        ) : null}
      </div>
      <div data-testid="tile-name" className="mt-1 break-words text-center" style={{ color: c.text, fontSize: cols === 4 ? 12 : 13, fontWeight: 700, lineHeight: '15px', maxHeight: 30, overflow: 'hidden' }}>{name}</div>
      <RoleChips roles={t.roles} filter={filter} />
    </Link>
  );
}

function Wall({ cols, filter, theme, tiles }: { cols: 3 | 4; filter: Filter; theme: 'light' | 'dark'; tiles: Tile[] }) {
  const want = FILTER_ROLE[filter];
  const list = tiles.filter((t) => !want || t.roles.includes(want)).sort((a, b) => Number(!!b.nextDate) - Number(!!a.nextDate));
  const c = WARM[theme];
  return (
    <div style={{ background: c.page, color: c.text }} className="px-3 pb-6 pt-3" data-testid="wall-root">
      <h1 className="text-[20px] font-extrabold leading-tight">Meet the people behind the nights</h1>
      <p className="mb-2 text-[13px]" style={{ color: c.muted }}>Tap a face to see where they are dancing, DJing or teaching next.</p>
      <div className="mb-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <Link key={f.k} to={`?filter=${f.k}&theme=${theme}`} role="tab" aria-selected={f.k === filter}
            style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              background: f.k === filter ? c.text : 'transparent', color: f.k === filter ? c.page : c.text, border: `1.5px solid ${f.k === filter ? c.text : c.line}` }}>{f.label}</Link>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: cols === 4 ? '12px 8px' : '14px 10px' }} data-testid="wall-grid">
        {list.map((t) => <WallTile key={t.id} t={t} filter={filter} theme={theme} cols={cols} />)}
      </div>
    </div>
  );
}

function NoPhoto({ tiles, theme }: { tiles: Tile[]; theme: 'light' | 'dark' }) {
  const c = WARM[theme];
  const roles: PersonRole[] = ['dj', 'dancer', 'teacher'];
  const sample = tiles.find((t) => !t.photo) ?? tiles[0];
  return (
    <div style={{ background: c.page, color: c.text }} className="px-3 pb-6 pt-3" data-testid="nophoto-root">
      <h1 className="mb-1 text-[18px] font-extrabold">When there is no photo</h1>
      <p className="mb-3 text-[13px]" style={{ color: c.muted }}>The tile takes its colour from the role. Initials are large, a soft pattern makes it look chosen, never a broken image.</p>
      <div className="grid grid-cols-4" style={{ gap: '12px 8px' }}>
        {roles.map((r) => (
          <div key={r}><Face t={{ ...sample, photo: null }} lead={r} theme={theme} /><div className="mt-1 text-center text-[11px]" style={{ color: c.muted }}>{ACCENT[r].label}</div></div>
        ))}
        <div><Face t={{ ...sample, photo: null }} lead="organiser" theme={theme} /><div className="mt-1 text-center text-[11px]" style={{ color: c.muted }}>Organiser</div></div>
      </div>
      <h2 className="mb-2 mt-5 text-[14px] font-extrabold">Real people with no photo today</h2>
      <div className="grid grid-cols-4" style={{ gap: '12px 8px' }}>
        {tiles.filter((t) => !t.photo).map((t) => <WallTile key={t.id} t={t} filter="all" theme={theme} cols={4} />)}
      </div>
      <h2 className="mb-2 mt-5 text-[14px] font-extrabold">Photo fails to load (same fallback)</h2>
      <p className="text-[12px]" style={{ color: c.muted }}>Any tile whose photo errors swaps to the initials face above.</p>
    </div>
  );
}

function Sheet({ tiles, theme }: { tiles: Tile[]; theme: 'light' | 'dark' }) {
  const [sp] = useSearchParams();
  const t = tiles.find((x) => x.id === sp.get('id')) ?? tiles[0];
  const { data: apps } = useProfileProgramAppearances('dj', t.id, 1000);
  const next = useMemo(() => {
    const today = londonTodayKey();
    return (apps ?? []).filter((a) => a.event_id && (a.event_start_time ?? '').slice(0, 10) >= today).sort((x, y) => (x.event_start_time ?? '').localeCompare(y.event_start_time ?? ''))[0] ?? null;
  }, [apps]);
  const c = WARM[theme];
  const lead = t.roles[0] ?? 'dancer';
  const roleWords = t.roles.map((r) => ({ dj: 'DJ', dancer: 'dancer', teacher: 'teacher' }[r]));
  const line = `${roleWords.join(', ').replace(/^./, (s) => s.toUpperCase())}${t.city ? ` in ${t.city}` : ''}.`;
  const [, setTick] = useState(0);
  useEffect(() => setTick(1), []);
  return (
    <div style={{ background: c.page, color: c.text, minHeight: 844, position: 'relative', overflow: 'hidden' }} data-testid="sheet-root">
      <div aria-hidden="true" style={{ opacity: 0.35, pointerEvents: 'none' }}>
        <Wall cols={4} filter="all" theme={theme} tiles={tiles} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,16,.55)' }} />

      <section role="dialog" aria-label={t.stage ?? t.real} className="fixed bottom-0 left-1/2 w-full -translate-x-1/2 px-4 pb-6 pt-3" style={{ maxWidth: 430, background: c.card, borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,.35)', border: `1px solid ${c.line}` }} data-testid="person-sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: c.line }} />
        <div className="flex items-center gap-3">
          <div style={{ width: 96, flex: '0 0 auto' }} className="relative"><Face t={t} lead={lead} theme={theme} /><NationalityFlag code={t.flag} size={96} placement="inset" /></div>
          <div className="min-w-0">
            <h2 className="break-words text-[22px] font-extrabold leading-tight" style={{ color: c.text }}>{t.stage ?? t.real}</h2>
            {t.stage ? <div className="text-[13px]" style={{ color: c.muted }}>{t.real}</div> : null}
            <div className="mt-1 flex flex-wrap gap-1">{t.roles.map((r) => <span key={r} style={{ background: ACCENT[r].chipBg, color: ACCENT[r].chipText, fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>{r === 'dj' && t.stage ? `DJ · ${t.stage}` : ACCENT[r].label}</span>)}</div>
          </div>
        </div>
        <p className="mt-3 text-[15px]" style={{ color: c.text }}>{line}</p>
        {next ? (
          <Link to={`/event/${next.event_id}`} data-testid="primary-cta" className="mt-4 flex items-center justify-center text-center" style={{ minHeight: 52, borderRadius: 14, background: ACCENT.dj.chipBg, color: ACCENT.dj.chipText, fontSize: 16, fontWeight: 800, padding: '0 14px' }}>
            Go to their next event{t.nextDate ? ` · ${dateChip(t.nextDate)}` : ''}
          </Link>
        ) : null}
        <Link to={`/people/${t.id}`} className="mt-3 block text-center text-[14px] font-bold underline" style={{ color: c.text, minHeight: 44, lineHeight: '44px' }}>See full profile</Link>
      </section>
    </div>
  );
}

function Compare({ tiles, filter, theme }: { tiles: Tile[]; filter: Filter; theme: 'light' | 'dark' }) {
  return (
    <div style={{ background: WARM[theme].page, color: WARM[theme].text }} className="pb-6 pt-3">
      <h1 className="px-3 text-[16px] font-extrabold">A. Four columns (tile ~85px)</h1>
      <Wall cols={4} filter={filter} theme={theme} tiles={tiles.slice(0, 8)} />
      <h1 className="mt-4 px-3 text-[16px] font-extrabold">B. Three columns (tile ~118px)</h1>
      <Wall cols={3} filter={filter} theme={theme} tiles={tiles.slice(0, 8)} />
    </div>
  );
}

export default function S9FaceWall() {
  const { view } = useParams<{ view: string }>();
  const [sp] = useSearchParams();
  const filter = (FILTERS.find((f) => f.k === sp.get('filter'))?.k ?? 'all') as Filter;
  const theme = sp.get('theme') === 'dark' ? 'dark' : 'light';
  const { tiles, error } = useTiles();
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!tiles) return <p className="p-4" data-testid="s9-loading">Loading</p>;
  return (
    <div className="mx-auto w-full overflow-x-hidden" style={{ maxWidth: 430, background: WARM[theme].page }} data-testid="s9-root" data-ready="1">
      {view === 'wall4' ? <Wall cols={4} filter={filter} theme={theme} tiles={tiles} />
        : view === 'wall3' ? <Wall cols={3} filter={filter} theme={theme} tiles={tiles} />
        : view === 'compare' ? <Compare tiles={tiles} filter={filter} theme={theme} />
        : view === 'nophoto' ? <NoPhoto tiles={tiles} theme={theme} />
        : view === 'sheet' ? <Sheet tiles={tiles} theme={theme} />
        : <p className="p-4">Unknown view</p>}
    </div>
  );
}
