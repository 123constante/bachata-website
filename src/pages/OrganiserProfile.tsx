import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, Instagram, Globe, Pencil, Loader2, Mail, Phone, Facebook,
  Users, Crown, Clock, MapPin, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ScrollReveal } from '@/components/ScrollReveal';
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

const POSTER_GRADIENTS = [
  'bg-gradient-to-br from-orange-500 to-rose-700',
  'bg-gradient-to-br from-purple-600 to-blue-700',
  'bg-gradient-to-br from-emerald-600 to-cyan-600',
  'bg-gradient-to-br from-pink-600 to-amber-500',
  'bg-gradient-to-br from-blue-700 to-red-600',
  'bg-gradient-to-br from-indigo-600 to-orange-500',
];

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const formatDatePill = (raw: string | null): string => {
  if (!raw) return 'TBA';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
};

const formatPastDate = (raw: string | null): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTimeShort = (raw: string | null): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? 'am' : 'pm';
  const hr12 = h % 12 || 12;
  if (m === 0) return `${hr12}${suffix}`;
  return `${hr12}:${String(m).padStart(2, '0')}${suffix}`;
};

// ── Connect-tile handle extraction ────────────────────────────────────────
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
        .from('entities')
        .select(`
          *,
          cities:cities!entities_city_id_fkey ( name, slug )
        `)
        .eq('id', id)
        .eq('type', 'organiser')
        .maybeSingle();
      if (error) throw new Error(error.message ?? JSON.stringify(error));
      if (!data) return null;
      return data;
    },
    enabled: !!id,
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
        .eq('organiser_entity_id', id)
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

  const totalEventsCount = allEvents.length;
  const showSinceYear = sinceYear !== null && sinceYear < new Date().getFullYear();

  // ── Claim ──
  const handleClaim = async () => {
    if (!id || !user?.id) return;
    try {
      const { error } = await supabase
        .from('entities')
        .update({ claimed_by: user.id })
        .eq('id', id)
        .eq('type', 'organiser')
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

  // ── Edit ──
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
        .from('entities')
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

  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={organiserBreadcrumbs}
        backHref="/organisers"
        hero={{
          emoji: '🎪',
          titleWhite: '',
          titleOrange: 'Organiser',
          largeTitle: true,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pb-24 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </GlobalLayout>
    );
  }

  if (error || !entity) {
    return (
      <GlobalLayout
        breadcrumbs={organiserBreadcrumbs}
        backHref="/organisers"
        hero={{
          emoji: '🎪',
          titleWhite: 'Organiser',
          titleOrange: 'not found',
          largeTitle: true,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 pb-24 text-center">
          <p className="text-muted-foreground mb-6">The organiser profile you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/organisers')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Organisers
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  // Parse socials — direct entity columns first, then JSON fallback
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

  type ConnectItem = { key: string; href: string; icon: typeof Instagram; label: string; ariaLabel: string };
  const connectItems: ConnectItem[] = [];
  if (instagramUrl) connectItems.push({ key: 'ig', href: instagramUrl, icon: Instagram, label: igLabel, ariaLabel: `Instagram ${igLabel}` });
  if (facebookUrl) connectItems.push({ key: 'fb', href: facebookUrl, icon: Facebook, label: fbLabel, ariaLabel: `Facebook ${fbLabel}` });
  if (websiteUrl) connectItems.push({ key: 'web', href: websiteUrl, icon: Globe, label: webLabel, ariaLabel: `Website ${webLabel}` });
  if (emailHref) connectItems.push({ key: 'mail', href: emailHref, icon: Mail, label: emailLabel, ariaLabel: `Email ${emailLabel}` });
  if (phoneHref) connectItems.push({ key: 'phone', href: phoneHref, icon: Phone, label: phoneLabel, ariaLabel: `Call ${phoneLabel}` });

  const isUnclaimed = !entity.claimed_by;
  const isClaimedByUser = entity.claimed_by === user?.id;
  const canClaim = user && isUnclaimed;

  const cityName = entity.cities?.name ?? (entity as any).city ?? null;
  const cityHref = cityName ? '/cities' : null;

  const initials = (entity.name?.trim().charAt(0) || '?').toUpperCase();
  const heroAvatar = (
    <div className="relative inline-flex items-center justify-center">
      {entity.avatar_url ? (
        <img
          src={entity.avatar_url}
          alt={entity.name ?? 'Organiser logo'}
          loading="eager"
          className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl object-cover border-2 border-primary shadow-[0_8px_32px_rgba(249,115,22,0.25)] bg-slate-900"
        />
      ) : (
        <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl bg-slate-900 border-2 border-primary flex items-center justify-center text-5xl sm:text-6xl md:text-7xl font-black text-primary shadow-[0_8px_32px_rgba(249,115,22,0.25)]">
          {initials}
        </div>
      )}
    </div>
  );

  // Hero subtitle is now empty by design — the city has moved into the
  // identity tile so the page-level "Location" signal lives in one
  // canonical place. Passing '' keeps the spacing slot collapsed in
  // PageHero.
  const heroSubtitle = '';

  // Tile shells share structure (border, padding, flex, animation) but each
  // gets a different orange-palette gradient over the slate-900 base so the
  // bento reads as varied / dynamic rather than a uniform grid. Inner
  // sub-cells keep bg-slate-900 so they remain readable nested cards inside
  // the tinted tile. Page gradient is still blocked by the bento wrapper.
  const TILE_SHADES = {
    identity: 'bg-gradient-to-br from-primary/40 via-primary/20 to-slate-900',
    connect: 'bg-gradient-to-br from-orange-600/30 via-amber-800/15 to-slate-900',
    upcoming: 'bg-gradient-to-tl from-amber-500/30 via-primary/15 to-slate-900',
    about: 'bg-gradient-to-tr from-primary/25 via-festival-pink/15 to-slate-900',
    team: 'bg-gradient-to-bl from-orange-400/30 via-primary/20 to-slate-900',
    past: 'bg-gradient-to-br from-primary/20 via-orange-900/15 to-slate-900',
    plain: 'bg-slate-900',
  } as const;
  const tileShell = (variant: keyof typeof TILE_SHADES) =>
    cn(
      'rounded-xl border border-border p-3 sm:p-4 flex flex-col gap-2',
      'animate-in fade-in slide-in-from-bottom-1 duration-300',
      TILE_SHADES[variant],
    );

  // Anchor the "Events run" cell to the events tile via in-page scroll.
  // The id is attached to whichever event tile is the first to render
  // (Upcoming when present, otherwise Past), so the click is always
  // meaningful when there's at least one event.
  const eventsAnchorId = 'organiser-events';
  const handleEventsCount = (e: React.MouseEvent) => {
    if (totalEventsCount === 0) return;
    const target = document.getElementById(eventsAnchorId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <GlobalLayout
      breadcrumbs={organiserBreadcrumbs}
      backHref="/organisers"
      hero={{
        emoji: heroAvatar,
        titleWhite: entity.name ?? '',
        titleOrange: 'Organiser',
        subtitle: heroSubtitle,
        largeTitle: true,
      }}
    >
      {/* Type pill — sits between hero and bento, links to a filtered
          /organisers list. Hidden when no organisation_category is set. */}
      {organisationCategory && (
        <div className="max-w-5xl mx-auto px-4 -mt-2 sm:-mt-4 mb-4 sm:mb-6 flex justify-center">
          <Link
            to={`/organisers?category=${encodeURIComponent(organisationCategory)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-primary px-3 py-1.5 text-[11px] sm:text-xs font-bold text-primary uppercase tracking-[0.14em] hover:bg-primary hover:text-black transition-colors"
            aria-label={`See all ${organisationCategory} organisers`}
          >
            {organisationCategory}
          </Link>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pb-24">

        {/* ── BENTO ── 2-col mobile · 4-col desktop ──
            Wrapped in an opaque bg-slate-900 container so the gaps between
            tiles (gap-2) and the inner padding never expose the page-level
            gradient + floating decorations. Adjacent tiles still read as
            distinct cards via their existing border-border hairlines. */}
        <ScrollReveal animation="fadeUp">
          <div className="bg-slate-900 rounded-2xl border border-border p-2 sm:p-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">

            {/* ── Identity tile ──
                Headline metrics first (Events / Team), then the city pill,
                then the team leader, then the "since" line. The organiser
                type lives BELOW the hero now (not in this tile). The
                organiser name is in the hero, not here. */}
            <section className={cn(tileShell('identity'), 'col-span-1 lg:col-span-2 relative')}>
              {isClaimedByUser && (
                <button
                  type="button"
                  onClick={openEditModal}
                  aria-label="Edit profile"
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-slate-900 hover:bg-primary border border-border hover:border-primary text-muted-foreground hover:text-black flex items-center justify-center transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Primary metrics — Events / Team. The Events cell is a
                  link that scrolls to the on-page events tile. */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <a
                  href={`#${eventsAnchorId}`}
                  onClick={handleEventsCount}
                  className={cn(
                    'rounded-lg bg-slate-900 border border-border px-2 py-2 sm:py-3 flex flex-col items-start justify-center min-h-[64px] sm:min-h-[80px] transition-colors',
                    totalEventsCount > 0 && 'hover:border-primary cursor-pointer',
                    totalEventsCount === 0 && 'cursor-default',
                  )}
                  aria-label={`Events run: ${totalEventsCount}`}
                >
                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground leading-none">
                    Events run
                  </p>
                  <p className={cn(
                    'text-2xl sm:text-3xl font-black leading-none mt-1.5',
                    totalEventsCount > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {totalEventsCount}
                  </p>
                </a>
                <div className="rounded-lg bg-slate-900 border border-border px-2 py-2 sm:py-3 flex flex-col items-start justify-center min-h-[64px] sm:min-h-[80px]">
                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground leading-none">
                    Team
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground leading-none mt-1.5">
                    {teamMembers.length}
                  </p>
                </div>
              </div>

              {/* City + Since-year paired row — both children are styled
                  identically and stretch to fill their grid cell so the
                  identity tile has a consistent vertical rhythm. When only
                  one of the two exists, it falls back to a single full-
                  width row. */}
              {(cityName || showSinceYear) && (
                <div className={cn(
                  'grid gap-1.5 sm:gap-2',
                  cityName && showSinceYear ? 'grid-cols-2' : 'grid-cols-1',
                )}>
                  {cityName && (
                    cityHref ? (
                      <Link
                        to={cityHref}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-border hover:border-primary hover:text-primary text-foreground px-2 min-h-[36px] text-[11px] sm:text-xs font-semibold transition-colors"
                        aria-label={`See ${cityName}`}
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate min-w-0">{cityName}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-border text-foreground px-2 min-h-[36px] text-[11px] sm:text-xs font-semibold">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate min-w-0">{cityName}</span>
                      </div>
                    )
                  )}
                  {showSinceYear && (
                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-border text-foreground px-2 min-h-[36px] text-[11px] sm:text-xs font-semibold">
                      <span className="text-muted-foreground font-medium">Since</span>
                      <span className="text-primary font-bold">{sinceYear}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Team leader row — sits in the identity tile so the
                  organisation has a face. Hidden if no leader is
                  resolvable. */}
              {leader && (
                (() => {
                  const inner = (
                    <>
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border border-primary shrink-0">
                        <AvatarImage src={leader.avatarUrl || undefined} alt={leader.name} />
                        <AvatarFallback className="text-[10px] sm:text-xs bg-slate-900 text-primary font-bold border border-primary">
                          {leader.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground leading-none">
                          {leader.isHead ? 'Head organiser' : 'Led by'}
                        </p>
                        <p className="text-[12px] sm:text-sm font-semibold text-foreground truncate leading-tight mt-1">
                          {leader.name}
                        </p>
                        {leader.role && (
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">
                            {leader.role}
                          </p>
                        )}
                      </div>
                      {leader.isHead && (
                        <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </>
                  );
                  const cls = cn(
                    'flex items-center gap-2.5 rounded-lg bg-slate-900 border border-border px-2.5 py-2 transition-colors',
                    leader.dancerId && 'hover:border-primary cursor-pointer',
                  );
                  return leader.dancerId ? (
                    <Link to={`/dancers/${leader.dancerId}`} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  );
                })()
              )}

              {canClaim && (
                <Button variant="outline" size="sm" onClick={handleClaim} className="text-[11px] sm:text-xs mt-1">
                  Claim this organiser profile
                </Button>
              )}
            </section>

            {/* ── Connect tile ── 2-col grid of inline rows (icon + handle
                horizontal). The inline layout maximises text width vs the
                old vertical stack; min-w-0 on the span is what lets
                truncate work inside flex. The title attribute on the <a>
                shows the full handle on hover for any that still ellipse. */}
            {connectItems.length > 0 ? (
              <section className={cn(tileShell('connect'), 'col-span-1 lg:col-span-2')}>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Connect
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 mt-0.5">
                  {connectItems.map((item) => {
                    const Icon = item.icon;
                    const isExternal = item.href.startsWith('http');
                    return (
                      <a
                        key={item.key}
                        href={item.href}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        className="group flex flex-row items-center gap-2 rounded-lg bg-slate-900 border border-border hover:border-primary px-2.5 min-h-[36px] min-w-0 transition-colors"
                        aria-label={item.ariaLabel}
                        title={item.label}
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <span className="text-[11px] sm:text-[11px] font-medium text-foreground group-hover:text-primary truncate min-w-0">
                          {item.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className={cn(tileShell('connect'), 'col-span-1 lg:col-span-2')}>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Connect
                </p>
                <p className="text-[10px] text-muted-foreground text-center py-3">
                  No links yet
                </p>
              </section>
            )}

            {/* ── Upcoming events tile ── full-width, 2/3/4 col grid ── */}
            {upcomingEvents.length > 0 && (
              <section
                id={eventsAnchorId}
                className={cn(tileShell('upcoming'), 'col-span-2 lg:col-span-4 scroll-mt-24')}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-foreground">
                    Upcoming
                  </h2>
                  <span className="bg-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {upcomingEvents.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mt-1">
                  {upcomingEvents.slice(0, 8).map((event) => {
                    const rawDate = event.start_time ?? event.date;
                    const dateLabel = formatDatePill(rawDate);
                    const timeLabel = formatTimeShort(event.start_time);
                    const locationLabel = event.location?.trim() || event.city?.trim() || null;
                    const metaParts = [timeLabel, locationLabel].filter(Boolean) as string[];
                    const gradient = POSTER_GRADIENTS[hashStr(event.id) % POSTER_GRADIENTS.length];
                    return (
                      <Link
                        key={event.id}
                        to={`/event/${event.id}`}
                        className="group flex flex-col rounded-lg overflow-hidden bg-slate-900 border border-border hover:border-primary hover:-translate-y-0.5 transition-all"
                      >
                        <div className={cn('relative aspect-[16/10] overflow-hidden', gradient)}>
                          {event.poster_url && (
                            <img
                              src={event.poster_url}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <span className="absolute top-1.5 left-1.5 z-10 bg-slate-900 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-border">
                            {dateLabel}
                          </span>
                        </div>
                        <div className="p-2 sm:p-3 flex flex-col gap-1 bg-slate-900">
                          <p className="text-[11px] sm:text-sm font-semibold text-foreground leading-tight line-clamp-2 min-h-[2.5em] sm:min-h-[3em] group-hover:text-primary transition-colors">
                            {event.name}
                          </p>
                          {metaParts.length > 0 && (
                            <p className="flex items-center gap-1 text-[9.5px] sm:text-[11px] text-muted-foreground truncate">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                              <span className="truncate">{metaParts.join(' · ')}</span>
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {upcomingEvents.length > 8 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    +{upcomingEvents.length - 8} more upcoming
                  </p>
                )}
              </section>
            )}

            {/* ── About tile ── */}
            {entity.bio && (
              <section className={cn(tileShell('about'), 'col-span-2 lg:col-span-2')}>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  About
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {entity.bio}
                </p>
              </section>
            )}

            {/* ── Team tile ── shows everyone EXCEPT the leader. */}
            {teamWithoutLeader.length > 0 && (
              <section className={cn(tileShell('team'), 'col-span-2 lg:col-span-4')}>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-foreground">
                    Team
                  </h2>
                  <span className="bg-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {teamWithoutLeader.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mt-1">
                  {teamWithoutLeader.map((member) => {
                    const tileClass = cn(
                      'flex flex-col items-center text-center gap-1 p-2 sm:p-3 rounded-lg border bg-slate-900 transition-all',
                      member.isHead ? 'border-primary' : 'border-border',
                      member.dancerId && 'hover:border-primary hover:-translate-y-0.5 cursor-pointer',
                    );
                    const inner = (
                      <>
                        <Avatar className={cn(
                          'w-9 h-9 sm:w-12 sm:h-12 border',
                          member.isHead ? 'border-primary' : 'border-border',
                        )}>
                          <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                          <AvatarFallback className={cn(
                            'text-[10px] sm:text-sm font-bold bg-slate-900',
                            member.isHead ? 'text-primary border border-primary' : 'text-foreground border border-border',
                          )}>
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1 min-w-0 w-full justify-center">
                          <p className="text-[10px] sm:text-xs font-semibold text-foreground truncate">
                            {member.name}
                          </p>
                          {member.isHead && (
                            <Crown className="w-3 h-3 text-primary shrink-0" />
                          )}
                        </div>
                        {member.role && (
                          <p className={cn(
                            'text-[9px] sm:text-[10px] truncate w-full',
                            member.isHead ? 'text-primary font-medium' : 'text-muted-foreground',
                          )}>
                            {member.role}
                          </p>
                        )}
                      </>
                    );
                    if (member.dancerId) {
                      return (
                        <Link key={member.id} to={`/dancers/${member.dancerId}`} className={tileClass}>
                          {inner}
                        </Link>
                      );
                    }
                    return (
                      <div key={member.id} className={tileClass}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Gallery tile ── */}
            {galleryUrls.length > 0 && (
              <section className={cn(tileShell('plain'), 'col-span-2 lg:col-span-4')}>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Gallery
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 mt-1">
                  {galleryUrls.slice(0, 12).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={url}
                        alt={`${entity.name} photo ${i + 1}`}
                        className="w-full aspect-[4/3] object-cover rounded-md hover:scale-[1.02] transition-transform bg-slate-900 border border-border"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── Past events tile (history) ── */}
            {pastEvents.length > 0 && (
              <section
                id={upcomingEvents.length === 0 ? eventsAnchorId : undefined}
                className={cn(tileShell('past'), 'col-span-2 lg:col-span-4 scroll-mt-24')}
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-foreground">
                    Past events
                  </h2>
                  <span className="bg-slate-900 border border-border text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pastEvents.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {pastEvents.slice(0, 12).map((event) => {
                    const rawDate = event.start_time ?? event.date;
                    const dateText = formatPastDate(rawDate);
                    const locationLabel = event.location?.trim() || event.city?.trim() || null;
                    const metaParts = [dateText, locationLabel].filter(Boolean) as string[];
                    return (
                      <Link
                        key={event.id}
                        to={`/event/${event.id}`}
                        className="group flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-slate-900 hover:border-primary transition-colors px-2.5 sm:px-3 py-2"
                      >
                        {event.poster_url ? (
                          <img
                            src={event.poster_url}
                            alt=""
                            loading="lazy"
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover shrink-0 bg-slate-900"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-md shrink-0', POSTER_GRADIENTS[hashStr(event.id) % POSTER_GRADIENTS.length])} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] sm:text-sm font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                            {event.name}
                          </p>
                          {metaParts.length > 0 && (
                            <p className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">
                              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                              <span className="truncate">{metaParts.join(' · ')}</span>
                            </p>
                          )}
                        </div>
                        <span className="bg-slate-900 border border-border text-muted-foreground text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0">
                          Past
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {pastEvents.length > 12 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    +{pastEvents.length - 12} more past events
                  </p>
                )}
              </section>
            )}

            {/* ── Empty state when an organiser has zero events at all ── */}
            {upcomingEvents.length === 0 && pastEvents.length === 0 && (
              <section className={cn(tileShell('plain'), 'col-span-2 lg:col-span-4 items-center text-center py-6 sm:py-8')}>
                <Clock className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No events listed yet</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground max-w-sm">
                  When {entity.name} adds events to the calendar they'll appear here.
                </p>
              </section>
            )}

          </div>
          </div>
        </ScrollReveal>
      </div>

      {/* ── Edit dialog ── */}
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
