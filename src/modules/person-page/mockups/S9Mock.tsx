// PROTOTYPE (search v7, S9): /__mock/s9/:view/:arg?  view = dancers | djs | teachers | teachers-empty | organiser | lineup.
// Dev or VITE_MOCKS=true only. REAL prod data (read-only reads through the public client); no live page is changed.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Headphones, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { renderPublicName, resolvePublicName } from '@/lib/publicName';
import { withPublicNames } from '@/lib/publicDancerNames';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';

type Row = Record<string, any>;
// The generated types do not know every read; these mocks only read.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: any; error: any }> };

const ORGANISER_ID = '5eb4681d-6359-457a-87bc-c3aa71b5be56'; // unidos-flow: 2 team members, both DJ + teacher
const EVENT_SERIES_ID = '34156f15-bf26-42bc-b6f1-bfb73007da43'; // live and the only DJ+teacher event of 14 whose programme an anonymous viewer can read

/** Up to two initials; a leading "DJ" is not a name. */
const initials = (name: string) => name.replace(/^dj\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
/** Photo with a deliberate fallback: initials when there is no photo OR the photo fails to load. */
export function Photo({ src, name, w, className, style }: { src: string | null | undefined; name: string; w: number; className: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`flex items-center justify-center rounded-full font-bold ${className}`} style={{ width: w, height: w, ...style }}>{initials(name)}</span>;
  return <img src={optimizedImageUrl(src, 160)} alt="" onError={() => setFailed(true)} className="rounded-full object-cover" style={{ width: w, height: w }} loading="lazy" />;
}
export const GOLD = '#E7BE6E';
const todayKey = () => new Date().toISOString().slice(0, 10);

/** Active roles for every person at once (person_roles is anon-readable). */
export function useRoles(ids: string[] | null) {
  const [roles, setRoles] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    if (!ids) return;
    (async () => {
      const m: Record<string, string[]> = {};
      for (let i = 0; i < ids.length; i += 80) {
        const { data } = await db.from('person_roles').select('person_id, role, is_active').in('person_id', ids.slice(i, i + 80));
        for (const r of (data ?? []) as Row[]) if (r.is_active !== false) (m[r.person_id] ??= []).push(r.role);
      }
      setRoles(m);
    })();
  }, [ids?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return roles;
}

/** People whose public teacher read is non-empty (a teacher page with something on it). */
export function useTeacherOk(ids: string[] | null) {
  const [ok, setOk] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!ids) return;
    Promise.all(ids.map(async (id) => {
      const { data } = await db.rpc('get_public_teacher_detail_v1', { p_entity_id: id });
      return Array.isArray(data) ? (data.length > 0 ? id : null) : data ? id : null;
    })).then((r) => setOk(new Set(r.filter(Boolean) as string[])));
  }, [ids?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return ok;
}

/** Ids of DJs with a gig today or later (the timeline read the DJ page itself uses). */
function useUpcomingDjs(ids: string[] | null) {
  const [set, setSet] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!ids) return;
    Promise.all(ids.map(async (id) => {
      const { data } = await db.rpc('get_profile_event_timeline_v2', { p_person_type: 'dj', p_person_id: id, p_limit: 1000, p_offset: 0 });
      return ((data ?? []) as Row[]).some((x) => (x.event_start_time ?? '').slice(0, 10) >= todayKey()) ? id : null;
    })).then((r) => setSet(new Set(r.filter(Boolean) as string[])));
  }, [ids?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return set;
}

const Count = ({ children }: { children: ReactNode }) => <p className="mb-2 text-center text-xs text-muted-foreground" data-testid="s9-count">{children}</p>;
export const Role = ({ children, gold }: { children: ReactNode; gold?: boolean }) => (
  <span className="rounded-full px-1.5 py-px text-[9px] font-bold" style={gold ? { background: '#1a1410', color: GOLD, border: `1px solid ${GOLD}` } : { border: '1px solid hsl(var(--primary) / .35)', color: 'hsl(var(--foreground))' }}>{children}</span>
);

