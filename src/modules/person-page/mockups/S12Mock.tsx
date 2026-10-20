// PROTOTYPE (search v7, S12): /__mock/s12/:view/:fixture? (S11 final + role backgrounds + design-review fixes)
// view = dancer | dj | teacheronly | dancers | djs | organiser | lineup | search.
// Dev or VITE_MOCKS=true only. REAL prod data (read-only reads through the public client); no live page is changed.
// Owner decisions 1-10 of briefs/S11-final-mockups-brief.md are applied here. NO teacher link anywhere ("Teaches" is plain text).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Headphones, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';
import { renderPublicName, resolvePublicName } from '@/lib/publicName';
import { withPublicNames } from '@/lib/publicDancerNames';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { PublicDancerPageV2 } from '@/modules/dancer-app/public-page/PublicDancerPageV2';
import { buildPublicDancerPage, shareDancerPage, NO_EXTRAS, type PublicDancerPageModel } from '@/modules/dancer-app/public-page/model';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';
import { FIXTURES, type FixtureKey } from './fixtures';
import { TEAL, DjBody, useMockData, useDjGigs, type Data } from './MockPersonPage';
import { Photo, GOLD, useRoles, useTeacherOk } from './S9Mock';

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

// ---------------------------------------------------------------- shared vocabulary + pieces (fix 3)
/** ONE mapping for role labels on every screen. */
const ROLE_LABEL = { dancing: 'Dancer', djing: 'DJ', teaching: 'Teacher' } as const;
const djLabel = (stage: string | null) => (stage ? `${ROLE_LABEL.djing} \u00b7 ${stage}` : ROLE_LABEL.djing);
const DJ_BG = '#0A080B'; // = djInkTheme --dj-bg
const DJ_INK = '#120c14';
const TEAL_INK = '#06191F';

/** Full-bleed page ground (fix 1). Fills the viewport under the header so no empty band shows above the footer. */
function Ground({ bg, children }: { bg: string; children: ReactNode }) {
  return <div style={{ background: bg, minHeight: 'calc(100vh + 54px)', paddingBottom: 56, marginBottom: -54 /* cancels the global footer's 54px top margin: no empty band above the footer */ }} data-testid="s12-ground">{children}</div>;
}

/** Role tag, 12px (fix 8). Plain: same size everywhere. */
function Tag({ children, tone }: { children: ReactNode; tone: 'gold' | 'plain' | 'teal' }) {
  const st: CSSProperties = tone === 'gold' ? { background: DJ_INK, color: GOLD, border: `1px solid ${GOLD}` }
    : tone === 'teal' ? { background: TEAL_INK, color: TEAL.accent, border: `1px solid ${TEAL.border}` }
    : { border: '1px solid hsl(var(--primary) / .45)', color: 'hsl(var(--foreground))' };
  return <span data-testid="s12-tag" className="inline-flex items-center rounded-full px-2 py-px text-[12px] font-bold leading-[18px]" style={st}>{children}</span>;
}

// ---------------------------------------------------------------- Also bar (fix 2): one row of equal-height chips
type BarItem = { label: string; to?: string; target?: 'dj' | 'dancer' };
function AlsoBar({ items }: { items: BarItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Also" data-testid="s12-also" className="flex flex-nowrap items-stretch gap-2 px-4 pb-1 pt-3">
      {items.map((it) => {
        const base = 'inline-flex min-w-0 items-center justify-center gap-1 rounded-full px-3 text-[14px] font-bold';
        if (it.to) {
          const st: CSSProperties = it.target === 'dj' ? { background: GOLD, color: DJ_INK, border: `1px solid ${GOLD}` } : { background: TEAL.accent, color: TEAL_INK, border: `1px solid ${TEAL.accent}` };
          return <Link key={it.label} to={it.to} data-href={it.to} data-testid="s12-chip" className={base} style={{ minHeight: 44, ...st }}><span className="truncate">{it.label}</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden /></Link>;
        }
        return <span key={it.label} data-testid="s12-chip" className={base} style={{ minHeight: 44, border: '1px solid rgba(246,241,234,.55)', color: '#F6F1EA' }}>{it.label}</span>;
      })}
    </nav>
  );
}

