import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import PageHero from '@/components/PageHero';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import { buildFullName } from '@/lib/name-utils';

type DJCard = {
  id: string;
  dj_name: string | null;
  first_name: string | null;
  surname: string | null;
  hide_real_name: boolean | null;
  photo_url: string[] | null;
  bio: string | null;
  genres: string[] | null;
  nationality: string | null;
  verified: boolean | null;
  city: string | null;
  cities?: { name: string } | null;
};

const DJs = () => {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const { data: djs = [], isLoading } = useQuery({
    queryKey: ['dj-profiles-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dj_profiles')
        .select('id, dj_name, first_name, surname, hide_real_name, photo_url, bio, genres, nationality, verified, city, cities!city_id(name)')
        .eq('is_active', true)
        .order('dj_name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as DJCard[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    djs.forEach((dj) => (dj.genres ?? []).forEach((g) => g && set.add(g)));
    return [...set].sort();
  }, [djs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return djs.filter((dj) => {
      const name = (dj.dj_name || buildFullName(dj.first_name, dj.surname) || '').toLowerCase();
      const city = (dj.cities?.name || dj.city || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || city.includes(q);
      const matchesGenre = !selectedGenre || (dj.genres ?? []).includes(selectedGenre);
      return matchesSearch && matchesGenre;
    });
  }, [djs, search, selectedGenre]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <PageHero
        emoji="🎧"
        titleWhite="Bachata"
        titleOrange="DJs"
        subtitle="Discover the DJs behind the music — sensual, traditional, and everything in between."
        largeTitle={false}
      />

      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-2">
          <PageBreadcrumb items={[{ label: 'Parties', path: '/parties' }, { label: 'DJs' }]} />
        </div>

        {/* Search + genre filter */}
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or city…"
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

          {allGenres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGenre(null)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  !selectedGenre
                    ? 'bg-primary text-black border-primary font-semibold'
                    : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                All
              </button>
              {allGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedGenre === g
                      ? 'bg-primary text-black border-primary font-semibold'
                      : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎧</div>
            <p className="text-muted-foreground">No DJs match your search.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((dj) => {
              const displayName = dj.dj_name || buildFullName(dj.first_name, dj.surname) || 'DJ';
              const coverPhoto = Array.isArray(dj.photo_url) && dj.photo_url.length > 0 ? dj.photo_url[0] : null;
              const cityName = dj.cities?.name || dj.city;
              const genres = (dj.genres ?? []).filter(Boolean);

              return (
                <StaggerItem key={dj.id}>
                  <Link to={`/djs/${dj.id}`}>
                    <motion.div
                      whileHover={{ y: -4, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-2xl border border-border/40 bg-card p-4 text-center hover:border-primary/30 hover:shadow-md transition-all h-full flex flex-col"
                    >
                      <div className="relative mx-auto mb-3 w-fit">
                        <Avatar className="w-16 h-16 border border-primary/10">
                          <AvatarImage src={coverPhoto || undefined} alt={displayName} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                            {displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {dj.verified && (
                          <CheckCircle2 className="w-4 h-4 text-primary absolute -bottom-0.5 -right-0.5 bg-card rounded-full" />
                        )}
                      </div>

                      <p className="font-bold text-sm text-foreground leading-tight mb-0.5 line-clamp-1">{displayName}</p>
                      {cityName && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{cityName}</p>
                      )}

                      {genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-auto pt-2">
                          {genres.slice(0, 2).map((g) => (
                            <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/25 text-primary/70">
                              {g}
                            </Badge>
                          ))}
                          {genres.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground">
                              +{genres.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {filtered.length} DJ{filtered.length !== 1 ? 's' : ''}
            {selectedGenre ? ` · ${selectedGenre}` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default DJs;
