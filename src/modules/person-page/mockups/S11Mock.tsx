// PROTOTYPE (search v7, S11 FINAL): /__mock/s11/:view/:fixture?
// view = dancer | dj | teacheronly | dancers | djs | organiser | lineup | search.
// Dev or VITE_MOCKS=true only. REAL prod data (read-only reads through the public client); no live page is changed.
// Owner decisions 1-10 of briefs/S11-final-mockups-brief.md are applied here. NO teacher link anywhere ("Teaches" is plain text).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Headphones, Share2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { renderPublicName, resolvePublicName } from '@/lib/publicName';
import { withPublicNames } from '@/lib/publicDancerNames';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { PublicDancerPageV2 } from '@/modules/dancer-app/public-page/PublicDancerPageV2';
import { buildPublicDancerPage, shareDancerPage, NO_EXTRAS, type PublicDancerPageModel } from '@/modules/dancer-app/public-page/model';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';
import { FIXTURES, type FixtureKey } from './fixtures';
import { TEAL, DjBody, useMockData, useDjGigs, type Data } from './MockPersonPage';
import { Photo, Role, GOLD, useRoles, useTeacherOk } from './S9Mock';

type Row = Record<string, any>;
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: any; error: any }> };
const todayKey = () => new Date().toISOString().slice(0, 10);

const ORGANISER_ID = '5eb4681d-6359-457a-87bc-c3aa71b5be56'; // unidos-flow
const LEGACY_EVENT_ID = '4ec7a3d5-02bb-4e80-9439-9db4766b00b2'; // Pura Nights, Ealing (the site opens events by the LEGACY id)

// ---------------------------------------------------------------- shared reads
type Roles = { dancing: boolean; djing: boolean; teaching: boolean; teacherOk: boolean };

/** What the person holds (roles are public) plus whether the teacher read has content (plain "Teaches" text only). */
function useWho(id: string): Roles | null {
  const roles = useRoles([id]);
  const ok = useTeacherOk([id]);
  if (!roles || !ok) return null;
  const r = roles[id] ?? [];
  return { dancing: r.includes('dancing'), djing: r.includes('djing'), teaching: r.includes('teaching'), teacherOk: ok.has(id) };
}

/** Stage name (DJ things only); null when it equals the real name. */
const stageOf = (d: Data, real: string) => {
  const s = d.dj ? resolvePublicName(d.dj as never) : null;
  return s && s !== real ? s : null;
};
const realOf = (d: Data) => (d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never).displayName : null) ?? d.person.name ?? 'Bachata Calendar profile';

// ---------------------------------------------------------------- Also bar (replaces the live AlsoRoles row)
type World = 'teal' | 'gold';
function AlsoBar({ world, links, plain }: { world: World; links: { to: string; label: string }[]; plain: string[] }) {
  if (links.length === 0 && plain.length === 0) return null;
  const c = world === 'gold' ? { b: GOLD, t: GOLD, bg: '#120c14', m: 'hsl(var(--muted-foreground))' } : { b: TEAL.border, t: TEAL.accent, bg: TEAL.page, m: TEAL.muted };
  return (
    <nav aria-label="Also" data-testid="s11-also" className="mb-3 flex flex-wrap items-center gap-2 text-[14px]" style={{ color: c.m }}>
      <span>Also:</span>
      {links.map((l) => (
        <Link key={l.label} to={l.to} className="inline-flex items-center rounded-full px-3 font-bold" style={{ minHeight: 44, border: `1px solid ${c.b}`, color: c.t, background: c.bg }}>{l.label}</Link>
      ))}
      {plain.map((p) => <span key={p} data-testid="s11-also-plain" className="px-1 text-[13px] italic">&middot; {p}</span>)}
    </nav>
  );
}

function ShareBtn({ title, path, world }: { title: string; path: string; world: World }) {
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    const env = { share: typeof navigator !== 'undefined' && navigator.share ? (x: { title?: string; url?: string }) => navigator.share(x) : undefined,
      writeText: typeof navigator !== 'undefined' && navigator.clipboard ? (t: string) => navigator.clipboard.writeText(t) : undefined };
    const out = await shareDancerPage(env as never, title, `${window.location.origin}${path}`);
    setNote(out === 'copied' ? 'Link copied.' : null);
  };
  return (
    <div className="mb-1 flex items-center justify-end gap-2">
      {note ? <span role="status" className="text-[13px]">{note}</span> : null}
      <button type="button" onClick={go} className="inline-flex items-center gap-1.5 rounded-full px-3 text-[14px] font-bold" style={{ minHeight: 44, background: world === 'gold' ? GOLD : TEAL.accent, color: '#06191F' }}>
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </button>
    </div>
  );
}

