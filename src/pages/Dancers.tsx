import { withPublicNames } from '@/lib/publicDancerNames';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Music, Star, Sparkles, Users, UserCheck, UserPlus, Loader2, Camera } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { usePeopleBadges } from '@/modules/person-page/badges';
import { DancersWall, MEDIA_BOOKING_HREF } from '@/modules/person-page/wall/lists';
import { HOME_ANNOUNCE_HREF } from '@/lib/homeAnnounceBanner';
import { flags } from '@/lib/featureFlags';
import { dancerHref, dancerTags, onlyDancers } from '@/components/dancers/dancerListModel';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { emitProfileView } from '@/lib/profileViewEmit';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { renderPublicName } from '@/lib/publicName';
import { getInitials } from '@/lib/name-utils';
import { buildCityPath } from '@/lib/cityPath';
import { useCity } from '@/contexts/CityContext';
import { cityHasNoRows, SHOWING_EVERYONE } from '@/lib/pageCity';
import { usePageCity } from '@/hooks/usePageCity';
import EmptyCityNote from '@/components/listing/EmptyCityNote';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';

type Dancer = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  surname: string | null;
  favorite_styles: string[] | null;
  dance_started_year: number | null;
  avatar_url: string | null;
  looking_for_partner: boolean | null;
  cities: { name: string } | null;
  nationality: string | null;
  dance_role: string | null;
};

