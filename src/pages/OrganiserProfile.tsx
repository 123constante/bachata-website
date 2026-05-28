import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Pencil, Loader2, ChevronLeft, Instagram, Facebook, Globe, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute, useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CityPicker } from '@/components/ui/city-picker';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { cn } from '@/lib/utils';

type EventRow = {
  id: string;
  name: string;
  date: string | null;
  start_time: string | null;
  is_active: boolean | null;
  poster_url: string | null;
  location: string | null;
  city: string | null;
};

// EventRow enriched with the date/time the row should render and sort by:
// the next future occurrence (from calendar_occurrences) when one exists,
// otherwise the base event date. Null = no known date (TBA).
type OrgEvent = EventRow & { displayStart: string | null };

type TeamMember = {
  id: string;
  memberId: string;
  dancerId: string | null;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  isHead: boolean | null;
  isLeader: boolean | null;
};

// --- Spark FC palette + type (from the Claude Design "08 SPARK FC" direction) -
const SP = {
  gold: '#f5c518',
  orange: '#ff5a1f',
  paper: '#f1e9d8',
  black: '#0b0b0d',
};
const FONT = {
  display: '"Archivo Black", "Arial Black", sans-serif',
  sans: '"DM Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", monospace',
};
const DISP: CSSProperties = { fontFamily: FONT.display };
const MONO: CSSProperties = { fontFamily: FONT.mono };

// Gradient fallbacks for posters/avatars with no image. Cycle by index.
const SP_GRADS = [
  'linear-gradient(135deg,#ff5a1f,#c4380e)',
  'linear-gradient(135deg,#f5c518,#c98a00)',
  'linear-gradient(135deg,#0b0b0d,#3a3a40)',
  'linear-gradient(135deg,#ff5a1f,#f5c518)',
];

