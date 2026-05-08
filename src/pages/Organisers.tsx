import { Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { emitProfileView } from '@/lib/profileViewEmit';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Users, Sparkles, Music, Trophy, Zap, X, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity } from '@/contexts/CityContext';
import { cn } from '@/lib/utils';

// Bento tier — controls grid span. Cycled through filteredOrganisers so the
// grid breaks rhythm every few cards. grid-flow-dense fills the gaps that
// the asymmetric spans leave behind, so we never get a jagged trailing row.
type BentoTier = 'feature' | 'wide' | 'tall' | 'standard';

const getBentoTier = (index: number): BentoTier => {
  const m = index % 8;
  if (m === 0) return 'feature';
  if (m === 4) return 'wide';
  if (m === 6) return 'tall';
  return 'standard';
};

const BENTO_SPAN: Record<BentoTier, string> = {
  feature: 'col-span-2 row-span-2',
  wide: 'col-span-2',
  tall: 'row-span-2',
  standard: '',
};

// Dark-to-orange gradient shades cycled across cards. Each card reads as a
// dark slate base bleeding into a warm orange / amber / gold corner. Hue and
// direction vary so adjacent cards never look identical, while the family
// reads as a single coherent palette.
const ORANGE_SHADES: string[] = [
  // burnt orange
  'bg-gradient-to-br from-slate-900 via-orange-900 to-orange-600',
  // amber
  'bg-gradient-to-br from-slate-900 via-amber-900 to-amber-500',
  // deep gold
  'bg-gradient-to-tr from-slate-900 via-yellow-900 to-amber-500',
  // burnt orange-red
  'bg-gradient-to-tr from-slate-900 via-red-900 to-orange-600',
  // warm amber
  'bg-gradient-to-bl from-slate-900 via-orange-800 to-amber-400',
  // dark gold
  'bg-gradient-to-br from-slate-900 via-amber-800 to-yellow-600',
  // deep burnt orange
  'bg-gradient-to-bl from-slate-900 via-orange-900 to-amber-700',
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  // ?category=... filters the listing to a single organisation_category.
  // Linked from the type-pill on each organiser profile page.
  const categoryFilter = searchParams.get('category')?.trim() || null;

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

  const filteredOrganisers = useMemo(() => {
    if (!categoryFilter) return organisers;
    const needle = categoryFilter.toLowerCase();
    return organisers.filter(
      (o) => (o.organisation_category ?? '').toLowerCase() === needle,
    );
  }, [organisers, categoryFilter]);

  const clearCategoryFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    setSearchParams(next, { replace: true });
  };

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('organisers')}
      hero={{
        emoji: '🎪',
        titleWhite: 'Event',
        titleOrange: 'Organisers',
        subtitle: 'The people and collectives behind the best bachata nights.',
        floatingIcons: [Users, Calendar, Sparkles, Music, Trophy, Zap],
      }}
    >
      <section className="px-4 mb-16">
        {/* Active category filter chip — visible whenever ?category=... is
            present, with a one-click clear. Fully opaque to match the
            design language on sibling pages. */}
        {categoryFilter && (
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <button
              type="button"
              onClick={clearCategoryFilter}
              className="inline-flex items-center gap-2 rounded-full bg-black border border-primary px-3 py-1.5 text-[11px] sm:text-xs font-bold text-primary uppercase tracking-[0.14em] hover:bg-primary hover:text-black transition-colors"
              aria-label={`Clear ${categoryFilter} filter`}
            >
              <span>{categoryFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bento card grid — 3 cols mobile · 5 cols tablet+ desktop with
            asymmetric spans (feature 2x2, wide 2x1, tall 1x2, standard 1x1)
            cycled across the cards. Fixed auto-rows + grid-flow-dense lets
            the smaller cells back-fill the holes that the bigger spans
            create. Each card cycles through ORANGE_SHADES so adjacent cards
            never share the same gradient. Single source of truth remains
            the existing entities query + get_organiser_event_counts RPC. */}
        {isLoading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3 px-2 auto-rows-[140px] md:auto-rows-[170px] grid-flow-dense">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className={cn('p-2 md:p-3 border border-white/10', ORANGE_SHADES[i % ORANGE_SHADES.length])}>
                <div className="flex justify-center mb-1.5">
                  <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3/4 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-1/2 mx-auto" />
              </Card>
            ))}
          </div>
        ) : filteredOrganisers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {categoryFilter
                ? `No organisers in "${categoryFilter}" yet.`
                : 'No organisers yet.'}
            </p>
          </div>
        ) : (
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3 px-2 auto-rows-[140px] md:auto-rows-[170px] grid-flow-dense">
            {filteredOrganisers.map((organiser, index) => {
              const eventCount = eventCounts?.[organiser.id] ?? 0;
              const tier = getBentoTier(index);
              const span = BENTO_SPAN[tier];
              const shade = ORANGE_SHADES[index % ORANGE_SHADES.length];
              const isHorizontal = tier === 'wide';
              const avatarSize = tier === 'feature'
                ? 'w-20 h-20 md:w-24 md:h-24'
                : tier === 'tall'
                ? 'w-16 h-16 md:w-20 md:h-20'
                : tier === 'wide'
                ? 'w-14 h-14 md:w-16 md:h-16'
                : 'w-12 h-12 md:w-14 md:h-14';
              const nameSize = tier === 'feature'
                ? 'text-sm md:text-base'
                : tier === 'tall'
                ? 'text-xs md:text-sm'
                : 'text-[11px] md:text-xs';

              return (
                <StaggerItem key={organiser.id} className={cn('h-full', span)}>
                  <Link
                    to={`/organisers/${organiser.id}`}
                    onClick={() => emitProfileView({ personId: organiser.id, profileType: 'organiser', context: 'listing:organisers' })}
                    className="block h-full"
                  >
                    <motion.div whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.25 }} className="h-full">
                      <Card className={cn(
                        'h-full border border-white/10 hover:border-white/40 transition-all duration-300 group cursor-pointer overflow-hidden',
                        shade,
                        isHorizontal
                          ? 'p-2.5 md:p-3 flex flex-row items-center gap-2.5 md:gap-3 text-left'
                          : 'p-2 md:p-3 flex flex-col items-center justify-center text-center',
                        tier === 'feature' && 'p-3 md:p-4',
                      )}>
                        {/* Logo / avatar */}
                        <Avatar className={cn(
                          avatarSize,
                          'border-2 border-white/30 group-hover:border-white/60 transition-colors shrink-0',
                          !isHorizontal && 'mb-1.5',
                        )}>
                          <AvatarImage src={organiser.avatar_url || undefined} alt={organiser.name} />
                          <AvatarFallback className={cn(
                            'bg-black/30 text-white font-black',
                            tier === 'feature' ? 'text-2xl md:text-3xl' : tier === 'tall' ? 'text-xl md:text-2xl' : 'text-base md:text-lg',
                          )}>
                            {organiser.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>

                        {/* Body — name + type + city + event count */}
                        <div className={cn('min-w-0', isHorizontal && 'flex-1')}>
                          <h3 className={cn(
                            'font-bold text-white leading-tight line-clamp-2 drop-shadow',
                            nameSize,
                            !isHorizontal && 'text-center',
                          )}>
                            {organiser.name}
                          </h3>

                          {organiser.organisation_category && (
                            <p className={cn(
                              'text-[9px] md:text-[10px] text-orange-100/90 line-clamp-1 mt-0.5',
                              !isHorizontal && 'text-center',
                            )}>
                              {organiser.organisation_category}
                            </p>
                          )}

                          {organiser.cities?.name && (
                            <p className={cn(
                              'text-[9px] md:text-[10px] text-orange-100/75 line-clamp-1 inline-flex items-center gap-0.5',
                              !isHorizontal && 'justify-center w-full',
                            )}>
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {organiser.cities.name}
                            </p>
                          )}

                          {eventCount > 0 && (
                            <div className={cn(
                              'mt-1.5 inline-flex items-center gap-1 text-[9px] md:text-[10px] text-orange-100 font-bold',
                              !isHorizontal && 'justify-center w-full',
                            )}>
                              <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              {eventCount} event{eventCount !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!isLoading && filteredOrganisers.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {filteredOrganisers.length} organiser{filteredOrganisers.length !== 1 ? 's' : ''}
            {categoryFilter ? ` in "${categoryFilter}"` : ''}
          </p>
        )}
      </section>
    </GlobalLayout>
  );
};

export default Organisers;