// ------------------------------------------------------------------ 1. /dancers, Option 2
function Dancers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await db.from('dancer_profiles').select('id, first_name, avatar_url, nationality, dance_role, cities!based_city_id(name)').or('is_active.is.null,is_active.eq.true').order('created_at', { ascending: false });
      setRows(await withPublicNames(data ?? []));
    })();
  }, []);
  const roles = useRoles(rows ? rows.map((r) => r.id) : null);
  const djIds = rows && roles ? rows.filter((r) => roles[r.id]?.includes('djing')).map((r) => r.id) : null;
  const tOk = useTeacherOk(rows && roles ? rows.filter((r) => roles[r.id]?.includes('teaching')).map((r) => r.id) : null);
  if (!rows || !roles || !tOk) return <Skeleton className="h-64 w-full rounded-xl" />;
  const list = rows.filter((r) => roles[r.id]?.includes('dancing'));
  const noPhoto = list.filter((r) => !r.avatar_url).length;
  return (
    <section className="px-2" data-testid="s9-dancers" data-dj={djIds?.length}>
      <h2 className="mb-1 text-center text-2xl font-black"><span>Browse </span><span className="text-primary">Dancers</span></h2>
      <Count>{list.length} dancers (people who hold the dancing role; {rows.length - list.length} of {rows.length} active people are not listed here)</Count>
      <div className="grid grid-cols-4 gap-2">
        {list.map((d) => {
          const name = renderPublicName(d as never, 'Dancer');
          const also = [roles[d.id]?.includes('djing') ? 'DJ' : null, tOk.has(d.id) ? 'Teaches' : null].filter(Boolean) as string[];
          return (
            <Link key={d.id} to={`/dancers/${d.id}`} className="block rounded-xl border border-primary/20 bg-card p-2 text-center" style={{ minHeight: 96 }}>
              <div className="relative mx-auto mb-1 w-fit">
                <Photo src={d.avatar_url} name={name} w={36} className="border border-primary/25 bg-primary/10 text-[11px] text-primary" />
                <NationalityFlag code={pickNationalityCode(d)} size={36} />
              </div>
              <h3 className="line-clamp-2 text-[11px] font-bold leading-tight">{name}</h3>
              {also.length ? <div className="mt-1 flex flex-wrap justify-center gap-0.5">{also.map((a) => <Role key={a}>{a}</Role>)}</div> : null}
            </Link>
          );
        })}
      </div>
      <p className="sr-only" data-testid="s9-dancers-thin">{noPhoto} without photo</p>
    </section>
  );
}

