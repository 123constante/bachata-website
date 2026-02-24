import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { resolveEventImage } from '@/lib/utils';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  AlertTriangle,
  Globe,
  Loader2,
  Edit,
  Ticket,
  Share2,
  Users,
  Heart,
  Instagram,
  Facebook,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ScrollReveal } from '@/components/ScrollReveal';
import { EventAttendanceButtons } from '@/components/EventAttendanceButtons';
import { EventCoordinationSection } from '@/components/EventCoordinationSection';
import PageBreadcrumb from '@/components/PageBreadcrumb';

// Default fallback image for events without a cover
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1200&h=600&fit=crop';

/** Shape of the event object returned inside get_event_detail RPC */
interface RpcEvent {
  id: string;
  name: string;
  description: string | null;
  date: string;
  photo_url: string[] | null;
  cover_image_url: string | null;
  created_by: string | null;
  is_published: boolean | null;
  key_times: string | null;
  meta_data: Record<string, unknown> | null;
  venue_id: string | null;
  class_start?: string | null;
  class_end?: string | null;
  party_start?: string | null;
  party_end?: string | null;
}

interface RpcVenue {
  name: string;
  address: string | null;
  transport: string | null;
  parking: string | null;
}

interface RpcVenueEntity {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
}

interface RpcProfileStub {
  id: string;
  name: string | null;
  photo_url: string[] | null;
  avatar_url: string | null;
}

interface EventDetailPayload {
  event: RpcEvent;
  venue: RpcVenue | null;
  organisers: RpcProfileStub[];
  teachers: RpcProfileStub[];
  djs: RpcProfileStub[];
  venue_entity: RpcVenueEntity | null;
}

type EventRow = Database['public']['Tables']['events']['Row'];

type AttendanceRow = {
  user_id: string;
  status: 'going' | 'interested';
  updated_at: string | null;
};

// Format time from HH:MM:SS to readable format
const formatTime = (time: string | null) => {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const toConnectionBadge = (value: string | null | undefined) => {
  if (!value) return 'Connected';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const safeJson = <T,>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return fallback;
  }
};

