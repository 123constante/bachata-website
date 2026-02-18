import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { 
  ArrowLeft, Calendar, Clock, MapPin, ExternalLink, 
  Users, ChevronRight, Facebook, Instagram, Globe, 
  CreditCard, Train, Info, Ticket, Edit 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { EventAttendanceButtons } from '@/components/EventAttendanceButtons';
import { EventCoordinationSection } from '@/components/EventCoordinationSection';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// --- Constants & Helpers ---

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=800&fit=crop';
const MOCK_IMAGE_2 = 'https://images.unsplash.com/photo-1545128485-c400e7702796?w=800&h=600&fit=crop';
const MOCK_IMAGE_3 = 'https://images.unsplash.com/photo-1571210217038-cb4275030ddf?w=800&h=600&fit=crop';

const formatTime = (time: string | null) => {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const RoleRingColor = {
  teacher: 'border-blue-500',
  dj: 'border-purple-500',
  organiser: 'border-orange-500',
  attendee: 'border-green-500',
};

// --- Component ---

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // 1. Fetch Event
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) throw new Error('Event ID is required');
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Event not found');
      return data;
    },
    enabled: !!id,
  });

  // 2. Fetch Entity Roles (Teachers, DJs, Organisers, Venue)
  const { data: relatedEntities } = useQuery({
    queryKey: ['event-entities', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('event_entities')
        .select(`
          role,
          entities (
            id,
            name,
            avatar_url,
            city
          )
        `)
        .eq('event_id', id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // 3. Fetch Attendees (Who's Going)
  const { data: attendees } = useQuery({
    queryKey: ['event-attendees', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('event_participants')
        .select(`
          status,
          user_id
        `)
        .eq('event_id', id)
        .eq('status', 'going');
        
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        return profiles ?? [];
      }
      return [];
    },
    enabled: !!id,
  });
  
  // 4. Fetch Venue Details separately if stored in venues table (fallback)
  const { data: venueDetails } = useQuery({
    queryKey: ['venue', event?.venue_id],
    queryFn: async () => {
      if (!event?.venue_id) return null;
      const { data } = await supabase
        .from('venues')
        .select('*')
        .eq('id', event.venue_id)
        .maybeSingle();
      return data;
    },
    enabled: !!event?.venue_id,
  });

  // Process Entities
  const teachers = relatedEntities?.filter(e => e.role === 'teacher').map(e => e.entities) ?? [];
  const djs = relatedEntities?.filter(e => e.role === 'dj').map(e => e.entities) ?? [];
  const organisers = relatedEntities?.filter(e => e.role === 'organiser').map(e => e.entities) ?? [];
  const venueEntity = relatedEntities?.find(e => e.role === 'venue')?.entities;

  // Permissions & Logic
  const { canEdit, canPublish } = useEventPermissions(id, event?.created_by);
  const isDraft = event?.is_published === false;
  
  if (isLoading) return <DetailSkeleton />;
  if (!event || (isDraft && !canEdit)) return <NotFound />;

  // Computed Values
  const hasClass = (event as any).class_start && (event as any).class_end;
  const hasSocial = (event as any).social_start && (event as any).social_end;
  const venueName = venueEntity?.name || venueDetails?.name || 'TBA';
  const displayAddress = venueEntity?.city || venueDetails?.address || 'Location details coming soon';
  const attendeeCount = attendees?.length || 0;
  const extraAttendees = attendeeCount > 10 ? attendeeCount - 10 : 0;

  // Determine Price Display
  let priceDisplay = 'Check details';
  if (event.tickets && !isNaN(parseFloat(event.tickets))) {
    priceDisplay = `£${event.tickets}`;
  } else if (event.tickets) {
    priceDisplay = event.tickets;
  } else if (event.pricing && typeof event.pricing === 'object') {
     const p = event.pricing as any; 
     if (p.standard) priceDisplay = `£${p.standard}`;
     else if (p.door) priceDisplay = `£${p.door}`;
     else if (p.from) priceDisplay = `From £${p.from}`;
  }

  // Get Good to Know info
  const paymentMethods = event.payment_methods || (venueDetails as any)?.payment_methods; 
  const transportInfo = venueDetails?.transport || (venueEntity as any)?.closest_transport;
  const parkingInfo = venueDetails?.parking;
  const venueRules = venueDetails?.rules && Array.isArray(venueDetails.rules) ? venueDetails.rules.join('. ') : venueDetails?.rules;

  return (
    <div className="min-h-screen pb-32 pt-20">
      <PageBreadcrumb items={[{ label: 'Events', path: '/events' }, { label: event.name }]} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* 1. Asymmetric Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 h-[300px] md:h-[400px] rounded-2xl overflow-hidden mb-8">
          {/* Large Hero (60%) */}
          <div className="md:col-span-3 h-full relative group">
            <img 
              src={event.cover_image_url || DEFAULT_COVER} 
              alt={event.name} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Mobile Back Button Overlay */}
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 bg-background/50 backdrop-blur md:hidden text-foreground rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Stacked Side Images (40%) */}
          <div className="hidden md:flex flex-col gap-2 md:col-span-2 h-full">
            <div className="h-1/2 w-full overflow-hidden">
              <img 
                src={MOCK_IMAGE_2} 
                alt="Event atmosphere" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="h-1/2 w-full overflow-hidden relative cursor-pointer">
              <img 
                src={MOCK_IMAGE_3} 
                alt="Event detail" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/50 transition-colors">
                <span className="text-white font-semibold flex items-center gap-2">
                  See all photos <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Info */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* 2. Compact Title & Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider">
                    {event.type || ((event as any).social_start ? 'Social' : 'Class')} 
                    </span>
                    {isDraft && <span className="text-amber-500 font-bold text-xs uppercase border border-amber-500 px-2 rounded-full">Draft</span>}
                </div>
                
                <div className="flex items-center gap-3">
                    {/* EDIT BUTTON START */}
                    {canEdit && (
                      <Button onClick={() => navigate(`/event/edit/${id}`)} variant="outline" size="sm" className="h-8">
                        <Edit className="w-4 h-4 mr-2" /> Edit Event
                      </Button>
                    )}
                    {/* EDIT BUTTON END */}
                    
                    {/* Social Links */}
                    <div className="flex gap-2">
                        {event.website && (
                            <a href={event.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Globe className="w-5 h-5" />
                            </a>
                        )}
                        {event.instagram_url && (
                            <a href={event.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-pink-600 transition-colors">
                                <Instagram className="w-5 h-5" />
                            </a>
                        )}
                        {event.facebook_url && (
                            <a href={event.facebook_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-600 transition-colors">
                                <Facebook className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{event.name}</h1>
            </div>

            {/* 3. Quick Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Box 1: Date & Venue */}
              <div className="bg-muted/30 p-4 rounded-xl border border-muted/50 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg shadow-sm">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{format(new Date(event.date), 'EEE, MMM d, yyyy')}</p>
                    <p className="text-xs text-muted-foreground">Date</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg shadow-sm">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{venueName}</p>
                    <p className="text-xs text-muted-foreground truncate">{displayAddress}</p>
                  </div>
                </div>
              </div>

              {/* Box 2: Times */}
              <div className="bg-muted/30 p-4 rounded-xl border border-muted/50 flex flex-col gap-3 justify-center">
                {hasClass && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-lg shadow-sm">
                      <Clock className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{formatTime((event as any).class_start)} - {formatTime((event as any).class_end)}</p>
                      <p className="text-xs text-muted-foreground">Classes</p>
                    </div>
                  </div>
                )}
                {hasSocial && (
                  <div className={`flex items-center gap-3 ${!hasClass ? 'h-full' : ''}`}>
                    <div className="p-2 bg-background rounded-lg shadow-sm">
                      <Clock className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{formatTime((event as any).social_start)} - {formatTime((event as any).social_end)}</p>
                      <p className="text-xs text-muted-foreground">Social</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
              <h3 className="text-foreground font-semibold text-lg mb-2">About this event</h3>
              <p className="whitespace-pre-wrap">{event.description || "No description provided."}</p>
            </div>

            {/* Good to Know Section - Logistics */}
            {(paymentMethods || transportInfo || parkingInfo || venueRules) && (
                <div className="bg-primary/5 rounded-xl p-6 border border-primary/10 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <Info className="w-4 h-4 text-primary" />
                        Good to know
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {paymentMethods && (
                            <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                <CreditCard className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                <span>Payment: {paymentMethods}</span>
                            </div>
                        )}
                        {transportInfo && (
                            <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                <Train className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                <span>Transport: {transportInfo}</span>
                            </div>
                        )}
                         {parkingInfo && (
                            <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                <span>Parking: {parkingInfo}</span>
                            </div>
                        )}
                        {venueRules && (
                            <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                <Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                                <span>Note: {venueRules}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Who's Involved (Horizontal Scroll) */}
            {(teachers.length > 0 || djs.length > 0 || organisers.length > 0) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Who's Involved
                </h3>
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                  <div className="flex gap-4">
                    {/* Teachers (Blue) */}
                    {teachers.map((t: any) => (
                      <InvolvedCard key={`t-${t.id}`} entity={t} role="Teacher" colorClass={RoleRingColor.teacher} />
                    ))}
                    {/* DJs (Purple) */}
                    {djs.map((d: any) => (
                      <InvolvedCard key={`d-${d.id}`} entity={d} role="DJ" colorClass={RoleRingColor.dj} />
                    ))}
                    {/* Organisers (Orange) */}
                    {organisers.map((o: any) => (
                      <InvolvedCard key={`o-${o.id}`} entity={o} role="Organiser" colorClass={RoleRingColor.organiser} />
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}

            {/* 5. Who's Going (Horizontal Scroll) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Who's Going <span className="text-muted-foreground text-sm font-normal">({attendeeCount})</span>
                </h3>
              </div>
              
              {attendees && attendees.length > 0 ? (
                <ScrollArea className="w-full whitespace-nowrap pb-2">
                  <div className="flex items-center gap-3">
                    {attendees.slice(0, 10).map((person: any) => (
                      <Link to={`/dancer/${person.id}`} key={person.id} className="relative group">
                        <Avatar className={`w-12 h-12 border-2 ${RoleRingColor.attendee} transition-transform group-hover:scale-110`}>
                          <AvatarImage src={person.avatar_url} />
                          <AvatarFallback className="text-[10px]">
                            {person.username?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="sr-only">{person.username}</span>
                      </Link>
                    ))}
                    {extraAttendees > 0 && (
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-xs font-medium text-muted-foreground border-2 border-dashed border-muted-foreground/30">
                        +{extraAttendees}
                      </div>
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground italic">Be the first to say you're going!</p>
              )}
            </div>

            {/* 7. Coordination Section (Locked until threshold) */}
            {!isDraft && (
               <EventCoordinationSection eventId={event.id} goingCount={attendeeCount} />
            )}

          </div>

          {/* Right Column: Sticky on Desktop, hidden on mobile (handled by bottom bar) */}
          <div className="hidden lg:block lg:col-span-1">
             <div className="sticky top-24 space-y-6">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-6 space-y-6">
                    <div className="text-center pb-4 border-b border-border">
                       <p className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-2">Tickets starting at</p>
                       <span className="text-4xl font-bold text-foreground tracking-tight">
                         {priceDisplay}
                       </span>
                    </div>
                    {event.ticket_url ? (
                        <Button className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all" size="lg" asChild>
                          <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
                             Get Tickets <Ticket className="w-5 h-5 ml-2" />
                          </a>
                        </Button>
                    ) : (
                         <Button className="w-full" variant="secondary" disabled>
                             Tickets not available online
                         </Button>
                    )}
                    <div className="w-full">
                       <EventAttendanceButtons eventId={event.id} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {attendeeCount} people are going to this event
                    </p>
                  </CardContent>
                </Card>
             </div>
          </div>
        </div>
      </main>

      {/* 6. Sticky Bottom CTA (Mobile Only) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border p-4 safe-area-bottom">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {event.ticket_url ? (
            <Button className="flex-1 shadow-lg" variant="default" asChild>
              <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
                Tickets 
              </a>
            </Button>
          ) : (
              <div className="flex-1 text-center text-xs font-semibold text-muted-foreground">
                 {priceDisplay}
              </div>
          )}
          <div className="flex-1">
            <EventAttendanceButtons eventId={event.id} />
          </div>
        </div>
      </div>

    </div>
  );
};

// --- Sub-components ---

const InvolvedCard = ({ entity, role, colorClass }: { entity: any, role: string, colorClass: string }) => (
  <Link 
    to={`/profile/${entity.id}`} 
    className="inline-flex flex-col items-center gap-2 min-w-[80px] group"
  >
    <Avatar className={`w-16 h-16 border-2 ${colorClass} p-0.5 bg-background transition-transform group-hover:scale-105`}>
      <AvatarImage src={entity.avatar_url} className="rounded-full object-cover" />
      <AvatarFallback>{entity.name?.[0]}</AvatarFallback>
    </Avatar>
    <div className="text-center">
      <p className="text-xs font-semibold truncate max-w-[100px] group-hover:text-primary transition-colors">
        {entity.name}
      </p>
      <p className="text-[10px] text-muted-foreground">{role}</p>
    </div>
  </Link>
);

const DetailSkeleton = () => (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
);

const NotFound = () => (
  <div className="min-h-screen pt-20 flex flex-col items-center justify-center p-4 text-center">
    <h1 className="text-2xl font-bold mb-2">Event not found</h1>
    <p className="text-muted-foreground mb-4">The event you are looking for does not exist or has been removed.</p>
    <Button asChild><Link to="/events">Back to Events</Link></Button>
  </div>
);

export default EventDetail;

