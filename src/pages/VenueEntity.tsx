import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, Building2, Calendar, MapPin, Clock, Phone, Mail, 
  Globe, Instagram, Facebook, Car, Train, Users, Layers, 
  ExternalLink, Info, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { useCity } from '@/contexts/CityContext';

const VenueEntity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { citySlug } = useCity();

  // Fetch venue from venues table
  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Venue ID required');

      const { data, error } = await supabase
        .from('venues')
        .select(`
          *,
          cities (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // Fetch events hosted at this venue
  const { data: events } = useQuery({
    queryKey: ['venue-events', id, citySlug],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase.rpc('get_venue_events' as any, {
        p_venue_id: id,
        p_city_slug: citySlug,
      });

      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!id,
  });

  // Parse JSON fields safely - handle both string and array formats
  const parseStrArray = (val: any): string[] | null => {
    if (!val) return null;
    if (Array.isArray(val)) return (val as string[]).filter(Boolean);
    if (typeof val === 'string') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : null; } catch { return [val]; }
    }
    return null;
  };

  const facilities = parseStrArray(venue?.facilities_new ?? venue?.facilities);
  const floorType = parseStrArray(venue?.floor_type);
  const galleryUrls = parseStrArray(venue?.gallery_urls);
  const rules = parseStrArray(venue?.rules);
  const videoUrls = parseStrArray(venue?.video_urls);

  const openingHours = venue?.opening_hours && typeof venue.opening_hours === 'object' && !Array.isArray(venue.opening_hours)
    ? venue.opening_hours as Record<string, any>
    : null;

  // Pick first photo for avatar
  const coverPhoto = Array.isArray(venue?.photo_url) && venue.photo_url.length > 0
    ? venue.photo_url[0]
    : (typeof venue?.photo_url === 'string' ? venue.photo_url : null);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 px-3 pb-20 bg-background">
        <div className="max-w-2xl mx-auto space-y-3">
          <Skeleton className="h-6 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen pt-20 px-3 pb-20 bg-background">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-lg font-bold text-foreground mb-2">Venue Not Found</h1>
          <p className="text-xs text-muted-foreground mb-4">This venue doesn't exist or has been removed.</p>
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const hasLocation = venue.address || venue.google_maps_url || venue.transport || venue.parking;
  const hasContact = venue.phone || venue.email || venue.website || venue.instagram || venue.facebook;
  const hasDetails = venue.capacity || (facilities && facilities.length > 0) || (floorType && floorType.length > 0);
  const hasHours = openingHours && Object.keys(openingHours).length > 0;
  const hasGallery = galleryUrls && galleryUrls.length > 0;
  const hasRules = rules && rules.length > 0;

  return (
    <div className="min-h-screen pt-20 pb-20 bg-background">
      <PageBreadcrumb items={[
        { label: 'Venues', path: '/venues' },
        { label: venue.name }
      ]} />
      
      <div className="max-w-2xl mx-auto px-3">
        {/* Back Button */}
        <Button onClick={() => navigate(-1)} variant="ghost" size="sm" className="mb-3 -ml-2 h-7 text-xs">
          <ArrowLeft className="w-3 h-3 mr-1" />
          Back
        </Button>

        {/* Header - Compact */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="w-14 h-14 border border-border">
            <AvatarImage src={coverPhoto || undefined} alt={venue.name} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <Building2 className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{venue.name}</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{venue.cities?.name}{venue.address && `, ${venue.address}`}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {venue.capacity && (
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">{venue.capacity}</p>
              <p className="text-[10px] text-muted-foreground">Capacity</p>
            </div>
          )}
          {venue.transport && (
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Train className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium truncate">{venue.transport}</p>
              <p className="text-[10px] text-muted-foreground">Transport</p>
            </div>
          )}
          {venue.parking && (
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <Car className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium truncate">{venue.parking}</p>
              <p className="text-[10px] text-muted-foreground">Parking</p>
            </div>
          )}
          {venue.google_maps_url && (
            <a 
              href={venue.google_maps_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-muted/50 rounded-lg p-2 text-center hover:bg-muted transition-colors"
            >
              <MapPin className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">View</p>
              <p className="text-[10px] text-muted-foreground">Map</p>
            </a>
          )}
        </div>

        {/* Description */}
        {venue.description && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">About</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{venue.description}</p>
          </div>
        )}

        {/* Venue Rules */}
        {hasRules && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <h2 className="text-xs font-semibold text-foreground">Venue Rules</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules!.map((rule, i) => (
                <Badge key={i} variant="destructive" className="text-[10px] px-1.5 py-0">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Facilities & Floor Type */}
        {hasDetails && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">Venue Details</h2>
            </div>
            <div className="space-y-2">
              {floorType && floorType.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Floor Type</p>
                  <div className="flex flex-wrap gap-1">
                    {floorType.map((type, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {facilities && facilities.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Facilities</p>
                  <div className="flex flex-wrap gap-1">
                    {facilities.map((facility, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                        {facility}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Opening Hours */}
        {hasHours && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">Opening Hours</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(openingHours!).map(([day, hours]) => {
                // Handle both string and object formats
                let displayHours = '';
                if (typeof hours === 'string') {
                  displayHours = hours;
                } else if (hours && typeof hours === 'object') {
                  const h = hours as { open?: string; close?: string; isOpen?: boolean };
                  if (h.isOpen === false) {
                    displayHours = 'Closed';
                  } else if (h.open && h.close) {
                    displayHours = `${h.open} - ${h.close}`;
                  }
                }
                if (!displayHours) return null;
                return (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{day}</span>
                    <span className="text-foreground">{displayHours}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact Links - Compact Grid */}
        {hasContact && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {venue.phone && (
              <a href={`tel:${venue.phone}`} className="bg-card border border-border rounded-lg p-2 text-center hover:bg-muted transition-colors">
                <Phone className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Call</p>
              </a>
            )}
            {venue.email && (
              <a href={`mailto:${venue.email}`} className="bg-card border border-border rounded-lg p-2 text-center hover:bg-muted transition-colors">
                <Mail className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Email</p>
              </a>
            )}
            {venue.website && (
              <a href={venue.website} target="_blank" rel="noopener noreferrer" className="bg-card border border-border rounded-lg p-2 text-center hover:bg-muted transition-colors">
                <Globe className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Website</p>
              </a>
            )}
            {venue.instagram && (
              <a href={`https://instagram.com/${venue.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="bg-card border border-border rounded-lg p-2 text-center hover:bg-muted transition-colors">
                <Instagram className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Instagram</p>
              </a>
            )}
            {venue.facebook && (
              <a href={venue.facebook} target="_blank" rel="noopener noreferrer" className="bg-card border border-border rounded-lg p-2 text-center hover:bg-muted transition-colors">
                <Facebook className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Facebook</p>
              </a>
            )}
          </div>
        )}

        {/* Venue features (boolean flags) */}
        {(venue.bar_available || venue.cloakroom_available || venue.id_required || venue.last_entry_time) && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-2">Features</h2>
            <div className="flex flex-wrap gap-2">
              {venue.bar_available && (
                <Badge variant="outline" className="text-[10px]">🍹 Bar available</Badge>
              )}
              {venue.cloakroom_available && (
                <Badge variant="outline" className="text-[10px]">🧥 Cloakroom</Badge>
              )}
              {venue.id_required && (
                <Badge variant="outline" className="text-[10px]">🪪 ID required</Badge>
              )}
              {venue.last_entry_time && (
                <Badge variant="outline" className="text-[10px]">🕐 Last entry {venue.last_entry_time}</Badge>
              )}
            </div>
          </div>
        )}

        {/* FAQ */}
        {venue.faq && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">FAQ</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{venue.faq}</p>
          </div>
        )}

        {/* Videos */}
        {videoUrls && videoUrls.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-2">Videos</h2>
            <div className="space-y-1">
              {videoUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Gallery - Small Thumbnails */}
        {hasGallery && (
          <div className="mb-3">
            <h2 className="text-xs font-semibold text-foreground mb-2">Gallery</h2>
            <div className="grid grid-cols-4 gap-1.5">
              {galleryUrls!.slice(0, 8).map((url, i) => (
                <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                  <img src={url} alt={`${venue.name} ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Hosted */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">Events at this venue</h2>
          </div>
          {events && events.length > 0 ? (
            <div className="space-y-1.5">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-xs font-medium text-foreground truncate flex-1 mr-2">{event.name}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.date), 'MMM d')}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No events yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueEntity;

