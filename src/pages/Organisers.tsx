import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, Sparkles, Music, Trophy, Zap, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity } from '@/contexts/CityContext';
import OrganiserHoloCard from '@/components/organiser/OrganiserHoloCard';
import GetListedHoloCta from '@/components/organiser/GetListedHoloCta';

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
        .from('organiser_profiles')
        .select('id, name, avatar_url, bio, organisation_category, city_id')
        .not('is_active', 'is', false)
        .order('name');
      if (error) throw error;

      // Fetch city details for all organisers with city_id
      if (data && data.length > 0) {
        const cityIds = [...new Set(data.map((o: any) => o.city_id).filter(Boolean))];
        let cityMap: Record<string, { name: string }> = {};

        if (cityIds.length > 0) {
          const { data: cities } = await supabase
            .from('cities')
            .select('id, name')
            .in('id', cityIds);
          if (cities) {
            cityMap = Object.fromEntries(cities.map((c: any) => [c.id, { name: c.name }]));
          }
        }

        return (data as unknown as Array<any>).map((org) => ({
          ...org,
          cities: org.city_id ? cityMap[org.city_id] : null,
        })) as unknown as OrgRow[];
      }

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
        emoji: '\u{1F3AA}',
        titleWhite: 'Event',
        titleOrange: 'Organisers',
        subtitle: 'The people and collectives behind the best bachata nights.',
        floatingIcons: [Users, Calendar, Sparkles, Music, Trophy, Zap],
      }}
    >
      <section className="px-4 mb-16">
        {/* Active category filter chip — visible whenever ?category=... is
            present, with a one-click clear. */}
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

        {/* Uniform portrait grid of B4 Holo Trading Cards.
            2 col mobile · 3 col tablet · 4 col desktop. */}
        {isLoading ? (
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 px-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[7/10] rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 p-3 flex flex-col"
              >
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-2 w-20 rounded-sm" />
                  <Skeleton className="h-2 w-12 rounded-sm" />
                </div>
                <Skeleton className="flex-1 rounded-md" />
                <Skeleton className="h-3 w-3/4 mt-3 rounded-sm" />
                <Skeleton className="h-2 w-1/2 mt-1.5 rounded-sm" />
              </div>
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
          <StaggerContainer className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 px-2">
            {filteredOrganisers.map((organiser, index) => (
              <StaggerItem key={organiser.id}>
                <OrganiserHoloCard
                  id={organiser.id}
                  name={organiser.name}
                  avatarUrl={organiser.avatar_url}
                  organisationCategory={organiser.organisation_category}
                  cityName={organiser.cities?.name ?? null}
                  eventCount={eventCounts?.[organiser.id] ?? 0}
                  index={index + 1}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {!isLoading && filteredOrganisers.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {filteredOrganisers.length} organiser{filteredOrganisers.length !== 1 ? 's' : ''}
            {categoryFilter ? ` in "${categoryFilter}"` : ''}
          </p>
        )}
      </section>

      <GetListedHoloCta />
    </GlobalLayout>
  );
};

export default Organisers;
