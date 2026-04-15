import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Building2, MapPin, Users, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import PageHero from '@/components/PageHero';
import PageBreadcrumb from '@/components/PageBreadcrumb';

type VenueCard = {
  id: string;
  name: string;
  photo_url: string[] | null;
  description: string | null;
  address: string | null;
  capacity: number | null;
  floor_type: any | null;
  facilities: any | null;
  parking: string | null;
  cities?: { name: string } | null;
};

const parseArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; }
  }
  return [];
};

const Venues = () => {
  const [search, setSearch] = useState('');

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, photo_url, description, address, capacity, floor_type, facilities, parking, cities(name)')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as VenueCard[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return venues;
    return venues.filter((v) => {
      const name = v.name.toLowerCase();
      const city = (v.cities?.name || '').toLowerCase();
      const addr = (v.address || '').toLowerCase();
      return name.includes(q) || city.includes(q) || addr.includes(q);
    });
  }, [venues, search]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <PageHero
        emoji="🏛️"
        titleWhite="Dance"
        titleOrange="Venues"
        subtitle="Find the perfect space for bachata — studios, clubs, and event halls."
        largeTitle={false}
      />

      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-2">
          <PageBreadcrumb items={[{ label: 'Venues' }]} />
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, city or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No venues match your search.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((venue) => {
              const coverPhoto = Array.isArray(venue.photo_url) && venue.photo_url.length > 0 ? venue.photo_url[0] : null;
              const floorTypes = parseArray(venue.floor_type);

              return (
                <StaggerItem key={venue.id}>
                  <Link to={`/venue-entity/${venue.id}`}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all group"
                    >
                      {/* Cover image */}
                      <div className="h-40 bg-muted/20 relative overflow-hidden">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto}
                            alt={venue.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-12 h-12 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-0.5">
                          {venue.name}
                        </h3>

                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mb-3">
                          {venue.cities?.name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {venue.cities.name}
                            </span>
                          )}
                          {venue.capacity && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {venue.capacity}
                            </span>
                          )}
                        </div>

                        {venue.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {venue.description}
                          </p>
                        )}

                        {floorTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {floorTypes.slice(0, 2).map((ft) => (
                              <Badge key={ft} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/25 text-primary/70">
                                <Layers className="w-2.5 h-2.5 mr-1" />{ft}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {filtered.length} venue{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default Venues;