function ShareBtn({ title, path, gold }: { title: string; path: string; gold?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    const env = { share: typeof navigator !== 'undefined' && navigator.share ? (x: { title?: string; url?: string }) => navigator.share(x) : undefined,
      writeText: typeof navigator !== 'undefined' && navigator.clipboard ? (t: string) => navigator.clipboard.writeText(t) : undefined };
    const out = await shareDancerPage(env as never, title, `${window.location.origin}${path}`);
    setNote(out === 'copied' ? 'Link copied.' : null);
  };
  return (
    <div className="flex items-center gap-2">
      {note ? <span role="status" className="text-[13px]" style={{ color: GOLD }}>{note}</span> : null}
      <button type="button" onClick={go} data-testid="s12-share" className="inline-flex items-center gap-2 px-2 text-[15px] font-bold" style={{ minHeight: 44, color: gold ? GOLD : TEAL.text }}>
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </button>
    </div>
  );
}

/** Bar contents: the OTHER role pages that exist (filled, linked), then plain tags. Same nouns everywhere. */
function barFor(current: 'dancer' | 'dj', fixture: FixtureKey, d: Data, w: Roles, real: string): BarItem[] {
  const items: BarItem[] = [];
  const stage = stageOf(d, real);
  if (current !== 'dj' && w.djing && d.dj) items.push({ label: djLabel(stage), to: `/__mock/s12/dj/${fixture}`, target: 'dj' });
  if (current !== 'dancer' && w.dancing) items.push({ label: ROLE_LABEL.dancing, to: `/__mock/s12/dancer/${fixture}`, target: 'dancer' });
  if (w.teacherOk) items.push({ label: ROLE_LABEL.teaching });
  return items;
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
  // Fix 4 (reproduced here: the live card is PublicDancerPageV2, not edited). Facts row: a value shows only when the stored
  // start year is a real number; "0 years" / "Newcomer" are derived from a null start year or this year, so they are dropped
  // unless the stored start year is an earlier year. Chi-Wei: stored 2026 (NOT null, row created today) = this year, so 0 years: an unanswered default.
  const startYear = view.yearsDancing; // years since the stored start year (null when none is stored)
  const answered = startYear !== null && Number(startYear) > 0;
  const shaped: PublicDancerPageModel = { ...model, facts: { ...model.facts, dancing: answered ? model.facts.dancing : null, level: answered ? model.facts.level : null } };
  // Favourite songs: handed to the card through its own ownerPlans slot, which renders above "Dance bachata too?", styled like Achievements.
  const songs = model.songs.length > 0 ? (
    <section aria-label="Favourite songs" data-testid="s12-songs">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px]" style={{ color: TEAL.accent }}>Favourite songs</h2>
      <ul className="space-y-1 rounded-[14px] p-3.5" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}` }}>{model.songs.map((x, i) => <li key={i} className="break-words text-[14px] leading-normal">{x}</li>)}</ul>
    </section>
  ) : null;
  return (
    <Ground bg={TEAL.page}>
      <div data-start-year={String(startYear)} data-answered={String(answered)} className="mx-auto w-full max-w-xl">
        <AlsoBar items={bar} />
        {/* extrasOk=false only suppresses the "No public contacts yet" line (fix 4); contacts that exist still render. */}
        <PublicDancerPageV2 model={shaped} extrasOk={false} pathname={`/dancers/${view.id}`} profileId={view.id} ownerPlans={songs} />
      </div>
    </Ground>
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
    <Ground bg={DJ_BG}>
      <div className="mx-auto w-full max-w-xl">
        <AlsoBar items={bar} />
        {/* Fix 5: Back + Share in one row at the top of the card (same placement as the dancer page), gold. */}
        <div className="flex items-center justify-between px-4" style={{ minHeight: 44 }} data-testid="s12-djhead">
          <Link to="/__mock/s12/djs" className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ minHeight: 44, color: GOLD }}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Link>
          <ShareBtn gold title={`${stageOf(d, real) ?? real} on Bachata Calendar`} path={`/djs/${d.person.id}`} />
        </div>
        <div className="px-1 pb-8"><DjBody d={d} /></div>
      </div>
    </Ground>
  );
}

// ---------------------------------------------------------------- search row (fix 6): full-width, initials circle
function PersonRow({ name, photo, code, tags, href, testid }: { name: string; photo: string | null; code: string | null; tags: { t: string; tone: 'gold' | 'plain' }[]; href: string | null; testid?: string }) {
  const body = (
    <div className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-card p-3" style={{ minHeight: 64 }} data-testid={testid}>
      <div className="relative shrink-0">
        <Photo src={photo} name={name} w={48} className="border border-primary/30 bg-primary/10 text-base text-primary" />
        <NationalityFlag code={code} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-bold text-foreground">{name}</h3>
        <div className="mt-1 flex flex-wrap gap-1">{tags.map((x) => <Tag key={x.t} tone={x.tone}>{x.t}</Tag>)}</div>
      </div>
    </div>
  );
  return href ? <Link to={href} data-href={href} className="block">{body}</Link> : <div data-href="none">{body}</div>;
}

function PersonCardRow({ fixture }: { fixture: FixtureKey }) {
  const { data: d } = useMockData(fixture);
  const w = useWho(FIXTURES[fixture].id);
  const gigs = useDjGigs(FIXTURES[fixture].id);
  if (!d || !w) return <Skeleton className="h-16 w-full rounded-xl" />;
  const real = realOf(d);
  const stage = stageOf(d, real);
  const photo = d.person.avatarUrl ?? (Array.isArray(d.dj?.photo_url) ? (d.dj?.photo_url as string[])[0] : (d.dj?.photo_url as string | undefined)) ?? null;
  const tags: { t: string; tone: 'gold' | 'plain' }[] = [];
  if (w.dancing) tags.push({ t: ROLE_LABEL.dancing, tone: 'plain' });
  if (w.djing && d.dj) tags.push({ t: djLabel(stage), tone: 'plain' });
  if (w.teaching) tags.push({ t: ROLE_LABEL.teaching, tone: 'plain' });
  const lead = w.djing && d.dj && gigs.upcoming.length > 0 ? 'dj' : w.dancing ? 'dancer' : w.djing && d.dj ? 'dj' : null;
  const href = lead ? `/${lead === 'dj' ? 'djs' : 'dancers'}/${d.person.id}` : null;
  return <PersonRow name={real} photo={photo} code={d.dancerRow ? pickNationalityCode(d.dancerRow) : null} tags={tags} href={href} testid="s12-searchrow" />;
}

function Search() {
  return (
    <div data-testid="s12-search">
      <p className="mb-2 text-[13px] text-muted-foreground">People (one full-width row per person; real name leads; the stage name sits on the DJ label)</p>
      <div className="flex flex-col gap-2"><PersonCardRow fixture="threerole" /></div>
    </div>
  );
}

// ---------------------------------------------------------------- 3. teacher-only person, FINAL
function TeacherOnly() {
  const { data: d } = useMockData('tcher');
  return (
    <div data-testid="s12-teacheronly">
      <p className="mb-2 rounded-lg border border-primary/30 p-2 text-[12px] text-foreground"><b>FINAL.</b> A teacher-only person has NO page of their own. Nothing links to them. They appear in the two places below, as plain, non-clickable rows.</p>
      <p className="mb-1 text-[13px] text-muted-foreground">In search (row is not a link):</p>
      <div className="mb-4">{d ? <PersonRow name={realOf(d)} photo={d.person.avatarUrl} code={null} tags={[{ t: ROLE_LABEL.teaching, tone: 'plain' }]} href={null} /> : <Skeleton className="h-16 w-full rounded-xl" />}</div>
      <p className="mb-1 text-[13px] text-muted-foreground">In an event lineup (chip has no link):</p>
      {d ? <LineupBox people={[{ id: d.person.id, name: realOf(d), role: ROLE_LABEL.teaching, avatar: d.person.avatarUrl, code: null, href: null }]} /> : <Skeleton className="h-24 w-full rounded-xl" />}
    </div>
  );
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
    <section className="px-2 pt-3" data-testid="s12-dancers" data-count={list.length}>
      <h2 className="mb-1 text-center text-2xl font-black"><span>Browse </span><span className="text-primary">Dancers</span></h2>
      <p className="mb-2 text-center text-xs text-muted-foreground">{list.length} dancers</p>
      <div className="grid grid-cols-3 gap-2">
        {list.map((d) => {
          const name = renderPublicName(d as never, 'Dancer'); // real name on dancer things (decision 2)
          const also = [roles[d.id]?.includes('djing') ? ROLE_LABEL.djing : null, tOk.has(d.id) ? ROLE_LABEL.teaching : null].filter(Boolean) as string[];
          return (
            <Link key={d.id} to={`/dancers/${d.id}`} className="flex flex-col items-center rounded-xl border border-primary/20 bg-card p-2 text-center" style={{ minHeight: 120 }}>
              <div className="relative mx-auto mb-1 w-fit">
                <Photo src={d.avatar_url} name={name} w={40} className="border border-primary/25 bg-primary/10 text-[12px] text-primary" />
                <NationalityFlag code={pickNationalityCode(d)} size={40} />
              </div>
              <h3 className="break-words text-[13px] font-bold leading-tight" data-testid="s12-dname">{name}</h3>
              <div className="mt-auto flex w-full flex-wrap items-end justify-center gap-0.5 pt-1" style={{ height: 26 }} data-testid="s12-droles">{also.map((a) => <Tag key={a} tone="plain">{a}</Tag>)}</div>
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
    <Ground bg={DJ_BG}><div style={{ ...(djInkTheme as CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)' }} className="mx-auto max-w-xl p-3 pt-4" data-testid="s12-djs" data-total={djs.length} data-soon={up.size}>
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
                <Tag tone="gold">{ROLE_LABEL.djing}</Tag>{/* ALWAYS shown, even on names starting "DJ" */}
                {live ? <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 text-[11px] font-bold leading-[18px]" style={{ background: GOLD, color: '#120c14' }}><Headphones className="h-3 w-3" aria-hidden />Playing soon</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div></Ground>
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
        const labels = [isDj ? ROLE_LABEL.djing : null, teacherOk.includes(t.member_profile_id) ? ROLE_LABEL.teaching : null].filter(Boolean) as string[];
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
    <section className="rounded-[14px] px-4 py-4" style={{ background: '#120c14', color: '#F6F1EA' }} data-testid="s12-organiser">
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
              <div className="text-[14px] font-semibold leading-tight">{m.name}</div>
              <div className="mt-0.5 flex flex-wrap justify-center gap-1">{m.labels.map((l) => <Tag key={l} tone="gold">{l}</Tag>)}</div>
            </div>
          );
          return m.href ? <Link key={m.id} to={m.href} data-href={m.href} aria-label={m.name}>{inner}</Link> : <div key={m.id} data-href="none">{inner}</div>;
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- lineup chip (fix 8; reproduced, the live PersonChip prints the role at 9px)
type LPerson = { id: string; name: string; role: string; avatar: string | null; code: string | null; href: string | null };
function LineupChip({ p }: { p: LPerson }) {
  const inner = (
    <div className="flex flex-col items-center" style={{ minWidth: 44, width: 92 }}>
      <div className="relative"><Photo src={p.avatar} name={p.name} w={52} className="border border-primary/40 bg-primary/10 text-lg text-primary" /><NationalityFlag code={p.code} size={52} /></div>
      <div className="mt-1 break-words text-center text-[13px] font-semibold leading-[1.2]">{p.name}</div>
      <div className="mt-0.5 text-[12px] font-bold leading-tight" data-testid="s12-lineup-role" style={{ color: 'hsl(var(--foreground))' }}>{p.role}</div>
    </div>
  );
  return p.href ? <Link to={p.href} data-href={p.href} className="rounded-xl py-1" style={{ minHeight: 44 }}>{inner}</Link> : <div data-href="none" className="py-1">{inner}</div>;
}
function LineupBox({ people }: { people: LPerson[] }) {
  return (
    <section className="rounded-[14px] p-3" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / .25)' }} data-testid="s12-lineup">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-primary">Lineup</h2>
      <div className="flex flex-wrap gap-3">{people.map((p, i) => <LineupChip key={`${p.id}-${i}`} p={p} />)}</div>
      <p className="sr-only" data-testid="s12-lineup-links">{people.map((p) => `${p.role}:${p.name}:${p.href ?? 'none'}`).join(' | ')}</p>
    </section>
  );
}

// ---------------------------------------------------------------- 7. event lineup, FINAL (legacy id; name rule; link rule)
function Lineup() {
  const [people, setPeople] = useState<LPerson[] | null>(null);
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
      setPeople(rows.map((r): LPerson => {
        const d: Row = masked.find((x: Row) => x.id === r.profile_id) ?? {};
        const rs = ((pr ?? []) as Row[]).filter((x) => x.person_id === r.profile_id && x.is_active !== false).map((x) => x.role);
        const dj = ((djs ?? []) as Row[]).find((x) => x.id === r.profile_id);
        const isDjChip = r.profile_type === 'dj';
        const real = d.id ? renderPublicName(d as never, 'Teacher') : r.display_name;
        // NAME RULE: stage name on the DJ chip, real name on the teacher chip. LINK RULE: DJ page if they DJ, else dancer page if they dance, else none.
        const href = dj ? `/djs/${r.profile_id}` : rs.includes('dancing') ? `/dancers/${r.profile_id}` : null;
        return {
          id: r.profile_id, avatar: r.avatar_url ?? d.avatar_url ?? null, code: r.nationality_code ?? pickNationalityCode(d) ?? null,
          name: isDjChip ? ((dj ? resolvePublicName(dj as never) : null) ?? real) : real,
          role: isDjChip ? ROLE_LABEL.djing : ROLE_LABEL.teaching, href,
        };
      }));
    })();
  }, []);
  if (!people) return <Skeleton className="h-32 w-full rounded-xl" />;
  return <LineupBox people={people} />;
}

export default function S12Mock() {
  const { view, fixture } = useParams<{ view: string; fixture?: string }>();
  const fx = fixture as FixtureKey | undefined;
  const known = !!fx && !!FIXTURES[fx];
  // Fix 1: role pages and /djs own a full-bleed ground and drop the shared purple wash and the floating icons.
  const own = view === 'dancer' || view === 'dj' || view === 'djs';
  return (
    <GlobalLayout showSubheader={false} showGradientBg={!own}>
      {view === 'dancer' && known ? <DancerPage fixture={fx!} />
        : view === 'dj' && known ? <DjPage fixture={fx!} />
        : view === 'djs' ? <Djs />
        : (
          <div className="mx-auto w-full max-w-xl px-3 pb-10 pt-3" style={{ minHeight: 700 }} data-testid="s12-root">
            {view === 'teacheronly' ? <TeacherOnly />
              : view === 'dancers' ? <Dancers />
              : view === 'organiser' ? <OrganiserStrip />
              : view === 'lineup' ? <Lineup />
              : view === 'search' ? <Search />
              : <p>Unknown view</p>}
          </div>
        )}
    </GlobalLayout>
  );
}
