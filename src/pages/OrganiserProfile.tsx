import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Pencil, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
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

// --- Types ---

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

type OrgEvent = EventRow & { displayStart: string | null; occurrenceId?: string | null };

type OrgOccRow = {
  event_id: string;
  name: string | null;
  occurrence_id: string | null;
  instance_date: string | null;
  start_time: string | null;
  photo_url: string[] | null;
  cover_image_url: string | null;
  location: string | null;
  is_cancelled: boolean | null;
  is_past: boolean | null;
};

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

type EntityProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  claimed_by: string | null;
  socials: Record<string, string | undefined> | null;
  is_verified: boolean | null;
  city_id: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  organisation_category: string | null;
  founded_year: number | null;
  cities: { name: string; slug: string } | null;
};

// --- Design tokens ---

const D = {
  black:     '#0C0A0D',
  gold:      '#E7BE6E',
  orange:    '#FF6A2C',
  cream:     '#F6F1EA',
  lightGold: '#FBEFC4',
};
const SERIF = "'Cormorant Garamond', Georgia, serif";
const BODY  = "'Manrope', 'Inter Variable', system-ui, sans-serif";

const PAST_GRADS = [
  'linear-gradient(160deg,#311f2a,#100b13)',
  'linear-gradient(160deg,#2a2233,#100b13)',
  'linear-gradient(160deg,#33202b,#100b13)',
  'linear-gradient(160deg,#2b2132,#100b13)',
];

// HERO_BG is now computed per-organiser inside the component using useAverageColor.
// This placeholder is only used by the loading skeleton (before entity loads).
const HERO_BG_DEFAULT =
  'radial-gradient(circle at 24% 22%,rgba(255,140,60,0.42),transparent 38%),' +
  'radial-gradient(circle at 80% 30%,rgba(231,190,110,0.40),transparent 44%),' +
  'radial-gradient(circle at 62% 88%,rgba(255,106,44,0.30),transparent 52%),' +
  'linear-gradient(155deg,#2a1622,#0c0a0d 72%)';

const heroBg = (r: number, g: number, b: number) =>
  `radial-gradient(circle at 24% 22%,rgba(${r},${g},${b},0.52),transparent 38%),` +
  `radial-gradient(circle at 80% 30%,rgba(231,190,110,0.40),transparent 44%),` +
  `radial-gradient(circle at 62% 88%,rgba(${r},${g},${b},0.32),transparent 52%),` +
  `linear-gradient(155deg,#2a1622,#0c0a0d 72%)`;

// --- Helpers ---

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

const ticketDateParts = (raw: string | null) => {
  if (!raw) return { day: '--', mon: 'TBA', yr: '', wd: '' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { day: '--', mon: 'TBA', yr: '', wd: '' };
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    yr: String(d.getFullYear()),
    wd: d.toLocaleDateString('en-GB', { weekday: 'long' }),
  };
};

const weekdayShort = (raw: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
};

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

// --- Sub-components ---

const AvatarCircle = ({
  avatarUrl,
  name,
  sizePx,
  fontSize,
}: {
  avatarUrl: string | null;
  name: string;
  sizePx: number;
  fontSize: number;
}) => (
  <div
    style={{
      width: sizePx,
      height: sizePx,
      borderRadius: '50%',
      padding: sizePx > 80 ? 4 : 3,
      background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)',
      boxShadow: '0 10px 30px rgba(255,106,44,0.35)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%,#3a2030,#140d16 75%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '3px solid #0C0A0D',
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
      ) : (
        <span style={{ fontFamily: SERIF, fontSize, color: 'rgba(251,239,196,0.85)' }}>{initials(name)}</span>
      )}
    </div>
  </div>
);

const TeamCircle = ({ member }: { member: TeamMember }) => {
  const inner = (
    <div className="text-center">
      <div style={{ aspectRatio: '1', borderRadius: '50%', padding: 2.5, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)', marginBottom: 10 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span style={{ fontFamily: SERIF, fontSize: 'clamp(16px,2.5vw,26px)', color: 'rgba(251,239,196,0.8)' }}>{initials(member.name)}</span>
          )}
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 'clamp(13px,1.5vw,18px)', fontWeight: 600, color: D.cream, lineHeight: 1.2 }}>{member.name}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: D.gold, marginTop: 3 }}>{member.role || 'Team'}</div>
    </div>
  );
  return member.dancerId ? <Link to={`/dancers/${member.dancerId}`}>{inner}</Link> : <div>{inner}</div>;
};