const initials = (name: string | null | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const dateParts = (raw: string | null): { day: string; mon: string } => {
  if (!raw) return { day: '--', mon: 'TBA' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { day: '--', mon: 'TBA' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  };
};

const weekdayShort = (raw: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
};

// Time only when start_time carries a real clock value (timestamp with a
// non-midnight time). Time-only / date-only values return null.
const eventTime = (raw: string | null): string | null => {
  if (!raw || !raw.includes('T')) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s/g, '')
    .toLowerCase();
};

const formatPastDate = (raw: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
};

// --- social label helpers --------------------------------------------------
const FB_NON_HANDLE_PATHS = new Set([
  'profile.php', 'people', 'pages', 'groups', 'pg', 'sharer', 'login',
  'home.php', 'events',
]);

const extractIgHandle = (raw: string | null): string => {
  if (!raw) return 'Instagram';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return 'Instagram';
  if (trimmed.startsWith('@')) return trimmed;
  const m = trimmed.match(/instagram\.com\/([^/?#]+)/i);
  if (m && m[1]) {
    const seg = m[1].toLowerCase();
    if (['p', 'reel', 'reels', 'tv', 'explore', 'stories'].includes(seg)) return 'Instagram';
    return '@' + m[1];
  }
  if (/^[A-Za-z0-9._]+$/.test(trimmed)) return '@' + trimmed;
  return 'Instagram';
};

const extractFbHandle = (raw: string | null): string => {
  if (!raw) return 'Facebook';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return 'Facebook';
  if (trimmed.startsWith('@')) return trimmed;
  const m = trimmed.match(/facebook\.com\/([^/?#]+)/i);
  if (m && m[1]) {
    const seg = m[1];
    if (FB_NON_HANDLE_PATHS.has(seg.toLowerCase())) return 'Facebook';
    return '@' + seg;
  }
  if (/^[A-Za-z0-9.\-_]+$/.test(trimmed)) return '@' + trimmed;
  return 'Facebook';
};

const extractDomain = (raw: string | null): string => {
  if (!raw) return 'Website';
  const trimmed = raw.trim();
  if (!trimmed) return 'Website';
  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./i, '') || 'Website';
  } catch {
    return 'Website';
  }
};

// --- sparky decoration -----------------------------------------------------
const Star = ({ color, size = 24, style }: { color: string; size?: number; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={style}>
    <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" fill={color} />
  </svg>
);

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// Deterministic scattered star field behind the hero.
const StarField = ({ seed, count, colors }: { seed: string; count: number; colors: string[] }) => {
  let h = hashStr(seed) || 1;
  const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 16777216; };
  const items = Array.from({ length: count }, (_, i) => {
    const size = 12 + rnd() * 26;
    const left = rnd() * 92;
    const top = rnd() * 88;
    const rot = rnd() * 360;
    const op = 0.4 + rnd() * 0.4;
    return (
      <Star key={i} color={colors[i % colors.length]} size={size}
        style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: `rotate(${rot}deg)`, opacity: op }} />
    );
  });
  return <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">{items}</div>;
};

// --- presentational pieces -------------------------------------------------
const TeamCard = ({ member, index }: { member: TeamMember; index: number }) => {
  const inner = (
    <>
      <div className="relative w-full aspect-square">
        <div
          className="absolute -top-2 -right-2 z-[2] flex items-center justify-center rounded-full w-9 h-9 md:w-12 md:h-12 border-[3px]"
          style={{ ...DISP, background: SP.black, color: SP.gold, borderColor: SP.gold }}
        >
          <span className="text-sm md:text-lg leading-none">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <Avatar className="w-full h-full rounded-full border-4" style={{ borderColor: SP.black, background: SP.gold }}>
          <AvatarImage src={member.avatarUrl || undefined} alt={member.name} className="object-cover" />
          <AvatarFallback className="text-white text-xl" style={{ ...DISP, background: SP_GRADS[index % SP_GRADS.length] }}>
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-3 uppercase leading-tight text-sm md:text-base" style={{ ...DISP, color: SP.black }}>{member.name}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ ...MONO, color: SP.orange }}>
        {member.role || 'Team'}
      </div>
    </>
  );
  const cls = 'block text-center';
  return member.dancerId ? (
    <Link to={`/dancers/${member.dancerId}`} className={cls}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
};

const EventRow = ({ event, index }: { event: OrgEvent; index: number }) => {
  const whenDate = event.displayStart;
  const { day, mon } = dateParts(whenDate);
  const wd = weekdayShort(whenDate);
  const time = eventTime(whenDate);
  const venue = event.location?.trim() || event.city?.trim() || '';
  const grad = SP_GRADS[index % SP_GRADS.length];
  const rowBg = index % 2 === 1 ? SP.orange : 'transparent';
  return (
    <Link to={`/event/${event.id}`} className="block">
      {/* Mobile card */}
      <div className="md:hidden flex items-center gap-3 p-3.5 border-t-2" style={{ borderColor: SP.black, background: rowBg, color: SP.black }}>
        <div className="flex-none w-11 text-center">
          <div className="text-2xl leading-none" style={{ ...DISP, color: SP.orange }}>{day}</div>
          <div className="text-[10px] tracking-[0.1em]" style={MONO}>{mon}</div>
        </div>
        <div className="flex-none w-12 h-12 rounded-md overflow-hidden" style={{ background: grad }}>
          {event.poster_url && <img src={event.poster_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base uppercase leading-tight truncate" style={DISP}>{event.name}</div>
          <div className="text-[10px] opacity-70 truncate" style={MONO}>{venue}{venue && time ? ` \u00b7 ${time}` : ''}</div>
        </div>
      </div>
      {/* Desktop row */}
      <div
        className="hidden md:grid grid-cols-[56px_150px_1fr_200px_70px] gap-3 items-center px-5 py-5 border-t"
        style={{ borderColor: 'rgba(11,11,13,0.18)', background: rowBg, color: SP.black }}
      >
        <div className="text-3xl" style={{ ...DISP, color: SP.black }}>{String(index + 1).padStart(2, '0')}</div>
        <div>
          <div className="text-[10px] tracking-[0.2em]" style={{ ...MONO, color: SP.orange }}>{wd}</div>
          <div className="text-2xl leading-none" style={DISP}>{day} {mon}</div>
        </div>
        <div className="text-2xl uppercase leading-tight" style={DISP}>{event.name}</div>
        <div className="text-xs" style={MONO}>{venue}</div>
        <div className="text-base" style={DISP}>{time || '\u2014'}</div>
      </div>
    </Link>
  );
};

const PastRow = ({ event }: { event: OrgEvent }) => {
  const dt = formatPastDate(event.displayStart);
  const venue = event.location?.trim() || event.city?.trim() || '';
  return (
    <Link to={`/event/${event.id}`} className="block py-3 border-t" style={{ borderColor: 'rgba(11,11,13,0.3)', color: SP.black }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base md:text-xl uppercase leading-tight truncate" style={DISP}>{event.name}</span>
        <span className="text-[11px] flex-none opacity-70" style={MONO}>{dt}</span>
      </div>
      {venue && <div className="text-[11px] opacity-60 mt-0.5" style={MONO}>{venue}</div>}
    </Link>
  );
};

const OrganiserProfile = () => {
  const { id: routeParam } = useParams<{ id: string }>();
  const resolved = useEntitySlugOrId(routeParam, 'organiser_profiles');
  const id = resolved.id ?? undefined;
  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => `/organisers/${s}`,
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    avatar_url: '',
    bio: '',
    city: '',
    instagram: '',
    facebook: '',
    website: '',
    contact_email: '',
    contact_phone: '',
    organisation_category: '',
    founded_year: '',
  });

  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: async () => {
      if (!id) throw new Error('Entity ID is required');
      const { data, error } = await supabase
        .from('organiser_profiles')
        .select('*')
        .eq('id', id)
        .not('is_active', 'is', false)
        .maybeSingle();
      if (error) throw new Error(error.message ?? JSON.stringify(error));
      if (!data) return null;

      let city = null;
      if (data.city_id) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('name, slug')
          .eq('id', data.city_id)
          .maybeSingle();
        city = cityData;
      }

      return { ...data, cities: city };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['organiser-events', id],
    queryFn: async (): Promise<EventRow[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('event_entities')
        .select('event_id, events(id, name, date, start_time, is_active, poster_url, location, city)')
        .eq('entity_id', id)
        .eq('role', 'organiser');
      if (error) return [];
      type Row = { event_id: string; events: EventRow | null };
      return (data as unknown as Row[])
        .map((r) => r.events)
        .filter((e): e is EventRow => Boolean(e))
        .filter((e) => e.is_active !== false);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve each linked event's next future occurrence. calendar_occurrences
  // is anon-readable for active events; we filter to this organiser's event IDs
  // and keep the earliest instance_start >= now per event.
  const eventIds = useMemo(() => allEvents.map((e) => e.id), [allEvents]);

  const { data: nextByEvent = {} } = useQuery({
    queryKey: ['organiser-next-occ', id, eventIds],
    enabled: eventIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('calendar_occurrences')
        .select('event_id, instance_start')
        .in('event_id', eventIds)
        .gte('instance_start', new Date().toISOString())
        .order('instance_start', { ascending: true });
      if (error) return {};
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as { event_id: string; instance_start: string }[]) {
        if (!map[r.event_id]) map[r.event_id] = r.instance_start; // asc -> first is earliest
      }
      return map;
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['organiser-team', id],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!id) return [];
      const { data: teamRows, error } = await supabase
        .from('organiser_team_members')
        .select('id, role, is_head, is_leader, sort_order, member_profile_id, is_active')
        .eq('organiser_profile_id', id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error || !teamRows?.length) return [];

      const memberIds = teamRows.map((r) => r.member_profile_id);
      const { data: dancerRows } = await supabase
        .from('dancer_profiles')
        .select('id, first_name, surname, display_name, avatar_url')
        .in('id', memberIds);

      type DancerRow = { id: string; first_name: string | null; surname: string | null; display_name: string | null; avatar_url: string | null };
      const dancerMap = new Map<string, DancerRow>(
        (dancerRows as DancerRow[] | null ?? []).map((d) => [d.id, d]),
      );

      return teamRows.map((t) => {
        const d = dancerMap.get(t.member_profile_id);
        const name =
          d?.display_name?.trim() ||
          [d?.first_name, d?.surname].filter(Boolean).join(' ').trim() ||
          'Team member';
        return {
          id: t.id,
          memberId: t.member_profile_id,
          dancerId: d?.id ?? null,
          name,
          avatarUrl: d?.avatar_url ?? null,
          role: t.role,
          isHead: t.is_head,
          isLeader: t.is_leader,
        };
      });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const leader = useMemo(() => {
    if (!teamMembers.length) return null;
    return (
      teamMembers.find((m) => m.isHead) ||
      teamMembers.find((m) => m.isLeader) ||
      teamMembers[0]
    );
  }, [teamMembers]);

  const orderedTeam = useMemo(
    () => (leader ? [leader, ...teamMembers.filter((m) => m.id !== leader.id)] : teamMembers),
    [teamMembers, leader],
  );

  const todayMs = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: OrgEvent[] = [];
    const past: OrgEvent[] = [];
    for (const e of allEvents) {
      const occNext = nextByEvent[e.id] ?? null;
      const baseRaw = e.start_time ?? e.date;
      const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
      // Next future start: a future occurrence wins; else the base date if it
      // is itself in the future (covers events with no occurrence rows).
      const nextStart =
        occNext ?? (baseRaw && !Number.isNaN(baseMs) && baseMs >= todayMs ? baseRaw : null);
      if (nextStart) {
        upcoming.push({ ...e, displayStart: nextStart });
      } else if (!baseRaw) {
        // No date at all - surface as upcoming/TBA (preserves prior behaviour).
        upcoming.push({ ...e, displayStart: null });
      } else {
        past.push({ ...e, displayStart: baseRaw });
      }
    }
    upcoming.sort((a, b) => (a.displayStart ?? '').localeCompare(b.displayStart ?? ''));
    past.sort((a, b) => (b.displayStart ?? '').localeCompare(a.displayStart ?? ''));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents, nextByEvent, todayMs]);

  const sinceYear = useMemo(() => {
    let earliest: number | null = null;
    for (const e of allEvents) {
      const raw = e.start_time ?? e.date;
      if (!raw) continue;
      const ts = new Date(raw).getTime();
      if (Number.isNaN(ts)) continue;
      if (earliest === null || ts < earliest) earliest = ts;
    }
    return earliest === null ? null : new Date(earliest).getFullYear();
  }, [allEvents]);

  const totalEventsCount = allEvents.length;
  const showSinceYear = sinceYear !== null && sinceYear < new Date().getFullYear();

  useSeo(
    buildSeoForRoute('organiser.detail', {
      entityName: entity?.name,
      entitySlug: resolved.slug ?? id ?? undefined,
      cityDisplay: entity?.cities?.name ?? undefined,
      ogImage: entity?.avatar_url ?? undefined,
      isLoading,
    }),
  );

  const handleClaim = async () => {
    if (!id || !user?.id) return;
    try {
      const { error } = await supabase
        .from('organiser_profiles')
        .update({ claimed_by: user.id })
        .eq('id', id)
        .is('claimed_by', null);
      if (error) throw error;
      toast({
        title: 'Profile claimed',
        description: "You can now edit this organiser's profile.",
      });
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (err) {
      console.error('Claim error:', err);
      toast({
        title: 'Failed to claim profile',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = () => {
    if (!entity) return;
    const socials = entity.socials as { instagram?: string; website?: string; facebook?: string } | null;
    setEditForm({
      name: entity.name || '',
      avatar_url: entity.avatar_url || '',
      bio: entity.bio || '',
      city: entity.cities?.name || '',
      instagram: (entity as any).instagram || socials?.instagram || '',
      facebook: (entity as any).facebook || socials?.facebook || '',
      website: (entity as any).website || socials?.website || '',
      contact_email: (entity as any).contact_email || '',
      contact_phone: (entity as any).contact_phone || '',
      organisation_category: (entity as any).organisation_category || '',
      founded_year: (entity as any).founded_year ? String((entity as any).founded_year) : '',
    });
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!id || !user?.id) return;

    const city = normalizeRequiredCity(editForm.city);
    if (!hasRequiredCity(city)) {
      toast({
        title: 'City is required',
        description: 'Please add city before saving.',
        variant: 'destructive',
      });
      return;
    }

    const canonicalCity = await resolveCanonicalCity(city);
    if (!canonicalCity) {
      toast({
        title: 'Select a valid city',
        description: 'Please choose city from the city picker list.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const ig = editForm.instagram.trim() || null;
      const fb = editForm.facebook.trim() || null;
      const web = editForm.website.trim() || null;
      const existingSocials = (entity?.socials as Record<string, unknown> | null) ?? {};
      const nextSocials = { ...existingSocials, instagram: ig, website: web, facebook: fb };

      const { error } = await supabase
        .from('organiser_profiles')
        .update({
          name: editForm.name.trim(),
          avatar_url: editForm.avatar_url.trim() || null,
          bio: editForm.bio.trim() || null,
          city_id: canonicalCity.cityId,
          instagram: ig,
          website: web,
          contact_email: editForm.contact_email.trim() || null,
          contact_phone: editForm.contact_phone.trim() || null,
          organisation_category: editForm.organisation_category.trim() || null,
          founded_year: editForm.founded_year.trim() && Number.isFinite(Number(editForm.founded_year.trim())) ? Number(editForm.founded_year.trim()) : null,
          socials: nextSocials,
        })
        .eq('id', id)
        .eq('claimed_by', user.id);

      if (error) throw error;
      toast({ title: 'Profile updated' });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (err) {
      console.error('Save error:', err);
      toast({
        title: 'Unable to save changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const organiserBreadcrumbs = buildBreadcrumbs('organiser.detail', {
    entityName: entity?.name,
    isLoading,
  });

  // Loading state
  if (isLoading) {
    return (
      <GlobalLayout breadcrumbs={organiserBreadcrumbs} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <article className="min-h-screen" style={{ fontFamily: FONT.sans, background: SP.paper }}>
          <div className="px-4 md:px-12 pt-20 pb-10">
            <Skeleton className="h-3 w-52 bg-black/25" />
            <Skeleton className="h-24 w-3/4 mt-6 bg-black/25" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] mt-6 border-2 border-black/20 bg-black/20">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20" style={{ background: 'rgba(11,11,13,0.08)' }} />
              ))}
            </div>
          </div>
        </article>
      </GlobalLayout>
    );
  }

  // Not-found state
  if (error || !entity) {
    return (
      <GlobalLayout breadcrumbs={organiserBreadcrumbs} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <article className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: FONT.sans, background: SP.paper, color: SP.black }}>
          <div className="text-center">
            <h1 className="text-4xl uppercase" style={DISP}>Organiser not found</h1>
            <p className="mt-3 text-sm max-w-xs mx-auto">The organiser profile you&rsquo;re looking for doesn&rsquo;t exist.</p>
            <button
              onClick={() => navigate('/organisers')}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-[11px] tracking-[0.2em] uppercase"
              style={{ ...MONO, background: SP.black, color: SP.gold }}
            >
              <ChevronLeft className="w-4 h-4" /> Back to organisers
            </button>
          </div>
        </article>
      </GlobalLayout>
    );
  }

  // --- data preparation ----------------------------------------------------
  const socials = entity.socials as { instagram?: string; website?: string; facebook?: string } | null;
  const instagramRaw = (entity as any).instagram || socials?.instagram || null;
  const websiteRaw = (entity as any).website || socials?.website || null;
  const facebookRaw = (entity as any).facebook || socials?.facebook || null;
  const contactEmail = (entity as any).contact_email || null;
  const contactPhone = (entity as any).contact_phone || null;
  const organisationCategory = (entity as any).organisation_category || null;
  const galleryUrls: string[] = (() => {
    const raw = (entity as any).gallery_urls;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p.filter(Boolean) : [];
      } catch { return []; }
    }
    return [];
  })();

  const instagramUrl = instagramRaw
    ? (instagramRaw.startsWith('http') ? instagramRaw : `https://instagram.com/${instagramRaw.replace('@', '')}`)
    : null;
  const websiteUrl = websiteRaw
    ? (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`)
    : null;
  const facebookUrl = facebookRaw
    ? (facebookRaw.startsWith('http')
        ? facebookRaw
        : facebookRaw.includes('facebook.com')
          ? `https://${facebookRaw}`
          : `https://facebook.com/${facebookRaw.replace('@', '')}`)
    : null;
  const phoneHref = contactPhone ? `tel:${String(contactPhone).replace(/\s+/g, '')}` : null;
  const emailHref = contactEmail ? `mailto:${contactEmail}` : null;

  type ConnectItem = { key: string; href: string; label: string; value: string; external: boolean; Icon: typeof Instagram };
  const connectItems: ConnectItem[] = [];
  if (instagramUrl) connectItems.push({ key: 'ig', href: instagramUrl, label: 'Instagram', value: extractIgHandle(instagramRaw), external: true, Icon: Instagram });
  if (facebookUrl) connectItems.push({ key: 'fb', href: facebookUrl, label: 'Facebook', value: extractFbHandle(facebookRaw), external: true, Icon: Facebook });
  if (websiteUrl) connectItems.push({ key: 'web', href: websiteUrl, label: 'Website', value: extractDomain(websiteRaw), external: true, Icon: Globe });
  if (emailHref) connectItems.push({ key: 'mail', href: emailHref, label: 'Email', value: String(contactEmail), external: false, Icon: Mail });
  if (phoneHref) connectItems.push({ key: 'phone', href: phoneHref, label: 'Phone', value: String(contactPhone).trim(), external: false, Icon: Phone });

  const isUnclaimed = !entity.claimed_by;
  const isClaimedByUser = entity.claimed_by === user?.id;
  const canClaim = !!user && isUnclaimed;

  const cityName = entity.cities?.name ?? (entity as any).city ?? null;
  // Prefer an explicit founded year; fall back to the earliest event year, but
  // only when it predates this year (so a brand-new org doesn't read "EST 2026").
  const foundedYear = ((entity as any).founded_year as number | null | undefined) ?? null;
  const estYear = foundedYear ?? (showSinceYear ? sinceYear : null);
  const yearsActive = estYear !== null ? new Date().getFullYear() - estYear : null;

  // Event-centric stats only: what a visitor actually cares about. Team has its
  // own section below, and total events == upcoming + past, so both are omitted.
  const stats: { value: string; label: string }[] = [];
  if (upcomingEvents.length > 0) stats.push({ value: String(upcomingEvents.length), label: upcomingEvents.length === 1 ? 'UPCOMING EVENT' : 'UPCOMING EVENTS' });
  const nextEventStart = upcomingEvents[0]?.displayStart ?? null;
  if (nextEventStart) {
    const ed = new Date(nextEventStart);
    if (!Number.isNaN(ed.getTime())) {
      ed.setHours(0, 0, 0, 0);
      const days = Math.round((ed.getTime() - todayMs) / 86400000);
      stats.push(
        days <= 0
          ? { value: 'TODAY', label: 'NEXT EVENT' }
          : { value: String(days), label: days === 1 ? 'DAY TO NEXT' : 'DAYS TO NEXT' },
      );
    }
  }
  if (pastEvents.length > 0) stats.push({ value: String(pastEvents.length), label: pastEvents.length === 1 ? 'PAST EVENT' : 'PAST EVENTS' });
  if (yearsActive && yearsActive > 0) stats.push({ value: String(yearsActive), label: yearsActive === 1 ? 'YEAR ACTIVE' : 'YEARS ACTIVE' });

  const metaPill = [organisationCategory, cityName, estYear !== null ? `EST ${estYear}` : null]
    .filter(Boolean)
    .join('  \u00b7  ');

  const nextEvent = upcomingEvents[0];
  const marqueeItems = [
    nextEvent ? `NEXT: ${dateParts(nextEvent.displayStart).day} ${dateParts(nextEvent.displayStart).mon} \u2014 ${nextEvent.name}` : null,
  ].filter(Boolean) as string[];

  return (
    <GlobalLayout breadcrumbs={organiserBreadcrumbs} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
      <article className="min-h-screen" style={{ fontFamily: FONT.sans, background: SP.black, color: SP.black }}>

        {/* HERO */}
        <header className="relative overflow-hidden px-4 md:px-12 pt-20 pb-8 md:pb-12" style={{ background: SP.paper, color: SP.black }}>
          <StarField seed={`hero-${id}`} count={10} colors={[SP.orange, SP.gold]} />
          <div
            className="absolute inset-0 opacity-[0.10] pointer-events-none"
            style={{ background: `repeating-linear-gradient(90deg, transparent 0, transparent 72px, ${SP.black} 72px, ${SP.black} 73px)` }}
          />

          {/* meta + owner actions */}
          <div className="relative flex items-start justify-between gap-3">
            <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em]" style={MONO}>BACHATA CALENDAR <span style={{ color: SP.orange }}>/</span> ORGANISER</div>
            <div className="flex items-center gap-2 flex-none">
              {isClaimedByUser && (
                <button
                  onClick={openEditModal}
                  aria-label="Edit profile"
                  className="inline-flex items-center justify-center w-8 h-8"
                  style={{ background: SP.black, color: SP.gold }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canClaim && (
                <button
                  onClick={handleClaim}
                  className="px-2.5 py-1.5 text-[10px] tracking-[0.18em] uppercase"
                  style={{ ...MONO, background: SP.black, color: SP.gold }}
                >
                  Claim
                </button>
              )}
            </div>
          </div>

          {metaPill && (
            <div className="relative mt-2.5">
              <span className="inline-block px-2 py-1 text-[10px] md:text-[11px] uppercase tracking-[0.14em]" style={{ ...MONO, background: SP.black, color: SP.gold }}>
                {metaPill}
              </span>
            </div>
          )}

          {/* crest + name */}
          <div className="relative mt-5 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
            <div className="flex-none self-start mx-auto md:mx-0" style={{ width: 132, height: 158 }}>
              <div
                className="w-full h-full flex flex-col items-center justify-center px-3"
                style={{ background: SP.black, color: SP.gold, clipPath: 'polygon(50% 0,100% 20%,100% 80%,50% 100%,0 80%,0 20%)' }}
              >
                {entity.avatar_url ? (
                  <img src={entity.avatar_url} alt={entity.name} className="w-16 h-16 object-contain" loading="lazy"/>
                ) : (
                  <div className="text-3xl" style={DISP}>{initials(entity.name)}</div>
                )}
                {estYear !== null && <div className="mt-3 text-[8px] tracking-[0.25em]" style={MONO}>EST {estYear}</div>}
              </div>
            </div>
            <h1
              className="uppercase text-center md:text-left break-words"
              style={{ ...DISP, fontSize: 'clamp(40px, 12vw, 132px)', lineHeight: 0.86, letterSpacing: '-0.03em', color: SP.black }}
            >
              {entity.name}
            </h1>
          </div>

          {entity.bio && (
            <p className="relative mt-5 max-w-2xl font-medium text-base md:text-lg leading-snug" style={{ color: SP.black }}>
              {entity.bio}
            </p>
          )}

          {stats.length > 0 && (
            <div
              className="relative mt-6 flex flex-wrap gap-[2px] border-2"
              style={{ background: SP.black, borderColor: SP.black }}
            >
              {stats.map((s, i) => (
                <div key={s.label} className="p-3 md:p-4 flex-1 basis-[calc(50%-2px)] md:basis-0" style={{ background: i === 0 ? SP.orange : SP.paper }}>
                  <div className="text-4xl md:text-5xl leading-none tracking-tight" style={DISP}>{s.value}</div>
                  <div className="text-[10px] tracking-[0.2em] mt-1" style={MONO}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* GOLD MARQUEE */}
        {marqueeItems.length > 0 && (
          <div className="overflow-hidden border-y" style={{ background: SP.gold, color: SP.black, borderColor: SP.black }}>
            <div className="inline-flex whitespace-nowrap py-3 animate-ticker-scroll" style={MONO}>
              {[0, 1].map((rep) =>
                marqueeItems.map((it, j) => (
                  <span key={`${rep}-${j}`} className="inline-flex items-center gap-4 mr-10 text-[11px] font-bold uppercase tracking-[0.12em]">
                    {it}
                    <span style={{ color: SP.orange }}>&#9733;</span>
                  </span>
                )),
              )}
            </div>
          </div>
        )}

        {/* TEAM */}
        {orderedTeam.length > 0 && (
          <section className="px-4 md:px-12 py-10 md:py-14" style={{ background: SP.paper, color: SP.black }}>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-4xl md:text-6xl uppercase tracking-tight" style={{ ...DISP, color: SP.black }}>TEAM</h2>
              <span className="text-[11px] tracking-[0.2em] uppercase" style={MONO}>
                {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-7">
              {orderedTeam.map((m, i) => <TeamCard key={m.id} member={m} index={i} />)}
            </div>
          </section>
        )}

        {/* GET IN TOUCH */}
        {connectItems.length > 0 && (
          <section className="px-4 md:px-12 py-10 md:py-14" style={{ background: SP.black, color: SP.gold }}>
            <h2 className="text-3xl md:text-5xl uppercase tracking-tight mb-5" style={{ ...DISP, color: SP.gold }}>
              GET IN <span style={{ color: SP.orange }}>TOUCH</span>
            </h2>
            <div className="flex flex-wrap gap-[2px] border-2" style={{ background: SP.gold, borderColor: SP.gold }}>
              {connectItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  className="flex-1 basis-[calc(50%-2px)] md:basis-0 p-4 transition-colors hover:bg-[#1a1a1f]"
                  style={{ background: SP.black }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase" style={{ ...MONO, color: SP.orange }}>
                    <item.Icon className="w-3.5 h-3.5" />{item.label}
                  </div>
                  <div className="mt-2 text-base break-words" style={{ ...DISP, color: SP.gold }}>{item.value}</div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* WHAT'S ON */}
        <section className="px-4 md:px-12 py-10 md:py-14" style={{ background: SP.paper, color: SP.black }}>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-4xl md:text-6xl uppercase tracking-tight" style={{ ...DISP, color: SP.black }}>
              WHAT&rsquo;S <span style={{ color: SP.orange }}>ON</span>
            </h2>
            {upcomingEvents.length > 0 && (
              <span className="text-[11px] tracking-[0.2em] uppercase" style={MONO}>
                {upcomingEvents.length} {upcomingEvents.length === 1 ? 'event' : 'events'}
              </span>
            )}
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="border-2" style={{ borderColor: SP.black }}>
              <div className="hidden md:grid grid-cols-[56px_150px_1fr_200px_70px] gap-3 px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase" style={{ ...MONO, background: SP.black, color: SP.gold }}>
                <span>#</span><span>DATE</span><span>EVENT</span><span>VENUE</span><span>TIME</span>
              </div>
              {upcomingEvents.map((e, i) => <EventRow key={e.id} event={e} index={i} />)}
            </div>
          ) : (
            <p className="text-sm" style={MONO}>No upcoming events right now &mdash; check back soon.</p>
          )}
        </section>

        {/* PAST */}
        {pastEvents.length > 0 && (
          <section className="px-4 md:px-12 py-10 md:py-14" style={{ background: SP.gold, color: SP.black }}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-4xl md:text-6xl uppercase tracking-tight" style={{ ...DISP, color: SP.black }}>PAST</h2>
              <span className="text-[11px] tracking-[0.2em] uppercase" style={MONO}>
                {Math.min(showAllPast ? pastEvents.length : 6, pastEvents.length)} of {pastEvents.length}
              </span>
            </div>
            <div>
              {(showAllPast ? pastEvents : pastEvents.slice(0, 6)).map((e) => <PastRow key={e.id} event={e} />)}
            </div>
            {pastEvents.length > 6 && (
              <button
                onClick={() => setShowAllPast((v) => !v)}
                className="mt-4 inline-flex items-center px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase"
                style={{ ...MONO, background: SP.black, color: SP.gold }}
              >
                {showAllPast ? 'Show less' : `Show all ${pastEvents.length}`}
              </button>
            )}
          </section>
        )}

        {/* GALLERY */}
        {galleryUrls.length > 0 && (
          <section className="px-4 md:px-12 py-10 md:py-16" style={{ background: SP.paper, color: SP.black }}>
            <h2 className="text-4xl md:text-6xl uppercase tracking-tight mb-5" style={{ ...DISP, color: SP.black }}>
              GAL<span style={{ color: SP.orange }}>LERY</span>
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-6 auto-rows-[100px] md:auto-rows-[140px] gap-1.5">
              {galleryUrls.slice(0, 12).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('overflow-hidden block', i === 0 && 'col-span-2 row-span-2')}
                >
                  <img src={url} alt={`${entity.name} photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

      </article>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Organiser name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisation_category">Category</Label>
              <Input
                id="organisation_category"
                value={editForm.organisation_category}
                onChange={(e) => setEditForm({ ...editForm, organisation_category: e.target.value })}
                placeholder="Event Brand, Dance School, Community Group..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founded_year">Founded year</Label>
              <Input
                id="founded_year"
                type="number"
                inputMode="numeric"
                value={editForm.founded_year}
                onChange={(e) => setEditForm({ ...editForm, founded_year: e.target.value })}
                placeholder="e.g. 2015"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                value={editForm.avatar_url}
                onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <CityPicker
                value={editForm.city}
                onChange={(city) => setEditForm({ ...editForm, city })}
                placeholder="Select city..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="About this organiser..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={editForm.instagram}
                onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                placeholder="@username or full URL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={editForm.facebook}
                onChange={(e) => setEditForm({ ...editForm, facebook: e.target.value })}
                placeholder="Page URL or username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input
                id="contact_email"
                type="email"
                value={editForm.contact_email}
                onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                placeholder="hello@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={editForm.contact_phone}
                onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                placeholder="+44 7700 900000"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !editForm.name.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </GlobalLayout>
  );
};

export default OrganiserProfile;
