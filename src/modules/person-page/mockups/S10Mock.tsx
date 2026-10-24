// PROTOTYPE (search v7, S10): /__mock/s10/:place/:variant  place = organiser | dancers | search, variant = A | B.
// A = the small "DJ" label is always shown. B = dropped when the shown name already starts with "DJ" (case-insensitive).
// Dev or VITE_MOCKS=true only. REAL prod data, read-only. No teacher link anywhere.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { renderPublicName, resolvePublicName } from '@/lib/publicName';
import { withPublicNames } from '@/lib/publicDancerNames';
import { Photo, Role, GOLD, useRoles, useTeam } from './S9Mock';

type Row = Record<string, any>;
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: any; error: any }> };

const startsWithDj = (name: string) => /^\s*dj\b/i.test(name);
/** The one rule under test. */
const showDjLabel = (variant: string, name: string) => variant !== 'B' || !startsWithDj(name);

function useDjs() {
  const [djs, setDjs] = useState<Row[] | null>(null);
  useEffect(() => { db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 }).then(({ data }) => setDjs(data ?? [])); }, []);
  return djs;
}
const djName = (d: Row) => resolvePublicName(d as never) || renderPublicName(d as never, 'DJ');

// ---- 1. organiser team strip (same strip as S9; "Teacher" stays a plain label, no teacher link)
function Organiser({ variant }: { variant: string }) {
  const team = useTeam();
  if (!team) return <Skeleton className="h-40 w-full rounded-xl" />;
  return (
    <section className="rounded-[14px] px-4 py-4" style={{ background: '#120c14', color: '#F6F1EA' }} data-testid="s10-organiser">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold uppercase tracking-[2px]" style={{ color: GOLD }}>Teachers &amp; DJs</h2>
        <span className="text-xs" style={{ opacity: 0.7 }}>{team.length} members</span>
      </div>
      <div className="flex justify-center gap-4">
        {team.map((m) => {
          const labels = m.labels.filter((l) => l !== 'DJ' || showDjLabel(variant, m.name));
          const href = m.href && !m.href.startsWith('/teachers/') ? m.href : null; // teacher pages stay OFF
          const inner = (
            <div className="w-[104px] text-center">
              <div className="relative mb-1.5 aspect-square rounded-full p-[2.5px]" style={{ background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)' }}>
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)' }}>
                  <Photo src={m.avatar} name={m.name} w={104} className="text-xl font-normal" style={{ background: 'transparent', color: 'rgba(251,239,196,.8)' }} />
                </div>
                <NationalityFlag code={m.code} size={80} />
              </div>
              <div className="text-[13px] font-semibold leading-tight">{m.name}</div>
              <div className="mt-0.5 flex min-h-[16px] flex-wrap justify-center gap-1">{labels.map((l) => <Role key={l} gold>{l}</Role>)}</div>
            </div>
          );
          return href ? <Link key={m.id} to={href} aria-label={m.name}>{inner}</Link> : <div key={m.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}

// ---- 2. /dancers tiles that carry a DJ label (crop: DJ-prefixed names + plain names)
function Dancers({ variant }: { variant: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const djs = useDjs();
  useEffect(() => {
    (async () => {
      const { data } = await db.from('dancer_profiles').select('id, first_name, avatar_url, nationality, dance_role').or('is_active.is.null,is_active.eq.true').order('created_at', { ascending: false });
      setRows(await withPublicNames(data ?? []));
    })();
  }, []);
  const roles = useRoles(rows ? rows.map((r) => r.id) : null);
  if (!rows || !roles || !djs) return <Skeleton className="h-64 w-full rounded-xl" />;
  const tiles = rows.filter((r) => roles[r.id]?.includes('dancing') && roles[r.id]?.includes('djing')).map((r) => {
    const dj = djs.find((x) => x.id === r.id);
    return { r, name: dj ? djName(dj) : renderPublicName(r as never, 'Dancer') }; // stage name leads on DJ things
  });
  const pre = tiles.filter((t) => startsWithDj(t.name)), plain = tiles.filter((t) => !startsWithDj(t.name));
  const crop = [...pre.slice(0, 3), ...plain.slice(0, 3)];
  return (
    <section className="px-2" data-testid="s10-dancers" data-prefixed={pre.length} data-crop={crop.length}>
      <h2 className="mb-1 text-center text-2xl font-black"><span>Browse </span><span className="text-primary">Dancers</span></h2>
      <p className="mb-2 text-center text-xs text-muted-foreground">Crop: dancers who also DJ ({pre.length} of {tiles.length} start with &ldquo;DJ&rdquo;)</p>
      <div className="grid grid-cols-3 gap-2">
        {crop.map(({ r, name }) => (
          <Link key={r.id} to={`/dancers/${r.id}`} className="block rounded-xl border border-primary/20 bg-card p-2 text-center" style={{ minHeight: 104 }}>
            <div className="relative mx-auto mb-1 w-fit">
              <Photo src={r.avatar_url} name={name} w={44} className="border border-primary/25 bg-primary/10 text-[12px] text-primary" />
              <NationalityFlag code={pickNationalityCode(r)} size={44} />
            </div>
            <h3 className="line-clamp-2 text-[12px] font-bold leading-tight">{name}</h3>
            <div className="mt-1 flex min-h-[16px] flex-wrap justify-center gap-0.5">{showDjLabel(variant, name) ? <Role>DJ</Role> : null}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---- 3. search result row (S8 search card look) for a DJ-prefixed person, plus a plain-named DJ beside it
const LABEL: Record<string, string> = { dancing: 'Dancer', djing: 'DJ', teaching: 'Teaches' };
const Chip = ({ children }: { children: ReactNode }) => <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-foreground">{children}</span>;

function Search({ variant }: { variant: string }) {
  const djs = useDjs();
  const ids = djs ? djs.map((d) => d.id) : null;
  const roles = useRoles(ids);
  if (!djs || !roles) return <Skeleton className="h-52 w-full rounded-xl" />;
  const named = djs.map((d) => ({ d, name: djName(d) }));
  const picks = [named.find((n) => startsWithDj(n.name)), named.find((n) => !startsWithDj(n.name) && n.d.photo_url)].filter(Boolean) as { d: Row; name: string }[];
  return (
    <div data-testid="s10-search" data-prefixed={named.filter((n) => startsWithDj(n.name)).length} data-total={named.length}>
      <p className="mb-2 text-[13px] text-muted-foreground">People (one row per person; role labels, not one row per role)</p>
      <div className="grid grid-cols-2 gap-3">
        {picks.map(({ d, name }) => {
          const photo = Array.isArray(d.photo_url) ? d.photo_url[0] : d.photo_url;
          const chips = (roles[d.id] ?? ['djing']).filter((r) => LABEL[r]).filter((r) => r !== 'djing' || showDjLabel(variant, name));
          return (
            <Card key={d.id} className="h-full overflow-hidden border-primary/15">
              <div className="relative aspect-[4/3] bg-muted/50">
                {photo ? <img src={optimizedImageUrl(photo, 320)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><User className="h-8 w-8" /></div>}
                <NationalityFlag code={d.nationality_code ?? null} size={TILE_FLAG_SIZE} placement="inset" />
              </div>
              <div className="p-3">
                <h3 className="break-words text-sm font-bold text-foreground">{name}</h3>
                <div className="mt-1.5 flex min-h-[22px] flex-wrap gap-1">{chips.map((r) => <Chip key={r}>{LABEL[r]}</Chip>)}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function S10Mock() {
  const { place, variant = 'A' } = useParams<{ place: string; variant: string }>();
  return (
    <GlobalLayout showSubheader={false}>
      <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-3" style={{ minHeight: 700 }} data-testid="s10-root">
        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Variant {variant}: {variant === 'B' ? 'label dropped when the name starts with DJ' : 'label always shown'}</p>
        {place === 'organiser' ? <Organiser variant={variant} /> : place === 'dancers' ? <Dancers variant={variant} /> : place === 'search' ? <Search variant={variant} /> : <p>Unknown place</p>}
      </div>
    </GlobalLayout>
  );
}
