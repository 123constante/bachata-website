import { useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity } from '@/contexts/CityContext';
import OrganiserDossierCard from '@/components/organiser/OrganiserDossierCard';
import OrganiserHoloCard from '@/components/organiser/OrganiserHoloCard';

type OrgRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  organisation_category: string | null;
  city_id?: string;
  cities?: { name: string } | null;
};

const Organisers = () => {
  const { citySlug } = useCity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const categoryFilter = searchParams.get('category')?.trim() || null;
  const searchFilter = searchParams.get('search')?.trim() || null;

  const { data: organisers = [], isLoading } = useQuery({
    queryKey: ['entities-organisers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organiser_profiles')
        .select('id, name, avatar_url, bio, organisation_category, city_id')
        .not('is_active', 'is', false)
        .order('name');
      if (error) throw error;

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

  // Directory shows all organisers regardless of city context, so the
  // count should be unfiltered (city-filtered count returns 0 when the
  // useCity() slug doesn't match cities.slug -- e.g. "london" vs "london-gb").
  const { data: eventCounts = {} } = useQuery({
    queryKey: ['organiser-event-counts-all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_event_counts' as any, {
        p_city_slug: null,
      });
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id) counts[item.entity_id] = item.event_count ?? 0;
      });
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: nextEventDates } = useQuery({
    queryKey: ['organiser-next-event-dates'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_next_event_dates' as any);
      if (error) return {} as Record<string, string>;
      const dates: Record<string, string> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id && item?.next_event_date) {
          dates[item.entity_id] = item.next_event_date;
        }
      });
      return dates;
    },
    staleTime: 15 * 60 * 1000,
  });

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    organisers.forEach((o) => {
      if (o.organisation_category) cats.add(o.organisation_category);
    });
    return Array.from(cats).sort();
  }, [organisers]);

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    organisers.forEach((o) => {
      const cat = o.organisation_category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [organisers]);

  const filteredOrganisers = useMemo(() => {
    let result = organisers;
    if (categoryFilter) {
      const needle = categoryFilter.toLowerCase();
      result = result.filter((o) => (o.organisation_category ?? '').toLowerCase() === needle);
    }
    if (searchFilter) {
      const needle = searchFilter.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(needle) ||
          (o.cities?.name ?? '').toLowerCase().includes(needle)
      );
    }
    return result;
  }, [organisers, categoryFilter, searchFilter]);

  const liveOrganisers = useMemo(() => {
    return filteredOrganisers.filter((org) => {
      const nextDate = nextEventDates[org.id];
      if (!nextDate) return false;
      const d = new Date(nextDate);
      const today = new Date();
      d.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
  }, [filteredOrganisers, nextEventDates]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('search', value.trim());
    else next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const handleCategoryFilter = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (categoryFilter === category) next.delete('category');
    else next.set('category', category);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('organisers')} showSubheader={true}>
      <div className="bg-gradient-to-b from-primary/10 to-transparent px-4 py-8 text-center sm:py-10">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">Organisers</div>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          Who runs <span className="text-primary">bachata</span> near you
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {organisers.length} organiser{organisers.length !== 1 ? 's' : ''} across {new Set(organisers.map((o) => o.cities?.name || '')).size} UK cities
        </p>
        <div className="relative mx-auto mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or city..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50 focus:bg-primary/5 focus:outline-none"
          />
        </div>
      </div>

      {liveOrganisers.length > 0 && (
        <div className="border-b border-green-500/30 bg-green-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500 shadow-lg shadow-green-500/60" />
            <p className="text-xs sm:text-sm">
              <strong className="text-green-500">{liveOrganisers.length} organiser{liveOrganisers.length !== 1 ? 's' : ''}</strong> <span className="text-muted-foreground">running events tonight</span>
            </p>
          </div>
        </div>
      )}

      {liveOrganisers.length > 0 && (
        <div className="border-b border-white/5 px-4 py-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Active tonight</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {liveOrganisers.slice(0, 6).map((org, idx) => (
              <div key={org.id} className="flex-shrink-0" style={{ width: '110px' }}>
                <OrganiserHoloCard
                  id={org.id}
                  name={org.name}
                  avatarUrl={org.avatar_url}
                  organisationCategory={org.organisation_category}
                  cityName={org.cities?.name ?? null}
                  eventCount={eventCounts?.[org.id] ?? 0}
                  index={idx + 1}
                  isTonight
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 border-b border-white/5 bg-black/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => (categoryFilter ? clearFilters() : null)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              !categoryFilter ? 'border-primary bg-primary text-black' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
            }`}
          >
            All
            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{filteredOrganisers.length}</span>
          </button>

          {uniqueCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryFilter(cat)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                categoryFilter === cat ? 'border-primary bg-primary text-black' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
              }`}
            >
              {cat}
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{categoryCount[cat] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="px-4 pb-16">
        {isLoading ? (
          <div className="space-y-3 pt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg border border-white/5 p-3">
                <Skeleton className="h-14 w-14 flex-shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrganisers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {categoryFilter || searchFilter ? 'No organisers match your search.' : 'No organisers yet.'}
            </p>
            {(categoryFilter || searchFilter) && (
              <button
                onClick={clearFilters}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-black"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {filteredOrganisers.map((organiser) => (
              <OrganiserDossierCard
                key={organiser.id}
                id={organiser.id}
                name={organiser.name}
                avatarUrl={organiser.avatar_url}
                organisationCategory={organiser.organisation_category}
                cityName={organiser.cities?.name ?? null}
                eventCount={eventCounts?.[organiser.id] ?? 0}
                nextEventDate={nextEventDates[organiser.id] ?? null}
                isLive={liveOrganisers.some((o) => o.id === organiser.id)}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredOrganisers.length > 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {filteredOrganisers.length} organiser{filteredOrganisers.length !== 1 ? 's' : ''}
            {categoryFilter && ` in "${categoryFilter}"`}
            {searchFilter && ` matching "${searchFilter}"`}
          </p>
        )}
      </section>

    </GlobalLayout>
  );
};

export default Organisers;
