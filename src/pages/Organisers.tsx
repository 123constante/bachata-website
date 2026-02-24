import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Star, Users, PartyPopper, Music, Sparkles, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PageHero from '@/components/PageHero';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import bachataLogo from '@/assets/bachata-calendar-logo.png';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { useCity } from '@/contexts/CityContext';

const heroWidgets = [
  {
    emoji: '”',
    title: 'Find An Organiser',
    desc: 'Browse all organisers',
    sectionId: 'directory',
  },
];

const Organisers = () => {
  const { citySlug } = useCity();

  // Fetch organisers from entities table
  const { data: organisers, isLoading } = useQuery({
    queryKey: ['entities', 'organiser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, avatar_url, bio, socials, city_id, cities(name)')
        .eq('type', 'organiser')
        .order('name');
      
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch event counts per organiser
  const { data: eventCounts } = useQuery({
    queryKey: ['entity-event-counts', 'organiser', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_event_counts' as any, {
        p_city_slug: citySlug,
      });
      
      if (error) throw error;
      
      // Count events per entity
      const counts: Record<string, number> = {};
      (data as any[] | null)?.forEach((item) => {
        if (!item?.entity_id) return;
        counts[item.entity_id] = item.event_count ?? 0;
      });
      return counts;
    },
  });

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20 pt-20">
      <PageBreadcrumb items={[{ label: 'Parties', path: '/parties' }, { label: 'Organisers' }]} />
      {/* Hero Section */}
      <PageHero
        emoji="­"
        titleWhite="Event"
        titleOrange="Organisers"
        subtitle=""
        widgets={heroWidgets}
        gradientFrom="festival-pink"
        floatingIcons={[PartyPopper, Star, Users, Music, Sparkles]}
        card3DEffect={true}
        largeTitle={true}
      />

      {/* Organisers Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Organisers</span>
          </h2>
        </ScrollReveal>

        {isLoading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <Skeleton className="w-12 h-8" />
                </div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
        ) : organisers && organisers.length > 0 ? (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {organisers.map((organiser) => {
              const socials = organiser.socials as { instagram?: string } | null;
              const eventCount = eventCounts?.[organiser.id] || 0;
              
              return (
                <StaggerItem key={organiser.id}>
                  <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.3 }}>
                    <Link to={`/organisers/${organiser.id}`}>
                      <Card className="p-6 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 group">
                        {/* Avatar & Event Count */}
                        <div className="flex items-start justify-between mb-4">
                          <Avatar className="w-16 h-16 border-2 border-primary/20">
                            <AvatarImage src={organiser.avatar_url || undefined} alt={organiser.name} />
                            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                              {organiser.name?.charAt(0) || '­'}
                            </AvatarFallback>
                          </Avatar>
                          {eventCount > 0 && (
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-primary text-sm font-bold">
                                <Calendar className="w-3 h-3" />
                                <span>{eventCount}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">events</span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                          {organiser.name}
                        </h3>
                        {/* Subheading: Event organiser */}
                        <span className="text-xs text-muted-foreground block mb-3">
                          Event organiser
                        </span>
                        
                        {organiser.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {organiser.bio}
                          </p>
                        )}
                      </Card>
                    </Link>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No organisers listed yet.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-24 py-20 px-4 border-t border-primary/20 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center">

            <p className="text-muted-foreground text-sm">
              Â© 2024 Bachata Calendar. Made with{' '}
              <motion.span
                className="inline-block text-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                â™¥
              </motion.span>{' '}
              in London
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Organisers;