const formatProgramTime = (value: string | null | undefined) => {
  if (!value) return null;
  if (/^\d{2}:\d{2}/.test(value)) {
    return formatTime(value);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'h:mm a');
};

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);

  const { data: detailPayload, isLoading, error } = useQuery({
    queryKey: ['event-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Event ID is required');

      const { data, error } = await supabase.rpc('get_event_detail', {
        p_event_id: id,
      });

      if (error) throw error;
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw?.event) throw new Error('Event not found');

      return raw as unknown as EventDetailPayload;
    },
    enabled: !!id,
  });

  const { data: eventRecord } = useQuery<EventRow | null>({
    queryKey: ['event-full', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('events')
        .select(
          'id,name,date,description,location,city,country,cover_image_url,photo_url,gallery_urls,website,instagram_url,facebook_url,ticket_url,pricing,payment_methods,promo_codes,faq,type,timezone,start_time,end_time,venue_id,key_times,meta_data,organiser_id,organiser_ids,teacher_ids,dj_ids'
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const event: RpcEvent | null = detailPayload?.event ?? null;
  const venue: RpcVenue | null = detailPayload?.venue ?? null;
  const organisers: RpcProfileStub[] = Array.isArray(detailPayload?.organisers) ? detailPayload.organisers : [];
  const teachers: RpcProfileStub[] = Array.isArray(detailPayload?.teachers) ? detailPayload.teachers : [];
  const djs: RpcProfileStub[] = Array.isArray(detailPayload?.djs) ? detailPayload.djs : [];
  const venueEntity: RpcVenueEntity | null = detailPayload?.venue_entity ?? null;

  const eventCore = (eventRecord ?? (event as unknown as EventRow | null)) ?? null;

  const { data: attendanceRows = [] } = useQuery<AttendanceRow[]>({
    queryKey: ['event-attendance-rows', event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      const { data, error } = await supabase
        .from('event_participants')
        .select('user_id,status,updated_at')
        .eq('event_id', event.id)
        .in('status', ['going', 'interested'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AttendanceRow[];
    },
    enabled: !!event?.id,
    staleTime: 1000 * 30,
  });

  const attendeeUserIds = useMemo(
    () => Array.from(new Set(attendanceRows.map((row) => row.user_id).filter(Boolean))),
    [attendanceRows]
  );

  const { data: attendeeProfiles = [] } = useQuery({
    queryKey: ['event-attendance-profiles', attendeeUserIds.join('|')],
    queryFn: async () => {
      if (!attendeeUserIds.length) return [];
      const { data, error } = await supabase
        .from('dancers')
        .select('id,user_id,first_name,surname,hide_surname,photo_url')
        .in('user_id', attendeeUserIds);

      if (error) throw error;
      return data || [];
    },
    enabled: attendeeUserIds.length > 0,
    staleTime: 1000 * 60,
  });

  const attendees = useMemo(() => {
    if (!attendanceRows.length) return [] as Array<{ id: string; name: string; status: 'going' | 'interested'; avatarUrl: string | null }>;
    const profileMap = new Map(
      (attendeeProfiles || []).map((profile: any) => [
        profile.user_id as string,
        {
          id: profile.id as string,
          name: profile.hide_surname
            ? (profile.first_name as string)
            : [profile.first_name, profile.surname].filter(Boolean).join(' ') || 'Dancer',
          avatar: resolveEventImage(profile.photo_url as string[] | null, null),
        },
      ])
    );

    return attendanceRows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.user_id,
        name: profile?.name || 'Dancer',
        status: row.status,
        avatarUrl: profile?.avatar ?? null,
      };
    });
  }, [attendanceRows, attendeeProfiles]);

  type ConnectionRow = Database['public']['Functions']['get_event_profile_connections']['Returns'][number];

  const { data: connectedPeople = [] } = useQuery<ConnectionRow[]>({
    queryKey: ['event-profile-connections', event?.id],
    queryFn: async () => {
      if (!event?.id) return [];

      const { data, error } = await supabase.rpc('get_event_profile_connections', {
        p_event_id: event.id,
      });

      if (error) {
        console.warn('get_event_profile_connections unavailable or failed', error.message);
        return [];
      }

      return (data || []);
    },
    enabled: !!event?.id,
  });

  const connectionSignature = useMemo(
    () => connectedPeople.map((row) => `${row.person_type}:${row.person_id}:${row.connection_label}`).join('|'),
    [connectedPeople]
  );

  const { data: connectedPeopleEnriched = [] } = useQuery({
    queryKey: ['event-profile-connections-enriched', event?.id, connectionSignature],
    enabled: !!event?.id && connectedPeople.length > 0,
    queryFn: async () => {
      const byType = {
        dancer: [] as string[],
        organiser: [] as string[],
        teacher: [] as string[],
        dj: [] as string[],
        vendor: [] as string[],
        videographer: [] as string[],
      };

      for (const row of connectedPeople) {
        if (row.person_type && row.person_id && row.person_type in byType) {
          byType[row.person_type as keyof typeof byType].push(row.person_id);
        }
      }

      const unique = (values: string[]) => Array.from(new Set(values));

      const emptyResult = { data: [] as Record<string, unknown>[], error: null };
      const [dancersRes, organisersRes, teachersRes, djsRes, vendorsRes, videographersRes] = await Promise.all([
        unique(byType.dancer).length
          ? supabase.from('dancers').select('id,first_name,surname,photo_url').in('id', unique(byType.dancer))
          : Promise.resolve(emptyResult),
        unique(byType.organiser).length
          ? supabase
            .from('entities')
            .select('id,name,avatar_url,city_id,cities(name)')
            .eq('type', 'organiser')
            .in('id', unique(byType.organiser))
          : Promise.resolve(emptyResult),
        unique(byType.teacher).length
          ? supabase.from('teacher_profiles').select('id,first_name,surname,photo_url').in('id', unique(byType.teacher))
          : Promise.resolve(emptyResult),
        unique(byType.dj).length
          ? supabase.from('dj_profiles').select('id,name,photo_url').in('id', unique(byType.dj))
          : Promise.resolve(emptyResult),
        unique(byType.vendor).length
          ? supabase.from('vendors').select('id,business_name,photo_url,city_id,cities(name)').in('id', unique(byType.vendor))
          : Promise.resolve(emptyResult),
        unique(byType.videographer).length
          ? supabase.from('videographers').select('id,business_name,photo_url').in('id', unique(byType.videographer))
          : Promise.resolve(emptyResult),
      ]);

      type ProfileEntry = { name: string; avatar: string | null };
      const toMap = (
        rows: Record<string, unknown>[],
        nameExtractor: (r: Record<string, unknown>) => string,
        avatarExtractor?: (r: Record<string, unknown>) => string | null,
      ): Map<string, ProfileEntry> =>
        new Map(
          rows.map((r) => [
            r.id as string,
            {
              name: nameExtractor(r),
              avatar: avatarExtractor ? avatarExtractor(r) : resolveEventImage(r.photo_url as string[] | null, null),
            },
          ])
        );

      const dancerMap = toMap(dancersRes.data || [], (r) => [r.first_name, r.surname].filter(Boolean).join(' ') || 'Dancer');
      const organiserMap = toMap(
        organisersRes.data || [],
        (r) => (r.name as string) || 'Organiser',
        (r) => (r.avatar_url as string | null) ?? null,
      );
      const teacherMap = toMap(teachersRes.data || [], (r) => [r.first_name, r.surname].filter(Boolean).join(' ') || 'Teacher');
      const djMap = toMap(djsRes.data || [], (r) => (r.name as string) || 'DJ');
      const vendorMap = toMap(vendorsRes.data || [], (r) => (r.business_name as string) || 'Vendor');
      const videographerMap = toMap(videographersRes.data || [], (r) => (r.business_name as string) || 'Videographer');

      const lookupMaps: Record<string, Map<string, ProfileEntry>> = {
        dancer: dancerMap,
        organiser: organiserMap,
        teacher: teacherMap,
        dj: djMap,
        vendor: vendorMap,
        videographer: videographerMap,
      };

      return (connectedPeople as { person_type: string; person_id: string }[]).map((row) => {
        const fallback: ProfileEntry = { name: row.person_type || 'Connected', avatar: null };
        const profile = lookupMaps[row.person_type]?.get(row.person_id) ?? fallback;

        return {
          ...row,
          display_name: profile.name,
          avatar_url: profile.avatar,
        };
      });
    },
  });

  const roleSections = useMemo(
    () => [
      { key: 'organiser', label: 'Organisers' },
      { key: 'teacher', label: 'Teachers' },
      { key: 'dj', label: 'DJs' },
      { key: 'vendor', label: 'Vendors' },
      { key: 'videographer', label: 'Videographers' },
      { key: 'dancer', label: 'Attendees' },
    ],
    []
  );

  const groupedConnections = useMemo(() => {
    const source = connectedPeopleEnriched.length > 0 ? connectedPeopleEnriched : connectedPeople;
    const grouped: Record<string, Record<string, unknown>[]> = {
      organiser: [],
      teacher: [],
      dj: [],
      vendor: [],
      videographer: [],
      dancer: [],
    };

    for (const row of source) {
      const pt = (row as Record<string, unknown>).person_type as string;
      if (grouped[pt]) {
        grouped[pt].push(row as Record<string, unknown>);
      }
    }

    return grouped;
  }, [connectedPeople, connectedPeopleEnriched]);

  const getConnectionProfilePath = (personType: string, personId: string) => {
    if (personType === 'dancer') return `/dancers/${personId}`;
    if (personType === 'teacher') return `/teachers/${personId}`;
    if (personType === 'dj') return `/djs/${personId}`;
    if (personType === 'organiser') return `/organisers/${personId}`;
    if (personType === 'vendor') return `/vendors/${personId}`;
    if (personType === 'videographer') return '/videographers';
    return '/profile';
  };

  const openConnectionProfile = (personType: string, personId: string) => {
    const profilePath = getConnectionProfilePath(personType, personId);

    if (personType === 'dancer' && !user) {
      navigate(`/auth?mode=signin&returnTo=${encodeURIComponent(profilePath)}`);
      return;
    }

    navigate(profilePath);
  };

  // Use centralized permission hook - reflects Supabase rules
  const { canEdit, canPublish } = useEventPermissions(id, event?.created_by);

  // Fetch engagement counts for coordination unlock
  const { data: engagement } = useQuery({
    queryKey: ['event-engagement', id],
    queryFn: async () => {
      if (!id) return { interested_count: 0, going_count: 0 };
      const { data: engData, error } = await supabase
        .rpc('get_event_engagement', { p_event_id: id });
      if (error) throw error;
      const rows = engData as { going_count: number; interested_count: number }[] | null;
      return rows?.[0] ?? { interested_count: 0, going_count: 0 };
    },
    enabled: !!id,
  });

  // Fetch venue entity city name to avoid using text column from RPC
  const { data: venueEntityCityName } = useQuery({
    queryKey: ['venue-entity-city', venueEntity?.id],
    queryFn: async () => {
      if (!venueEntity?.id) return null;
      const { data } = await supabase
        .from('entities')
        .select(`
          cities (
            name
          )
        `)
        .eq('id', venueEntity.id)
        .maybeSingle();
        
      return data?.cities?.name;
    },
    enabled: !!venueEntity?.id
  });

  // Handle publish
  const handlePublish = async () => {
    if (!event || !canPublish) return;

    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_published: true })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: 'Event published!',
        description: 'Your event is now publicly visible.',
      });

      // Refresh event data
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (error) {
      console.error('Publish error:', error);
      toast({
        title: 'Failed to publish',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // Determine draft status and access rights using centralized permissions
  const isDraft = event?.is_published === false;
  const canAccessDraft = canEdit;

  const eventMeta = (eventCore?.meta_data ?? event?.meta_data) as Record<string, unknown> | null;
  const keyTimes = safeJson<Record<string, any>>(eventCore?.key_times ?? event?.key_times, {})
    || (eventMeta?.key_times as Record<string, any> | undefined)
    || {};

  const program = Array.isArray(eventMeta?.program) ? (eventMeta?.program as any[]) : [];
  const programItems = program.map((item, index) => {
    const title = item?.title || item?.name || item?.type || `Session ${index + 1}`;
    const tags = Array.isArray(item?.music_styles)
      ? item.music_styles
      : Array.isArray(item?.tags)
      ? item.tags
      : [];

    return {
      id: item?.id ?? `${index}`,
      title,
      type: item?.type || 'session',
      start: item?.start || item?.time || item?.start_time || item?.from || null,
      end: item?.end || item?.end_time || item?.to || null,
      description: item?.description || item?.notes || null,
      tags,
    };
  });

  // Determine times (prioritize key_times, fallback to root columns)
  const classStart = keyTimes?.classes?.start || (event as any)?.class_start || null;
  const classEnd = keyTimes?.classes?.end || (event as any)?.class_end || null;
  const socialStart = keyTimes?.party?.start || (event as any)?.party_start || null;
  const socialEnd = keyTimes?.party?.end || (event as any)?.party_end || null;

  const hasClass = programItems.some((item) => ['class', 'workshop'].includes(item.type)) || !!(classStart && classEnd);
  const hasSocial = programItems.some((item) => item.type === 'party') || !!(socialStart && socialEnd);

  const eventName = eventCore?.name ?? event?.name ?? 'Event';
  const eventDate = eventCore?.date ?? event?.date ?? '';
  const eventDescription = eventCore?.description ?? event?.description ?? '';
  const eventType = eventCore?.type ?? 'standard';
  const eventStartTime = eventCore?.start_time ?? null;
  const eventEndTime = eventCore?.end_time ?? null;
  const eventTimezone = eventCore?.timezone ?? null;
  const coverImage =
    resolveEventImage(eventCore?.photo_url ?? event?.photo_url, eventCore?.cover_image_url ?? event?.cover_image_url) ||
    DEFAULT_COVER;

  const galleryImages = Array.from(
    new Set(
      [
        ...(eventCore?.gallery_urls ?? []),
        ...(eventCore?.photo_url ?? []),
        ...(event?.photo_url ?? []),
      ].filter(Boolean) as string[]
    )
  );

  const socialLinks = [
    eventCore?.website ? { label: 'Website', href: eventCore.website, icon: Globe } : null,
    eventCore?.instagram_url ? { label: 'Instagram', href: eventCore.instagram_url, icon: Instagram } : null,
    eventCore?.facebook_url ? { label: 'Facebook', href: eventCore.facebook_url, icon: Facebook } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Globe }>;

  const attendeePreview = attendees.slice(0, 12);
  const pricingRaw = safeJson<any>(eventCore?.pricing, null);
  const pricingOptions = Array.isArray(pricingRaw)
    ? pricingRaw
    : Array.isArray(pricingRaw?.tiers)
    ? pricingRaw.tiers
    : [];
  const locationLabel = venueEntity?.name || venue?.name || eventCore?.location || 'Venue TBA';
  const locationDetail = venue?.address || eventCore?.location || null;

  const programTimeLabel = [
    hasClass && classStart && classEnd ? `Classes ${formatTime(classStart)} – ${formatTime(classEnd)}` : null,
    hasSocial && socialStart && socialEnd ? `Social ${formatTime(socialStart)} – ${formatTime(socialEnd)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const eventTimeLabel =
    eventStartTime && eventEndTime
      ? `${formatTime(eventStartTime)} – ${formatTime(eventEndTime)}`
      : eventStartTime
      ? formatTime(eventStartTime)
      : programTimeLabel || 'Schedule TBA';
  const formattedDate = eventDate ? format(new Date(eventDate), 'EEEE, MMMM d, yyyy') : 'Date TBA';

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: eventName, url });
        return;
      } catch (error) {
        // Ignore share cancellation
      }
    }

    try {
      await navigator.clipboard?.writeText(url);
      toast({
        title: 'Link copied',
        description: 'Share this event with your friends.',
      });
    } catch (error) {
      toast({
        title: 'Unable to copy link',
        description: 'Please copy the URL manually from the address bar.',
        variant: 'destructive',
      });
    }
  };

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Event Not Found</h1>
          <p className="text-muted-foreground mb-6">The event you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Block access to draft events for non-owners/non-admins
  if (isDraft && !canAccessDraft) {
    return (
      <div className="min-h-screen bg-background pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Event Not Available</h1>
          <p className="text-muted-foreground mb-6">This event is not publicly available yet.</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative overflow-hidden pb-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--festival-pink))_0%,_transparent_42%),radial-gradient(circle_at_bottom,_hsl(var(--festival-teal))_0%,_transparent_40%)] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-background" />
        <div className="absolute -left-10 top-16 h-32 w-32 rounded-full bg-festival-purple/20 blur-3xl" />
        <div className="absolute -right-10 top-40 h-40 w-40 rounded-full bg-festival-blue/20 blur-3xl" />

        <div className="relative pt-[96px]">
          <PageBreadcrumb items={[{ label: 'Events' }, { label: eventName }]} />

          {isDraft && (
            <div className="mx-auto mb-6 w-full max-w-6xl px-4">
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-amber-500/50 bg-amber-500/10 py-3">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">Draft Event</span>
                </div>
                <span className="text-xs text-amber-200/80">Publish to make this event visible to everyone.</span>
              </div>
            </div>
          )}

          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-12 lg:auto-rows-[minmax(140px,_auto)]">
            <div className="lg:col-span-8 lg:row-span-3 space-y-4">
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                <img src={coverImage} alt={eventName} className="h-[360px] w-full object-cover md:h-[460px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <Button
                  onClick={() => navigate(-1)}
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-4 bg-black/40 backdrop-blur hover:bg-black/60"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {isDraft && (
                  <Badge className="absolute right-4 top-4 bg-amber-500 text-amber-950">Draft</Badge>
                )}

                <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-white/40 text-white">
                      {eventType === 'festival' ? 'Festival' : 'Social'}
                    </Badge>
                    <Badge variant="outline" className="border-white/30 text-white/80">
                      {formattedDate}
                    </Badge>
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{eventName}</h1>
                  <p className="mt-2 text-sm text-white/70">{eventTimeLabel}</p>
                </div>
              </div>

              <Card className="border-white/10 bg-black/40">
                <CardContent className="grid gap-4 p-6 text-sm text-white/80 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Address</p>
                      <p className="font-medium text-white">{locationLabel}</p>
                      {locationDetail && <p className="text-white/60">{locationDetail}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Date</p>
                      <p className="font-medium text-white">{formattedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Class Times</p>
                      <p className="font-medium text-white">
                        {classStart && classEnd ? `${formatTime(classStart)} – ${formatTime(classEnd)}` : 'TBA'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Party Times</p>
                      <p className="font-medium text-white">
                        {socialStart && socialEnd ? `${formatTime(socialStart)} – ${formatTime(socialEnd)}` : 'TBA'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ScrollReveal animation="fadeUp" delay={0.05}>
              <Card className="lg:col-span-4 lg:row-span-2 border-white/10 bg-black/40">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Actions</h3>
                    {canEdit && (
                      <Button
                        onClick={() => navigate(`/event/${event.id}/edit`)}
                        size="sm"
                        variant="outline"
                        className="border-white/30 text-white"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3">
                    <Button
                      className="w-full"
                      onClick={() => document.getElementById('attendance')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      RSVP
                    </Button>
                    {eventCore?.ticket_url && (
                      <Button variant="outline" className="w-full border-white/30 text-white" asChild>
                        <a href={eventCore.ticket_url} target="_blank" rel="noreferrer">
                          <Ticket className="mr-2 h-4 w-4" />
                          Buy Tickets
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full text-white/70 hover:text-white">
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </div>
                  {isDraft && canPublish && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" disabled={isPublishing}>
                          {isPublishing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Publishing
                            </>
                          ) : (
                            <>
                              <Globe className="mr-2 h-4 w-4" />
                              Publish Event
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Publish this event?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This makes your event public and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePublish}>Publish Event</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal animation="fadeUp" delay={0.08}>
              <Card className="lg:col-span-4 lg:row-span-1 border-white/10 bg-black/40">
                <CardContent id="attendance" className="space-y-4 p-6">
                  <div className="flex items-center gap-2 text-white">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Attendance</h3>
                  </div>
                  {!isDraft ? (
                    <EventAttendanceButtons eventId={event.id} />
                  ) : (
                    <p className="text-xs text-white/60">Attendance opens once the event is published.</p>
                  )}
                  {attendeePreview.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attendeePreview.map((attendee) => (
                        <div
                          key={`${attendee.id}-${attendee.status}`}
                          className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10"
                        >
                          {attendee.avatarUrl ? (
                            <img
                              src={attendee.avatarUrl}
                              alt={attendee.name}
                              className={`h-full w-full object-cover ${user ? '' : 'blur-md'}`}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs text-white/70">
                              {attendee.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal animation="fadeUp" delay={0.1}>
              <Card className="lg:col-span-4 lg:row-span-1 border-white/10 bg-black/40">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formattedDate}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <Clock className="h-4 w-4 text-primary" />
                      {eventTimeLabel}
                    </div>
                    {eventTimezone && (
                      <Badge variant="outline" className="border-white/20 text-white/70">
                        {eventTimezone}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-start gap-3 text-sm text-white/80">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-white">{locationLabel}</p>
                      {locationDetail && <p className="text-white/60">{locationDetail}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>

            <ScrollReveal animation="fadeUp" delay={0.12}>
              <Card className="lg:col-span-8 lg:row-span-1 border-white/10 bg-black/40">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-white">About the night</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">
                    {eventDescription || 'Details coming soon. Stay tuned for the full lineup, ticket info, and schedule.'}
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 lg:grid-cols-12 lg:auto-rows-[minmax(160px,_auto)]">
        <div className="lg:col-span-8 space-y-4">
          <ScrollReveal animation="fadeUp">
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-xl font-semibold text-foreground">Schedule</h2>
                {programItems.length > 0 ? (
                  <div className="space-y-3">
                    {programItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline">{item.type}</Badge>
                          <span className="text-sm font-medium">
                            {formatProgramTime(item.start) || 'Time TBA'}
                            {item.end ? ` - ${formatProgramTime(item.end)}` : ''}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{item.title}</p>
                        {item.description && <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Full schedule will be posted soon.</p>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal animation="fadeUp" delay={0.05}>
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-xl font-semibold text-foreground">Lineup</h2>
                {connectedPeople.length > 0 ? (
                  <div className="space-y-5">
                    {roleSections.map((section) => {
                      const rows = groupedConnections[section.key] || [];
                      if (rows.length === 0) return null;

                      return (
                        <div key={section.key} className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground/90">{section.label}</h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {rows.map((person: any) => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => openConnectionProfile(person.person_type, person.person_id)}
                                className="w-full rounded-lg border border-border bg-background/50 p-3 text-left hover:bg-muted/40"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-9 w-9 border border-border">
                                      <AvatarImage src={person.avatar_url || undefined} alt={person.display_name || section.label} />
                                      <AvatarFallback className="bg-muted text-foreground">
                                        {(person.display_name || section.label).slice(0, 1).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{person.display_name || section.label.slice(0, -1)}</p>
                                      <p className="text-xs text-muted-foreground truncate">{section.label.slice(0, -1)}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">
                                    {toConnectionBadge(person.connection_label)}
                                  </Badge>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Lineup announcements are on the way.</p>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal animation="fadeUp" delay={0.1}>
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-xl font-semibold text-foreground">Gallery</h2>
                {galleryImages.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {galleryImages.slice(0, 4).map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-2xl border border-border">
                        <img src={imageUrl} alt={`${eventName} gallery ${index + 1}`} className="h-40 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Share the vibe. Photos will appear here after the event.</p>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <ScrollReveal animation="fadeUp" delay={0.08}>
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tickets</h3>
                {pricingOptions.length > 0 ? (
                  <div className="space-y-3">
                    {pricingOptions.map((tier: any, index: number) => (
                      <div key={`${tier?.name || 'tier'}-${index}`} className="rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{tier?.name || `Tier ${index + 1}`}</p>
                          <span className="text-sm text-muted-foreground">{tier?.price || tier?.amount || 'Price TBA'}</span>
                        </div>
                        {tier?.details && <p className="mt-2 text-xs text-muted-foreground">{tier.details}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ticket options will be announced soon.</p>
                )}
                {eventCore?.ticket_url && (
                  <Button className="w-full">
                    <Ticket className="mr-2 h-4 w-4" />
                    View ticket page
                  </Button>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal animation="fadeUp" delay={0.1}>
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Policies</h3>
                {eventCore?.faq ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{eventCore.faq}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Refunds, age requirements, and dress code will be shared soon.</p>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal animation="fadeUp" delay={0.12}>
            <Card className="border-white/10 bg-card">
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Social</h3>
                {socialLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map((link) => (
                      <Button key={link.href} variant="outline" className="border-border" asChild>
                        <a href={link.href} target="_blank" rel="noreferrer">
                          <link.icon className="mr-2 h-4 w-4" />
                          {link.label}
                        </a>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No socials listed yet.</p>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>

          {!isDraft && (
            <ScrollReveal animation="fadeUp" delay={0.14}>
              <EventCoordinationSection eventId={event.id} goingCount={engagement?.going_count ?? 0} />
            </ScrollReveal>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
