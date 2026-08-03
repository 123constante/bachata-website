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
import { londonDayRangeUtc } from '@/lib/londonDate';
import {
  type WallClock,
  asWallClockOrNull,
  formatWallClockLocal,
  formatWallClockLocalIntl,
  wallClockExactDateKey,
} from '@/lib/time/wallClock';
import { useLondonToday } from '@/hooks/useLondonToday';
import { optimizedImageUrl, cssUrl, srcWidthFor } from '@/lib/imageCdn';
import EventRowCard, { type EventRowProps } from '@/components/events/EventRow';
import SeriesDatesSheet from '@/components/events/SeriesDatesSheet';
import { groupByEventId, stableRowKey } from '@/lib/eventListGrouping';

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

type OrgEvent = EventRow & { displayStart: WallClock | null; occurrenceId?: string | null };

type UpcomingListItem =
  | { kind: 'single'; event: OrgEvent }
  | {
      kind: 'series';
      eventId: string;
      name: string;
      posterUrl: string | null;
      location: string | null;
      dates: OrgEvent[];
    };

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

// displayStart is a branded WallClock (stored local-as-UTC). These read it
// AS STORED via the wallClock formatters -- the old `new Date(raw).toLocale*`
// rendered the time an hour late in BST (the live "8:00pm" bug for a stored
// 19:00 on /organisers/cumbaye) and the date a day early west of UTC.
const dateParts = (wc: WallClock | null | undefined): { day: string; mon: string } => {
  const day = formatWallClockLocal(wc, 'dd');
  const mon = formatWallClockLocal(wc, 'MMM');
  if (!day || !mon) return { day: '--', mon: 'TBA' };
  return { day, mon: mon.toUpperCase() };
};

// Both operands below are plain YYYY-MM-DD date keys, diffed via Date.UTC --
// never `new Date(rawString)` on a datetime string, which is what caused the
// BST off-by-one bug the comment above documents.
const daysFromToday = (dateKey: string, todayKey: string): number => {
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const [ey, em, ed] = dateKey.split('-').map(Number);
  const t = Date.UTC(ty, tm - 1, td);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.round((e - t) / 86400000);
};

const countdownLabel = (wc: WallClock | null | undefined, todayKey: string): string => {
  const key = formatWallClockLocal(wc, 'yyyy-MM-dd');
  if (!key) return '';
  const diff = daysFromToday(key, todayKey);
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return 'next week';
  return `in ${Math.round(diff / 7)} weeks`;
};

