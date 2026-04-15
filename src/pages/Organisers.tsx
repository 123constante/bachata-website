import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, X, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PageHero from '@/components/PageHero';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { useCity } from '@/contexts/CityContext';

type OrgRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  organisation_category: string | null;
  cities?: { name: string } | null;
};

const Organisers = () => {
  const { citySlug } = useCity();
  const [search, setSearch] = useState('');

  const { data: organisers = [], isLoading } = useQuery({
    queryKey: ['entities-organisers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, avatar_url, bio, organisation_category, city_id, cities:cities!entities_city_id_fkey(name)')
        .eq('type', 'organiser')
        .or('is_active.is.null,is_active.eq.true')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as OrgRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: eventCounts } = useQuery({
    queryKey: ['organiser-event-counts', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_event_counts' as any, {
        p_city_slug: citySlug,
      });
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id) counts[item.entity_id] = item.event_count ?? 0;
      });
      return counts;
    },
    enabled: !!citySlug,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return organisers;
    return organisers.filter((o) => {
      const name = o.name.toLowerCase();
      const city = (o.cities?.name || '').toLowerCase();
      const cat = (o.organisation_category || '').toLowerCase();
      return name.includes(q) || city.includes(q) || cat.includes(q);
    });
  }, [organisers, search]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <PageHero
        emoji="🎪"
        titleWhite="Event"
        titleOrange="Organisers"
        subtitle="The people and collectives behind the best bachata nights."
        largeTitle={false}
      />

      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-2">
          <PageBreadcrumb items={[{ label: 'Parties', path: '/parties' }, { label: 'Organisers' }]} />
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, city or type…"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="w-14 h-14 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-4/5" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No organisers match your search.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((organiser) => {
              const eventCount = eventCounts?.[organiser.id] ?? 0;

              return (
                <StaggerItem key={organiser.id}>
                  <Link to={`/organisers/${organiser.id}`}>
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card className="p-5 h-full bg-card border-border/40 hover:border-primary/30 hover:shadow-md transition-all group">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar className="w-14 h-14 border border-primary/10 shrink-0">
                            <AvatarImage src={organiser.avatar_url || undefined} alt={organiser.name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                              {organiser.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {organiser.name}
                            </h3>
                            {organiser.organisation_category && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {organiser.organisation_category}
                              </p>
                            )}
                            {organiser.cities?.name && (
                              <p className="text-xs text-muted-foreground/70 line-clamp-1">
                                {organiser.cities.name}
                              </p>
                            )}
                          </div>

                          {eventCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0">
                              <Calendar className="w-3 h-3" />
                              {eventCount}
                            </div>
                          )}
                        </div>

                        {organiser.bio && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {organiser.bio}
                          </p>
                        )}
                      </Card>
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {filtered.length} organiser{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default Organisers;
