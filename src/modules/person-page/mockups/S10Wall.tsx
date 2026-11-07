// PROTOTYPE (search v7, S10): /__mock/s10/:view  view = wall | side | page | sheet | photo. Dev or VITE_MOCKS=true only.
// Same real people as S9. Two bases (A cream, B warm dark), chips with an edge that holds on BOTH bases.
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { londonTodayKey } from '@/lib/londonDate';
import { useProfileProgramAppearances, type PersonType } from '@/hooks/useProfileProgramAppearances';
import { useTiles, dateChip, initialsOf, tileName, leadOf, SHORT, FILTERS, FILTER_ROLE, type Tile, type RoleKey, type Filter } from './S9FaceWall';

type Base = 'cream' | 'dark';
type Chip = { bg: string; text: string; border: string };
type Pal = { page: string; card: string; text: string; muted: string; line: string; chip: Record<RoleKey, Chip>; tile: Record<RoleKey, { bg: string; ink: string; edge: string }> };

export const BASES: Record<Base, Pal> = {
  cream: {
    page: '#FFF4E6', card: '#FFFFFF', text: '#3B2216', muted: '#6B4A3A', line: '#D9BFA3',
    chip: {
      dj: { bg: '#F2B632', text: '#3B2216', border: '#8A5A00' },
      dancer: { bg: '#0F766E', text: '#FFFFFF', border: '#0A524D' },
      teacher: { bg: '#6D28D9', text: '#FFFFFF', border: '#4C1D95' },
      organiser: { bg: '#B93E0B', text: '#FFFFFF', border: '#7A2606' },
    },
    tile: {
      dj: { bg: '#F6D58A', ink: '#5A3A00', edge: '#B8860B' },
      dancer: { bg: '#BFE8E1', ink: '#0B4F4A', edge: '#0F766E' },
      teacher: { bg: '#E4D7FB', ink: '#4C1D95', edge: '#6D28D9' },
      organiser: { bg: '#FAD2BE', ink: '#7A2606', edge: '#B93E0B' },
    },
  },
  dark: {
    page: '#1E1410', card: '#2B1D16', text: '#FBEBDD', muted: '#CDB09C', line: '#6A4A38',
    chip: {
      dj: { bg: '#F2B632', text: '#2B1A00', border: '#FFD479' },
      dancer: { bg: '#2DD4BF', text: '#04302C', border: '#8DF0E2' },
      teacher: { bg: '#B79CFB', text: '#1E0A4D', border: '#D8C8FD' },
      organiser: { bg: '#FB8A4B', text: '#3A1300', border: '#FFB68A' },
    },
    tile: {
      dj: { bg: '#6B4A0E', ink: '#FFE3A0', edge: '#C9921E' },
      dancer: { bg: '#0F4F4A', ink: '#A7F3E8', edge: '#2DD4BF' },
      teacher: { bg: '#4A2D8A', ink: '#E4D7FB', edge: '#A78BFA' },
      organiser: { bg: '#7A2F0E', ink: '#FFD2B8', edge: '#FB8A4B' },
    },
  },
};
const DATE_CHIP = { bg: '#1E1410', text: '#FFD479', border: '#FFD479' };

