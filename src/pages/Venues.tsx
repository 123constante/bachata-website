import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { MapPin, Building2, Music, Sparkles, Heart, Clock, Building, Instagram, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PageHero from '@/components/PageHero';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { FloatingElements } from '@/components/FloatingElements';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCity } from '@/contexts/CityContext';

const heroWidgets = [
  {
    emoji: '🔍',
    title: 'Find A Venue',
    desc: 'Browse all venues',
    sectionId: 'directory',
  },
  {
    emoji: '🏛️',
    title: 'List Your Venue',
    desc: 'Join the directory',
    sectionId: 'get-listed',
  },
];

const floatingIcons = [MapPin, Building2, Music, Sparkles, Heart];

type VenueEntity = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  city_id: string | null;
  cities: { name: string } | null;
  socials: { instagram?: string; website?: string } | null;
};

const VenueSkeleton = () => (
  <Card className="p-6 h-full">
    <Skeleton className="w-16 h-16 rounded-full mb-4" />
    <Skeleton className="h-5 w-3/4 mb-2" />
    <Skeleton className="h-4 w-1/2 mb-3" />
    <Skeleton className="h-4 w-full mb-1" />
    <Skeleton className="h-4 w-4/5 mb-4" />
    <Skeleton className="h-9 w-full" />
  </Card>
);

const Venues = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { citySlug } = useCity();

  const [formData, setFormData] = useState({ name: '', contactNumber: '' });

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venue-entities-directory', citySlug],
    queryFn: async () => {
      const query = supabase
        .from('entities')
        .select('id, name, avatar_url, bio, city_id, cities(name), socials')
        .eq('type', 'venue')
        .order('name');

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as VenueEntity[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Submission Received!',
      description: "We'll contact you within 2 hours.",
    });
    setFormData({ name: '', contactNumber: '' });
  };

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden pb-20">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />

      <FloatingElements count={20} />

      <PageBreadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Venues' }]} />

      <PageHero
        emoji="🏛️"
        titleWhite="Dance"
        titleOrange="Venues"
        subtitle="Discover the best bachata venues in your city — from studios and clubs to event spaces."
        widgets={heroWidgets}
        gradientFrom="primary"
        floatingIcons={floatingIcons}
        largeTitle={true}
      />

      {/* Venue Directory */}
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Venues</span>
          </h2>
        </ScrollReveal>

        {isLoading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <VenueSkeleton key={i} />
            ))}
          </div>
        ) : venues.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No venues listed yet</p>
            <p className="text-sm mt-1">Be the first to list your venue below</p>
          </div>
        ) : (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {venues.map((venue) => {
              const socials = venue.socials as { instagram?: string; website?: string } | null;
              const instagramHandle = socials?.instagram;
              const instagramUrl = instagramHandle
                ? instagramHandle.startsWith('http')
                  ? instagramHandle
                  : `https://instagram.com/${instagramHandle.replace('@', '')}`
                : null;
              const websiteUrl = socials?.website || null;

              return (
                <StaggerItem key={venue.id}>
                  <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.3 }}>
                    <Card
                      className="p-6 h-full bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-all duration-300 group flex flex-col cursor-pointer"
                      onClick={() => navigate(`/venue-entity/${venue.id}`)}
                    >
                      {/* Avatar */}
                      <div className="flex items-start justify-between mb-4">
                        <Avatar className="w-14 h-14 border border-primary/20">
                          <AvatarImage src={venue.avatar_url ?? undefined} alt={venue.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Building2 className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        {(instagramUrl || websiteUrl) && (
                          <div className="flex gap-1.5">
                            {instagramUrl && (
                              <a
                                href={instagramUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                              >
                                <Instagram className="w-3.5 h-3.5 text-primary" />
                              </a>
                            )}
                            {websiteUrl && (
                              <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                              >
                                <Globe className="w-3.5 h-3.5 text-primary" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Name + City */}
                      <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
                        {venue.name}
                      </h3>
                      {venue.cities?.name && (
                        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{venue.cities.name}</span>
                        </div>
                      )}

                      {/* Bio */}
                      {venue.bio && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 flex-1">
                          {venue.bio}
                        </p>
                      )}

                      {/* CTA */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/venue-entity/${venue.id}`);
                        }}
                      >
                        View Details
                      </Button>
                    </Card>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </section>

      {/* Get Listed Section */}
      <section id="get-listed" className="px-4 mb-16">
        <div className="max-w-md mx-auto">
          <ScrollReveal animation="fadeUp">
            <Card className="p-8 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
              <div className="text-center mb-8">
                <motion.div
                  className="text-6xl inline-block mb-4"
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🏛️
                </motion.div>
                <h2 className="text-3xl font-black mb-2">
                  <span className="text-foreground">List Your </span>
                  <span className="text-primary">Venue</span>
                </h2>
                <p className="text-muted-foreground">
                  Have a venue perfect for dance events? We'd love to hear from you.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Your Name *</label>
                  <Input
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Contact Number *</label>
                  <Input
                    type="tel"
                    placeholder="Your phone number"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  <Building className="w-4 h-4 mr-2" />
                  Submit
                </Button>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>We'll contact you within 2 hours</span>
                </div>
              </form>
            </Card>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};

export default Venues;