const eventTime = (wc: WallClock | null | undefined): string | null => {
  // A date-only value (the instance_date fallback) carries no time; and suppress
  // an exact-midnight placeholder, as the old `!raw.includes('T')` / 00:00 gates did.
  if (!wc || wallClockExactDateKey(wc) || formatWallClockLocal(wc, 'HH:mm') === '00:00') {
    return null;
  }
  const s = formatWallClockLocalIntl(wc, { hour: 'numeric', minute: '2-digit', hour12: true });
  return s ? s.replace(/\s/g, '').toLowerCase() : null;
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
        <img src={optimizedImageUrl(avatarUrl, srcWidthFor(sizePx))} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
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
            <img src={optimizedImageUrl(member.avatarUrl, srcWidthFor(88))} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
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

// Builds EventRow props for a single occurrence. EventRow itself stays
// time-library-agnostic; all WallClock formatting happens here.
const buildEventRowProps = (
  event: OrgEvent,
  todayKey: string,
  fallbackIndex: number,
  chip?: string,
  onClick?: () => void,
): EventRowProps => {
  const { day, mon } = dateParts(event.displayStart);
  const time = eventTime(event.displayStart);
  const venue = event.location?.trim() || event.city?.trim() || '';
  const meta = [countdownLabel(event.displayStart, todayKey), venue, time].filter(Boolean).join(' \u00b7 ');
  const href = event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`;
  return {
    href,
    name: event.name,
    posterUrl: event.poster_url,
    dateDay: day,
    dateMon: mon,
    meta,
    fallbackIndex,
    chip,
    onClick,
  };
};

// --- Colour extraction ---

function useAverageColor(url: string | null): [number, number, number] {
  const [rgb, setRgb] = React.useState<[number, number, number]>([255, 106, 44]);
  React.useEffect(() => {
    if (!url) return;
    // No crossOrigin: the cover CDN (Cloudflare R2) sends no CORS headers, so a
    // crossOrigin='anonymous' request fails with net::ERR_FAILED -- a console
    // error for every organiser page (and the colour sample fell back to default
    // anyway). Without it the request reuses the already-cached non-CORS <img>
    // fetch (no second request, no error); the canvas then taints and
    // getImageData throws below, caught -> same default colour. To actually
    // enable colour theming, add CORS headers to the R2 bucket and restore
    // crossOrigin here.
    const img = new Image();
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
  const [openSeriesEventId, setOpenSeriesEventId] = useState<string | null>(null);
  const [showAllPastYears, setShowAllPastYears] = useState(false);
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
      // 3650 days (~10y), not the old 730-day (~2y) cap: the Past nights
      // accordion groups by year and needs to reach back to when this
      // organiser actually started, not an arbitrary recent slice -- a 2-year
      // cap silently hid whole years for any organiser older than that,
      // contradicting the "hosted since <year>" stat already shown above.
      const from = new Date(Date.now() - 3650 * 86400000).toISOString().slice(0, 10);
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

  // Start of London-today as a true-UTC instant; reactive so a long-lived tab
  // rolls the upcoming/past split over at midnight (was frozen at mount).
  const todayKey = useLondonToday();
  const todayMs = useMemo(() => londonDayRangeUtc(todayKey).start.getTime(), [todayKey]);

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
      upcoming.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: asWallClockOrNull(occ.start_time ?? occ.instance_date), occurrenceId: occ.occurrence_id });
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
      // startRaw stays a RAW string: it feeds the dedupe key (a template
      // interpolation, which the brand forbids). displayStart is branded below.
      const startRaw = occ.start_time ?? occ.instance_date ?? null;
      const dedupeKey = occ.occurrence_id ?? `${occ.event_id}:${startRaw}`;
      if (pastSeen.has(dedupeKey)) continue;
      pastSeen.add(dedupeKey);
      const poster = occ.cover_image_url || (Array.isArray(occ.photo_url) ? occ.photo_url[0] : null) || e.poster_url;
      past.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: asWallClockOrNull(startRaw), occurrenceId: occ.occurrence_id });
    }
    // Base-date fallback only for legacy events the occurrence feed never
    // surfaced (no future AND no past occurrence row at all). EventRow.start_time
    // / .date stay RAW strings -- their semantics are genuinely mixed and this
    // fallback is unreachable on live data (0 of 15 organisers sampled); displayStart
    // is branded at the push.
    const eventsWithAnyOcc = new Set<string>([...eventsWithFutureOcc, ...pastOccs.map((o) => o.event_id)]);
    for (const e of allEvents) {
      if (eventsWithAnyOcc.has(e.id)) continue;
      const baseRaw = e.start_time ?? e.date;
      const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
      const nextStart = baseRaw && !Number.isNaN(baseMs) && baseMs >= todayMs ? baseRaw : null;
      if (nextStart) { upcoming.push({ ...e, displayStart: asWallClockOrNull(nextStart), occurrenceId: null }); }
      else if (!baseRaw) { upcoming.push({ ...e, displayStart: null, occurrenceId: null }); }
      else { past.push({ ...e, displayStart: asWallClockOrNull(baseRaw), occurrenceId: null }); }
    }
    // Sort by a reader-derived key, NOT `displayStart ?? ''` -- coercing a branded
    // WallClock to '' launders it to `string & WallClock` (defeats the brand).
    const sortKey = (wc: WallClock | null): string =>
      formatWallClockLocal(wc, "yyyy-MM-dd'T'HH:mm") ?? '';
    upcoming.sort((a, b) => sortKey(a.displayStart).localeCompare(sortKey(b.displayStart)));
    past.sort((a, b) => sortKey(b.displayStart).localeCompare(sortKey(a.displayStart)));
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

  // Groups upcomingEvents (one OrgEvent per occurrence, already sorted
  // ascending) by event_id: a recurring series (3+ upcoming dates sharing an
  // event_id) collapses to one 'series' item; 1-2-date groups stay as
  // individual 'single' items. Because upcomingEvents is sorted ascending and
  // grouping preserves first-seen order, `items` comes out "soonest first"
  // for both singles and series with no secondary sort needed -- a series'
  // position is anchored to its earliest upcoming date, which is what we want.
  // Must be before early returns (Rules of Hooks).
  const upcomingListItems = useMemo((): UpcomingListItem[] => {
    return groupByEventId(upcomingEvents).map((g): UpcomingListItem => {
      if (g.kind === 'single') return g;
      const first = g.dates[0];
      return {
        kind: 'series',
        eventId: g.eventId,
        name: first.name,
        posterUrl: first.poster_url,
        location: first.location,
        dates: g.dates,
      };
    });
  }, [upcomingEvents]);

  const visibleItems = showAllUpcoming ? upcomingListItems : upcomingListItems.slice(0, 3);
  const hiddenItems = upcomingListItems.slice(visibleItems.length);
  // "dates" counts individual occurrences, not list rows -- a collapsed
  // series row counts for all of its dates, not just 1, so this matches what
  // "Show all" actually reveals.
  const itemDateCount = (item: UpcomingListItem): number => (item.kind === 'series' ? item.dates.length : 1);
  const totalUpcomingDateCount = upcomingListItems.reduce((sum, item) => sum + itemDateCount(item), 0);

  const openSeries = upcomingListItems.find(
    (it): it is Extract<UpcomingListItem, { kind: 'series' }> =>
      it.kind === 'series' && it.eventId === openSeriesEventId,
  ) ?? null;

  // pastEvents is already sorted descending (most recent first), so grouping
  // by first-seen year preserves that order -- no re-sort needed. Memoized
  // like upcomingListItems above: the past window is 10 years, so this walk
  // is worth skipping on unrelated re-renders (edit modal, showAllUpcoming).
  // Must be before early returns (Rules of Hooks).
  const pastByYear = useMemo((): { year: string; events: OrgEvent[] }[] => {
    const byYear = new Map<string, OrgEvent[]>();
    const groups: { year: string; events: OrgEvent[] }[] = [];
    for (const e of pastEvents) {
      const year = formatWallClockLocal(e.displayStart, 'yyyy') ?? 'Unknown';
      if (!byYear.has(year)) { byYear.set(year, []); groups.push({ year, events: byYear.get(year)! }); }
      byYear.get(year)!.push(e);
    }
    return groups;
  }, [pastEvents]);

  // Only the most recent 3 years mount by default -- a decade-old organiser's
  // full history is fetched (for the "since <year>" stat) but doesn't need to
  // render 500+ DOM rows on a mobile-first page just because they're collapsed.
  const visiblePastYears = showAllPastYears ? pastByYear : pastByYear.slice(0, 3);
  const hiddenPastYears = pastByYear.slice(visiblePastYears.length);

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
              <div style={{ fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: D.gold, marginTop: 3 }}>{s.label}</div>
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

        {/* UPCOMING EVENTS */}
        {upcomingListItems.length > 0 && (
          <section className="px-5 md:px-12 py-8 md:py-10" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,32px)', margin: 0, color: D.cream }}>Upcoming events</h2>
              <span style={{ fontSize: 12, color: 'rgba(246,241,234,0.5)', fontWeight: 600 }}>{upcomingListItems.length} {upcomingListItems.length === 1 ? 'event' : 'events'}</span>
            </div>
            <div className="flex flex-col gap-2">
              {visibleItems.map((item, i) =>
                item.kind === 'single' ? (
                  <EventRowCard key={stableRowKey(item.event.occurrenceId, item.event.id, i)} {...buildEventRowProps(item.event, todayKey, i)} />
                ) : (
                  <EventRowCard
                    key={item.eventId}
                    href={`/event/${item.eventId}`}
                    name={item.name}
                    posterUrl={item.posterUrl}
                    dateDay={dateParts(item.dates[0].displayStart).day}
                    dateMon={dateParts(item.dates[0].displayStart).mon}
                    meta={[countdownLabel(item.dates[0].displayStart, todayKey), item.location].filter(Boolean).join(' · ')}
                    fallbackIndex={i}
                    chip={`${item.dates.length} dates`}
                    onClick={() => setOpenSeriesEventId(item.eventId)}
                  />
                ),
              )}
            </div>
            {!showAllUpcoming && hiddenItems.length > 0 && (
              <button onClick={() => setShowAllUpcoming(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'none', border: 'none', color: D.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
                Show all {totalUpcomingDateCount} dates
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
            <div className="flex flex-col gap-2">
              {visiblePastYears.map((group, gi) => (
                <details key={group.year} open={gi === 0} className="rounded-2xl border" style={{ borderColor: 'rgba(246,241,234,0.08)', padding: '10px 12px' }}>
                  <summary
                    className="flex cursor-pointer list-none items-center justify-between"
                    style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(246,241,234,0.5)' }}
                  >
                    <span>{group.year} &middot; {group.events.length} {group.events.length === 1 ? 'night' : 'nights'}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </summary>
                  <div className="mt-2 flex flex-col">
                    {group.events.map((e, i) => {
                      const href = e.occurrenceId ? `/event/${e.id}?occurrenceId=${e.occurrenceId}` : `/event/${e.id}`;
                      const label = formatWallClockLocal(e.displayStart, 'EEEE d MMM') ?? 'TBA';
                      return (
                        <Link
                          key={stableRowKey(e.occurrenceId, e.id, i)}
                          to={href}
                          className="flex items-center gap-2 py-1.5 no-underline"
                          style={{ borderBottom: i < group.events.length - 1 ? '1px solid rgba(246,241,234,0.05)' : undefined }}
                        >
                          <span
                            className="h-[22px] w-[22px] flex-shrink-0 rounded-md"
                            style={{ background: e.poster_url ? undefined : PAST_GRADS[i % PAST_GRADS.length], backgroundImage: cssUrl(e.poster_url, srcWidthFor(22)), backgroundSize: 'cover', backgroundPosition: 'center' }}
                          />
                          <span className="flex-shrink-0" style={{ width: 96, fontSize: 11.5, color: D.cream }}>{label}</span>
                          <span className="min-w-0 flex-1 truncate text-right" style={{ fontSize: 11.5, color: 'rgba(246,241,234,0.6)' }}>{e.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
            {!showAllPastYears && hiddenPastYears.length > 0 && (
              <button onClick={() => setShowAllPastYears(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'none', border: 'none', color: D.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
                Show earlier years ({hiddenPastYears.length})
              </button>
            )}
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

      <SeriesDatesSheet
        open={!!openSeries}
        onOpenChange={(o) => { if (!o) setOpenSeriesEventId(null); }}
        seriesName={openSeries?.name ?? ''}
        dates={(openSeries?.dates ?? []).map((e, i) => buildEventRowProps(e, todayKey, i))}
      />
    </GlobalLayout>
  );
};

export default OrganiserProfile;