// ------------------------------------------------------------------ 2. /djs, Option 2
function Djs() {
  useDjPageFonts();
  const [djs, setDjs] = useState<Row[] | null>(null);
  useEffect(() => { db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 }).then(({ data }) => setDjs(data ?? [])); }, []);
  const up = useUpcomingDjs(djs ? djs.map((d) => d.id) : null);
  if (!djs || !up) return <Skeleton className="h-64 w-full rounded-xl" />;
  const sorted = [...djs].sort((a, b) => Number(up.has(b.id)) - Number(up.has(a.id)));
  return (
    <div style={{ ...(djInkTheme as CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)', borderRadius: 22 }} className="p-3" data-testid="s9-djs">
      <h2 className="mb-1 text-center text-xl font-black" style={{ color: GOLD }}>Bachata DJs</h2>
      <p className="mb-3 text-center text-xs" style={{ opacity: 0.75 }}>{djs.length} DJs &middot; {up.size} with upcoming gigs (listed first). Stage name leads.</p>
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((d) => {
          const name = renderPublicName(d as never, 'DJ');
          const photo = Array.isArray(d.photo_url) ? d.photo_url[0] : d.photo_url;
          const live = up.has(d.id);
          return (
            <Link key={d.id} to={`/djs/${d.id}`} className="block rounded-xl p-2 text-center" style={{ background: 'var(--dj-tile)', border: `1px solid ${live ? GOLD : 'var(--dj-tile-border)'}`, minHeight: 112 }}>
              <div className="relative mx-auto mb-1.5 w-fit">
                <Photo src={photo} name={name} w={48} className="text-base font-black" style={{ background: '#120c14', color: GOLD, border: `1px solid ${GOLD}` }} />
                <NationalityFlag code={d.nationality_code} size={48} />
              </div>
              <p className="line-clamp-2 text-[12px] font-bold leading-tight">{name}</p>
              {d.city_name ? <p className="line-clamp-1 text-[10px]" style={{ opacity: 0.7 }}>{d.city_name}</p> : null}
              {live ? <span className="mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-bold" style={{ background: GOLD, color: '#120c14' }}><Headphones className="h-2.5 w-2.5" aria-hidden />Playing soon</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. /teachers, Option 2
function Teachers({ empty }: { empty?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { db.rpc('get_public_teachers_list_v1', { p_city_slug: null, p_limit: 200, p_offset: 0 }).then(({ data }) => setRows(data ?? [])); }, []);
  const ok = useTeacherOk(rows ? rows.map((r) => r.entity_id) : null);
  const names = useNames(rows ? rows.map((r) => r.entity_id) : null);
  if (!rows || !ok || !names) return <Skeleton className="h-64 w-full rounded-xl" />;
  // A teacher is listed only when there is a page to open. `empty` simulates a world where nobody qualifies.
  const list = empty ? [] : rows.filter((r) => ok.has(r.entity_id));
  if (list.length === 0) {
    return (
      <section className="px-3 py-10 text-center" data-testid="s9-teachers-empty">
        <h2 className="mb-2 text-xl font-black">Teachers</h2>
        <p className="mx-auto mb-4 max-w-xs text-sm text-muted-foreground">No teacher has a public page here yet. To find a class, look at what is on.</p>
        <Link to="/classes" className="inline-flex items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground" style={{ minHeight: 44 }}>Browse classes</Link>
      </section>
    );
  }
  return (
    <section className="px-2" data-testid="s9-teachers">
      <h2 className="mb-1 text-center text-2xl font-black"><span>Browse </span><span className="text-primary">Teachers</span></h2>
      <Count>{list.length} teachers, each with a page to open</Count>
      <div className="grid grid-cols-3 gap-2">
        {list.map((t) => {
          const name = names[t.entity_id];
          return (
            <Link key={t.entity_id} to={`/teachers/${t.entity_id}`} className="block rounded-xl border border-primary/20 bg-card p-2 text-center" style={{ minHeight: 110 }}>
              <div className="relative mx-auto mb-1 w-fit">
                <Photo src={t.photo_url} name={name} w={48} className="border border-primary/25 bg-primary/10 text-base text-primary" />
                <NationalityFlag code={t.nationality_code} size={48} />
              </div>
              <h3 className="line-clamp-2 text-[12px] font-bold leading-tight">{name}</h3>
              {t.city ? <p className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground"><MapPin className="h-2.5 w-2.5" aria-hidden />{t.city}</p> : null}
              {Array.isArray(t.teaching_styles) && t.teaching_styles[0] ? <span className="mt-1 inline-block rounded-full bg-primary/10 px-1.5 py-px text-[9px] text-primary">{t.teaching_styles[0]}</span> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Real (public) name for each person id, same resolver as /dancers. */
function useNames(ids: string[] | null) {
  const [m, setM] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!ids) return;
    (async () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 80) {
        const { data } = await db.from('dancer_profiles').select('id, first_name, avatar_url, nationality').in('id', ids.slice(i, i + 80));
        for (const r of await withPublicNames(data ?? [])) out[r.id] = renderPublicName(r as never, 'Teacher');
      }
      setM(out);
    })();
  }, [ids?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return m;
}

// ------------------------------------------------------------------ 4. organiser team strip, Option 2
type Member = { id: string; name: string; avatar: string | null; code: string | null; labels: string[]; href: string | null };

export function useTeam(): Member[] | null {
  const [team, setTeam] = useState<Member[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: tr } = await db.from('organiser_team_members').select('id, role, member_profile_id, sort_order').eq('organiser_profile_id', ORGANISER_ID).eq('is_active', true).order('sort_order', { ascending: true, nullsFirst: false });
      const ids = ((tr ?? []) as Row[]).map((r) => r.member_profile_id);
      const [{ data: dp }, { data: pr }, { data: djs }] = await Promise.all([
        db.from('dancer_profiles').select('id, first_name, avatar_url, nationality').in('id', ids),
        db.from('person_roles').select('person_id, role, is_active').in('person_id', ids),
        db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 }),
      ]);
      const masked = await withPublicNames(dp ?? []);
      const teacherOk: string[] = [];
      for (const id of ids) { const { data } = await db.rpc('get_public_teacher_detail_v1', { p_entity_id: id }); if (Array.isArray(data) ? data.length : data) teacherOk.push(id); }
      setTeam(((tr ?? []) as Row[]).map((t) => {
        const d = masked.find((x: Row) => x.id === t.member_profile_id) ?? {};
        const rs = ((pr ?? []) as Row[]).filter((r) => r.person_id === t.member_profile_id && r.is_active !== false).map((r) => r.role);
        const dj = ((djs ?? []) as Row[]).find((x) => x.id === t.member_profile_id);
        const isDj = rs.includes('djing') && !!dj, isTeacher = teacherOk.includes(t.member_profile_id);
        const labels = [isDj ? 'DJ' : null, isTeacher ? 'Teacher' : null].filter(Boolean) as string[];
        // NAME RULE: the stage name leads when the member is shown as a DJ. LINK RULE: DJ page, else teacher page (only with content), else dancer page, else no link.
        const name = isDj ? (resolvePublicName(dj as never) || renderPublicName(d as never, 'Team member')) : renderPublicName(d as never, 'Team member');
        const href = isDj ? `/djs/${t.member_profile_id}` : isTeacher ? `/teachers/${t.member_profile_id}` : rs.includes('dancing') ? `/dancers/${t.member_profile_id}` : null;
        return { id: t.id, name, avatar: d.avatar_url ?? null, code: pickNationalityCode(d) ?? null, labels: labels.length ? labels : [t.role || 'Team'], href };
      }));
    })();
  }, []);
  return team;
}

function OrganiserTeam() {
  const team = useTeam();
  if (!team) return <Skeleton className="h-40 w-full rounded-xl" />;
  return (
    <section className="rounded-[14px] px-4 py-4" style={{ background: '#120c14', color: '#F6F1EA' }} data-testid="s9-organiser">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold uppercase tracking-[2px]" style={{ color: GOLD }}>Teachers &amp; DJs</h2>
        <span className="text-xs" style={{ opacity: 0.7 }}>{team.length} members</span>
      </div>
      <div className="flex justify-center gap-4">
        {team.map((m) => {
          const inner = (
            <div className="w-[104px] text-center">
              <div className="relative mb-1.5 aspect-square rounded-full p-[2.5px]" style={{ background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)' }}>
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)' }}>
                  <Photo src={m.avatar} name={m.name} w={104} className="text-xl font-normal" style={{ background: 'transparent', color: 'rgba(251,239,196,.8)' }} />
                </div>
                <NationalityFlag code={m.code} size={80} />
              </div>
              <div className="text-[13px] font-semibold leading-tight">{m.name}</div>
              <div className="mt-0.5 flex flex-wrap justify-center gap-1">{m.labels.map((l) => <Role key={l} gold>{l}</Role>)}</div>
            </div>
          );
          return m.href ? <Link key={m.id} to={m.href} data-href={m.href} aria-label={`${m.name}, ${m.labels.join(' and ')}`}>{inner}</Link> : <div key={m.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 5. event lineup, Option 2
function Lineup() {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    (async () => {
      // The program tables are not anon-readable; the event page reads the programme through event_view_p5, so do the same.
      const { data: view } = await db.rpc('event_view_p5', { p_target: { series_id: EVENT_SERIES_ID }, p_viewer: { role: 'anon', shape: 'legacy_compat' } });
      const rows: Row[] = [];
      const walk = (n: any) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n.profile_type && n.profile_id) rows.push(n); else Object.values(n).forEach(walk); } };
      walk(view);
      const ids = [...new Set(rows.map((r) => r.profile_id))] as string[];
      const { data: dp } = await db.from('dancer_profiles').select('id, first_name, avatar_url, nationality').in('id', ids);
      const masked = await withPublicNames(dp ?? []);
      const { data: djs } = await db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 });
      const ok: string[] = [];
      for (const id of ids) { const { data } = await db.rpc('get_public_teacher_detail_v1', { p_entity_id: id }); if (Array.isArray(data) ? data.length : data) ok.push(id); }
      setPeople(rows.map((r): Person => {
        const d = masked.find((x: Row) => x.id === r.profile_id) ?? {};
        const isDj = r.profile_type === 'dj';
        const dj = ((djs ?? []) as Row[]).find((x) => x.id === r.profile_id);
        return {
          id: r.profile_id, level: null, avatarUrl: r.avatar_url ?? d.avatar_url ?? null, nationalityCode: r.nationality_code ?? pickNationalityCode(d) ?? null,
          // NAME RULE: stage name on a DJ chip, real name on a teacher chip. LINK RULE: teacher chip links only when the page has content.
          name: isDj ? ((dj ? resolvePublicName(dj as never) : null) ?? (d.id ? renderPublicName(d as never, 'DJ') : r.display_name)) : (d.id ? renderPublicName(d as never, 'Teacher') : r.display_name),
          role: isDj ? 'DJ' : 'Teacher', profileType: isDj ? 'dj' : 'teacher',
          href: isDj ? `/djs/${r.profile_id}` : ok.includes(r.profile_id) ? `/teachers/${r.profile_id}` : null,
        } as unknown as Person;
      }));
    })();
  }, []);
  if (!people) return <Skeleton className="h-32 w-full rounded-xl" />;
  return (
    <section className="rounded-[14px] p-3" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / .25)' }} data-testid="s9-lineup">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-primary">Lineup</h2>
      <div className="flex flex-wrap gap-3">
        {people.map((p, i) => <PersonChip key={`${p.id}-${i}`} person={p} size="lg" layout="stacked" showRole context="s9-mock" />)}
      </div>
      <p className="sr-only" data-testid="s9-lineup-links">{people.map((p) => `${p.role}:${p.name}:${p.href ?? 'none'}`).join(' | ')}</p>
    </section>
  );
}

export default function S9Mock() {
  const { view } = useParams<{ view: string }>();
  return (
    <GlobalLayout showSubheader={false}>
      <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-3" style={{ minHeight: 700 }} data-testid="s9-root">
        {view === 'dancers' ? <Dancers />
          : view === 'djs' ? <Djs />
          : view === 'teachers' ? <Teachers />
          : view === 'teachers-empty' ? <Teachers empty />
          : view === 'organiser' ? <OrganiserTeam />
          : view === 'lineup' ? <Lineup />
          : <p>Unknown view</p>}
      </div>
    </GlobalLayout>
  );
}
