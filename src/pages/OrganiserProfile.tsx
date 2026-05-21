import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Pencil, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
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

// Trading-card gradients for the Coming Soon grid. Cycle by event index.
// Same palette as the upcoming mini-cards from the picked mockup: orange/rose,
// purple/blue, emerald/cyan, pink/amber. Locked to 4 for a deliberate rhythm.
const TRADING_GRADIENTS = [
  'bg-gradient-to-br from-orange-500 to-rose-700',
  'bg-gradient-to-br from-purple-600 to-blue-700',
  'bg-gradient-to-br from-emerald-600 to-cyan-600',
  'bg-gradient-to-br from-pink-600 to-amber-500',
];

// 3-letter initials for 3-plus-word names; first 4 chars for 1-2 word names.
// Punctuation stripped, whitespace collapsed.
const makeAbbrev = (name: string | null | undefined): string => {
  if (!name) return '?';
  const words = name.replace(/[^\w\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length >= 3) {
    return words.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
  }
  return words.join('').toUpperCase().slice(0, 4);
};

const formatTradingDate = (raw: string | null): string => {
  if (!raw) return 'TBA';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'TBA';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  return `${day} ${month}`;
};

const formatCreditDate = (raw: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// First non-"The" word from the venue, capped at 6 chars. Keeps the
// trading-card meta block readable inside roughly 77px of card width.
const venueShort = (event: EventRow): string => {
  const raw = event.location?.trim() || event.city?.trim() || '';
  if (!raw) return '';
  const words = raw.split(/\s+/).filter((w) => w.toLowerCase() !== 'the');
  return (words[0] || raw).slice(0, 6);
};

const toRoman = (num: number): string => {
  const pairs: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = num;
  let out = '';
  for (const [val, sym] of pairs) {
    while (n >= val) { out += sym; n -= val; }
  }
  return out;
};

// Connect-tile handle extraction (preserved from previous impl)
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

// Em-dashed section header rendered as: [dash] Starring [dash]
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex justify-center items-center font-extralight text-[11px] tracking-[0.5em] text-neutral-400 uppercase pt-6 pb-3.5">
    <span className="text-neutral-700 mx-3.5">&mdash;</span>
    {children}
    <span className="text-neutral-700 mx-3.5">&mdash;</span>
  </h2>
);

// Two-column credits row: role (right, muted), name (left, white).
// Tappable when an href is provided.
const CreditRow = ({
  role,
  name,
  href,
  external = false,
}: {
  role: string;
  name: React.ReactNode;
  href?: string;
  external?: boolean;
}) => {
  const inner = (
    <>
      <div className="text-right text-neutral-400 text-[9.5px] tracking-[0.28em] uppercase font-normal">
        {role}
      </div>
      <div className="text-center text-neutral-700 text-[11px]">&middot;</div>
      <div className="text-left text-white text-[13px] tracking-[0.06em] font-light truncate">
        {name}
      </div>
    </>
  );
  const cls = cn(
    'grid grid-cols-[1fr_14px_1fr] gap-2.5 items-baseline py-2 border-b border-dashed border-white/[0.08] transition-colors',
    href && 'cursor-pointer hover:bg-orange-500/[0.04]',
  );
  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {inner}
        </a>
      );
    }
    return (
      <Link to={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
};

const OrganiserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  });

  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: async () => {
      if (!id) throw new Error('Entity ID is required');
      const { data, error } = await supabase
        .from('organiser_profiles')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
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

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['organiser-team', id],
    queryFn: async () => {
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

  const teamWithoutLeader = useMemo(
    () => (leader ? teamMembers.filter((m) => m.id !== leader.id) : teamMembers),
    [teamMembers, leader],
  );

  const todayMs = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: EventRow[] = [];
    const past: EventRow[] = [];
    for (const e of allEvents) {
      const raw = e.start_time ?? e.date;
      if (!raw) {
        upcoming.push(e);
        continue;
      }
      const ts = new Date(raw).getTime();
      if (Number.isNaN(ts)) {
        upcoming.push(e);
      } else if (ts >= todayMs) {
        upcoming.push(e);
      } else {
        past.push(e);
      }
    }
    upcoming.sort((a, b) => {
      const aT = a.start_time ?? a.date ?? '';
      const bT = b.start_time ?? b.date ?? '';
      return aT.localeCompare(bT);
    });
    past.sort((a, b) => {
      const aT = a.start_time ?? a.date ?? '';
      const bT = b.start_time ?? b.date ?? '';
      return bT.localeCompare(aT);
    });
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents, todayMs]);

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

  const currentYearRoman = useMemo(() => toRoman(new Date().getFullYear()), []);

  const totalEventsCount = allEvents.length;
  const showSinceYear = sinceYear !== null && sinceYear < new Date().getFullYear();

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
      <GlobalLayout
        breadcrumbs={organiserBreadcrumbs}
        backHref="/organisers"
        showGradientBg={false}
        showProgressBar={false}
      >
        <article className="bg-black text-neutral-100 min-h-screen pb-12">
          <div className="px-4 pt-20 pb-5 border-b border-white/[0.08] text-center">
            <Skeleton className="h-3 w-44 mx-auto mb-4 bg-white/5" />
            <Skeleton className="h-7 w-60 mx-auto mb-3 bg-white/5" />
            <Skeleton className="h-3 w-32 mx-auto bg-white/5" />
          </div>
          <SectionHeader>Loading credits</SectionHeader>
          <div className="px-4 pb-4 flex flex-col items-center gap-3">
            <Skeleton className="h-[84px] w-[84px] rounded-full bg-white/5" />
            <Skeleton className="h-4 w-40 bg-white/5" />
            <Skeleton className="h-3 w-28 bg-white/5" />
          </div>
        </article>
      </GlobalLayout>
    );
  }

  // Not-found state
  if (error || !entity) {
    return (
      <GlobalLayout
        breadcrumbs={organiserBreadcrumbs}
        backHref="/organisers"
        showGradientBg={false}
        showProgressBar={false}
      >
        <article className="bg-black text-neutral-100 min-h-screen pb-12">
          <div className="px-4 pt-16 pb-5 text-center">
            <div className="font-light text-[10px] tracking-[0.5em] text-neutral-500 uppercase mb-4 flex items-center justify-center">
              <span className="text-neutral-700 mx-3">&mdash;</span>
              the end
              <span className="text-neutral-700 mx-3">&mdash;</span>
            </div>
            <h1 className="font-extralight text-2xl tracking-[0.22em] text-white uppercase mb-4 leading-tight">
              Production not found
            </h1>
            <p className="text-neutral-400 text-sm mb-8 max-w-xs mx-auto">
              The organiser profile you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate('/organisers')} variant="outline" className="font-light text-[9.5px] tracking-[0.32em] uppercase">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Organisers
            </Button>
          </div>
        </article>
      </GlobalLayout>
    );
  }

  // Data preparation
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

  const igLabel = extractIgHandle(instagramRaw);
  const fbLabel = extractFbHandle(facebookRaw);
  const webLabel = extractDomain(websiteRaw);
  const emailLabel = contactEmail ? String(contactEmail) : 'Email';
  const phoneLabel = contactPhone ? String(contactPhone).trim() : 'Call';

  type ConnectItem = { key: string; href: string; role: string; name: string; external: boolean };
  const connectItems: ConnectItem[] = [];
  if (instagramUrl) connectItems.push({ key: 'ig', href: instagramUrl, role: 'Instagram', name: igLabel, external: true });
  if (facebookUrl) connectItems.push({ key: 'fb', href: facebookUrl, role: 'Facebook', name: fbLabel, external: true });
  if (websiteUrl) connectItems.push({ key: 'web', href: websiteUrl, role: 'Website', name: webLabel, external: true });
  if (emailHref) connectItems.push({ key: 'mail', href: emailHref, role: 'Email', name: emailLabel, external: false });
  if (phoneHref) connectItems.push({ key: 'phone', href: phoneHref, role: 'Phone', name: phoneLabel, external: false });

  const isUnclaimed = !entity.claimed_by;
  const isClaimedByUser = entity.claimed_by === user?.id;
  const canClaim = !!user && isUnclaimed;

  const cityName = entity.cities?.name ?? (entity as any).city ?? null;

  // Stats triplet: render only the cells that have data. Falls back gracefully
  // to 2-up or 1-up when team / upcoming are empty.
  const statsCells: Array<{ value: number; label: string }> = [];
  if (totalEventsCount > 0) statsCells.push({ value: totalEventsCount, label: 'Events' });
  if (teamMembers.length > 0) statsCells.push({ value: teamMembers.length, label: 'Crew' });
  if (upcomingEvents.length > 0) statsCells.push({ value: upcomingEvents.length, label: 'Upcoming' });

  // Perforated filmstrip edges: repeating-linear-gradient computed once so the
  // two strip edges (top and bottom) reuse the same value.
  const strip = 'repeating-linear-gradient(90deg, transparent 0, transparent 18px, white 18px, white 20px, transparent 20px, transparent 30px)';

  return (
    <GlobalLayout
      breadcrumbs={organiserBreadcrumbs}
      backHref="/organisers"
      showGradientBg={false}
      showProgressBar={false}
    >
      <article className="bg-black text-neutral-100 min-h-screen pb-12">

        {/* Opening title card */}
        <header className="px-4 pt-20 pb-5 border-b border-white/[0.08] text-center">
          <div className="font-light text-[10px] tracking-[0.5em] text-neutral-500 uppercase mb-4 flex items-center justify-center">
            <span className="text-neutral-700 mx-3">&mdash;</span>
            a {entity.name} production
            <span className="text-neutral-700 mx-3">&mdash;</span>
          </div>
          <h1 className="font-extralight text-2xl sm:text-3xl tracking-[0.22em] text-white uppercase leading-[1.15]">
            {entity.name}
          </h1>
          {(cityName || showSinceYear) && (
            <div className="font-light text-[9.5px] tracking-[0.32em] text-neutral-400 mt-3.5 uppercase">
              {cityName && <span>{cityName}</span>}
              {cityName && showSinceYear && <span className="text-neutral-700 mx-1.5">&middot;</span>}
              {showSinceYear && <span>est. {sinceYear}</span>}
            </div>
          )}
          {(organisationCategory || cityName) && (
            <div className="flex justify-center gap-2 mt-3.5 flex-wrap">
              {organisationCategory && (
                <Link
                  to={`/organisers?category=${encodeURIComponent(organisationCategory)}`}
                  className="inline-flex items-center gap-1.5 font-light text-[9px] tracking-[0.28em] text-orange-400 uppercase px-2.5 py-1.5 border border-orange-500/40 rounded-full hover:border-orange-500 transition-colors"
                  aria-label={`See all ${organisationCategory} organisers`}
                >
                  <span className="w-[3px] h-[3px] rounded-full bg-current opacity-70" />
                  {organisationCategory}
                </Link>
              )}
              {cityName && (
                <Link
                  to="/cities"
                  className="inline-flex items-center gap-1.5 font-light text-[9px] tracking-[0.28em] text-white uppercase px-2.5 py-1.5 border border-white/[0.16] rounded-full hover:border-orange-500 hover:text-orange-400 transition-colors"
                  aria-label={`See ${cityName}`}
                >
                  <span className="w-[3px] h-[3px] rounded-full bg-current opacity-70" />
                  {cityName}
                </Link>
              )}
            </div>
          )}
          {canClaim && (
            <button
              onClick={handleClaim}
              className="inline-block mt-5 font-normal text-[9.5px] tracking-[0.32em] text-orange-400 uppercase border-y border-orange-500/30 px-3.5 py-1.5 hover:text-orange-300 hover:border-orange-500/50 transition-colors"
            >
              &laquo; claim this profile
            </button>
          )}
        </header>

        {/* Stats triplet */}
        {statsCells.length > 0 && (
          <div
            className="grid border-b border-white/[0.08] py-5 px-4"
            style={{ gridTemplateColumns: `repeat(${statsCells.length}, minmax(0, 1fr))` }}
          >
            {statsCells.map((c, i) => (
              <div key={c.label} className="relative text-center">
                {i > 0 && (
                  <span className="absolute left-0 top-[14%] bottom-[14%] w-px bg-white/[0.16]" />
                )}
                <div className="font-extralight text-[28px] text-white leading-none tracking-[0.04em]">
                  {c.value}
                </div>
                <div className="font-light text-[8.5px] tracking-[0.34em] text-neutral-400 uppercase mt-1.5">
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Directed by (head organiser) */}
        {leader && (
          <>
            <SectionHeader>Directed by</SectionHeader>
            <div className="px-4 pb-4 flex flex-col items-center gap-3 relative">
              {isClaimedByUser && (
                <button
                  type="button"
                  onClick={openEditModal}
                  aria-label="Edit profile"
                  className="absolute -top-2 right-4 w-[26px] h-[26px] rounded-full border border-white/[0.16] bg-black text-neutral-400 hover:border-orange-500 hover:text-orange-400 transition-colors flex items-center justify-center"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              <Avatar
                className="w-[84px] h-[84px] border border-white/[0.16]"
                style={{ filter: 'grayscale(0.35) contrast(1.05)' }}
              >
                <AvatarImage src={leader.avatarUrl || undefined} alt={leader.name} />
                <AvatarFallback className="bg-gradient-to-br from-neutral-700 to-neutral-900 text-white font-extralight text-3xl tracking-[0.04em]">
                  {leader.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {leader.dancerId ? (
                <Link
                  to={`/dancers/${leader.dancerId}`}
                  className="font-light text-base tracking-[0.32em] text-white uppercase hover:text-orange-400 transition-colors text-center"
                >
                  {leader.name}
                </Link>
              ) : (
                <div className="font-light text-base tracking-[0.32em] text-white uppercase text-center">
                  {leader.name}
                </div>
              )}
              <div className="font-normal text-[9px] tracking-[0.4em] text-orange-400 uppercase text-center">
                {leader.role || (leader.isHead ? 'Head organiser' : 'Lead')}
              </div>
            </div>
          </>
        )}

        {/* Starring (crew) */}
        {teamWithoutLeader.length > 0 && (
          <>
            <SectionHeader>Starring</SectionHeader>
            <div className="px-4 pb-2">
              {teamWithoutLeader.map((member) => (
                <CreditRow
                  key={member.id}
                  role={member.role || 'Team'}
                  name={member.name}
                  href={member.dancerId ? `/dancers/${member.dancerId}` : undefined}
                />
              ))}
            </div>
          </>
        )}

        {/* Based on a true story (bio) */}
        {entity.bio && (
          <>
            <SectionHeader>Based on a true story</SectionHeader>
            <div className="px-6 pb-3 text-center">
              <p
                className="italic text-[13px] leading-relaxed text-neutral-100 max-w-[300px] mx-auto whitespace-pre-wrap"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', letterSpacing: '0.01em' }}
              >
                {entity.bio}
              </p>
            </div>
          </>
        )}

        {/* Coming soon (upcoming trading cards) */}
        {upcomingEvents.length > 0 && (
          <>
            <SectionHeader>Coming soon</SectionHeader>
            <div className="px-4 pb-4">
              <div className="grid grid-cols-4 gap-2">
                {upcomingEvents.slice(0, 8).map((event, i) => {
                  const grad = TRADING_GRADIENTS[i % TRADING_GRADIENTS.length];
                  const abbrev = makeAbbrev(event.name);
                  const dateLabel = formatTradingDate(event.start_time ?? event.date);
                  const venue = venueShort(event);
                  return (
                    <Link
                      key={event.id}
                      to={`/event/${event.id}`}
                      className={cn(
                        'relative overflow-hidden rounded-md p-1.5 flex flex-col justify-between text-center text-white transition-transform hover:-translate-y-0.5',
                        grad,
                      )}
                      style={{ aspectRatio: '0.7' }}
                      aria-label={event.name}
                    >
                      <span className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/[0.18] to-transparent pointer-events-none" />
                      <span className="relative font-light text-[15px] tracking-[0.1em] text-white leading-none">
                        {abbrev}
                      </span>
                      <span className="relative font-normal text-[8.5px] leading-tight">
                        <span className="block font-semibold tracking-[0.12em]">{dateLabel}</span>
                        {venue}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {upcomingEvents.length > 8 && (
                <p className="text-center font-light text-[10px] tracking-[0.32em] text-neutral-400 uppercase mt-3.5">
                  + {upcomingEvents.length - 8} more &mdash;
                </p>
              )}
            </div>
          </>
        )}

        {/* For enquiries (connect) */}
        {connectItems.length > 0 && (
          <>
            <SectionHeader>For enquiries</SectionHeader>
            <div className="px-4 pb-3">
              {connectItems.map((item) => (
                <CreditRow
                  key={item.key}
                  role={item.role}
                  name={item.name}
                  href={item.href}
                  external={item.external}
                />
              ))}
            </div>
          </>
        )}

        {/* Previously (past events) */}
        {pastEvents.length > 0 && (
          <>
            <SectionHeader>Previously</SectionHeader>
            <div className="px-4 pb-2">
              {pastEvents.slice(0, 12).map((event) => {
                const dt = formatCreditDate(event.start_time ?? event.date);
                const venue = event.location?.trim() || event.city?.trim() || '';
                return (
                  <Link
                    key={event.id}
                    to={`/event/${event.id}`}
                    className="grid grid-cols-[60px_1fr] gap-3 items-baseline py-1.5 border-b border-dashed border-white/[0.08] font-light text-[11.5px] text-left hover:bg-orange-500/[0.04] transition-colors"
                  >
                    <div className="font-normal text-[9px] tracking-[0.18em] text-neutral-400 uppercase text-right">
                      {dt}
                    </div>
                    <div className="text-white tracking-[0.02em] truncate">
                      {event.name}
                      {venue && (
                        <span className="block text-neutral-400 text-[9px] tracking-[0.22em] uppercase mt-0.5 font-normal truncate">
                          {venue}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {pastEvents.length > 12 && (
                <p className="text-center font-light text-[10px] tracking-[0.32em] text-neutral-400 uppercase pt-3.5 pb-1.5">
                  + {pastEvents.length - 12} more in the archive &mdash;
                </p>
              )}
            </div>
          </>
        )}

        {/* Stills (gallery filmstrip) */}
        {galleryUrls.length > 0 && (
          <>
            <SectionHeader>Stills</SectionHeader>
            <div className="relative border-y border-white/[0.08] bg-black py-3.5">
              <span
                className="absolute top-0 left-0 right-0 h-2 opacity-[0.15] pointer-events-none"
                style={{ background: strip }}
              />
              <div
                className="flex gap-1.5 px-3.5 overflow-x-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {galleryUrls.slice(0, 12).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 transition-[filter] duration-200 hover:[filter:none]"
                    style={{ width: 84, height: 60, filter: 'grayscale(0.85) contrast(1.05)' }}
                  >
                    <img
                      src={url}
                      alt={`${entity.name} still ${i + 1}`}
                      className="w-full h-full object-cover rounded-sm"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
              <span
                className="absolute bottom-0 left-0 right-0 h-2 opacity-[0.15] pointer-events-none"
                style={{ background: strip }}
              />
            </div>
          </>
        )}

        {/* Empty state (no events at all) */}
        {upcomingEvents.length === 0 && pastEvents.length === 0 && (
          <>
            <SectionHeader>Coming soon</SectionHeader>
            <div className="px-6 pb-2 text-center">
              <p
                className="italic text-[12.5px] text-neutral-400 leading-relaxed max-w-[280px] mx-auto"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Awaiting first production. Check back &mdash; or follow for the announcement.
              </p>
            </div>
          </>
        )}

        {/* Fin / sign-off */}
        <div className="px-4 pt-6 pb-4 text-center">
          <div className="font-extralight text-[13px] tracking-[0.6em] text-white uppercase flex items-center justify-center">
            <span className="inline-block w-5 h-px bg-neutral-700 mx-3" />
            Fin
            <span className="inline-block w-5 h-px bg-neutral-700 mx-3" />
          </div>
          <div className="font-light text-[9.5px] tracking-[0.32em] text-neutral-400 uppercase mt-3.5">
            a <em className="not-italic text-orange-400">{entity.name}</em> production
          </div>
          <div className="font-extralight text-[14px] tracking-[0.4em] text-neutral-700 mt-2">
            {currentYearRoman}
          </div>
        </div>

      </article>

      {/* Edit dialog (unchanged from previous impl) */}
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