function Face({ t, lead, base, placeholder }: { t: Tile; lead: RoleKey; base: Base; placeholder?: boolean }) {
  const a = BASES[base].tile[lead];
  const [failed, setFailed] = useState<string | null>(null);
  const show = !placeholder && t.photo && failed !== t.photo;
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1 / 1', borderRadius: 12, background: placeholder ? '#9A9A9A' : a.bg, border: `1.5px solid ${placeholder ? '#7C7C7C' : a.edge}` }} data-face={placeholder ? 'placeholder' : show ? 'photo' : 'initials'}>
      {placeholder ? (
        <div className="flex h-full w-full items-center justify-center" style={{ color: '#1F1F1F', fontSize: 13, fontWeight: 800, letterSpacing: 2, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 8px, transparent 8px 16px)' }}>PHOTO</div>
      ) : show ? (
        <img src={optimizedImageUrl(t.photo as string, 320)} alt="" className="h-full w-full object-cover" onError={() => setFailed(t.photo)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden="true"
          style={{ color: a.ink, backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(255,255,255,.25) 0 18%, transparent 19%), repeating-linear-gradient(135deg, rgba(0,0,0,.05) 0 6px, transparent 6px 12px)' }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{initialsOf(t.stage ?? t.real)}</span>
        </div>
      )}
    </div>
  );
}

function Tile4({ t, filter, base, placeholder }: { t: Tile; filter: Filter; base: Base; placeholder?: boolean }) {
  const p = BASES[base];
  const lead = leadOf(t, filter);
  const name = tileName(t, filter);
  return (
    <Link to={`/__mock/s10/sheet?id=${t.id}&base=${base}`} className="block min-w-0" data-testid="wall-tile">
      <div className="relative">
        <Face t={t} lead={lead} base={base} placeholder={placeholder} />
        <NationalityFlag code={t.flag} size={40} placement="inset" />
        {t.nextDate ? <span data-testid="date-chip" className="absolute bottom-1 left-1" style={{ background: DATE_CHIP.bg, color: DATE_CHIP.text, border: `1px solid ${DATE_CHIP.border}`, fontSize: 10, fontWeight: 800, lineHeight: '14px', padding: '0 6px', borderRadius: 999 }}>{dateChip(t.nextDate)}</span> : null}
      </div>
      <div data-testid="tile-name" className="mt-1 break-words text-center" style={{ color: p.text, fontSize: 12, fontWeight: 700, lineHeight: '15px', maxHeight: 30, overflow: 'hidden' }}>{name}</div>
      <div className="mt-1 flex flex-wrap justify-center gap-[3px]">
        {t.roles.map((r) => <span key={r} data-testid="role-chip" data-role={r} style={{ background: p.chip[r].bg, color: p.chip[r].text, border: `1.5px solid ${p.chip[r].border}`, fontSize: 10, fontWeight: 700, lineHeight: '13px', padding: '0 5px', borderRadius: 999 }}>{SHORT[r]}</span>)}
      </div>
    </Link>
  );
}

function Wall({ tiles, filter, base, placeholder }: { tiles: Tile[]; filter: Filter; base: Base; placeholder?: boolean }) {
  const p = BASES[base];
  const want = FILTER_ROLE[filter];
  const list = tiles.filter((t) => !want || t.roles.includes(want)).sort((a, b) => Number(!!b.nextDate) - Number(!!a.nextDate));
  return (
    <div style={{ background: p.page, color: p.text }} className="px-3 pb-6 pt-3" data-testid="wall-root">
      <h1 className="text-[20px] font-extrabold leading-tight">Meet the people behind the nights</h1>
      <p className="mb-2 text-[13px]" style={{ color: p.muted }}>Tap a face to see where they are dancing, DJing or teaching next.</p>
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <span key={f.k} role="tab" aria-selected={f.k === filter} style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', background: f.k === filter ? p.text : 'transparent', color: f.k === filter ? p.page : p.text, border: `1.5px solid ${f.k === filter ? p.text : p.line}` }}>{f.label}</span>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px 8px' }} data-testid="wall-grid">
        {list.map((t) => <Tile4 key={t.id} t={t} filter={filter} base={base} placeholder={placeholder} />)}
      </div>
    </div>
  );
}