const Dancers = () => {
  const city = usePageCity();
  useSeo(buildSeoForRoute('dancers', { cityDisplay: city.name }));
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const { toast } = useToast();
    const practicePartnersPath = buildCityPath(citySlug, 'practice-partners');
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const teacherPagesOpen = flags.teacherDetail;
  const dancerIds = useMemo(() => dancers.map((d) => d.id), [dancers]);
  const { badges, isLoading: badgesLoading, isError: badgesFailed } = usePeopleBadges(dancerIds);
  // A failed badges read must never empty the page ("No dancers yet" would be false):
  // show every row unfiltered, without role labels (review C1). Only when there is nothing
  // to filter by: a failed background refetch keeps the cached badges, so it keeps the filter.
  // Round 2 R3: a read that SUCCEEDED with an empty map while there are dancer rows is a
  // broken/empty payload, not "nobody dances", so it shows unfiltered too (an errored read is
  // never loading, so this one condition covers both).
  const shownDancers = useMemo(
    () => (!badgesLoading && badges.size === 0 && dancers.length > 0 ? dancers : onlyDancers(dancers, badges)),
    [dancers, badges, badgesLoading],
  );

  useEffect(() => {
    const fetchDancers = async () => {
      try {
        const { data, error } = await supabase
          .from('dancer_profiles')
          .select('id, first_name, avatar_url, nationality, dance_role, cities!based_city_id(name), dancing_role_details(favorite_styles, dance_started_year, looking_for_partner)')
          .or('is_active.is.null,is_active.eq.true')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const masked = await withPublicNames(data || []);
        setDancers(masked.map((row) => ({
          ...row,
          favorite_styles: row.dancing_role_details?.favorite_styles ?? null,
          dance_started_year: row.dancing_role_details?.dance_started_year ?? null,
          looking_for_partner: row.dancing_role_details?.looking_for_partner ?? null,
        })));
      } catch (error: any) {
        toast({
          title: 'Error loading dancers',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancers();
  }, [toast]);

  // Same resolver the detail page and its loader use. Without it the listing
  // showed "Dancer" for every card whose name lives in `display_name`, so the
  // list and the profile it linked to disagreed about who the person was.
  const getDisplayName = (dancer: Dancer) => renderPublicName(dancer, 'Dancer');

  // Initials, not an emoji. This replaces `getAvatarEmoji`, whose every branch
  // returned the literal two-character string "??" -- U+003F question marks,
  // verified against the raw bytes on origin/main as well as here. That is a
  // mojibake-collapsed emoji pair, and it had been rendering on every
  // avatar-less dancer card in production. check:mojibake cannot catch it: the
  // corruption had already completed, leaving plain ASCII behind, so there is
  // no suspect byte sequence left to detect. Initials keep Unicode out of this
  // path entirely, which is what stops the cp1252 round-trip recurring here.
  //
  // Derived from the RESOLVED name, not the raw row: getInitials reads
  // first_name/surname/name and knows nothing about display_name, so a dancer
  // named only in display_name would fall back to placeholder initials while
  // the card heading right below showed their real name.
  const getAvatarFallback = (dancer: Dancer) => getInitials({ name: getDisplayName(dancer) }, 'BC');

  return (
    <GlobalLayout
      showSubheader={false}
      hero={{
        emoji: '💃',
        titleWhite: 'Meet',
        titleOrange: 'Dancers',
        floatingIcons: [Users, Star, Heart, Music, Sparkles, UserCheck],
        largeTitle: true,
      }}
    >
      {/* Hero Widgets */}
      <div className='relative z-10 px-4 -mt-6 mb-16'>
          {/* Hero Widgets - 2 small cards */}
          <ScrollReveal animation="scale" delay={0.6}>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-8">
              {/* Find Practice Partners Widget */}
              <motion.div
                onClick={() => navigate(practicePartnersPath)}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-primary/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <Users className="w-7 h-7 md:w-9 md:h-9 mb-2 text-primary" aria-hidden="true" />
                <h3 className="font-bold text-xs md:text-sm text-foreground">Find Practice Partners</h3>
              </motion.div>
              
              {/* Create A Profile Widget */}
              <motion.div
                onClick={() => (flags.peopleWall ? navigate(HOME_ANNOUNCE_HREF) : navigate('/create-dancers-profile'))}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm rounded-2xl border border-festival-pink/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <UserPlus className="w-7 h-7 md:w-9 md:h-9 mb-2 text-festival-pink" aria-hidden="true" />
                <h3 className="font-bold text-xs md:text-sm text-foreground">Create a Profile</h3>
              </motion.div>

              {/* Book Media Widget */}
              <motion.div
                onClick={() => (flags.peopleWall ? navigate(MEDIA_BOOKING_HREF) : navigate('/photographers'))}
                className="cursor-pointer p-4 md:p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 backdrop-blur-sm rounded-2xl border border-blue-500/30 shadow-lg w-[140px] md:w-[160px]"
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <Camera className="w-7 h-7 md:w-9 md:h-9 mb-2 text-blue-400" aria-hidden="true" />
                <h3 className="font-bold text-xs md:text-sm text-foreground">Book a Photoshoot</h3>
              </motion.div>
            </div>
          </ScrollReveal>

      </div>

      {/* Browse Dancers Directory */}
      {flags.peopleWall ? (
        <>
        {!isLoading && cityHasNoRows(shownDancers, city, (d) => d.cities?.name) && (
          <div className="px-4 mb-3">
            <EmptyCityNote cityName={city.name} citySlug={city.slug} footnote={shownDancers.length > 0 ? SHOWING_EVERYONE : undefined} />
          </div>
        )}
        <DancersWall dancers={shownDancers} getName={getDisplayName} isLoading={isLoading || badgesLoading} badges={badges} badgesFailed={badgesFailed} teacherPagesOpen={teacherPagesOpen} />
        </>
      ) : (
      <section id="directory" className="px-4 mb-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-6">
            <span className="text-foreground">Browse </span>
            <span className="text-primary">Dancers</span>
          </h2>
        </ScrollReveal>

        {isLoading || badgesLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : shownDancers.length === 0 && !city.isLondon ? (
          <div className="px-2 py-8">
            <EmptyCityNote cityName={city.name} citySlug={city.slug} />
          </div>
        ) : shownDancers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              No dancers yet. Be the first to join!
            </p>
            <Button onClick={() => navigate('/create-dancers-profile')}>
              Create Your Profile
            </Button>
          </div>
        ) : (
          <>
          {cityHasNoRows(shownDancers, city, (d) => d.cities?.name) && (
            <div className="px-2 mb-3">
              <EmptyCityNote cityName={city.name} citySlug={city.slug} footnote={SHOWING_EVERYONE} />
            </div>
          )}
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 px-2">
            {shownDancers.map((dancer) => {
              const badge = badges.get(dancer.id);
              const tags = badge ? dancerTags(badge, teacherPagesOpen) : [];
              return (
              <StaggerItem key={dancer.id}>
                <Link
                  to={dancerHref(dancer.id, teacherPagesOpen)}
                  onClick={() => emitProfileView({ personId: dancer.id, profileType: 'dancer', context: 'listing:dancers' })}
                  data-testid="dancer-tile"
                  className="block h-full"
                >
                  <Card className="p-3 h-full flex flex-col bg-gradient-to-br from-surface to-background border-primary/20 hover:border-primary/50 transition-colors group">
                    <div className="flex justify-center mb-2">
                      <div className="relative">
                        {dancer.avatar_url ? (
                          <img src={optimizedImageUrl(dancer.avatar_url, 160)} alt="" className="w-12 h-12 rounded-full object-cover" loading="lazy" />
                        ) : (
                          <span className="flex w-12 h-12 items-center justify-center rounded-full bg-secondary/30 text-secondary-foreground border border-secondary/20 text-sm font-bold">
                            {getAvatarFallback(dancer)}
                          </span>
                        )}
                        <NationalityFlag code={pickNationalityCode(dancer)} size={48} />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-foreground text-center leading-tight break-words group-hover:text-primary transition-colors">
                      {getDisplayName(dancer)}
                    </h3>
                    <div className="mt-auto pt-1 min-h-[26px] box-content flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5" data-testid="role-labels">
                      {tags.map((t) => (
                        <span key={t.role} className="text-[12px] leading-none text-muted-foreground">
                          <span className="sr-only">, </span>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </Card>
                </Link>
              </StaggerItem>
              );
            })}
          </StaggerContainer>
          </>
        )}
      </section>
      )}

      {/* Find A Dance Partner CTA */}
      <section id="find-partner" className="px-4 mb-16 max-w-4xl mx-auto">
        <ScrollReveal animation="fadeUp">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-festival-pink/20 via-festival-purple/10 to-primary/20 border-festival-pink/30">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <Heart className="w-12 h-12 md:w-14 md:h-14 text-festival-pink" aria-hidden="true" />
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  <span className="text-foreground">Find A </span>
                  <span className="text-primary">Dance Partner</span>
                </h2>
                <p className="text-muted-foreground mb-4">Connect with dancers looking for practice partners</p>
                
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">200+ looking for partners</span>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate(practicePartnersPath)}
                className="shrink-0"
                size="lg"
              >
                <Heart className="w-4 h-4 mr-2" />
                Find Partners
              </Button>
            </div>
          </Card>
        </ScrollReveal>
      </section>

      {/* Footer */}
    </GlobalLayout>
  );
};

export default Dancers;

