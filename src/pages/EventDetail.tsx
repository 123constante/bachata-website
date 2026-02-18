import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { resolveEventImage } from '@/lib/utils';
import { ArrowLeft, Calendar, Clock, MapPin, Train, Car, AlertTriangle, Globe, Loader2, Edit } from 'lucide-react';
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
  social_start?: string | null;
  social_end?: string | null;
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

  const event: RpcEvent | null = detailPayload?.event ?? null;
  const venue: RpcVenue | null = detailPayload?.venue ?? null;
  const venueLoading = false;
  const organisers: RpcProfileStub[] = Array.isArray(detailPayload?.organisers) ? detailPayload.organisers : [];
  const teachers: RpcProfileStub[] = Array.isArray(detailPayload?.teachers) ? detailPayload.teachers : [];
  const djs: RpcProfileStub[] = Array.isArray(detailPayload?.djs) ? detailPayload.djs : [];
  const venueEntity: RpcVenueEntity | null = detailPayload?.venue_entity ?? null;

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
          ? supabase.from('organisers').select('id,name,photo_url').in('id', unique(byType.organiser))
          : Promise.resolve(emptyResult),
        unique(byType.teacher).length
          ? supabase.from('teacher_profiles').select('id,first_name,surname,photo_url').in('id', unique(byType.teacher))
          : Promise.resolve(emptyResult),
        unique(byType.dj).length
          ? supabase.from('dj_profiles').select('id,name,photo_url').in('id', unique(byType.dj))
          : Promise.resolve(emptyResult),
        unique(byType.vendor).length
          ? supabase.from('vendors').select('id,business_name,photo_url').in('id', unique(byType.vendor))
          : Promise.resolve(emptyResult),
        unique(byType.videographer).length
          ? supabase.from('videographers').select('id,business_name,photo_url').in('id', unique(byType.videographer))
          : Promise.resolve(emptyResult),
      ]);

      type ProfileEntry = { name: string; avatar: string | null };
      const toMap = (rows: Record<string, unknown>[], nameExtractor: (r: Record<string, unknown>) => string): Map<string, ProfileEntry> =>
        new Map(rows.map((r) => [r.id as string, { name: nameExtractor(r), avatar: resolveEventImage(r.photo_url as string[] | null, null) }]));

      const dancerMap = toMap(dancersRes.data || [], (r) => [r.first_name, r.surname].filter(Boolean).join(' ') || 'Dancer');
      const organiserMap = toMap(organisersRes.data || [], (r) => (r.name as string) || 'Organiser');
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
  const { canEdit, canPublish, isLoading: permissionsLoading } = useEventPermissions(id, event?.created_by);

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

  // Debug: Parse key_times
  const keyTimes = typeof event?.key_times === 'string' 
      ? JSON.parse(event.key_times) 
      : (event?.key_times || event?.meta_data?.key_times || {});

  const program = Array.isArray(event?.meta_data?.program) ? event?.meta_data?.program : null;
  let programHasParty = false;
  let programHasClass = false;
  if (program) {
    for (const item of program) {
      if (item?.type === 'party') {
        programHasParty = true;
      }
      if (item?.type === 'class' || item?.type === 'workshop') {
        programHasClass = true;
      }
      if (Array.isArray(item?.music_styles) && item.music_styles.includes('party')) {
        programHasParty = true;
      }
    }
  }

  // Determine times (prioritize key_times, fallback to root columns)
  const classStart = keyTimes?.classes?.start || event?.class_start;
  const classEnd = keyTimes?.classes?.end || event?.class_end;
  const socialStart = keyTimes?.party?.start || event?.social_start;
  const socialEnd = keyTimes?.party?.end || event?.social_end;
  
  const hasClass = program ? programHasClass : !!(classStart && classEnd);
  const hasSocial = program ? programHasParty : !!(socialStart && socialEnd);

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
    <div className="min-h-screen bg-background pb-24 pt-[100px]">
      <PageBreadcrumb items={[{ label: 'Events' }, { label: event.name }]} />
      {/* Draft Banner - only shown for drafts accessible by creator/admin */}
      {isDraft && (
        <div className="fixed top-[72px] left-0 right-0 z-40 bg-amber-500 text-amber-950 py-3 px-4">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold text-sm">DRAFT EVENT</span>
            </div>
            <span className="text-xs text-amber-900">This event is not public yet. Publish it to make it visible.</span>
          </div>
        </div>
      )}

      {/* Cover Image */}
      <div className={`relative h-[300px] md:h-[400px] w-full ${isDraft ? 'mt-10' : ''}`}>
        <img
          src={resolveEventImage(event.photo_url, event.cover_image_url) || DEFAULT_COVER}
          alt={event.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          size="icon"
          className="absolute top-24 left-4 bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Draft Badge on Cover */}
        {isDraft && (
          <Badge variant="secondary" className="absolute top-24 right-4 bg-amber-500 text-amber-950 hover:bg-amber-500">
            DRAFT
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
        {/* Event Name */}
        <ScrollReveal animation="fadeUp">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {event.name}
            </h1>
            {canEdit && (
              <Button 
                onClick={() => navigate(`/event/${event.id}/edit`)} 
                variant="outline"
                className="shrink-0 bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Event
              </Button>
            )}
          </div>
        </ScrollReveal>

        {/* Publish Button - Only show for drafts when user can publish */}
        {isDraft && canPublish && (
          <ScrollReveal animation="fadeUp" delay={0.05}>
            <Card className="mb-6 border-amber-500/50 bg-amber-500/10">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Ready to publish?</h3>
                    <p className="text-sm text-muted-foreground">
                      Once published, this event will be publicly visible to everyone.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="shrink-0" disabled={isPublishing}>
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4 mr-2" />
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
                        <AlertDialogAction onClick={handlePublish}>
                          Publish Event
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Quick Info Card */}
        <ScrollReveal animation="fadeUp" delay={0.1}>
          <Card className="mb-6">
            <CardContent className="p-6 space-y-4">
              {/* Date */}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">
                  {format(new Date(event.date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>

              {/* Class Times */}
              {hasClass && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground">
                    <span className="font-medium">Class:</span> {formatTime(classStart)} – {formatTime(classEnd)}
                  </span>
                </div>
              )}

              {/* Social Times */}
              {hasSocial && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground">
                    <span className="font-medium">Social:</span> {formatTime(socialStart)} – {formatTime(socialEnd)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Description */}
        {event.description && (
          <ScrollReveal animation="fadeUp" delay={0.15}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-3">About</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Venue Section - Unified */}
        <ScrollReveal animation="fadeUp" delay={0.2}>
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Venue</h2>
              
              {venueEntity ? (
                <Link
                  to={`/venue-entity/${venueEntity.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Avatar className="w-12 h-12 border border-primary/20">
                    <AvatarImage src={venueEntity.avatar_url || undefined} alt={venueEntity.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      🏛️
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{venueEntity.name}</p>
                    {venueEntity.city && (
                      <p className="text-sm text-muted-foreground">{venueEntity.city}</p>
                    )}
                  </div>
                </Link>
              ) : !event.venue_id ? (
                <p className="text-muted-foreground italic">Venue TBA</p>
              ) : venueLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ) : venue ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{venue.name}</p>
                      <p className="text-muted-foreground text-sm">{venue.address}</p>
                    </div>
                  </div>

                  {venue.transport && (
                    <div className="flex items-center gap-3">
                      <Train className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground text-sm">{venue.transport}</span>
                    </div>
                  )}

                  {venue.parking && (
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-primary" />
                      <span className="text-muted-foreground text-sm">{venue.parking}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Venue information unavailable</p>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Event People Graph (Phase 2) */}
        {connectedPeople.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.24}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Connected People</h2>
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
                              className="w-full rounded-lg border border-festival-teal/30 bg-background/55 p-3 text-left hover:bg-festival-teal/12"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar className="h-9 w-9 border border-festival-teal/25">
                                    <AvatarImage src={person.avatar_url || undefined} alt={person.display_name || section.label} />
                                    <AvatarFallback className="bg-festival-teal/10 text-cyan-300">
                                      {(person.display_name || section.label).slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{person.display_name || section.label.slice(0, -1)}</p>
                                    <p className="text-xs text-muted-foreground truncate">{section.label.slice(0, -1)}</p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="border-festival-teal/35 bg-background/55 text-[10px]">
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
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Teachers Section (legacy fallback) */}
        {connectedPeople.length === 0 && teachers && teachers.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.25}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Teachers</h2>
                <div className="space-y-4">
                  {teachers.map((teacher: any) => (
                    <Link
                      key={teacher.id}
                      to={`/teachers/${teacher.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Avatar className="w-12 h-12 border border-primary/20">
                        <AvatarImage
                          src={resolveEventImage(teacher.photo_url, teacher.avatar_url) || undefined}
                          alt={teacher.name}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {teacher.name?.charAt(0) || '🎓'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{teacher.name}</p>
                        <p className="text-sm text-muted-foreground">Teacher</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* DJs Section (legacy fallback) */}
        {connectedPeople.length === 0 && djs && djs.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.27}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">DJs</h2>
                <div className="space-y-4">
                  {djs.map((dj: any) => (
                    <Link
                      key={dj.id}
                      to={`/djs/${dj.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Avatar className="w-12 h-12 border border-primary/20">
                        <AvatarImage
                          src={resolveEventImage(dj.photo_url, dj.avatar_url) || undefined}
                          alt={dj.name}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {dj.name?.charAt(0) || '🎧'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{dj.name}</p>
                        <p className="text-sm text-muted-foreground">DJ</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}


        {/* Organised by Section (legacy fallback) */}
        {connectedPeople.length === 0 && organisers && organisers.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.3}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Organised by</h2>
                <div className="space-y-4">
                  {organisers.map((organiser: any) => (
                    <Link
                      key={organiser.id}
                      to={`/organisers/${organiser.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Avatar className="w-12 h-12 border border-primary/20">
                        <AvatarImage
                          src={resolveEventImage(organiser.photo_url, organiser.avatar_url) || undefined}
                          alt={organiser.name}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {organiser.name?.charAt(0) || '🎭'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{organiser.name}</p>
                        <p className="text-sm text-muted-foreground">Event organiser</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Organisers help coordinate events listed on the platform.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Interested / Going Buttons - ONLY for published events */}
        {!isDraft && (
          <ScrollReveal animation="fadeUp" delay={0.3}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Are you going?</h2>
                <EventAttendanceButtons eventId={event.id} />
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Event Coordination Section - ONLY for published events */}
        {!isDraft && (
          <ScrollReveal animation="fadeUp" delay={0.35}>
            <EventCoordinationSection eventId={event.id} goingCount={engagement?.going_count ?? 0} />
          </ScrollReveal>
        )}

        {/* DEBUG SECTION */}
        <div className="mt-12 p-4 bg-black/20 rounded-lg border border-primary/20">
          <h3 className="text-xs font-mono text-primary mb-2">DEBUG: RAW EVENT DATA</h3>
          <pre className="text-[10px] overflow-auto max-h-[300px] text-muted-foreground">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