const UpcomingRow = ({ event }: { event: OrgEvent }) => {
  const { day, mon } = dateParts(event.displayStart);
  const wd = weekdayShort(event.displayStart);
  const time = eventTime(event.displayStart);
  const venue = event.location?.trim() || event.city?.trim() || '';
  const meta = [wd, venue, time].filter(Boolean).join(' / ');
  const href = event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`;
  return (
    <Link to={href} className="flex items-center gap-3 md:gap-5 px-4 md:px-6 py-3.5 md:py-5 hover:bg-white/5 transition-colors">
      <div className="flex-none w-10 md:w-[58px] text-center">
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: D.orange }}>{mon}</div>
        <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: D.cream, lineHeight: 1 }}>{day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: D.cream, marginBottom: 2 }}>{event.name}</div>
        {meta && <div className="truncate" style={{ fontSize: 12, color: 'rgba(246,241,234,0.6)' }}>{meta}</div>}
      </div>
      <span className="flex-none text-xs font-bold px-3 py-2 rounded-full" style={{ background: 'rgba(231,190,110,0.92)', color: D.black, whiteSpace: 'nowrap' as const }}>View</span>
    </Link>
  );
};

// --- Colour extraction ---

function useAverageColor(url: string | null): [number, number, number] {
  const [rgb, setRgb] = React.useState<[number, number, number]>([255, 106, 44]);
  React.useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(2, 2, 12, 12).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const sat = Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]);
          if (sat < 20) continue; // skip near-greys
          r += data[i]; g += data[i+1]; b += data[i+2]; count++;
        }
        if (count === 0) return;
        setRgb([Math.round(r/count), Math.round(g/count), Math.round(b/count)]);
      } catch { /* CORS block ??? stay on default */ }
    };
    img.onerror = () => { /* stay on default */ };
    img.src = url;
  }, [url]);
  return rgb;
}

// --- Main component ---

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

  const isMobile = useIsMobile();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
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
        const { data: cityData } = await supabase.from('cities').select('name, slug').eq('id', data.city_id).maybeSingle();
        city = cityData;
      }
      return { ...data, cities: city };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cr, cg, cb] = useAverageColor((entity as any)?.avatar_url ?? null);
  const HERO_BG = heroBg(cr, cg, cb);

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
      return (data as unknown as Row[]).map((r) => r.events).filter((e): e is EventRow => Boolean(e)).filter((e) => e.is_active !== false);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: futureOccs = [] } = useQuery({
    queryKey: ['organiser-occ-events', id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OrgOccRow[]> => {
      const { data, error } = await supabase.rpc('get_organiser_calendar_events_v1' as never, { p_organiser_id: id } as never);
      if (error) return [];
      return (data ?? []) as unknown as OrgOccRow[];
    },
  });

  // Past occurrences. Separate query (and cache key) from the future feed above,
  // so the upcoming list never breaks even if the p_include_past RPC arg is not
  // yet deployed (PostgREST rejects the unknown param -> we degrade to empty).
  // The server tags each row with is_past (inverse of the 6h-grace keep-window);
  // we keep only is_past rows so today's already-ended events count as past.
  const { data: pastOccs = [] } = useQuery({
    queryKey: ['organiser-occ-events-past', id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OrgOccRow[]> => {
      const from = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc('get_organiser_calendar_events_v1' as never, { p_organiser_id: id, p_from: from, p_to: to, p_include_past: true } as never);
      if (error) return [];
      return (data ?? []) as unknown as OrgOccRow[];
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
        .select('id, first_name, surname, display_name, avatar_url, photo_url')
        .in('id', memberIds);
      type DancerRow = { id: string; first_name: string | null; surname: string | null; display_name: string | null; avatar_url: string | null; photo_url: string | null };
      const dancerMap = new Map<string, DancerRow>((dancerRows as DancerRow[] | null ?? []).map((d) => [d.id, d]));
      return teamRows.map((t) => {
        const d = dancerMap.get(t.member_profile_id);
        const name = d?.display_name?.trim() || [d?.first_name, d?.surname].filter(Boolean).join(' ').trim() || 'Team member';
        return { id: t.id, memberId: t.member_profile_id, dancerId: d?.id ?? null, name, avatarUrl: d?.avatar_url ?? d?.photo_url ?? null, role: t.role, isHead: t.is_head, isLeader: t.is_leader };
      });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const leader = useMemo(() => {
    if (!teamMembers.length) return null;
    return teamMembers.find((m) => m.isHead) || teamMembers.find((m) => m.isLeader) || teamMembers[0];
  }, [teamMembers]);

  const orderedTeam = useMemo(
    () => (leader ? [leader, ...teamMembers.filter((m) => m.id !== leader.id)] : teamMembers),
    [teamMembers, leader],
  );

  const todayMs = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); }, []);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const eventById = new Map(allEvents.map((e) => [e.id, e]));
    const upcoming: OrgEvent[] = [];
    const eventsWithFutureOcc = new Set<string>();
    for (const occ of futureOccs) {
      if (occ.is_cancelled) continue;
      const e = eventById.get(occ.event_id);
      if (!e) continue;
      eventsWithFutureOcc.add(occ.event_id);
      const poster = occ.cover_image_url || (Array.isArray(occ.photo_url) ? occ.photo_url[0] : null) || e.poster_url;
      upcoming.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: occ.start_time ?? occ.instance_date ?? null, occurrenceId: occ.occurrence_id });
    }
    // Past list: driven by real past occurrences (server is_past flag), one
    // OrgEvent per past date. Cancelled rows are passed through by the RPC, so
    // skip them here to keep the "X hosted" count honest.
    const past: OrgEvent[] = [];
    const pastSeen = new Set<string>();
    for (const occ of pastOccs) {
      if (occ.is_cancelled) continue;
      if (!occ.is_past) continue;
      const e = eventById.get(occ.event_id);
      if (!e) continue;
      const startRaw = occ.start_time ?? occ.instance_date ?? null;
      const dedupeKey = occ.occurrence_id ?? `${occ.event_id}:${startRaw}`;
      if (pastSeen.has(dedupeKey)) continue;
      pastSeen.add(dedupeKey);
      const poster = occ.cover_image_url || (Array.isArray(occ.photo_url) ? occ.photo_url[0] : null) || e.poster_url;
      past.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: startRaw, occurrenceId: occ.occurrence_id });
    }
    // Base-date fallback only for legacy events the occurrence feed never
    // surfaced (no future AND no past occurrence row at all).
    const eventsWithAnyOcc = new Set<string>([...eventsWithFutureOcc, ...pastOccs.map((o) => o.event_id)]);
    for (const e of allEvents) {
      if (eventsWithAnyOcc.has(e.id)) continue;
      const baseRaw = e.start_time ?? e.date;
      const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
      const nextStart = baseRaw && !Number.isNaN(baseMs) && baseMs >= todayMs ? baseRaw : null;
      if (nextStart) { upcoming.push({ ...e, displayStart: nextStart, occurrenceId: null }); }
      else if (!baseRaw) { upcoming.push({ ...e, displayStart: null, occurrenceId: null }); }
      else { past.push({ ...e, displayStart: baseRaw, occurrenceId: null }); }
    }
    upcoming.sort((a, b) => (a.displayStart ?? '').localeCompare(b.displayStart ?? ''));
    past.sort((a, b) => (b.displayStart ?? '').localeCompare(a.displayStart ?? ''));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents, futureOccs, pastOccs, todayMs]);

  const totalEventsCount = allEvents.length;

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

  useSeo(buildSeoForRoute('organiser.detail', {
    entityName: entity?.name,
    entitySlug: resolved.slug ?? id ?? undefined,
    cityDisplay: entity?.cities?.name ?? undefined,
    ogImage: entity?.avatar_url ?? undefined,
    isLoading,
  }));

  const handleClaim = async () => {
    if (!id || !user?.id) return;
    try {
      const { error } = await supabase.from('organiser_profiles').update({ claimed_by: user.id }).eq('id', id).is('claimed_by', null);
      if (error) throw error;
      toast({ title: 'Profile claimed', description: 'You can now edit this organiser profile.' });
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (err) {
      console.error('Claim error:', err);
      toast({ title: 'Failed to claim profile', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  };

  const openEditModal = () => {
    if (!entity) return;
    const ep = entity as EntityProfile;
    const socials = ep.socials as { instagram?: string; website?: string; facebook?: string } | null;
    setEditForm({
      name: entity.name || '',
      avatar_url: entity.avatar_url || '',
      bio: entity.bio || '',
      city: entity.cities?.name || '',
      instagram: ep.instagram || socials?.instagram || '',
      facebook: ep.facebook || socials?.facebook || '',
      website: ep.website || socials?.website || '',
      contact_email: ep.contact_email || '',
      contact_phone: ep.contact_phone || '',
      organisation_category: ep.organisation_category || '',
      founded_year: ep.founded_year ? String(ep.founded_year) : '',
    });
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!id || !user?.id) return;
    const city = normalizeRequiredCity(editForm.city);
    if (!hasRequiredCity(city)) {
      toast({ title: 'City is required', description: 'Please add city before saving.', variant: 'destructive' });
      return;
    }
    const canonicalCity = await resolveCanonicalCity(city);
    if (!canonicalCity) {
      toast({ title: 'Select a valid city', description: 'Please choose city from the city picker list.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const ig = editForm.instagram.trim() || null;
      const fb = editForm.facebook.trim() || null;
      const web = editForm.website.trim() || null;
      const existingSocials = ((entity as EntityProfile).socials as Record<string, unknown> | null) ?? {};
      const nextSocials = { ...existingSocials, instagram: ig, website: web, facebook: fb };
      const { error } = await supabase.from('organiser_profiles').update({
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
      }).eq('id', id).eq('claimed_by', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated' });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Unable to save changes. Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // groupedRows must be before early returns (Rules of Hooks)
  const nextEvent  = upcomingEvents[0] ?? null;
  const moreEvents = upcomingEvents.slice(1);

  const { groupedRows, totalHidden } = useMemo(() => {
    const rows = moreEvents.slice(0, 3);
    return { groupedRows: rows, totalHidden: moreEvents.length - rows.length };
  }, [moreEvents]);

  // --- Loading ---
  if (isLoading) {
    return (
      <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <div style={{ minHeight: '100vh', background: D.black }}>
          <div style={{ height: 320, background: HERO_BG_DEFAULT }} />
          <div style={{ padding: '32px 20px' }}>
            <Skeleton className="h-3 w-48 mb-4" style={{ background: 'rgba(246,241,234,0.1)' }} />
            <Skeleton className="h-10 w-3/4 mb-3" style={{ background: 'rgba(246,241,234,0.1)' }} />
            <Skeleton className="h-4 w-1/2" style={{ background: 'rgba(246,241,234,0.08)' }} />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // --- Not found ---
  if (error || !entity) {
    return (
      <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <div style={{ minHeight: '100vh', background: D.black, color: D.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY }}>
          <div className="text-center px-6">
            <h1 style={{ fontFamily: SERIF, fontSize: 48, color: D.cream, marginBottom: 12 }}>Organiser not found</h1>
            <p style={{ color: 'rgba(246,241,234,0.55)', fontSize: 14, maxWidth: 320, margin: '0 auto 24px' }}>
              The organiser profile you&rsquo;re looking for doesn&rsquo;t exist.
            </p>
            <button
              onClick={() => navigate('/organisers')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full"
              style={{ background: 'rgba(246,241,234,0.1)', border: '1px solid rgba(246,241,234,0.2)', color: D.cream, cursor: 'pointer' }}
            >
              <ChevronLeft className="w-4 h-4" /> Back to organisers
            </button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // --- Data prep ---
  const ep = entity as EntityProfile;
  const socials          = ep.socials as { instagram?: string; website?: string; facebook?: string } | null;
  const instagramRaw     = ep.instagram  || socials?.instagram  || null;
  const websiteRaw       = ep.website    || socials?.website    || null;
  const facebookRaw      = ep.facebook   || socials?.facebook   || null;
  const contactPhone     = ep.contact_phone || null;
  const contactEmail     = ep.contact_email || null;
  const organisationCategory = ep.organisation_category || null;

  const instagramUrl = instagramRaw ? (instagramRaw.startsWith('http') ? instagramRaw : `https://instagram.com/${instagramRaw.replace('@', '')}`) : null;
  const websiteUrl   = websiteRaw   ? (websiteRaw.startsWith('http')   ? websiteRaw   : `https://${websiteRaw}`)   : null;
  const facebookUrl  = facebookRaw
    ? (facebookRaw.startsWith('http') ? facebookRaw : facebookRaw.includes('facebook.com') ? `https://${facebookRaw}` : `https://facebook.com/${facebookRaw.replace('@', '')}`)
    : null;
  const whatsappUrl = contactPhone ? `https://wa.me/${String(contactPhone).replace(/\D/g, '')}` : null;

  const hasContact = !!(instagramUrl || facebookUrl || websiteUrl || whatsappUrl || contactEmail);

  const isClaimedByUser = entity.claimed_by === user?.id;
  const canClaim        = !!user && !entity.claimed_by;

  const cityName = entity.cities?.name ?? ep.city ?? null;
  const metaLine = [organisationCategory, cityName].filter(Boolean).join(' \u00b7 ');

  const visibleMore = showAllUpcoming ? moreEvents : groupedRows;
  const hiddenCount = showAllUpcoming ? 0 : totalHidden;
  const pastVisible = pastEvents.slice(0, 6);
  const pastExtra   = pastEvents.length - pastVisible.length;

  const foundedYear = (ep.founded_year as number | null | undefined) ?? null;
  const estYear     = foundedYear ?? (sinceYear !== null && sinceYear < new Date().getFullYear() ? sinceYear : null);
  const yearsActive = estYear !== null ? new Date().getFullYear() - estYear : null;

  const thirdStatValue = orderedTeam.length > 0 ? orderedTeam.length : (yearsActive ?? '--');
  const thirdStatLabel = orderedTeam.length > 0 ? 'Team members' : yearsActive ? 'Yrs active' : 'Since';

  // --- Render ---
  return (
    <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
      <article style={{ fontFamily: BODY, background: D.black, color: D.cream, minHeight: '100vh' }}>

        {/* HERO */}
        <header className="relative overflow-hidden" style={{ background: HERO_BG }}>
          <div style={{ position: 'absolute', top: '18%', left: '34%', width: 5, height: 5, borderRadius: '50%', background: D.lightGold, boxShadow: '0 0 14px 3px rgba(251,239,196,0.8)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '42%', left: '68%', width: 4, height: 4, borderRadius: '50%', background: '#FFD89A', boxShadow: '0 0 12px 3px rgba(255,216,154,0.7)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '64%', left: '22%', width: 3, height: 3, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 2px rgba(255,255,255,0.6)', pointerEvents: 'none' }} />

          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 8 }}>
            {isClaimedByUser && (
              <button onClick={openEditModal} aria-label="Edit profile" style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(12,10,13,0.5)', backdropFilter: 'blur(6px)', border: '1px solid rgba(246,241,234,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.cream, cursor: 'pointer' }}>
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canClaim && (
              <button onClick={handleClaim} style={{ padding: '8px 14px', borderRadius: 100, background: 'rgba(12,10,13,0.5)', backdropFilter: 'blur(6px)', border: '1px solid rgba(246,241,234,0.16)', color: D.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Claim
              </button>
            )}
          </div>

          {/* Mobile */}
          {(isMobile !== false) && <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 26, paddingLeft: 24, paddingRight: 24, textAlign: 'center' }}>
            <AvatarCircle avatarUrl={entity.avatar_url ?? null} name={entity.name} sizePx={104} fontSize={40} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {metaLine && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: D.gold }}>{metaLine}</span>}
              {ep.is_verified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(231,190,110,0.16)', border: '1px solid rgba(231,190,110,0.35)', color: D.cream }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                  Verified
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(36px,12vw,54px)', lineHeight: 0.95, margin: '0 0 8px', background: 'linear-gradient(110deg,#F4D89A,#E7BE6E 30%,#FBEFC4 50%,#D2A350 70%,#F4D89A)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: 'shimmer 7s linear infinite' }}>
              {entity.name}
            </h1>
            {entity.bio && (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(246,241,234,0.72)', fontWeight: 500, lineHeight: 1.4 }}>
                {entity.bio.split(/\.\s+/)[0]}{entity.bio.split(/\.\s+/).length > 1 ? '.' : ''}
              </p>
            )}
          </div>}

          {/* Desktop */}
          {(isMobile === false) && <div style={{ height: 438, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 48, right: 48, bottom: 40, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
              <AvatarCircle avatarUrl={entity.avatar_url ?? null} name={entity.name} sizePx={148} fontSize={52} />
              <div style={{ flex: 1, paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  {metaLine && <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold }}>{metaLine}</span>}
                  {ep.is_verified && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: D.cream, padding: '3px 9px', borderRadius: 100, background: 'rgba(231,190,110,0.16)', border: '1px solid rgba(231,190,110,0.35)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      Verified
                    </span>
                  )}
                </div>
                <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(48px,5vw,78px)', lineHeight: 0.95, margin: '0 0 12px', letterSpacing: '-0.01em', background: 'linear-gradient(110deg,#F4D89A,#E7BE6E 30%,#FBEFC4 50%,#D2A350 70%,#F4D89A)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: 'shimmer 7s linear infinite' }}>
                  {entity.name}
                </h1>
                {entity.bio && (
                  <p style={{ margin: 0, fontSize: 18, color: 'rgba(246,241,234,0.72)', fontWeight: 500 }}>
                    {entity.bio.split(/\.\s+/)[0]}{entity.bio.split(/\.\s+/).length > 1 ? '.' : ''}
                  </p>
                )}
              </div>

            </div>
          </div>}
        </header>

        {/* Brand colour fade ??? bleeds the hero tint into the body */}
        <div style={{ pointerEvents: 'none', position: 'relative', height: '10vh', maxHeight: 80, marginTop: '-1px', background: `linear-gradient(180deg,rgba(${cr},${cg},${cb},0.18) 0%,transparent 100%)`, zIndex: 0 }} />

        {/* Stats strip */}
        <div className="flex justify-around py-4 px-5" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
          {[
            { value: upcomingEvents.length, label: 'Upcoming events', gold: false },
            { value: pastEvents.length,     label: 'Past events',     gold: false },
            { value: thirdStatValue,         label: thirdStatLabel, gold: true },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: D.cream, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: D.gold, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ABOUT */}
        {entity.bio && (
          <section className="px-5 md:px-12 py-8 md:py-12" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold, margin: '0 0 14px' }}>About</p>
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2.5vw,27px)', lineHeight: 1.5, color: D.cream, margin: 0, fontWeight: 500, maxWidth: 760 }}>
              {entity.bio}
            </p>
          </section>
        )}

        {/* CONTACT */}
        {hasContact && (
          <section className="px-5 md:px-12 py-8 md:py-10" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold, margin: '0 0 16px' }}>Contact the organiser</p>

            {/* Desktop bar */}
            {(isMobile === false) && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/></svg>
                    {extractIgHandle(instagramRaw)}
                  </a>
                )}
                {facebookUrl && (
                  <a href={facebookUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, color: '#fff', background: '#1877F2', textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8.5v3H11v7h3v-7h2.4l.6-3H14V9z"/></svg>
                    {extractFbHandle(facebookRaw)}
                  </a>
                )}
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700, color: D.black, background: D.gold, textDecoration: 'none' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={D.black} strokeWidth="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>
                    {extractDomain(websiteRaw)}
                  </a>
                )}
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 24px', borderRadius: 100, fontSize: 14, fontWeight: 800, color: '#fff', background: '#25D366', boxShadow: '0 8px 24px rgba(37,211,102,0.32)', textDecoration: 'none' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg>
                    WhatsApp
                  </a>
                )}
            </div>}

            {/* Mobile pills */}
            {(isMobile !== false) && <div className="flex flex-col gap-2.5">
              {(instagramUrl || facebookUrl || websiteUrl) && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 13, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/></svg>
                      Instagram
                    </a>
                  )}
                  {facebookUrl && (
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 13, fontSize: 12.5, fontWeight: 700, color: '#fff', background: '#1877F2', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8.5v3H11v7h3v-7h2.4l.6-3H14V9z"/></svg>
                      Facebook
                    </a>
                  )}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', borderRadius: 13, fontSize: 12.5, fontWeight: 700, color: D.black, background: D.gold, textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.black} strokeWidth="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>
                      Website
                    </a>
                  )}
                </div>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '14px 0', borderRadius: 13, fontSize: 14, fontWeight: 800, color: '#fff', background: '#25D366', boxShadow: '0 8px 24px rgba(37,211,102,0.28)', textDecoration: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg>
                  Message on WhatsApp
                </a>
              )}
              {contactEmail && !whatsappUrl && (
                <a href={`mailto:${contactEmail}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 0', borderRadius: 13, fontSize: 13, fontWeight: 700, color: D.cream, background: 'rgba(246,241,234,0.08)', border: '1px solid rgba(246,241,234,0.15)', textDecoration: 'none' }}>
                  {contactEmail}
                </a>
              )}
            </div>}
          </section>
        )}

        {/* NEXT EVENT */}
        {nextEvent && (() => {
          const td = ticketDateParts(nextEvent.displayStart);
          const time = eventTime(nextEvent.displayStart);
          const venue = nextEvent.location?.trim() || nextEvent.city?.trim() || '';
          const href = nextEvent.occurrenceId ? `/event/${nextEvent.id}?occurrenceId=${nextEvent.occurrenceId}` : `/event/${nextEvent.id}`;
          return (
            <section className="px-5 md:px-12 py-8 md:py-10" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold, margin: '0 0 16px' }}>Next event</p>
              <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(231,190,110,0.30)', boxShadow: '0 20px 50px -28px rgba(255,106,44,0.45)' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 'clamp(80px,20vw,188px)', flexShrink: 0, padding: 'clamp(16px,3vw,30px) 12px', textAlign: 'center', background: 'radial-gradient(circle at 50% 28%,rgba(255,106,44,0.42),transparent 62%),linear-gradient(160deg,#33202b,#15101a)', borderRight: '2px dashed rgba(231,190,110,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: D.orange }}>{td.wd || td.mon}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 'clamp(44px,8vw,80px)', fontWeight: 600, lineHeight: 0.85, margin: '4px 0', color: D.cream }}>{td.day}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: D.gold }}>{td.mon} {td.yr}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: 'clamp(16px,3vw,30px) clamp(14px,4vw,34px)', position: 'relative', overflow: 'hidden', background: nextEvent.poster_url ? undefined : 'radial-gradient(circle at 96% 12%,rgba(255,106,44,0.18),transparent 44%),linear-gradient(150deg,#1a1018,#0C0A0D)' }}>
                    {nextEvent.poster_url && <>
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${nextEvent.poster_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.22 }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(12,10,13,0.85) 0%,rgba(12,10,13,0.55) 60%,rgba(12,10,13,0.3) 100%)' }} />
                    </>}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(20px,4vw,36px)', lineHeight: 1.05, margin: '0 0 12px', color: D.cream }}>{nextEvent.name}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', color: 'rgba(246,241,234,0.7)', fontSize: 13 }}>
                      {venue && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="1.9" aria-hidden="true"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                          {venue}
                        </span>
                      )}
                      {time && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
                          {time}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <Link to={href} style={{ fontSize: 13, fontWeight: 800, color: D.black, padding: '12px 28px', borderRadius: 100, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E 55%,#FF6A2C)', boxShadow: '0 8px 24px rgba(255,106,44,0.32)', textDecoration: 'none', display: 'inline-block' }}>
                        View event
                      </Link>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ALL UPCOMING */}
        {moreEvents.length > 0 && (
          <section className="px-5 md:px-12 py-8 md:py-10" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,32px)', margin: 0, color: D.cream }}>All upcoming events</h2>
              <span style={{ fontSize: 12, color: 'rgba(246,241,234,0.5)', fontWeight: 600 }}>{moreEvents.length} {moreEvents.length === 1 ? 'date' : 'dates'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(246,241,234,0.08)' }}>
              {visibleMore.map((e) => (
                <div key={e.occurrenceId ?? e.id} style={{ background: 'rgba(246,241,234,0.03)' }}>
                  <UpcomingRow event={e} />
                </div>
              ))}
            </div>
            {!showAllUpcoming && hiddenCount > 0 && (
              <button onClick={() => setShowAllUpcoming(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'none', border: 'none', color: D.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
                Show all {moreEvents.length} dates
              </button>
            )}
          </section>
        )}

        {/* TEACHERS & DJs */}
        {orderedTeam.length > 0 && (
          <section className="px-5 md:px-12 py-8 md:py-12" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,32px)', margin: 0, color: D.cream }}>Teachers &amp; DJs</h2>
              <span style={{ fontSize: 12, color: 'rgba(246,241,234,0.5)', fontWeight: 600 }}>{orderedTeam.length} {orderedTeam.length === 1 ? 'member' : 'members'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: orderedTeam.length <= 3 ? 'center' : 'flex-start' }}>
              {orderedTeam.map((m) => <div key={m.id} style={{ width: 88, flexShrink: 0 }}><TeamCircle member={m} /></div>)}
            </div>
          </section>
        )}

        {/* PAST EVENTS */}
        {pastEvents.length > 0 && (
          <section className="px-5 md:px-12 py-8 md:py-12">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,32px)', margin: 0, color: D.cream }}>Past nights</h2>
              <span style={{ fontSize: 12, color: 'rgba(246,241,234,0.5)', fontWeight: 600 }}>{pastEvents.length} hosted</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {pastVisible.map((e, i) => (
                <Link key={e.occurrenceId ?? e.id} to={e.occurrenceId ? `/event/${e.id}?occurrenceId=${e.occurrenceId}` : `/event/${e.id}`} style={{ aspectRatio: '1', borderRadius: 10, position: 'relative', overflow: 'hidden', display: 'block', background: e.poster_url ? undefined : PAST_GRADS[i % PAST_GRADS.length], backgroundImage: e.poster_url ? `url(${e.poster_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', textDecoration: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '6px 7px', background: 'linear-gradient(transparent,rgba(12,10,13,0.88))', fontSize: 9, fontWeight: 700, color: D.cream, lineHeight: 1.3 }}>
                    {e.name.length > 14 ? e.name.slice(0, 13) + '???' : e.name}
                  </div>
                </Link>
              ))}
              {pastExtra > 0 && (
                <div style={{ aspectRatio: '1', borderRadius: 10, background: 'linear-gradient(160deg,#241820,#100b13)', border: '1px solid rgba(231,190,110,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: D.gold, lineHeight: 1 }}>+{pastExtra}</div>
                  <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(246,241,234,0.55)', marginTop: 2 }}>more</div>
                </div>
              )}
            </div>
          </section>
        )}

      </article>

      {/* EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Organiser name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisation_category">Category</Label>
              <Input id="organisation_category" value={editForm.organisation_category} onChange={(e) => setEditForm({ ...editForm, organisation_category: e.target.value })} placeholder="Event Brand, Dance School, Community Group..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founded_year">Founded year</Label>
              <Input id="founded_year" type="number" inputMode="numeric" value={editForm.founded_year} onChange={(e) => setEditForm({ ...editForm, founded_year: e.target.value })} placeholder="e.g. 2015" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input id="avatar_url" value={editForm.avatar_url} onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <CityPicker value={editForm.city} onChange={(city) => setEditForm({ ...editForm, city })} placeholder="Select city..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="About this organiser..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" value={editForm.instagram} onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })} placeholder="@username or full URL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input id="facebook" value={editForm.facebook} onChange={(e) => setEditForm({ ...editForm, facebook: e.target.value })} placeholder="Page URL or username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input id="contact_email" type="email" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} placeholder="hello@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact phone / WhatsApp</Label>
              <Input id="contact_phone" type="tel" value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} placeholder="+44 7700 900000" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>Cancel</Button>
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