function Sheet({ tiles, base }: { tiles: Tile[]; base: Base }) {
  const [sp] = useSearchParams();
  const p = BASES[base];
  const t = tiles.find((x) => x.id === sp.get('id')) ?? tiles[0];
  const lead = t.roles[0] ?? 'dancer';
  const type: PersonType = lead;
  const { data: apps } = useProfileProgramAppearances(type, t.id, 1000);
  const next = useMemo(() => {
    const today = londonTodayKey();
    return (apps ?? []).filter((a) => a.event_id && (a.event_start_time ?? '').slice(0, 10) >= today).sort((x, y) => (x.event_start_time ?? '').localeCompare(y.event_start_time ?? ''))[0] ?? null;
  }, [apps]);
  const nextKey = next?.event_start_time?.slice(0, 10) ?? null;
  const words = t.roles.map((r) => ({ dj: 'DJ', dancer: 'dancer', teacher: 'teacher' }[r]));
  const line = `${words.join(', ').replace(/^./, (s) => s.toUpperCase())}${t.city ? ` in ${t.city}` : ''}.`;
  const dj = BASES[base].chip.dj;
  return (
    <div style={{ background: p.page, color: p.text, height: 844, position: 'relative', overflow: 'hidden' }} data-testid="sheet-root">
      <div aria-hidden="true" style={{ opacity: 0.4 }}><Wall tiles={tiles} filter="all" base={base} /></div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,12,8,.55)' }} />
      <section role="dialog" aria-label={t.stage ?? t.real} className="absolute bottom-0 left-0 w-full px-4 pb-6 pt-3" style={{ background: p.card, borderRadius: '20px 20px 0 0', border: `1px solid ${p.line}`, boxShadow: '0 -8px 30px rgba(0,0,0,.35)' }} data-testid="person-sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: p.line }} />
        <div className="flex items-center gap-3">
          <div style={{ width: 96, flex: '0 0 auto' }} className="relative"><Face t={t} lead={lead} base={base} /><NationalityFlag code={t.flag} size={96} placement="inset" /></div>
          <div className="min-w-0">
            <h2 className="break-words text-[22px] font-extrabold leading-tight" style={{ color: p.text }}>{t.stage ?? t.real}</h2>
            {t.stage ? <div className="text-[13px]" style={{ color: p.muted }}>{t.real}</div> : null}
            <div className="mt-1 flex flex-wrap gap-1">{t.roles.map((r) => <span key={r} data-testid="sheet-chip" style={{ background: p.chip[r].bg, color: p.chip[r].text, border: `1.5px solid ${p.chip[r].border}`, fontSize: 12, fontWeight: 700, padding: '1px 10px', borderRadius: 999 }}>{r === 'dj' && t.stage ? `DJ · ${t.stage}` : { dj: 'DJ', dancer: 'Dancer', teacher: 'Teacher', organiser: 'Organiser' }[r]}</span>)}</div>
          </div>
        </div>
        <p className="mt-3 text-[15px]">{line}</p>
        {next ? (
          <Link to={`/event/${next.event_id}`} data-testid="primary-cta" className="mt-4 flex items-center justify-center text-center" style={{ minHeight: 52, borderRadius: 14, background: dj.bg, color: dj.text, border: `2px solid ${dj.border}`, fontSize: 16, fontWeight: 800, padding: '0 14px' }}>
            Go to their next event{nextKey ? ` · ${dateChip(nextKey)}` : ''}
          </Link>
        ) : null}
        <Link to={`/people/${t.id}`} className="mt-3 block text-center text-[14px] font-bold underline" style={{ minHeight: 44, lineHeight: '44px' }}>See full profile</Link>
      </section>
    </div>
  );
}

const Label = ({ children }: { children: string }) => <div className="mb-1 text-center text-[15px] font-extrabold" style={{ color: '#222' }}>{children}</div>;

export default function S10Wall() {
  const { view } = useParams<{ view: string }>();
  const [sp] = useSearchParams();
  const base: Base = sp.get('base') === 'dark' ? 'dark' : 'cream';
  const { tiles, error } = useTiles();
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!tiles) return <p className="p-4" data-testid="s9-loading">Loading</p>;
  if (view === 'side') {
    return (
      <div data-testid="s10-root" data-ready="1" style={{ background: '#E5E5E5', padding: 12 }}>
        <div style={{ display: 'flex', gap: 16, width: 820 }}>
          {(['cream', 'dark'] as Base[]).map((b) => (
            <div key={b} style={{ width: 390, flex: '0 0 390px' }}><Label>{b === 'cream' ? 'A  warm cream' : 'B  warm dark'}</Label><div style={{ overflow: 'hidden', borderRadius: 8 }}><Wall tiles={tiles} filter="all" base={b} /></div></div>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'photo') {
    const sample = tiles.filter((t) => t.flag || t.nextDate).slice(0, 8).map((t) => ({ ...t, photo: 'x' }));
    return (
      <div data-testid="s10-root" data-ready="1" style={{ background: '#E5E5E5', padding: 12 }}>
        <div style={{ display: 'flex', gap: 16, width: 820 }}>
          {(['cream', 'dark'] as Base[]).map((b) => (
            <div key={b} style={{ width: 390, flex: '0 0 390px' }}><Label>{`${b === 'cream' ? 'A cream' : 'B dark'} - grey PHOTO blocks, NOT real faces`}</Label><div style={{ overflow: 'hidden', borderRadius: 8 }}><Wall tiles={sample} filter="all" base={b} placeholder /></div></div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full overflow-x-hidden" style={{ maxWidth: 430, background: BASES[base].page }} data-testid="s10-root" data-ready="1">
      {view === 'sheet' ? <Sheet tiles={tiles} base={base} />
        : view === 'page' ? <Wall tiles={tiles} filter="all" base={base} />
        : <Wall tiles={tiles} filter="all" base={base} />}
    </div>
  );
}