/** Bar contents for a page: links to the OTHER role pages that exist, "Teaches" as plain text only. */
function barFor(current: 'dancer' | 'dj', fixture: FixtureKey, d: Data, w: Roles, real: string) {
  const links: { to: string; label: string }[] = [];
  const stage = stageOf(d, real);
  if (current !== 'dj' && w.djing && d.dj) links.push({ to: `/__mock/s11/dj/${fixture}`, label: stage ? `DJ as ${stage}` : 'DJ' });
  if (current !== 'dancer' && w.dancing) links.push({ to: `/__mock/s11/dancer/${fixture}`, label: 'Dances' });
  return { links, plain: w.teacherOk ? ['Teaches'] : [] };
}

// ---------------------------------------------------------------- 1. dancer page, FINAL
function DancerPage({ fixture }: { fixture: FixtureKey }) {
  const { data: d, error } = useMockData(fixture);
  const w = useWho(FIXTURES[fixture].id);
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!d || !w) return <Skeleton className="h-64 w-full rounded-xl" />;
  const view = d.dancerRow ? mapDancerPublicProfile(d.dancerRow as never) : null;
  if (!view) return <p className="p-4">Dancer not found</p>;
  const gallery = (d.dancerRow as { gallery_urls?: unknown }).gallery_urls;
  // Same inputs as the live /dancers/:id (real extras read, gallery list); the ONLY addition is the songs block below.
  const model: PublicDancerPageModel = buildPublicDancerPage(view, d.extras ?? NO_EXTRAS, Array.isArray(gallery) ? gallery : []);
  const bar = barFor('dancer', fixture, d, w, realOf(d));
  return (
    <>
      <AlsoBar world="teal" {...bar} />
      <PublicDancerPageV2 model={model} extrasOk pathname={`/dancers/${view.id}`} profileId={view.id} />
      {model.songs.length > 0 ? (
        <section aria-label="Favourite songs" data-testid="s11-songs" className="mt-3 rounded-[14px] p-3.5" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}`, color: TEAL.text }}>
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px]" style={{ color: TEAL.accent }}>Favourite songs</h2>
          <ul className="space-y-1">{model.songs.map((s, i) => <li key={i} className="break-words text-[14px]">{s}</li>)}</ul>
        </section>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 2. DJ page, FINAL
function DjPage({ fixture }: { fixture: FixtureKey }) {
  const { data: d, error } = useMockData(fixture);
  const w = useWho(FIXTURES[fixture].id);
  if (error) return <p role="alert" className="p-4">Could not load: {error}</p>;
  if (!d || !w) return <Skeleton className="h-64 w-full rounded-xl" />;
  const real = realOf(d);
  const bar = barFor('dj', fixture, d, w, real);
  return (
    <>
      <AlsoBar world="gold" {...bar} />
      <ShareBtn world="gold" title={`${stageOf(d, real) ?? real} on Bachata Calendar`} path={`/djs/${d.person.id}`} />
      <DjBody d={d} />
    </>
  );
}

// ---------------------------------------------------------------- search card (one row per person)
const Chip = ({ children }: { children: ReactNode }) => <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-semibold text-foreground">{children}</span>;

function PersonCardRow({ fixture }: { fixture: FixtureKey }) {
  const { data: d } = useMockData(fixture);
  const w = useWho(FIXTURES[fixture].id);
  const gigs = useDjGigs(FIXTURES[fixture].id);
  if (!d || !w) return <Skeleton className="h-52 w-full rounded-xl" />;
  const real = realOf(d);
  const stage = stageOf(d, real);
  const photo = d.person.avatarUrl ?? (Array.isArray(d.dj?.photo_url) ? (d.dj?.photo_url as string[])[0] : (d.dj?.photo_url as string | undefined)) ?? null;
  // NAME RULE: real name is the title; the stage name sits on the DJ label. LEAD ROLE: DJ with an upcoming gig, else dancing.
  const chips = [w.dancing ? 'Dancer' : null, w.djing && d.dj ? (stage ? `DJ · ${stage}` : 'DJ') : null, w.teaching ? 'Teaches' : null].filter(Boolean) as string[];
  const lead = w.djing && d.dj && gigs.upcoming.length > 0 ? 'dj' : w.dancing ? 'dancer' : w.djing && d.dj ? 'dj' : null;
  const body = (
    <Card className="h-full overflow-hidden border-primary/15">
      <div className="relative aspect-[4/3] bg-muted/50">
        {photo ? <img src={optimizedImageUrl(photo, 320)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><User className="h-8 w-8" /></div>}
        <NationalityFlag code={d.dancerRow ? pickNationalityCode(d.dancerRow) : null} size={TILE_FLAG_SIZE} placement="inset" />
      </div>
      <div className="p-3">
        <h3 className="break-words text-sm font-bold text-foreground">{real}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1">{chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>
      </div>
    </Card>
  );
  return lead ? <Link to={`/${lead === 'dj' ? 'djs' : 'dancers'}/${d.person.id}`} data-href={`/${lead === 'dj' ? 'djs' : 'dancers'}/${d.person.id}`}>{body}</Link> : <div data-href="none">{body}</div>;
}

function Search() {
  return (
    <div data-testid="s11-search">
      <p className="mb-2 text-[13px] text-muted-foreground">People (one row per person; real name leads; role labels; the stage name sits on the DJ label)</p>
      <div className="grid grid-cols-2 gap-3"><PersonCardRow fixture="threerole" /></div>
    </div>
  );
}

// ---------------------------------------------------------------- 3. teacher-only person, FINAL
function TeacherOnly() {
  return (
    <div data-testid="s11-teacheronly">
      <p className="mb-2 rounded-lg border border-primary/30 p-2 text-[12px] text-foreground"><b>FINAL.</b> A teacher-only person has NO page of their own. Nothing links to them (no <code>/teachers/&hellip;</code>, no dancer page). They appear in the two places below, as plain, non-clickable text.</p>
      <p className="mb-1 text-[13px] text-muted-foreground">In search (card is not a link):</p>
      <div className="mb-4 grid grid-cols-2 gap-3"><TeacherOnlyCard /></div>
      <p className="mb-1 text-[13px] text-muted-foreground">In an event lineup (chip has no link):</p>
      <TeacherOnlyChip />
    </div>
  );
}
function useTeacherOnly() {
  const { data: d } = useMockData('tcher');
  return d;
}
function TeacherOnlyCard() {
  const { data: d } = useMockData('tcher');
  if (!d) return <Skeleton className="h-52 w-full rounded-xl" />;
  const photo = d.person.avatarUrl;
  return (
    <div data-href="none"><Card className="h-full overflow-hidden border-primary/15">
      <div className="relative aspect-[4/3] bg-muted/50">
        {photo ? <img src={optimizedImageUrl(photo, 320)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground/40"><User className="h-8 w-8" /></div>}
      </div>
      <div className="p-3"><h3 className="break-words text-sm font-bold text-foreground">{realOf(d)}</h3><div className="mt-1.5 flex flex-wrap gap-1"><Chip>Teaches</Chip></div></div>
    </Card></div>
  );
}
function TeacherOnlyChip() {
  const d = useTeacherOnly();
  if (!d) return <Skeleton className="h-24 w-full rounded-xl" />;
  const p = { id: d.person.id, level: null, avatarUrl: d.person.avatarUrl, nationalityCode: null, name: realOf(d), role: 'Teacher', profileType: 'teacher', href: null } as unknown as Person;
  return <section className="rounded-[14px] p-3" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / .25)' }}><PersonChip person={p} size="lg" layout="stacked" showRole context="s11-mock" /></section>;
}

// ---------------------------------------------------------------- 4. /dancers, FINAL
function Dancers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await db.from('dancer_profiles').select('id, first_name, avatar_url, nationality, dance_role, cities!based_city_id(name)').or('is_active.is.null,is_active.eq.true').order('created_at', { ascending: false });
      setRows(await withPublicNames(data ?? []));
    })();
  }, []);
  const roles = useRoles(rows ? rows.map((r) => r.id) : null);
  const tOk = useTeacherOk(rows && roles ? rows.filter((r) => roles[r.id]?.includes('teaching')).map((r) => r.id) : null);
  if (!rows || !roles || !tOk) return <Skeleton className="h-64 w-full rounded-xl" />;
  const list = rows.filter((r) => roles[r.id]?.includes('dancing')); // decision 8: only people with the dancing role
  return (
    <section className="px-2" data-testid="s11-dancers" data-count={list.length}>
      <h2 className="mb-1 text-center text-2xl font-black"><span>Browse </span><span className="text-primary">Dancers</span></h2>
      <p className="mb-2 text-center text-xs text-muted-foreground">{list.length} dancers</p>
      <div className="grid grid-cols-4 gap-2">
        {list.map((d) => {
          const name = renderPublicName(d as never, 'Dancer'); // real name on dancer things (decision 2)
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
    </section>
  );
}

// ---------------------------------------------------------------- 5. /djs, FINAL
function Djs() {
  useDjPageFonts();
  const [djs, setDjs] = useState<Row[] | null>(null);
  useEffect(() => { db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 }).then(({ data }) => setDjs(data ?? [])); }, []);
  const [up, setUp] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!djs) return;
    Promise.all(djs.map(async (x) => {
      const { data } = await db.rpc('get_profile_event_timeline_v2', { p_person_type: 'dj', p_person_id: x.id, p_limit: 1000, p_offset: 0 });
      return ((data ?? []) as Row[]).some((e) => (e.event_start_time ?? '').slice(0, 10) >= todayKey()) ? x.id : null;
    })).then((r) => setUp(new Set(r.filter(Boolean) as string[])));
  }, [djs]);
  if (!djs || !up) return <Skeleton className="h-64 w-full rounded-xl" />;
  const sorted = [...djs].sort((a, b) => Number(up.has(b.id)) - Number(up.has(a.id)));
  return (
    <div style={{ ...(djInkTheme as CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)', borderRadius: 22 }} className="p-3" data-testid="s11-djs" data-total={djs.length} data-soon={up.size}>
      <h2 className="mb-1 text-center text-xl font-black" style={{ color: GOLD }}>Bachata DJs</h2>
      <p className="mb-3 text-center text-xs" style={{ opacity: 0.75 }}>{djs.length} DJs &middot; {up.size} playing soon</p>
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((d) => {
          const name = renderPublicName(d as never, 'DJ'); // stage name on DJ things (decision 2)
          const photo = Array.isArray(d.photo_url) ? d.photo_url[0] : d.photo_url;
          const live = up.has(d.id);
          return (
            <Link key={d.id} to={`/djs/${d.id}`} className="block rounded-xl p-2 text-center" style={{ background: 'var(--dj-tile)', border: `1px solid ${live ? GOLD : 'var(--dj-tile-border)'}`, minHeight: 124 }}>
              <div className="relative mx-auto mb-1.5 w-fit">
                <Photo src={photo} name={name} w={48} className="text-base font-black" style={{ background: '#120c14', color: GOLD, border: `1px solid ${GOLD}` }} />
                <NationalityFlag code={d.nationality_code} size={48} />
              </div>
              <p className="line-clamp-2 text-[12px] font-bold leading-tight">{name}</p>
              {d.city_name ? <p className="line-clamp-1 text-[10px]" style={{ opacity: 0.7 }}>{d.city_name}</p> : null}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                <Role gold>DJ</Role>{/* decision 9: ALWAYS shown, even on names starting "DJ" */}
                {live ? <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-bold" style={{ background: GOLD, color: '#120c14' }}><Headphones className="h-2.5 w-2.5" aria-hidden />Playing soon</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 6. organiser team strip, FINAL (link rule: DJ page, else dancer page, else none)
type Member = { id: string; name: string; avatar: string | null; code: string | null; labels: string[]; href: string | null };
function useTeam(): Member[] | null {
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
        const d: Row = masked.find((x: Row) => x.id === t.member_profile_id) ?? {};
        const rs = ((pr ?? []) as Row[]).filter((r) => r.person_id === t.member_profile_id && r.is_active !== false).map((r) => r.role);
        const dj = ((djs ?? []) as Row[]).find((x) => x.id === t.member_profile_id);
        const isDj = rs.includes('djing') && !!dj;
        const labels = [isDj ? 'DJ' : null, teacherOk.includes(t.member_profile_id) ? 'Teaches' : null].filter(Boolean) as string[];
        const name = isDj ? (resolvePublicName(dj as never) || renderPublicName(d as never, 'Team member')) : renderPublicName(d as never, 'Team member');
        const href = isDj ? `/djs/${t.member_profile_id}` : rs.includes('dancing') ? `/dancers/${t.member_profile_id}` : null;
        return { id: t.id, name, avatar: d.avatar_url ?? null, code: pickNationalityCode(d) ?? null, labels, href };
      }));
    })();
  }, []);
  return team;
}

function OrganiserStrip() {
  const team = useTeam();
  if (!team) return <Skeleton className="h-40 w-full rounded-xl" />;
  return (
    <section className="rounded-[14px] px-4 py-4" style={{ background: '#120c14', color: '#F6F1EA' }} data-testid="s11-organiser">
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
          return m.href ? <Link key={m.id} to={m.href} data-href={m.href} aria-label={m.name}>{inner}</Link> : <div key={m.id} data-href="none">{inner}</div>;
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- 7. event lineup, FINAL (legacy id; name rule; link rule)
function Lineup() {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: view } = await db.rpc('event_view_p5', { p_target: { series_id: LEGACY_EVENT_ID }, p_viewer: { role: 'anon', shape: 'legacy_compat' } });
      const rows: Row[] = [];
      const walk = (n: any) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n.profile_type && n.profile_id) rows.push(n); else Object.values(n).forEach(walk); } };
      walk(view);
      const ids = [...new Set(rows.map((r) => r.profile_id))] as string[];
      const [{ data: dp }, { data: djs }, { data: pr }] = await Promise.all([
        db.from('dancer_profiles').select('id, first_name, avatar_url, nationality').in('id', ids),
        db.rpc('list_public_djs_v1', { p_city_id: null, p_limit: 200 }),
        db.from('person_roles').select('person_id, role, is_active').in('person_id', ids),
      ]);
      const masked = await withPublicNames(dp ?? []);
      setPeople(rows.map((r): Person => {
        const d: Row = masked.find((x: Row) => x.id === r.profile_id) ?? {};
        const rs = ((pr ?? []) as Row[]).filter((x) => x.person_id === r.profile_id && x.is_active !== false).map((x) => x.role);
        const dj = ((djs ?? []) as Row[]).find((x) => x.id === r.profile_id);
        const isDjChip = r.profile_type === 'dj';
        const real = d.id ? renderPublicName(d as never, 'Teacher') : r.display_name;
        // NAME RULE: stage name on the DJ chip, real name on the teacher chip. LINK RULE: DJ page if they DJ, else dancer page if they dance, else none.
        const href = dj ? `/djs/${r.profile_id}` : rs.includes('dancing') ? `/dancers/${r.profile_id}` : null;
        return {
          id: r.profile_id, level: null, avatarUrl: r.avatar_url ?? d.avatar_url ?? null, nationalityCode: r.nationality_code ?? pickNationalityCode(d) ?? null,
          name: isDjChip ? ((dj ? resolvePublicName(dj as never) : null) ?? real) : real,
          role: isDjChip ? 'DJ' : 'Teacher', profileType: isDjChip ? 'dj' : 'teacher', href,
        } as unknown as Person;
      }));
    })();
  }, []);
  if (!people) return <Skeleton className="h-32 w-full rounded-xl" />;
  return (
    <section className="rounded-[14px] p-3" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / .25)' }} data-testid="s11-lineup">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-primary">Lineup</h2>
      <div className="flex flex-wrap gap-3">
        {people.map((p, i) => <PersonChip key={`${p.id}-${i}`} person={p} size="lg" layout="stacked" showRole context="s11-mock" />)}
      </div>
      <p className="sr-only" data-testid="s11-lineup-links">{people.map((p) => `${p.role}:${p.name}:${p.href ?? 'none'}`).join(' | ')}</p>
    </section>
  );
}

export default function S11Mock() {
  const { view, fixture } = useParams<{ view: string; fixture?: string }>();
  const fx = fixture as FixtureKey | undefined;
  const known = !!fx && !!FIXTURES[fx];
  return (
    <GlobalLayout showSubheader={false}>
      <div className={`mx-auto w-full max-w-xl pb-10 pt-3 ${view === 'dancer' || view === 'dj' ? 'px-4' : 'px-3'}`} style={{ minHeight: 700 }} data-testid="s11-root">
        {view === 'dancer' && known ? <DancerPage fixture={fx!} />
          : view === 'dj' && known ? <DjPage fixture={fx!} />
          : view === 'teacheronly' ? <TeacherOnly />
          : view === 'dancers' ? <Dancers />
          : view === 'djs' ? <Djs />
          : view === 'organiser' ? <OrganiserStrip />
          : view === 'lineup' ? <Lineup />
          : view === 'search' ? <Search />
          : <p>Unknown view</p>}
      </div>
    </GlobalLayout>
  );
}
